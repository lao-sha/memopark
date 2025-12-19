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
} from 'antd';
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

import { DI_ZHI_NAMES } from '../../types/liuyao';
import * as liuyaoService from '../../services/liuyaoService';
import { getGanZhiFromDate } from '../../services/liuyaoService';
import './LiuyaoPage.css';

const { Title, Text, Paragraph } = Typography;

/**
 * 六爻占卜页面
 */
const LiuyaoPage: React.FC = () => {
  // 状态
  const [shaking, setShaking] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [chainGuaId, setChainGuaId] = useState<number | null>(null); // 链端卦象ID

  // 说明弹窗状态
  const [showInstructions, setShowInstructions] = useState(false);

  // 时间起卦相关状态
  const [divinationMethod, setDivinationMethod] = useState<'time' | 'random'>('random'); // 起卦方法
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // 选择的日期
  const [selectedHour, setSelectedHour] = useState<number>(0); // 选择的时辰

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
  }, [selectedDate, selectedHour]);

  /**
   * 重新开始
   */
  const handleReset = useCallback(() => {
    setCompleted(false);
    setChainGuaId(null);
    setDivinationMethod('random');
    setSelectedDate(new Date());
    setSelectedHour(0);
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
          <Text strong style={{ color: '#B2955D' }}>
            <CloudOutlined /> 随机起卦
          </Text>
          <br />
          使用链上随机数生成卦象，简单快速。适合没有特定时间要求的一般占问。区块链随机数保证了起卦的公平性和不可预测性。
        </Paragraph>

        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>
            <ClockCircleOutlined /> 时间起卦
          </Text>
          <br />
          根据指定的年月日时信息起卦，适合特定时间占问。时间起卦遵循传统的梅花易数时间起卦法，将时间信息转化为卦象。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 解盘功能说明 */}
        <Title level={5} style={{ color: '#B2955D' }}>解盘功能</Title>
        <Paragraph>
          起卦后可查看完整的六爻排盘结果，包括：
        </Paragraph>
        <Paragraph>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>
              <Text strong>卦象排盘：</Text>完整的六爻卦象，包含本卦、变卦、互卦等
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>用神分析：</Text>确定用神、世爻、应爻，分析五行旺衰
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>吉凶判断：</Text>根据卦象和用神关系，判断事件吉凶
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>应期预测：</Text>预测事件发生的大致时间
            </li>
          </ul>
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
              <Text strong>可追溯性：</Text>随时可查询历史记录，包含完整的起卦信息
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>真随机性：</Text>链上随机数算法保证起卦的公平性
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
            <li style={{ marginBottom: 8 }}>起卦前请心诚意诚，专注于所问之事</li>
            <li style={{ marginBottom: 8 }}>同一问题不宜短期内重复占卜</li>
            <li style={{ marginBottom: 8 }}>起卦需要连接钱包并支付少量 Gas 费用</li>
            <li style={{ marginBottom: 8 }}>如需专业解读，可前往"占卜服务市场"寻找大师</li>
          </ul>
        </Paragraph>
      </div>
    </Modal>
  );

  return (
    <div className="liuyao-page">
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

      {/* 主卡片 */}
      <Card className="input-card" style={{ position: 'relative' }}>
        <Title level={4} className="page-title" style={{ marginBottom: 4, textAlign: 'center' }}>
          起卦
        </Title>
        <Text type="secondary" className="page-subtitle" style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}>
          心中默念所问之事，选择起卦方式
        </Text>

        <Divider style={{ margin: '16px 0' }} />

        {/* 起卦方式选择 */}
        {!completed && (
          <>
            <Title level={5} style={{ marginBottom: 12 }}>选择起卦方式</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type={divinationMethod === 'random' ? 'primary' : 'default'}
                size="large"
                block
                icon={<CloudOutlined />}
                onClick={() => setDivinationMethod('random')}
                style={divinationMethod === 'random' ? { background: '#B2955D', borderColor: '#B2955D' } : {}}
              >
                随机起卦
              </Button>
              <Button
                type={divinationMethod === 'time' ? 'primary' : 'default'}
                size="large"
                block
                icon={<ClockCircleOutlined />}
                onClick={() => setDivinationMethod('time')}
                style={divinationMethod === 'time' ? { background: '#B2955D', borderColor: '#B2955D' } : {}}
              >
                时间起卦
              </Button>
            </Space>

            {/* 时间起卦 - 时间选择器 */}
            {divinationMethod === 'time' && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>选择日期：</Text>
                    <div style={{ marginTop: 8 }}>
                      <input
                        type="date"
                        value={selectedDate.toISOString().split('T')[0]}
                        onChange={(e) => {
                          const newDate = new Date(e.target.value);
                          setSelectedDate(newDate);
                        }}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: 'none',
                          borderBottom: '1px solid #e5e5e5',
                          borderRadius: 0,
                          fontSize: 14,
                          outline: 'none',
                          backgroundColor: '#FFFFFF',
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <Text strong>选择时辰：</Text>
                    <div style={{ marginTop: 8 }}>
                      <select
                        value={selectedHour}
                        onChange={(e) => setSelectedHour(parseInt(e.target.value))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: 'none',
                          borderBottom: '1px solid #e5e5e5',
                          borderRadius: 0,
                          fontSize: 14,
                          outline: 'none',
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        {DI_ZHI_NAMES.map((name, idx) => (
                          <option key={idx} value={idx}>
                            {name}时 ({[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22][idx]}-
                            {[2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24][idx]}点)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </Space>
              </>
            )}

            <Divider style={{ margin: '16px 0' }} />

            {/* 起卦按钮 */}
            {shaking ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin size="large" tip="正在起卦中..." />
              </div>
            ) : (
              <Button
                type="primary"
                size="large"
                block
                icon={divinationMethod === 'random' ? <CloudOutlined /> : <ClockCircleOutlined />}
                onClick={divinationMethod === 'random' ? handleRandomDivine : handleTimeMethodDivine}
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
                {divinationMethod === 'random' ? '开始起卦' : '时间起卦'}
              </Button>
            )}

            <Alert
              message="温馨提示"
              description="起卦结果将上链保存，可永久查询。起卦需要支付少量 Gas 费用。"
              type="warning"
              showIcon
              style={{ marginTop: 16, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 12 }}
            />
          </>
        )}

        {/* 起卦完成 */}
        {completed && chainGuaId !== null && (
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
                  borderRadius: '54px',
                  height: '54px',
                  fontSize: '19px',
                  fontWeight: '700',
                  color: '#F7D3A1',
                }}
              >
                查看解盘结果
              </Button>
              <Button block icon={<ReloadOutlined />} onClick={handleReset} style={{ borderRadius: '27px', height: '44px' }}>
                重新起卦
              </Button>
            </Space>
          </div>
        )}
      </Card>

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
