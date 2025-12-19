/**
 * 六爻详情页面
 *
 * 显示六爻卦象的详细信息，包括：
 * - 基本卦象信息（本卦、变卦、互卦）
 * - 六爻详细排盘（地支、五行、六亲、六神、世应）
 * - 核心解卦结果（链上 Runtime API 计算）
 * - 完整解卦结果（可选）
 * - AI 解读入口
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
  Descriptions,
  Result,
  Row,
  Col,
  Progress,
  Tabs,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  RobotOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  FireOutlined,
} from '@ant-design/icons';
import * as liuyaoService from '../../services/liuyaoService';
import type {
  LiuyaoGua,
  YaoInfo,
  LiuYaoCoreInterpretation,
  LiuYaoFullInterpretation,
  ShiXiangType,
} from '../../types/liuyao';
import {
  GUA_NAMES,
  DI_ZHI_NAMES,
  TIAN_GAN_NAMES,
  WU_XING_NAMES,
  WU_XING_COLORS,
  LIU_QIN_NAMES,
  LIU_SHEN_NAMES,
  WANG_SHUAI_NAMES,
  WANG_SHUAI_COLORS,
  RI_CHEN_GUANXI_NAMES,
  YAO_SYMBOLS,
  YAO_TYPE_NAMES,
  SHEN_SHA_NAMES,
  SHEN_SHA_DESC,
  JI_XIONG_NAMES,
  JI_XIONG_DESC,
  YONG_SHEN_STATE_NAMES,
  YONG_SHEN_STATE_DESC,
  SHI_XIANG_NAMES,
  YING_QI_NAMES,
  JIE_GUA_TEXTS,
  isShenShaAuspicious,
  isDongYao,
} from '../../types/liuyao';

const { Title, Text, Paragraph } = Typography;

/**
 * 爻显示组件
 */
const YaoDisplay: React.FC<{
  yao: YaoInfo;
  showDetails?: boolean;
}> = ({ yao, showDetails = true }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '12px 0',
      borderBottom: '1px solid #f0f0f0',
      flexWrap: 'wrap',
    }}
  >
    {/* 爻位 */}
    <div style={{ width: 40 }}>
      <Text strong style={{ fontSize: 14 }}>
        {['初', '二', '三', '四', '五', '上'][yao.position - 1]}爻
      </Text>
    </div>

    {/* 爻符号 */}
    <div style={{ fontFamily: 'monospace', fontSize: 18, width: 60 }}>
      {YAO_SYMBOLS[yao.type]}
    </div>

    {/* 爻属性 */}
    <Space size={4} wrap>
      {/* 六神 */}
      <Tag color="purple" style={{ margin: 0 }}>
        {LIU_SHEN_NAMES[yao.liuShen]}
      </Tag>

      {/* 六亲 */}
      <Tag color="blue" style={{ margin: 0 }}>
        {LIU_QIN_NAMES[yao.liuQin]}
      </Tag>

      {/* 地支 */}
      <Tag style={{ margin: 0 }}>
        {DI_ZHI_NAMES[yao.diZhi]}
      </Tag>

      {/* 五行 */}
      <Tag color={WU_XING_COLORS[yao.wuXing]} style={{ margin: 0 }}>
        {WU_XING_NAMES[yao.wuXing]}
      </Tag>

      {/* 世应 */}
      {yao.isShi && <Tag color="red" style={{ margin: 0 }}>世</Tag>}
      {yao.isYing && <Tag color="green" style={{ margin: 0 }}>应</Tag>}

      {/* 动爻 */}
      {yao.isDong && <Tag color="orange" style={{ margin: 0 }}>动</Tag>}

      {/* 旺衰 */}
      {showDetails && yao.wangShuai !== undefined && (
        <Tag color={WANG_SHUAI_COLORS[yao.wangShuai]} style={{ margin: 0 }}>
          {WANG_SHUAI_NAMES[yao.wangShuai]}
        </Tag>
      )}

      {/* 旬空 */}
      {showDetails && yao.isXunKong && <Tag color="gray" style={{ margin: 0 }}>空</Tag>}

      {/* 神煞 */}
      {showDetails && yao.shenShaList && yao.shenShaList.length > 0 && (
        yao.shenShaList.map((sha, idx) => (
          <Tag
            key={idx}
            color={isShenShaAuspicious(sha) ? 'green' : 'red'}
            style={{ margin: 0, fontSize: 11 }}
          >
            {SHEN_SHA_NAMES[sha]}
          </Tag>
        ))
      )}
    </Space>

    {/* 变爻信息 */}
    {yao.isDong && yao.bianDiZhi !== undefined && (
      <div style={{ width: '100%', marginTop: 4, paddingLeft: 100 }}>
        <Space size={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>→</Text>
          <Tag size="small">{DI_ZHI_NAMES[yao.bianDiZhi]}</Tag>
          {yao.bianWuXing !== undefined && (
            <Tag size="small" color={WU_XING_COLORS[yao.bianWuXing]}>
              {WU_XING_NAMES[yao.bianWuXing]}
            </Tag>
          )}
          {yao.bianLiuQin !== undefined && (
            <Tag size="small" color="blue">{LIU_QIN_NAMES[yao.bianLiuQin]}</Tag>
          )}
          {yao.huiTouZuoYong !== undefined && (
            <Tag size="small" color="volcano">
              {['回头生', '回头克', '回头泄', '回头耗', '比和'][yao.huiTouZuoYong]}
            </Tag>
          )}
        </Space>
      </div>
    )}
  </div>
);

/**
 * 核心解卦结果显示组件
 */
const CoreInterpretationDisplay: React.FC<{
  core: LiuYaoCoreInterpretation;
  shiXiang: ShiXiangType;
}> = ({ core, shiXiang }) => {
  // 吉凶颜色
  const jiXiongColor = core.jiXiong <= 2 ? 'success' : core.jiXiong === 3 ? 'warning' : 'error';
  const jiXiongPercent = core.score;

  return (
    <Card>
      <Title level={5}>
        <FireOutlined /> 核心解卦结果
      </Title>

      {/* 吉凶总断 */}
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <Progress
          type="circle"
          percent={jiXiongPercent}
          format={() => (
            <div>
              <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                {JI_XIONG_NAMES[core.jiXiong]}
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>{core.score}分</div>
            </div>
          )}
          status={jiXiongColor}
        />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">{JI_XIONG_DESC[core.jiXiong]}</Text>
        </div>
      </div>

      <Divider />

      {/* 用神分析 */}
      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="占问事项">
          <Tag color="blue">{SHI_XIANG_NAMES[shiXiang]}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="用神六亲">
          <Tag color="cyan">{LIU_QIN_NAMES[core.yongShenQin]}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="用神状态">
          <Tag color={core.yongShenState <= 1 ? 'green' : 'red'}>
            {YONG_SHEN_STATE_NAMES[core.yongShenState]}
          </Tag>
          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
            {YONG_SHEN_STATE_DESC[core.yongShenState]}
          </Text>
        </Descriptions.Item>
        {core.yongShenPos !== 255 && (
          <Descriptions.Item label="用神位置">
            {['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][core.yongShenPos]}
          </Descriptions.Item>
        )}
        <Descriptions.Item label="世爻状态">
          <Tag color={core.shiYaoState <= 1 ? 'green' : 'volcano'}>
            {YONG_SHEN_STATE_NAMES[core.shiYaoState]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="应爻状态">
          <Tag color={core.yingYaoState <= 1 ? 'green' : 'volcano'}>
            {YONG_SHEN_STATE_NAMES[core.yingYaoState]}
          </Tag>
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      {/* 动爻信息 */}
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Text strong>动爻情况：</Text>
          <Tag color="orange" style={{ marginLeft: 8 }}>
            {core.dongYaoCount} 个动爻
          </Tag>
        </div>

        {/* 应期 */}
        <div>
          <Text strong>应期分析：</Text>
          <Tag color="blue" style={{ marginLeft: 8 }}>
            {YING_QI_NAMES[core.yingQi]}
          </Tag>
          <Tag style={{ marginLeft: 4 }}>
            {DI_ZHI_NAMES[core.yingQiZhi]}日/月
          </Tag>
        </div>

        {/* 可信度 */}
        <div>
          <Text strong>解卦可信度：</Text>
          <Progress
            percent={core.confidence}
            size="small"
            status={core.confidence >= 80 ? 'success' : core.confidence >= 60 ? 'normal' : 'exception'}
            style={{ width: 200, display: 'inline-block', marginLeft: 8 }}
          />
        </div>
      </Space>
    </Card>
  );
};

/**
 * 六爻详情页面组件
 */
const LiuyaoDetailPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [gua, setGua] = useState<LiuyaoGua | null>(null);
  const [coreInterpretation, setCoreInterpretation] = useState<LiuYaoCoreInterpretation | null>(null);
  const [fullInterpretation, setFullInterpretation] = useState<LiuYaoFullInterpretation | null>(null);
  const [shiXiang, setShiXiang] = useState<ShiXiangType>(0); // 默认：财运
  const [interpretationLoading, setInterpretationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 使用 useRef 避免循环依赖
  const retryCountRef = React.useRef(0);
  const [retryDisplay, setRetryDisplay] = useState(0);

  // 从 URL 获取卦象 ID
  const guaId = parseInt(window.location.hash.split('/')[2]) || 0;

  /**
   * 加载卦象数据（带重试机制）
   */
  const loadGua = useCallback(async (isRetry = false) => {
    if (!guaId) {
      message.error('卦象 ID 无效');
      setLoading(false);
      setError('卦象 ID 无效');
      return;
    }

    if (!isRetry) {
      setLoading(true);
      setError(null);
      retryCountRef.current = 0;
      setRetryDisplay(0);
    }

    try {
      console.log(`[LiuyaoDetailPage] 尝试加载卦象 ${guaId}，第 ${retryCountRef.current + 1} 次...`);
      const guaData = await liuyaoService.getGua(guaId);

      if (!guaData) {
        // 如果是首次加载且数据为空，可能是区块还在确认中
        if (retryCountRef.current < 3) {
          console.log('[LiuyaoDetailPage] 卦象数据为空，2秒后重试...');
          retryCountRef.current += 1;
          setRetryDisplay(retryCountRef.current);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return loadGua(true);
        }

        const errorMsg = '卦象不存在或区块链数据尚未确认，请稍后刷新页面重试';
        setError(errorMsg);
        message.warning(errorMsg);
        setGua(null);
        return;
      }

      setGua(guaData);
      retryCountRef.current = 0;
      setRetryDisplay(0);
      setError(null);
      console.log('[LiuyaoDetailPage] 卦象数据加载成功:', guaData);
    } catch (error: any) {
      console.error('[LiuyaoDetailPage] 加载卦象失败:', error);

      // 如果是网络错误，尝试重试
      if (retryCountRef.current < 3) {
        console.log('[LiuyaoDetailPage] 加载失败，2秒后重试...');
        retryCountRef.current += 1;
        setRetryDisplay(retryCountRef.current);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return loadGua(true);
      }

      const errorMsg = `加载卦象失败: ${error.message}`;
      setError(errorMsg);
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [guaId]); // 只依赖 guaId

  /**
   * 加载核心解卦结果
   */
  const loadCoreInterpretation = useCallback(async () => {
    if (!guaId) return;

    setInterpretationLoading(true);
    try {
      const result = await liuyaoService.getCoreInterpretation(guaId, shiXiang);
      if (result) {
        setCoreInterpretation(result);
        message.success('核心解卦结果加载成功');
      } else {
        message.warning('暂无解卦结果');
      }
    } catch (error: any) {
      console.error('[LiuyaoDetailPage] 加载解卦失败:', error);
      message.error(`加载解卦失败: ${error.message}`);
    } finally {
      setInterpretationLoading(false);
    }
  }, [guaId, shiXiang]);

  /**
   * 加载完整解卦结果
   */
  const loadFullInterpretation = useCallback(async () => {
    if (!guaId) return;

    setInterpretationLoading(true);
    try {
      const result = await liuyaoService.getFullInterpretation(guaId, shiXiang);
      if (result) {
        setFullInterpretation(result);
        setCoreInterpretation(result.core);
        message.success('完整解卦结果加载成功');
      } else {
        message.warning('暂无完整解卦结果');
      }
    } catch (error: any) {
      console.error('[LiuyaoDetailPage] 加载完整解卦失败:', error);
      message.error(`加载完整解卦失败: ${error.message}`);
    } finally {
      setInterpretationLoading(false);
    }
  }, [guaId, shiXiang]);

  // 页面加载时获取卦象数据
  useEffect(() => {
    loadGua();
  }, [loadGua]);

  // 页面加载时自动获取核心解卦结果
  useEffect(() => {
    if (gua && !coreInterpretation) {
      loadCoreInterpretation();
    }
  }, [gua, coreInterpretation, loadCoreInterpretation]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" tip={retryDisplay > 0 ? `正在重试加载卦象... (${retryDisplay}/3)` : '加载卦象中...'} />
      </div>
    );
  }

  if (!gua || error) {
    return (
      <div style={{ padding: 12, maxWidth: 414, paddingBottom: 80, minHeight: '100vh', background: 'linear-gradient(180deg, #F5F5F7 0%, #ffffff 100%)', margin: '0 auto' }}>
        <Result
          status="warning"
          title="卦象加载失败"
          subTitle={error || '该卦象不存在或区块链数据尚未确认'}
          extra={[
            <Button
              type="primary"
              key="retry"
              icon={<ReloadOutlined />}
              onClick={() => {
                retryCountRef.current = 0;
                setRetryDisplay(0);
                loadGua();
              }}
            >
              重新加载
            </Button>,
            <Button key="back" onClick={() => (window.location.hash = '#/liuyao')}>
              返回六爻占卜
            </Button>,
          ]}
        >
          <div style={{ marginTop: 16 }}>
            <Alert
              message="可能的原因"
              description={
                <ul style={{ textAlign: 'left', paddingLeft: 20, marginBottom: 0 }}>
                  <li>区块链交易还在确认中，请稍等片刻后刷新</li>
                  <li>卦象 ID 不正确</li>
                  <li>网络连接问题</li>
                  <li>节点暂时不可用</li>
                </ul>
              }
              type="info"
            />
          </div>
        </Result>
      </div>
    );
  }

  return (
    <div style={{ padding: 12, maxWidth: 414, paddingBottom: 80, minHeight: '100vh', background: 'linear-gradient(180deg, #F5F5F7 0%, #ffffff 100%)', margin: '0 auto' }}>
      {/* 页面标题 */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>
            <ThunderboltOutlined /> {gua.benGuaName}
          </Title>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => (window.location.hash = '#/liuyao')}
          >
            返回
          </Button>
        </div>
      </Card>

      {/* 基本信息 */}
      <Card style={{ marginTop: 16 }}>
        <Title level={5}>卦象信息</Title>
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="本卦">
            <Tag color="blue">{gua.benGuaName}</Tag>
            <Text type="secondary"> (卦{gua.benGuaIndex})</Text>
          </Descriptions.Item>
          {gua.bianGuaName && (
            <Descriptions.Item label="变卦">
              <Tag color="orange">{gua.bianGuaName}</Tag>
              <Text type="secondary"> (卦{gua.bianGuaIndex})</Text>
            </Descriptions.Item>
          )}
          {gua.huGuaName && (
            <Descriptions.Item label="互卦">
              <Tag color="purple">{gua.huGuaName}</Tag>
              <Text type="secondary"> (卦{gua.huGuaIndex})</Text>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="日辰">
            {TIAN_GAN_NAMES[gua.riGan]}{DI_ZHI_NAMES[gua.riChen]}日
          </Descriptions.Item>
          <Descriptions.Item label="月建">
            {DI_ZHI_NAMES[gua.yueJian]}月
          </Descriptions.Item>
          {gua.xunKong && (
            <Descriptions.Item label="旬空">
              {DI_ZHI_NAMES[gua.xunKong[0]]}、{DI_ZHI_NAMES[gua.xunKong[1]]}
            </Descriptions.Item>
          )}
          {gua.guaShen !== undefined && (
            <Descriptions.Item label="卦身">
              {DI_ZHI_NAMES[gua.guaShen]}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="卦象特征">
            <Space wrap>
              {gua.isLiuChong && <Tag color="red">六冲</Tag>}
              {gua.isLiuHe && <Tag color="green">六合</Tag>}
              {gua.isFanYin && <Tag color="volcano">反吟</Tag>}
              {gua.isFuYin && <Tag color="orange">伏吟</Tag>}
              {!gua.isLiuChong && !gua.isLiuHe && !gua.isFanYin && !gua.isFuYin && (
                <Tag color="default">普通卦</Tag>
              )}
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 六爻排盘 */}
      <Card style={{ marginTop: 16 }}>
        <Title level={5}>六爻排盘</Title>
        <div style={{ display: 'flex', flexDirection: 'column-reverse' }}>
          {gua.yaos.map((yao, idx) => (
            <YaoDisplay key={idx} yao={yao} showDetails={true} />
          ))}
        </div>
      </Card>

      {/* 解卦控制 */}
      <Card style={{ marginTop: 16 }}>
        <Title level={5}>
          <InfoCircleOutlined /> 解卦设置
        </Title>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>选择占问事项：</Text>
            <div style={{ marginTop: 8 }}>
              <Space wrap>
                {Object.entries(SHI_XIANG_NAMES).map(([key, name]) => (
                  <Button
                    key={key}
                    type={shiXiang === parseInt(key) ? 'primary' : 'default'}
                    size="small"
                    onClick={() => setShiXiang(parseInt(key) as ShiXiangType)}
                  >
                    {name}
                  </Button>
                ))}
              </Space>
            </div>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <Space>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={loadCoreInterpretation}
              loading={interpretationLoading}
            >
              获取核心解卦
            </Button>
            <Button
              icon={<FireOutlined />}
              onClick={loadFullInterpretation}
              loading={interpretationLoading}
            >
              获取完整解卦
            </Button>
          </Space>

          <Alert
            message="解卦说明"
            description="核心解卦提供吉凶总断、用神分析等关键信息（免费）；完整解卦包含六爻详细分析、神煞汇总等更多内容。解卦结果通过链上 Runtime API 实时计算，不消耗 Gas。"
            type="info"
            showIcon
          />
        </Space>
      </Card>

      {/* 核心解卦结果 */}
      {coreInterpretation && (
        <div style={{ marginTop: 16 }}>
          <CoreInterpretationDisplay core={coreInterpretation} shiXiang={shiXiang} />
        </div>
      )}

      {/* 完整解卦结果 */}
      {fullInterpretation && (
        <Card style={{ marginTop: 16 }}>
          <Title level={5}>完整解卦结果</Title>
          <Tabs
            items={[
              {
                key: 'liuqin',
                label: '六亲分析',
                children: (
                  <div>
                    <Descriptions bordered size="small" column={1}>
                      {Object.entries(fullInterpretation.liuQin).map(([key, state]) => (
                        <Descriptions.Item
                          key={key}
                          label={
                            {
                              fuMu: '父母爻',
                              xiongDi: '兄弟爻',
                              ziSun: '子孙爻',
                              qiCai: '妻财爻',
                              guanGui: '官鬼爻',
                            }[key]
                          }
                        >
                          <Space>
                            <Tag>{state.count} 个</Tag>
                            <Tag color={state.wangShuai <= 1 ? 'green' : 'red'}>
                              {YONG_SHEN_STATE_NAMES[state.wangShuai]}
                            </Tag>
                            {state.hasFuShen && <Tag color="purple">有伏神</Tag>}
                          </Space>
                        </Descriptions.Item>
                      ))}
                    </Descriptions>
                  </div>
                ),
              },
              {
                key: 'shensha',
                label: '神煞汇总',
                children: (
                  <div>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <Text strong>吉神：</Text>
                        <Tag color="green" style={{ marginLeft: 8 }}>
                          {fullInterpretation.shenSha.jiShenCount} 个
                        </Tag>
                      </div>
                      {Array.isArray(fullInterpretation.shenSha.jiShen) && fullInterpretation.shenSha.jiShen.length > 0 && (
                        <Space wrap>
                          {fullInterpretation.shenSha.jiShen.map((sha, idx) => (
                            <Tag key={idx} color="green">
                              {SHEN_SHA_NAMES[sha]} ({['初', '二', '三', '四', '五', '上'][fullInterpretation.shenSha.jiShenPos[idx]]}爻)
                            </Tag>
                          ))}
                        </Space>
                      )}
                      <Divider style={{ margin: '8px 0' }} />
                      <div>
                        <Text strong>凶煞：</Text>
                        <Tag color="red" style={{ marginLeft: 8 }}>
                          {fullInterpretation.shenSha.xiongShaCount} 个
                        </Tag>
                      </div>
                      {Array.isArray(fullInterpretation.shenSha.xiongSha) && fullInterpretation.shenSha.xiongSha.length > 0 && (
                        <Space wrap>
                          {fullInterpretation.shenSha.xiongSha.map((sha, idx) => (
                            <Tag key={idx} color="red">
                              {SHEN_SHA_NAMES[sha]} ({['初', '二', '三', '四', '五', '上'][fullInterpretation.shenSha.xiongShaPos[idx]]}爻)
                            </Tag>
                          ))}
                        </Space>
                      )}
                    </Space>
                  </div>
                ),
              },
              {
                key: 'yaos',
                label: '各爻分析',
                children: (
                  <div>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {fullInterpretation.yaos.map((yao, idx) => (
                        <Card key={idx} size="small">
                          <Text strong>{['初', '二', '三', '四', '五', '上'][yao.position]}爻：</Text>
                          <Space wrap style={{ marginTop: 8 }}>
                            <Tag color={yao.wangShuai <= 1 ? 'green' : 'red'}>
                              {YONG_SHEN_STATE_NAMES[yao.wangShuai]}
                            </Tag>
                            {yao.isKong && <Tag color="gray">旬空</Tag>}
                            {yao.isYuePo && <Tag color="volcano">月破</Tag>}
                            {yao.isRiChong && <Tag color="orange">日冲</Tag>}
                            {yao.isDong && <Tag color="orange">动爻</Tag>}
                            {yao.shenShaCount > 0 && (
                              <Tag color="purple">{yao.shenShaCount} 个神煞</Tag>
                            )}
                          </Space>
                        </Card>
                      ))}
                    </Space>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* AI 解读入口（预留） */}
      <Card style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%', textAlign: 'center' }}>
          <RobotOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          <Title level={5}>AI 深度解读</Title>
          <Paragraph type="secondary">
            基于链上解卦结果，AI 将为您提供更详细、更人性化的解读，包括具体建议和注意事项。
          </Paragraph>
          <Button type="primary" icon={<RobotOutlined />} disabled>
            请求 AI 解读（即将开放）
          </Button>
        </Space>
      </Card>

      {/* 底部返回 */}
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => (window.location.hash = '#/liuyao')}
        >
          返回六爻占卜
        </Button>
      </div>
    </div>
  );
};

export default LiuyaoDetailPage;
