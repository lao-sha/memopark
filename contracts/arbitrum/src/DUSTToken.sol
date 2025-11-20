// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title DUSTToken
 * @notice Stardust DUST 代币（Arbitrum ERC20 版本）
 * @dev 只有桥接合约可以铸造和销毁代币
 * 
 * ## 功能说明
 * - 标准 ERC20 代币
 * - 仅桥接合约有权铸造/销毁
 * - 支持暂停/恢复功能
 * - 完整的访问控制
 * 
 * ## 角色权限
 * - DEFAULT_ADMIN_ROLE: 超级管理员（设置其他角色）
 * - BRIDGE_ROLE: 桥接合约（铸造/销毁）
 * - PAUSER_ROLE: 暂停管理员（暂停/恢复）
 * 
 * @custom:security-contact security@stardust.com
 */
contract DUSTToken is ERC20, AccessControl, Pausable {
    /// 桥接角色（有权铸造和销毁）
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    
    /// 暂停角色（有权暂停和恢复）
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    /// 代币精度（与 Stardust 链保持一致）
    uint8 private constant DECIMALS = 18;
    
    /// 事件：铸造
    event Minted(address indexed to, uint256 amount, bytes32 indexed bridgeId);
    
    /// 事件：销毁
    event Burned(address indexed from, uint256 amount, bytes32 indexed bridgeId);
    
    /**
     * @notice 构造函数
     * @dev 部署者成为默认管理员
     */
    constructor() ERC20("Stardust DUST", "DUST") {
        // 授予部署者管理员权限
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }
    
    /**
     * @notice 铸造 DUST（仅桥接合约）
     * @dev 只有拥有 BRIDGE_ROLE 的合约可以调用
     * @param to 接收地址
     * @param amount 铸造数量
     * @param bridgeId 桥接 ID（用于审计）
     */
    function mint(
        address to,
        uint256 amount,
        bytes32 bridgeId
    ) external onlyRole(BRIDGE_ROLE) whenNotPaused {
        require(to != address(0), "DUSTToken: mint to zero address");
        require(amount > 0, "DUSTToken: mint amount zero");
        
        _mint(to, amount);
        emit Minted(to, amount, bridgeId);
    }
    
    /**
     * @notice 销毁 DUST（仅桥接合约）
     * @dev 只有拥有 BRIDGE_ROLE 的合约可以调用
     * @param from 销毁地址
     * @param amount 销毁数量
     * @param bridgeId 桥接 ID（用于审计）
     */
    function burn(
        address from,
        uint256 amount,
        bytes32 bridgeId
    ) external onlyRole(BRIDGE_ROLE) whenNotPaused {
        require(from != address(0), "DUSTToken: burn from zero address");
        require(amount > 0, "DUSTToken: burn amount zero");
        
        _burn(from, amount);
        emit Burned(from, amount, bridgeId);
    }
    
    /**
     * @notice 暂停代币转账
     * @dev 只有拥有 PAUSER_ROLE 的账户可以调用
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @notice 恢复代币转账
     * @dev 只有拥有 PAUSER_ROLE 的账户可以调用
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @notice 覆盖 decimals() 返回 18
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }
    
    /**
     * @notice 转账钩子（暂停时禁止转账）
     * @dev Solidity 0.8.20+ 使用 _update 而不是 _beforeTokenTransfer
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override whenNotPaused {
        super._update(from, to, amount);
    }
    
    /**
     * @notice 查询代币信息
     * @return name_ 代币名称
     * @return symbol_ 代币符号
     * @return decimals_ 代币精度
     * @return totalSupply_ 总供应量
     */
    function tokenInfo() external view returns (
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_
    ) {
        return (name(), symbol(), decimals(), totalSupply());
    }
}

