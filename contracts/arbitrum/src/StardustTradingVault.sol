// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title StardustTradingVault
 * @notice Stardust AI 交易金库（纯 USDC 存入，发行 stUSDC 份额代币）
 * @dev 实现 "仅存入" 金库模型，提取通过 Uniswap 交换 stUSDC
 * 
 * ## 核心功能
 * - **存入 USDC**：用户存入 USDC，获得 stUSDC 份额代币
 * - **份额代币**：stUSDC 代表用户在金库中的份额
 * - **NAV 更新**：OCW 定期更新净资产价值（NAV）
 * - **禁止直接提取**：用户只能通过 Uniswap 出售 stUSDC
 * 
 * ## 份额计算
 * ```
 * 首次存入：stUSDC = USDC (1:1)
 * 后续存入：stUSDC = (USDC / sharePrice)
 * sharePrice = totalAssets / totalSupply
 * ```
 * 
 * ## 安全机制
 * - 仅 Router 可以调用 depositFromRouter()
 * - 仅 OCW 可以更新 NAV
 * - 支持暂停/恢复
 * - 完整的访问控制
 * 
 * @custom:security-contact security@stardust.com
 */
contract StardustTradingVault is ERC20, AccessControl, ReentrancyGuard, Pausable {
    /// USDC 代币合约（Arbitrum 上的 USDC）
    IERC20 public immutable usdc;
    
    /// Router 角色（只有 Router 可以调用 depositFromRouter）
    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");
    
    /// OCW 角色（有权更新 NAV）
    bytes32 public constant OCW_ROLE = keccak256("OCW_ROLE");
    
    /// 暂停角色
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    /// 净资产价值（NAV）- 以 USDC 计价（6位小数）
    uint256 public totalAssets;
    
    /// 最后更新时间
    uint256 public lastUpdateTime;
    
    /// 最小存款金额
    uint256 public minDepositAmount = 10e6; // 10 USDC
    
    /// 性能费率（基点，如 1000 = 10%）
    uint256 public performanceFee = 1000; // 10%
    
    /// 管理费率（年化，基点，如 200 = 2%）
    uint256 public managementFee = 200; // 2%
    
    /// 累计费用
    uint256 public accumulatedFees;
    
    /// 费用计算精度常量（用于提高精度）
    uint256 private constant FEE_PRECISION = 1e18;
    
    /// 累积的精度余数（防止精度损失）
    uint256 private feeRemainder;
    
    /// 最小初始存款（防止首存攻击）
    uint256 public constant MIN_INITIAL_DEPOSIT = 1000e6; // 1000 USDC
    
    /// 初始销毁份额（防止价格操纵）
    uint256 public constant INITIAL_SHARES_BURNED = 1000e18; // 1000 stUSDC
    
    /// 金库统计
    struct VaultStats {
        uint256 totalDeposited;      // 累计存入
        uint256 totalWithdrawn;      // 累计提取（通过 DEX）
        uint256 depositCount;        // 存款次数
        uint256 highWaterMark;       // 最高 NAV（用于性能费）
    }
    
    VaultStats public stats;
    
    /// 事件：存入
    event Deposited(
        address indexed user,
        uint256 usdcAmount,
        uint256 sharesIssued,
        uint256 sharePrice
    );
    
    /// 事件：NAV 已更新
    event NAVUpdated(
        uint256 newNAV,
        uint256 oldNAV,
        int256 pnl,
        uint256 timestamp
    );
    
    /// 事件：费用已收取
    event FeesCollected(
        uint256 performanceFeeAmount,
        uint256 managementFeeAmount,
        uint256 totalFees
    );
    
    /// 事件：参数已更新
    event ParametersUpdated(
        uint256 minDepositAmount,
        uint256 performanceFee,
        uint256 managementFee
    );
    
    /**
     * @notice 构造函数
     * @param _usdc USDC 代币地址（Arbitrum 上的 USDC）
     * @param _name 份额代币名称
     * @param _symbol 份额代币符号
     */
    constructor(
        address _usdc,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        require(_usdc != address(0), "Vault: zero address");
        
        usdc = IERC20(_usdc);
        totalAssets = 0;
        lastUpdateTime = block.timestamp;
        
        // 授予部署者管理员权限
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }
    
    /**
     * @notice 存入 USDC（仅 Router 调用）
     * @dev 只有 StardustVaultRouter 可以调用此函数
     * @param user 用户地址
     * @param usdcAmount USDC 数量
     * @return shares 发行的 stUSDC 数量
     */
    function depositFromRouter(
        address user,
        uint256 usdcAmount
    ) external onlyRole(ROUTER_ROLE) nonReentrant whenNotPaused returns (uint256 shares) {
        require(user != address(0), "Vault: zero address");
        require(usdcAmount >= minDepositAmount, "Vault: amount too low");
        
        // 1. 转账 USDC 到金库
        require(
            usdc.transferFrom(msg.sender, address(this), usdcAmount),
            "Vault: transfer failed"
        );
        
        // 2. 计算份额
        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0 || totalAssets == 0) {
            // 首次存入：需要最小金额，并销毁部分份额防止操纵
            require(usdcAmount >= MIN_INITIAL_DEPOSIT, "Vault: initial deposit too low");
            
            // 1 USDC = 1 stUSDC (18位小数)
            shares = usdcAmount * 1e12; // USDC 6位小数 → stUSDC 18位小数
            
            // 销毁初始份额到0地址，防止价格操纵
            // 这样攻击者无法通过小额首存+直接转账来操纵价格
            _mint(address(0), INITIAL_SHARES_BURNED);
            
            totalAssets = usdcAmount;
        } else {
            // 后续存入：shares = (usdcAmount / sharePrice)
            // sharePrice = totalAssets / totalSupply
            shares = (usdcAmount * 1e12 * _totalSupply) / totalAssets;
            totalAssets += usdcAmount;
        }
        
        // 3. 铸造 stUSDC
        _mint(user, shares);
        
        // 4. 更新统计
        stats.totalDeposited += usdcAmount;
        stats.depositCount++;
        
        // 5. 触发事件
        emit Deposited(user, usdcAmount, shares, getSharePrice());
        
        return shares;
    }
    
    /**
     * @notice 更新净资产价值（仅 OCW）
     * @dev OCW 定期查询 Hyperliquid 账户余额并更新 NAV
     * @param newNAV 新的净资产价值（USDC，6位小数）
     */
    function updateNAV(uint256 newNAV) external onlyRole(OCW_ROLE) {
        uint256 oldNAV = totalAssets;
        int256 pnl = int256(newNAV) - int256(oldNAV);
        
        uint256 totalFees = 0;
        uint256 perfFee = 0;
        uint256 mgmtFee = 0;
        
        // 1. 计算性能费（仅在盈利且超过历史高点时收取）
        // 使用高精度计算防止精度损失
        if (newNAV > stats.highWaterMark) {
            uint256 profit = newNAV - stats.highWaterMark;
            // 高精度计算: (profit * performanceFee * FEE_PRECISION) / (10000 * FEE_PRECISION)
            uint256 perfFeeHighPrecision = (profit * performanceFee * FEE_PRECISION) / 10000;
            perfFee = perfFeeHighPrecision / FEE_PRECISION;
            
            // 保存余数用于下次计算
            uint256 perfFeeRemainder = perfFeeHighPrecision % FEE_PRECISION;
            feeRemainder += perfFeeRemainder;
            
            totalFees += perfFee;
        }
        
        // 2. 计算管理费（按时间累积）
        uint256 timeElapsed = block.timestamp - lastUpdateTime;
        if (timeElapsed > 0 && totalAssets > 0) {
            // 高精度计算年化管理费
            uint256 mgmtFeeHighPrecision = (totalAssets * managementFee * timeElapsed * FEE_PRECISION) / (10000 * 365 days);
            mgmtFee = mgmtFeeHighPrecision / FEE_PRECISION;
            
            // 保存余数用于下次计算
            uint256 mgmtFeeRemainder = mgmtFeeHighPrecision % FEE_PRECISION;
            feeRemainder += mgmtFeeRemainder;
            
            totalFees += mgmtFee;
        }
        
        // 3. 检查是否有足够的累积余数可以转换为费用
        if (feeRemainder >= FEE_PRECISION) {
            uint256 additionalFee = feeRemainder / FEE_PRECISION;
            feeRemainder = feeRemainder % FEE_PRECISION;
            totalFees += additionalFee;
        }
        
        // 4. 检查费用是否超过 NAV（防止下溢）
        require(totalFees <= newNAV, "Vault: fees exceed NAV");
        
        // 5. 扣除费用并更新状态
        if (totalFees > 0) {
            accumulatedFees += totalFees;
            newNAV -= totalFees;
        }
        
        // 6. 更新高水位线（仅在盈利后扣除费用时更新）
        if (perfFee > 0) {
            stats.highWaterMark = newNAV;
        }
        
        // 7. 更新 NAV 和时间戳
        totalAssets = newNAV;
        lastUpdateTime = block.timestamp;
        
        // 8. 触发事件（包含费用信息）
        emit NAVUpdated(newNAV, oldNAV, pnl, block.timestamp);
        if (totalFees > 0) {
            emit FeesCollected(perfFee, mgmtFee, totalFees);
        }
    }
    
    /**
     * @notice 获取份额价格
     * @return price 份额价格（18位小数）
     */
    function getSharePrice() public view returns (uint256 price) {
        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            // 确保状态一致性
            require(totalAssets == 0, "Vault: invalid state");
            return 1e18; // 初始价格 1.0
        }
        // sharePrice = (totalAssets * 1e18) / totalSupply
        // 注意：totalAssets 是 6 位小数，totalSupply 是 18 位小数
        return (totalAssets * 1e30) / _totalSupply;
    }
    
    /**
     * @notice 提取累计费用（管理员）
     * @param to 接收地址
     */
    function collectFees(address to) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(to != address(0), "Vault: zero address");
        require(accumulatedFees > 0, "Vault: no fees");
        
        uint256 fees = accumulatedFees;
        accumulatedFees = 0;
        
        require(usdc.transfer(to, fees), "Vault: transfer failed");
        
        emit FeesCollected(0, 0, fees);
    }
    
    /**
     * @notice 设置金库参数（管理员）
     * @param _minDepositAmount 最小存款金额
     * @param _performanceFee 性能费率（基点）
     * @param _managementFee 管理费率（基点）
     */
    function setParameters(
        uint256 _minDepositAmount,
        uint256 _performanceFee,
        uint256 _managementFee
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // 更严格的费用限制，保护用户利益
        require(_performanceFee <= 2000, "Vault: perf fee too high"); // 最高 20%
        require(_managementFee <= 300, "Vault: mgmt fee too high"); // 最高 3%
        
        // 总费用率不超过 25%（假设全年盈利）
        // 最坏情况：20% 性能费 + 3% 管理费 = 23% < 25%
        require(
            _performanceFee + _managementFee <= 2500, 
            "Vault: total fees exceed 25%"
        );
        
        minDepositAmount = _minDepositAmount;
        performanceFee = _performanceFee;
        managementFee = _managementFee;
        
        emit ParametersUpdated(_minDepositAmount, _performanceFee, _managementFee);
    }
    
    /**
     * @notice 暂停金库
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @notice 恢复金库
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @notice 查询金库信息
     */
    function getVaultInfo() external view returns (
        uint256 totalAssets_,
        uint256 totalShares_,
        uint256 sharePrice_,
        uint256 totalDeposited_,
        uint256 depositCount_,
        uint256 accumulatedFees_
    ) {
        return (
            totalAssets,
            totalSupply(),
            getSharePrice(),
            stats.totalDeposited,
            stats.depositCount,
            accumulatedFees
        );
    }
    
    /**
     * @notice 覆盖 decimals() 返回 18（与 DUST 保持一致）
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}

