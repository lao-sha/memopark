import React, { useState, useEffect } from 'react';
import { Modal, Typography, Space, message, Badge } from 'antd';
import {
  CheckCircleFilled,
  PlusCircleOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import {
  loadAllKeystores,
  getCurrentAddress,
  setCurrentAddress,
  getAlias,
  type LocalKeystore,
} from '../../lib/keystore';
import { queryFreeBalance } from '../../lib/polkadot-safe';

const { Text } = Typography;

/**
 * 函数级详细中文注释：钱包切换器组件
 * - 显示所有本地钱包账户列表
 * - 支持切换当前钱包
 * - 显示每个钱包的别名、地址和余额
 * - 支持创建新钱包和导入钱包
 */

interface WalletSwitcherProps {
  visible: boolean;
  onClose: () => void;
  onSwitch?: (address: string) => void;
  onCreateNew?: () => void;
  onImport?: () => void;
}

interface WalletItem extends LocalKeystore {
  alias: string;
  balance: string;
  isLoading: boolean;
}

const WalletSwitcher: React.FC<WalletSwitcherProps> = ({
  visible,
  onClose,
  onSwitch,
  onCreateNew,
  onImport,
}) => {
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [currentAddr, setCurrentAddr] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadWallets();
    }
  }, [visible]);

  /**
   * 函数级详细中文注释：加载所有钱包
   * - 从 localStorage 读取所有 keystore
   * - 读取每个钱包的别名
   * - 异步查询每个钱包的余额
   */
  const loadWallets = async () => {
    const keystores = loadAllKeystores();
    const current = getCurrentAddress();
    setCurrentAddr(current);

    const items: WalletItem[] = keystores.map((ks) => ({
      ...ks,
      alias: getAlias(ks.address) || `钱包 ${ks.address.slice(0, 6)}`,
      balance: '...',
      isLoading: true,
    }));

    setWallets(items);

    // 异步加载余额
    items.forEach(async (item, index) => {
      try {
        const bal = await queryFreeBalance(item.address);
        setWallets((prev) => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = {
              ...updated[index],
              balance: bal.formatted,
              isLoading: false,
            };
          }
          return updated;
        });
      } catch (e) {
        console.error('查询余额失败:', e);
        setWallets((prev) => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = {
              ...updated[index],
              balance: '0.0000',
              isLoading: false,
            };
          }
          return updated;
        });
      }
    });
  };

  /**
   * 函数级详细中文注释：切换钱包
   * - 设置当前地址
   * - 触发回调
   * - 关闭弹窗
   */
  const handleSwitch = (address: string) => {
    if (address === currentAddr) {
      onClose();
      return;
    }

    setCurrentAddress(address);
    setCurrentAddr(address);
    message.success('已切换钱包');
    onSwitch?.(address);
    onClose();

    // 触发全局事件，通知其他组件更新
    window.dispatchEvent(new Event('mp.accountsUpdate'));
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SwapOutlined />
          <span>切换钱包</span>
        </div>
      }
      styles={{
        body: { maxHeight: '60vh', overflowY: 'auto', padding: '16px' },
      }}
    >
      {/* 钱包列表 */}
      <div style={{ marginBottom: '16px' }}>
        {wallets.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#8c8c8c',
            }}
          >
            <Text type="secondary">暂无钱包，请创建或导入</Text>
          </div>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {wallets.map((wallet) => {
              const isCurrent = wallet.address === currentAddr;
              return (
                <div
                  key={wallet.address}
                  onClick={() => handleSwitch(wallet.address)}
                  style={{
                    padding: '16px',
                    border: isCurrent
                      ? '2px solid #1890ff'
                      : '1px solid #f0f0f0',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: isCurrent ? '#e6f7ff' : '#fff',
                    transition: 'all 0.3s',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) {
                      e.currentTarget.style.borderColor = '#d9d9d9';
                      e.currentTarget.style.background = '#fafafa';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) {
                      e.currentTarget.style.borderColor = '#f0f0f0';
                      e.currentTarget.style.background = '#fff';
                    }
                  }}
                >
                  {/* 当前钱包标识 */}
                  {isCurrent && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                      }}
                    >
                      <CheckCircleFilled
                        style={{ fontSize: '20px', color: '#1890ff' }}
                      />
                    </div>
                  )}

                  {/* 钱包信息 */}
                  <div style={{ marginBottom: '8px' }}>
                    <Text
                      strong
                      style={{
                        fontSize: '16px',
                        color: isCurrent ? '#1890ff' : '#262626',
                      }}
                    >
                      {wallet.alias}
                    </Text>
                    {isCurrent && (
                      <Badge
                        count="当前"
                        style={{
                          backgroundColor: '#1890ff',
                          marginLeft: '8px',
                          fontSize: '10px',
                        }}
                      />
                    )}
                  </div>

                  {/* 地址 */}
                  <Text
                    type="secondary"
                    style={{
                      fontSize: '12px',
                      display: 'block',
                      marginBottom: '8px',
                      wordBreak: 'break-all',
                    }}
                  >
                    {wallet.address}
                  </Text>

                  {/* 余额 */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Text style={{ fontSize: '14px' }}>余额:</Text>
                    <Text
                      strong
                      style={{
                        fontSize: '14px',
                        color: isCurrent ? '#1890ff' : '#262626',
                      }}
                    >
                      {wallet.isLoading ? '...' : `${wallet.balance} DUST`}
                    </Text>
                  </div>
                </div>
              );
            })}
          </Space>
        )}
      </div>

      {/* 底部操作按钮 */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          paddingTop: '16px',
          borderTop: '1px solid #f0f0f0',
        }}
      >
        {/* 创建新钱包 */}
        <button
          onClick={() => {
            onClose();
            onCreateNew?.();
          }}
          style={{
            flex: 1,
            padding: '12px',
            border: '1px solid #1890ff',
            borderRadius: '8px',
            background: '#fff',
            color: '#1890ff',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.3s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e6f7ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fff';
          }}
        >
          <PlusCircleOutlined />
          创建新钱包
        </button>

        {/* 导入钱包 */}
        <button
          onClick={() => {
            onClose();
            onImport?.();
          }}
          style={{
            flex: 1,
            padding: '12px',
            border: '1px solid #d9d9d9',
            borderRadius: '8px',
            background: '#fff',
            color: '#262626',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'all 0.3s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#fafafa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fff';
          }}
        >
          导入钱包
        </button>
      </div>
    </Modal>
  );
};

export default WalletSwitcher;
