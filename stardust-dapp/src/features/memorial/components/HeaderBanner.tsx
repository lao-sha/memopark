/**
 * 纪念馆头部横幅组件
 * 
 * 功能说明：
 * 1. 展示逝者头像和基本信息
 * 2. 显示背景图片
 * 3. 提供快捷操作按钮（返回、分享、编辑、设置）
 * 4. 显示亲友团
 * 5. 支持自适应布局
 * 
 * 创建日期：2025-11-02
 */

import React from 'react'
import { Avatar, Button, Space, Typography, Tag, Tooltip } from 'antd'
import {
  ArrowLeftOutlined,
  ShareAltOutlined,
  EditOutlined,
  SettingOutlined,
  HeartOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { DeceasedInfo } from '../../../services/deceasedService'
import { MemorialColors } from '../../../theme/colors'
import { buildIpfsUrl } from '../../../utils/ipfsUrl'

const { Title, Text } = Typography

interface HeaderBannerProps {
  /** 逝者信息 */
  deceased: DeceasedInfo
  /** 当前用户地址 */
  currentAccount?: string
  /** 返回回调 */
  onBack?: () => void
  /** 分享回调 */
  onShare?: () => void
  /** 编辑回调 */
  onEdit?: () => void
  /** 设置回调 */
  onSettings?: () => void
  /** 加入亲友团回调 */
  onJoinFamily?: () => void
}

/**
 * 函数级详细中文注释：格式化日期显示
 * 🔧 修复：日期格式从区块号改为 YYYYMMDD 字符串
 */
const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr || dateStr.length !== 8) return dateStr || '未知'
  // 格式：YYYYMMDD -> YYYY.MM.DD
  return `${dateStr.slice(0, 4)}.${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)}`
}

/**
 * 函数级详细中文注释：计算享年
 * 🔧 修复：基于 YYYYMMDD 字符串计算
 */
const calculateLifeYears = (deceased: DeceasedInfo): number => {
  if (!deceased.birthTs || !deceased.deathTs) return 0
  const birthYear = parseInt(deceased.birthTs.slice(0, 4), 10)
  const deathYear = parseInt(deceased.deathTs.slice(0, 4), 10)
  return deathYear - birthYear
}

/**
 * 函数级详细中文注释：纪念馆头部横幅组件
 */
export const HeaderBanner: React.FC<HeaderBannerProps> = ({
  deceased,
  currentAccount,
  onBack,
  onShare,
  onEdit,
  onSettings,
  onJoinFamily,
}) => {
  const isOwner = currentAccount === deceased.owner
  const birthDate = formatDateDisplay(deceased.birthTs)  // 🔧 修复：birthDate -> birthTs
  const deathDate = formatDateDisplay(deceased.deathTs)  // 🔧 修复：deathDate -> deathTs
  const lifeYears = calculateLifeYears(deceased)

  // 获取主图URL
  const coverImageUrl =
    buildIpfsUrl(deceased.mainImageCid) || 'https://picsum.photos/seed/memorial-bg/1200/800'

  // 获取头像URL
  const avatarUrl = buildIpfsUrl(deceased.mainImageCid)

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 480,
        background: `linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%), url(${coverImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: '0 0 24px 24px',
        overflow: 'hidden',
      }}
    >
      {/* 顶部操作栏 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 100%)',
          zIndex: 10,
        }}
      >
        <Button
          type="text"
          shape="circle"
          size="large"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          style={{
            color: '#fff',
            backgroundColor: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(10px)',
          }}
        />
        <Space size={8}>
          <Button
            type="text"
            shape="circle"
            size="large"
            icon={<ShareAltOutlined />}
            onClick={onShare}
            style={{
              color: '#fff',
              backgroundColor: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(10px)',
            }}
          />
          {isOwner && (
            <>
              <Button
                type="text"
                shape="circle"
                size="large"
                icon={<EditOutlined />}
                onClick={onEdit}
                style={{
                  color: '#fff',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  backdropFilter: 'blur(10px)',
                }}
              />
              <Button
                type="text"
                shape="circle"
                size="large"
                icon={<SettingOutlined />}
                onClick={onSettings}
                style={{
                  color: '#fff',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  backdropFilter: 'blur(10px)',
                }}
              />
            </>
          )}
        </Space>
      </div>

      {/* 左侧亲友团 */}
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: 100,
          zIndex: 5,
        }}
      >
        <Avatar.Group
          maxCount={3}
          maxStyle={{
            color: MemorialColors.primary,
            backgroundColor: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* 这里可以接入真实的亲友团数据 */}
          <Avatar
            src="https://picsum.photos/seed/family1/80"
            size={48}
            style={{ border: '2px solid #fff' }}
          />
          <Avatar
            src="https://picsum.photos/seed/family2/80"
            size={48}
            style={{ border: '2px solid #fff' }}
          />
          <Avatar
            src="https://picsum.photos/seed/family3/80"
            size={48}
            style={{ border: '2px solid #fff' }}
          />
          <Avatar size={48} style={{ border: '2px solid #fff' }}>
            +9
          </Avatar>
        </Avatar.Group>
        <div style={{ marginTop: 12 }}>
          <Button
            type="primary"
            size="small"
            icon={<UserAddOutlined />}
            onClick={onJoinFamily}
            style={{
              backgroundColor: MemorialColors.primary,
              borderColor: MemorialColors.primary,
              borderRadius: 16,
            }}
          >
            加入亲友团
          </Button>
        </div>
      </div>

      {/* 中央逝者信息 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          zIndex: 5,
        }}
      >
        {/* 头像 */}
        <div
          style={{
            width: 140,
            height: 180,
            margin: '0 auto 20px',
            border: `6px solid ${MemorialColors.primary}`,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: '#222',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={deceased.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 48,
                color: '#fff',
              }}
            >
              {deceased.name?.charAt(0) || '?'}
            </div>
          )}
        </div>

        {/* 姓名 */}
        <Title
          level={2}
          style={{
            color: '#fff',
            margin: '0 0 8px',
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            fontWeight: 600,
          }}
        >
          {deceased.name}
        </Title>

        {/* 生卒日期 */}
        <Text
          style={{
            color: '#fff',
            fontSize: 16,
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            opacity: 0.95,
          }}
        >
          {birthDate} ~ {deathDate}
        </Text>

        {/* 享年 */}
        <div style={{ marginTop: 12 }}>
          <Tag
            color={MemorialColors.primary}
            style={{
              fontSize: 14,
              padding: '4px 16px',
              borderRadius: 16,
              border: 'none',
              fontWeight: 500,
            }}
          >
            <HeartOutlined /> 享年 {lifeYears} 岁
          </Tag>
        </div>
      </div>

      {/* 渐变遮罩（底部） */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 100,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
