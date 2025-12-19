/**
 * 奇门遁甲排盘页面
 *
 * 功能：
 * - 输入时间起盘
 * - 显示九宫格盘面
 * - 八门、九星、八神分析
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
  Switch,
  Modal,
} from 'antd';
import {
  CompassOutlined,
  HistoryOutlined,
  ReloadOutlined,
  CalendarOutlined,
  CloudOutlined,
  DesktopOutlined,
  BookOutlined,
  QuestionCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

import {
  JiuGong,
  QiYi,
  BaMen,
  JiuXing,
  BaShen,
  JuShu,
  JIU_GONG_SHORT,
  JIU_GONG_FANGWEI,
  QI_YI_NAMES,
  BA_MEN_NAMES,
  BA_MEN_COLORS,
  BA_MEN_JI_XIONG,
  JIU_XING_NAMES,
  JIU_XING_JI_XIONG,
  BA_SHEN_NAMES,
  BA_SHEN_JI_XIONG,
  JIE_QI_NAMES,
  ShiGanGeJuType,
  SHI_GAN_GE_JU_NAMES,
  SHI_GAN_GE_JU_JI_XIONG,
  type GongWei,
  type QimenPan,
  type PalaceAnalysis,
  isYangDun,
  getJuNumber,
  analyzePalace,
  getYiMaGong,
} from '../../types/qimen';
import * as qimenService from '../../services/qimenService';
import './QimenPage.css';

const { Title, Text, Paragraph } = Typography;

/**
 * 时辰选项
 */
const HOUR_OPTIONS = [
  { label: '子时', value: 0 },
  { label: '丑时', value: 1 },
  { label: '寅时', value: 2 },
  { label: '卯时', value: 3 },
  { label: '辰时', value: 4 },
  { label: '巳时', value: 5 },
  { label: '午时', value: 6 },
  { label: '未时', value: 7 },
  { label: '申时', value: 8 },
  { label: '酉时', value: 9 },
  { label: '戌时', value: 10 },
  { label: '亥时', value: 11 },
];

/**
 * 模拟生成奇门遁甲盘（实际应调用后端算法）
 */
function generateMockQimenPan(
  year: number,
  month: number,
  day: number,
  hour: number
): QimenPan {
  // 简化的模拟数据，实际需要复杂的奇门遁甲排盘算法
  const juShu = (month % 9 + 1) as JuShu;

  // 生成九宫信息
  const gongWeis: GongWei[] = [];
  const gongOrder = [
    JiuGong.Kan, JiuGong.Kun, JiuGong.Zhen, JiuGong.Xun,
    JiuGong.Zhong, JiuGong.Qian, JiuGong.Dui, JiuGong.Gen, JiuGong.Li,
  ];

  for (let i = 0; i < 9; i++) {
    const gong = gongOrder[i];
    gongWeis.push({
      gong,
      diPanGan: ((i + 4) % 10) as QiYi,
      tianPanGan: ((i + hour) % 10) as QiYi,
      men: (i % 8) as BaMen,
      xing: (i % 9) as JiuXing,
      shen: (i % 8) as BaShen,
      isKong: i === 4, // 中宫空
      isMa: i === 2,   // 震宫为马星（简化）
    });
  }

  return {
    id: Date.now(),
    creator: '',
    juShu,
    zhiFu: JiuXing.TianXin,
    zhiShi: BaMen.Kai,
    xunShou: QiYi.Jia,
    gongWeis,
    year,
    month,
    day,
    hour,
    jieQi: JIE_QI_NAMES[(month * 2 - 2 + Math.floor(day / 16)) % 24],
    createdAt: Date.now(),
    isPublic: false,
  };
}

/**
 * 单宫显示组件
 */
const GongWeiCard: React.FC<{
  gongWei: GongWei;
  isCenter?: boolean;
  analysis?: PalaceAnalysis;
}> = ({ gongWei, isCenter, analysis }) => {
  const menJiXiong = BA_MEN_JI_XIONG[gongWei.men];
  const xingJiXiong = JIU_XING_JI_XIONG[gongWei.xing];
  const shenJiXiong = BA_SHEN_JI_XIONG[gongWei.shen];

  // 格局分析标记
  const hasJiXing = analysis?.jiXing !== undefined;
  const hasRuMu = analysis?.ruMu !== undefined;
  const hasMenPo = analysis?.menPo !== undefined;
  const hasSpecialGeJu = analysis?.keYing &&
    analysis.keYing.geJu !== ShiGanGeJuType.Other &&
    analysis.keYing.geJu !== ShiGanGeJuType.FuYin;
  const isYiMa = analysis?.isYiMa || gongWei.isMa;

  return (
    <div
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: 4,
        padding: 6,
        minHeight: 100,
        backgroundColor: isCenter ? '#f5f5f5' : '#fff',
        fontSize: 11,
        position: 'relative',
      }}
    >
      {/* 宫位标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text strong style={{ fontSize: 10 }}>
          {JIU_GONG_SHORT[gongWei.gong]}
        </Text>
        <Text type="secondary" style={{ fontSize: 9 }}>
          {JIU_GONG_FANGWEI[gongWei.gong]}
        </Text>
      </div>

      {isCenter ? (
        <div style={{ textAlign: 'center', paddingTop: 16 }}>
          <Text type="secondary">中宫</Text>
        </div>
      ) : (
        <>
          {/* 天盘/地盘干 + 十干克应 */}
          <div style={{ marginBottom: 2 }}>
            <Tag
              style={{
                fontSize: 10,
                padding: '0 2px',
                margin: 0,
                backgroundColor: hasSpecialGeJu
                  ? (analysis?.keYing?.isJi ? '#f6ffed' : '#fff2f0')
                  : undefined,
                borderColor: hasSpecialGeJu
                  ? (analysis?.keYing?.isJi ? '#52c41a' : '#ff4d4f')
                  : undefined,
              }}
            >
              {QI_YI_NAMES[gongWei.tianPanGan]}+{QI_YI_NAMES[gongWei.diPanGan]}
              {hasSpecialGeJu && analysis?.keYing && (
                <span style={{ fontSize: 8, marginLeft: 2 }}>
                  {SHI_GAN_GE_JU_NAMES[analysis.keYing.geJu].slice(0, 2)}
                </span>
              )}
            </Tag>
          </div>

          {/* 八门 + 门迫标记 */}
          <div style={{ marginBottom: 2 }}>
            <Tag
              color={BA_MEN_COLORS[gongWei.men]}
              style={{ fontSize: 10, padding: '0 2px', margin: 0 }}
            >
              {BA_MEN_NAMES[gongWei.men]}
              {menJiXiong > 0 && '吉'}
              {menJiXiong < 0 && '凶'}
              {hasMenPo && <span style={{ color: '#ff4d4f' }}>迫</span>}
            </Tag>
          </div>

          {/* 九星 */}
          <div style={{ marginBottom: 2 }}>
            <Tag
              color={xingJiXiong > 0 ? 'green' : xingJiXiong < 0 ? 'red' : 'default'}
              style={{ fontSize: 10, padding: '0 2px', margin: 0 }}
            >
              {JIU_XING_NAMES[gongWei.xing]}
            </Tag>
          </div>

          {/* 八神 */}
          <div>
            <Tag
              color={shenJiXiong > 0 ? 'blue' : shenJiXiong < 0 ? 'orange' : 'default'}
              style={{ fontSize: 10, padding: '0 2px', margin: 0 }}
            >
              {BA_SHEN_NAMES[gongWei.shen]}
            </Tag>
          </div>

          {/* 特殊标记（旬空、马星、击刑、入墓） */}
          <div style={{ marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {gongWei.isKong && <Tag color="purple" style={{ fontSize: 8, padding: '0 2px', margin: 0 }}>空</Tag>}
            {isYiMa && <Tag color="gold" style={{ fontSize: 8, padding: '0 2px', margin: 0 }}>马</Tag>}
            {hasJiXing && <Tag color="red" style={{ fontSize: 8, padding: '0 2px', margin: 0 }}>击刑</Tag>}
            {hasRuMu && <Tag color="volcano" style={{ fontSize: 8, padding: '0 2px', margin: 0 }}>入墓</Tag>}
          </div>
        </>
      )}
    </div>
  );
};

/**
 * 奇门遁甲排盘页面
 */
const QimenPage: React.FC = () => {
  // 状态
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [selectedHour, setSelectedHour] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [pan, setPan] = useState<QimenPan | null>(null);
  const [useChain, setUseChain] = useState(false); // 是否使用链端
  const [chainChartId, setChainChartId] = useState<number | null>(null);

  // 说明弹窗状态
  const [showInstructions, setShowInstructions] = useState(false);

  /**
   * 查看详细解卦
   */
  const handleViewDetail = useCallback(() => {
    if (chainChartId) {
      window.location.hash = `#/qimen/detail/${chainChartId}?questionType=Fortune`;
    } else {
      message.warning('请先使用链端起局，才能查看链上解卦结果');
    }
  }, [chainChartId]);

  /**
   * 本地排盘
   */
  const handleLocalCalculate = useCallback(async () => {
    if (!selectedDate) {
      message.warning('请选择占测日期');
      return;
    }

    const result = generateMockQimenPan(
      selectedDate.year(),
      selectedDate.month() + 1,
      selectedDate.date(),
      selectedHour
    );
    setPan(result);
    message.success('奇门盘排列完成');
  }, [selectedDate, selectedHour]);

  /**
   * 链端排盘
   */
  const handleChainCalculate = useCallback(async () => {
    try {
      const chartId = await qimenService.divineRandom(undefined, false);
      setChainChartId(chartId);
      message.success(`链端排盘成功，排盘ID: ${chartId}`);

      // 可选：加载链端排盘数据到本地显示
      // 注意：完整解卦需要跳转到详情页查看（已修复数据解析问题）
      try {
        const chartData = await qimenService.getChart(chartId);
        if (chartData) {
          // 转换链端数据为本地显示格式（简化版本，仅用于预览）
          // 注意：完整的解卦数据需要跳转到详情页查看
          console.log('链端排盘数据:', chartData);
        }
      } catch (error) {
        console.warn('加载链端排盘数据失败:', error);
        // 不影响主流程，用户仍可通过详情页查看
      }
    } catch (error: any) {
      console.error('链端排盘失败:', error);
      message.error(`链端排盘失败: ${error.message || '请检查钱包连接'}`);
    }
  }, []);

  /**
   * 排盘
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
      console.error('排盘失败:', error);
      message.error('排盘失败，请重试');
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
    setPan(null);
    setChainChartId(null);
  }, []);

  /**
   * 渲染说明弹窗
   */
  const renderInstructionsModal = () => (
    <Modal
      title={
        <span style={{ fontSize: 18, fontWeight: 600 }}>
          <QuestionCircleOutlined style={{ marginRight: 8, color: '#B2955D' }} />
          奇门遁甲 · 起局说明
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
          起局结果将上链保存，可永久查询。起局需要支付少量 Gas 费用。本地起局可快速预览盘面结构。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 奇门遁甲基础 */}
        <Title level={5} style={{ color: '#B2955D' }}>奇门遁甲基础</Title>
        <Paragraph>
          <Text strong>奇门遁甲</Text>是中国古代最高层次的预测学，号称"帝王之学"，被誉为易经最高层次的预测学。以《易经》八卦为基础，融合天文历法、阴阳五行、八卦九宫等多种学说，用于预测战争、决策、运筹、择时等。
        </Paragraph>
        <Paragraph>
          奇门遁甲将时空、天文、地理、人事完美结合，通过排盘分析天时地利人和，精确判断事物发展趋势和最佳行动时机。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 四盘结构说明 */}
        <Title level={5} style={{ color: '#B2955D' }}>四盘结构</Title>

        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>• 天盘（九星）：</Text>代表天时，包括天蓬、天任、天冲、天辅、天英、天芮、天柱、天心、天禽九星，主管吉凶祸福
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 地盘（九宫）：</Text>代表地利，分为乾、坎、艮、震、巽、离、坤、兑、中九宫，对应八卦方位
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 人盘（八门）：</Text>代表人和，包括休、生、伤、杜、景、死、惊、开八门，主管行动方向
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 神盘（八神）：</Text>辅助判断，包括值符、螣蛇、太阴、六合、白虎、玄武、九地、九天八神
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 三奇六仪 */}
        <Title level={5} style={{ color: '#B2955D' }}>三奇六仪</Title>
        <Paragraph>
          <Text strong>三奇：</Text>乙（日奇）、丙（月奇）、丁（星奇），为吉利之象，代表智慧、机遇、贵人
          <br />
          <Text strong>六仪：</Text>戊、己、庚、辛、壬、癸，为十天干中的六仪，代表不同的能量状态
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 区块链优势 */}
        <Title level={5} style={{ color: '#B2955D' }}>区块链优势</Title>
        <Paragraph>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>
              <Text strong>链上存储：</Text>所有排盘数据上链保存，永不丢失
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>可追溯性：</Text>随时可查询历史记录，包含完整的起局信息
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>智能分析：</Text>链端AI自动分析格局，提供专业解读
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
            <li style={{ marginBottom: 8 }}>起局前请心诚意诚，专注于所问之事</li>
            <li style={{ marginBottom: 8 }}>同一问题不宜短期内重复占测</li>
            <li style={{ marginBottom: 8 }}>链端起局需要连接钱包并支付少量 Gas 费用</li>
            <li style={{ marginBottom: 8 }}>本地起局可快速预览盘面结构，不上链存储</li>
            <li style={{ marginBottom: 8 }}>如需专业解读，可前往"占卜服务市场"寻找大师</li>
          </ul>
        </Paragraph>
      </div>
    </Modal>
  );

  /**
   * 渲染输入表单
   */
  const renderInputForm = () => (
    <Card className="input-card" style={{ position: 'relative' }}>
      <Title level={4} className="page-title" style={{ marginBottom: 4, textAlign: 'center' }}>
        起局
      </Title>
      <Text type="secondary" className="page-subtitle" style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}>
        帝王之学，运筹帷幄
      </Text>

      <Divider style={{ margin: '16px 0' }} />

      {/* 链端/本地切换 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Switch
          checked={useChain}
          onChange={setUseChain}
          checkedChildren={<CloudOutlined />}
          unCheckedChildren={<DesktopOutlined />}
        />
        <Text type="secondary">
          {useChain ? '链端起局（结果上链存储）' : '本地起局（快速预览）'}
        </Text>
      </div>

      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 占测日期 */}
        <div style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: 8 }}>
          <Text strong><CalendarOutlined /> 占测日期</Text>
          <DatePicker
            style={{ width: '100%', marginTop: 8 }}
            placeholder="选择日期"
            value={selectedDate}
            onChange={setSelectedDate}
            variant="borderless"
          />
        </div>

        {/* 占测时辰 */}
        <div>
          <Text strong><HistoryOutlined /> 占测时辰</Text>
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
                    style={{ textAlign: 'center', fontSize: 12, padding: '0 8px' }}
                  >
                    {opt.label}
                  </Radio.Button>
                ))}
              </div>
            </Radio.Group>
          </div>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        {/* 操作按钮 */}
        <Button
          type="primary"
          size="large"
          block
          onClick={handleCalculate}
          loading={loading}
          icon={<CompassOutlined />}
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
          排盘
        </Button>
        <Button block onClick={handleReset} icon={<ReloadOutlined />} style={{ borderRadius: '27px', height: '44px' }}>
          重置
        </Button>
      </Space>
    </Card>
  );

  /**
   * 渲染链端排盘结果卡片
   */
  const renderChainResult = () => {
    if (!chainChartId) return null;

    return (
      <Card style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ textAlign: 'center' }}>
            <Title level={4} style={{ marginBottom: 8, color: '#52c41a' }}>
              ✓ 链端排盘成功
            </Title>
            <Text type="secondary">排盘已上链存储，可以查看详细解卦</Text>
          </div>

          <Divider />

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <Tag color="blue" style={{ fontSize: 16, padding: '8px 16px' }}>
              排盘 ID: {chainChartId}
            </Tag>
          </div>

          <Button
            type="primary"
            size="large"
            block
            onClick={handleViewDetail}
            icon={<BookOutlined />}
          >
            查看详细解卦（链端AI解读）
          </Button>

          <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>
            提示：排盘数据已永久存储在区块链上，可随时查看解卦结果
          </Text>
        </Space>
      </Card>
    );
  };

  /**
   * 渲染奇门盘
   */
  const renderPan = () => {
    if (!pan) return null;

    // 九宫格布局顺序（上南下北，左东右西）
    // 巽四 离九 坤二
    // 震三 中五 兑七
    // 艮八 坎一 乾六
    const layoutMap: Record<number, number> = {
      0: 3, // 巽四
      1: 8, // 离九
      2: 1, // 坤二
      3: 2, // 震三
      4: 4, // 中五
      5: 6, // 兑七
      6: 7, // 艮八
      7: 0, // 坎一
      8: 5, // 乾六
    };

    // 计算各宫格局分析
    const palaceAnalyses: PalaceAnalysis[] = pan.gongWeis.map((gw) =>
      analyzePalace(gw, pan.hour)
    );

    // 获取驿马信息
    const yiMa = getYiMaGong(pan.hour);

    // 收集整盘特殊格局
    const specialPatterns: Array<{ name: string; isJi: boolean; gong: string }> = [];
    palaceAnalyses.forEach((analysis, idx) => {
      const gongName = JIU_GONG_SHORT[pan.gongWeis[idx].gong];
      if (analysis.jiXing) {
        specialPatterns.push({
          name: `${QI_YI_NAMES[analysis.jiXing.gan]}击刑`,
          isJi: false,
          gong: gongName,
        });
      }
      if (analysis.ruMu) {
        specialPatterns.push({
          name: `${QI_YI_NAMES[analysis.ruMu.gan]}入墓`,
          isJi: false,
          gong: gongName,
        });
      }
      if (analysis.menPo) {
        specialPatterns.push({
          name: `${BA_MEN_NAMES[analysis.menPo.men]}门迫`,
          isJi: false,
          gong: gongName,
        });
      }
      if (analysis.keYing &&
          analysis.keYing.geJu !== ShiGanGeJuType.Other &&
          analysis.keYing.geJu !== ShiGanGeJuType.FuYin) {
        specialPatterns.push({
          name: SHI_GAN_GE_JU_NAMES[analysis.keYing.geJu],
          isJi: analysis.keYing.isJi,
          gong: gongName,
        });
      }
    });

    return (
      <Card className="pan-card" style={{ marginTop: 16 }}>
        <Title level={5}>
          {isYangDun(pan.juShu) ? '阳遁' : '阴遁'}{getJuNumber(pan.juShu)}局
        </Title>
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">
            {pan.year}年{pan.month}月{pan.day}日 {HOUR_OPTIONS[pan.hour]?.label} |
            节气：{pan.jieQi}
          </Text>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Tag color="red">值符：{JIU_XING_NAMES[pan.zhiFu]}</Tag>
          <Tag color="blue">值使：{BA_MEN_NAMES[pan.zhiShi]}</Tag>
          <Tag>旬首：{QI_YI_NAMES[pan.xunShou]}</Tag>
          {yiMa && (
            <Tag color="gold">驿马：{yiMa.zhiName}（{JIU_GONG_SHORT[yiMa.gong]}）</Tag>
          )}
        </div>

        {/* 九宫格 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 4,
          }}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
            const gongIdx = layoutMap[idx];
            const gongWei = pan.gongWeis[gongIdx];
            const analysis = palaceAnalyses[gongIdx];
            return (
              <GongWeiCard
                key={idx}
                gongWei={gongWei}
                isCenter={gongWei.gong === JiuGong.Zhong}
                analysis={analysis}
              />
            );
          })}
        </div>

        {/* 方位说明 */}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 10 }}>
            上南下北 · 左东右西
          </Text>
        </div>

        {/* 格局分析卡片 */}
        {specialPatterns.length > 0 && (
          <div style={{ marginTop: 12, padding: 8, backgroundColor: '#fafafa', borderRadius: 4 }}>
            <Text strong style={{ fontSize: 12 }}>格局分析</Text>
            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {specialPatterns.map((pattern, idx) => (
                <Tag
                  key={idx}
                  color={pattern.isJi ? 'green' : 'red'}
                  style={{ fontSize: 10 }}
                >
                  {pattern.name}（{pattern.gong}）
                </Tag>
              ))}
            </div>
          </div>
        )}

        {/* 链端解卦按钮（本地排盘时显示） */}
        {chainChartId && pan && (
          <div style={{ marginTop: 12 }}>
            <Button
              type="primary"
              block
              onClick={handleViewDetail}
              icon={<BookOutlined />}
            >
              查看详细解卦（链端AI解读）
            </Button>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="qimen-page">
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
        {/* 左边：我的排盘 */}
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', cursor: 'pointer' }}
          onClick={() => (window.location.hash = '#/qimen/list')}
        >
          <HistoryOutlined style={{ fontSize: '18px', color: '#999' }} />
          <div style={{ fontSize: '10px', color: '#999' }}>我的排盘</div>
        </div>

        {/* 中间：奇门遁甲 */}
        <div style={{ fontSize: '18px', color: '#333', fontWeight: '500', whiteSpace: 'nowrap' }}>奇门遁甲</div>

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
        {renderChainResult()}
        {renderPan()}
      </Spin>

      {/* 说明弹窗 */}
      {renderInstructionsModal()}

      {/* 底部导航 */}
      <div className="bottom-nav">
        <Space split={<Divider type="vertical" />}>
          <Button type="link" onClick={() => (window.location.hash = '#/qimen/list')}>
            <HistoryOutlined /> 我的排盘
          </Button>
          <Button type="link" onClick={() => (window.location.hash = '#/divination')}>
            <ArrowRightOutlined /> 占卜入口
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default QimenPage;
