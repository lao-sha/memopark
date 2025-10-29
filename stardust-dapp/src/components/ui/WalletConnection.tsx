import React, { useState, useCallback, useEffect } from 'react';
import type { FC } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

// Utility function for combining class names
const classNames = (...classes: (string | undefined | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

// Wallet types
export interface WalletInfo {
  id: string;
  name: string;
  icon: string;
  installed: boolean;
  downloadUrl?: string;
}

// Mock wallet data (in real app, this would come from wallet detection)
const SUPPORTED_WALLETS: WalletInfo[] = [
  {
    id: 'polkadot-js',
    name: 'Polkadot{.js}',
    icon: '🔵',
    installed: typeof window !== 'undefined' && !!(window as any).injectedWeb3?.['polkadot-js'],
    downloadUrl: 'https://polkadot.js.org/extension/',
  },
  {
    id: 'talisman',
    name: 'Talisman',
    icon: '🔮',
    installed: typeof window !== 'undefined' && !!(window as any).injectedWeb3?.talisman,
    downloadUrl: 'https://talisman.xyz/',
  },
  {
    id: 'subwallet',
    name: 'SubWallet',
    icon: '👛',
    installed: typeof window !== 'undefined' && !!(window as any).injectedWeb3?.['subwallet-js'],
    downloadUrl: 'https://subwallet.app/',
  },
];

interface Account {
  address: string;
  name?: string;
  source: string;
}

export interface WalletConnectionProps {
  onConnect?: (account: Account) => void;
  onDisconnect?: () => void;
  className?: string;
}

export const WalletConnection: FC<WalletConnectionProps> = ({
  onConnect,
  onDisconnect,
  className,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletInfo | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [connectedAccount, setConnectedAccount] = useState<Account | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Handle wallet connection
  const handleWalletSelect = useCallback(async (wallet: WalletInfo) => {
    if (!wallet.installed) {
      window.open(wallet.downloadUrl, '_blank');
      return;
    }

    setIsConnecting(true);
    setSelectedWallet(wallet);

    try {
      // Mock wallet connection (replace with actual wallet API)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock accounts (replace with actual account fetching)
      const mockAccounts: Account[] = [
        {
          address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
          name: 'Alice',
          source: wallet.id,
        },
        {
          address: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
          name: 'Bob',
          source: wallet.id,
        },
      ];
      
      setAccounts(mockAccounts);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setSelectedWallet(null);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Handle account selection
  const handleAccountSelect = useCallback((account: Account) => {
    setConnectedAccount(account);
    setIsModalOpen(false);
    onConnect?.(account);
  }, [onConnect]);

  // Handle disconnect
  const handleDisconnect = useCallback(() => {
    setConnectedAccount(null);
    setAccounts([]);
    setSelectedWallet(null);
    onDisconnect?.();
  }, [onDisconnect]);

  // Format address for display
  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  return (
    <>
      {/* Connect/Disconnect Button */}
      {connectedAccount ? (
        <div className={classNames('flex items-center gap-3', className)}>
          <div className="flex items-center gap-2 px-3 py-2 bg-white/10 backdrop-blur-md rounded-lg border border-white/20">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {connectedAccount.name?.[0] || '?'}
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-white">
                {connectedAccount.name || 'Unknown'}
              </div>
              <div className="text-xs text-gray-300">
                {formatAddress(connectedAccount.address)}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            glassmorphism
          >
            断开连接
          </Button>
        </div>
      ) : (
        <Button
          variant="primary"
          onClick={() => setIsModalOpen(true)}
          glassmorphism
          className={className}
        >
          连接钱包
        </Button>
      )}

      {/* Wallet Connection Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="连接钱包"
        size="md"
      >
        <div className="p-6">
          {!selectedWallet ? (
            // Wallet selection
            <div className="space-y-3">
              <p className="text-gray-300 mb-4">
                选择一个钱包来连接到 Memopark
              </p>
              {SUPPORTED_WALLETS.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => handleWalletSelect(wallet)}
                  disabled={isConnecting}
                  className={classNames(
                    'w-full flex items-center justify-between p-4',
                    'bg-white/5 hover:bg-white/10 rounded-xl border border-white/10',
                    'transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
                    isConnecting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{wallet.icon}</span>
                    <span className="text-white font-medium">{wallet.name}</span>
                  </div>
                  {wallet.installed ? (
                    <span className="text-green-400 text-sm">已安装</span>
                  ) : (
                    <span className="text-orange-400 text-sm">安装</span>
                  )}
                </button>
              ))}
            </div>
          ) : accounts.length > 0 ? (
            // Account selection
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => {
                    setSelectedWallet(null);
                    setAccounts([]);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  ←
                </button>
                <span className="text-gray-300">选择账户</span>
              </div>
              {accounts.map((account) => (
                <button
                  key={account.address}
                  onClick={() => handleAccountSelect(account)}
                  className={classNames(
                    'w-full flex items-center gap-3 p-4',
                    'bg-white/5 hover:bg-white/10 rounded-xl border border-white/10',
                    'transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500/50'
                  )}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                    {account.name?.[0] || '?'}
                  </div>
                  <div className="text-left">
                    <div className="text-white font-medium">
                      {account.name || 'Unknown Account'}
                    </div>
                    <div className="text-gray-300 text-sm">
                      {formatAddress(account.address)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            // Loading state
            <div className="flex flex-col items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-300">正在连接到 {selectedWallet.name}...</p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
