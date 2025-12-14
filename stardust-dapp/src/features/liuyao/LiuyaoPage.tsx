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
} from 'antd';
import {
  ThunderboltOutlined,
  HistoryOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
  CloudOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';

import { DI_ZHI_NAMES } from '../../types/liuyao';
import * as liuyaoService from '../../services/liuyaoService';
import { getGanZhiFromDate } from '../../services/liuyaoService';

const { Title, Text, Paragraph } = Typography;

/**
 * 六爻占卜页面
 */
const LiuyaoPage: React.FC = () => {
  // 状态
  const [shaking, setShaking] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [chainGuaId, setChainGuaId] = useState<number | null>(null); // 链端卦象ID

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

  return (
    <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      {/* 页面标题 */}
      <Card>
        <Title level={4} style={{ margin: 0 }}>
          <ThunderboltOutlined /> 六爻占卜
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
          心中默念所问之事，选择起卦方式
        </Paragraph>
      </Card>

      {/* 起卦方式选择 */}
      {!completed && (
        <Card style={{ marginTop: 16 }}>
          <Title level={5}>选择起卦方式</Title>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              type={divinationMethod === 'random' ? 'primary' : 'default'}
              size="large"
              block
              icon={<CloudOutlined />}
              onClick={() => setDivinationMethod('random')}
            >
              随机起卦
            </Button>
            <Button
              type={divinationMethod === 'time' ? 'primary' : 'default'}
              size="large"
              block
              icon={<ClockCircleOutlined />}
              onClick={() => setDivinationMethod('time')}
            >
              时间起卦
            </Button>
          </Space>

          {/* 时间起卦 - 时间选择器 */}
          {divinationMethod === 'time' && (
            <>
              <Divider />
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
                        padding: 8,
                        border: '1px solid #d9d9d9',
                        borderRadius: 4,
                        fontSize: 14,
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
                        padding: 8,
                        border: '1px solid #d9d9d9',
                        borderRadius: 4,
                        fontSize: 14,
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

          <Divider />

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
            >
              {divinationMethod === 'random' ? '开始起卦' : '时间起卦'}
            </Button>
          )}

          <Alert
            message="温馨提示"
            description="起卦结果将上链保存，可永久查询。起卦需要支付少量 Gas 费用。"
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        </Card>
      )}

      {/* 起卦完成 */}
      {completed && chainGuaId !== null && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <CloudOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
            <Title level={4}>起卦成功！</Title>
            <Paragraph type="secondary">
              您的卦象已生成，卦象 ID: <Tag color="blue">{chainGuaId}</Tag>
            </Paragraph>

            <Space direction="vertical" style={{ width: '100%', marginTop: 24 }}>
              <Button
                type="primary"
                size="large"
                block
                icon={<ArrowRightOutlined />}
                onClick={handleViewDetail}
              >
                查看解盘结果
              </Button>
              <Button block icon={<ReloadOutlined />} onClick={handleReset}>
                重新起卦
              </Button>
            </Space>
          </div>
        </Card>
      )}

      {/* 六爻占卜说明 */}
      <Card style={{ marginTop: 16 }}>
        <Title level={5}>六爻占卜说明</Title>
        <Space direction="vertical" size={8}>
          <div>
            <Text strong>随机起卦：</Text>
            <Text type="secondary">使用链上随机数生成卦象，简单快速</Text>
          </div>
          <div>
            <Text strong>时间起卦：</Text>
            <Text type="secondary">
              根据指定的年月日时信息起卦，适合特定时间占问
            </Text>
          </div>
          <div>
            <Text strong>解盘功能：</Text>
            <Text type="secondary">
              起卦后可查看完整的六爻排盘、用神分析、吉凶判断、应期预测等
            </Text>
          </div>
          <div>
            <Text strong>链上存储：</Text>
            <Text type="secondary">
              所有卦象数据上链保存，随时可查询历史记录
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

export default LiuyaoPage;
