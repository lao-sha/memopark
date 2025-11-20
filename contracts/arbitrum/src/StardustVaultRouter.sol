// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./StardustTradingVault.sol";
import "./PriceOracle.sol";

/**
 * @title StardustVaultRouter
 * @notice DUST 交易路由（纯 DUST 入口）
 * @dev 用户只能用 DUST 参与 AI 交易，Router 自动转换为 USDC
 * 
 * ## 核心功能
 * - **存入 DUST**：用户存入 DUST，Router 自动转换为 USDC 并存入 Vault
 * - **提取 DUST**：用户销毁 stUSDC，Router 转换为 DUST 返还
 * - **Uniswap 集成**：通过 Uniswap V3 进行 DUST ↔ USDC 交换
 * - **滑点保护**：设置最大滑点，保护用户资金
 * 
 * ## 交易流程
 * 
 * ### 存入流程
 * ```
 * 用户 DUST → Router → Uniswap (DUST → USDC) → Vault → stUSDC → 用户
 * ```
 * 
 * ### 提取流程
 * ```
 * 用户 stUSDC → Router → Uniswap (stUSDC → USDC) → Uniswap (USDC → DUST) → 用户
 * ```
 * 
 * @custom:security-contact security@stardust.com
 */
contract StardustVaultRouter is AccessControl, ReentrancyGuard, Pausable {
    /// DUST 代币
    IERC20 public immutable dust;
    
    /// USDC 代币
    IERC20 public immutable usdc;
    
    /// Stardust 交易金库
    StardustTradingVault public immutable vault;
    
    /// Uniswap V3 Router
    ISwapRouter public immutable uniswapRouter;
    
    /// 价格预言机
    PriceOracle public priceOracle;
    
    /// 是否启用 Oracle 验证（默认启用）
    bool public oracleEnabled = true;
    
    /// 暂停角色
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    /// 最大滑点（基点，如 300 = 3%）
    uint256 public maxSlippage = 300; // 3%
    
    /// 最小交换金额
    uint256 public minSwapAmount = 10e18; // 10 DUST
    
    /// Uniswap 池子费率
    uint24 public constant POOL_FEE = 3000; // 0.3%
    
    /// 路由统计
    struct RouterStats {
        uint256 totalDustDeposited;     // 累计存入的 DUST
        uint256 totalDustWithdrawn;     // 累计提取的 DUST
        uint256 totalUsdcSwapped;       // 累计交换的 USDC
        uint256 transactionCount;        // 交易次数
    }
    
    RouterStats public stats;
    
    /// 事件：DUST 已存入
    event DepositedWithDUST(
        address indexed user,
        uint256 dustAmount,
        uint256 usdcAmount,
        uint256 sharesIssued
    );
    
    /// 事件：DUST 已提取
    event WithdrawnToDUST(
        address indexed user,
        uint256 sharesRedeemed,
        uint256 usdcAmount,
        uint256 dustAmount
    );
    
    /// 事件：参数已更新
    event ParametersUpdated(
        uint256 maxSlippage,
        uint256 minSwapAmount
    );
    
    /**
     * @notice 构造函数
     * @param _dust DUST 代币地址
     * @param _usdc USDC 代币地址
     * @param _vault Stardust 交易金库地址
     * @param _uniswapRouter Uniswap V3 Router 地址
     * @param _priceOracle 价格预言机地址（可选，传 address(0) 禁用）
     */
    constructor(
        address _dust,
        address _usdc,
        address _vault,
        address _uniswapRouter,
        address _priceOracle
    ) {
        require(_dust != address(0), "Router: zero DUST");
        require(_usdc != address(0), "Router: zero USDC");
        require(_vault != address(0), "Router: zero Vault");
        require(_uniswapRouter != address(0), "Router: zero Uniswap");
        
        dust = IERC20(_dust);
        usdc = IERC20(_usdc);
        vault = StardustTradingVault(_vault);
        uniswapRouter = ISwapRouter(_uniswapRouter);
        
        // 设置 Oracle（如果提供）
        if (_priceOracle != address(0)) {
            priceOracle = PriceOracle(_priceOracle);
            oracleEnabled = true;
        } else {
            oracleEnabled = false;
        }
        
        // 授予部署者管理员权限
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        
        // 预先批准最大额度，节省后续交易的 gas
        // 这样每次交换时不需要再调用 approve
        dust.approve(_uniswapRouter, type(uint256).max);
        usdc.approve(_vault, type(uint256).max);
        usdc.approve(_uniswapRouter, type(uint256).max);
        IERC20(_vault).approve(_uniswapRouter, type(uint256).max);
    }
    
    /**
     * @notice 用 DUST 存入（唯一入口）
     * @dev 用户存入 DUST，Router 自动转换为 USDC 并存入 Vault
     * @param dustAmount DUST 数量
     * @param minUsdcOut 最小 USDC 输出（滑点保护）
     * @return sharesIssued 发行的 stUSDC 数量
     */
    function depositWithDUST(
        uint256 dustAmount,
        uint256 minUsdcOut
    ) external nonReentrant whenNotPaused returns (uint256 sharesIssued) {
        require(dustAmount >= minSwapAmount, "Router: amount too low");
        
        // 1. 转账 DUST 到 Router
        require(
            dust.transferFrom(msg.sender, address(this), dustAmount),
            "Router: DUST transfer failed"
        );
        
        // 2. 通过 Uniswap 交换 DUST → USDC
        uint256 usdcAmount = _swapDUSTToUSDC(dustAmount, minUsdcOut);
        
        // 3. 存入 Vault（已在构造函数中批准，无需再次批准）
        sharesIssued = vault.depositFromRouter(msg.sender, usdcAmount);
        
        // 5. 更新统计
        stats.totalDustDeposited += dustAmount;
        stats.totalUsdcSwapped += usdcAmount;
        stats.transactionCount++;
        
        // 6. 触发事件
        emit DepositedWithDUST(msg.sender, dustAmount, usdcAmount, sharesIssued);
        
        return sharesIssued;
    }
    
    /**
     * @notice 提取为 DUST（使用 Multi-hop Swap 优化）
     * @dev 用户销毁 stUSDC，Router 通过 Uniswap Multi-hop 一次性转换为 DUST
     * @param stUsdcAmount stUSDC 数量
     * @param minDustOut 最小 DUST 输出（总体滑点保护）
     * @return dustAmount 提取的 DUST 数量
     */
    function withdrawToDUST(
        uint256 stUsdcAmount,
        uint256 minDustOut
    ) external nonReentrant whenNotPaused returns (uint256 dustAmount) {
        require(stUsdcAmount > 0, "Router: zero amount");
        require(minDustOut > 0, "Router: minDustOut zero");
        
        // 1. 转账 stUSDC 到 Router
        require(
            IERC20(address(vault)).transferFrom(msg.sender, address(this), stUsdcAmount),
            "Router: stUSDC transfer failed"
        );
        
        // 2. 使用 Multi-hop Swap 一次性完成 stUSDC → USDC → DUST
        // 这样可以防止 MEV 机器人在两步之间夹击
        dustAmount = _swapStUSDCToDUSTMultiHop(stUsdcAmount, minDustOut);
        require(dustAmount >= minDustOut, "Router: insufficient DUST output");
        
        // 3. 转账 DUST 给用户
        require(
            dust.transfer(msg.sender, dustAmount),
            "Router: DUST transfer failed"
        );
        
        // 4. 更新统计（USDC 数量估算）
        stats.totalDustWithdrawn += dustAmount;
        // 注意：Multi-hop 无法直接获取中间 USDC 数量，这里不更新 totalUsdcSwapped
        stats.transactionCount++;
        
        // 5. 触发事件（usdcAmount 设为 0 表示 multi-hop）
        emit WithdrawnToDUST(msg.sender, stUsdcAmount, 0, dustAmount);
        
        return dustAmount;
    }
    
    /**
     * @notice 提取为 DUST（传统两步方式，保留兼容性）
     * @dev 已弃用：建议使用 withdrawToDUST 的 multi-hop 版本
     * @param stUsdcAmount stUSDC 数量
     * @param minUsdcOut 最小 USDC 输出（第一步滑点保护）
     * @param minDustOut 最小 DUST 输出（第二步滑点保护）
     * @return dustAmount 提取的 DUST 数量
     */
    function withdrawToDUSTLegacy(
        uint256 stUsdcAmount,
        uint256 minUsdcOut,
        uint256 minDustOut
    ) external nonReentrant whenNotPaused returns (uint256 dustAmount) {
        require(stUsdcAmount > 0, "Router: zero amount");
        require(minUsdcOut > 0, "Router: minUsdcOut zero");
        require(minDustOut > 0, "Router: minDustOut zero");
        
        // 1. 转账 stUSDC 到 Router
        require(
            IERC20(address(vault)).transferFrom(msg.sender, address(this), stUsdcAmount),
            "Router: stUSDC transfer failed"
        );
        
        // 2. 通过 Uniswap 出售 stUSDC → USDC（带滑点保护）
        uint256 usdcAmount = _swapStUSDCToUSDC(stUsdcAmount, minUsdcOut);
        require(usdcAmount >= minUsdcOut, "Router: insufficient USDC output");
        
        // 3. 通过 Uniswap 交换 USDC → DUST（带滑点保护）
        dustAmount = _swapUSDCToDUST(usdcAmount, minDustOut);
        require(dustAmount >= minDustOut, "Router: insufficient DUST output");
        
        // 4. 转账 DUST 给用户
        require(
            dust.transfer(msg.sender, dustAmount),
            "Router: DUST transfer failed"
        );
        
        // 5. 更新统计
        stats.totalDustWithdrawn += dustAmount;
        stats.totalUsdcSwapped += usdcAmount;
        stats.transactionCount++;
        
        // 6. 触发事件
        emit WithdrawnToDUST(msg.sender, stUsdcAmount, usdcAmount, dustAmount);
        
        return dustAmount;
    }
    
    /**
     * @notice 内部函数：交换 DUST → USDC
     */
    function _swapDUSTToUSDC(
        uint256 dustAmount,
        uint256 minUsdcOut
    ) private returns (uint256 usdcAmount) {
        // 已在构造函数中批准最大额度，无需重复批准
        
        // 构建交换参数
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(dust),
            tokenOut: address(usdc),
            fee: POOL_FEE,
            recipient: address(this),
            deadline: block.timestamp + 300, // 5分钟
            amountIn: dustAmount,
            amountOutMinimum: minUsdcOut,
            sqrtPriceLimitX96: 0
        });
        
        // 执行交换
        usdcAmount = uniswapRouter.exactInputSingle(params);
        require(usdcAmount > 0, "Router: swap failed");
        
        // ✅ Oracle 价格验证（防止价格操纵）
        if (oracleEnabled && address(priceOracle) != address(0)) {
            (bool isValid, ) = priceOracle.validateSwapPrice(
                dustAmount,
                usdcAmount
            );
            require(isValid, "Router: price deviation exceeds limit");
        }
        
        return usdcAmount;
    }
    
    /**
     * @notice 内部函数：交换 USDC → DUST（带 Oracle 价格验证）
     */
    function _swapUSDCToDUST(
        uint256 usdcAmount,
        uint256 minDustOut
    ) private returns (uint256 dustAmount) {
        // 已在构造函数中批准最大额度，无需重复批准
        
        // 构建交换参数
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(usdc),
            tokenOut: address(dust),
            fee: POOL_FEE,
            recipient: address(this),
            deadline: block.timestamp + 300, // 5分钟
            amountIn: usdcAmount,
            amountOutMinimum: minDustOut,
            sqrtPriceLimitX96: 0
        });
        
        // 执行交换
        dustAmount = uniswapRouter.exactInputSingle(params);
        require(dustAmount > 0, "Router: swap failed");
        
        // ✅ Oracle 价格验证（防止价格操纵）
        if (oracleEnabled && address(priceOracle) != address(0)) {
            (bool isValid, ) = priceOracle.validateSwapPrice(
                dustAmount,
                usdcAmount
            );
            require(isValid, "Router: price deviation exceeds limit");
        }
        
        return dustAmount;
    }
    
    /**
     * @notice 内部函数：Multi-hop Swap (stUSDC → USDC → DUST)
     * @dev 使用 Uniswap V3 的 exactInput 进行路径交换，防止 MEV 夹击
     * @param stUsdcAmount stUSDC 数量
     * @param minDustOut 最小 DUST 输出
     * @return dustAmount 输出的 DUST 数量
     */
    function _swapStUSDCToDUSTMultiHop(
        uint256 stUsdcAmount,
        uint256 minDustOut
    ) private returns (uint256 dustAmount) {
        // 已在构造函数中批准最大额度，无需重复批准
        
        // 构建交换路径: stUSDC → USDC → DUST
        // path = abi.encodePacked(tokenIn, fee, tokenMid, fee, tokenOut)
        bytes memory path = abi.encodePacked(
            address(vault),  // stUSDC
            POOL_FEE,        // 0.3% fee
            address(usdc),   // USDC (中间代币)
            POOL_FEE,        // 0.3% fee
            address(dust)    // DUST
        );
        
        // 构建 Multi-hop 交换参数
        ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
            path: path,
            recipient: address(this),
            deadline: block.timestamp + 300, // 5分钟
            amountIn: stUsdcAmount,
            amountOutMinimum: minDustOut
        });
        
        // 执行 Multi-hop 交换
        dustAmount = uniswapRouter.exactInput(params);
        require(dustAmount > 0, "Router: multi-hop swap failed");
        
        return dustAmount;
    }
    
    /**
     * @notice 内部函数：交换 stUSDC → USDC
     * @param stUsdcAmount stUSDC 数量
     * @param minUsdcOut 最小 USDC 输出（滑点保护）
     */
    function _swapStUSDCToUSDC(
        uint256 stUsdcAmount,
        uint256 minUsdcOut
    ) private returns (uint256 usdcAmount) {
        // 已在构造函数中批准最大额度，无需重复批准
        
        // 构建交换参数
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(vault),
            tokenOut: address(usdc),
            fee: POOL_FEE,
            recipient: address(this),
            deadline: block.timestamp + 300, // 5分钟
            amountIn: stUsdcAmount,
            amountOutMinimum: minUsdcOut, // 滑点保护
            sqrtPriceLimitX96: 0
        });
        
        // 执行交换
        usdcAmount = uniswapRouter.exactInputSingle(params);
        require(usdcAmount > 0, "Router: swap failed");
        
        return usdcAmount;
    }
    
    /**
     * @notice 设置路由参数（管理员）
     * @param _maxSlippage 最大滑点（基点）
     * @param _minSwapAmount 最小交换金额
     */
    function setParameters(
        uint256 _maxSlippage,
        uint256 _minSwapAmount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_maxSlippage <= 1000, "Router: slippage too high"); // 最高 10%
        
        maxSlippage = _maxSlippage;
        minSwapAmount = _minSwapAmount;
        
        emit ParametersUpdated(_maxSlippage, _minSwapAmount);
    }
    
    /**
     * @notice 设置价格预言机（管理员）
     * @param _priceOracle 新的价格预言机地址
     */
    function setPriceOracle(address _priceOracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_priceOracle != address(0), "Router: zero Oracle");
        priceOracle = PriceOracle(_priceOracle);
        oracleEnabled = true;
    }
    
    /**
     * @notice 启用/禁用 Oracle 验证（管理员）
     * @param _enabled 是否启用
     */
    function setOracleEnabled(bool _enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        oracleEnabled = _enabled;
    }
    
    /**
     * @notice 暂停路由
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @notice 恢复路由
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @notice 查询路由统计
     */
    function getRouterStats() external view returns (
        uint256 totalDustDeposited_,
        uint256 totalDustWithdrawn_,
        uint256 netDustFlow_,
        uint256 totalUsdcSwapped_,
        uint256 transactionCount_
    ) {
        totalDustDeposited_ = stats.totalDustDeposited;
        totalDustWithdrawn_ = stats.totalDustWithdrawn;
        netDustFlow_ = totalDustDeposited_ > totalDustWithdrawn_ 
            ? totalDustDeposited_ - totalDustWithdrawn_
            : totalDustWithdrawn_ - totalDustDeposited_;
        totalUsdcSwapped_ = stats.totalUsdcSwapped;
        transactionCount_ = stats.transactionCount;
    }
    
    /**
     * @notice 紧急提取代币（管理员）
     * @dev 仅用于紧急情况，不应在正常操作中调用
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "Router: zero address");
        require(IERC20(token).transfer(to, amount), "Router: transfer failed");
    }
}

