import React, { useState, useEffect } from 'react';
import { Typography, Badge, message, Modal, Input, Form, Button, Spin, Descriptions } from 'antd';
import {
  RightOutlined,
  WalletOutlined,
  LockOutlined,
  HistoryOutlined,
  GlobalOutlined,
  NotificationOutlined,
  MessageOutlined,
  InfoCircleOutlined,
  UserOutlined,
  SwapOutlined,
  EditOutlined,
  QrcodeOutlined,
  CopyOutlined,
  DashboardOutlined,
  ReloadOutlined,
  BankOutlined,
  SendOutlined,
  ShoppingCartOutlined,
  RetweetOutlined,
} from '@ant-design/icons';
import { QRCodeCanvas } from 'qrcode.react';
import { getCurrentAddress } from '../../lib/keystore';
import { getApi, signAndSendLocalFromKeystore } from '../../lib/polkadot-safe';

const { Text } = Typography;

/**
 * 函数级详细中文注释：我的钱包页面组件
 * - 参考图片设计的个人中心页面
 * - 顶部头像 + 标题
 * - 功能菜单列表（钱包管理、修改密码、交易历史等）
 * - 底部导航栏
 * - 移动端优先设计，最大宽度 640px 居中
 */
interface MenuItem {
  icon: React.ReactNode;
  title: string;
  badge?: number;
  onClick: () => void;
}

const MyWalletPage: React.FC = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [language, setLanguage] = useState('繁體中文');
  const [nickname, setNickname] = useState<string>('');
  const [refCode, setRefCode] = useState<string>('');
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [receiveModalVisible, setReceiveModalVisible] = useState<boolean>(false);
  const [chainDataModalVisible, setChainDataModalVisible] = useState<boolean>(false);
  const [governanceModalVisible, setGovernanceModalVisible] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [chainDataLoading, setChainDataLoading] = useState<boolean>(false);
  const [chainData, setChainData] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadAddress();
    
    // 监听账户切换事件
    const handleAccountUpdate = () => {
      loadAddress();
    };
    window.addEventListener('mp.accountsUpdate', handleAccountUpdate);
    
    return () => {
      window.removeEventListener('mp.accountsUpdate', handleAccountUpdate);
    };
  }, []);

  /**
   * 函数级详细中文注释：加载当前地址
   * - 读取当前钱包地址
   * - 更新状态
   * - 加载昵称和推荐码
   */
  const loadAddress = () => {
    const addr = getCurrentAddress();
    setAddress(addr);
    if (addr) {
      loadNickname(addr);
      loadRefCode(addr);
    }
  };

  /**
   * 函数级详细中文注释：加载当前账户的昵称
   * - 从链上 pallet-identity 读取 display 字段
   * - 如果未设置，默认显示"亲友"
   */
  const loadNickname = async (addr: string) => {
    try {
      const api = await getApi();
      const raw = await (api.query as any).identity?.identityOf?.(addr);
      if (raw && raw.isSome) {
        const reg = raw.unwrap();
        const disp = reg.info?.display;
        let value = '';
        if (disp) {
          if (disp.isRaw) value = Buffer.from(disp.asRaw.toU8a()).toString('utf8');
          else if (disp.isNone) value = '';
          else if (disp.asBytes) value = Buffer.from(disp.asBytes.toU8a()).toString('utf8');
          else value = String(disp.toString?.() || '');
        }
        setNickname(value || '亲友');
      } else {
        setNickname('亲友');
      }
    } catch (e: any) {
      console.warn('加载昵称失败:', e);
      setNickname('亲友');
    }
  };

  /**
   * 函数级详细中文注释：加载当前账户的推荐码
   * - 从链上 memoReferrals.codeOf 读取推荐码
   * - 如果未领取，设置为空字符串
   */
  const loadRefCode = async (addr: string) => {
    try {
      const api = await getApi();
      const qroot: any = api.query as any;
      const sec = qroot.memoReferrals || qroot.memo_referrals;
      if (!sec || !sec.codeOf) {
        setRefCode('');
        return;
      }
      const raw = await sec.codeOf(addr);
      if (raw && raw.isSome) {
        const v = raw.unwrap();
        const code = Buffer.from(v.toU8a()).toString('utf8');
        setRefCode(code);
      } else {
        setRefCode('');
      }
    } catch (e: any) {
      console.warn('加载推荐码失败:', e);
      setRefCode('');
    }
  };

  /**
   * 函数级详细中文注释：打开编辑昵称弹窗
   * - 显示编辑弹窗
   * - 设置当前昵称到表单
   */
  const handleEditNickname = () => {
    form.setFieldsValue({ nickname: nickname === '亲友' ? '' : nickname });
    setEditModalVisible(true);
  };

  /**
   * 函数级详细中文注释：保存昵称到链上
   * - 使用 identity.setIdentity 交易
   * - 需要用户签名
   * - 成功后更新显示
   */
  const handleSaveNickname = async (values: any) => {
    try {
      if (!address) {
        message.warning('请先连接钱包');
        return;
      }
      const name = String(values.nickname || '').trim();
      if (!name) {
        message.warning('请输入昵称');
        return;
      }
      setLoading(true);
      const args = [{ display: { Raw: name } }];
      const hash = await signAndSendLocalFromKeystore('identity', 'setIdentity', args);
      message.success(`昵称已保存，交易哈希: ${hash.slice(0, 10)}...`);
      setNickname(name);
      setEditModalVisible(false);
      form.resetFields();
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 函数级详细中文注释：取消编辑
   * - 关闭弹窗
   * - 重置表单
   */
  const handleCancelEdit = () => {
    setEditModalVisible(false);
    form.resetFields();
  };

  /**
   * 函数级详细中文注释：打开收款二维码弹窗
   * - 显示当前钱包地址的二维码
   * - 用户可扫码转账
   */
  const handleShowReceive = () => {
    if (!address) {
      message.warning('请先连接钱包');
      return;
    }
    setReceiveModalVisible(true);
  };

  /**
   * 函数级详细中文注释：复制钱包地址
   * - 将地址复制到剪贴板
   * - 显示成功提示
   */
  const handleCopyAddress = async () => {
    if (!address) {
      message.warning('无地址可复制');
      return;
    }
    try {
      await navigator.clipboard.writeText(address);
      message.success('地址已复制到剪贴板');
    } catch (e) {
      message.error('复制失败，请手动复制');
    }
  };

  /**
   * 函数级详细中文注释：关闭收款弹窗
   */
  const handleCloseReceive = () => {
    setReceiveModalVisible(false);
  };

  /**
   * 函数级详细中文注释：打开链上数据面板
   * - 显示链上数据弹窗
   * - 加载链上数据
   */
  const handleShowChainData = () => {
    setChainDataModalVisible(true);
    loadChainData();
  };

  /**
   * 函数级详细中文注释：加载链上数据
   * - 查询链的基本信息
   * - 查询当前账户的链上数据
   */
  const loadChainData = async () => {
    try {
      setChainDataLoading(true);
      const api = await getApi();
      
      // 基本链信息
      const chainName = api.runtimeChain.toString();
      const chainVersion = api.runtimeVersion.specVersion.toString();
      const chainToken = api.registry.chainTokens?.[0] || 'UNIT';
      const chainDecimals = api.registry.chainDecimals?.[0] || 12;
      
      // 区块信息
      const header = await api.rpc.chain.getHeader();
      const blockNumber = header.number.toString();
      const blockHash = header.hash.toString();
      
      // 节点信息
      const nodeName = await api.rpc.system.name();
      const nodeVersion = await api.rpc.system.version();
      
      // 账户信息
      let accountData = null;
      if (address) {
        const account: any = await api.query.system.account(address);
        const free = account?.data?.free?.toString() || '0';
        const reserved = account?.data?.reserved?.toString() || '0';
        const nonce = account?.nonce?.toString() || '0';
        
        accountData = {
          free: (BigInt(free) / BigInt(10 ** chainDecimals)).toString(),
          reserved: (BigInt(reserved) / BigInt(10 ** chainDecimals)).toString(),
          nonce,
        };
      }
      
      setChainData({
        chain: {
          name: chainName,
          version: chainVersion,
          token: chainToken,
          decimals: chainDecimals,
        },
        block: {
          number: blockNumber,
          hash: blockHash.slice(0, 20) + '...' + blockHash.slice(-10),
        },
        node: {
          name: nodeName.toString(),
          version: nodeVersion.toString(),
        },
        account: accountData,
      });
    } catch (e: any) {
      console.error('加载链上数据失败:', e);
      message.error('加载链上数据失败');
    } finally {
      setChainDataLoading(false);
    }
  };

  /**
   * 函数级详细中文注释：关闭链上数据面板
   */
  const handleCloseChainData = () => {
    setChainDataModalVisible(false);
  };

  /**
   * 函数级详细中文注释：检测是否为移动设备
   * - 检查 userAgent 和屏幕宽度
   * - 返回 true 表示移动端，false 表示桌面端
   */
  const isMobileDevice = (): boolean => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent.toLowerCase()
    );
    const isSmallScreen = window.innerWidth <= 768;
    return isMobileUA || isSmallScreen;
  };

  /**
   * 函数级详细中文注释：打开治理平台
   * - 移动端：显示提示弹窗，引导用户在电脑上访问
   * - 桌面端：直接打开治理平台网址
   */
  const handleOpenGovernance = () => {
    if (isMobileDevice()) {
      // 移动端：显示提示弹窗
      setGovernanceModalVisible(true);
    } else {
      // 桌面端：直接打开治理平台
      window.open('https://governance.memopark.net/', '_blank');
      message.success('正在打开治理平台...');
    }
  };

  /**
   * 函数级详细中文注释：关闭治理平台提示弹窗
   */
  const handleCloseGovernance = () => {
    setGovernanceModalVisible(false);
  };

  /**
   * 函数级详细中文注释：复制治理平台链接
   */
  const handleCopyGovernanceLink = async () => {
    try {
      await navigator.clipboard.writeText('https://governance.memopark.net/');
      message.success('链接已复制到剪贴板');
    } catch (e) {
      message.error('复制失败，请手动复制');
    }
  };

  /**
   * 函数级详细中文注释：菜单项配置
   * - 每个菜单项包含图标、标题、徽章数（可选）和点击事件
   */
  const menuItems: MenuItem[] = [
    {
      icon: <WalletOutlined style={{ fontSize: '20px' }} />,
      title: '钱包管理',
      onClick: () => {
        // 跳转到钱包管理页面
        window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'wallet-manage' } }));
      },
    },
    {
      icon: <LockOutlined style={{ fontSize: '20px' }} />,
      title: '修改密码',
      onClick: () => {
        message.info('跳转到修改密码');
        window.location.hash = '#/wallet/change-password';
      },
    },
    {
      icon: <HistoryOutlined style={{ fontSize: '20px' }} />,
      title: '交易历史',
      onClick: () => {
        message.info('跳转到交易历史');
        window.location.hash = '#/wallet/history';
      },
    },
    {
      icon: <GlobalOutlined style={{ fontSize: '20px' }} />,
      title: '语言',
      badge: 0,
      onClick: () => {
        // 切换语言
        const newLang = language === '繁體中文' ? '简体中文' : language === '简体中文' ? 'English' : '繁體中文';
        setLanguage(newLang);
        message.success(`语言已切换为：${newLang}`);
      },
    },
    {
      icon: <NotificationOutlined style={{ fontSize: '20px' }} />,
      title: '公告',
      onClick: () => {
        message.info('跳转到公告');
        window.location.hash = '#/announcements';
      },
    },
    {
      icon: <DashboardOutlined style={{ fontSize: '20px' }} />,
      title: '链上数据面板',
      onClick: handleShowChainData,
    },
    {
      icon: <BankOutlined style={{ fontSize: '20px' }} />,
      title: '打开web治理平台',
      onClick: handleOpenGovernance,
    },
    {
      icon: <MessageOutlined style={{ fontSize: '20px' }} />,
      title: '系统消息',
      badge: 1,  // 有 1 条未读消息
      onClick: () => {
        message.info('跳转到系统消息');
        window.location.hash = '#/messages';
      },
    },
    {
      icon: <InfoCircleOutlined style={{ fontSize: '20px' }} />,
      title: '关于我们',
      onClick: () => {
        message.info('跳转到关于我们');
        window.location.hash = '#/about';
      },
    },
  ];

  return (
    <div
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        minHeight: '100vh',
        background: '#f5f5f5',
        paddingBottom: '60px', // 为底部导航留空间
      }}
    >
      {/* 顶部头像区域 */}
      <div
        style={{
          background: '#fff',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* 头像 */}
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            }}
          >
            <UserOutlined style={{ fontSize: '28px', color: '#fff' }} />
          </div>

          {/* 标题 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Text strong style={{ fontSize: '18px' }}>
                {nickname}
              </Text>
              <EditOutlined
                onClick={handleEditNickname}
                style={{
                  fontSize: '14px',
                  color: '#8c8c8c',
                  cursor: 'pointer',
                  transition: 'color 0.3s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#1890ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#8c8c8c';
                }}
              />
              <Text strong style={{ fontSize: '18px' }}>
                当前钱包
              </Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {address ? `${address.slice(0, 8)}...${address.slice(-8)}` : '未连接'}
              </Text>
              {address && (
                <>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {'    '}我的推荐码
                  </Text>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: '12px',
                      color: refCode ? '#1890ff' : '#8c8c8c',
                      fontFamily: refCode ? 'monospace' : 'inherit',
                    }}
                  >
                    {refCode || '获取推荐码'}
                  </Text>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 消息通知图标 */}
        <Badge count={1} offset={[-5, 5]}>
          <NotificationOutlined
            style={{ fontSize: '24px', color: '#8c8c8c', cursor: 'pointer' }}
            onClick={() => {
              message.info('查看通知');
              window.location.hash = '#/notifications';
            }}
          />
        </Badge>
      </div>

      {/* 快捷操作卡片区域 - 两行两列 */}
      <div
        style={{
          marginTop: '16px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          padding: '0 16px',
        }}
      >
        {/* 转账卡片 */}
        <div
          onClick={() => {
            console.log('点击转账，触发 mp.nav 事件');
            const event = new CustomEvent('mp.nav', { detail: { tab: 'transfer' } });
            window.dispatchEvent(event);
            console.log('mp.nav 事件已触发');
          }}
          style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '12px',
              flexShrink: 0,
            }}
          >
            <SendOutlined style={{ fontSize: '20px', color: '#fff' }} />
          </div>
          <Text strong style={{ fontSize: '15px', color: '#262626' }}>
            转账
          </Text>
        </div>

        {/* 收款卡片 */}
        <div
          onClick={handleShowReceive}
          style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '12px',
              flexShrink: 0,
            }}
          >
            <QrcodeOutlined style={{ fontSize: '20px', color: '#fff' }} />
          </div>
          <Text strong style={{ fontSize: '15px', color: '#262626' }}>
            收款
          </Text>
        </div>

        {/* 购买MEMO卡片 */}
        <div
          onClick={() => {
            message.info('跳转到购买MEMO');
            window.location.hash = '#/otc/order';
          }}
          style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '12px',
              flexShrink: 0,
            }}
          >
            <ShoppingCartOutlined style={{ fontSize: '20px', color: '#fff' }} />
          </div>
          <Text strong style={{ fontSize: '15px', color: '#262626' }}>
            购买MEMO
          </Text>
        </div>

        {/* 兑换MEMO卡片 */}
        <div
          onClick={() => {
            message.info('跳转到兑换MEMO');
            window.location.hash = '#/bridge/simple';
          }}
          style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #13c2c2 0%, #36cfc9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '12px',
              flexShrink: 0,
            }}
          >
            <RetweetOutlined style={{ fontSize: '20px', color: '#fff' }} />
          </div>
          <Text strong style={{ fontSize: '15px', color: '#262626' }}>
            兑换MEMO
          </Text>
        </div>
      </div>

      {/* 菜单列表 */}
      <div style={{ marginTop: '16px' }}>
        {menuItems.map((item, index) => (
          <div key={index}>
            <div
              onClick={item.onClick}
              style={{
                background: '#fff',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'background 0.3s',
                borderBottom: index === menuItems.length - 1 ? 'none' : '1px solid #f0f0f0',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fafafa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff';
              }}
            >
              {/* 左侧：图标 + 标题 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ color: '#262626', display: 'flex', alignItems: 'center' }}>
                  {item.icon}
                </div>
                <Text style={{ fontSize: '16px', color: '#262626' }}>
                  {item.title}
                </Text>
              </div>

              {/* 右侧：徽章 + 箭头 或 语言文本 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {item.title === '语言' && (
                  <Text type="secondary" style={{ fontSize: '14px' }}>
                    {language}
                  </Text>
                )}
                {item.badge !== undefined && item.badge > 0 && item.title !== '语言' && (
                  <Badge
                    count={item.badge}
                    style={{
                      backgroundColor: '#ff4d4f',
                      boxShadow: '0 0 0 1px #fff',
                    }}
                  />
                )}
                <RightOutlined style={{ fontSize: '14px', color: '#bfbfbf' }} />
              </div>
            </div>

            {/* 分组间隔 */}
            {(index === 2 || index === 3 || index === 4) && (
              <div style={{ height: '8px', background: '#f5f5f5' }} />
            )}
          </div>
        ))}
      </div>

      {/* 底部导航栏 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: '640px',
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
          <div
            style={{
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#8c8c8c">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
          </div>
          <Text style={{ fontSize: '10px', color: '#8c8c8c' }}>首页</Text>
        </div>

        {/* 我的按钮（当前选中） */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#1890ff">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <Text style={{ fontSize: '10px', color: '#1890ff' }}>我的</Text>
        </div>
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

      {/* 编辑昵称弹窗 */}
      <Modal
        title="修改昵称"
        open={editModalVisible}
        onOk={() => form.submit()}
        onCancel={handleCancelEdit}
        confirmLoading={loading}
        okText="保存"
        cancelText="取消"
        centered
        width={400}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveNickname}
          style={{ marginTop: '20px' }}
        >
          <Form.Item
            name="nickname"
            label="昵称"
            rules={[
              { required: true, message: '请输入昵称' },
              { max: 64, message: '昵称最多64个字符' },
            ]}
          >
            <Input placeholder="例如：小明" maxLength={64} />
          </Form.Item>
          <div
            style={{
              background: '#f0f7ff',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '12px',
            }}
          >
            <Text type="secondary" style={{ fontSize: '12px' }}>
              💡 提示：修改昵称需要发起链上交易并签名确认。
            </Text>
          </div>
        </Form>
      </Modal>

      {/* 收款二维码弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrcodeOutlined style={{ fontSize: '20px', color: '#667eea' }} />
            <span>收款二维码</span>
          </div>
        }
        open={receiveModalVisible}
        onCancel={handleCloseReceive}
        footer={null}
        centered
        width={420}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px 0',
          }}
        >
          {/* 二维码 */}
          <div
            style={{
              padding: '20px',
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              marginBottom: '24px',
            }}
          >
            {address && (
              <QRCodeCanvas
                value={address}
                size={240}
                level="H"
                includeMargin={true}
                imageSettings={{
                  src: '',
                  height: 0,
                  width: 0,
                  excavate: false,
                }}
              />
            )}
          </div>

          {/* 地址信息 */}
          <div style={{ width: '100%', marginBottom: '16px' }}>
            <Text
              type="secondary"
              style={{
                fontSize: '12px',
                display: 'block',
                marginBottom: '8px',
                textAlign: 'center',
              }}
            >
              我的钱包地址
            </Text>
            <div
              style={{
                background: '#f5f5f5',
                padding: '12px',
                borderRadius: '8px',
                wordBreak: 'break-all',
                textAlign: 'center',
                fontSize: '13px',
                fontFamily: 'monospace',
              }}
            >
              {address}
            </div>
          </div>

          {/* 操作按钮 */}
          <Button
            type="primary"
            icon={<CopyOutlined />}
            onClick={handleCopyAddress}
            block
            size="large"
            style={{
              height: '48px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 500,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
            }}
          >
            复制地址
          </Button>

          {/* 提示信息 */}
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              background: '#f0f7ff',
              borderRadius: '8px',
              width: '100%',
            }}
          >
            <Text type="secondary" style={{ fontSize: '12px' }}>
              💡 提示：请将此二维码或地址发送给付款方，对方扫码或输入地址即可向您转账。
            </Text>
          </div>
        </div>
      </Modal>

      {/* 链上数据面板弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DashboardOutlined style={{ fontSize: '20px', color: '#667eea' }} />
              <span>链上数据面板</span>
            </div>
            {!chainDataLoading && (
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                onClick={loadChainData}
              >
                刷新
              </Button>
            )}
          </div>
        }
        open={chainDataModalVisible}
        onCancel={handleCloseChainData}
        footer={null}
        centered
        width={680}
      >
        {chainDataLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large">
              <div style={{ padding: '20px' }}>
                <Text type="secondary">加载链上数据中...</Text>
              </div>
            </Spin>
          </div>
        ) : chainData ? (
          <div style={{ padding: '20px 0' }}>
            {/* 链基本信息 */}
            <div
              style={{
                marginBottom: '24px',
                padding: '16px',
                background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
                borderRadius: '8px',
                border: '1px solid #f0f0f0',
              }}
            >
              <Text strong style={{ fontSize: '14px', marginBottom: '12px', display: 'block' }}>
                🔗 链信息
              </Text>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="链名称">{chainData.chain.name}</Descriptions.Item>
                <Descriptions.Item label="链版本">{chainData.chain.version}</Descriptions.Item>
                <Descriptions.Item label="代币符号">{chainData.chain.token}</Descriptions.Item>
                <Descriptions.Item label="代币精度">{chainData.chain.decimals}</Descriptions.Item>
              </Descriptions>
            </div>

            {/* 区块信息 */}
            <div
              style={{
                marginBottom: '24px',
                padding: '16px',
                background: '#f9f9f9',
                borderRadius: '8px',
                border: '1px solid #f0f0f0',
              }}
            >
              <Text strong style={{ fontSize: '14px', marginBottom: '12px', display: 'block' }}>
                📦 区块信息
              </Text>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="当前区块高度">{chainData.block.number}</Descriptions.Item>
                <Descriptions.Item label="当前区块哈希">
                  <Text style={{ fontSize: '12px', fontFamily: 'monospace', color: '#8c8c8c' }}>
                    {chainData.block.hash}
                  </Text>
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* 节点信息 */}
            <div
              style={{
                marginBottom: '24px',
                padding: '16px',
                background: '#f9f9f9',
                borderRadius: '8px',
                border: '1px solid #f0f0f0',
              }}
            >
              <Text strong style={{ fontSize: '14px', marginBottom: '12px', display: 'block' }}>
                🖥️ 节点信息
              </Text>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="节点名称">{chainData.node.name}</Descriptions.Item>
                <Descriptions.Item label="节点版本">{chainData.node.version}</Descriptions.Item>
              </Descriptions>
            </div>

            {/* 账户信息 */}
            {chainData.account && (
              <div
                style={{
                  padding: '16px',
                  background: 'linear-gradient(135deg, #667eea10 0%, #764ba210 100%)',
                  borderRadius: '8px',
                  border: '1px solid #f0f0f0',
                }}
              >
                <Text strong style={{ fontSize: '14px', marginBottom: '12px', display: 'block' }}>
                  👤 当前账户信息
                </Text>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="账户地址">
                    <Text style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                      {address}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="可用余额">
                    <Text strong style={{ fontSize: '14px', color: '#667eea' }}>
                      {chainData.account.free} {chainData.chain.token}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="保留余额">
                    {chainData.account.reserved} {chainData.chain.token}
                  </Descriptions.Item>
                  <Descriptions.Item label="交易计数 (Nonce)">
                    {chainData.account.nonce}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}

            {/* 提示信息 */}
            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                background: '#f0f7ff',
                borderRadius: '8px',
              }}
            >
              <Text type="secondary" style={{ fontSize: '12px' }}>
                💡 提示：此面板显示的是实时链上数据，点击右上角"刷新"按钮可更新数据。
              </Text>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">暂无数据</Text>
          </div>
        )}
      </Modal>

      {/* 治理平台提示弹窗（移动端） */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BankOutlined style={{ fontSize: '20px', color: '#667eea' }} />
            <span>Web治理平台</span>
          </div>
        }
        open={governanceModalVisible}
        onCancel={handleCloseGovernance}
        footer={null}
        centered
        width={420}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px 0',
          }}
        >
          {/* 图标 */}
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              marginBottom: '24px',
            }}
          >
            💻
          </div>

          {/* 提示文字 */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: '12px' }}>
              请在电脑登录
            </Text>
            <Text type="secondary" style={{ fontSize: '14px' }}>
              治理平台需要在桌面端浏览器访问
            </Text>
          </div>

          {/* 链接地址 */}
          <div
            style={{
              width: '100%',
              marginBottom: '16px',
              padding: '16px',
              background: '#f5f5f5',
              borderRadius: '8px',
              textAlign: 'center',
            }}
          >
            <Text
              style={{
                fontSize: '14px',
                fontFamily: 'monospace',
                color: '#1890ff',
                wordBreak: 'break-all',
              }}
            >
              https://governance.memopark.net/
            </Text>
          </div>

          {/* 复制按钮 */}
          <Button
            type="primary"
            icon={<CopyOutlined />}
            onClick={handleCopyGovernanceLink}
            block
            size="large"
            style={{
              height: '48px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 500,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              marginBottom: '16px',
            }}
          >
            复制链接
          </Button>

          {/* 使用说明 */}
          <div
            style={{
              width: '100%',
              padding: '12px',
              background: '#f0f7ff',
              borderRadius: '8px',
            }}
          >
            <Text type="secondary" style={{ fontSize: '12px' }}>
              💡 提示：治理平台提供提案投票、财政管理、理事会等高级功能，建议在桌面端使用以获得最佳体验。
            </Text>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MyWalletPage;

