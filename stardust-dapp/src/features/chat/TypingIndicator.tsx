/**
 * 打字指示器组件
 * 
 * 功能：
 * - 显示对方正在输入的状态
 * - 动画效果
 */

import React from 'react';
import './TypingIndicator.css';

interface TypingIndicatorProps {
  /** 是否显示 */
  show: boolean;
  /** 用户名（可选） */
  userName?: string;
}

/**
 * 打字指示器组件
 */
export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  show,
  userName = '对方',
}) => {
  if (!show) return null;

  return (
    <div className="typing-indicator">
      <div className="typing-indicator-content">
        <span className="typing-indicator-text">{userName} 正在输入</span>
        <div className="typing-indicator-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      </div>
    </div>
  );
};

