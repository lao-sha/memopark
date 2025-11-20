// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PriceOracle
 * @notice 去中心化价格预言机，使用 Chainlink Price Feeds
 * @dev 提供 DUST/USDC 价格验证，防止价格操纵攻击
 */
contract PriceOracle is AccessControl {
    
    /// 管理员角色（可以更新配置）
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    /// 价格更新者角色（OCW）
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");
    
    /// Chainlink USDC/USD Price Feed
    AggregatorV3Interface public usdcUsdFeed;
    
    /// Chainlink ETH/USD Price Feed（用于计算 DUST 价格）
    AggregatorV3Interface public ethUsdFeed;
    
    /// DUST/USDC 价格（来自 Stardust 链的 OCW 推送）
    /// 格式: 18 位小数 (1e18 = 1 USDC per DUST)
    uint256 public dustUsdcPrice;
    
    /// 最后更新时间
    uint256 public lastUpdateTime;
    
    /// 价格过期时间（默认 1 小时）
    uint256 public priceStaleThreshold = 1 hours;
    
    /// 最大偏差（基点，默认 5% = 500）
    uint256 public maxDeviation = 500; // 5%
    
    /// 最小价格（防止异常低价，默认 0.01 USDC）
    uint256 public minPrice = 0.01e18;
    
    /// 最大价格（防止异常高价，默认 100 USDC）
    uint256 public maxPrice = 100e18;
    
    /// 价格更新事件
    event PriceUpdated(
        uint256 dustUsdcPrice,
        uint256 timestamp,
        address updater
    );
    
    /// 配置更新事件
    event ConfigUpdated(
        uint256 priceStaleThreshold,
        uint256 maxDeviation,
        uint256 minPrice,
        uint256 maxPrice
    );
    
    /**
     * @notice 构造函数
     * @param _usdcUsdFeed Chainlink USDC/USD feed 地址
     * @param _ethUsdFeed Chainlink ETH/USD feed 地址
     */
    constructor(
        address _usdcUsdFeed,
        address _ethUsdFeed
    ) {
        require(_usdcUsdFeed != address(0), "Oracle: zero USDC feed");
        require(_ethUsdFeed != address(0), "Oracle: zero ETH feed");
        
        usdcUsdFeed = AggregatorV3Interface(_usdcUsdFeed);
        ethUsdFeed = AggregatorV3Interface(_ethUsdFeed);
        
        // 授予部署者管理员权限
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(UPDATER_ROLE, msg.sender);
    }
    
    /**
     * @notice 更新 DUST/USDC 价格（由 OCW 调用）
     * @dev OCW 从 Stardust 链获取 DUST 真实价格并推送到此合约
     * @param _dustUsdcPrice DUST/USDC 价格（18 位小数）
     */
    function updateDustPrice(uint256 _dustUsdcPrice) external onlyRole(UPDATER_ROLE) {
        require(_dustUsdcPrice >= minPrice, "Oracle: price too low");
        require(_dustUsdcPrice <= maxPrice, "Oracle: price too high");
        
        dustUsdcPrice = _dustUsdcPrice;
        lastUpdateTime = block.timestamp;
        
        emit PriceUpdated(_dustUsdcPrice, block.timestamp, msg.sender);
    }
    
    /**
     * @notice 获取 DUST/USDC 价格
     * @return price DUST/USDC 价格（18 位小数）
     * @return isValid 价格是否有效（未过期）
     */
    function getDustPrice() external view returns (uint256 price, bool isValid) {
        price = dustUsdcPrice;
        isValid = !isPriceStale();
        return (price, isValid);
    }
    
    /**
     * @notice 检查价格是否过期
     * @return 如果价格过期返回 true
     */
    function isPriceStale() public view returns (bool) {
        if (lastUpdateTime == 0) return true;
        return block.timestamp > lastUpdateTime + priceStaleThreshold;
    }
    
    /**
     * @notice 验证交换价格是否在合理范围内
     * @dev 比较 Uniswap 报价与 Oracle 价格，检测价格操纵
     * @param dustAmount DUST 数量
     * @param usdcAmount USDC 数量
     * @return isValid 价格是否有效
     * @return deviation 偏差（基点）
     */
    function validateSwapPrice(
        uint256 dustAmount,
        uint256 usdcAmount
    ) external view returns (bool isValid, uint256 deviation) {
        require(dustAmount > 0, "Oracle: zero DUST amount");
        require(usdcAmount > 0, "Oracle: zero USDC amount");
        require(!isPriceStale(), "Oracle: price stale");
        
        // 计算 Uniswap 实际价格: USDC / DUST
        // 注意：USDC 是 6 位小数，需要转换为 18 位
        uint256 swapPrice = (usdcAmount * 1e18) / dustAmount * 1e12; // 转换为 18 位小数
        
        // 计算偏差（基点）
        uint256 priceDiff;
        if (swapPrice > dustUsdcPrice) {
            priceDiff = swapPrice - dustUsdcPrice;
        } else {
            priceDiff = dustUsdcPrice - swapPrice;
        }
        
        deviation = (priceDiff * 10000) / dustUsdcPrice;
        
        // 检查偏差是否在允许范围内
        isValid = deviation <= maxDeviation;
        
        // 注意：view 函数不能 emit 事件
        // 验证失败时，调用方会收到 isValid = false
        
        return (isValid, deviation);
    }
    
    /**
     * @notice 获取 Chainlink USDC/USD 价格
     * @return price USDC/USD 价格（8 位小数）
     */
    function getUsdcUsdPrice() external view returns (uint256 price) {
        (, int256 answer, , uint256 updatedAt, ) = usdcUsdFeed.latestRoundData();
        require(answer > 0, "Oracle: invalid USDC price");
        require(block.timestamp - updatedAt < 1 days, "Oracle: USDC price stale");
        
        return uint256(answer);
    }
    
    /**
     * @notice 获取 Chainlink ETH/USD 价格
     * @return price ETH/USD 价格（8 位小数）
     */
    function getEthUsdPrice() external view returns (uint256 price) {
        (, int256 answer, , uint256 updatedAt, ) = ethUsdFeed.latestRoundData();
        require(answer > 0, "Oracle: invalid ETH price");
        require(block.timestamp - updatedAt < 1 days, "Oracle: ETH price stale");
        
        return uint256(answer);
    }
    
    /**
     * @notice 计算建议的最小输出（基于 Oracle 价格 + 滑点）
     * @param dustAmount DUST 输入数量
     * @param slippageBps 允许的滑点（基点，如 100 = 1%）
     * @return minUsdcOut 最小 USDC 输出
     */
    function getMinUsdcOut(
        uint256 dustAmount,
        uint256 slippageBps
    ) external view returns (uint256 minUsdcOut) {
        require(!isPriceStale(), "Oracle: price stale");
        require(slippageBps <= 1000, "Oracle: slippage too high"); // 最高 10%
        
        // 计算理论 USDC 输出（基于 Oracle 价格）
        uint256 theoreticalUsdc = (dustAmount * dustUsdcPrice) / 1e18;
        
        // 减去滑点
        minUsdcOut = (theoreticalUsdc * (10000 - slippageBps)) / 10000;
        
        // 转换为 USDC 的 6 位小数
        minUsdcOut = minUsdcOut / 1e12;
        
        return minUsdcOut;
    }
    
    /**
     * @notice 设置配置参数（管理员）
     * @param _priceStaleThreshold 价格过期时间（秒）
     * @param _maxDeviation 最大偏差（基点）
     * @param _minPrice 最小价格（18 位小数）
     * @param _maxPrice 最大价格（18 位小数）
     */
    function setConfig(
        uint256 _priceStaleThreshold,
        uint256 _maxDeviation,
        uint256 _minPrice,
        uint256 _maxPrice
    ) external onlyRole(ADMIN_ROLE) {
        require(_priceStaleThreshold >= 5 minutes, "Oracle: threshold too short");
        require(_priceStaleThreshold <= 24 hours, "Oracle: threshold too long");
        require(_maxDeviation >= 100, "Oracle: deviation too low"); // 至少 1%
        require(_maxDeviation <= 2000, "Oracle: deviation too high"); // 最高 20%
        require(_minPrice > 0, "Oracle: min price zero");
        require(_maxPrice > _minPrice, "Oracle: invalid price range");
        
        priceStaleThreshold = _priceStaleThreshold;
        maxDeviation = _maxDeviation;
        minPrice = _minPrice;
        maxPrice = _maxPrice;
        
        emit ConfigUpdated(
            _priceStaleThreshold,
            _maxDeviation,
            _minPrice,
            _maxPrice
        );
    }
    
    /**
     * @notice 更新 Chainlink Price Feed 地址（管理员）
     * @param _usdcUsdFeed 新的 USDC/USD feed 地址
     * @param _ethUsdFeed 新的 ETH/USD feed 地址
     */
    function updatePriceFeeds(
        address _usdcUsdFeed,
        address _ethUsdFeed
    ) external onlyRole(ADMIN_ROLE) {
        if (_usdcUsdFeed != address(0)) {
            usdcUsdFeed = AggregatorV3Interface(_usdcUsdFeed);
        }
        if (_ethUsdFeed != address(0)) {
            ethUsdFeed = AggregatorV3Interface(_ethUsdFeed);
        }
    }
}

