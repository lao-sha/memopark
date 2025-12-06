/**
 * 卦象详情页面
 *
 * 显示卦象的完整信息，包括：
 * - 本卦和变卦展示
 * - 体用关系分析
 * - 五行生克
 * - AI 解读入口
 * - 大师服务入口
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Typography,
  Divider,
  Spin,
  Tag,
  Space,
  message,
  Modal,
  Row,
  Col,
  Descriptions,
  Result,
} from 'antd';
import {
  ArrowRightOutlined,
  RobotOutlined,
  UserOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import {
  getHexagram,
  archiveHexagram,
  getInterpretationRequest,
  getInterpretationResult,
  getHexagramDetail,
} from '../../services/meihuaService';
import type { Hexagram, InterpretationResult, FullDivinationDetail } from '../../types/meihua';
import {
  Trigram,
  WuXing,
  DivinationMethod,
  HexagramStatus,
  TRIGRAM_NAMES,
  TRIGRAM_SYMBOLS,
  TRIGRAM_MEANINGS,
  WUXING_NAMES,
  getHexagramName,
  formatLunarHour,
} from '../../types/meihua';
import { CreateBountyModal } from '../bounty/components/CreateBountyModal';
import { DivinationType } from '../../types/divination';
import './MeihuaPage.css';

const { Title, Text, Paragraph } = Typography;

/**
 * 八卦对应的五行
 */
const TRIGRAM_WUXING: Record<Trigram, WuXing> = {
  [Trigram.Qian]: WuXing.Metal,
  [Trigram.Dui]: WuXing.Metal,
  [Trigram.Li]: WuXing.Fire,
  [Trigram.Zhen]: WuXing.Wood,
  [Trigram.Xun]: WuXing.Wood,
  [Trigram.Kan]: WuXing.Water,
  [Trigram.Gen]: WuXing.Earth,
  [Trigram.Kun]: WuXing.Earth,
};

/**
 * 五行生克关系
 */
const WUXING_RELATIONS: Record<WuXing, { generates: WuXing; overcomes: WuXing }> = {
  [WuXing.Wood]: { generates: WuXing.Fire, overcomes: WuXing.Earth },
  [WuXing.Fire]: { generates: WuXing.Earth, overcomes: WuXing.Metal },
  [WuXing.Earth]: { generates: WuXing.Metal, overcomes: WuXing.Water },
  [WuXing.Metal]: { generates: WuXing.Water, overcomes: WuXing.Wood },
  [WuXing.Water]: { generates: WuXing.Wood, overcomes: WuXing.Fire },
};

/**
 * 起卦方式名称
 */
const METHOD_NAMES: Record<DivinationMethod, string> = {
  [DivinationMethod.Time]: '时间起卦',
  [DivinationMethod.Number]: '数字起卦',
  [DivinationMethod.Text]: '文字起卦',
  [DivinationMethod.Random]: '随机起卦',
};

/**
 * 卦象状态名称
 */
const STATUS_NAMES: Record<HexagramStatus, string> = {
  [HexagramStatus.Active]: '有效',
  [HexagramStatus.Archived]: '已归档',
  [HexagramStatus.Deleted]: '已删除',
};

/**
 * 获取五行生克关系描述
 */
function getWuxingRelation(bodyWuxing: WuXing, funcWuxing: WuXing): { relation: string; favorable: boolean } {
  if (bodyWuxing === funcWuxing) {
    return { relation: '比和', favorable: true };
  }

  // 用生体（吉）
  if (WUXING_RELATIONS[funcWuxing].generates === bodyWuxing) {
    return { relation: '用生体', favorable: true };
  }

  // 体生用（泄）
  if (WUXING_RELATIONS[bodyWuxing].generates === funcWuxing) {
    return { relation: '体生用', favorable: false };
  }

  // 用克体（凶）
  if (WUXING_RELATIONS[funcWuxing].overcomes === bodyWuxing) {
    return { relation: '用克体', favorable: false };
  }

  // 体克用（耗）
  if (WUXING_RELATIONS[bodyWuxing].overcomes === funcWuxing) {
    return { relation: '体克用', favorable: true };
  }

  return { relation: '未知', favorable: false };
}

/**
 * 渲染单个卦象（上下卦）
 */
const HexagramDisplay: React.FC<{
  upper: Trigram;
  lower: Trigram;
  title: string;
  changingLine?: number;
  isBody?: Trigram;
}> = ({ upper, lower, title, changingLine, isBody }) => {
  const hexagramName = getHexagramName(upper, lower);

  /**
   * 渲染单个爻
   */
  const renderLine = (index: number, isYang: boolean, isChanging: boolean) => {
    const lineClass = `hexagram-line ${isYang ? 'yang' : 'yin'} ${isChanging ? 'changing' : ''}`;
    return (
      <div key={index} className={lineClass}>
        {isYang ? (
          <div className="yang-line" />
        ) : (
          <>
            <div className="yin-half" />
            <div className="yin-gap" />
            <div className="yin-half" />
          </>
        )}
        {isChanging && <span className="changing-marker">动</span>}
      </div>
    );
  };

  /**
   * 获取卦的爻线（从下到上）
   */
  const getLines = (trigram: Trigram): boolean[] => {
    const patterns: Record<Trigram, boolean[]> = {
      [Trigram.Qian]: [true, true, true],    // ☰
      [Trigram.Dui]: [true, true, false],    // ☱
      [Trigram.Li]: [true, false, true],     // ☲
      [Trigram.Zhen]: [true, false, false],  // ☳
      [Trigram.Xun]: [false, true, true],    // ☴
      [Trigram.Kan]: [false, true, false],   // ☵
      [Trigram.Gen]: [false, false, true],   // ☶
      [Trigram.Kun]: [false, false, false],  // ☷
    };
    return patterns[trigram];
  };

  const lowerLines = getLines(lower);
  const upperLines = getLines(upper);
  const allLines = [...lowerLines, ...upperLines]; // 从初爻到上爻

  return (
    <div className="hexagram-display">
      <div className="hexagram-title">{title}</div>
      <div className="hexagram-symbol">
        {TRIGRAM_SYMBOLS[upper]}{TRIGRAM_SYMBOLS[lower]}
      </div>
      <div className="hexagram-name">{hexagramName}</div>
      <div className="hexagram-lines">
        {/* 从上到下渲染（逆序） */}
        {[...allLines].reverse().map((isYang, i) => {
          const lineIndex = 6 - i; // 爻位（1-6）
          const isChanging = changingLine === lineIndex;
          return renderLine(i, isYang, isChanging);
        })}
      </div>
      <div className="trigram-info">
        <div className="trigram-row">
          <span>上卦：{TRIGRAM_NAMES[upper]}（{TRIGRAM_MEANINGS[upper]}）</span>
          {isBody === upper && <Tag color="blue">体</Tag>}
          {isBody !== upper && <Tag color="orange">用</Tag>}
        </div>
        <div className="trigram-row">
          <span>下卦：{TRIGRAM_NAMES[lower]}（{TRIGRAM_MEANINGS[lower]}）</span>
          {isBody === lower && <Tag color="blue">体</Tag>}
          {isBody !== lower && <Tag color="orange">用</Tag>}
        </div>
      </div>
    </div>
  );
};

/**
 * 卦象详情页面组件
 */
const HexagramDetailPage: React.FC = () => {
  // 从 hash 中解析卦象 ID（格式：#/meihua/hexagram/123）
  const id = window.location.hash.match(/#\/meihua\/hexagram\/(\d+)/)?.[1];

  // 使用 hash 路由导航
  const navigate = useCallback((path: string) => {
    window.location.hash = `#${path}`;
  }, []);

  const [hexagram, setHexagram] = useState<Hexagram | null>(null);
  const [hexagramDetail, setHexagramDetail] = useState<FullDivinationDetail | null>(null);
  const [interpretation, setInterpretation] = useState<InterpretationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [bountyModalVisible, setBountyModalVisible] = useState(false);
  const [userAccount, setUserAccount] = useState<string>(''); // TODO: 从钱包获取当前用户账户

  /**
   * 加载卦象数据
   */
  const loadHexagram = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const hexagramId = parseInt(id, 10);
      const data = await getHexagram(hexagramId);
      setHexagram(data);

      // 加载完整详细信息（包含伏卦和体用解读）
      const detail = await getHexagramDetail(hexagramId);
      setHexagramDetail(detail);

      // TODO: 加载已有的解读结果
    } catch (error) {
      console.error('加载卦象失败:', error);
      message.error('加载卦象失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadHexagram();
  }, [loadHexagram]);

  /**
   * 归档卦象
   */
  const handleArchive = async () => {
    if (!hexagram) return;

    Modal.confirm({
      title: '确认归档',
      content: '归档后卦象将不再显示在主列表中，但仍可以通过历史记录查看。确定要归档吗？',
      onOk: async () => {
        setArchiving(true);
        try {
          await archiveHexagram(hexagram.id);
          message.success('归档成功');
          navigate('/meihua/list');
        } catch (error) {
          console.error('归档失败:', error);
          message.error('归档失败');
        } finally {
          setArchiving(false);
        }
      },
    });
  };

  /**
   * 请求 AI 解读
   */
  const handleRequestAi = () => {
    if (!hexagram) return;
    navigate(`/meihua/ai/${hexagram.id}`);
  };

  /**
   * 寻找大师解读
   */
  const handleFindMaster = () => {
    if (!hexagram) return;
    navigate(`/meihua/market?hexagramId=${hexagram.id}`);
  };

  if (loading) {
    return (
      <div className="meihua-page loading">
        <Spin size="large" tip="加载卦象中..." />
      </div>
    );
  }

  if (!hexagram) {
    return (
      <div className="meihua-page">
        <Result
          status="404"
          title="卦象不存在"
          subTitle="该卦象可能已被删除或从未存在"
          extra={
            <Button type="primary" onClick={() => navigate('/meihua')}>
              返回起卦
            </Button>
          }
        />
      </div>
    );
  }

  const bodyWuxing = hexagram.bodyWuxing;
  const funcWuxing = hexagram.functionWuxing;
  const relation = getWuxingRelation(bodyWuxing, funcWuxing);

  return (
    <div className="meihua-page">
      {/* 卦象标题 */}
      <Card className="hexagram-header-card">
        <div className="hexagram-header">
          <Title level={4}>
            {getHexagramName(hexagram.upperTrigram, hexagram.lowerTrigram)}
          </Title>
          <Tag color={hexagram.status === HexagramStatus.Active ? 'green' : 'default'}>
            {STATUS_NAMES[hexagram.status]}
          </Tag>
        </div>
        <Space size="small" wrap>
          <Tag icon={<CalendarOutlined />}>
            {METHOD_NAMES[hexagram.method]}
          </Tag>
          <Tag>
            农历 {hexagram.lunarYear}年{hexagram.lunarMonth}月{hexagram.lunarDay}日 {formatLunarHour(hexagram.lunarHour)}
          </Tag>
        </Space>
      </Card>

      {/* 本卦和变卦展示 */}
      <Card className="hexagram-display-card">
        <Row gutter={16}>
          <Col span={11}>
            <HexagramDisplay
              upper={hexagram.upperTrigram}
              lower={hexagram.lowerTrigram}
              title="本卦"
              changingLine={hexagram.changingLine}
              isBody={hexagram.bodyTrigram}
            />
          </Col>
          <Col span={2} className="arrow-col">
            <ArrowRightOutlined className="transform-arrow" />
          </Col>
          <Col span={11}>
            <HexagramDisplay
              upper={hexagram.changedUpperTrigram}
              lower={hexagram.changedLowerTrigram}
              title="变卦"
            />
          </Col>
        </Row>
      </Card>

      {/* 体用分析 */}
      <Card title="体用分析" className="analysis-card">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="动爻">
            第 {hexagram.changingLine} 爻
            {hexagramDetail?.benGua?.dongYaoMing && (
              <Text style={{ marginLeft: 8 }}>（{hexagramDetail.benGua.dongYaoMing}）</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="体卦">
            {TRIGRAM_NAMES[hexagram.bodyTrigram]}（{TRIGRAM_MEANINGS[hexagram.bodyTrigram]}）
            <Tag color="blue" style={{ marginLeft: 8 }}>{WUXING_NAMES[bodyWuxing]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="用卦">
            {TRIGRAM_NAMES[hexagram.functionTrigram]}（{TRIGRAM_MEANINGS[hexagram.functionTrigram]}）
            <Tag color="orange" style={{ marginLeft: 8 }}>{WUXING_NAMES[funcWuxing]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="体用关系">
            <Tag color={relation.favorable ? 'green' : 'red'}>
              {relation.relation}
            </Tag>
            <Text type={relation.favorable ? 'success' : 'danger'} style={{ marginLeft: 8 }}>
              {relation.favorable ? '吉' : '凶'}
            </Text>
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        {/* 体用关系详细解读（来自 Pallet） */}
        {hexagramDetail?.tiyongInterpretation ? (
          <Paragraph className="tiyong-interpretation">
            <InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            <Text strong>体用解读：</Text>
            <Text>{hexagramDetail.tiyongInterpretation}</Text>
          </Paragraph>
        ) : (
          <Paragraph className="analysis-hint">
            <InfoCircleOutlined style={{ marginRight: 8 }} />
            梅花易数以"体用"论吉凶。体卦代表自身，用卦代表所问之事。
            用生体、体克用为吉；体生用、用克体为凶；比和中平。
          </Paragraph>
        )}
      </Card>

      {/* 卦辞爻辞展示 */}
      {hexagramDetail?.benGua && (
        <Card title="卦辞爻辞" className="guaci-card">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="卦辞">
              <Text>{hexagramDetail.benGua.guaci || '暂无'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="动爻爻辞">
              <Text>{hexagramDetail.benGua.dongYaoCi || '暂无'}</Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 互卦、错卦、综卦、伏卦展示 */}
      {hexagramDetail && (
        <Card title="衍生卦象" className="derived-hexagrams-card">
          <Row gutter={[16, 16]}>
            {/* 互卦 */}
            <Col span={12}>
              <div className="derived-hexagram">
                <div className="derived-title">互卦</div>
                <div className="derived-symbol">
                  {hexagramDetail.huGua.shangGuaSymbol}{hexagramDetail.huGua.xiaGuaSymbol}
                </div>
                <div className="derived-name">{hexagramDetail.huGua.name}</div>
                <div className="derived-wuxing">
                  <Tag>{hexagramDetail.huGua.shangGuaWuxing}</Tag>
                  <Tag>{hexagramDetail.huGua.xiaGuaWuxing}</Tag>
                </div>
              </div>
            </Col>

            {/* 伏卦（新增） */}
            <Col span={12}>
              <div className="derived-hexagram fu-gua">
                <div className="derived-title">
                  伏卦
                  <Text type="secondary" style={{ fontSize: '12px', marginLeft: 4 }}>（飞伏神）</Text>
                </div>
                <div className="derived-symbol">
                  {hexagramDetail.fuGua.shangGuaSymbol}{hexagramDetail.fuGua.xiaGuaSymbol}
                </div>
                <div className="derived-name">{hexagramDetail.fuGua.name}</div>
                <div className="derived-wuxing">
                  <Tag color="purple">{hexagramDetail.fuGua.shangGuaWuxing}</Tag>
                  <Tag color="purple">{hexagramDetail.fuGua.xiaGuaWuxing}</Tag>
                </div>
              </div>
            </Col>

            {/* 错卦 */}
            <Col span={12}>
              <div className="derived-hexagram">
                <div className="derived-title">错卦</div>
                <div className="derived-symbol">
                  {hexagramDetail.cuoGua.shangGuaSymbol}{hexagramDetail.cuoGua.xiaGuaSymbol}
                </div>
                <div className="derived-name">{hexagramDetail.cuoGua.name}</div>
                <div className="derived-wuxing">
                  <Tag>{hexagramDetail.cuoGua.shangGuaWuxing}</Tag>
                  <Tag>{hexagramDetail.cuoGua.xiaGuaWuxing}</Tag>
                </div>
              </div>
            </Col>

            {/* 综卦 */}
            <Col span={12}>
              <div className="derived-hexagram">
                <div className="derived-title">综卦</div>
                <div className="derived-symbol">
                  {hexagramDetail.zongGua.shangGuaSymbol}{hexagramDetail.zongGua.xiaGuaSymbol}
                </div>
                <div className="derived-name">{hexagramDetail.zongGua.name}</div>
                <div className="derived-wuxing">
                  <Tag>{hexagramDetail.zongGua.shangGuaWuxing}</Tag>
                  <Tag>{hexagramDetail.zongGua.xiaGuaWuxing}</Tag>
                </div>
              </div>
            </Col>
          </Row>

          <Divider />

          <Paragraph className="derived-hint">
            <InfoCircleOutlined style={{ marginRight: 8 }} />
            <Text type="secondary">
              <strong>互卦</strong>：取本卦2-4爻为下卦、3-5爻为上卦，反映事物内在变化。
              <strong>伏卦</strong>：八卦各有其对应的伏卦，代表隐藏的五行因素。
              <strong>错卦</strong>：本卦所有爻阴阳互变，从对立角度看问题。
              <strong>综卦</strong>：本卦上下颠倒，从他人角度看问题。
            </Text>
          </Paragraph>
        </Card>
      )}

      {/* 解读服务 */}
      <Card title="获取解读" className="service-card">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            size="large"
            block
            onClick={handleRequestAi}
          >
            AI 智能解卦
          </Button>
          <Text type="secondary" className="service-hint">
            基于传统梅花易数理论，由 AI 快速生成专业解读
          </Text>

          <Divider />

          <Button
            icon={<UserOutlined />}
            size="large"
            block
            onClick={handleFindMaster}
          >
            找大师人工解读
          </Button>
          <Text type="secondary" className="service-hint">
            由认证大师提供个性化解读，可追问互动
          </Text>

          <Divider />

          <Button
            icon={<GiftOutlined />}
            size="large"
            block
            onClick={() => setBountyModalVisible(true)}
            style={{ borderColor: '#faad14', color: '#faad14' }}
          >
            发起悬赏问答
          </Button>
          <Text type="secondary" className="service-hint">
            设置悬赏金额，邀请多位大师解读，投票选出最佳答案
          </Text>
        </Space>
      </Card>

      {/* 已有解读展示 */}
      {interpretation && (
        <Card title="解读结果" className="interpretation-card">
          <Paragraph>
            {/* TODO: 从 IPFS 加载解读内容 */}
            解读内容加载中...
          </Paragraph>
        </Card>
      )}

      {/* 操作按钮 */}
      <div className="action-buttons">
        <Space>
          <Button onClick={() => navigate('/meihua/list')}>
            返回列表
          </Button>
          <Button onClick={() => navigate('/meihua')}>
            重新起卦
          </Button>
          {hexagram.status === HexagramStatus.Active && (
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={archiving}
              onClick={handleArchive}
            >
              归档
            </Button>
          )}
        </Space>
      </div>

      {/* 悬赏问答弹窗 */}
      {hexagram && (
        <CreateBountyModal
          visible={bountyModalVisible}
          divinationType={DivinationType.Meihua}
          resultId={hexagram.id}
          userAccount={userAccount}
          onCancel={() => setBountyModalVisible(false)}
          onSuccess={(bountyId) => {
            setBountyModalVisible(false);
            message.success('悬赏创建成功！');
            // 跳转到悬赏详情页
            window.location.hash = `#/bounty/${bountyId}`;
          }}
        />
      )}
    </div>
  );
};

export default HexagramDetailPage;
