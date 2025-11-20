// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./DUSTToken.sol";

/**
 * @title DUSTBridge
 * @notice Arbitrum 桥接合约（锁定-铸造模型）
 * @dev 负责 Stardust 链原生 DUST 和 Arbitrum ERC20 DUST 的双向桥接
 * 
 * ## 功能说明
 * - **正向桥接**（Stardust → Arbitrum）：中继服务调用 mint() 铸造 ERC20 DUST
 * - **反向桥接**（Arbitrum → Stardust）：用户调用 burnAndBridgeBack() 销毁 ERC20 DUST
 * 
 * ## 安全机制
 * - 防重放攻击：记录已处理的 Stardust 桥接 ID
 * - 金额限制：设置最小/最大桥接金额
 * - 多节点验证：支持多个中继节点（可选）
 * - 暂停机制：紧急情况下可暂停桥接
 * 
 * @custom:security-contact security@stardust.com
 */
contract DUSTBridge is AccessControl, ReentrancyGuard, Pausable {
    /// DUST 代币合约
    DUSTToken public immutable dustToken;
    
    /// 中继角色（有权调用 mint）
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    
    /// 暂停角色
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    /// 最小桥接金额（防止粉尘攻击）
    uint256 public minBridgeAmount = 1e18; // 1 DUST
    
    /// 最大桥接金额（风险控制）
    uint256 public maxBridgeAmount = 1_000_000e18; // 1,000,000 DUST
    
    /// 已处理的 Stardust 桥接 ID（防止重放攻击）
    mapping(uint64 => bool) public processedBridgeIds;
    
    /// 桥接统计
    struct BridgeStats {
        uint256 totalBridgedToArbitrum;    // 总共桥接到 Arbitrum 的数量
        uint256 totalBridgedToStardust;    // 总共桥接回 Stardust 的数量
        uint256 bridgeCount;                // 桥接次数
    }
    
    BridgeStats public stats;
    
    /// 事件：铸造 DUST（Stardust → Arbitrum）
    event BridgeMint(
        uint64 indexed bridgeId,
        address indexed to,
        uint256 amount,
        bytes32 stardustTxHash
    );
    
    /// 事件：销毁 DUST（Arbitrum → Stardust）
    event BridgeBack(
        address indexed from,
        uint256 amount,
        bytes substrateAddress,
        bytes32 arbitrumTxHash
    );
    
    /// 事件：金额限制已更新
    event LimitsUpdated(uint256 minAmount, uint256 maxAmount);
    
    /**
     * @notice 构造函数
     * @param _dustToken DUST 代币合约地址
     */
    constructor(address _dustToken) {
        require(_dustToken != address(0), "DUSTBridge: zero address");
        
        dustToken = DUSTToken(_dustToken);
        
        // 授予部署者管理员权限
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }
    
    /**
     * @notice 铸造 DUST（仅中继服务调用）
     * @dev 中继服务监听 Stardust 链事件后调用此函数
     * @param bridgeId Stardust 桥接 ID
     * @param to 接收地址
     * @param amount 铸造数量
     * @param stardustTxHash Stardust 交易哈希（用于审计）
     */
    function mint(
        uint64 bridgeId,
        address to,
        uint256 amount,
        bytes32 stardustTxHash
    ) external onlyRole(RELAYER_ROLE) nonReentrant whenNotPaused {
        require(to != address(0), "DUSTBridge: zero address");
        require(amount >= minBridgeAmount, "DUSTBridge: amount too low");
        require(amount <= maxBridgeAmount, "DUSTBridge: amount too high");
        require(!processedBridgeIds[bridgeId], "DUSTBridge: already processed");
        
        // 标记已处理
        processedBridgeIds[bridgeId] = true;
        
        // 铸造 DUST
        dustToken.mint(to, amount, bytes32(uint256(bridgeId)));
        
        // 更新统计
        stats.totalBridgedToArbitrum += amount;
        stats.bridgeCount++;
        
        emit BridgeMint(bridgeId, to, amount, stardustTxHash);
    }
    
    /**
     * @notice 销毁 DUST 并桥接回 Stardust
     * @dev 用户调用此函数销毁 Arbitrum 上的 DUST，中继服务会在 Stardust 链解锁原生 DUST
     * @param amount 销毁数量
     * @param substrateAddress Substrate 接收地址（SS58 编码，32字节）
     */
    function burnAndBridgeBack(
        uint256 amount,
        bytes calldata substrateAddress
    ) external nonReentrant whenNotPaused {
        require(amount >= minBridgeAmount, "DUSTBridge: amount too low");
        require(amount <= maxBridgeAmount, "DUSTBridge: amount too high");
        require(substrateAddress.length == 32, "DUSTBridge: invalid address length");
        
        // 检查用户余额（提前失败，节省 gas）
        require(dustToken.balanceOf(msg.sender) >= amount, "DUSTBridge: insufficient balance");
        
        // 销毁用户的 DUST
        dustToken.burn(msg.sender, amount, bytes32(uint256(block.timestamp)));
        
        // 更新统计
        stats.totalBridgedToStardust += amount;
        stats.bridgeCount++;
        
        // 触发事件（中继服务监听此事件）
        emit BridgeBack(
            msg.sender,
            amount,
            substrateAddress,
            bytes32(uint256(block.timestamp))
        );
    }
    
    /**
     * @notice 设置最小/最大桥接金额
     * @param _minAmount 最小金额
     * @param _maxAmount 最大金额
     */
    function setLimits(
        uint256 _minAmount,
        uint256 _maxAmount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_minAmount > 0, "DUSTBridge: min amount zero");
        require(_maxAmount > _minAmount, "DUSTBridge: max < min");
        
        minBridgeAmount = _minAmount;
        maxBridgeAmount = _maxAmount;
        
        emit LimitsUpdated(_minAmount, _maxAmount);
    }
    
    /**
     * @notice 暂停桥接
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @notice 恢复桥接
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @notice 查询桥接统计
     */
    function getBridgeStats() external view returns (
        uint256 totalToArbitrum,
        uint256 totalToStardust,
        uint256 netFlow,
        uint256 bridgeCount
    ) {
        totalToArbitrum = stats.totalBridgedToArbitrum;
        totalToStardust = stats.totalBridgedToStardust;
        netFlow = totalToArbitrum > totalToStardust 
            ? totalToArbitrum - totalToStardust 
            : totalToStardust - totalToArbitrum;
        bridgeCount = stats.bridgeCount;
    }
}

