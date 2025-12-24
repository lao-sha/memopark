/**
 * 六爻占卜页面（链端模式）
 *
 * 功能：
 * - 随机起卦（链上随机数）
 * - 时间起卦（根据年月日时）
 * - 直接跳转到详情页查看解盘结果
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Divider,
  Tag,
  message,
  Alert,
  Spin,
  Modal,
  Input,
  Select,
  Radio,
  Checkbox,
} from 'antd';
import type { RadioChangeEvent } from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import {
  ThunderboltOutlined,
  HistoryOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
  CloudOutlined,
  ClockCircleOutlined,
  QuestionCircleOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { DI_ZHI_NAMES } from '../../types/liuyao';
import * as liuyaoService from '../../services/liuyaoService';
import { getGanZhiFromDate } from '../../services/liuyaoService';
import './LiuyaoPage.css';

const { Title, Text, Paragraph } = Typography;

/** 性别枚举 */
enum Gender {
  Male = 1,
  Female = 0,
}

/** 日期类型 */
type DateType = 'solar' | 'lunar';

/** 起卦方式 */
type DivinationMethod = 'auto' | 'manual' | 'computer' | 'number' | 'time' | 'other';

/** 爻值类型（手工/电脑起卦用） */
type YaoValue = 'shaoyang' | 'shaoyin' | 'laoyang' | 'laoyin' | '';

/** 时间起卦类型 */
type TimeMethodType = 'shijian' | 'zhongshen';

/** 数字起卦方式 */
type NumberMethodType = 'bujia' | 'jiashu';

/** 天干/地支起卦方式 */
type ZhiMethodType = 'tiangan' | 'dizhi';

/** 八卦选项（其它起卦用） */
const BA_GUA_OPTIONS = [
  { value: 1, label: '乾一' },
  { value: 2, label: '兑二' },
  { value: 3, label: '离三' },
  { value: 4, label: '震四' },
  { value: 5, label: '巽五' },
  { value: 6, label: '坎六' },
  { value: 7, label: '艮七' },
  { value: 8, label: '坤八' },
];

/** 爻值选项（手工/电脑起卦用） */
const YAO_VALUE_OPTIONS = [
  { value: 'shaoyang', label: '一个背 少阳' },
  { value: 'shaoyin', label: '二个背 少阴' },
  { value: 'laoyang', label: '三个背 老阳' },
  { value: 'laoyin', label: '三个面 老阴' },
];

/**
 * 二十四小时时辰选项（下拉框用，每小时一个选项）
 */
const SHICHEN_OPTIONS = [
  { value: 0, label: '0-子' },
  { value: 1, label: '1-丑' },
  { value: 2, label: '2-丑' },
  { value: 3, label: '3-寅' },
  { value: 4, label: '4-寅' },
  { value: 5, label: '5-卯' },
  { value: 6, label: '6-卯' },
  { value: 7, label: '7-辰' },
  { value: 8, label: '8-辰' },
  { value: 9, label: '9-巳' },
  { value: 10, label: '10-巳' },
  { value: 11, label: '11-午' },
  { value: 12, label: '12-午' },
  { value: 13, label: '13-未' },
  { value: 14, label: '14-未' },
  { value: 15, label: '15-申' },
  { value: 16, label: '16-申' },
  { value: 17, label: '17-酉' },
  { value: 18, label: '18-酉' },
  { value: 19, label: '19-戌' },
  { value: 20, label: '20-戌' },
  { value: 21, label: '21-亥' },
  { value: 22, label: '22-亥' },
  { value: 23, label: '23-子' },
];

/**
 * 六爻占卜页面
 */
const LiuyaoPage: React.FC = () => {
  // 命主信息
  const [name, setName] = useState('求测者');
  const [gender, setGender] = useState<Gender>(Gender.Male);
  const [birthYear, setBirthYear] = useState<number>(1980);
  const [question, setQuestion] = useState('');

  // 日期类型
  const [dateType, setDateType] = useState<DateType>('solar');

  // 起卦日期时间
  const [divinationDate, setDivinationDate] = useState<dayjs.Dayjs>(dayjs());
  const [hour, setHour] = useState<number>(new Date().getHours());
  const [minute, setMinute] = useState<number>(new Date().getMinutes());

  // 起卦方式
  const [divinationMethod, setDivinationMethod] = useState<DivinationMethod>('auto');

  // 手工/电脑起卦：六爻值
  const [yaoValues, setYaoValues] = useState<YaoValue[]>(['', '', '', '', '', '']);

  // 电脑起卦：摇卦状态
  const [computerShakeCount, setComputerShakeCount] = useState(0);
  const [isShakingComputer, setIsShakingComputer] = useState(false);

  // 电脑起卦：铜板状态（'pending' | 'heads' | 'tails'）
  // heads = 字面（正面，计为3），tails = 背面（反面，计为2）
  const [coinStates, setCoinStates] = useState<Array<'pending' | 'heads' | 'tails' | 'shaking'>>(['pending', 'pending', 'pending']);
  // 摇卦历史（记录每次摇卦的三个铜板结果）
  const [shakeHistory, setShakeHistory] = useState<Array<{coins: Array<'heads' | 'tails'>, yaoType: YaoValue}>>([]);

  // 数字起卦
  const [numberInput, setNumberInput] = useState('');
  const [addShichen, setAddShichen] = useState(false);

  // 时间起卦
  const [timeMethodType, setTimeMethodType] = useState<TimeMethodType>('shijian');
  const [numberMethodType, setNumberMethodType] = useState<NumberMethodType>('bujia');
  const [zhiMethodType, setZhiMethodType] = useState<ZhiMethodType>('tiangan');
  const [timeNumber, setTimeNumber] = useState('');

  // 其它起卦
  const [upperGua, setUpperGua] = useState<number>(1);
  const [lowerGua, setLowerGua] = useState<number>(1);
  const [movingYaos, setMovingYaos] = useState<boolean[]>([false, false, false, false, false, false]);

  // 状态
  const [shaking, setShaking] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [chainGuaId, setChainGuaId] = useState<number | null>(null);

  // 说明弹窗状态
  const [showInstructions, setShowInstructions] = useState(false);

  /**
   * 使用当前时间
   */
  const handleUseCurrentTime = useCallback(() => {
    setDivinationDate(dayjs());
    setHour(new Date().getHours());
    setMinute(new Date().getMinutes());
    message.success('已设置为当前时间');
  }, []);

  /**
   * 更新单个爻值
   */
  const handleYaoChange = useCallback((index: number, value: YaoValue) => {
    setYaoValues(prev => {
      const newValues = [...prev];
      newValues[index] = value;
      return newValues;
    });
  }, []);

  /**
   * 电脑摇卦：模拟一次摇卦（带铜板动画）
   * 三枚铜板：字面(heads)=3分，背面(tails)=2分
   * 总分：6=老阴(三个字)，7=少阳(一个背)，8=少阴(二个背)，9=老阳(三个背)
   */
  const handleComputerShake = useCallback(() => {
    if (computerShakeCount >= 6) {
      message.info('已完成6次摇卦');
      return;
    }
    setIsShakingComputer(true);

    // 第一阶段：铜板摇动动画
    setCoinStates(['shaking', 'shaking', 'shaking']);

    // 第二阶段：逐个铜板落定（间隔200ms）
    const coinResults: Array<'heads' | 'tails'> = [];

    // 随机生成三个铜板结果
    for (let i = 0; i < 3; i++) {
      coinResults.push(Math.random() < 0.5 ? 'heads' : 'tails');
    }

    // 第一个铜板落定
    setTimeout(() => {
      setCoinStates([coinResults[0], 'shaking', 'shaking']);
    }, 400);

    // 第二个铜板落定
    setTimeout(() => {
      setCoinStates([coinResults[0], coinResults[1], 'shaking']);
    }, 700);

    // 第三个铜板落定
    setTimeout(() => {
      setCoinStates([coinResults[0], coinResults[1], coinResults[2]]);

      // 计算爻值：字面(heads)=3分，背面(tails)=2分
      const score = coinResults.reduce((sum, coin) => sum + (coin === 'heads' ? 3 : 2), 0);

      // 根据总分确定爻类型
      let yaoType: YaoValue;
      if (score === 6) {
        yaoType = 'laoyin';  // 6分 = 三个字 = 老阴
      } else if (score === 7) {
        yaoType = 'shaoyang'; // 7分 = 两字一背 = 少阳
      } else if (score === 8) {
        yaoType = 'shaoyin';  // 8分 = 一字两背 = 少阴
      } else {
        yaoType = 'laoyang';  // 9分 = 三个背 = 老阳
      }

      // 更新爻值
      setYaoValues(prev => {
        const newValues = [...prev];
        newValues[computerShakeCount] = yaoType;
        return newValues;
      });

      // 记录摇卦历史
      setShakeHistory(prev => [...prev, { coins: coinResults, yaoType }]);

      // 更新计数器
      setComputerShakeCount(prev => prev + 1);
      setIsShakingComputer(false);
    }, 1000);
  }, [computerShakeCount]);

  /**
   * 电脑摇卦：停止
   */
  const handleComputerStop = useCallback(() => {
    setIsShakingComputer(false);
  }, []);

  /**
   * 电脑摇卦：重来（重置铜板和摇卦状态）
   */
  const handleComputerReset = useCallback(() => {
    setYaoValues(['', '', '', '', '', '']);
    setComputerShakeCount(0);
    setIsShakingComputer(false);
    setCoinStates(['pending', 'pending', 'pending']);
    setShakeHistory([]);
  }, []);

  /**
   * 更新动爻选择
   */
  const handleMovingYaoChange = useCallback((index: number, checked: boolean) => {
    setMovingYaos(prev => {
      const newValues = [...prev];
      newValues[index] = checked;
      return newValues;
    });
  }, []);

  /**
   * 链端随机起卦
   */
  const handleRandomDivine = useCallback(async () => {
    setShaking(true);
    try {
      const guaId = await liuyaoService.divineRandom();
      setChainGuaId(guaId);
      setCompleted(true);
      message.success(`起卦成功！卦象ID: ${guaId}`);

      // 等待2秒，让区块链数据确认
      console.log('[LiuyaoPage] 等待区块链数据确认...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error('[LiuyaoPage] 随机起卦失败:', error);
      message.error(`起卦失败: ${error.message || '请检查钱包连接'}`);
    } finally {
      setShaking(false);
    }
  }, []);

  /**
   * 时间起卦
   */
  const handleTimeMethodDivine = useCallback(async () => {
    setShaking(true);
    try {
      // 获取年月日时信息
      const year = divinationDate.year();
      const month = divinationDate.month() + 1;
      const day = divinationDate.date();

      // 获取干支信息
      const ganZhi = getGanZhiFromDate(divinationDate.toDate());

      // 转换为地支数字（0-11）
      const yearZhi = ganZhi.year[1]; // 年支
      const monthNum = month; // 月数
      const dayNum = day; // 日数
      const hourZhi = Math.floor(((hour + 1) % 24) / 2); // 时支

      // 调用链端时间起卦
      const guaId = await liuyaoService.divineByTime(
        yearZhi,
        monthNum,
        dayNum,
        hourZhi,
        ganZhi.year,
        ganZhi.month,
        ganZhi.day,
        [ganZhi.hour[0], hourZhi]
      );

      setChainGuaId(guaId);
      setCompleted(true);
      message.success(`时间起卦成功！卦象ID: ${guaId}`);

      // 等待2秒，让区块链数据确认
      console.log('[LiuyaoPage] 等待区块链数据确认...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error('[LiuyaoPage] 时间起卦失败:', error);
      message.error(`时间起卦失败: ${error.message || '请检查钱包连接'}`);
    } finally {
      setShaking(false);
    }
  }, [divinationDate, hour]);

  /**
   * 执行起卦
   */
  const handleDivine = useCallback(async () => {
    if (divinationMethod === 'time') {
      await handleTimeMethodDivine();
    } else {
      await handleRandomDivine();
    }
  }, [divinationMethod, handleTimeMethodDivine, handleRandomDivine]);

  /**
   * 重新开始
   */
  const handleReset = useCallback(() => {
    setCompleted(false);
    setChainGuaId(null);
    setName('求测者');
    setGender(Gender.Male);
    setBirthYear(1980);
    setQuestion('');
    setDateType('solar');
    setDivinationDate(dayjs());
    setHour(new Date().getHours());
    setMinute(new Date().getMinutes());
    setDivinationMethod('auto');
    // 重置手工/电脑起卦状态
    setYaoValues(['', '', '', '', '', '']);
    setComputerShakeCount(0);
    setIsShakingComputer(false);
    // 重置铜板状态
    setCoinStates(['pending', 'pending', 'pending']);
    setShakeHistory([]);
    // 重置数字起卦状态
    setNumberInput('');
    setAddShichen(false);
    // 重置时间起卦状态
    setTimeMethodType('shijian');
    setNumberMethodType('bujia');
    setZhiMethodType('tiangan');
    setTimeNumber('');
    // 重置其它起卦状态
    setUpperGua(1);
    setLowerGua(1);
    setMovingYaos([false, false, false, false, false, false]);
  }, []);

  /**
   * 查看详情
   */
  const handleViewDetail = useCallback(() => {
    if (chainGuaId) {
      window.location.hash = `#/liuyao/${chainGuaId}`;
    }
  }, [chainGuaId]);

  /**
   * 渲染说明弹窗
   */
  const renderInstructionsModal = () => (
    <Modal
      title={
        <span style={{ fontSize: 18, fontWeight: 600 }}>
          <QuestionCircleOutlined style={{ marginRight: 8, color: '#B2955D' }} />
          六爻占卜 · 说明
        </span>
      }
      open={showInstructions}
      onCancel={() => setShowInstructions(false)}
      footer={null}
      width={460}
      style={{ top: 20 }}
    >
      <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '8px 0' }}>
        {/* 温馨提示 */}
        <Title level={5} style={{ color: '#B2955D', marginTop: 16 }}>温馨提示</Title>
        <Paragraph>
          起卦结果将上链保存，可永久查询。起卦需要支付少量 Gas 费用。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 六爻占卜基础 */}
        <Title level={5} style={{ color: '#B2955D' }}>六爻占卜基础</Title>
        <Paragraph>
          <Text strong>六爻</Text>是中国传统占卜方法之一，通过六次掷筮得到六个爻，组成一个卦象。六爻占卜以《周易》为理论基础，通过分析卦象的五行生克、用神旺衰、动爻变化等，来推断事物的吉凶祸福。
        </Paragraph>
        <Paragraph>
          六爻占卜特别擅长预测具体事件的结果和应期，在事业、财运、感情、健康等方面都有广泛应用。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 起卦方式说明 */}
        <Title level={5} style={{ color: '#B2955D' }}>起卦方式</Title>

        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>• 自动起卦：</Text>
          使用链上随机数生成卦象，简单快速
        </Paragraph>
        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>• 时间起卦：</Text>
          根据指定的年月日时信息起卦
        </Paragraph>
        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>• 手工起卦：</Text>
          手动输入六爻数据
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 区块链优势 */}
        <Title level={5} style={{ color: '#B2955D' }}>区块链优势</Title>
        <Paragraph>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>
              <Text strong>链上存储：</Text>所有卦象数据上链保存，永不丢失
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>可追溯性：</Text>随时可查询历史记录
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>真随机性：</Text>链上随机数算法保证起卦的公平性
            </li>
          </ul>
        </Paragraph>
      </div>
    </Modal>
  );

  /**
   * 渲染输入表单
   */
  const renderInputForm = () => (
    <Card className="divination-card input-card" style={{ margin: '12px', borderRadius: '8px', width: 'calc(100% + 10px)', marginLeft: '-5px' }}>
      {/* 命主姓名 + 性别 */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 65, textAlign: 'right', paddingRight: 8 }}>
          命主姓名：
        </div>
        <div className="form-content" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="求测者"
            style={{ width: 80 }}
          />
          <Radio.Group
            value={gender}
            onChange={(e: RadioChangeEvent) => setGender(e.target.value)}
          >
            <Radio value={Gender.Male}>男</Radio>
            <Radio value={Gender.Female}>女</Radio>
          </Radio.Group>
        </div>
      </div>

      {/* 出生年份 */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 65, textAlign: 'right', paddingRight: 8 }}>
          出生年份：
        </div>
        <div className="form-content" style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <Select
            value={birthYear}
            onChange={setBirthYear}
            style={{ width: 90 }}
            options={Array.from({ length: 100 }, (_, i) => ({
              value: 1950 + i,
              label: `${1950 + i}`
            }))}
          />
        </div>
      </div>

      {/* 占问事宜 */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 65, textAlign: 'right', paddingRight: 8 }}>
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
        <div className="form-label" style={{ width: 65, textAlign: 'right', paddingRight: 8 }}>
          日期类型：
        </div>
        <div className="form-content" style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <Radio.Group
            value={dateType}
            onChange={(e: RadioChangeEvent) => setDateType(e.target.value)}
          >
            <Radio value="solar">公历</Radio>
            <Radio value="lunar">农历</Radio>
          </Radio.Group>
        </div>
      </div>

      {/* 起卦日期 */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 65, textAlign: 'right', paddingRight: 8 }}>
          起卦日期：
        </div>
        <div className="form-content" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Select
            value={divinationDate.year()}
            onChange={(v) => setDivinationDate(divinationDate.year(v))}
            style={{ width: 80 }}
            options={Array.from({ length: 50 }, (_, i) => ({
              value: 2000 + i,
              label: `${2000 + i}`
            }))}
          />
          <span>年</span>
          <Select
            value={divinationDate.month() + 1}
            onChange={(v) => setDivinationDate(divinationDate.month(v - 1))}
            style={{ width: 60 }}
            options={Array.from({ length: 12 }, (_, i) => ({
              value: i + 1,
              label: `${i + 1}`
            }))}
          />
          <span>月</span>
          <Select
            value={divinationDate.date()}
            onChange={(v) => setDivinationDate(divinationDate.date(v))}
            style={{ width: 60 }}
            options={Array.from({ length: 31 }, (_, i) => ({
              value: i + 1,
              label: `${i + 1}`
            }))}
          />
          <span>日</span>
        </div>
      </div>

      {/* 起卦时辰 */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 65, textAlign: 'right', paddingRight: 8 }}>
          起卦时辰：
        </div>
        <div className="form-content" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Select
            value={hour}
            onChange={setHour}
            style={{ width: 78 }}
            options={SHICHEN_OPTIONS}
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
            onClick={handleUseCurrentTime}
            style={{ marginLeft: 8, fontSize: 12 }}
          >
            用当前时间起卦
          </Button>
        </div>
      </div>

      {/* 起卦方式 */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 65, textAlign: 'right', paddingRight: 8 }}>
          起卦方式：
        </div>
        <div className="form-content" style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <Radio.Group
            value={divinationMethod}
            onChange={(e: RadioChangeEvent) => setDivinationMethod(e.target.value)}
          >
            <Radio value="auto">自动</Radio>
            <Radio value="manual">手工</Radio>
            <Radio value="computer">电脑</Radio>
            <Radio value="number">数字</Radio>
            <Radio value="time">时间</Radio>
            <Radio value="other">其它</Radio>
          </Radio.Group>
        </div>
      </div>

      {/* ==================== 动态起卦方式UI ==================== */}

      {/* 手工起卦：六爻下拉选择（两列布局） */}
      {divinationMethod === 'manual' && (
        <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#fafafa', borderRadius: 8 }}>
          <div style={{ marginBottom: 8, color: '#8B6914', fontSize: 13 }}>请选择各爻（从初爻到上爻）：</div>
          {/* 两列布局：初爻/二爻、三爻/四爻、五爻/上爻 */}
          {[[0, 1], [2, 3], [4, 5]].map((pair, rowIdx) => (
            <div key={rowIdx} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              {pair.map((index) => (
                <div key={index} className="form-row" style={{ flex: 1 }}>
                  <div style={{ width: 35, textAlign: 'right', paddingRight: 4, color: '#666', fontSize: 13 }}>
                    {['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][index]}：
                  </div>
                  <Select
                    value={yaoValues[index] || undefined}
                    onChange={(value) => handleYaoChange(index, value as YaoValue)}
                    placeholder="请选择"
                    style={{ flex: 1 }}
                    options={YAO_VALUE_OPTIONS}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 电脑起卦：铜板摇卦 + 六爻下拉 */}
      {divinationMethod === 'computer' && (
        <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#fafafa', borderRadius: 8 }}>
          <div style={{ marginBottom: 8, color: '#8B6914', fontSize: 13 }}>电脑模拟摇卦（已摇 {computerShakeCount}/6 次）：</div>

          {/* 三个铜板显示区域 */}
          <div className="coin-container">
            {[0, 1, 2].map((idx) => {
              const state = coinStates[idx];
              const isShaking = state === 'shaking';
              const coinClass = isShaking ? 'pending shaking' : state;
              return (
                <div
                  key={idx}
                  className={`coin ${coinClass}`}
                >
                  <span className="coin-text">
                    {state === 'pending' || state === 'shaking' ? '?' : (state === 'heads' ? '字' : '背')}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 当前摇卦结果提示 */}
          {computerShakeCount > 0 && shakeHistory.length > 0 && (
            <div className="coin-result">
              <span className="coin-result-text">
                第{shakeHistory.length}次结果：
                {shakeHistory[shakeHistory.length - 1].coins.map(c => c === 'heads' ? '字' : '背').join(' ')}
              </span>
              <span className="coin-result-yao">
                →{' '}
                {shakeHistory[shakeHistory.length - 1].yaoType === 'shaoyang' && '少阳（一背）'}
                {shakeHistory[shakeHistory.length - 1].yaoType === 'shaoyin' && '少阴（二背）'}
                {shakeHistory[shakeHistory.length - 1].yaoType === 'laoyang' && '老阳（三背）'}
                {shakeHistory[shakeHistory.length - 1].yaoType === 'laoyin' && '老阴（三字）'}
              </span>
            </div>
          )}

          {/* 摇卦历史记录 */}
          {shakeHistory.length > 0 && (
            <div className="shake-history">
              {shakeHistory.map((record, idx) => (
                <div key={idx} className="shake-history-item">
                  <span className="yao-name">{['初', '二', '三', '四', '五', '上'][idx]}爻:</span>
                  <div className="mini-coins">
                    {record.coins.map((coin, cIdx) => (
                      <span key={cIdx} className={`mini-coin ${coin}`}>
                        {coin === 'heads' ? '字' : '背'}
                      </span>
                    ))}
                  </div>
                  <span className="yao-result">
                    {record.yaoType === 'shaoyang' && '少阳'}
                    {record.yaoType === 'shaoyin' && '少阴'}
                    {record.yaoType === 'laoyang' && '老阳'}
                    {record.yaoType === 'laoyin' && '老阴'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 六爻下拉选择（两列布局） */}
          {[[0, 1], [2, 3], [4, 5]].map((pair, rowIdx) => (
            <div key={rowIdx} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              {pair.map((index) => (
                <div key={index} className="form-row" style={{ flex: 1 }}>
                  <div style={{ width: 35, textAlign: 'right', paddingRight: 4, color: '#666', fontSize: 13 }}>
                    {['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][index]}：
                  </div>
                  <Select
                    value={yaoValues[index] || undefined}
                    onChange={(value) => handleYaoChange(index, value as YaoValue)}
                    placeholder={index < computerShakeCount ? '已摇出' : '待摇'}
                    style={{ flex: 1 }}
                    options={YAO_VALUE_OPTIONS}
                    disabled={index >= computerShakeCount}
                  />
                </div>
              ))}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button
              type="primary"
              onClick={handleComputerShake}
              loading={isShakingComputer}
              disabled={computerShakeCount >= 6}
              style={{ flex: 1, background: '#E8A849', borderColor: '#E8A849' }}
            >
              {computerShakeCount === 0 ? '开始摇卦' : `第${computerShakeCount + 1}次摇`}
            </Button>
            <Button onClick={handleComputerStop} disabled={!isShakingComputer}>
              停止
            </Button>
            <Button onClick={handleComputerReset}>
              重来
            </Button>
          </div>
        </div>
      )}

      {/* 数字起卦：输入框 + 复选框 */}
      {divinationMethod === 'number' && (
        <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#fafafa', borderRadius: 8 }}>
          <div style={{ marginBottom: 8, color: '#8B6914', fontSize: 13 }}>请输入数字（任意数字组合）：</div>
          <div className="form-row" style={{ marginBottom: 8 }}>
            <Input
              value={numberInput}
              onChange={(e) => setNumberInput(e.target.value)}
              placeholder="请输入数字"
              style={{ flex: 1 }}
            />
          </div>
          <Checkbox
            checked={addShichen}
            onChange={(e: CheckboxChangeEvent) => setAddShichen(e.target.checked)}
          >
            动爻加时辰
          </Checkbox>
        </div>
      )}

      {/* 时间起卦：复杂选项 */}
      {divinationMethod === 'time' && (
        <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#fafafa', borderRadius: 8 }}>
          <div style={{ marginBottom: 8, color: '#8B6914', fontSize: 13 }}>时间起卦选项：</div>

          {/* 时间起卦/终身卦 */}
          <div className="form-row" style={{ marginBottom: 8 }}>
            <div style={{ width: 80, textAlign: 'right', paddingRight: 8, color: '#666', fontSize: 13 }}>
              起卦类型：
            </div>
            <Select
              value={timeMethodType}
              onChange={setTimeMethodType}
              style={{ flex: 1 }}
              options={[
                { value: 'shijian', label: '时间起卦' },
                { value: 'zhongshen', label: '终身卦' },
              ]}
            />
          </div>

          {/* 不加数起时间卦/加数字起时间卦 */}
          <div className="form-row" style={{ marginBottom: 8 }}>
            <div style={{ width: 80, textAlign: 'right', paddingRight: 8, color: '#666', fontSize: 13 }}>
              数字方式：
            </div>
            <Select
              value={numberMethodType}
              onChange={setNumberMethodType}
              style={{ flex: 1 }}
              options={[
                { value: 'bujia', label: '不加数起时间卦' },
                { value: 'jiashu', label: '加数字起时间卦' },
              ]}
            />
          </div>

          {/* 加数字时显示输入框 */}
          {numberMethodType === 'jiashu' && (
            <div className="form-row" style={{ marginBottom: 8 }}>
              <div style={{ width: 80, textAlign: 'right', paddingRight: 8, color: '#666', fontSize: 13 }}>
                输入数字：
              </div>
              <Input
                value={timeNumber}
                onChange={(e) => setTimeNumber(e.target.value)}
                placeholder="请输入数字"
                style={{ flex: 1 }}
              />
            </div>
          )}

          {/* 以天干起终身卦/以地支起终身卦 */}
          {timeMethodType === 'zhongshen' && (
            <div className="form-row" style={{ marginBottom: 8 }}>
              <div style={{ width: 80, textAlign: 'right', paddingRight: 8, color: '#666', fontSize: 13 }}>
                干支方式：
              </div>
              <Select
                value={zhiMethodType}
                onChange={setZhiMethodType}
                style={{ flex: 1 }}
                options={[
                  { value: 'tiangan', label: '以天干起终身卦' },
                  { value: 'dizhi', label: '以地支起终身卦' },
                ]}
              />
            </div>
          )}
        </div>
      )}

      {/* 其它起卦：上卦/下卦 + 动爻选择 */}
      {divinationMethod === 'other' && (
        <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#fafafa', borderRadius: 8 }}>
          <div style={{ marginBottom: 8, color: '#8B6914', fontSize: 13 }}>直接指定卦象：</div>

          {/* 上卦 */}
          <div className="form-row" style={{ marginBottom: 8 }}>
            <div style={{ width: 45, textAlign: 'right', paddingRight: 8, color: '#666', fontSize: 13 }}>
              上卦：
            </div>
            <Select
              value={upperGua}
              onChange={setUpperGua}
              style={{ flex: 1 }}
              options={BA_GUA_OPTIONS}
            />
          </div>

          {/* 下卦 */}
          <div className="form-row" style={{ marginBottom: 8 }}>
            <div style={{ width: 45, textAlign: 'right', paddingRight: 8, color: '#666', fontSize: 13 }}>
              下卦：
            </div>
            <Select
              value={lowerGua}
              onChange={setLowerGua}
              style={{ flex: 1 }}
              options={BA_GUA_OPTIONS}
            />
          </div>

          {/* 动爻选择 */}
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>动爻选择（可多选）：</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['上爻', '五爻', '四爻', '三爻', '二爻', '初爻'].map((label, index) => (
                <Checkbox
                  key={index}
                  checked={movingYaos[5 - index]}
                  onChange={(e: CheckboxChangeEvent) => handleMovingYaoChange(5 - index, e.target.checked)}
                >
                  {label}
                </Checkbox>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 排盘按钮 */}
      <div style={{ marginTop: 24 }}>
        <Button
          type="primary"
          size="large"
          onClick={handleDivine}
          loading={shaking}
          block
          style={{
            background: '#E8A849',
            border: 'none',
            height: 48,
            fontSize: 16,
            fontWeight: 500,
            borderRadius: 8,
            color: '#FFFFFF'
          }}
        >
          六爻排盘
        </Button>
      </div>
    </Card>
  );

  /**
   * 渲染起卦完成
   */
  const renderCompleted = () => (
    <Card className="input-card" style={{ margin: '12px' }}>
      <div style={{ textAlign: 'center' }}>
        <CloudOutlined style={{ fontSize: 64, color: '#B2955D', marginBottom: 16 }} />
        <Title level={4}>起卦成功！</Title>
        <Paragraph type="secondary">
          您的卦象已生成，卦象 ID: <Tag color="#B2955D">{chainGuaId}</Tag>
        </Paragraph>

        <Space direction="vertical" style={{ width: '100%', marginTop: 24 }}>
          <Button
            type="primary"
            size="large"
            block
            icon={<ArrowRightOutlined />}
            onClick={handleViewDetail}
            style={{
              background: '#000000',
              borderColor: '#000000',
              borderRadius: 0,
              height: 48,
              fontSize: 16,
              fontWeight: 500,
              color: '#F7D3A1',
            }}
          >
            查看解盘结果
          </Button>
          <Button block icon={<ReloadOutlined />} onClick={handleReset} style={{ borderRadius: 0, height: 44 }}>
            重新起卦
          </Button>
        </Space>
      </div>
    </Card>
  );

  return (
    <div className="liuyao-page">
      {/* 顶部导航卡片 */}
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
        {/* 左边：我的卦象 */}
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', cursor: 'pointer' }}
          onClick={() => (window.location.hash = '#/liuyao/list')}
        >
          <HistoryOutlined style={{ fontSize: '18px', color: '#999' }} />
          <div style={{ fontSize: '10px', color: '#999' }}>我的卦象</div>
        </div>

        {/* 中间：六爻占卜 */}
        <div style={{ fontSize: '18px', color: '#333', fontWeight: '500', whiteSpace: 'nowrap' }}>六爻占卜</div>

        {/* 右边：使用说明 */}
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

      <Spin spinning={shaking}>
        {completed ? renderCompleted() : renderInputForm()}
      </Spin>

      {/* 说明弹窗 */}
      {renderInstructionsModal()}

      {/* 底部导航 */}
      <div className="bottom-nav">
        <Space split={<Divider type="vertical" />}>
          <Button type="link" onClick={() => (window.location.hash = '#/liuyao/list')}>
            <HistoryOutlined /> 我的卦象
          </Button>
          <Button type="link" onClick={() => (window.location.hash = '#/divination')}>
            <ArrowRightOutlined /> 占卜入口
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default LiuyaoPage;
