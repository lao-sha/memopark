/**
 * 聊天隐私设置页面
 *
 * 功能说明：
 * 1. 提供完整的聊天隐私设置管理界面
 * 2. 移动端APP风格设计
 *
 * 创建日期：2025-11-28
 * 版本：v4.0
 */

import React from 'react'
import { Button } from 'antd'
import { ArrowLeftOutlined, LockOutlined } from '@ant-design/icons'
import { ChatSettingsPanel } from '../../components/chat-permission'
import './ChatPrivacySettingsPage.css'

/**
 * 函数级详细中文注释：聊天隐私设置页面
 *
 * ### 功能
 * 提供用户管理聊天隐私设置的完整界面。
 */
export const ChatPrivacySettingsPage: React.FC = () => {
  // 使用 hash 路由返回
  const handleBack = () => {
    window.history.back()
  }

  return (
    <div className="chat-privacy-settings-page">
      {/* 顶部导航栏 */}
      <div className="settings-header">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
          className="back-btn"
        />
        <div className="header-title">
          <LockOutlined />
          <span>聊天隐私设置</span>
        </div>
        <div className="header-placeholder" />
      </div>

      {/* 设置内容 */}
      <div className="settings-content">
        <ChatSettingsPanel />
      </div>
    </div>
  )
}

export default ChatPrivacySettingsPage
