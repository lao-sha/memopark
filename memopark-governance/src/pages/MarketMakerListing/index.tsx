/**
 * 函数级详细中文注释：做市商创建挂单页面
 * - 允许已审批通过的做市商创建OTC挂单
 * - 支持设置价格、数量、有效期等参数
 * - 显示当前挂单列表
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  message,
  Table,
  Tag,
  Space,
  Typography,
  Alert,
  Divider,
  Switch,
  Select,
  Descriptions,
  Modal
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useWallet } from '@/contexts/Wallet';
import { useApi } from '@/contexts/Api';
import { signAndSend } from '@/services/wallet/signer';

const { Title, Text } = Typography;
const { Option } = Select;

interface Listing {
  id: number;
  maker: string;
  side: number;
  base: number;
  quote: number;
  pricingSpreadBps: number;
  priceMin: string | null;
  priceMax: string | null;
  minQty: string;
  maxQty: string;
  total: string;
  remaining: string;
  partial: boolean;
  expireAt: number;
  active: boolean;
}

/**
 * 做市商创建挂单页面
 */
const MarketMakerListing: React.FC = () => {
  const { api } = useApi();
  const { activeAccount } = useWallet();
  
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [isMarketMaker, setIsMarketMaker] = useState<boolean | null>(null);
  const [currentBlock, setCurrentBlock] = useState(0);

  /**
   * 函数级详细中文注释：检查当前账户是否是已审批的做市商
   * - 先查询 ownerIndex 获取做市商ID
   * - 再查询 activeMarketMakers（批准后的做市商在这里）
   * - 检查状态是否为 Active
   */
  const checkMarketMakerStatus = async () => {
    if (!api || !activeAccount) return;

    try {
      console.log('[做市商检查] 账户:', activeAccount);
      
      // 查询账户的做市商ID
      const ownerIndexOpt: any = await api.query.marketMaker?.ownerIndex(activeAccount);
      
      if (!ownerIndexOpt || !ownerIndexOpt.isSome) {
        console.log('[做市商检查] 未找到 ownerIndex');
        setIsMarketMaker(false);
        return;
      }

      const mmId = ownerIndexOpt.unwrap().toNumber();
      console.log('[做市商检查] 做市商ID:', mmId);
      
      // ✅ 修复：批准后的做市商在 activeMarketMakers 中，而不是 applications
      const activeOpt: any = await api.query.marketMaker?.activeMarketMakers(mmId);
      
      if (!activeOpt || !activeOpt.isSome) {
        console.log('[做市商检查] 未找到活跃做市商记录');
        setIsMarketMaker(false);
        return;
      }

      const mm = activeOpt.unwrap().toJSON() as any;
      console.log('[做市商检查] 做市商状态:', mm.status);
      
      // 只有 Active 状态的做市商才能创建挂单
      const isActive = mm.status === 'Active';
      setIsMarketMaker(isActive);
      
      if (isActive) {
        console.log('[做市商检查] ✅ 做市商已激活，可以创建挂单');
      } else {
        console.log('[做市商检查] ⚠️ 做市商状态非 Active:', mm.status);
      }
    } catch (error) {
      console.error('[做市商检查] 失败:', error);
      setIsMarketMaker(false);
    }
  };

  /**
   * 加载当前区块高度
   */
  const loadCurrentBlock = async () => {
    if (!api) return;

    try {
      const header = await api.rpc.chain.getHeader();
      setCurrentBlock(header.number.toNumber());
    } catch (error) {
      console.error('加载区块高度失败:', error);
    }
  };

  /**
   * 加载挂单列表
   */
  const loadListings = async () => {
    if (!api || !activeAccount) return;

    setLoading(true);
    try {
      const entries = await api.query.otcListing.listings.entries();
      
      const listingData = entries
        .map(([key, value]: any) => {
          const id = key.args[0].toNumber();
          const listing = value.toJSON() as any;
          
          return {
            id,
            maker: listing.maker,
            side: listing.side,
            base: listing.base,
            quote: listing.quote,
            pricingSpreadBps: listing.pricingSpreadBps,
            priceMin: listing.priceMin,
            priceMax: listing.priceMax,
            minQty: listing.minQty,
            maxQty: listing.maxQty,
            total: listing.total,
            remaining: listing.remaining,
            partial: listing.partial,
            expireAt: listing.expireAt,
            active: listing.active,
          };
        })
        .filter((l: Listing) => l.maker === activeAccount && l.active);

      setListings(listingData);
    } catch (error) {
      console.error('加载挂单失败:', error);
      message.error('加载挂单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (api && activeAccount) {
      checkMarketMakerStatus();
      loadCurrentBlock();
      loadListings();
    }
  }, [api, activeAccount]);

  /**
   * 创建挂单
   */
  const handleCreateListing = async (values: any) => {
    if (!api || !activeAccount) {
      message.error('请先连接钱包');
      return;
    }

    setLoading(true);
    try {
      console.group('📤 [创建挂单] 参数');
      console.log('原始表单值:', values);

      // 参数转换
      const side = values.side; // 0=Buy, 1=Sell
      const base = Number(values.base);
      const quote = Number(values.quote);
      const pricingSpreadBps = Number(values.pricingSpreadBps);
      
      // 转换为链端需要的最小单位 (12位小数)
      const minQty = BigInt(Math.floor(values.minQty * 1e12));
      const maxQty = BigInt(Math.floor(values.maxQty * 1e12));
      const total = BigInt(Math.floor(values.total * 1e12));
      
      const partial = values.partial || false;
      
      // 过期区块 = 当前区块 + TTL (区块数)
      const expireAt = currentBlock + Number(values.ttlBlocks);
      
      // 可选价格范围 (如果填写则转换)
      const priceMin = values.priceMin ? BigInt(Math.floor(values.priceMin * 1e12)) : null;
      const priceMax = values.priceMax ? BigInt(Math.floor(values.priceMax * 1e12)) : null;
      
      // 条款承诺CID (可选)
      const termsCommit = values.termsCid ? values.termsCid : null;

      console.log('转换后参数:');
      console.log('  side:', side);
      console.log('  base:', base);
      console.log('  quote:', quote);
      console.log('  pricingSpreadBps:', pricingSpreadBps);
      console.log('  minQty:', minQty.toString());
      console.log('  maxQty:', maxQty.toString());
      console.log('  total:', total.toString());
      console.log('  partial:', partial);
      console.log('  expireAt:', expireAt);
      console.log('  priceMin:', priceMin?.toString());
      console.log('  priceMax:', priceMax?.toString());
      console.log('  termsCommit:', termsCommit);
      console.groupEnd();

      // 构建交易
      const tx = api.tx.otcListing.createListing(
        side,
        base,
        quote,
        pricingSpreadBps,
        minQty.toString(),
        maxQty.toString(),
        total.toString(),
        partial,
        expireAt,
        priceMin ? priceMin.toString() : null,
        priceMax ? priceMax.toString() : null,
        termsCommit
      );

      await signAndSend(activeAccount, tx, {
        onSuccess: (blockHash) => {
          message.success(`挂单创建成功！区块哈希: ${blockHash.slice(0, 10)}...`);
          form.resetFields();
          
          // 刷新挂单列表
          setTimeout(() => {
            loadListings();
          }, 2000);
        },
        onError: (error) => {
          console.error('创建挂单失败:', error);
          message.error(`创建挂单失败: ${error.message}`);
        }
      });
    } catch (error: any) {
      console.error('创建挂单失败:', error);
      message.error(`创建挂单失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 取消挂单
   */
  const handleCancelListing = async (id: number) => {
    if (!api || !activeAccount) {
      message.error('请先连接钱包');
      return;
    }

    Modal.confirm({
      title: '确认取消挂单？',
      content: `是否取消挂单 #${id}？取消后将退回剩余库存和保证金。`,
      okText: '确认取消',
      cancelText: '暂不取消',
      onOk: async () => {
        setLoading(true);
        try {
          const tx = api.tx.otcListing.cancelListing(id);

          await signAndSend(activeAccount, tx, {
            onSuccess: (blockHash) => {
              message.success(`挂单已取消！区块哈希: ${blockHash.slice(0, 10)}...`);
              loadListings();
            },
            onError: (error) => {
              console.error('取消挂单失败:', error);
              message.error(`取消挂单失败: ${error.message}`);
            }
          });
        } catch (error: any) {
          console.error('取消挂单失败:', error);
          message.error(`取消挂单失败: ${error.message}`);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // 挂单列表表格列
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '方向',
      dataIndex: 'side',
      key: 'side',
      width: 80,
      render: (side: number) => (
        <Tag color={side === 0 ? 'green' : 'blue'}>
          {side === 0 ? '买入' : '卖出'}
        </Tag>
      ),
    },
    {
      title: '交易对',
      key: 'pair',
      width: 100,
      render: (record: Listing) => `${record.base}/${record.quote}`,
    },
    {
      title: 'Spread',
      dataIndex: 'pricingSpreadBps',
      key: 'pricingSpreadBps',
      width: 100,
      render: (val: number) => `${val / 100}%`,
    },
    {
      title: '数量范围',
      key: 'qtyRange',
      width: 200,
      render: (record: Listing) => {
        const min = (BigInt(record.minQty) / BigInt(1e12)).toString();
        const max = (BigInt(record.maxQty) / BigInt(1e12)).toString();
        return `${min} - ${max} MEMO`;
      },
    },
    {
      title: '总量/剩余',
      key: 'totalRemaining',
      width: 180,
      render: (record: Listing) => {
        const total = (BigInt(record.total) / BigInt(1e12)).toString();
        const remaining = (BigInt(record.remaining) / BigInt(1e12)).toString();
        return (
          <Space direction="vertical" size={0}>
            <Text>总量: {total}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>剩余: {remaining}</Text>
          </Space>
        );
      },
    },
    {
      title: '过期区块',
      dataIndex: 'expireAt',
      key: 'expireAt',
      width: 120,
      render: (block: number) => {
        const remaining = block - currentBlock;
        return (
          <Space direction="vertical" size={0}>
            <Text>{block}</Text>
            {remaining > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                剩余 {remaining} 块
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'active',
      key: 'active',
      width: 80,
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>
          {active ? '活跃' : '已下架'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (record: Listing) => (
        <Button
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleCancelListing(record.id)}
          disabled={!record.active}
        >
          取消
        </Button>
      ),
    },
  ];

  // 如果不是做市商，显示提示
  if (isMarketMaker === false) {
    return (
      <div style={{ padding: 24 }}>
        <Title level={2}>做市商创建挂单</Title>
        <Alert
          message="权限不足"
          description={
            <div>
              <p>只有已审批通过的做市商才能创建挂单。</p>
              <p>您的账户状态：</p>
              <ul>
                <li>未申请做市商，或</li>
                <li>申请正在审批中，或</li>
                <li>申请被驳回</li>
              </ul>
              <p>
                如需成为做市商，请先在用户端 dapp 申请做市商资格，并等待审批通过。
              </p>
            </div>
          }
          type="warning"
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <PlusOutlined /> 做市商创建挂单
      </Title>

      <Alert
        message="挂单说明"
        description={
          <div>
            <p><strong>功能说明：</strong></p>
            <ul style={{ marginBottom: 0 }}>
              <li>创建 OTC 挂单，买家可直接购买</li>
              <li>支持设置价格spread、数量范围、有效期等</li>
              <li>创建时会锁定库存到托管，防止超卖</li>
              <li>可随时取消挂单，退回剩余库存</li>
            </ul>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* 创建挂单表单 */}
      <Card title="创建新挂单" style={{ marginBottom: 24 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateListing}
          initialValues={{
            side: 1, // 默认卖出
            base: 0, // MEMO
            quote: 1, // CNY
            pricingSpreadBps: 200, // 2% spread
            partial: true,
            ttlBlocks: 28800, // 约1天 (假设6秒一个区块)
          }}
        >
          <Form.Item
            label="交易方向"
            name="side"
            rules={[{ required: true, message: '请选择交易方向' }]}
          >
            <Select>
              <Option value={1}>卖出 (Sell)</Option>
              <Option value={0} disabled>买入 (Buy) - 暂不支持</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="交易对"
            extra="基础货币/计价货币"
          >
            <Space>
              <Form.Item
                name="base"
                rules={[{ required: true, message: '请输入基础货币ID' }]}
                noStyle
              >
                <InputNumber placeholder="基础货币ID (0=MEMO)" style={{ width: 200 }} />
              </Form.Item>
              <span>/</span>
              <Form.Item
                name="quote"
                rules={[{ required: true, message: '请输入计价货币ID' }]}
                noStyle
              >
                <InputNumber placeholder="计价货币ID (1=CNY)" style={{ width: 200 }} />
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item
            label="价格Spread (基点)"
            name="pricingSpreadBps"
            rules={[
              { required: true, message: '请输入spread' },
              { type: 'number', min: 0, max: 10000, message: '范围: 0-10000 (0%-100%)' }
            ]}
            extra="例如：200 = 2%"
          >
            <InputNumber
              min={0}
              max={10000}
              style={{ width: '100%' }}
              addonAfter="bps"
            />
          </Form.Item>

          <Divider />

          <Form.Item
            label="最小数量 (MEMO)"
            name="minQty"
            rules={[
              { required: true, message: '请输入最小数量' },
              { type: 'number', min: 0, message: '必须大于0' }
            ]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="例如: 100.00"
            />
          </Form.Item>

          <Form.Item
            label="最大数量 (MEMO)"
            name="maxQty"
            rules={[
              { required: true, message: '请输入最大数量' },
              { type: 'number', min: 0, message: '必须大于0' }
            ]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="例如: 10000.00"
            />
          </Form.Item>

          <Form.Item
            label="总量 (MEMO)"
            name="total"
            rules={[
              { required: true, message: '请输入总量' },
              { type: 'number', min: 0, message: '必须大于0' }
            ]}
            extra="创建时会锁定此数量到托管"
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="例如: 100000.00"
            />
          </Form.Item>

          <Form.Item
            label="允许部分成交"
            name="partial"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Divider />

          <Form.Item
            label="价格范围 (可选)"
            extra="不填写则不限制价格范围"
          >
            <Space>
              <Form.Item
                name="priceMin"
                noStyle
              >
                <InputNumber placeholder="最低价 (CNY)" style={{ width: 150 }} min={0} precision={2} />
              </Form.Item>
              <span>-</span>
              <Form.Item
                name="priceMax"
                noStyle
              >
                <InputNumber placeholder="最高价 (CNY)" style={{ width: 150 }} min={0} precision={2} />
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item
            label="有效期 (区块数)"
            name="ttlBlocks"
            rules={[
              { required: true, message: '请输入有效期' },
              { type: 'number', min: 1, message: '至少1个区块' }
            ]}
            extra={`当前区块: ${currentBlock}, 假设6秒/块, 28800块≈1天`}
          >
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              addonAfter="块"
            />
          </Form.Item>

          <Form.Item
            label="条款承诺 CID (可选)"
            name="termsCid"
            extra="IPFS CID，包含交易条款等"
          >
            <Input placeholder="例如: QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" maxLength={256} />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<PlusOutlined />}
              size="large"
              block
            >
              创建挂单
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 挂单列表 */}
      <Card
        title={`我的挂单 (${listings.length})`}
        extra={
          <Button onClick={loadListings} loading={loading}>
            刷新
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={listings}
          loading={loading}
          rowKey="id"
          pagination={false}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
};

export default MarketMakerListing;

