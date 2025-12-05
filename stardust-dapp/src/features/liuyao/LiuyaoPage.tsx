/**
 * 六爻占卜页面
 *
 * 功能：
 * - 铜钱摇卦（三枚铜钱六次）
 * - 手动输入卦象
 * - 显示六爻排盘
 * - 六亲、六神、世应分析
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
  Result,
  Steps,
  Switch,
} from 'antd';
import {
  ThunderboltOutlined,
  HistoryOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
  CloudOutlined,
  DesktopOutlined,
} from '@ant-design/icons';

import {
  YaoType,
  YAO_SYMBOLS,
  YAO_TYPE_NAMES,
  LIU_QIN_SHORT,
  LIU_SHEN_SHORT,
  DI_ZHI_NAMES,
  WU_XING_NAMES,
  WU_XING_COLORS,
  GUA_NAMES,
  calculateYaoFromCoins,
  isDongYao,
  type CoinResult,
} from '../../types/liuyao';
import * as liuyaoService from '../../services/liuyaoService';
import { getGanZhiFromDate } from '../../services/liuyaoService';

const { Title, Text, Paragraph } = Typography;

/**
 * 铜钱组件
 */
const CoinDisplay: React.FC<{ isYang: boolean; onClick?: () => void }> = ({ isYang, onClick }) => (
  <div
    className="coin"
    onClick={onClick}
    style={{
      width: 48,
      height: 48,
      borderRadius: '50%',
      backgroundColor: isYang ? '#faad14' : '#d9d9d9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: onClick ? 'pointer' : 'default',
      fontSize: 20,
      fontWeight: 'bold',
      color: isYang ? '#fff' : '#666',
      border: '2px solid',
      borderColor: isYang ? '#d48806' : '#bfbfbf',
      transition: 'all 0.3s',
    }}
  >
    {isYang ? '字' : '背'}
  </div>
);

/**
 * 爻符号显示
 */
const YaoDisplay: React.FC<{
  yaoType: YaoType;
  position: number;
  diZhi?: string;
  wuXing?: string;
  liuQin?: string;
  liuShen?: string;
  isShi?: boolean;
  isYing?: boolean;
}> = ({ yaoType, position, diZhi, wuXing, liuQin, liuShen, isShi, isYing }) => (
  <div
    className="yao-row"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 0',
      borderBottom: '1px solid #f0f0f0',
    }}
  >
    <Text type="secondary" style={{ width: 24 }}>{position}爻</Text>
    <div style={{ flex: 1, textAlign: 'center', fontFamily: 'monospace', fontSize: 18 }}>
      {YAO_SYMBOLS[yaoType]}
    </div>
    {diZhi && <Tag>{diZhi}</Tag>}
    {wuXing && <Tag color={WU_XING_COLORS[parseInt(wuXing) || 0]}>{wuXing}</Tag>}
    {liuQin && <Tag color="blue">{liuQin}</Tag>}
    {liuShen && <Tag color="purple">{liuShen}</Tag>}
    {isShi && <Tag color="red">世</Tag>}
    {isYing && <Tag color="green">应</Tag>}
    {isDongYao(yaoType) && <Tag color="orange">动</Tag>}
  </div>
);

/**
 * 六爻占卜页面
 */
const LiuyaoPage: React.FC = () => {
  // 状态
  const [step, setStep] = useState(0); // 当前步骤 (0-5 对应六爻)
  const [coinResults, setCoinResults] = useState<CoinResult[]>([]);
  const [currentCoins, setCurrentCoins] = useState<[boolean, boolean, boolean]>([true, true, true]);
  const [shaking, setShaking] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [useChain, setUseChain] = useState(false); // 是否使用链端
  const [chainGuaId, setChainGuaId] = useState<number | null>(null); // 链端卦象ID

  // 时间起卦相关状态
  const [divinationMethod, setDivinationMethod] = useState<'coin' | 'time' | 'random' | 'number'>('coin'); // 起卦方法
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // 选择的日期
  const [selectedHour, setSelectedHour] = useState<number>(0); // 选择的时辰

  /**
   * 摇铜钱（本地模式）
   */
  const handleShake = useCallback(async () => {
    if (shaking) return;

    setShaking(true);

    // 模拟摇动动画
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      setCurrentCoins([
        Math.random() > 0.5,
        Math.random() > 0.5,
        Math.random() > 0.5,
      ]);
    }

    // 最终结果
    const finalCoins: [boolean, boolean, boolean] = [
      Math.random() > 0.5,
      Math.random() > 0.5,
      Math.random() > 0.5,
    ];
    setCurrentCoins(finalCoins);

    const yaoType = calculateYaoFromCoins(finalCoins);
    const newResult: CoinResult = {
      yaoIndex: step + 1,
      coins: finalCoins,
      yaoType,
    };

    setCoinResults(prev => [...prev, newResult]);
    setShaking(false);

    // 检查是否完成
    if (step >= 5) {
      setCompleted(true);
      message.success('卦象已成，可查看排盘结果');
    } else {
      setStep(step + 1);
    }
  }, [step, shaking]);

  /**
   * 链端随机起卦
   */
  const handleChainDivine = useCallback(async () => {
    setShaking(true);
    try {
      const guaId = await liuyaoService.divineRandom();
      setChainGuaId(guaId);
      setCompleted(true);
      message.success(`链端起卦成功，卦象ID: ${guaId}`);
    } catch (error: any) {
      console.error('链端起卦失败:', error);
      message.error(`链端起卦失败: ${error.message || '请检查钱包连接'}`);
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
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      const day = selectedDate.getDate();

      // 获取干支信息
      const ganZhi = getGanZhiFromDate(selectedDate);

      // 转换为地支数字（0-11）
      const yearZhi = ganZhi.year[1]; // 年支
      const monthNum = month; // 月数
      const dayNum = day; // 日数
      const hourZhi = selectedHour % 12; // 时支

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
      message.success(`时间起卦成功，卦象ID: ${guaId}`);
    } catch (error: any) {
      console.error('时间起卦失败:', error);
      message.error(`时间起卦失败: ${error.message || '请检查钱包连接'}`);
    } finally {
      setShaking(false);
    }
  }, [selectedDate, selectedHour]);

  /**
   * 重新开始
   */
  const handleReset = useCallback(() => {
    setStep(0);
    setCoinResults([]);
    setCurrentCoins([true, true, true]);
    setCompleted(false);
    setChainGuaId(null);
    setDivinationMethod('coin');
    setSelectedDate(new Date());
    setSelectedHour(0);
  }, []);

  /**
   * 渲染摇卦界面
   */
  const renderShakeInterface = () => (
    <Card className="shake-card">
      <Title level={4} className="page-title">
        <ThunderboltOutlined /> 六爻占卜 · 摇卦
      </Title>
      <Paragraph type="secondary" className="page-subtitle">
        心中默念所问之事，点击摇卦按钮
      </Paragraph>

      {/* 链端/本地切换 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch
          checked={useChain}
          onChange={setUseChain}
          checkedChildren={<CloudOutlined />}
          unCheckedChildren={<DesktopOutlined />}
        />
        <Text type="secondary">
          {useChain ? '链端起卦（结果上链存储）' : '本地起卦（快速预览）'}
        </Text>
      </div>

      {/* 起卦方法选择（仅链端模式） */}
      {useChain && (
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#fafafa', borderRadius: 4 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>起卦方法：</Text>
          <Space wrap>
            <Button
              type={divinationMethod === 'random' ? 'primary' : 'default'}
              onClick={() => setDivinationMethod('random')}
              size="small"
            >
              随机起卦
            </Button>
            <Button
              type={divinationMethod === 'time' ? 'primary' : 'default'}
              onClick={() => setDivinationMethod('time')}
              size="small"
            >
              时间起卦
            </Button>
          </Space>
        </div>
      )}

      {/* 时间起卦 - 时间选择器 */}
      {useChain && divinationMethod === 'time' && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>选择日期和时辰：</Text>
            </div>
            <div>
              <Text type="secondary">日期：</Text>
              <div style={{ marginTop: 8 }}>
                <input
                  type="date"
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value);
                    setSelectedDate(newDate);
                  }}
                  style={{ width: '100%', padding: 8, border: '1px solid #d9d9d9', borderRadius: 4 }}
                />
              </div>
            </div>
            <div>
              <Text type="secondary">时辰：</Text>
              <div style={{ marginTop: 8 }}>
                <select
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(parseInt(e.target.value))}
                  style={{ width: '100%', padding: 8, border: '1px solid #d9d9d9', borderRadius: 4 }}
                >
                  {DI_ZHI_NAMES.map((name, idx) => (
                    <option key={idx} value={idx}>
                      {name}时 ({[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22][idx]}-{[2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24][idx]}点)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Space>
        </Card>
      )}

      <Divider />

      {/* 进度步骤 */}
      <Steps
        current={step}
        size="small"
        items={[
          { title: '初爻' },
          { title: '二爻' },
          { title: '三爻' },
          { title: '四爻' },
          { title: '五爻' },
          { title: '上爻' },
        ]}
        style={{ marginBottom: 24 }}
      />

      {/* 铜钱显示 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
        <CoinDisplay isYang={currentCoins[0]} />
        <CoinDisplay isYang={currentCoins[1]} />
        <CoinDisplay isYang={currentCoins[2]} />
      </div>

      {/* 当前爻信息 */}
      {!completed && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Text>第 {step + 1} 爻（{['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][step]}）</Text>
        </div>
      )}

      {/* 已摇结果 */}
      {/* 本地模式：已摇卦爻显示 */}
      {!useChain && coinResults.length > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Text strong>已摇卦爻：</Text>
          <div style={{ marginTop: 8 }}>
            {coinResults.map((result, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Text type="secondary">{idx + 1}爻:</Text>
                <span style={{ fontFamily: 'monospace' }}>{YAO_SYMBOLS[result.yaoType]}</span>
                <Tag>{YAO_TYPE_NAMES[result.yaoType]}</Tag>
                {isDongYao(result.yaoType) && <Tag color="orange">动爻</Tag>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 链端模式：卦象ID显示 */}
      {useChain && chainGuaId !== null && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Text strong>链端卦象ID：</Text>
          <Tag color="blue" style={{ marginLeft: 8, fontSize: 14 }}>{chainGuaId}</Tag>
        </Card>
      )}

      {/* 操作按钮 */}
      <Space direction="vertical" style={{ width: '100%' }}>
        {!completed ? (
          useChain ? (
            divinationMethod === 'time' ? (
              <Button
                type="primary"
                size="large"
                block
                onClick={handleTimeMethodDivine}
                loading={shaking}
                icon={<CloudOutlined />}
              >
                {shaking ? '时间起卦中...' : '时间起卦'}
              </Button>
            ) : (
              <Button
                type="primary"
                size="large"
                block
                onClick={handleChainDivine}
                loading={shaking}
                icon={<CloudOutlined />}
              >
                {shaking ? '链端起卦中...' : '链端随机起卦'}
              </Button>
            )
          ) : (
            <Button
              type="primary"
              size="large"
              block
              onClick={handleShake}
              loading={shaking}
              icon={<ThunderboltOutlined />}
            >
              {shaking ? '摇卦中...' : '摇卦'}
            </Button>
          )
        ) : (
          <Button
            type="primary"
            size="large"
            block
            onClick={() => {
              if (useChain && chainGuaId) {
                message.info(`查看链端卦象 ${chainGuaId} 的排盘结果...`);
              } else {
                message.info('排盘功能开发中...');
              }
            }}
            icon={<ArrowRightOutlined />}
          >
            查看排盘结果
          </Button>
        )}
        <Button block onClick={handleReset} icon={<ReloadOutlined />}>
          重新摇卦
        </Button>
      </Space>
    </Card>
  );

  /**
   * 渲染卦象显示
   */
  const renderGuaDisplay = () => {
    if (coinResults.length < 6) return null;

    return (
      <Card className="gua-display-card" style={{ marginTop: 16 }}>
        <Title level={5}>卦象</Title>
        <div style={{ display: 'flex', flexDirection: 'column-reverse' }}>
          {coinResults.map((result, idx) => (
            <YaoDisplay
              key={idx}
              yaoType={result.yaoType}
              position={idx + 1}
            />
          ))}
        </div>
      </Card>
    );
  };

  return (
    <div className="liuyao-page" style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      {renderShakeInterface()}
      {completed && renderGuaDisplay()}

      {/* 说明卡片 */}
      <Card style={{ marginTop: 16 }}>
        <Title level={5}>六爻占卜说明</Title>
        <Space direction="vertical" size={8}>
          <div>
            <Text strong>摇卦方法：</Text>
            <Text type="secondary">心中默念所问之事，点击摇卦六次得到完整卦象</Text>
          </div>
          <div>
            <Text strong>铜钱规则：</Text>
            <Text type="secondary">
              字(阳)=3分，背(阴)=2分。
              6分=老阴(动)，7分=少阳，8分=少阴，9分=老阳(动)
            </Text>
          </div>
          <div>
            <Text strong>动爻变化：</Text>
            <Text type="secondary">老阳变阴，老阴变阳，形成变卦</Text>
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

export default LiuyaoPage;
