/**
 * 奇门遁甲排盘页面
 *
 * 功能：
 * - 输入时间起盘
 * - 显示九宫格盘面
 * - 八门、九星、八神分析
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Divider,
  Tag,
  message,
  Radio,
  Spin,
  Modal,
  Input,
  Select,
  InputNumber,
} from 'antd';
import type { RadioChangeEvent } from 'antd';
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

/** 性别枚举 */
enum Gender {
  Male = 1,
  Female = 0,
}

/** 选局方式 */
type JuSelectMode = 'auto' | 'manual';

/** 排法类型 */
type PaiMethod = 'zhuanpan' | 'feigong';

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
 * 局数选项（阳遁1-9局，阴遁1-9局）
 */
const JU_OPTIONS = [
  { value: 'yang1', label: '阳一局' },
  { value: 'yang2', label: '阳二局' },
  { value: 'yang3', label: '阳三局' },
  { value: 'yang4', label: '阳四局' },
  { value: 'yang5', label: '阳五局' },
  { value: 'yang6', label: '阳六局' },
  { value: 'yang7', label: '阳七局' },
  { value: 'yang8', label: '阳八局' },
  { value: 'yang9', label: '阳九局' },
  { value: 'yin1', label: '阴一局' },
  { value: 'yin2', label: '阴二局' },
  { value: 'yin3', label: '阴三局' },
  { value: 'yin4', label: '阴四局' },
  { value: 'yin5', label: '阴五局' },
  { value: 'yin6', label: '阴六局' },
  { value: 'yin7', label: '阴七局' },
  { value: 'yin8', label: '阴八局' },
  { value: 'yin9', label: '阴九局' },
];

/**
 * 时辰名称（用于显示）
 */
const SHICHEN_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

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
  // 命主信息
  const [name, setName] = useState('求测者');
  const [gender, setGender] = useState<Gender>(Gender.Male);
  const [birthYear, setBirthYear] = useState<number>(1985);
  const [question, setQuestion] = useState('某事');

  // 起盘时间
  const [divinationDate, setDivinationDate] = useState<dayjs.Dayjs>(dayjs());
  const [hour, setHour] = useState<number>(new Date().getHours());
  const [minute, setMinute] = useState<number>(new Date().getMinutes());

  // 选局方式
  const [juSelectMode, setJuSelectMode] = useState<JuSelectMode>('auto');
  const [manualJu, setManualJu] = useState<string>('yang1');

  // 排法
  const [paiMethod, setPaiMethod] = useState<PaiMethod>('zhuanpan');

  // 状态
  const [loading, setLoading] = useState(false);
  const [pan, setPan] = useState<QimenPan | null>(null);
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
    // 将小时转换为时辰
    const shiChen = Math.floor(((hour + 1) % 24) / 2);

    const result = generateMockQimenPan(
      divinationDate.year(),
      divinationDate.month() + 1,
      divinationDate.date(),
      shiChen
    );
    setPan(result);
    message.success('奇门盘排列完成');
  }, [divinationDate, hour]);

  /**
   * 链端排盘
   */
  const handleChainCalculate = useCallback(async () => {
    try {
      const chartId = await qimenService.divineRandom(undefined, false);
      setChainChartId(chartId);
      message.success(`链端排盘成功，排盘ID: ${chartId}`);

      // 可选：加载链端排盘数据到本地显示
      try {
        const chartData = await qimenService.getChart(chartId);
        if (chartData) {
          console.log('链端排盘数据:', chartData);
        }
      } catch (error) {
        console.warn('加载链端排盘数据失败:', error);
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
      // 使用本地排盘
      await handleLocalCalculate();
    } catch (error) {
      console.error('排盘失败:', error);
      message.error('排盘失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [handleLocalCalculate]);

  /**
   * 重置
   */
  const handleReset = useCallback(() => {
    setName('求测者');
    setGender(Gender.Male);
    setBirthYear(1985);
    setQuestion('某事');
    setDivinationDate(dayjs());
    setHour(new Date().getHours());
    setMinute(new Date().getMinutes());
    setJuSelectMode('auto');
    setManualJu('yang1');
    setPaiMethod('zhuanpan');
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
    <Card className="divination-card input-card" style={{ margin: '12px', borderRadius: '8px', width: 'calc(100% + 10px)', marginLeft: '-5px' }}>
      {/* 姓名 + 性别 */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 50, textAlign: 'right', paddingRight: 8 }}>
          姓名：
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

      {/* 生年 */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 50, textAlign: 'right', paddingRight: 8 }}>
          生年：
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

      {/* 占事 */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 50, textAlign: 'right', paddingRight: 8 }}>
          占事：
        </div>
        <div className="form-content" style={{ flex: 1 }}>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="某事"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* 时间：年月日 */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 50, textAlign: 'right', paddingRight: 8 }}>
          时间：
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

      {/* 时辰：时 + 分 */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 50, textAlign: 'right', paddingRight: 8 }}>
          时辰：
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
        </div>
      </div>

      {/* 选局：手动/自动 */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 50, textAlign: 'right', paddingRight: 8 }}>
          选局：
        </div>
        <div className="form-content" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Radio.Group
            value={juSelectMode}
            onChange={(e: RadioChangeEvent) => setJuSelectMode(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="manual">手动</Radio.Button>
          </Radio.Group>
          <Select
            value={manualJu}
            onChange={setManualJu}
            style={{ width: 100 }}
            options={JU_OPTIONS}
            disabled={juSelectMode === 'auto'}
          />
          <Radio.Group
            value={juSelectMode}
            onChange={(e: RadioChangeEvent) => setJuSelectMode(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="auto">自动</Radio.Button>
          </Radio.Group>
        </div>
      </div>

      {/* 排法：转盘/飞宫 */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 50, textAlign: 'right', paddingRight: 8 }}>
          排法：
        </div>
        <div className="form-content" style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <Radio.Group
            value={paiMethod}
            onChange={(e: RadioChangeEvent) => setPaiMethod(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="zhuanpan">转盘</Radio.Button>
            <Radio.Button value="feigong">飞宫</Radio.Button>
          </Radio.Group>
        </div>
      </div>

      {/* 排盘按钮 */}
      <div style={{ marginTop: 24 }}>
        <Button
          type="primary"
          size="large"
          onClick={handleCalculate}
          loading={loading}
          block
          style={{
            background: '#000000',
            border: 'none',
            height: 48,
            fontSize: 16,
            fontWeight: 500,
            borderRadius: 0,
            color: '#F7D3A1'
          }}
        >
          开始排盘
        </Button>
      </div>
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
            {pan.year}年{pan.month}月{pan.day}日 {SHICHEN_NAMES[pan.hour]}时 |
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
        <div style={{ fontSize: '18px', color: '#333', fontWeight: '500', whiteSpace: 'nowrap' }}>星尘玄鉴-奇门遁甲排盘</div>

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
