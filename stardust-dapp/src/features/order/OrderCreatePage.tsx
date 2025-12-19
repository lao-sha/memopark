/**
 * 订单创建页面
 *
 * 功能：
 * - 选择服务提供者套餐
 * - 选择占卜结果
 * - 填写咨询问题
 * - 上传到IPFS并创建订单
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Divider,
  Tag,
  Radio,
  Input,
  Select,
  Steps,
  Empty,
  Spin,
  Alert,
  message,
  Form,
  Checkbox,
} from 'antd';
import {
  ShopOutlined,
  LeftOutlined,
  FileTextOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  UserOutlined,
  StarOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { usePolkadot } from '@/providers/WalletProvider';
import { signAndSendTxWithPassword } from '@/lib/polkadot-safe';
import {
  DivinationType,
  ServiceType,
  DIVINATION_TYPE_NAMES,
  DIVINATION_TYPE_ICONS,
  SERVICE_TYPE_NAMES,
  PROVIDER_TIER_NAMES,
  PROVIDER_TIER_COLORS,
  type ServiceProvider,
  type ServicePackage,
  calculateAverageRating,
} from '../../types/divination';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * 订单创建步骤
 */
enum CreateStep {
  SelectPackage = 0,
  SelectResult = 1,
  FillQuestion = 2,
  Confirm = 3,
}

/**
 * 格式化金额
 */
function formatAmount(amount: bigint): string {
  return (Number(amount) / 1e12).toFixed(2);
}

/**
 * 订单创建页面
 */
const OrderCreatePage: React.FC = () => {
  const { api, currentAccount } = usePolkadot();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<CreateStep>(CreateStep.SelectPackage);

  // 提供者信息
  const [provider, setProvider] = useState<ServiceProvider | null>(null);
  const [packages, setPackages] = useState<ServicePackage[]>([]);

  // 表单数据
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);
  const [question, setQuestion] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  // 占卜结果列表（用户的历史占卜记录）
  const [divinationResults, setDivinationResults] = useState<any[]>([]);

  /**
   * 从URL参数获取提供者地址和套餐ID
   */
  const urlParams = useMemo(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1]);
    return {
      provider: params.get('provider'),
      packageId: params.get('package') ? parseInt(params.get('package')!) : null,
    };
  }, []);

  const providerAccount = urlParams.provider;

  /**
   * 加载提供者信息和套餐
   */
  useEffect(() => {
    if (!api || !providerAccount) return;

    const loadProviderData = async () => {
      setLoading(true);
      try {
        // 加载提供者信息
        const providerData = await api.query.divinationMarket.providers(providerAccount);
        if (providerData.isSome) {
          const data = providerData.unwrap().toJSON() as any;

          // 解码名称和简介
          const decodeName = (nameData: any): string => {
            if (!nameData) return '未命名大师';
            if (typeof nameData === 'string' && nameData.startsWith('0x')) {
              try {
                const hex = nameData.slice(2);
                const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
                return new TextDecoder().decode(bytes).trim() || '未命名大师';
              } catch (e) {
                return '未命名大师';
              }
            }
            if (typeof nameData === 'string') return nameData;
            return '未命名大师';
          };

          const decodeBio = (bioData: any): string => {
            if (!bioData) return '暂无简介';
            if (typeof bioData === 'string' && bioData.startsWith('0x')) {
              try {
                const hex = bioData.slice(2);
                const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []);
                return new TextDecoder().decode(bytes).trim() || '暂无简介';
              } catch (e) {
                return '暂无简介';
              }
            }
            if (typeof bioData === 'string') return bioData;
            return '暂无简介';
          };

          setProvider({
            account: providerAccount,
            name: decodeName(data.name),
            bio: decodeBio(data.bio),
            avatarCid: data.avatarCid,
            tier: data.tier,
            isActive: data.isActive,
            deposit: BigInt(data.deposit || 0),
            registeredAt: data.registeredAt || 0,
            totalOrders: data.totalOrders || 0,
            completedOrders: data.completedOrders || 0,
            cancelledOrders: data.cancelledOrders || 0,
            totalRatings: data.totalRatings || 0,
            ratingSum: data.ratingSum || 0,
            totalEarnings: BigInt(data.totalEarnings || 0),
            specialties: data.specialties || 0,
            supportedDivinationTypes: data.supportedDivinationTypes || 0,
            acceptsUrgent: data.acceptsUrgent || false,
            lastActiveAt: data.lastActiveAt || 0,
          });
        } else {
          message.error('提供者不存在');
          window.location.hash = '#/market';
          return;
        }

        // 加载提供者的套餐列表
        const entries = await api.query.divinationMarket.packages.entries(providerAccount);
        const pkgList: ServicePackage[] = [];

        for (const [key, value] of entries) {
          const pkgData = value.toJSON() as any;
          if (!pkgData || !pkgData.isActive) continue;

          const pkg: ServicePackage = {
            id: pkgData.id || 0,
            divinationType: pkgData.divinationType as DivinationType,
            serviceType: pkgData.serviceType as ServiceType,
            name: pkgData.name || '未命名套餐',
            description: pkgData.description || '',
            price: BigInt(pkgData.price || 0),
            duration: pkgData.duration || 0,
            followUpCount: pkgData.followUpCount || 0,
            urgentAvailable: pkgData.urgentAvailable || false,
            urgentSurcharge: pkgData.urgentSurcharge || 0,
            isActive: true,
            salesCount: pkgData.salesCount || 0,
          };

          pkgList.push(pkg);
        }

        setPackages(pkgList);

        // 如果URL中指定了套餐ID，自动选中并跳到下一步
        if (urlParams.packageId) {
          const targetPackage = pkgList.find((p) => p.id === urlParams.packageId);
          if (targetPackage) {
            setSelectedPackage(targetPackage);
            setCurrentStep(CreateStep.SelectResult);
          }
        }
      } catch (error: any) {
        console.error('加载提供者数据失败:', error);
        message.error('加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    loadProviderData();
  }, [api, providerAccount, urlParams.packageId]);

  /**
   * 加载用户的占卜结果列表
   */
  useEffect(() => {
    if (!api || !currentAccount || !selectedPackage) return;

    const loadDivinationResults = async () => {
      try {
        // TODO: 根据选中的占卜类型，查询用户的历史占卜记录
        // 这里使用模拟数据，实际应该从对应的占卜模块查询
        const mockResults = [
          { id: 1, type: DivinationType.Bazi, name: '2024年1月生辰八字', createdAt: Date.now() - 86400000 },
          { id: 2, type: DivinationType.Meihua, name: '事业问卦', createdAt: Date.now() - 172800000 },
        ];

        setDivinationResults(mockResults.filter((r) => r.type === selectedPackage.divinationType));
      } catch (error: any) {
        console.error('加载占卜结果失败:', error);
      }
    };

    loadDivinationResults();
  }, [api, currentAccount, selectedPackage]);

  /**
   * 计算订单金额
   */
  const orderAmount = useMemo(() => {
    if (!selectedPackage) return BigInt(0);

    let amount = selectedPackage.price;
    if (isUrgent && selectedPackage.urgentAvailable) {
      const surcharge = (Number(amount) * selectedPackage.urgentSurcharge) / 10000;
      amount = BigInt(Number(amount) + surcharge);
    }

    return amount;
  }, [selectedPackage, isUrgent]);

  /**
   * 处理套餐选择
   */
  const handleSelectPackage = (pkg: ServicePackage) => {
    setSelectedPackage(pkg);
    setCurrentStep(CreateStep.SelectResult);
  };

  /**
   * 处理占卜结果选择
   */
  const handleSelectResult = (resultId: number) => {
    setSelectedResultId(resultId);
    setCurrentStep(CreateStep.FillQuestion);
  };

  /**
   * 处理问题填写
   */
  const handleQuestionSubmit = () => {
    if (!question.trim()) {
      message.warning('请填写您的咨询问题');
      return;
    }
    setCurrentStep(CreateStep.Confirm);
  };

  /**
   * 提交订单
   */
  const handleSubmitOrder = async () => {
    if (!api || !currentAccount || !selectedPackage || selectedResultId === null) {
      message.error('订单信息不完整');
      return;
    }

    setSubmitting(true);

    try {
      // TODO: 上传问题到IPFS
      // 这里暂时使用问题文本的哈希作为CID
      const questionCid = `Qm${question.substring(0, 44).padEnd(44, '0')}`;

      // 调用链上创建订单
      const tx = api.tx.divinationMarket.createOrder(
        providerAccount,
        selectedPackage.divinationType,
        selectedResultId,
        selectedPackage.id,
        questionCid,
        isUrgent
      );

      await signAndSendTxWithPassword(tx, currentAccount.address);

      message.success('订单创建成功！');

      // TODO: 获取订单ID并跳转到订单详情页
      // 暂时跳转到我的订单列表
      setTimeout(() => {
        window.location.hash = '#/my-orders';
      }, 1000);
    } catch (error: any) {
      console.error('创建订单失败:', error);
      message.error(error.message || '创建订单失败');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 渲染套餐选择步骤
   */
  const renderPackageSelection = () => {
    if (loading) {
      return <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>;
    }

    if (packages.length === 0) {
      return (
        <Empty
          description="该提供者暂无可用套餐"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button onClick={() => window.location.hash = '#/market'}>返回市场</Button>
        </Empty>
      );
    }

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {packages.map((pkg) => (
          <Card
            key={pkg.id}
            hoverable
            onClick={() => handleSelectPackage(pkg)}
            style={{
              border: selectedPackage?.id === pkg.id ? '2px solid #1890ff' : undefined,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div>
                    <Tag color="blue">{DIVINATION_TYPE_ICONS[pkg.divinationType]} {DIVINATION_TYPE_NAMES[pkg.divinationType]}</Tag>
                    <Tag>{SERVICE_TYPE_NAMES[pkg.serviceType]}</Tag>
                  </div>
                  <Text strong style={{ fontSize: 16 }}>{pkg.name}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{pkg.description}</Text>
                  <Space size={8}>
                    {pkg.followUpCount > 0 && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        含{pkg.followUpCount}次追问
                      </Text>
                    )}
                    {pkg.urgentAvailable && (
                      <Tag color="red" icon={<FireOutlined />} style={{ fontSize: 10 }}>
                        可加急
                      </Tag>
                    )}
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      已售{pkg.salesCount}
                    </Text>
                  </Space>
                </Space>
              </div>
              <div style={{ textAlign: 'right', marginLeft: 16 }}>
                <Text strong style={{ fontSize: 20, color: '#f5222d' }}>
                  {formatAmount(pkg.price)}
                </Text>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                  DUST
                </Text>
              </div>
            </div>
          </Card>
        ))}
      </Space>
    );
  };

  /**
   * 渲染占卜结果选择步骤
   */
  const renderResultSelection = () => {
    if (divinationResults.length === 0) {
      return (
        <Empty
          description="暂无相关占卜记录"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Space>
            <Button onClick={() => setCurrentStep(CreateStep.SelectPackage)}>返回上一步</Button>
            <Button type="primary" onClick={() => {
              // TODO: 跳转到对应的占卜页面
              message.info('请先进行占卜');
            }}>
              去占卜
            </Button>
          </Space>
        </Empty>
      );
    }

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert
          message="选择占卜结果"
          description="请选择您想咨询的占卜结果。提供者将基于这个结果为您提供深度解读。"
          type="info"
          showIcon
        />

        <Radio.Group
          style={{ width: '100%' }}
          value={selectedResultId}
          onChange={(e) => handleSelectResult(e.target.value)}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {divinationResults.map((result) => (
              <Card key={result.id} hoverable>
                <Radio value={result.id}>
                  <Space direction="vertical" size="small">
                    <Text strong>{result.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(result.createdAt).toLocaleString()}
                    </Text>
                  </Space>
                </Radio>
              </Card>
            ))}
          </Space>
        </Radio.Group>

        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={() => setCurrentStep(CreateStep.SelectPackage)}>
            上一步
          </Button>
          <Button
            type="primary"
            disabled={selectedResultId === null}
            onClick={() => setCurrentStep(CreateStep.FillQuestion)}
          >
            下一步
          </Button>
        </Space>
      </Space>
    );
  };

  /**
   * 渲染问题填写步骤
   */
  const renderQuestionForm = () => (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Alert
        message="填写咨询问题"
        description="请详细描述您的问题，提供者将基于您选择的占卜结果进行深度解读。"
        type="info"
        showIcon
      />

      <Form layout="vertical">
        <Form.Item
          label="咨询问题"
          required
          help={`${question.length}/500 字符`}
        >
          <TextArea
            rows={6}
            maxLength={500}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="请详细描述您的问题，包括具体情况、困惑点等..."
          />
        </Form.Item>

        {selectedPackage?.urgentAvailable && (
          <Form.Item>
            <Checkbox checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)}>
              <Space>
                <FireOutlined style={{ color: '#ff4d4f' }} />
                <Text>加急处理（额外支付 {selectedPackage.urgentSurcharge / 100}% 费用）</Text>
              </Space>
            </Checkbox>
          </Form.Item>
        )}
      </Form>

      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={() => setCurrentStep(CreateStep.SelectResult)}>
          上一步
        </Button>
        <Button type="primary" onClick={handleQuestionSubmit}>
          下一步
        </Button>
      </Space>
    </Space>
  );

  /**
   * 渲染确认订单步骤
   */
  const renderConfirmation = () => (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Alert
        message="确认订单信息"
        description="请仔细核对订单信息，确认无误后提交订单。"
        type="warning"
        showIcon
      />

      {/* 提供者信息 */}
      <Card title="服务提供者" size="small">
        <Space>
          <Text strong>{provider?.name}</Text>
          <Tag color={PROVIDER_TIER_COLORS[provider?.tier || 0]}>
            {PROVIDER_TIER_NAMES[provider?.tier || 0]}
          </Tag>
          <Text type="secondary">
            <StarOutlined /> {calculateAverageRating(provider!).toFixed(1)}
          </Text>
        </Space>
      </Card>

      {/* 套餐信息 */}
      <Card title="服务套餐" size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>{selectedPackage?.name}</Text>
          </div>
          <div>
            <Tag color="blue">{DIVINATION_TYPE_NAMES[selectedPackage?.divinationType || 0]}</Tag>
            <Tag>{SERVICE_TYPE_NAMES[selectedPackage?.serviceType || 0]}</Tag>
          </div>
          <Text type="secondary">{selectedPackage?.description}</Text>
        </Space>
      </Card>

      {/* 咨询问题 */}
      <Card title="咨询问题" size="small">
        <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{question}</Paragraph>
      </Card>

      {/* 费用明细 */}
      <Card title="费用明细" size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>套餐价格</Text>
            <Text>{formatAmount(selectedPackage?.price || BigInt(0))} DUST</Text>
          </div>
          {isUrgent && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text>加急费用</Text>
              <Text type="danger">
                +{formatAmount(orderAmount - (selectedPackage?.price || BigInt(0)))} DUST
              </Text>
            </div>
          )}
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text strong>订单总额</Text>
            <Text strong style={{ fontSize: 18, color: '#f5222d' }}>
              {formatAmount(orderAmount)} DUST
            </Text>
          </div>
        </Space>
      </Card>

      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={() => setCurrentStep(CreateStep.FillQuestion)}>
          上一步
        </Button>
        <Button
          type="primary"
          size="large"
          loading={submitting}
          onClick={handleSubmitOrder}
          icon={<CheckCircleOutlined />}
        >
          {submitting ? '创建中...' : '确认下单'}
        </Button>
      </Space>
    </Space>
  );

  if (!providerAccount) {
    return (
      <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
        <Card>
          <Empty description="缺少提供者参数">
            <Button type="primary" onClick={() => window.location.hash = '#/market'}>
              返回市场
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  return (
    <div className="order-create-page" style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      {/* 顶部导航 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="link"
            icon={<LeftOutlined />}
            onClick={() => window.location.hash = '#/market'}
            style={{ padding: 0 }}
          >
            返回
          </Button>
          <Divider type="vertical" />
          <Title level={4} style={{ margin: 0 }}>
            <ShopOutlined /> 创建订单
          </Title>
        </Space>
      </Card>

      {/* 提供者信息卡片 */}
      {provider && (
        <Card style={{ marginBottom: 16 }}>
          <Space>
            <UserOutlined style={{ fontSize: 24 }} />
            <div>
              <Text strong>{provider.name}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>{provider.bio}</Text>
            </div>
          </Space>
        </Card>
      )}

      {/* 步骤指示器 */}
      <Card style={{ marginBottom: 16 }}>
        <Steps current={currentStep} size="small">
          <Steps.Step title="选择套餐" icon={<ShopOutlined />} />
          <Steps.Step title="选择结果" icon={<FileTextOutlined />} />
          <Steps.Step title="填写问题" icon={<FileTextOutlined />} />
          <Steps.Step title="确认下单" icon={<DollarOutlined />} />
        </Steps>
      </Card>

      {/* 步骤内容 */}
      <Card>
        {currentStep === CreateStep.SelectPackage && renderPackageSelection()}
        {currentStep === CreateStep.SelectResult && renderResultSelection()}
        {currentStep === CreateStep.FillQuestion && renderQuestionForm()}
        {currentStep === CreateStep.Confirm && renderConfirmation()}
      </Card>
    </div>
  );
};

export default OrderCreatePage;
