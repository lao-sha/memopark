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
} from 'antd';
import {
  FieldTimeOutlined,
  HistoryOutlined,
  ReloadOutlined,
  NumberOutlined,
  ThunderboltOutlined,
  EditOutlined,
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
  type SanGong,
  type XiaoLiuRenPan,
  getShiChenFromHour,
  calculateTiYongRelation,
  getBaGuaFromSanGong,
  calculateFortuneLevel,
  formatSanGong,
} from '../../types/xiaoliuren';

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
        <Tag>{wuXing}</Tag>
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

  /**
   * 起课
   */
  const handleCalculate = useCallback(async () => {
    setLoading(true);
    try {
      // 模拟API延迟
      await new Promise(resolve => setTimeout(resolve, 300));

      let param1: number, param2: number, param3: number;

      switch (method) {
        case DivinationMethod.TimeMethod:
        case DivinationMethod.TimeKeMethod:
          if (!selectedDate) {
            message.warning('请选择日期');
            setLoading(false);
            return;
          }
          param1 = selectedDate.month() + 1; // 月份
          param2 = selectedDate.date();       // 日期
          param3 = selectedHour;              // 时辰
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
    } catch (error) {
      console.error('起课失败:', error);
      message.error('起课失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [method, selectedDate, selectedHour, numbers, manualGongs]);

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
    <Card className="input-card">
      <Title level={4} className="page-title">
        <FieldTimeOutlined /> 小六壬 · 掐指速算
      </Title>
      <Paragraph type="secondary" className="page-subtitle">
        快速占卜吉凶的简易术数
      </Paragraph>

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
      >
        起课
      </Button>
      <Button
        block
        onClick={handleReset}
        icon={<ReloadOutlined />}
        style={{ marginTop: 8 }}
      >
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
        {baGua && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>八卦对应：</Text>
            <Tag color="purple" style={{ marginLeft: 8, fontSize: 14 }}>
              {baGua}
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
    <div className="xiaoliuren-page" style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <Spin spinning={loading}>
        {renderInputForm()}
        {renderResult()}
      </Spin>

      {/* 说明卡片 */}
      <Card style={{ marginTop: 16 }}>
        <Title level={5}>小六壬说明</Title>
        <Space direction="vertical" size={8}>
          <div>
            <Text strong>六宫：</Text>
            <Text type="secondary">
              <Tag color={LIU_GONG_COLORS[LiuGong.DaAn]}>大安</Tag>
              <Tag color={LIU_GONG_COLORS[LiuGong.LiuLian]}>留连</Tag>
              <Tag color={LIU_GONG_COLORS[LiuGong.SuXi]}>速喜</Tag>
              <Tag color={LIU_GONG_COLORS[LiuGong.ChiKou]}>赤口</Tag>
              <Tag color={LIU_GONG_COLORS[LiuGong.XiaoJi]}>小吉</Tag>
              <Tag color={LIU_GONG_COLORS[LiuGong.KongWang]}>空亡</Tag>
            </Text>
          </div>
          <div>
            <Text strong>起课口诀：</Text>
            <Text type="secondary">
              "大安起正月，月上起日，日上起时"
            </Text>
          </div>
          <div>
            <Text strong>体用关系：</Text>
            <Text type="secondary">
              月宫为体（代表自己），时宫为用（代表所求之事），日宫为中介
            </Text>
          </div>
          <div>
            <Text strong>五行生克：</Text>
            <Text type="secondary">
              体生用为泄，体克用为成，用生体为得，用克体为凶，比和为平
            </Text>
          </div>
        </Space>
      </Card>

      {/* 底部导航 */}
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Button type="link" onClick={() => (window.location.hash = '#/divination')}>
          <HistoryOutlined /> 返回占卜入口
        </Button>
      </div>
    </div>
  );
};

export default XiaoLiuRenPage;
