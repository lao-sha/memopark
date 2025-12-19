/**
 * 大师注册页面
 *
 * 功能：
 * - 分步骤填写注册信息
 * - 基础信息（名称、简介）
 * - 选择擅长占卜类型
 * - 选择擅长领域
 * - 支付保证金
 * - 提交注册
 */

import React, { useState } from 'react';
import {
  Card,
  Button,
  Typography,
  Steps,
  Form,
  Input,
  Checkbox,
  Alert,
  Space,
  Tag,
  message,
  Spin,
  Result,
} from 'antd';
import {
  UserOutlined,
  TagsOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  LeftOutlined,
} from '@ant-design/icons';
import { usePolkadot } from '@/providers/WalletProvider';
import { signAndSendTxWithPassword } from '@/lib/polkadot-safe';
import {
  DivinationType,
  Specialty,
  DIVINATION_TYPE_NAMES,
  DIVINATION_TYPE_ICONS,
  SPECIALTY_NAMES,
} from '../../types/divination';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Step } = Steps;

/**
 * 注册步骤枚举
 */
enum RegisterStep {
  BasicInfo = 0,
  DivinationTypes = 1,
  Specialties = 2,
  Deposit = 3,
  Success = 4,
}

/**
 * 注册表单数据接口
 */
interface RegisterFormData {
  name: string;
  bio: string;
  divinationTypes: DivinationType[];
  specialties: Specialty[];
}

/**
 * 基础信息步骤组件
 */
const BasicInfoStep: React.FC<{
  form: any;
  onNext: () => void;
}> = ({ form, onNext }) => {
  return (
    <div>
      <Title level={4}>基础信息</Title>
      <Paragraph type="secondary">
        填写您的显示名称和个人简介，这将展示在您的服务主页上
      </Paragraph>

      <Form form={form} layout="vertical" onFinish={onNext}>
        <Form.Item
          label="显示名称"
          name="name"
          rules={[
            { required: true, message: '请输入显示名称' },
            { max: 32, message: '名称不能超过32个字符' },
          ]}
        >
          <Input
            placeholder="例如：玄真子、易简居士"
            prefix={<UserOutlined />}
            maxLength={32}
            showCount
            style={{
              backgroundColor: '#ffffff',
              border: 'none',
              borderBottom: '1px solid #d9d9d9',
              borderRadius: 0,
              padding: '8px 11px'
            }}
          />
        </Form.Item>

        <Form.Item
          label="个人简介"
          name="bio"
          rules={[
            { required: true, message: '请输入个人简介' },
            { max: 256, message: '简介不能超过256个字符' },
          ]}
        >
          <TextArea
            placeholder="简要介绍您的从业经历、专业特长等（建议50-200字）"
            rows={4}
            maxLength={256}
            showCount
            style={{
              backgroundColor: '#ffffff',
              border: 'none',
              borderBottom: '1px solid #d9d9d9',
              borderRadius: 0,
              padding: '8px 11px'
            }}
          />
        </Form.Item>

        <Alert
          message="提示"
          description="请确保信息真实准确，优质的个人介绍有助于吸引更多客户"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            style={{
              background: '#000000',
              borderColor: '#000000',
              color: '#F7D3A1'
            }}
          >
            下一步
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

/**
 * 占卜类型选择步骤
 */
const DivinationTypesStep: React.FC<{
  selectedTypes: DivinationType[];
  onTypesChange: (types: DivinationType[]) => void;
  onNext: () => void;
  onPrev: () => void;
}> = ({ selectedTypes, onTypesChange, onNext, onPrev }) => {
  const allTypes = [
    DivinationType.Meihua,
    DivinationType.Bazi,
    DivinationType.Liuyao,
    DivinationType.Qimen,
    DivinationType.Ziwei,
    DivinationType.Daliuren,
    DivinationType.XiaoLiuRen,
    DivinationType.Tarot,
  ];

  const handleTypeToggle = (type: DivinationType) => {
    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter((t) => t !== type));
    } else {
      onTypesChange([...selectedTypes, type]);
    }
  };

  return (
    <div>
      <Title level={4}>选择擅长的占卜类型</Title>
      <Paragraph type="secondary">
        选择您擅长的占卜体系（至少选择一种，可多选）
      </Paragraph>

      <div style={{ marginBottom: 24 }}>
        {allTypes.map((type) => (
          <Tag.CheckableTag
            key={type}
            checked={selectedTypes.includes(type)}
            onChange={() => handleTypeToggle(type)}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              marginBottom: 8,
              border: selectedTypes.includes(type) ? '2px solid #B2955D' : '1px solid #d9d9d9',
            }}
          >
            <span style={{ marginRight: 8 }}>{DIVINATION_TYPE_ICONS[type]}</span>
            {DIVINATION_TYPE_NAMES[type]}
          </Tag.CheckableTag>
        ))}
      </div>

      {selectedTypes.length > 0 && (
        <Alert
          message={`已选择 ${selectedTypes.length} 种占卜类型`}
          description={selectedTypes.map((t) => DIVINATION_TYPE_NAMES[t]).join('、')}
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Space style={{ width: '100%' }}>
        <Button onClick={onPrev} icon={<LeftOutlined />}>
          上一步
        </Button>
        <Button
          type="primary"
          onClick={onNext}
          disabled={selectedTypes.length === 0}
          style={{
            flex: 1,
            background: selectedTypes.length === 0 ? undefined : '#000000',
            borderColor: selectedTypes.length === 0 ? undefined : '#000000',
            color: selectedTypes.length === 0 ? undefined : '#F7D3A1'
          }}
        >
          下一步
        </Button>
      </Space>
    </div>
  );
};

/**
 * 擅长领域选择步骤
 */
const SpecialtiesStep: React.FC<{
  selectedSpecialties: Specialty[];
  onSpecialtiesChange: (specialties: Specialty[]) => void;
  onNext: () => void;
  onPrev: () => void;
}> = ({ selectedSpecialties, onSpecialtiesChange, onNext, onPrev }) => {
  const allSpecialties = [
    Specialty.Career,
    Specialty.Relationship,
    Specialty.Wealth,
    Specialty.Health,
    Specialty.Education,
    Specialty.Travel,
    Specialty.Legal,
    Specialty.Finding,
    Specialty.FengShui,
    Specialty.DateSelection,
  ];

  const handleSpecialtyToggle = (specialty: Specialty) => {
    if (selectedSpecialties.includes(specialty)) {
      onSpecialtiesChange(selectedSpecialties.filter((s) => s !== specialty));
    } else {
      onSpecialtiesChange([...selectedSpecialties, specialty]);
    }
  };

  return (
    <div>
      <Title level={4}>选择擅长的解答领域</Title>
      <Paragraph type="secondary">
        选择您擅长解答的问题类型（至少选择一种，可多选）
      </Paragraph>

      <div style={{ marginBottom: 24 }}>
        {allSpecialties.map((specialty) => (
          <Tag.CheckableTag
            key={specialty}
            checked={selectedSpecialties.includes(specialty)}
            onChange={() => handleSpecialtyToggle(specialty)}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              marginBottom: 8,
              border: selectedSpecialties.includes(specialty)
                ? '2px solid #B2955D'
                : '1px solid #d9d9d9',
            }}
          >
            {SPECIALTY_NAMES[specialty]}
          </Tag.CheckableTag>
        ))}
      </div>

      {selectedSpecialties.length > 0 && (
        <Alert
          message={`已选择 ${selectedSpecialties.length} 个擅长领域`}
          description={selectedSpecialties.map((s) => SPECIALTY_NAMES[s]).join('、')}
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Space style={{ width: '100%' }}>
        <Button onClick={onPrev} icon={<LeftOutlined />}>
          上一步
        </Button>
        <Button
          type="primary"
          onClick={onNext}
          disabled={selectedSpecialties.length === 0}
          style={{
            flex: 1,
            background: selectedSpecialties.length === 0 ? undefined : '#000000',
            borderColor: selectedSpecialties.length === 0 ? undefined : '#000000',
            color: selectedSpecialties.length === 0 ? undefined : '#F7D3A1'
          }}
        >
          下一步
        </Button>
      </Space>
    </div>
  );
};

/**
 * 保证金支付步骤
 */
const DepositStep: React.FC<{
  formData: RegisterFormData;
  onSubmit: () => void;
  onPrev: () => void;
  loading: boolean;
}> = ({ formData, onSubmit, onPrev, loading }) => {
  const minDeposit = 100; // 最小保证金 100 DUST

  return (
    <div>
      <Title level={4}>支付保证金</Title>
      <Paragraph type="secondary">
        为了保障服务质量，需要支付保证金。保证金在您注销时可随时取回。
      </Paragraph>

      <Card style={{ marginBottom: 16, backgroundColor: '#ffffff' }}>
        <div style={{ textAlign: 'center' }}>
          <SafetyOutlined style={{ fontSize: 48, color: '#B2955D', marginBottom: 16 }} />
          <Title level={3}>{minDeposit} DUST</Title>
          <Text type="secondary">保证金金额</Text>
        </div>
      </Card>

      <Alert
        message="保证金说明"
        description={
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            <li>保证金使用区块链智能合约托管，安全可靠</li>
            <li>主动注销时，保证金会自动退回您的账户</li>
            <li>若发生严重违规，平台有权扣除部分或全部保证金</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card title="注册信息确认" size="small" style={{ marginBottom: 16, backgroundColor: '#ffffff' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div>
            <Text type="secondary">显示名称：</Text>
            <Text strong>{formData.name}</Text>
          </div>
          <div>
            <Text type="secondary">个人简介：</Text>
            <Paragraph style={{ marginBottom: 0 }}>{formData.bio}</Paragraph>
          </div>
          <div>
            <Text type="secondary">占卜类型：</Text>
            <div>
              {formData.divinationTypes.map((t) => (
                <Tag key={t} style={{ marginTop: 4 }}>
                  {DIVINATION_TYPE_ICONS[t]} {DIVINATION_TYPE_NAMES[t]}
                </Tag>
              ))}
            </div>
          </div>
          <div>
            <Text type="secondary">擅长领域：</Text>
            <div>
              {formData.specialties.map((s) => (
                <Tag key={s} color="green" style={{ marginTop: 4 }}>
                  {SPECIALTY_NAMES[s]}
                </Tag>
              ))}
            </div>
          </div>
        </Space>
      </Card>

      <Space style={{ width: '100%' }}>
        <Button onClick={onPrev} icon={<LeftOutlined />} disabled={loading}>
          上一步
        </Button>
        <Button
          type="primary"
          onClick={onSubmit}
          loading={loading}
          style={{
            flex: 1,
            background: '#000000',
            borderColor: '#000000',
            color: '#F7D3A1'
          }}
          size="large"
        >
          {loading ? '提交中...' : '确认支付并提交注册'}
        </Button>
      </Space>
    </div>
  );
};

/**
 * 注册成功页面
 */
const SuccessStep: React.FC = () => (
  <Result
    status="success"
    title="注册申请提交成功！"
    subTitle="我们将在 1-3 个工作日内完成审核，审核通过后您将收到通知"
    extra={[
      <Button
        type="primary"
        key="dashboard"
        onClick={() => (window.location.hash = '#/market')}
        style={{
          background: '#000000',
          borderColor: '#000000',
          color: '#F7D3A1'
        }}
      >
        返回市场
      </Button>,
      <Button key="info" onClick={() => (window.location.hash = '#/provider/info')}>
        了解更多
      </Button>,
    ]}
  >
    <div style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto' }}>
      <Title level={5}>下一步操作：</Title>
      <Paragraph>
        <CheckCircleOutlined style={{ color: '#B2955D', marginRight: 8 }} />
        耐心等待审核结果
      </Paragraph>
      <Paragraph>
        <CheckCircleOutlined style={{ color: '#B2955D', marginRight: 8 }} />
        审核通过后，完善个人资料和服务套餐
      </Paragraph>
      <Paragraph>
        <CheckCircleOutlined style={{ color: '#B2955D', marginRight: 8 }} />
        开始接单，为客户提供优质服务
      </Paragraph>
    </div>
  </Result>
);

/**
 * 大师注册页面
 */
const ProviderRegisterPage: React.FC = () => {
  const { api, currentAccount } = usePolkadot();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState<RegisterStep>(RegisterStep.BasicInfo);
  const [loading, setLoading] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    bio: '',
    divinationTypes: [],
    specialties: [],
  });

  /**
   * 处理基础信息提交
   */
  const handleBasicInfoNext = async () => {
    try {
      const values = await form.validateFields();
      setFormData((prev) => ({
        ...prev,
        name: values.name,
        bio: values.bio,
      }));
      setCurrentStep(RegisterStep.DivinationTypes);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  /**
   * 处理占卜类型选择
   */
  const handleDivinationTypesNext = () => {
    if (formData.divinationTypes.length === 0) {
      message.warning('请至少选择一种占卜类型');
      return;
    }
    setCurrentStep(RegisterStep.Specialties);
  };

  /**
   * 处理擅长领域选择
   */
  const handleSpecialtiesNext = () => {
    if (formData.specialties.length === 0) {
      message.warning('请至少选择一个擅长领域');
      return;
    }
    setCurrentStep(RegisterStep.Deposit);
  };

  /**
   * 提交注册
   */
  const handleSubmit = async () => {
    if (!api || !currentAccount) {
      message.error('请先连接钱包');
      return;
    }

    setLoading(true);

    try {
      // 计算位图
      const divinationTypesBitmap = formData.divinationTypes.reduce(
        (acc, type) => acc | (1 << type),
        0
      );
      const specialtiesBitmap = formData.specialties.reduce((acc, s) => acc | (1 << s), 0);

      // 调用链上 register_provider
      const tx = api.tx.divinationMarket.registerProvider(
        formData.name,
        formData.bio,
        specialtiesBitmap,
        divinationTypesBitmap
      );

      await signAndSendTxWithPassword(tx, currentAccount.address);

      message.success('注册申请提交成功！');
      setCurrentStep(RegisterStep.Success);
    } catch (error: any) {
      console.error('注册失败:', error);
      message.error(error.message || '注册失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="provider-register-page min-h-screen bg-[#f5f5f5] flex flex-col max-w-[414px] mx-auto pb-[80px]">
      {/* 顶部标题栏 - 黑色背景，金棕色文字 */}
      <div style={{ background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)' }} className="shadow-md">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
                <UserOutlined className="text-xl" style={{ color: '#B2955D' }} />
              </div>
              <h1 className="text-lg font-semibold" style={{ color: '#B2955D' }}>大师入驻注册</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-3">
        <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)', backgroundColor: '#ffffff' }}>

        {/* 步骤指示器 */}
        {currentStep !== RegisterStep.Success && (
          <Steps current={currentStep} style={{ marginBottom: 32 }} size="small">
            <Step title="基础信息" icon={<UserOutlined />} />
            <Step title="占卜类型" icon={<TagsOutlined />} />
            <Step title="擅长领域" icon={<TagsOutlined />} />
            <Step title="支付保证金" icon={<SafetyOutlined />} />
          </Steps>
        )}

        {/* 步骤内容 */}
        <Spin spinning={loading}>
          {currentStep === RegisterStep.BasicInfo && (
            <BasicInfoStep form={form} onNext={handleBasicInfoNext} />
          )}

          {currentStep === RegisterStep.DivinationTypes && (
            <DivinationTypesStep
              selectedTypes={formData.divinationTypes}
              onTypesChange={(types) => setFormData((prev) => ({ ...prev, divinationTypes: types }))}
              onNext={handleDivinationTypesNext}
              onPrev={() => setCurrentStep(RegisterStep.BasicInfo)}
            />
          )}

          {currentStep === RegisterStep.Specialties && (
            <SpecialtiesStep
              selectedSpecialties={formData.specialties}
              onSpecialtiesChange={(specialties) =>
                setFormData((prev) => ({ ...prev, specialties }))
              }
              onNext={handleSpecialtiesNext}
              onPrev={() => setCurrentStep(RegisterStep.DivinationTypes)}
            />
          )}

          {currentStep === RegisterStep.Deposit && (
            <DepositStep
              formData={formData}
              onSubmit={handleSubmit}
              onPrev={() => setCurrentStep(RegisterStep.Specialties)}
              loading={loading}
            />
          )}

          {currentStep === RegisterStep.Success && <SuccessStep />}
        </Spin>
      </Card>
      </div>
    </div>
  );
};

export default ProviderRegisterPage;
