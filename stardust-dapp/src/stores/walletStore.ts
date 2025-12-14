/**
 * 钱包状态管理 Store
 *
 * 桥接 WalletProvider，提供统一的钱包状态访问接口
 * 重导出 useWallet hook 为 useWalletStore，保持命名一致性
 */
export { useWallet as useWalletStore } from '../providers/WalletProvider';
