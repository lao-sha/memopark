import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Space,
  Typography,
  Alert,
  message,
  Divider,
  Row,
  Col,
} from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useWallet } from '../../providers/WalletProvider';
import { getApi, signAndSendLocalWithPassword } from '../../lib/polkadot-safe';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * 函数级详细中文注释：创建联盟治理提案组件
 *
 * ## 功能说明
 * - 发起即时分成比例（InstantLevelPercents）调整提案
 * - 输入新的15层分成比例
 * - 提供提案标题、详情和理由（IPFS CID）
 * - 自动计算押金金额（微调1000 DUST，重大10000 DUST）
 * - 调用 pallet-affiliate::propose_percentage_adjustment
 *
 * ## 权限要求
 * - 持币量 ≥ 10,000 DUST（大户提案）
 * - ≥ 1000 人联署（联署提案）
 * - 技术委员会成员提议（委员会提案）
 */
const CreateAffiliateProposal: React.FC = () => {
  const { current, askPassword } = useWallet();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [isMajor, setIsMajor] = useState(false);

  /**
   * 函数级中文注释：默认比例（从链上读取当前值）
   */
  const [currentPercentages, setCurrentPercentages] = useState<number[]>([
    30, 15, 10, 8, 6, 5, 4, 3, 3, 2, 2, 2, 2, 2, 2,
  ]);

  /**
   * 函数级中文注释：加载当前比例
   */
  const loadCurrentPercentages = async () => {
    try {
      const api = await getApi();
      const palletName = 'affiliate';
      const percentages = await (api.query as any)[palletName].instantLevelPercents();

      if (percentages) {
        const values = percentages.map((p: any) => p.toNumber());
        setCurrentPercentages(values);
        form.setFieldsValue({
          ...form.getFieldsValue(),
          ...values.reduce((acc, val, idx) => {
            acc[`layer${idx + 1}`] = val;
            return acc;
          }, {} as Record<string, number>),
        });
      }
    } catch (error) {
      console.error('加载当前比例失败:', error);
    }
  };

  React.useEffect(() => {
    loadCurrentPercentages();
  }, []);

  /**
   * 函数级中文注释：计算变化幅度
   */
  const calculateChangeMagnitude = (newPercentages: number[]) => {
    let totalChange = 0;
    for (let i = 0; i < 15; i++) {
      const diff = Math.abs(newPercentages[i] - currentPercentages[i]);
      totalChange += diff;
    }
    return totalChange;
  };

  /**
   * 函数级中文注释：表单值变化时更新押金和提案类型
   */
  const onValuesChange = (_: any, values: any) => {
    const newPercentages: number[] = [];
    for (let i = 1; i <= 15; i++) {
      newPercentages.push(values[`layer${i}`] || 0);
    }

    // 计算变化幅度
    const changeMagnitude = calculateChangeMagnitude(newPercentages);
    const major = changeMagnitude > 10;

    setIsMajor(major);
    setDepositAmount(major ? '10,000 DUST' : '1,000 DUST');
  };

  /**
   * 函数级中文注释：提交提案
   */
  const onFinish = async (values: any) => {
    if (!current) {
      message.error('请先连接钱包');
      return;
    }

    // 构建新比例数组
    const newPercentages: number[] = [];
    for (let i = 1; i <= 15; i++) {
      newPercentages.push(values[`layer${i}`]);
    }

    // 验证比例总和
    const total = newPercentages.reduce((sum, p) => sum + p, 0);
    if (total < 50 || total > 99) {
      message.error('比例总和必须在 50% 到 99% 之间');
      return;
    }

    // 验证前3层不能为0
    if (newPercentages[0] === 0 || newPercentages[1] === 0 || newPercentages[2] === 0) {
      message.error('前3层比例不能为0');
      return;
    }

    // 验证递减性（前5层）
    for (let i = 1; i < 5; i++) {
      if (newPercentages[i] > newPercentages[i - 1]) {
        message.error('前5层比例应该递减');
        return;
      }
    }

    setLoading(true);

    try {
      const password = await askPassword();
      if (!password) {
        setLoading(false);
        return;
      }

      const api = await getApi();
      const palletName = 'affiliate';

      // 构建参数
      const titleCid = values.titleCid || '';
      const descriptionCid = values.descriptionCid || '';
      const rationaleCid = values.rationaleCid || '';

      // 调用链上方法
      const result = await signAndSendLocalWithPassword(
        palletName,
        'proposePercentageAdjustment',
        [newPercentages, titleCid, descriptionCid, rationaleCid],
        password
      );

      message.success('提案创建成功！');
      console.log('提案创建结果:', result);

      // 延迟跳转
      setTimeout(() => {
        window.location.hash = '#/gov/affiliate/dashboard';
      }, 1500);
    } catch (error: any) {
      console.error('创建提案失败:', error);
      message.error(`创建提案失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      {/* 顶部导航 */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          background: '#fff',
          zIndex: 10,
          padding: '8px 0',
          marginBottom: 16,
        }}
      >
        <button
          onClick={() => window.history.back()}
          style={{ border: '1px solid #eee', padding: '6px 12px', borderRadius: 8 }}
        >
          返回
        </button>
      </div>

      <Title level={3}>创建联盟治理提案</Title>

      {/* 警告提示 */}
      <Alert
        type="warning"
        showIcon
        icon={<InfoCircleOutlined />}
        message="重要提示"
        description={
          <div>
            <p>• 提案需要缴纳押金：微调提案 1,000 DUST，重大提案 10,000 DUST</p>
            <p>• 提案通过后押金退还，拒绝后押金不退</p>
            <p>• 变化幅度 ≤10% 为微调提案，&gt;10% 为重大提案</p>
            <p>• 比例总和必须在 50%-99% 之间</p>
            <p>• 前3层比例不能为0，前5层应递减</p>
          </div>
        }
        style={{ marginBottom: 16 }}
      />

      {/* 当前比例展示 */}
      <Card size="small" title="当前比例" style={{ marginBottom: 16 }}>
        <Row gutter={[8, 8]}>
          {currentPercentages.map((p, idx) => (
            <Col span={8} key={idx}>
              <Text>
                L{idx + 1}: <Text strong>{p}%</Text>
              </Text>
            </Col>
          ))}
        </Row>
        <Divider style={{ margin: '12px 0' }} />
        <Text type="secondary">
          总和: <Text strong>{currentPercentages.reduce((s, p) => s + p, 0)}%</Text>
        </Text>
      </Card>

      {/* 表单 */}
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        onValuesChange={onValuesChange}
        initialValues={currentPercentages.reduce((acc, val, idx) => {
          acc[`layer${idx + 1}`] = val;
          return acc;
        }, {} as Record<string, number>)}
      >
        {/* 新比例输入 */}
        <Card size="small" title="新分成比例（15层）" style={{ marginBottom: 16 }}>
          <Row gutter={[8, 8]}>
            {[...Array(15)].map((_, idx) => (
              <Col span={8} key={idx}>
                <Form.Item
                  name={`layer${idx + 1}`}
                  label={`L${idx + 1}`}
                  rules={[
                    { required: true, message: `请输入第${idx + 1}层比例` },
                    { type: 'number', min: 0, max: 100, message: '比例必须在0-100之间' },
                  ]}
                  style={{ marginBottom: 8 }}
                >
                  <InputNumber
                    min={0}
                    max={100}
                    precision={0}
                    style={{ width: '100%' }}
                    placeholder="%"
                  />
                </Form.Item>
              </Col>
            ))}
          </Row>
        </Card>

        {/* 押金提示 */}
        {depositAmount && (
          <Alert
            type={isMajor ? 'error' : 'info'}
            message={`${isMajor ? '重大提案' : '微调提案'} - 需要押金: ${depositAmount}`}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 提案元数据 */}
        <Card size="small" title="提案详情（IPFS CID）" style={{ marginBottom: 16 }}>
          <Form.Item
            name="titleCid"
            label="标题 CID"
            rules={[{ required: true, message: '请输入提案标题的 IPFS CID' }]}
          >
            <Input placeholder="Qm... 或 bafy..." />
          </Form.Item>

          <Form.Item
            name="descriptionCid"
            label="详情 CID"
            rules={[{ required: true, message: '请输入提案详情的 IPFS CID' }]}
          >
            <Input placeholder="Qm... 或 bafy..." />
          </Form.Item>

          <Form.Item
            name="rationaleCid"
            label="理由 CID"
            rules={[{ required: true, message: '请输入提案理由的 IPFS CID' }]}
          >
            <Input placeholder="Qm... 或 bafy..." />
          </Form.Item>

          <Alert
            type="info"
            message="IPFS CID 说明"
            description="请先将提案标题、详情和理由上传到 IPFS，然后在此填写对应的 CID。"
            style={{ marginTop: 8 }}
          />
        </Card>

        {/* 提交按钮 */}
        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading} size="large">
            提交提案
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default CreateAffiliateProposal;
