/**
 * 做市商免费配额管理页面
 * 
 * 功能级详细中文注释：
 * 做市商管理免费配额，包括设置默认配额、为特定买家授予配额、批量授予配额、查看代付统计。
 * 
 * @component FreeQuotaManagementPage
 * @created 2025-10-22
 */

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Input, 
  Form, 
  message, 
  Statistic, 
  Table, 
  Tabs,
  Modal,
  Space,
  Alert,
  Tag,
  InputNumber
} from 'antd';
import { 
  GiftOutlined, 
  SettingOutlined, 
  UserAddOutlined,
  TeamOutlined,
  BarChartOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { useApi } from '../../lib/polkadot';
import { useWallet } from '../../providers/WalletProvider';
import { 
  getDefaultQuota, 
  getSponsoredStats,
  setFreeQuotaConfig,
  grantFreeQuota,
  batchGrantFreeQuota,
  getRemainingQuota,
  type SponsoredStats
} from '../../services/freeQuotaService';

const { TabPane } = Tabs;
const { TextArea } = Input;

/**
 * 函数级详细中文注释：做市商免费配额管理页面组件
 */
const FreeQuotaManagementPage: React.FC = () => {
  const { api } = useApi();
  const { selectedAccount } = useWallet();

  // 假设做市商ID为1，实际应从路由或上下文获取
  const [makerId] = useState(1);

  // 状态管理
  const [loading, setLoading] = useState(false);
  const [defaultQuota, setDefaultQuota] = useState<number>(0);
  const [sponsoredStats, setSponsoredStats] = useState<SponsoredStats>({
    totalCount: 0,
    totalAmount: 0,
    avgGasPerOrder: 0,
  });

  // 模态框状态
  const [isGrantModalVisible, setIsGrantModalVisible] = useState(false);
  const [isBatchModalVisible, setIsBatchModalVisible] = useState(false);

  // 表单
  const [configForm] = Form.useForm();
  const [grantForm] = Form.useForm();
  const [batchForm] = Form.useForm();

  /**
   * 函数级详细中文注释：加载配额信息和统计
   */
  const loadData = async () => {
    if (!api) return;

    try {
      setLoading(true);

      // 并行加载默认配额和代付统计
      const [quota, stats] = await Promise.all([
        getDefaultQuota(api, makerId),
        getSponsoredStats(api, makerId)
      ]);

      setDefaultQuota(quota);
      setSponsoredStats(stats);

      // 设置表单初始值
      configForm.setFieldsValue({ quota });
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [api, makerId]);

  /**
   * 函数级详细中文注释：设置默认免费配额
   */
  const handleSetConfig = async (values: { quota: number }) => {
    if (!api || !selectedAccount) {
      message.error('请先连接钱包');
      return;
    }

    try {
      setLoading(true);

      await setFreeQuotaConfig(
        api,
        makerId,
        values.quota,
        selectedAccount,
        (status) => {
          message.info(status);
        }
      );

      message.success('默认配额设置成功');
      await loadData();
    } catch (error: any) {
      console.error('设置默认配额失败:', error);
      message.error(error.message || '设置默认配额失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 函数级详细中文注释：为特定买家授予免费配额
   */
  const handleGrant = async (values: { buyerAddress: string; quota: number }) => {
    if (!api || !selectedAccount) {
      message.error('请先连接钱包');
      return;
    }

    try {
      setLoading(true);

      await grantFreeQuota(
        api,
        makerId,
        values.buyerAddress,
        values.quota,
        selectedAccount,
        (status) => {
          message.info(status);
        }
      );

      message.success('免费配额授予成功');
      setIsGrantModalVisible(false);
      grantForm.resetFields();
      await loadData();
    } catch (error: any) {
      console.error('授予免费配额失败:', error);
      message.error(error.message || '授予免费配额失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 函数级详细中文注释：批量授予免费配额
   */
  const handleBatchGrant = async (values: { buyerAddresses: string; quota: number }) => {
    if (!api || !selectedAccount) {
      message.error('请先连接钱包');
      return;
    }

    try {
      setLoading(true);

      // 解析买家地址列表（每行一个地址）
      const addresses = values.buyerAddresses
        .split('\n')
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0);

      if (addresses.length === 0) {
        message.error('请输入至少一个买家地址');
        return;
      }

      if (addresses.length > 100) {
        message.error('批量授予最多支持100个买家');
        return;
      }

      await batchGrantFreeQuota(
        api,
        makerId,
        addresses,
        values.quota,
        selectedAccount,
        (status) => {
          message.info(status);
        }
      );

      message.success(`已为 ${addresses.length} 个买家批量授予免费配额`);
      setIsBatchModalVisible(false);
      batchForm.resetFields();
      await loadData();
    } catch (error: any) {
      console.error('批量授予免费配额失败:', error);
      message.error(error.message || '批量授予免费配额失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 函数级详细中文注释：渲染配额统计卡片
   */
  const renderStatsCards = () => {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card>
          <Statistic
            title="默认免费次数"
            value={defaultQuota}
            suffix="次/人"
            prefix={<GiftOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
          <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
            每个新买家自动获得的免费次数
          </div>
        </Card>

        <Card>
          <Statistic
            title="累计代付次数"
            value={sponsoredStats.totalCount}
            suffix="次"
            prefix={<ThunderboltOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
          <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
            累计为买家代付Gas的总次数
          </div>
        </Card>

        <Card>
          <Statistic
            title="累计代付金额"
            value={sponsoredStats.totalAmount}
            suffix="DUST"
            precision={4}
            prefix={<BarChartOutlined />}
            valueStyle={{ color: '#faad14' }}
          />
          <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
            累计为买家代付的Gas总金额
          </div>
        </Card>

        <Card>
          <Statistic
            title="平均每笔Gas"
            value={sponsoredStats.avgGasPerOrder}
            suffix="DUST"
            precision={6}
            valueStyle={{ color: '#722ed1' }}
          />
          <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
            平均每笔订单的Gas成本
          </div>
        </Card>
      </div>
    );
  };

  /**
   * 函数级详细中文注释：渲染成本分析卡片
   */
  const renderCostAnalysis = () => {
    const monthlyOrders = 1000; // 假设每月1000笔订单
    const monthlyGasCost = monthlyOrders * sponsoredStats.avgGasPerOrder;
    const premiumRate = 0.02; // 2% 溢价
    const avgOrderAmount = 100; // 假设平均每单100 USDT
    const monthlyRevenue = monthlyOrders * avgOrderAmount * premiumRate;
    const roi = monthlyGasCost > 0 ? (monthlyRevenue / monthlyGasCost) : 0;

    return (
      <Card title="成本分析（月度预估）" style={{ marginBottom: 24 }}>
        <Alert
          message="基于当前数据的月度成本预估"
          description="假设每月1000笔订单，溢价2%，平均每单100 USDT"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <Statistic
            title="月度Gas成本"
            value={monthlyGasCost}
            suffix="DUST"
            precision={4}
            valueStyle={{ color: '#ff4d4f' }}
          />
          <Statistic
            title="月度溢价收益"
            value={monthlyRevenue}
            suffix="USDT"
            precision={2}
            valueStyle={{ color: '#52c41a' }}
          />
          <Statistic
            title="收益/成本比"
            value={roi}
            suffix=":1"
            precision={0}
            valueStyle={{ color: '#1890ff' }}
          />
          <Statistic
            title="净收益"
            value={monthlyRevenue}
            suffix="USDT"
            precision={2}
            valueStyle={{ color: '#52c41a' }}
          />
        </div>

        <Alert
          message={`做市商成本几乎可以忽略不计！每月仅需 ${monthlyGasCost.toFixed(4)} DUST，即可获得 ${monthlyRevenue.toFixed(2)} USDT 的溢价收益。`}
          type="success"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Card>
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 24 }}>
        <GiftOutlined style={{ marginRight: 8, color: '#52c41a' }} />
        免费配额管理
      </h2>

      {/* 统计卡片 */}
      {renderStatsCards()}

      {/* 成本分析 */}
      {renderCostAnalysis()}

      {/* 管理功能 */}
      <Tabs defaultActiveKey="config">
        <TabPane 
          tab={<span><SettingOutlined />默认配额设置</span>} 
          key="config"
        >
          <Card>
            <Alert
              message="设置默认免费配额"
              description="设置每个新买家自动获得的免费次数。设置为0表示不提供免费服务。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Form
              form={configForm}
              layout="vertical"
              onFinish={handleSetConfig}
            >
              <Form.Item
                label="每个新买家的默认免费次数"
                name="quota"
                rules={[
                  { required: true, message: '请输入默认免费次数' },
                  { type: 'number', min: 0, max: 100, message: '配额范围：0-100' }
                ]}
              >
                <InputNumber
                  min={0}
                  max={100}
                  style={{ width: '100%' }}
                  placeholder="如：3 表示每个新买家3次免费"
                />
              </Form.Item>

              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  icon={<SettingOutlined />}
                >
                  保存设置
                </Button>
              </Form.Item>
            </Form>

            <div style={{ marginTop: 24 }}>
              <h4>使用场景：</h4>
              <ul>
                <li>设置为 3：每个新买家有 3 次免费创建订单的机会</li>
                <li>设置为 0：不提供免费服务，所有买家都需要自己支付 Gas</li>
                <li>设置为 5：为每个新买家提供 5 次免费机会</li>
              </ul>
            </div>
          </Card>
        </TabPane>

        <TabPane 
          tab={<span><UserAddOutlined />授予单个买家</span>} 
          key="grant"
        >
          <Card>
            <Alert
              message="为特定买家增加免费配额"
              description="为指定买家增加额外的免费次数，适用于推广活动、优质买家奖励等场景。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Button 
              type="primary" 
              icon={<UserAddOutlined />}
              onClick={() => setIsGrantModalVisible(true)}
            >
              授予免费配额
            </Button>

            <div style={{ marginTop: 24 }}>
              <h4>使用场景：</h4>
              <ul>
                <li><b>推广活动</b>：为参与活动的用户增加 5 次免费机会</li>
                <li><b>优质买家</b>：为信用良好的买家增加额外配额</li>
                <li><b>客户服务</b>：为投诉用户补偿免费次数</li>
                <li><b>合作伙伴</b>：为合作方的用户提供更多免费次数</li>
              </ul>
            </div>
          </Card>
        </TabPane>

        <TabPane 
          tab={<span><TeamOutlined />批量授予</span>} 
          key="batch"
        >
          <Card>
            <Alert
              message="批量授予免费配额"
              description="为多个买家批量增加免费次数，适用于大规模推广活动。最多支持100个买家。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Button 
              type="primary" 
              icon={<TeamOutlined />}
              onClick={() => setIsBatchModalVisible(true)}
            >
              批量授予配额
            </Button>

            <div style={{ marginTop: 24 }}>
              <h4>使用场景：</h4>
              <ul>
                <li>大规模推广活动</li>
                <li>批量奖励优质买家</li>
                <li>合作方用户批量福利</li>
              </ul>
            </div>
          </Card>
        </TabPane>
      </Tabs>

      {/* 授予单个买家模态框 */}
      <Modal
        title="授予免费配额"
        open={isGrantModalVisible}
        onCancel={() => setIsGrantModalVisible(false)}
        footer={null}
      >
        <Form
          form={grantForm}
          layout="vertical"
          onFinish={handleGrant}
        >
          <Form.Item
            label="买家地址"
            name="buyerAddress"
            rules={[
              { required: true, message: '请输入买家地址' },
              { len: 48, message: '请输入有效的地址' }
            ]}
          >
            <Input placeholder="5xxx...xxx" />
          </Form.Item>

          <Form.Item
            label="增加的免费次数"
            name="quota"
            rules={[
              { required: true, message: '请输入免费次数' },
              { type: 'number', min: 1, max: 100, message: '配额范围：1-100' }
            ]}
          >
            <InputNumber
              min={1}
              max={100}
              style={{ width: '100%' }}
              placeholder="如：5 表示增加5次免费"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                确认授予
              </Button>
              <Button onClick={() => setIsGrantModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量授予模态框 */}
      <Modal
        title="批量授予免费配额"
        open={isBatchModalVisible}
        onCancel={() => setIsBatchModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={batchForm}
          layout="vertical"
          onFinish={handleBatchGrant}
        >
          <Form.Item
            label="买家地址列表（每行一个地址，最多100个）"
            name="buyerAddresses"
            rules={[
              { required: true, message: '请输入买家地址列表' }
            ]}
          >
            <TextArea
              rows={10}
              placeholder="5xxx...xxx&#10;5yyy...yyy&#10;5zzz...zzz"
            />
          </Form.Item>

          <Form.Item
            label="每个买家增加的免费次数"
            name="quota"
            rules={[
              { required: true, message: '请输入免费次数' },
              { type: 'number', min: 1, max: 100, message: '配额范围：1-100' }
            ]}
          >
            <InputNumber
              min={1}
              max={100}
              style={{ width: '100%' }}
              placeholder="如：5 表示每人增加5次免费"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                确认批量授予
              </Button>
              <Button onClick={() => setIsBatchModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FreeQuotaManagementPage;

