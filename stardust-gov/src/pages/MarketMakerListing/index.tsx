/**
 * 做市商挂单页面
 * 函数级中文注释：做市商创建和管理 OTC 挂单
 * - 创建新挂单
 * - 查看挂单列表
 * - 取消挂单
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  message,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Alert,
  Statistic,
  Row,
  Col,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useApi } from '@/contexts/ApiContext';
import { useWalletStore, loadLocalAccounts, getSignerWithPassword, queryBalance, formatBalance, parseBalance } from '@/hooks/useWallet';
import { setCurrentAddress } from '@/lib/keystore';
import type { Listing } from '@/types';

/**
 * 函数级中文注释：做市商挂单页面组件
 */
const MarketMakerListing: React.FC = () => {
  const { api, isConnected } = useApi();
  const { currentAccount, balance, setAccounts, setCurrentAccount, setBalance } = useWalletStore();
  
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMarketMaker, setIsMarketMaker] = useState(false);
  const [mmId, setMmId] = useState<number | null>(null);
  
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form] = Form.useForm();

  /**
   * 函数级中文注释：加载本地账户
   * - 从 localStorage 恢复上次选择的账户
   * - 如果没有，则使用第一个账户
   */
  const loadAccounts = () => {
    const accs = loadLocalAccounts();
    setAccounts(accs);
    
    if (accs.length > 0) {
      // 从 localStorage 读取上次选择的账户地址（使用 keystore 模块的函数）
      const savedAddress = localStorage.getItem('mg.current'); // 修正：使用 'mg.' 前缀
      
      if (savedAddress) {
        // 找到对应的账户
        const savedAccount = accs.find(acc => acc.address === savedAddress);
        if (savedAccount) {
          console.log('✅ 恢复上次选择的账户:', savedAddress.slice(0, 8));
          setCurrentAccount(savedAccount);
          return;
        }
      }
      
      // 如果没有保存的账户或找不到，使用第一个
      console.log('⚠️  使用第一个账户');
      setCurrentAccount(accs[0]);
      setCurrentAddress(accs[0].address);
    }
  };

  /**
   * 函数级中文注释：弹出密码输入框
   * - 使用浏览器原生 prompt 确保可靠性
   * - 避免 Modal 渲染问题
   */
  const promptPassword = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      // 使用浏览器原生 prompt，100% 可靠
      const password = window.prompt('🔐 请输入密码来签名交易:');
      
      if (password && password.trim().length > 0) {
        resolve(password.trim());
      } else {
        message.warning('密码不能为空');
        reject(new Error('密码不能为空'));
      }
    });
  };

  /**
   * 函数级中文注释：查询账户余额
   */
  const fetchBalance = async () => {
    if (!api || !currentAccount) return;
    try {
      const bal = await queryBalance(api, currentAccount.address);
      setBalance(bal);
    } catch (err) {
      console.error('查询余额失败:', err);
    }
  };

  /**
   * 函数级中文注释：检查是否是做市商
   */
  const checkMarketMaker = async () => {
    if (!api || !currentAccount) return;
    
    try {
      // 查询 ownerIndex
      const ownerIndexOpt: any = await api.query.marketMaker.ownerIndex(currentAccount.address);
      
      if (ownerIndexOpt.isSome) {
        const mmIdValue = ownerIndexOpt.unwrap().toNumber();
        
        // 验证是否在 activeMarketMakers 中
        const activeOpt: any = await api.query.marketMaker.activeMarketMakers(mmIdValue);
        
        if (activeOpt.isSome) {
          setIsMarketMaker(true);
          setMmId(mmIdValue);
          console.log('✅ 当前账户是做市商, mmId:', mmIdValue);
        } else {
          setIsMarketMaker(false);
          setMmId(null);
          console.log('⚠️  做市商未激活');
        }
      } else {
        setIsMarketMaker(false);
        setMmId(null);
        console.log('⚠️  当前账户不是做市商');
      }
    } catch (err) {
      console.error('❌ 检查做市商状态失败:', err);
    }
  };

  /**
   * 函数级中文注释：加载挂单列表
   */
  const fetchListings = async () => {
    if (!api || !currentAccount) return;
    
    setLoading(true);
    try {
      const entries: any = await api.query.otcListing.listings.entries();
      
      const lists: Listing[] = [];
      
      for (const [key, value] of entries) {
        const listingId = key.args[0].toNumber();
        const listing = value.toJSON() as any;
        
        // 只显示当前账户的挂单
        if (listing.maker === currentAccount.address) {
          lists.push({
            listingId,
            maker: listing.maker,
            side: listing.side,
            base: listing.base,
            quote: listing.quote,
            pricingSpreadBps: listing.pricingSpreadBps,
            minQty: listing.minQty,
            maxQty: listing.maxQty,
            remaining: listing.remaining,
            partial: listing.partial,
            createdAt: listing.createdAt,
            expireAt: listing.expireAt,
            priceMin: listing.priceMin,
            priceMax: listing.priceMax,
            termsCommit: listing.termsCommit,
            status: 'Active', // 简化处理
          });
        }
      }
      
      setListings(lists);
      console.log('✅ 加载到', lists.length, '个挂单');
      
    } catch (err: any) {
      console.error('❌ 加载挂单失败:', err);
      message.error(`加载失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 函数级中文注释：创建挂单
   */
  const handleCreateListing = async (values: any) => {
    if (!api || !currentAccount) {
      message.error('请先连接钱包');
      return;
    }
    
    if (!isMarketMaker) {
      message.error('只有做市商可以创建挂单');
      return;
    }
    
    setCreateLoading(true);
    
    try {
      // 函数级中文注释：转换参数为链端期望的格式
      // side: 'Buy' -> 0, 'Sell' -> 1
      // base/quote: 资产 ID（u32 数字类型）
      const side = values.side === 'Buy' ? 0 : 1;
      const base = 0; // MEMO 资产 ID
      const quote = 1; // CNY 资产 ID（假设为 1，需要根据实际链端配置调整）
      const pricingSpreadBps = parseInt(values.pricingSpreadBps); // 价差（基点）
      const minQty = parseBalance(values.minQty.toString()); // 最小数量
      const maxQty = parseBalance(values.maxQty.toString()); // 最大数量
      const total = parseBalance(values.total.toString()); // 总库存
      const partial = values.partial; // 是否允许部分成交
      const expireAt = values.expireAt; // 过期时间（块号）
      const priceMin = values.priceMin ? parseBalance(values.priceMin.toString()) : null;
      const priceMax = values.priceMax ? parseBalance(values.priceMax.toString()) : null;
      const termsCommit = values.termsCommit || null;
      
      // 函数级中文注释：检查账户余额是否充足
      console.log('💰 检查账户余额...');
      const accountInfo: any = await api.query.system.account(currentAccount.address);
      const balance = accountInfo.data;
      const free = balance.free.toBigInt();
      const frozen = balance.frozen.toBigInt();
      const available = free - frozen;
      const totalBigInt = BigInt(total); // total is already a string from parseBalance
      
      console.log('   📊 余额详情:');
      console.log(`   - 总余额 (free): ${free.toString()} Planck (${formatBalance(free.toString())} MEMO)`);
      console.log(`   - 冻结 (frozen): ${frozen.toString()} Planck`);
      console.log(`   - 可用: ${available.toString()} Planck (${formatBalance(available.toString())} MEMO)`);
      console.log(`   - 需要: ${totalBigInt.toString()} Planck (${formatBalance(totalBigInt.toString())} MEMO)`);
      
      if (available < totalBigInt) {
        const shortfall = totalBigInt - BigInt(available.toString());
        console.error('❌ 余额不足！');
        console.error(`   缺口: ${shortfall.toString()} Planck (${formatBalance(shortfall.toString())} MEMO)`);
        message.error(`余额不足！需要 ${formatBalance(totalBigInt.toString())} MEMO，可用 ${formatBalance(available.toString())} MEMO`);
        return;
      }
      console.log('✅ 余额充足');
      
      // 请求密码
      const password = await promptPassword();
      const pair = await getSignerWithPassword(currentAccount.address, password);
      
      console.log('📝 创建挂单参数:', {
        side,
        base,
        quote,
        pricingSpreadBps,
        minQty,
        maxQty,
        total,
        partial,
        expireAt,
        priceMin,
        priceMax,
        termsCommit,
      });
      
      const tx = api.tx.otcListing.createListing(
        side,
        base,
        quote,
        pricingSpreadBps,
        minQty,
        maxQty,
        total,
        partial,
        expireAt,
        priceMin,
        priceMax,
        termsCommit
      );
      
      await new Promise((resolve, reject) => {
        tx.signAndSend(pair, ({ status, dispatchError, events }: any) => {
          console.log('   交易状态:', status.type);
          
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              console.error('   ❌ 创建失败:', `${decoded.section}.${decoded.name}`);
              message.error(`创建失败: ${decoded.section}.${decoded.name}`);
            } else {
              console.error('   ❌ 创建失败:', dispatchError.toString());
              message.error(`创建失败: ${dispatchError.toString()}`);
            }
            reject(new Error(dispatchError.toString()));
            return;
          }
          
          if (status.isInBlock) {
            console.log('   ✅ 交易已打包:', status.asInBlock.toHex());
            
            events.forEach(({ event }: any) => {
              if (event.section === 'otcListing' && event.method === 'Created') {
                message.success('✅ 挂单创建成功！');
                resolve(true);
              }
            });
          }
        });
      });
      
      // 关闭对话框
      setCreateModalVisible(false);
      form.resetFields();
      
      // 刷新列表
      await fetchListings();
      
    } catch (err: any) {
      console.error('❌ 创建挂单失败:', err);
      message.error(`创建挂单失败: ${err.message}`);
    } finally {
      setCreateLoading(false);
    }
  };

  /**
   * 函数级中文注释：取消挂单
   */
  const handleCancelListing = async (listingId: number) => {
    if (!api || !currentAccount) {
      message.error('请先连接钱包');
      return;
    }
    
    Modal.confirm({
      title: '确认取消挂单',
      content: `确定要取消挂单 #${listingId} 吗？`,
      onOk: async () => {
        try {
          // 请求密码
          const password = await promptPassword();
          const pair = await getSignerWithPassword(currentAccount.address, password);
          
          console.log('❌ 取消挂单:', listingId);
          
          const tx = api.tx.otcListing.cancelListing(listingId);
          
          await new Promise((resolve, reject) => {
            tx.signAndSend(pair, ({ status, dispatchError, events }: any) => {
              console.log('   交易状态:', status.type);
              
              if (dispatchError) {
                if (dispatchError.isModule) {
                  const decoded = api.registry.findMetaError(dispatchError.asModule);
                  console.error('   ❌ 取消失败:', `${decoded.section}.${decoded.name}`);
                  message.error(`取消失败: ${decoded.section}.${decoded.name}`);
                } else {
                  console.error('   ❌ 取消失败:', dispatchError.toString());
                  message.error(`取消失败: ${dispatchError.toString()}`);
                }
                reject(new Error(dispatchError.toString()));
                return;
              }
              
              if (status.isInBlock) {
                console.log('   ✅ 交易已打包:', status.asInBlock.toHex());
                
                events.forEach(({ event }: any) => {
                  if (event.section === 'otcListing' && event.method === 'Cancelled') {
                    message.success('✅ 挂单已取消！');
                    resolve(true);
                  }
                });
              }
            });
          });
          
          // 刷新列表
          await fetchListings();
          
        } catch (err: any) {
          console.error('❌ 取消挂单失败:', err);
          message.error(`取消挂单失败: ${err.message}`);
        }
      },
    });
  };

  // 初始化
  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (isConnected && api && currentAccount) {
      checkMarketMaker();
    }
  }, [isConnected, api, currentAccount]);

  useEffect(() => {
    if (isMarketMaker) {
      fetchListings();
    }
  }, [isMarketMaker]);

  useEffect(() => {
    if (currentAccount && api) {
      fetchBalance();
    }
  }, [currentAccount, api]);

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'listingId',
      key: 'listingId',
      width: 60,
    },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      render: (side: string) => (
        <Tag color={side === 'Buy' ? 'green' : 'red'}>{side === 'Buy' ? '买入' : '卖出'}</Tag>
      ),
    },
    {
      title: '交易对',
      key: 'pair',
      render: (_: any, record: Listing) => `${record.base}/${record.quote}`,
    },
    {
      title: '价差',
      dataIndex: 'pricingSpreadBps',
      key: 'pricingSpreadBps',
      render: (bps: number) => `${(bps / 100).toFixed(2)}%`,
    },
    {
      title: '数量范围',
      key: 'qty',
      render: (_: any, record: Listing) => {
        // 函数级中文注释：兼容不同类型的余额数据
        const minQtyStr = typeof record.minQty === 'string' ? record.minQty : String(record.minQty || '0');
        const maxQtyStr = typeof record.maxQty === 'string' ? record.maxQty : String(record.maxQty || '0');
        return `${formatBalance(minQtyStr)} - ${formatBalance(maxQtyStr)}`;
      },
    },
    {
      title: '剩余库存',
      dataIndex: 'remaining',
      key: 'remaining',
      render: (remaining: any) => {
        // 函数级中文注释：兼容不同类型的余额数据
        const remainingStr = typeof remaining === 'string' ? remaining : String(remaining || '0');
        return `${formatBalance(remainingStr)} MEMO`;
      },
    },
    {
      title: '部分成交',
      dataIndex: 'partial',
      key: 'partial',
      render: (partial: boolean) => (
        <Tag color={partial ? 'green' : 'red'}>{partial ? '允许' : '不允许'}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          Active: 'green',
          Cancelled: 'red',
          Expired: 'orange',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Listing) => {
        if (record.status !== 'Active') {
          return null;
        }
        
        return (
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleCancelListing(record.listingId)}
          >
            取消
          </Button>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Statistic
              title="链端状态"
              value={isConnected ? '已连接' : '未连接'}
              valueStyle={{ color: isConnected ? '#3f8600' : '#cf1322' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="做市商状态"
              value={isMarketMaker ? '已认证' : '未认证'}
              valueStyle={{ color: isMarketMaker ? '#3f8600' : '#cf1322' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="活跃挂单"
              value={listings.filter(l => l.status === 'Active').length}
              prefix={<DollarOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="账户余额"
              value={balance}
              suffix="MEMO"
            />
          </Col>
        </Row>

        {!currentAccount ? (
          <Alert
            message="请先创建或导入钱包"
            description="访问钱包管理页面创建或导入钱包"
            type="warning"
            showIcon
            action={
              <Button type="primary" onClick={() => window.location.href = '/#/wallet'}>
                前往钱包管理
              </Button>
            }
            style={{ marginBottom: 24 }}
          />
        ) : !isMarketMaker ? (
          <Alert
            message="权限不足"
            description={`当前账户 ${currentAccount.address} 不是做市商，无法创建挂单`}
            type="error"
            showIcon
            style={{ marginBottom: 24 }}
          />
        ) : (
          <Alert
            message={`做市商 ID: ${mmId}`}
            description="您可以创建和管理 OTC 挂单"
            type="success"
            showIcon
            action={
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateModalVisible(true)}
                >
                  创建挂单
                </Button>
                <Button icon={<ReloadOutlined />} onClick={fetchListings}>
                  刷新
                </Button>
              </Space>
            }
            style={{ marginBottom: 24 }}
          />
        )}

        <Table
          columns={columns}
          dataSource={listings}
          rowKey="listingId"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 创建挂单对话框 */}
      <Modal
        title="创建挂单"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateListing}
          initialValues={{
            side: 'Sell',
            pricingSpreadBps: 100,
            partial: true,
          }}
        >
          <Form.Item
            label="交易方向"
            name="side"
            rules={[{ required: true, message: '请选择交易方向' }]}
          >
            <Select>
              <Select.Option value="Buy">买入 MEMO</Select.Option>
              <Select.Option value="Sell">卖出 MEMO</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="价差（基点，100 bps = 1%）"
            name="pricingSpreadBps"
            rules={[{ required: true, message: '请输入价差' }]}
          >
            <InputNumber min={0} max={10000} style={{ width: '100%' }} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="最小数量 (MEMO)"
                name="minQty"
                rules={[{ required: true, message: '请输入最小数量' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="最大数量 (MEMO)"
                name="maxQty"
                rules={[{ required: true, message: '请输入最大数量' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="总库存 (MEMO)"
            name="total"
            rules={[{ required: true, message: '请输入总库存' }]}
            tooltip="将从您的账户锁定这些代币"
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="过期时间（区块号）"
            name="expireAt"
            rules={[{ required: true, message: '请输入过期区块号' }]}
            tooltip="当前区块号 + N，例如：当前 1000，过期时间填 11000（约 10000 区块 = 约 20 小时）"
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="允许部分成交"
            name="partial"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Divider>高级选项（可选）</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="最低价格 (MEMO)" name="priceMin">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="最高价格 (MEMO)" name="priceMax">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="条款承诺 (CID)" name="termsCommit">
            <Input placeholder="IPFS CID（可选）" />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setCreateModalVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={createLoading}>
                创建挂单
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MarketMakerListing;

