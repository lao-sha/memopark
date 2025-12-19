import React, { useState, useEffect } from 'react';
import { Typography, Badge, message, Spin } from 'antd';
import {
  CopyOutlined,
  SettingOutlined,
  SyncOutlined,
  PlusCircleOutlined,
  ImportOutlined,
  SwapRightOutlined,
} from '@ant-design/icons';
import { getCurrentAddress, getAlias, loadAllKeystores, type LocalKeystore } from '../../lib/keystore';
import { queryFreeBalance } from '../../lib/polkadot-safe';
import WalletSwitcher from './WalletSwitcher';

const { Text } = Typography;

/**
 * 函数级详细中文注释：钱包管理页面组件
 * - 显示钱包地址和余额
 * - 提供转账和收款功能入口
 * - 展示资产列表（显示所有已登录的 DUST 账户）
 * - 移动端优先设计，最大宽度 640px 居中
 */

/**
 * 函数级详细中文注释：账户资产接口
 * - 存储每个账户的地址、别名、余额等信息
 */
interface AccountAsset {
  address: string;
  alias: string;
  balance: string;
  isCurrentAccount: boolean;
}

const WalletManagePage: React.FC = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0.0000');
  const [loading, setLoading] = useState(false);
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [walletAlias, setWalletAlias] = useState<string>('');
  const [accounts, setAccounts] = useState<AccountAsset[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(false);

  useEffect(() => {
    loadCurrentWallet();
    loadAllAccounts();
    
    // 监听账户切换事件
    const handleAccountUpdate = () => {
      loadCurrentWallet();
      loadAllAccounts();
    };
    window.addEventListener('mp.accountsUpdate', handleAccountUpdate);
    
    return () => {
      window.removeEventListener('mp.accountsUpdate', handleAccountUpdate);
    };
  }, []);

  /**
   * 函数级详细中文注释：加载当前钱包信息
   * - 读取当前地址
   * - 读取别名
   * - 查询余额
   */
  const loadCurrentWallet = () => {
    const addr = getCurrentAddress();
    setAddress(addr);
    if (addr) {
      const alias = getAlias(addr) || `钱包 ${addr.slice(0, 6)}`;
      setWalletAlias(alias);
      loadBalance(addr);
    }
  };

  /**
   * 函数级详细中文注释：加载余额
   * - 查询链上余额
   * - 更新显示
   */
  const loadBalance = async (addr: string) => {
    try {
      setLoading(true);
      const b = await queryFreeBalance(addr);
      setBalance(b.formatted);
    } catch (e) {
      console.error('加载余额失败:', e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 函数级详细中文注释：复制地址
   * - 复制钱包地址到剪贴板
   * - 显示成功提示
   */
  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      message.success('地址已复制');
    } catch {
      message.error('复制失败');
    }
  };

  /**
   * 函数级详细中文注释：加载所有账户资产信息
   * - 读取所有已登录的钱包
   * - 查询每个钱包的余额
   * - 标识当前账户
   */
  const loadAllAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const keystores: LocalKeystore[] = loadAllKeystores();
      const currentAddr = getCurrentAddress();
      
      if (keystores.length === 0) {
        setAccounts([]);
        return;
      }

      // 并行查询所有账户余额
      const accountPromises = keystores.map(async (ks) => {
        const alias = getAlias(ks.address) || `钱包 ${ks.address.slice(0, 6)}`;
        let balance = '0.0000';
        
        try {
          const result = await queryFreeBalance(ks.address);
          balance = result.formatted;
        } catch (e) {
          console.error(`查询余额失败 ${ks.address}:`, e);
        }
        
        return {
          address: ks.address,
          alias,
          balance,
          isCurrentAccount: ks.address === currentAddr,
        };
      });

      const accountAssets = await Promise.all(accountPromises);
      setAccounts(accountAssets);
    } catch (e) {
      console.error('加载账户资产失败:', e);
      message.error('加载资产信息失败');
    } finally {
      setLoadingAccounts(false);
    }
  };

  /**
   * 函数级详细中文注释：刷新余额
   * - 重新查询当前钱包余额
   * - 重新加载所有账户资产
   */
  const handleRefresh = () => {
    if (address) {
      loadBalance(address);
    }
    loadAllAccounts();
    message.info('刷新中...');
  };

  return (
    <div
      style={{
        maxWidth: '414px',
        margin: '0 auto',
        minHeight: '100vh',
        background: '#f5f5f5',
        paddingBottom: '60px',
      }}
    >
      {/* 顶部标题栏 */}
      <div
        style={{
          background: '#fff',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => window.history.back()}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ←
          </button>
          <Text strong style={{ fontSize: '18px' }}>
            我的钱包
          </Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setSwitcherVisible(true)}
            style={{
              border: '1px solid #1890ff',
              background: '#e6f7ff',
              color: '#1890ff',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.3s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#bae7ff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#e6f7ff';
            }}
          >
            <SwapRightOutlined />
            切换
          </button>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            Mainnet
          </Text>
        </div>
      </div>

      {/* 钱包卡片 */}
      <div style={{ padding: '16px' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #B2955D 0%, #9A7D4A 100%)',
            borderRadius: '16px',
            padding: '16px',
            color: '#fff',
            position: 'relative',
            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
          }}
        >
          {/* 设置图标 */}
          <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
            <SettingOutlined
              style={{ fontSize: '20px', cursor: 'pointer' }}
              onClick={() => message.info('钱包设置')}
            />
          </div>

          {/* 钱包名称和币种 */}
          <div style={{ marginBottom: '20px' }}>
            <Text
              style={{
                fontSize: '14px',
                color: '#fff',
                opacity: 0.8,
                display: 'block',
                marginBottom: '4px',
              }}
            >
              {walletAlias}
            </Text>
            <Text strong style={{ fontSize: '24px', color: '#fff' }}>
              {balance} DUST
            </Text>
          </div>

          {/* 钱包地址 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <Text
              style={{
                fontSize: '14px',
                color: '#fff',
                opacity: 0.9,
                wordBreak: 'break-all',
              }}
            >
              {address ? `${address.slice(0, 20)}...${address.slice(-10)}` : '未连接'}
            </Text>
            <CopyOutlined
              style={{ fontSize: '16px', cursor: 'pointer' }}
              onClick={handleCopyAddress}
            />
          </div>
        </div>
      </div>

      {/* 创建钱包和导入钱包按钮 */}
      <div
        style={{
          padding: '0 16px 24px',
          display: 'flex',
          gap: '16px',
        }}
      >
        {/* 创建钱包按钮 */}
        <button
          onClick={() => {
            // 跳转到创建钱包页面
            window.location.hash = '#/wallet/create';
          }}
          style={{
            flex: 1,
            padding: '16px',
            border: 'none',
            borderRadius: '12px',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#e6f7ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PlusCircleOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
          </div>
          <Text style={{ fontSize: '14px', color: '#262626' }}>创建钱包</Text>
        </button>

        {/* 导入钱包按钮 */}
        <button
          onClick={() => {
            // 跳转到恢复钱包页面
            window.location.hash = '#/wallet/restore';
          }}
          style={{
            flex: 1,
            padding: '16px',
            border: 'none',
            borderRadius: '12px',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fff7e6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ImportOutlined style={{ fontSize: '24px', color: '#fa8c16' }} />
          </div>
          <Text style={{ fontSize: '14px', color: '#262626' }}>导入钱包</Text>
        </button>
      </div>

      {/* 资产列表 - 显示所有已登录的 DUST 账户 */}
      <div style={{ padding: '0 16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <Text strong style={{ fontSize: '16px' }}>
            DUST 资产
          </Text>
          <SyncOutlined
            spin={loadingAccounts}
            style={{ fontSize: '16px', cursor: 'pointer', color: '#8c8c8c' }}
            onClick={handleRefresh}
          />
        </div>

        {/* 账户资产列表 */}
        {loadingAccounts ? (
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
            }}
          >
            <Spin>
              <div style={{ padding: '20px' }}>
                <Text type="secondary">加载中...</Text>
              </div>
            </Spin>
          </div>
        ) : accounts.length === 0 ? (
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
            }}
          >
            <Text type="secondary">暂无账户</Text>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
            {accounts.map((acc, index) => (
              <div
                key={acc.address}
                onClick={() => {
                  message.info(`查看 ${acc.alias} 详情`);
                }}
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  borderBottom: index === accounts.length - 1 ? 'none' : '1px solid #f0f0f0',
                  transition: 'background 0.3s',
                  background: acc.isCurrentAccount ? '#f0f7ff' : '#fff',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = acc.isCurrentAccount ? '#e6f7ff' : '#fafafa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = acc.isCurrentAccount ? '#f0f7ff' : '#fff';
                }}
              >
                {/* 左侧：图标 + 账户信息 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #B2955D 0%, #9A7D4A 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                    }}
                  >
                    🪙
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Text strong style={{ fontSize: '16px' }}>
                        {acc.alias}
                      </Text>
                      {acc.isCurrentAccount && (
                        <span
                          style={{
                            fontSize: '10px',
                            color: '#1890ff',
                            background: '#e6f7ff',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid #91d5ff',
                          }}
                        >
                          当前
                        </span>
                      )}
                    </div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {acc.address.slice(0, 8)}...{acc.address.slice(-8)}
                    </Text>
                  </div>
                </div>

                {/* 右侧：余额 */}
                <div style={{ textAlign: 'right' }}>
                  <Text strong style={{ fontSize: '16px', display: 'block' }}>
                    {acc.balance}
                  </Text>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    DUST
                  </Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 水印 */}
      <div
        style={{
          textAlign: 'center',
          padding: '20px',
          marginTop: '20px',
        }}
      >
        <Text type="secondary" style={{ fontSize: '12px' }}>
          https://www.memopark.com/wallet
        </Text>
      </div>

      {/* 底部导航栏 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: '414px',
          margin: '0 auto',
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-around',
          padding: '8px 0',
          zIndex: 1000,
        }}
      >
        {/* 首页按钮 */}
        <div
          onClick={() => {
            window.location.hash = '#/home';
          }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '24px' }}>🏠</div>
          <Text style={{ fontSize: '10px', color: '#8c8c8c' }}>首页</Text>
        </div>

        {/* 我的按钮 */}
        <div
          onClick={() => {
            console.log('点击我的，跳转到个人中心');
            window.location.hash = '#/profile';
          }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '24px' }}>👤</div>
          <Text style={{ fontSize: '10px', color: '#1890ff' }}>我的</Text>
        </div>
      </div>

      {/* 钱包切换弹窗 */}
      <WalletSwitcher
        visible={switcherVisible}
        onClose={() => setSwitcherVisible(false)}
        onSwitch={(addr) => {
          console.log('切换到钱包:', addr);
          // 切换钱包后跳转到个人中心页面
          window.location.hash = '#/profile';
        }}
        onCreateNew={() => {
          message.info('跳转到创建钱包页面');
          // 创建钱包功能在 AuthEntryPage 的 tab 中
          // 这里保持使用 mp.nav 事件（如果在 AuthEntryPage 内则有效）
          // 或者提示用户返回欢迎页面
          window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'create' } }));
        }}
        onImport={() => {
          message.info('跳转到恢复钱包页面');
          // 恢复钱包功能在 AuthEntryPage 的 tab 中
          // 这里保持使用 mp.nav 事件（如果在 AuthEntryPage 内则有效）
          // 或者提示用户返回欢迎页面
          window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'restore' } }));
        }}
      />
    </div>
  );
};

export default WalletManagePage;
