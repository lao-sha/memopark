/**
 * 梅花易数起卦页面
 *
 * 参考传统梅花易数排盘界面设计
 * 支持多种起卦方式：自动、手工、电脑、数字、时间、其它
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card, Button, Input, InputNumber, message, Spin, Space, Typography, Divider, Select, Row, Col, Modal, Radio, DatePicker, Switch, Collapse, Tooltip } from 'antd';
import { ClockCircleOutlined, NumberOutlined, FileTextOutlined, ThunderboltOutlined, UserOutlined, QuestionCircleOutlined, HistoryOutlined, ShopOutlined, EditOutlined, DesktopOutlined, FieldTimeOutlined, EllipsisOutlined, LockOutlined, UnlockOutlined, SafetyOutlined, KeyOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { RadioChangeEvent } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import {
  divineByTime,
  divineByNumbers,
  divineByText,
  divineRandom,
  divineWithPrivacy,
  type PrivacyDivinationMethod,
} from '../../services/meihuaService';
import {
  MeihuaPrivacyUtils,
  PrivacyMode,
  type DivinerPrivateData,
} from '../../services/meihuaPrivacyService';
import { Gender, DivinationCategory, GENDER_NAMES, DIVINATION_CATEGORY_NAMES } from '../../types/meihua';
import './MeihuaPage.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

/** 隐私模式选项 */
const PRIVACY_MODE_OPTIONS = [
  { value: PrivacyMode.Public, label: '公开', icon: <UnlockOutlined />, desc: '所有人可见' },
  { value: PrivacyMode.Private, label: '私密', icon: <LockOutlined />, desc: '仅自己可见' },
  { value: PrivacyMode.Authorized, label: '授权', icon: <SafetyOutlined />, desc: '授权后可见' },
];

/** 密钥存储键名 */
const KEY_STORAGE_PREFIX = 'stardust_meihua_x25519_';

/** 起卦方式类型 */
type DivinationMethod = 'auto' | 'manual' | 'computer' | 'number' | 'time' | 'other';

/** 日期类型 */
type DateType = 'solar' | 'lunar';

/** 十二时辰数据 */
const SHICHEN_OPTIONS = [
  { value: 0, label: '0-子', desc: '23:00-01:00' },
  { value: 1, label: '1-丑', desc: '01:00-03:00' },
  { value: 2, label: '2-寅', desc: '03:00-05:00' },
  { value: 3, label: '3-卯', desc: '05:00-07:00' },
  { value: 4, label: '4-辰', desc: '07:00-09:00' },
  { value: 5, label: '5-巳', desc: '09:00-11:00' },
  { value: 6, label: '6-午', desc: '11:00-13:00' },
  { value: 7, label: '7-未', desc: '13:00-15:00' },
  { value: 8, label: '8-申', desc: '15:00-17:00' },
  { value: 9, label: '9-酉', desc: '17:00-19:00' },
  { value: 10, label: '10-戌', desc: '19:00-21:00' },
  { value: 11, label: '11-亥', desc: '21:00-23:00' },
];

/**
 * 根据当前小时获取时辰索引
 */
const getCurrentShichen = (): number => {
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 1) return 0; // 子时
  if (hour >= 1 && hour < 3) return 1; // 丑时
  if (hour >= 3 && hour < 5) return 2; // 寅时
  if (hour >= 5 && hour < 7) return 3; // 卯时
  if (hour >= 7 && hour < 9) return 4; // 辰时
  if (hour >= 9 && hour < 11) return 5; // 巳时
  if (hour >= 11 && hour < 13) return 6; // 午时
  if (hour >= 13 && hour < 15) return 7; // 未时
  if (hour >= 15 && hour < 17) return 8; // 申时
  if (hour >= 17 && hour < 19) return 9; // 酉时
  if (hour >= 19 && hour < 21) return 10; // 戌时
  return 11; // 亥时
};

/**
 * 起卦页面组件
 */
const DivinationPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // 命主信息
  const [name, setName] = useState('求测者');
  const [gender, setGender] = useState<number>(Gender.Male);
  const [birthYear, setBirthYear] = useState<number>(1980);
  const [question, setQuestion] = useState('');

  // 日期时间
  const [dateType, setDateType] = useState<DateType>('solar');
  const [divinationDate, setDivinationDate] = useState<Dayjs>(dayjs());
  const [shichen, setShichen] = useState<number>(getCurrentShichen());
  const [minute, setMinute] = useState<number>(new Date().getMinutes());

  // 起卦方式
  const [method, setMethod] = useState<DivinationMethod>('auto');

  // 数字起卦专用
  const [upperNumber, setUpperNumber] = useState<number>(1);
  const [lowerNumber, setLowerNumber] = useState<number>(1);

  // 占卜类别
  const [category, setCategory] = useState<number>(DivinationCategory.Unspecified);

  // ========== 隐私数据相关状态 ==========
  /** 是否启用隐私保护 */
  const [enablePrivacy, setEnablePrivacy] = useState(false);
  /** 隐私模式 */
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>(PrivacyMode.Private);
  /** 是否存储敏感信息（姓名、完整生日等） */
  const [storeSensitiveData, setStoreSensitiveData] = useState(false);
  /** 完整出生日期 */
  const [birthDate, setBirthDate] = useState<Dayjs | null>(null);
  /** 出生时辰（0-23） */
  const [birthHour, setBirthHour] = useState<number | null>(null);
  /** 备注信息 */
  const [notes, setNotes] = useState('');
  /** X25519 密钥对 */
  const [keyPair, setKeyPair] = useState<{ publicKey: Uint8Array; secretKey: Uint8Array } | null>(null);
  /** 显示密钥管理弹窗 */
  const [showKeyModal, setShowKeyModal] = useState(false);
  /** 加密进度提示 */
  const [encryptionStatus, setEncryptionStatus] = useState<string>('');

  /**
   * 初始化加载本地存储的密钥
   */
  useEffect(() => {
    // 尝试从本地存储加载密钥
    // 实际应用中应使用用户的钱包地址作为 key
    const storedKeyHex = localStorage.getItem(KEY_STORAGE_PREFIX + 'default');
    if (storedKeyHex) {
      try {
        const secretKey = hexToBytes(storedKeyHex);
        // 从私钥重新生成公钥
        const regeneratedKeyPair = MeihuaPrivacyUtils.generateKeyPair();
        // 注意：实际需要用私钥推导公钥，这里简化处理
        setKeyPair({
          publicKey: regeneratedKeyPair.publicKey,
          secretKey: secretKey.length === 32 ? secretKey : regeneratedKeyPair.secretKey,
        });
      } catch (e) {
        console.warn('加载密钥失败:', e);
      }
    }
  }, []);

  /**
   * 生成新的密钥对
   */
  const handleGenerateKeyPair = useCallback(() => {
    const newKeyPair = MeihuaPrivacyUtils.generateKeyPair();
    setKeyPair(newKeyPair);

    // 保存私钥到本地存储（实际应用应加密存储）
    const secretKeyHex = bytesToHex(newKeyPair.secretKey);
    localStorage.setItem(KEY_STORAGE_PREFIX + 'default', secretKeyHex);

    message.success('密钥生成成功！请妥善保管您的私钥');
    setShowKeyModal(false);
  }, []);

  /**
   * 将 Uint8Array 转为十六进制字符串
   */
  const bytesToHex = (bytes: Uint8Array): string => {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  /**
   * 将十六进制字符串转为 Uint8Array
   */
  const hexToBytes = (hex: string): Uint8Array => {
    const cleanHex = hex.replace('0x', '');
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    return bytes;
  };

  /**
   * 使用当前时间更新日期和时辰
   */
  const useCurrentTime = useCallback(() => {
    setDivinationDate(dayjs());
    setShichen(getCurrentShichen());
    setMinute(new Date().getMinutes());
  }, []);

  /**
   * 导航到指定路由（使用 hash 路由）
   */
  const navigate = useCallback((path: string) => {
    window.location.hash = `#${path}`;
  }, []);

  /**
   * 处理起卦成功
   */
  const handleDivinationSuccess = useCallback((hexagramId: number) => {
    message.success('起卦成功！');
    navigate(`/meihua/hexagram/${hexagramId}`);
  }, [navigate]);

  /**
   * 执行起卦
   */
  const handleDivination = useCallback(async () => {
    if (!question.trim() && method !== 'time') {
      message.warning('请输入占问事宜');
      return;
    }

    // 如果启用隐私保护，检查是否有密钥
    if (enablePrivacy && storeSensitiveData && !keyPair) {
      message.warning('请先生成加密密钥');
      setShowKeyModal(true);
      return;
    }

    setLoading(true);
    setEncryptionStatus('');

    try {
      let hexagramId: number;

      // 判断是否使用隐私起卦
      const usePrivacyDivination = enablePrivacy && (
        method === 'auto' ||
        method === 'time' ||
        method === 'computer' ||
        method === 'other'
      );

      if (usePrivacyDivination) {
        // 使用带隐私数据的起卦
        setEncryptionStatus('正在准备隐私数据...');

        // 映射起卦方式
        let privacyMethod: PrivacyDivinationMethod;
        if (method === 'time' || method === 'auto') {
          privacyMethod = dateType === 'lunar' ? 'LunarDateTime' : 'GregorianDateTime';
        } else {
          privacyMethod = 'Random';
        }

        // 准备隐私数据
        let privateData: DivinerPrivateData | undefined;
        if (storeSensitiveData && keyPair) {
          setEncryptionStatus('正在加密敏感数据...');
          privateData = {
            name: name,
            birthDate: birthDate ? birthDate.format('YYYY-MM-DD') : undefined,
            birthHour: birthHour ?? undefined,
            notes: notes || undefined,
          };
        }

        setEncryptionStatus('正在提交链上交易...');

        const result = await divineWithPrivacy({
          questionText: question || '未指定问题',
          isPublic: privacyMode === PrivacyMode.Public,
          gender,
          birthYear,
          category,
          method: privacyMethod,
          privateData,
          ownerPublicKey: keyPair?.publicKey,
          privacyMode,
        });

        hexagramId = result.hexagramId;

        if (result.hasEncryptedData) {
          message.success('起卦成功！隐私数据已加密存储');
        } else {
          message.success('起卦成功！');
        }
      } else {
        // 使用传统起卦方式
        switch (method) {
          case 'auto':
          case 'time':
            hexagramId = await divineByTime(undefined, false, gender, category);
            break;

          case 'number':
            if (upperNumber < 1 || lowerNumber < 1) {
              message.warning('请输入有效的数字');
              setLoading(false);
              return;
            }
            hexagramId = await divineByNumbers(upperNumber, lowerNumber, undefined, false, gender, category);
            break;

          case 'computer':
          case 'other':
            hexagramId = await divineRandom(undefined, false, gender, category);
            break;

          case 'manual':
            if (!question.trim()) {
              message.warning('请输入占问事宜');
              setLoading(false);
              return;
            }
            hexagramId = await divineByText(question, false, gender, category);
            break;

          default:
            hexagramId = await divineByTime(undefined, false, gender, category);
        }

        message.success('起卦成功！');
      }

      handleDivinationSuccess(hexagramId);
    } catch (error) {
      console.error('起卦失败:', error);
      message.error('起卦失败，请稍后重试');
    } finally {
      setLoading(false);
      setEncryptionStatus('');
    }
  }, [
    method, question, upperNumber, lowerNumber, gender, category,
    handleDivinationSuccess, enablePrivacy, storeSensitiveData, keyPair,
    privacyMode, name, birthDate, birthHour, notes, birthYear, dateType
  ]);

  /**
   * 渲染说明弹窗
   */
  const renderInstructionsModal = () => (
    <Modal
      title={
        <span style={{ fontSize: 18, fontWeight: 600 }}>
          <QuestionCircleOutlined style={{ marginRight: 8, color: '#B2955D' }} />
          梅花易数 · 起卦说明
        </span>
      }
      open={showInstructions}
      onCancel={() => setShowInstructions(false)}
      footer={null}
      width={460}
      style={{ top: 20 }}
    >
      <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '8px 0' }}>
        <Title level={5} style={{ color: '#B2955D', marginTop: 16 }}>起卦须知</Title>
        <Paragraph>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>起卦时请保持心境平和，专注于您的问题</li>
            <li style={{ marginBottom: 8 }}>一事一占，同一问题短期内不宜重复占卜</li>
            <li style={{ marginBottom: 8 }}>所有卦象将永久记录在区块链上，可随时查看</li>
            <li style={{ marginBottom: 8 }}>可选择 AI 智能解卦或找大师人工解读</li>
          </ul>
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        <Title level={5} style={{ color: '#B2955D' }}>起卦方式详解</Title>

        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>◎ 自动</Text>
          <br />
          系统根据当前时间自动计算卦象，最常用的方式。
        </Paragraph>

        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>◎ 手工</Text>
          <br />
          根据输入的占问事宜文字计算卦象。
        </Paragraph>

        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>◎ 电脑</Text>
          <br />
          使用区块链随机数生成卦象。
        </Paragraph>

        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>◎ 数字</Text>
          <br />
          输入两个数字（如门牌号、车牌号）计算卦象。
        </Paragraph>

        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>◎ 时间</Text>
          <br />
          根据指定的日期时辰计算卦象。
        </Paragraph>

        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>◎ 其它</Text>
          <br />
          其他特殊起卦方式。
        </Paragraph>
      </div>
    </Modal>
  );

  return (
    <div className="meihua-page">
      {/* 顶部导航栏 */}
      <div className="nav-card" style={{
        borderRadius: '0',
        background: '#FFFFFF',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        border: 'none',
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '414px',
        zIndex: 100,
        height: '50px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px'
      }}>
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', cursor: 'pointer' }}
          onClick={() => navigate('/meihua/list')}
        >
          <HistoryOutlined style={{ fontSize: '18px', color: '#999' }} />
          <div style={{ fontSize: '10px', color: '#999' }}>我的卦象</div>
        </div>

        <div style={{ fontSize: '18px', color: '#333', fontWeight: '600', whiteSpace: 'nowrap' }}>星尘玄鉴-梅花易数排盘</div>

        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', cursor: 'pointer' }}
          onClick={() => setShowInstructions(true)}
        >
          <QuestionCircleOutlined style={{ fontSize: '18px', color: '#999' }} />
          <div style={{ fontSize: '10px', color: '#999' }}>说明</div>
        </div>
      </div>

      {/* 顶部占位 */}
      <div style={{ height: '50px' }}></div>

      {/* 主表单卡片 */}
      <Spin spinning={loading} tip="正在起卦...">
        <Card className="divination-card input-card" style={{ margin: '12px', borderRadius: '8px', width: 'calc(100% + 10px)', marginLeft: '-5px' }}>
          {/* 命主姓名 + 性别 */}
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-label" style={{ width: 80, textAlign: 'right', paddingRight: 8 }}>
              命主姓名：
            </div>
            <div className="form-content" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="求测者"
                style={{ width: 80 }}
              />
              <span style={{ color: '#8B6914', fontSize: 14, whiteSpace: 'nowrap' }}>性别：</span>
              <Radio.Group
                value={gender}
                onChange={(e: RadioChangeEvent) => setGender(e.target.value)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value={Gender.Male}>男</Radio.Button>
                <Radio.Button value={Gender.Female}>女</Radio.Button>
              </Radio.Group>
            </div>
          </div>

          {/* 出生年份 */}
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-label" style={{ width: 80, textAlign: 'right', paddingRight: 8 }}>
              出生年份：
            </div>
            <div className="form-content" style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
              <InputNumber
                value={birthYear}
                onChange={(v) => setBirthYear(v || 1980)}
                min={1900}
                max={2100}
                style={{ width: 100 }}
              />
            </div>
          </div>

          {/* 占问事宜 */}
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-label" style={{ width: 80, textAlign: 'right', paddingRight: 8 }}>
              占问事宜：
            </div>
            <div className="form-content" style={{ flex: 1 }}>
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="要问的事情"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* 日期类型 */}
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-label" style={{ width: 80, textAlign: 'right', paddingRight: 8 }}>
              日期类型：
            </div>
            <div className="form-content" style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
              <Radio.Group
                value={dateType}
                onChange={(e: RadioChangeEvent) => setDateType(e.target.value)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="solar">公历</Radio.Button>
                <Radio.Button value="lunar">农历</Radio.Button>
              </Radio.Group>
            </div>
          </div>

          {/* 起卦日期 */}
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-label" style={{ width: 80, textAlign: 'right', paddingRight: 8 }}>
              起卦日期：
            </div>
            <div className="form-content" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Select
                value={divinationDate.year()}
                onChange={(v) => setDivinationDate(divinationDate.year(v))}
                style={{ width: 90 }}
                options={Array.from({ length: 50 }, (_, i) => ({
                  value: 2000 + i,
                  label: `${2000 + i}年`
                }))}
              />
              <Select
                value={divinationDate.month() + 1}
                onChange={(v) => setDivinationDate(divinationDate.month(v - 1))}
                style={{ width: 75 }}
                options={Array.from({ length: 12 }, (_, i) => ({
                  value: i + 1,
                  label: `${i + 1}月`
                }))}
              />
              <Select
                value={divinationDate.date()}
                onChange={(v) => setDivinationDate(divinationDate.date(v))}
                style={{ width: 75 }}
                options={Array.from({ length: 31 }, (_, i) => ({
                  value: i + 1,
                  label: `${i + 1}日`
                }))}
              />
            </div>
          </div>

          {/* 起卦时辰 */}
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-label" style={{ width: 80, textAlign: 'right', paddingRight: 8 }}>
              起卦时辰：
            </div>
            <div className="form-content" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Select
                value={shichen}
                onChange={setShichen}
                style={{ width: 80 }}
                options={SHICHEN_OPTIONS.map(s => ({
                  value: s.value,
                  label: s.label
                }))}
              />
              <span>时</span>
              <Select
                value={minute}
                onChange={setMinute}
                style={{ width: 60 }}
                options={Array.from({ length: 60 }, (_, i) => ({
                  value: i,
                  label: `${i}`
                }))}
              />
              <span>分</span>
              <Button
                size="small"
                onClick={useCurrentTime}
                style={{ fontSize: 14, background: '#fff', borderColor: '#d9d9d9', height: 22, padding: '0px', lineHeight: '20px' }}
              >
                当前时间
              </Button>
            </div>
          </div>

          {/* 起卦方式 */}
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-label" style={{ width: 80, textAlign: 'right', paddingRight: 8 }}>
              起卦方式：
            </div>
            <div className="form-content" style={{ flex: 1 }}>
              <Radio.Group
                value={method}
                onChange={(e: RadioChangeEvent) => setMethod(e.target.value)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="auto">自动</Radio.Button>
                <Radio.Button value="manual">手工</Radio.Button>
                <Radio.Button value="computer">电脑</Radio.Button>
                <Radio.Button value="number">数字</Radio.Button>
                <Radio.Button value="time">时间</Radio.Button>
                <Radio.Button value="other">其它</Radio.Button>
              </Radio.Group>
            </div>
          </div>

          {/* 数字起卦时显示数字输入 */}
          {method === 'number' && (
            <div className="form-row" style={{ marginBottom: 16 }}>
              <div className="form-label" style={{ width: 80, textAlign: 'right', paddingRight: 8 }}>
                起卦数字：
              </div>
              <div className="form-content" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>上卦数</span>
                <InputNumber
                  min={1}
                  max={999}
                  value={upperNumber}
                  onChange={(v) => setUpperNumber(v || 1)}
                  style={{ width: 80 }}
                />
                <span>下卦数</span>
                <InputNumber
                  min={1}
                  max={999}
                  value={lowerNumber}
                  onChange={(v) => setLowerNumber(v || 1)}
                  style={{ width: 80 }}
                />
              </div>
            </div>
          )}

          {/* ========== 隐私保护选项 ========== */}
          <Divider style={{ margin: '16px 0 12px 0' }}>
            <span style={{ color: '#8B6914', fontSize: 13 }}>
              <SafetyOutlined /> 隐私保护
            </span>
          </Divider>

          {/* 启用隐私保护开关 */}
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-label" style={{ width: 80, textAlign: 'right', paddingRight: 8 }}>
              隐私保护：
            </div>
            <div className="form-content" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Switch
                checked={enablePrivacy}
                onChange={setEnablePrivacy}
                checkedChildren={<LockOutlined />}
                unCheckedChildren={<UnlockOutlined />}
              />
              <span style={{ color: enablePrivacy ? '#52c41a' : '#999', fontSize: 12 }}>
                {enablePrivacy ? '已启用' : '未启用'}
              </span>
              <Tooltip title="启用后可选择卦象的可见性和是否加密存储敏感信息">
                <InfoCircleOutlined style={{ color: '#999', cursor: 'help' }} />
              </Tooltip>
            </div>
          </div>

          {/* 隐私模式选择（启用隐私保护后显示） */}
          {enablePrivacy && (
            <>
              <div className="form-row" style={{ marginBottom: 16 }}>
                <div className="form-label" style={{ width: 80, textAlign: 'right', paddingRight: 8 }}>
                  可见范围：
                </div>
                <div className="form-content" style={{ flex: 1 }}>
                  <Radio.Group
                    value={privacyMode}
                    onChange={(e: RadioChangeEvent) => setPrivacyMode(e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                  >
                    {PRIVACY_MODE_OPTIONS.map(opt => (
                      <Tooltip key={opt.value} title={opt.desc}>
                        <Radio.Button value={opt.value}>
                          {opt.icon} {opt.label}
                        </Radio.Button>
                      </Tooltip>
                    ))}
                  </Radio.Group>
                </div>
              </div>

              {/* 存储敏感数据开关 */}
              <div className="form-row" style={{ marginBottom: 16 }}>
                <div className="form-label" style={{ width: 80, textAlign: 'right', paddingRight: 8 }}>
                  加密存储：
                </div>
                <div className="form-content" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Switch
                    checked={storeSensitiveData}
                    onChange={setStoreSensitiveData}
                  />
                  <span style={{ color: storeSensitiveData ? '#1890ff' : '#999', fontSize: 12 }}>
                    {storeSensitiveData ? '加密存储敏感信息' : '不存储敏感信息'}
                  </span>
                  {storeSensitiveData && !keyPair && (
                    <Button
                      size="small"
                      type="link"
                      icon={<KeyOutlined />}
                      onClick={() => setShowKeyModal(true)}
                      style={{ padding: 0 }}
                    >
                      生成密钥
                    </Button>
                  )}
                  {storeSensitiveData && keyPair && (
                    <span style={{ color: '#52c41a', fontSize: 12 }}>
                      <SafetyOutlined /> 密钥已就绪
                    </span>
                  )}
                </div>
              </div>

              {/* 敏感信息输入（开启加密存储后显示） */}
              {storeSensitiveData && (
                <Collapse
                  ghost
                  defaultActiveKey={['sensitive']}
                  style={{ marginBottom: 16, background: '#fafafa', borderRadius: 8 }}
                >
                  <Panel
                    header={
                      <span style={{ color: '#8B6914', fontSize: 13 }}>
                        <LockOutlined /> 敏感信息（将加密存储）
                      </span>
                    }
                    key="sensitive"
                  >
                    {/* 完整出生日期 */}
                    <div className="form-row" style={{ marginBottom: 12 }}>
                      <div className="form-label" style={{ width: 70, textAlign: 'right', paddingRight: 8, fontSize: 12 }}>
                        出生日期：
                      </div>
                      <div className="form-content" style={{ flex: 1 }}>
                        <DatePicker
                          value={birthDate}
                          onChange={setBirthDate}
                          placeholder="选择完整出生日期"
                          style={{ width: '100%' }}
                          format="YYYY-MM-DD"
                        />
                      </div>
                    </div>

                    {/* 出生时辰 */}
                    <div className="form-row" style={{ marginBottom: 12 }}>
                      <div className="form-label" style={{ width: 70, textAlign: 'right', paddingRight: 8, fontSize: 12 }}>
                        出生时辰：
                      </div>
                      <div className="form-content" style={{ flex: 1 }}>
                        <Select
                          value={birthHour}
                          onChange={setBirthHour}
                          placeholder="选择出生时辰"
                          style={{ width: '100%' }}
                          allowClear
                          options={Array.from({ length: 24 }, (_, i) => ({
                            value: i,
                            label: `${i}时 (${Math.floor(i / 2)}:${i % 2 === 0 ? '00' : '30'}-${Math.floor((i + 1) / 2)}:${(i + 1) % 2 === 0 ? '00' : '30'})`
                          }))}
                        />
                      </div>
                    </div>

                    {/* 备注信息 */}
                    <div className="form-row" style={{ marginBottom: 8 }}>
                      <div className="form-label" style={{ width: 70, textAlign: 'right', paddingRight: 8, fontSize: 12 }}>
                        备注信息：
                      </div>
                      <div className="form-content" style={{ flex: 1 }}>
                        <Input
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="可选的备注信息"
                          maxLength={100}
                        />
                      </div>
                    </div>
                  </Panel>
                </Collapse>
              )}
            </>
          )}

          {/* 加密状态提示 */}
          {encryptionStatus && (
            <div style={{
              padding: '8px 12px',
              background: '#e6f7ff',
              borderRadius: 4,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <Spin size="small" />
              <span style={{ color: '#1890ff', fontSize: 13 }}>{encryptionStatus}</span>
            </div>
          )}

          {/* 起卦按钮 */}
          <div style={{ marginTop: 24 }}>
            <Button
              type="primary"
              size="large"
              onClick={handleDivination}
              loading={loading}
              block
              style={{
                background: '#1a1a1a',
                border: 'none',
                height: 48,
                fontSize: 16,
                fontWeight: 500,
                borderRadius: 24
              }}
            >
              梅花易数排盘
            </Button>
          </div>
        </Card>
      </Spin>

      {/* 底部导航 */}
      <div className="bottom-nav">
        <Space split={<Divider type="vertical" />}>
          <Button type="link" onClick={() => navigate('/meihua/list')}>
            <HistoryOutlined /> 我的卦象
          </Button>
          <Button type="link" onClick={() => navigate('/meihua/market')}>
            <ShopOutlined /> 占卜市场
          </Button>
        </Space>
      </div>

      {/* 说明弹窗 */}
      {renderInstructionsModal()}

      {/* 密钥管理弹窗 */}
      <Modal
        title={
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            <KeyOutlined style={{ marginRight: 8, color: '#B2955D' }} />
            加密密钥管理
          </span>
        }
        open={showKeyModal}
        onCancel={() => setShowKeyModal(false)}
        footer={null}
        width={400}
      >
        <div style={{ padding: '16px 0' }}>
          {keyPair ? (
            <>
              <div style={{
                padding: '12px',
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                borderRadius: 8,
                marginBottom: 16
              }}>
                <div style={{ color: '#52c41a', marginBottom: 8 }}>
                  <SafetyOutlined /> 密钥已生成
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  公钥: {bytesToHex(keyPair.publicKey).slice(0, 16)}...
                </div>
              </div>

              <Paragraph style={{ fontSize: 13, color: '#666' }}>
                您的加密密钥已安全存储在本地浏览器中。
                <br />
                <Text type="warning" style={{ fontSize: 12 }}>
                  注意：清除浏览器数据将导致密钥丢失，届时将无法解密已加密的隐私数据。
                </Text>
              </Paragraph>

              <Button
                type="default"
                danger
                block
                onClick={() => {
                  Modal.confirm({
                    title: '确认重新生成密钥？',
                    content: '重新生成密钥后，旧密钥加密的数据将无法解密。此操作不可逆，请谨慎操作。',
                    okText: '确认重新生成',
                    okType: 'danger',
                    cancelText: '取消',
                    onOk: handleGenerateKeyPair,
                  });
                }}
              >
                重新生成密钥
              </Button>
            </>
          ) : (
            <>
              <Paragraph style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                首次使用加密存储功能，需要生成加密密钥。
                <br />
                密钥将安全存储在您的浏览器本地存储中。
              </Paragraph>

              <div style={{
                padding: '12px',
                background: '#fff7e6',
                border: '1px solid #ffd591',
                borderRadius: 8,
                marginBottom: 16
              }}>
                <Text type="warning" style={{ fontSize: 12 }}>
                  <InfoCircleOutlined /> 重要提示：
                  <ul style={{ paddingLeft: 16, margin: '8px 0 0 0' }}>
                    <li>密钥仅存储在本地，无法恢复</li>
                    <li>清除浏览器数据将导致密钥丢失</li>
                    <li>建议在安全的设备上使用此功能</li>
                  </ul>
                </Text>
              </div>

              <Button
                type="primary"
                block
                icon={<KeyOutlined />}
                onClick={handleGenerateKeyPair}
                style={{ height: 40 }}
              >
                生成加密密钥
              </Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default DivinationPage;
