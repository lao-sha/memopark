/**
 * 函数级详细中文注释：倒计时组件
 * 
 * 功能：
 * 1. 友好的倒计时显示（分:秒）
 * 2. 低于1分钟时变红色
 * 3. 倒计时结束触发回调
 */

import React, { useState, useEffect } from 'react';
import { Statistic, Space, Typography } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface CountdownTimerProps {
  seconds: number;
  onExpire?: () => void;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  seconds: initialSeconds,
  onExpire,
}) => {
  const [seconds, setSeconds] = useState<number>(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (seconds <= 0) {
      if (onExpire) {
        onExpire();
      }
      return;
    }

    const timer = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onExpire) {
            onExpire();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds, onExpire]);

  /**
   * 函数级详细中文注释：格式化时间显示
   */
  const formatTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 低于1分钟时变红
  const isLowTime = seconds < 60;
  const color = isLowTime ? '#ff4d4f' : '#1890ff';

  return (
    <div style={{ textAlign: 'center' }}>
      <Space direction="vertical" size="small">
        <Text type="secondary">
          <ClockCircleOutlined /> 剩余时间
        </Text>
        <div style={{ fontSize: 48, fontWeight: 'bold', color }}>
          {formatTime(seconds)}
        </div>
        {isLowTime && (
          <Text type="danger" strong>
            ⚠️ 订单即将过期，请尽快完成支付
          </Text>
        )}
      </Space>
    </div>
  );
};

