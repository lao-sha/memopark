import React, { useEffect, useState, useCallback } from 'react';
import { Card, Button, List, Typography, Tag, Space, Tooltip, Avatar, Skeleton, message } from 'antd';
import { CopyOutlined, ReloadOutlined, CheckCircleTwoTone } from '@ant-design/icons';
import { useWallet } from '../../providers/WalletProvider';
import { queryFreeBalance } from '../../lib/polkadot-safe';
import { useChainInfo } from '../../hooks/useChainInfo';

interface WalletSelectorProps {
  compact?: boolean; // 紧凑模式：只显示当前 + 按钮
  bordered?: boolean;
  onSelectAddress?: (address: string) => void;
}

interface BalanceInfo { formatted: string; symbol: string }

const short = (addr: string) => addr.slice(0, 6) + '…' + addr.slice(-6);

/**
 * 高级钱包选择组件
 * 功能（本地钱包模式）：
 *  - 展示当前选中地址（如有）与余额
 *  - 选择高亮，并通过回调向上层同步
 *  - 支持紧凑模式
 */
export const WalletSelector: React.FC<WalletSelectorProps> = ({ compact, bordered = true, onSelectAddress }) => {
  const { accounts, connectWallet, selectedAccount, selectAccount, error, isConnected, isLoading } = useWallet();
  const chainInfo = useChainInfo();
  const [balances, setBalances] = useState<Record<string, BalanceInfo>>({});
  const [loadingBalances, setLoadingBalances] = useState(false);

  const loadBalances = useCallback(async () => {
    if (!accounts.length) return;
    setLoadingBalances(true);
    try {
      const results = await Promise.all(accounts.map(async acc => {
        try {
          const b = await queryFreeBalance(acc.address);
          return [acc.address, { formatted: b.formatted, symbol: b.symbol }] as [string, BalanceInfo];
        } catch { return [acc.address, { formatted: '0', symbol: '' }] as [string, BalanceInfo]; }
      }));
      setBalances(Object.fromEntries(results));
    } finally {
      setLoadingBalances(false);
    }
  }, [accounts]);

  useEffect(() => { loadBalances(); }, [loadBalances]);

  const handleSelect = (address: string) => {
    const found = accounts.find(a => a.address === address);
    if (found) {
      selectAccount(found);
      onSelectAddress?.(address);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => message.success('已复制地址'));
  };

  // 本地钱包模式：无扩展展示

  if (compact && selectedAccount) {
    const bal = balances[selectedAccount.address];
    return (
      <Card size="small" bordered={bordered} style={{ marginBottom: 16 }} bodyStyle={{ padding: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Avatar size={32}>{selectedAccount.meta.name?.[0] || 'A'}</Avatar>
            <div style={{ lineHeight: 1.2 }}>
              <Typography.Text strong>{selectedAccount.meta.name || '未命名'}</Typography.Text><br />
              <Tooltip title={selectedAccount.address}><Typography.Text type="secondary" style={{ fontSize: 12 }}>{short(selectedAccount.address)}</Typography.Text></Tooltip>
            </div>
          </Space>
          <Space>
            <Typography.Text>{bal ? `${bal.formatted} ${bal.symbol}` : <Skeleton.Input active size="small" style={{ width: 80 }} />}</Typography.Text>
            <Tooltip title="刷新余额"><Button icon={<ReloadOutlined />} size="small" onClick={loadBalances} /></Tooltip>
            <Tooltip title="复制地址"><Button icon={<CopyOutlined />} size="small" onClick={() => copy(selectedAccount.address)} /></Tooltip>
            {!chainInfo.loading && chainInfo.name && (
              <Tag color="processing" style={{ marginLeft: 4 }}>{chainInfo.name}</Tag>
            )}
          </Space>
        </Space>
      </Card>
    );
  }

  return (
    <Card title={<Space>
      <span style={{ fontSize: 14 }}>选择钱包账户</span>
      <Tag color="blue" style={{ marginLeft: 4 }}>{accounts.length}</Tag>
      {!chainInfo.loading && chainInfo.name && <Tag color="geekblue">{chainInfo.name}</Tag>}
      {chainInfo.error && <Tag color="red">链信息错误</Tag>}
    </Space>} extra={<Space>
      <Button size="small" icon={<ReloadOutlined />} onClick={loadBalances} loading={loadingBalances}>余额</Button>
    </Space>} bordered={bordered} style={{ marginBottom: 16 }}>
      <List
        size="small"
        dataSource={accounts}
        locale={{ emptyText: '未找到账户' }}
        renderItem={acc => {
          const active = acc.address === selectedAccount?.address;
          const bal = balances[acc.address];
          return (
            <List.Item
              style={{ cursor: 'pointer', background: active ? 'rgba(24,144,255,0.08)' : undefined, borderRadius: 4, padding: '6px 8px' }}
              onClick={() => handleSelect(acc.address)}
              actions={[
                <Tooltip title="复制地址" key="c"><Button type="text" size="small" icon={<CopyOutlined />} onClick={(e) => { e.stopPropagation(); copy(acc.address); }} /></Tooltip>
              ]}
            >
              <Space>
                <Avatar size={32} style={{ background: active ? '#1890ff' : '#555' }}>{acc.meta.name?.[0] || 'A'}</Avatar>
                <div style={{ minWidth: 220 }}>
                  <Typography.Text strong style={{ fontSize: 13 }}>{acc.meta.name || '未命名'}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>{short(acc.address)}</Typography.Text>
                </div>
                <div style={{ fontSize: 12 }}>
                  {bal ? <Typography.Text>{bal.formatted} {bal.symbol}</Typography.Text> : <Skeleton.Input active size="small" style={{ width: 80 }} />}
                </div>
                {active && <CheckCircleTwoTone twoToneColor="#52c41a" />}
                {acc.meta.source && <Tag style={{ marginLeft: 8 }} color="geekblue">{acc.meta.source}</Tag>}
              </Space>
            </List.Item>
          );
        }}
      />
    </Card>
  );
};

export default WalletSelector;
