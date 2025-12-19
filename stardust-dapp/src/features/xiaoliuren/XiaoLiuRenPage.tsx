/**
 * 小六壬排盘页面
 *
 * 功能：
 * - 支持多种起课方式（时间起课、时刻起课、数字起课、随机起课、手动选择）
 * - 显示三宫（月宫、日宫、时宫）结果
 * - 体用关系分析
 * - 八卦转换与断语
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
  DatePicker,
  Radio,
  Spin,
  InputNumber,
  Collapse,
  Switch,
  Modal,
} from 'antd';
import {
  FieldTimeOutlined,
  HistoryOutlined,
  ReloadOutlined,
  NumberOutlined,
  ThunderboltOutlined,
  EditOutlined,
  CloudOutlined,
  DesktopOutlined,
  QuestionCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

import {
  LiuGong,
  DivinationMethod,
  TiYongRelation,
  LIU_GONG_NAMES,
  LIU_GONG_COLORS,
  LIU_GONG_JI_XIONG,
  LIU_GONG_WU_XING,
  LIU_GONG_BRIEFS,
  LIU_GONG_GUA_CI,
  LIU_GONG_AFFAIR_READINGS,
  DIVINATION_METHOD_NAMES,
  TI_YONG_RELATION_NAMES,
  TI_YONG_RELATION_COLORS,
  TI_YONG_DESCRIPTIONS,
  WU_XING_NAMES,
  BA_GUA_NAMES,
  type SanGong,
  type XiaoLiuRenPan,
  getShiChenFromHour,
  calculateTiYongRelation,
  getBaGuaFromSanGong,
  calculateFortuneLevel,
  formatSanGong,
} from '../../types/xiaoliuren';
import * as xiaoliurenService from '../../services/xiaoliurenService';
import './XiaoLiuRenPage.css';

const { Title, Text, Paragraph } = Typography;

/**
 * 时辰选项
 */
const HOUR_OPTIONS = [
  { label: '子时', value: 0, range: '23:00-01:00' },
  { label: '丑时', value: 1, range: '01:00-03:00' },
  { label: '寅时', value: 2, range: '03:00-05:00' },
  { label: '卯时', value: 3, range: '05:00-07:00' },
  { label: '辰时', value: 4, range: '07:00-09:00' },
  { label: '巳时', value: 5, range: '09:00-11:00' },
  { label: '午时', value: 6, range: '11:00-13:00' },
  { label: '未时', value: 7, range: '13:00-15:00' },
  { label: '申时', value: 8, range: '15:00-17:00' },
  { label: '酉时', value: 9, range: '17:00-19:00' },
  { label: '戌时', value: 10, range: '19:00-21:00' },
  { label: '亥时', value: 11, range: '21:00-23:00' },
];

/**
 * 六宫选项
 */
const LIU_GONG_OPTIONS = [
  { value: LiuGong.DaAn, label: '大安' },
  { value: LiuGong.LiuLian, label: '留连' },
  { value: LiuGong.SuXi, label: '速喜' },
  { value: LiuGong.ChiKou, label: '赤口' },
  { value: LiuGong.XiaoJi, label: '小吉' },
  { value: LiuGong.KongWang, label: '空亡' },
];

/**
 * 模拟小六壬排盘算法
 *
 * @param method 起课方式
 * @param param1 参数1（月/数字1）
 * @param param2 参数2（日/数字2）
 * @param param3 参数3（时辰/数字3）
 * @returns 小六壬盘
 */
function generateXiaoLiuRenPan(
  method: DivinationMethod,
  param1: number,
  param2: number,
  param3: number
): XiaoLiuRenPan {
  let yueGong: LiuGong;
  let riGong: LiuGong;
  let shiGong: LiuGong;

  switch (method) {
    case DivinationMethod.TimeMethod:
    case DivinationMethod.TimeKeMethod:
      // 时间起课：从大安起正月，顺数至所占月份得月宫
      // 从月宫起初一，顺数至所占日期得日宫
      // 从日宫起子时，顺数至所占时辰得时宫
      yueGong = ((param1 - 1) % 6) as LiuGong;
      riGong = ((yueGong + param2 - 1) % 6) as LiuGong;
      shiGong = ((riGong + param3) % 6) as LiuGong;
      break;
    case DivinationMethod.NumberMethod:
      // 数字起课：三个数字分别对应三宫
      yueGong = ((param1 - 1) % 6) as LiuGong;
      riGong = ((param2 - 1) % 6) as LiuGong;
      shiGong = ((param3 - 1) % 6) as LiuGong;
      break;
    case DivinationMethod.RandomMethod:
      // 随机起课
      yueGong = Math.floor(Math.random() * 6) as LiuGong;
      riGong = Math.floor(Math.random() * 6) as LiuGong;
      shiGong = Math.floor(Math.random() * 6) as LiuGong;
      break;
    case DivinationMethod.ManualMethod:
      // 手动选择
      yueGong = param1 as LiuGong;
      riGong = param2 as LiuGong;
      shiGong = param3 as LiuGong;
      break;
    default:
      yueGong = LiuGong.DaAn;
      riGong = LiuGong.DaAn;
      shiGong = LiuGong.DaAn;
  }

  const sanGong: SanGong = { yueGong, riGong, shiGong };

  return {
    id: Date.now(),
    creator: '',
    method,
    param1,
    param2,
    param3,
    sanGong,
    createdAt: Date.now(),
    isPublic: false,
  };
}

/**
 * 单宫显示组件
 */
const GongCard: React.FC<{
  gong: LiuGong;
  position: '月宫' | '日宫' | '时宫';
  isTi?: boolean;
}> = ({ gong, position, isTi }) => {
  const jiXiong = LIU_GONG_JI_XIONG[gong];
  const wuXing = LIU_GONG_WU_XING[gong];

  return (
    <Card
      size="small"
      style={{
        textAlign: 'center',
        backgroundColor: isTi ? '#f6ffed' : '#fff',
        borderColor: isTi ? '#52c41a' : '#d9d9d9',
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {position}
          {isTi && <Tag color="green" style={{ marginLeft: 4, fontSize: 10 }}>体</Tag>}
          {!isTi && position === '时宫' && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>用</Tag>}
        </Text>
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 'bold',
          color: LIU_GONG_COLORS[gong],
          marginBottom: 8,
        }}
      >
        {LIU_GONG_NAMES[gong]}
      </div>
      <Space size={4}>
        <Tag color={jiXiong > 0 ? 'green' : jiXiong < 0 ? 'red' : 'default'}>
          {jiXiong > 0 ? '吉' : jiXiong < 0 ? '凶' : '平'}
        </Tag>
        <Tag>{WU_XING_NAMES[wuXing]}</Tag>
      </Space>
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {LIU_GONG_BRIEFS[gong]}
        </Text>
      </div>
    </Card>
  );
};

/**
 * 小六壬排盘页面
 */
const XiaoLiuRenPage: React.FC = () => {
  // 状态
  const [method, setMethod] = useState<DivinationMethod>(DivinationMethod.TimeMethod);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [selectedHour, setSelectedHour] = useState<number>(0);
  const [numbers, setNumbers] = useState<[number, number, number]>([1, 1, 1]);
  const [manualGongs, setManualGongs] = useState<[LiuGong, LiuGong, LiuGong]>([
    LiuGong.DaAn,
    LiuGong.DaAn,
    LiuGong.DaAn,
  ]);
  const [loading, setLoading] = useState(false);
  const [pan, setPan] = useState<XiaoLiuRenPan | null>(null);
  const [useChain, setUseChain] = useState(false); // 是否使用链端

  // 说明弹窗状态
  const [showInstructions, setShowInstructions] = useState(false);

  /**
   * 本地起课（模拟算法）
   */
  const handleLocalCalculate = useCallback(async () => {
    let param1: number, param2: number, param3: number;

    switch (method) {
      case DivinationMethod.TimeMethod:
      case DivinationMethod.TimeKeMethod:
        if (!selectedDate) {
          message.warning('请选择日期');
          return;
        }
        param1 = selectedDate.month() + 1;
        param2 = selectedDate.date();
        param3 = selectedHour;
        break;
      case DivinationMethod.NumberMethod:
        param1 = numbers[0];
        param2 = numbers[1];
        param3 = numbers[2];
        break;
      case DivinationMethod.RandomMethod:
        param1 = 0;
        param2 = 0;
        param3 = 0;
        break;
      case DivinationMethod.ManualMethod:
        param1 = manualGongs[0];
        param2 = manualGongs[1];
        param3 = manualGongs[2];
        break;
      default:
        param1 = 1;
        param2 = 1;
        param3 = 0;
    }

    const result = generateXiaoLiuRenPan(method, param1, param2, param3);
    setPan(result);
    message.success('起课完成');
  }, [method, selectedDate, selectedHour, numbers, manualGongs]);

  /**
   * 链端起课
   */
  const handleChainCalculate = useCallback(async () => {
    try {
      let panId: number;

      switch (method) {
        case DivinationMethod.TimeMethod:
        case DivinationMethod.TimeKeMethod:
          if (!selectedDate) {
            message.warning('请选择日期');
            return;
          }
          // 调用链端时间起课
          panId = await xiaoliurenService.divineByTime(
            selectedDate.month() + 1, // 农历月份
            selectedDate.date(),       // 农历日期
            selectedHour * 2,          // 转换为24小时制的近似值
            undefined,
            false
          );
          break;
        case DivinationMethod.NumberMethod:
          // 调用链端数字起课
          panId = await xiaoliurenService.divineByNumber(
            numbers[0],
            numbers[1],
            numbers[2],
            undefined,
            false
          );
          break;
        case DivinationMethod.RandomMethod:
          // 调用链端随机起课
          panId = await xiaoliurenService.divineRandom(undefined, false);
          break;
        case DivinationMethod.ManualMethod:
          // 调用链端手动起课
          panId = await xiaoliurenService.divineManual(
            manualGongs[0],
            manualGongs[1],
            manualGongs[2],
            undefined,
            false
          );
          break;
        default:
          throw new Error('未知起课方式');
      }

      // 查询课盘详情
      const panData = await xiaoliurenService.getPan(panId);
      if (panData) {
        setPan(panData);
        message.success(`链端起课成功，课盘ID: ${panId}`);
      } else {
        throw new Error('课盘数据获取失败');
      }
    } catch (error: any) {
      console.error('链端起课失败:', error);
      message.error(`链端起课失败: ${error.message || '请检查钱包连接'}`);
    }
  }, [method, selectedDate, selectedHour, numbers, manualGongs]);

  /**
   * 起课（根据模式选择本地或链端）
   */
  const handleCalculate = useCallback(async () => {
    setLoading(true);
    try {
      if (useChain) {
        await handleChainCalculate();
      } else {
        await handleLocalCalculate();
      }
    } catch (error) {
      console.error('起课失败:', error);
      message.error('起课失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [useChain, handleChainCalculate, handleLocalCalculate]);

  /**
   * 重置
   */
  const handleReset = useCallback(() => {
    setSelectedDate(null);
    setSelectedHour(0);
    setNumbers([1, 1, 1]);
    setManualGongs([LiuGong.DaAn, LiuGong.DaAn, LiuGong.DaAn]);
    setPan(null);
  }, []);

  /**
   * 渲染说明弹窗
   */
  const renderInstructionsModal = () => (
    <Modal
      title={
        <span style={{ fontSize: 18, fontWeight: 600 }}>
          <QuestionCircleOutlined style={{ marginRight: 8, color: '#B2955D' }} />
          小六壬 · 起课说明
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
          起课结果将上链保存，可永久查询。起课需要支付少量 Gas 费用。本地起课可快速预览结果。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 小六壬基础 */}
        <Title level={5} style={{ color: '#B2955D' }}>小六壬基础</Title>
        <Paragraph>
          <Text strong>小六壬</Text>是中国传统占卜术数之一，又称"诸葛马前课"，相传为诸葛亮所创。以六宫（大安、留连、速喜、赤口、小吉、空亡）掐指推算，快速占卜吉凶祸福，简单实用。
        </Paragraph>
        <Paragraph>
          小六壬通过月、日、时三宫的组合，结合五行生克和体用关系，迅速判断事物的发展趋势和吉凶走向，是民间最流行的速算占卜方法之一。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 六宫详解 */}
        <Title level={5} style={{ color: '#B2955D' }}>六宫详解</Title>
        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>• 大安（木）：</Text>安静守成，凡事大吉，不宜妄动
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 留连（土）：</Text>延滞阻隔，拖延迟缓，难以速成
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 速喜（火）：</Text>快速喜庆，有惊喜至，宜行动
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 赤口（金）：</Text>口舌是非，官司纠纷，不利之兆
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 小吉（水）：</Text>小有喜事，渐入佳境，可期待
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 空亡（土）：</Text>落空无果，希望破灭，不宜进取
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 起课方式 */}
        <Title level={5} style={{ color: '#B2955D' }}>起课方式</Title>
        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>时间起课：</Text>根据农历月日时推算，"大安起正月，月上起日，日上起时"
          <br />
          <Text strong style={{ color: '#B2955D' }}>数字起课：</Text>心中默念问题后，随口说出三个数字进行起课
          <br />
          <Text strong style={{ color: '#B2955D' }}>随机起课：</Text>使用链上随机数快速生成三宫
          <br />
          <Text strong style={{ color: '#B2955D' }}>手动起课：</Text>自行选择三宫，适合掐指推算后的结果输入
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 区块链优势 */}
        <Title level={5} style={{ color: '#B2955D' }}>区块链优势</Title>
        <Paragraph>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>
              <Text strong>链上存储：</Text>所有课盘数据上链保存，永不丢失
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>可追溯性：</Text>随时可查询历史记录，包含完整的起课信息
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>真随机性：</Text>链上随机数保证起课的公平性
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>隐私保护：</Text>可选择公开或私密，保护个人隐私
            </li>
          </ul>
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 操作提示 */}
        <Title level={5} style={{ color: '#B2955D' }}>操作提示</Title>
        <Paragraph>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>起课前请心诚意诚，专注于所问之事</li>
            <li style={{ marginBottom: 8 }}>同一问题不宜短期内重复占卜</li>
            <li style={{ marginBottom: 8 }}>链端起课需要连接钱包并支付少量 Gas 费用</li>
            <li style={{ marginBottom: 8 }}>本地起课可快速预览结果，不上链存储</li>
            <li style={{ marginBottom: 8 }}>如需专业解读，可前往"占卜服务市场"寻找大师</li>
          </ul>
        </Paragraph>
      </div>
    </Modal>
  );

  /**
   * 渲染起课方式选择
   */
  const renderMethodSelector = () => (
    <div style={{ marginBottom: 16 }}>
      <Text strong>起课方式</Text>
      <div style={{ marginTop: 8 }}>
        <Radio.Group
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          buttonStyle="solid"
          size="small"
        >
          <Radio.Button value={DivinationMethod.TimeMethod}>
            <FieldTimeOutlined /> 时间
          </Radio.Button>
          <Radio.Button value={DivinationMethod.NumberMethod}>
            <NumberOutlined /> 数字
          </Radio.Button>
          <Radio.Button value={DivinationMethod.RandomMethod}>
            <ThunderboltOutlined /> 随机
          </Radio.Button>
          <Radio.Button value={DivinationMethod.ManualMethod}>
            <EditOutlined /> 手动
          </Radio.Button>
        </Radio.Group>
      </div>
    </div>
  );

  /**
   * 渲染时间输入
   */
  const renderTimeInput = () => (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <div>
        <Text strong>选择日期</Text>
        <DatePicker
          style={{ width: '100%', marginTop: 8 }}
          placeholder="选择占测日期"
          value={selectedDate}
          onChange={setSelectedDate}
        />
      </div>
      <div>
        <Text strong>选择时辰</Text>
        <div style={{ marginTop: 8 }}>
          <Radio.Group
            value={selectedHour}
            onChange={(e) => setSelectedHour(e.target.value)}
            style={{ width: '100%' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {HOUR_OPTIONS.map((opt) => (
                <Radio.Button
                  key={opt.value}
                  value={opt.value}
                  style={{ textAlign: 'center', fontSize: 12, padding: '0 4px' }}
                >
                  {opt.label}
                </Radio.Button>
              ))}
            </div>
          </Radio.Group>
        </div>
      </div>
    </Space>
  );

  /**
   * 渲染数字输入
   */
  const renderNumberInput = () => (
    <div>
      <Text strong>输入三个数字</Text>
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <InputNumber
          min={1}
          max={99}
          value={numbers[0]}
          onChange={(v) => setNumbers([v || 1, numbers[1], numbers[2]])}
          style={{ width: '100%' }}
          placeholder="第一数"
        />
        <InputNumber
          min={1}
          max={99}
          value={numbers[1]}
          onChange={(v) => setNumbers([numbers[0], v || 1, numbers[2]])}
          style={{ width: '100%' }}
          placeholder="第二数"
        />
        <InputNumber
          min={1}
          max={99}
          value={numbers[2]}
          onChange={(v) => setNumbers([numbers[0], numbers[1], v || 1])}
          style={{ width: '100%' }}
          placeholder="第三数"
        />
      </div>
      <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
        可输入心中所想数字，或随机报数
      </Text>
    </div>
  );

  /**
   * 渲染手动选择
   */
  const renderManualInput = () => (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      {['月宫', '日宫', '时宫'].map((label, idx) => (
        <div key={label}>
          <Text strong>{label}</Text>
          <div style={{ marginTop: 4 }}>
            <Radio.Group
              value={manualGongs[idx]}
              onChange={(e) => {
                const newGongs = [...manualGongs] as [LiuGong, LiuGong, LiuGong];
                newGongs[idx] = e.target.value;
                setManualGongs(newGongs);
              }}
              size="small"
            >
              {LIU_GONG_OPTIONS.map((opt) => (
                <Radio.Button key={opt.value} value={opt.value}>
                  {opt.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>
        </div>
      ))}
    </Space>
  );

  /**
   * 渲染输入表单
   */
  const renderInputForm = () => (
    <Card className="input-card" style={{ position: 'relative' }}>
      <Title level={4} className="page-title" style={{ marginBottom: 4, textAlign: 'center' }}>
        起课
      </Title>
      <Text type="secondary" className="page-subtitle" style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}>
        快速占卜吉凶的简易术数
      </Text>

      {/* 链端/本地切换 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Switch
          checked={useChain}
          onChange={setUseChain}
          checkedChildren={<CloudOutlined />}
          unCheckedChildren={<DesktopOutlined />}
        />
        <Text type="secondary">
          {useChain ? '链端起课（结果上链存储）' : '本地起课（快速预览）'}
        </Text>
      </div>

      <Divider />

      {renderMethodSelector()}

      {(method === DivinationMethod.TimeMethod || method === DivinationMethod.TimeKeMethod) &&
        renderTimeInput()}
      {method === DivinationMethod.NumberMethod && renderNumberInput()}
      {method === DivinationMethod.RandomMethod && (
        <Text type="secondary">点击"起课"按钮随机生成三宫</Text>
      )}
      {method === DivinationMethod.ManualMethod && renderManualInput()}

      <Divider />

      <Button
        type="primary"
        size="large"
        block
        onClick={handleCalculate}
        loading={loading}
        icon={<ThunderboltOutlined />}
        style={{
          background: '#000000',
          borderColor: '#000000',
          borderRadius: '54px',
          height: '54px',
          fontSize: '19px',
          fontWeight: '700',
          color: '#F7D3A1',
        }}
      >
        起课
      </Button>
      <Button block onClick={handleReset} icon={<ReloadOutlined />} style={{ borderRadius: '27px', height: '44px', marginTop: 8 }}>
        重置
      </Button>
    </Card>
  );

  /**
   * 渲染结果
   */
  const renderResult = () => {
    if (!pan) return null;

    const { sanGong } = pan;
    const tiYongRelation = calculateTiYongRelation(sanGong);
    const baGua = getBaGuaFromSanGong(sanGong);
    const fortuneLevel = calculateFortuneLevel(sanGong);

    // 时宫为用，月宫为体
    const tiGong = sanGong.yueGong;

    return (
      <Card style={{ marginTop: 16 }}>
        <Title level={5}>
          三宫结果：{formatSanGong(sanGong)}
        </Title>
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">
            起课方式：{DIVINATION_METHOD_NAMES[pan.method]}
          </Text>
        </div>

        {/* 三宫显示 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <GongCard gong={sanGong.yueGong} position="月宫" isTi />
          <GongCard gong={sanGong.riGong} position="日宫" />
          <GongCard gong={sanGong.shiGong} position="时宫" />
        </div>

        {/* 体用分析 */}
        <div
          style={{
            padding: 12,
            backgroundColor: '#fafafa',
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <Text strong>体用关系：</Text>
          <Tag
            color={TI_YONG_RELATION_COLORS[tiYongRelation]}
            style={{ marginLeft: 8 }}
          >
            {TI_YONG_RELATION_NAMES[tiYongRelation]}
          </Tag>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {TI_YONG_DESCRIPTIONS[tiYongRelation]}
            </Text>
          </div>
        </div>

        {/* 综合评分 */}
        <div
          style={{
            padding: 12,
            backgroundColor: fortuneLevel >= 7 ? '#f6ffed' : fortuneLevel >= 4 ? '#fffbe6' : '#fff2f0',
            borderRadius: 8,
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          <Text strong>综合运势评分：</Text>
          <span
            style={{
              fontSize: 24,
              fontWeight: 'bold',
              color: fortuneLevel >= 7 ? '#52c41a' : fortuneLevel >= 4 ? '#faad14' : '#ff4d4f',
              marginLeft: 8,
            }}
          >
            {fortuneLevel}/10
          </span>
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {fortuneLevel >= 8 ? '大吉' : fortuneLevel >= 6 ? '吉' : fortuneLevel >= 4 ? '平' : fortuneLevel >= 2 ? '凶' : '大凶'}
            </Text>
          </div>
        </div>

        {/* 八卦转换 */}
        {baGua !== null && baGua !== undefined && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>八卦对应：</Text>
            <Tag color="purple" style={{ marginLeft: 8, fontSize: 14 }}>
              {BA_GUA_NAMES[baGua]}
            </Tag>
          </div>
        )}

        {/* 卦辞详解 */}
        <Collapse
          items={[
            {
              key: 'guaCi',
              label: '卦辞详解',
              children: (
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div>
                    <Text strong>月宫（{LIU_GONG_NAMES[sanGong.yueGong]}）卦辞：</Text>
                    <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 8 }}>
                      {LIU_GONG_GUA_CI[sanGong.yueGong]}
                    </Paragraph>
                  </div>
                  <div>
                    <Text strong>日宫（{LIU_GONG_NAMES[sanGong.riGong]}）卦辞：</Text>
                    <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 8 }}>
                      {LIU_GONG_GUA_CI[sanGong.riGong]}
                    </Paragraph>
                  </div>
                  <div>
                    <Text strong>时宫（{LIU_GONG_NAMES[sanGong.shiGong]}）卦辞：</Text>
                    <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 8 }}>
                      {LIU_GONG_GUA_CI[sanGong.shiGong]}
                    </Paragraph>
                  </div>
                </Space>
              ),
            },
            {
              key: 'affairs',
              label: '事项分析',
              children: (
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {/* 以时宫（用神）为主要参考 */}
                  {Object.entries(LIU_GONG_AFFAIR_READINGS[sanGong.shiGong]).map(([key, value]) => (
                    <div key={key}>
                      <Tag color="blue">{key}</Tag>
                      <Text style={{ marginLeft: 8 }}>{value}</Text>
                    </div>
                  ))}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    );
  };

  return (
    <div className="xiaoliuren-page">
      {/* 顶部导航卡片 - 复刻八字页面风格 */}
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
        {/* 左边：我的课盘 */}
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', cursor: 'pointer' }}
          onClick={() => (window.location.hash = '#/xiaoliuren/list')}
        >
          <HistoryOutlined style={{ fontSize: '18px', color: '#999' }} />
          <div style={{ fontSize: '10px', color: '#999' }}>我的课盘</div>
        </div>

        {/* 中间：小六壬 */}
        <div style={{ fontSize: '18px', color: '#333', fontWeight: '500', whiteSpace: 'nowrap' }}>小六壬</div>

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

      <Spin spinning={loading}>
        {renderInputForm()}
        {renderResult()}
      </Spin>

      {/* 说明弹窗 */}
      {renderInstructionsModal()}

      {/* 底部导航 */}
      <div className="bottom-nav">
        <Space split={<Divider type="vertical" />}>
          <Button type="link" onClick={() => (window.location.hash = '#/xiaoliuren/list')}>
            <HistoryOutlined /> 我的课盘
          </Button>
          <Button type="link" onClick={() => (window.location.hash = '#/divination')}>
            <ArrowRightOutlined /> 占卜入口
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default XiaoLiuRenPage;
