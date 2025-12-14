/**
 * 八字排盘页面
 *
 * 功能：
 * - 输入出生年月日时进行排盘
 * - 显示四柱八字和十神
 * - 显示五行分布和缺失
 * - 显示大运流年
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  Button,
  DatePicker,
  Select,
  Typography,
  Space,
  Divider,
  Tag,
  Row,
  Col,
  Statistic,
  message,
  Radio,
  Modal,
} from 'antd';
import {
  CalendarOutlined,
  UserOutlined,
  HistoryOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import {
  Gender,
  GENDER_NAMES,
  TIAN_GAN_NAMES,
  DI_ZHI_NAMES,
  WU_XING_NAMES,
  WU_XING_COLORS,
  WU_XING_BG_COLORS,
  SHI_SHEN_NAMES,
  SHI_SHEN_SHORT,
  SHI_SHEN_COLORS,
  DI_ZHI_HOURS,
  DiZhi,
  BaziResult,
  ZhuDetail,
  DaYun,
  getGanZhiName,
} from '../../types/bazi';
import { calculateBazi, formatBazi, calculateLiuNian } from '../../services/baziService';
import {
  saveBaziToChain,
  uploadBaziResultToIpfs,
  getUserBaziCharts,
} from '../../services/baziChainService';
import {
  requestDivinationInterpretation,
  getDivinationInterpretationRequest,
} from '../../services/divinationService';
import { DivinationType, InterpretationType } from '../../types/divination';
import { getFriendlyErrorMessage } from '../../services/nodeStatusService';
import NodeStatusChecker from '../../components/NodeStatusChecker';
import { useWalletStore } from '../../stores/walletStore';
import './BaziPage.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

/**
 * 八字排盘页面组件
 */
const BaziPage: React.FC = () => {
  // 输入状态
  const [birthDate, setBirthDate] = useState<dayjs.Dayjs | null>(null);
  const [birthHour, setBirthHour] = useState<number>(12);
  const [gender, setGender] = useState<Gender>(Gender.Male);

  // 结果状态
  const [result, setResult] = useState<BaziResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedChartId, setSavedChartId] = useState<number | null>(null);

  // AI解读状态
  const [requestingAI, setRequestingAI] = useState(false);
  const [aiRequestId, setAiRequestId] = useState<number | null>(null);

  // 钱包状态
  const { selectedAccount, isConnected } = useWalletStore();

  /**
   * 执行排盘
   */
  const handleCalculate = useCallback(() => {
    if (!birthDate) {
      message.warning('请选择出生日期');
      return;
    }

    setLoading(true);
    try {
      const baziResult = calculateBazi({
        year: birthDate.year(),
        month: birthDate.month() + 1,
        day: birthDate.date(),
        hour: birthHour,
        gender,
      });
      setResult(baziResult);
      message.success('排盘成功！');
    } catch (error) {
      console.error('排盘失败:', error);
      message.error('排盘失败，请检查输入');
    } finally {
      setLoading(false);
    }
  }, [birthDate, birthHour, gender]);

  /**
   * 重新排盘
   */
  const handleReset = useCallback(() => {
    setResult(null);
    setBirthDate(null);
    setBirthHour(12);
    setGender(Gender.Male);
    setSavedChartId(null);
  }, []);

  /**
   * 保存到链上
   */
  const handleSaveToChain = useCallback(async () => {
    if (!result || !birthDate || !isConnected || !selectedAccount) {
      message.warning('请先连接钱包');
      return;
    }

    setSaving(true);
    try {
      // 上传完整八字数据到IPFS
      const dataCid = await uploadBaziResultToIpfs(result);

      // 保存到链上
      const chartId = await saveBaziToChain({
        year: birthDate.year(),
        month: birthDate.month() + 1,
        day: birthDate.date(),
        hour: birthHour,
        gender,
        isPublic: false,
        dataCid,
      });

      setSavedChartId(chartId);
      message.success('八字命盘已保存到链上！');
    } catch (error) {
      console.error('保存失败:', error);
      const friendlyMessage = getFriendlyErrorMessage(error);
      Modal.error({
        title: '保存失败',
        content: <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{friendlyMessage}</pre>,
        width: 500,
      });
    } finally {
      setSaving(false);
    }
  }, [result, birthDate, birthHour, gender, isConnected, selectedAccount]);

  /**
   * 查看详情页
   */
  const handleViewDetail = useCallback(() => {
    if (savedChartId) {
      window.location.hash = `#/bazi/${savedChartId}`;
    }
  }, [savedChartId]);

  /**
   * 请求AI智能解盘
   */
  const handleRequestAIInterpretation = useCallback(async () => {
    if (!savedChartId) {
      message.warning('请先保存命盘到链上');
      return;
    }

    if (!isConnected || !selectedAccount) {
      message.warning('请先连接钱包');
      return;
    }

    setRequestingAI(true);
    try {
      // 请求AI解读 - 使用综合解读类型
      const requestId = await requestDivinationInterpretation(
        DivinationType.Bazi,
        savedChartId,
        InterpretationType.Comprehensive
      );

      setAiRequestId(requestId);
      message.success('AI解读请求已提交，正在处理中...');

      // 轮询检查解读状态
      const checkInterval = setInterval(async () => {
        try {
          const request = await getDivinationInterpretationRequest(requestId);
          if (request && request.status === 2) { // 2 = Completed
            clearInterval(checkInterval);
            message.success('AI解读完成！');
            // 跳转到解读结果页面
            window.location.hash = `#/divination/interpretation/${requestId}`;
          } else if (request && request.status === 3) { // 3 = Failed
            clearInterval(checkInterval);
            message.error('AI解读失败，请稍后重试');
            setRequestingAI(false);
          }
        } catch (error) {
          console.error('检查解读状态失败:', error);
        }
      }, 3000); // 每3秒检查一次

      // 30秒后停止轮询
      setTimeout(() => {
        clearInterval(checkInterval);
        if (requestingAI) {
          setRequestingAI(false);
          message.info('解读处理时间较长，请稍后在"我的解读"页面查看结果');
        }
      }, 30000);

    } catch (error) {
      console.error('请求AI解读失败:', error);
      message.error(`请求失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setRequestingAI(false);
    }
  }, [savedChartId, isConnected, selectedAccount, requestingAI]);

  /**
   * 渲染单柱
   */
  const renderZhu = (
    title: string,
    detail: ZhuDetail,
    isRiZhu: boolean = false
  ) => {
    const { ganZhi, tianGanShiShen, cangGan, cangGanShiShen, tianGanWuXing, diZhiWuXing } = detail;

    return (
      <div className="zhu-column">
        <div className="zhu-title">{title}</div>

        {/* 天干十神 */}
        <div className="shi-shen-row">
          {isRiZhu ? (
            <Tag color="purple">日主</Tag>
          ) : tianGanShiShen !== null ? (
            <Tag color={SHI_SHEN_COLORS[tianGanShiShen]}>
              {SHI_SHEN_SHORT[tianGanShiShen]}
            </Tag>
          ) : null}
        </div>

        {/* 天干 */}
        <div
          className="gan-box"
          style={{
            backgroundColor: WU_XING_BG_COLORS[tianGanWuXing],
            borderColor: WU_XING_COLORS[tianGanWuXing],
          }}
        >
          <span className="gan-text">{TIAN_GAN_NAMES[ganZhi.tianGan]}</span>
          <span className="wu-xing-label" style={{ color: WU_XING_COLORS[tianGanWuXing] }}>
            {WU_XING_NAMES[tianGanWuXing]}
          </span>
        </div>

        {/* 地支 */}
        <div
          className="zhi-box"
          style={{
            backgroundColor: WU_XING_BG_COLORS[diZhiWuXing],
            borderColor: WU_XING_COLORS[diZhiWuXing],
          }}
        >
          <span className="zhi-text">{DI_ZHI_NAMES[ganZhi.diZhi]}</span>
          <span className="wu-xing-label" style={{ color: WU_XING_COLORS[diZhiWuXing] }}>
            {WU_XING_NAMES[diZhiWuXing]}
          </span>
        </div>

        {/* 藏干 */}
        <div className="cang-gan-section">
          {cangGan.map((g, idx) => (
            <div key={idx} className="cang-gan-item">
              <span className="cang-gan-name">{TIAN_GAN_NAMES[g]}</span>
              <Tag size="small" color={SHI_SHEN_COLORS[cangGanShiShen[idx]]}>
                {SHI_SHEN_SHORT[cangGanShiShen[idx]]}
              </Tag>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * 渲染五行统计
   */
  const renderWuXingStats = () => {
    if (!result) return null;
    const { wuXingCount, wuXingLack } = result;

    const items = [
      { name: '木', count: wuXingCount.mu, color: WU_XING_COLORS[0], bg: WU_XING_BG_COLORS[0] },
      { name: '火', count: wuXingCount.huo, color: WU_XING_COLORS[1], bg: WU_XING_BG_COLORS[1] },
      { name: '土', count: wuXingCount.tu, color: WU_XING_COLORS[2], bg: WU_XING_BG_COLORS[2] },
      { name: '金', count: wuXingCount.jin, color: WU_XING_COLORS[3], bg: WU_XING_BG_COLORS[3] },
      { name: '水', count: wuXingCount.shui, color: WU_XING_COLORS[4], bg: WU_XING_BG_COLORS[4] },
    ];

    return (
      <Card className="wu-xing-card" size="small">
        <Title level={5}>五行统计</Title>
        <div className="wu-xing-bars">
          {items.map((item) => (
            <div key={item.name} className="wu-xing-bar-item">
              <div className="bar-label">
                <span style={{ color: item.color }}>{item.name}</span>
                <span>{item.count}</span>
              </div>
              <div className="bar-track" style={{ backgroundColor: item.bg }}>
                <div
                  className="bar-fill"
                  style={{
                    width: `${Math.min(item.count * 12.5, 100)}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        {wuXingLack.length > 0 && (
          <div className="wu-xing-lack">
            <Text type="secondary">五行缺：</Text>
            {wuXingLack.map((wx) => (
              <Tag key={wx} color="warning">
                {WU_XING_NAMES[wx]}
              </Tag>
            ))}
          </div>
        )}
      </Card>
    );
  };

  /**
   * 渲染大运
   */
  const renderDaYun = () => {
    if (!result) return null;
    const { daYunList, qiYunAge, daYunShun } = result;

    return (
      <Card className="da-yun-card" size="small">
        <div className="da-yun-header">
          <Title level={5}>大运</Title>
          <Space>
            <Tag color={daYunShun ? 'blue' : 'orange'}>
              {daYunShun ? '顺行' : '逆行'}
            </Tag>
            <Text type="secondary">{qiYunAge}岁起运</Text>
          </Space>
        </div>
        <div className="da-yun-list">
          {daYunList.slice(0, 8).map((dy: DaYun) => (
            <div key={dy.index} className="da-yun-item">
              <div className="da-yun-age">{dy.startAge}-{dy.endAge}</div>
              <div className="da-yun-gan-zhi">
                <span className="gan">{TIAN_GAN_NAMES[dy.ganZhi.tianGan]}</span>
                <span className="zhi">{DI_ZHI_NAMES[dy.ganZhi.diZhi]}</span>
              </div>
              <Tag size="small" color={SHI_SHEN_COLORS[dy.tianGanShiShen]}>
                {SHI_SHEN_SHORT[dy.tianGanShiShen]}
              </Tag>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  /**
   * 渲染流年
   */
  const renderLiuNian = () => {
    if (!result) return null;

    const currentYear = new Date().getFullYear();
    const liuNianList = calculateLiuNian(
      result.siZhu,
      result.birthInfo.year,
      currentYear,
      10
    );

    return (
      <Card className="liu-nian-card" size="small">
        <Title level={5}>流年</Title>
        <div className="liu-nian-list">
          {liuNianList.map((ln) => (
            <div
              key={ln.year}
              className={`liu-nian-item ${ln.year === currentYear ? 'current' : ''}`}
            >
              <div className="liu-nian-year">{ln.year}</div>
              <div className="liu-nian-gan-zhi">{getGanZhiName(ln.ganZhi)}</div>
              <Tag size="small" color={SHI_SHEN_COLORS[ln.tianGanShiShen]}>
                {SHI_SHEN_SHORT[ln.tianGanShiShen]}
              </Tag>
              <div className="liu-nian-age">{ln.age}岁</div>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  /**
   * 渲染输入表单
   */
  const renderInputForm = () => (
    <Card className="input-card">
      <Title level={4} className="page-title">
        <CalendarOutlined /> 八字命理 · 排盘
      </Title>
      <Paragraph type="secondary" className="page-subtitle">
        输入您的出生年月日时，生成专属八字命盘
      </Paragraph>

      <Divider />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 出生日期 */}
        <div className="form-item">
          <Text strong>出生日期（公历）</Text>
          <DatePicker
            value={birthDate}
            onChange={(date) => setBirthDate(date)}
            placeholder="选择出生日期"
            style={{ width: '100%', marginTop: 8 }}
            size="large"
            disabledDate={(current) => current && current > dayjs()}
          />
        </div>

        {/* 出生时辰 */}
        <div className="form-item">
          <Text strong>出生时辰</Text>
          <Select
            value={birthHour}
            onChange={(v) => setBirthHour(v)}
            style={{ width: '100%', marginTop: 8 }}
            size="large"
          >
            {Object.entries(DI_ZHI_HOURS).map(([key, value]) => {
              const diZhi = parseInt(key) as DiZhi;
              const zhiName = DI_ZHI_NAMES[diZhi];
              // 根据时辰范围计算代表小时
              const hour = diZhi === 0 ? 0 : diZhi * 2 - 1;
              return (
                <Option key={diZhi} value={hour}>
                  {zhiName}时 ({value})
                </Option>
              );
            })}
          </Select>
        </div>

        {/* 性别 */}
        <div className="form-item">
          <Text strong>性别</Text>
          <div style={{ marginTop: 8 }}>
            <Radio.Group
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              size="large"
            >
              <Radio.Button value={Gender.Male}>
                <UserOutlined /> {GENDER_NAMES[Gender.Male]}
              </Radio.Button>
              <Radio.Button value={Gender.Female}>
                <UserOutlined /> {GENDER_NAMES[Gender.Female]}
              </Radio.Button>
            </Radio.Group>
          </div>
        </div>

        <Button
          type="primary"
          size="large"
          block
          onClick={handleCalculate}
          loading={loading}
          disabled={!birthDate}
        >
          开始排盘
        </Button>
      </Space>

      <Divider />

      <div className="input-tips">
        <Title level={5}>排盘须知</Title>
        <ul>
          <li>请输入准确的公历出生日期和时辰</li>
          <li>如不确定时辰，可选择中午时段</li>
          <li>性别会影响大运的顺逆方向</li>
          <li>排盘结果仅供参考，命运掌握在自己手中</li>
        </ul>
      </div>
    </Card>
  );

  /**
   * 渲染排盘结果
   */
  const renderResult = () => {
    if (!result) return null;

    const { siZhu, siZhuDetail, lunarInfo, birthInfo } = result;

    return (
      <div className="result-container">
        {/* 基本信息 */}
        <Card className="info-card" size="small">
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title="公历"
                value={`${birthInfo.year}年${birthInfo.month}月${birthInfo.day}日`}
                valueStyle={{ fontSize: 14 }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="农历"
                value={`${lunarInfo.year}年${lunarInfo.isLeapMonth ? '闰' : ''}${lunarInfo.month}月${lunarInfo.day}日`}
                valueStyle={{ fontSize: 14 }}
              />
            </Col>
          </Row>
          <Divider style={{ margin: '12px 0' }} />
          <div className="bazi-summary">
            <Text strong>八字：</Text>
            <Text code style={{ fontSize: 16 }}>{formatBazi(siZhu)}</Text>
          </div>
        </Card>

        {/* 四柱详情 */}
        <Card className="si-zhu-card" size="small">
          <Title level={5}>四柱八字</Title>
          <div className="si-zhu-container">
            {renderZhu('年柱', siZhuDetail.nian)}
            {renderZhu('月柱', siZhuDetail.yue)}
            {renderZhu('日柱', siZhuDetail.ri, true)}
            {renderZhu('时柱', siZhuDetail.shi)}
          </div>
        </Card>

        {/* 五行统计 */}
        {renderWuXingStats()}

        {/* 大运 */}
        {renderDaYun()}

        {/* 流年 */}
        {renderLiuNian()}

        {/* 操作按钮 */}
        <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
          {!savedChartId ? (
            <>
              <Button
                type="primary"
                block
                onClick={handleSaveToChain}
                loading={saving}
                disabled={!isConnected}
              >
                {isConnected ? '保存到链上' : '请先连接钱包'}
              </Button>
              <Button block onClick={handleReset}>
                重新排盘
              </Button>
              {/* 未保存时显示禁用的AI按钮，提示用户需要先保存 */}
              <div style={{ padding: '8px 0' }}>
                <Button
                  icon={<RobotOutlined />}
                  block
                  disabled
                  style={{ opacity: 0.6 }}
                >
                  AI智能解盘（需先保存）
                </Button>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center', marginTop: 4 }}>
                  💡 保存命盘后可使用AI智能解读功能
                </Text>
              </div>
            </>
          ) : (
            <>
              <Button
                type="primary"
                icon={<RobotOutlined />}
                block
                onClick={handleRequestAIInterpretation}
                loading={requestingAI}
                disabled={!isConnected || requestingAI}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderColor: '#667eea',
                }}
              >
                {requestingAI ? 'AI解读中...' : 'AI智能解盘'}
              </Button>
              <Button
                type="default"
                block
                onClick={handleViewDetail}
                icon={<ArrowRightOutlined />}
              >
                查看命盘详情
              </Button>
              <Button block onClick={handleReset}>
                重新排盘
              </Button>
            </>
          )}
          <Divider style={{ margin: '12px 0' }} />
          <Button
            type="link"
            block
            onClick={() => (window.location.hash = '#/divination/market?type=1')}
          >
            找大师解读命盘 <ArrowRightOutlined />
          </Button>
        </Space>
      </div>
    );
  };

  return (
    <div className="bazi-page">
      {/* 节点状态检查 */}
      <NodeStatusChecker autoCheck={true} checkInterval={10000} />

      {result ? renderResult() : renderInputForm()}

      {/* 底部导航 */}
      <div className="bottom-nav">
        <Space split={<Divider type="vertical" />}>
          <Button type="link" onClick={() => (window.location.hash = '#/bazi/list')}>
            <HistoryOutlined /> 我的八字
          </Button>
          <Button type="link" onClick={() => (window.location.hash = '#/divination')}>
            <ArrowRightOutlined /> 占卜入口
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default BaziPage;
