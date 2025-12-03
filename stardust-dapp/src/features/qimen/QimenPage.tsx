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
} from 'antd';
import {
  CompassOutlined,
  HistoryOutlined,
  ReloadOutlined,
  CalendarOutlined,
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

  /**
   * 排盘
   */
  const handleCalculate = useCallback(async () => {
    if (!selectedDate) {
      message.warning('请选择占测日期');
      return;
    }

    setLoading(true);
    try {
      // 模拟API延迟
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = generateMockQimenPan(
        selectedDate.year(),
        selectedDate.month() + 1,
        selectedDate.date(),
        selectedHour
      );
      setPan(result);
      message.success('奇门盘排列完成');
    } catch (error) {
      console.error('排盘失败:', error);
      message.error('排盘失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedHour]);

  /**
   * 重置
   */
  const handleReset = useCallback(() => {
    setSelectedDate(null);
    setSelectedHour(0);
    setPan(null);
  }, []);

  /**
   * 渲染输入表单
   */
  const renderInputForm = () => (
    <Card className="input-card">
      <Title level={4} className="page-title">
        <CompassOutlined /> 奇门遁甲 · 排盘
      </Title>
      <Paragraph type="secondary" className="page-subtitle">
        输入占测时间，排列奇门遁甲盘
      </Paragraph>

      <Divider />

      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 占测日期 */}
        <div>
          <Text strong><CalendarOutlined /> 占测日期</Text>
          <DatePicker
            style={{ width: '100%', marginTop: 8 }}
            placeholder="选择日期"
            value={selectedDate}
            onChange={setSelectedDate}
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

        <Divider />

        {/* 操作按钮 */}
        <Button
          type="primary"
          size="large"
          block
          onClick={handleCalculate}
          loading={loading}
          icon={<CompassOutlined />}
        >
          排盘
        </Button>
        <Button block onClick={handleReset} icon={<ReloadOutlined />}>
          重置
        </Button>
      </Space>
    </Card>
  );

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
      </Card>
    );
  };

  return (
    <div className="qimen-page" style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <Spin spinning={loading}>
        {renderInputForm()}
        {renderPan()}
      </Spin>

      {/* 说明卡片 */}
      <Card style={{ marginTop: 16 }}>
        <Title level={5}>奇门遁甲说明</Title>
        <Space direction="vertical" size={8}>
          <div>
            <Text strong>四盘结构：</Text>
            <Text type="secondary">天盘（九星）、地盘（九宫）、人盘（八门）、神盘（八神）</Text>
          </div>
          <div>
            <Text strong>三奇六仪：</Text>
            <Text type="secondary">乙丙丁为三奇，戊己庚辛壬癸为六仪</Text>
          </div>
          <div>
            <Text strong>八门吉凶：</Text>
            <Text type="secondary">
              <Tag color={BA_MEN_COLORS[BaMen.Kai]}>开门吉</Tag>
              <Tag color={BA_MEN_COLORS[BaMen.Xiu]}>休门吉</Tag>
              <Tag color={BA_MEN_COLORS[BaMen.Sheng]}>生门吉</Tag>
              <Tag color={BA_MEN_COLORS[BaMen.Si]}>死门凶</Tag>
              <Tag color={BA_MEN_COLORS[BaMen.Jing2]}>惊门凶</Tag>
              <Tag color={BA_MEN_COLORS[BaMen.Shang]}>伤门凶</Tag>
            </Text>
          </div>
          <div>
            <Text strong>局数：</Text>
            <Text type="secondary">阳遁一至九局，阴遁一至九局，共18局</Text>
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

export default QimenPage;
