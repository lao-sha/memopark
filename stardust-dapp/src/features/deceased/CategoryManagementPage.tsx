/**
 * 逝者分类管理页面
 *
 * 功能说明：
 * 1. 展示所有分类修改申请
 * 2. 管理员可以批准/拒绝申请
 * 3. Root可以直接修改分类
 * 4. 普通用户可以查看自己的申请历史
 *
 * 创建日期：2025-11-09
 */

import React, { useState } from 'react'
import {
  Card,
  Typography,
  Space,
  Button,
  Alert,
  Spin,
  Tag,
  Tabs,
  Empty,
} from 'antd'
import {
  CrownOutlined,
  UserOutlined,
  CheckCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import { useAccount } from '../../hooks/useAccount'
import { useAccountPermissions } from '../../hooks/useAccountPermissions'
import { CategoryRequestList } from '../../components/deceased/CategoryRequestList'
import { CategoryManagementModal } from '../../components/deceased/CategoryManagementModal'
import { DeceasedCategory } from '../../services/deceasedService'

const { Title, Text } = Typography

/**
 * 函数级详细中文注释：逝者分类管理页面组件
 */
export const CategoryManagementPage: React.FC = () => {
  const account = useAccount()
  const { isRoot, isAdmin, loading: permissionsLoading, error } = useAccountPermissions(account)

  const [forceSetModalOpen, setForceSetModalOpen] = useState(false)

  /**
   * 函数级详细中文注释：渲染权限标签
   */
  const renderPermissionBadge = () => {
    if (permissionsLoading) {
      return <Tag icon={<Spin size="small" />} color="processing">检查权限中...</Tag>
    }

    if (isRoot) {
      return (
        <Tag icon={<CrownOutlined />} color="gold">
          Root账户
        </Tag>
      )
    }

    if (isAdmin) {
      return (
        <Tag icon={<CheckCircleOutlined />} color="green">
          委员会成员
        </Tag>
      )
    }

    return (
      <Tag icon={<UserOutlined />} color="default">
        普通用户
      </Tag>
    )
  }

  /**
   * 函数级详细中文注释：渲染权限说明
   */
  const renderPermissionDescription = () => {
    if (permissionsLoading) {
      return null
    }

    if (error) {
      return (
        <Alert
          message="权限检查失败"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )
    }

    if (isRoot) {
      return (
        <Alert
          message="Root账户权限"
          description={
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li>直接修改任意逝者的分类（无需审核）</li>
              <li>批准或拒绝普通用户的分类修改申请</li>
              <li>查看所有申请记录</li>
            </ul>
          }
          type="info"
          showIcon
          icon={<CrownOutlined />}
          style={{ marginBottom: 24 }}
        />
      )
    }

    if (isAdmin) {
      return (
        <Alert
          message="委员会成员权限"
          description={
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              <li>批准或拒绝普通用户的分类修改申请</li>
              <li>查看所有申请记录</li>
              <li>需要Root权限才能直接修改分类</li>
            </ul>
          }
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: 24 }}
        />
      )
    }

    return (
      <Alert
        message="普通用户权限"
        description={
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li>提交分类修改申请（需要冻结10 DUST押金）</li>
            <li>查看自己的申请历史</li>
            <li>申请将由委员会审核（7天审核期限）</li>
          </ul>
        }
        type="info"
        showIcon
        icon={<UserOutlined />}
        style={{ marginBottom: 24 }}
      />
    )
  }

  /**
   * 函数级详细中文注释：渲染管理员操作按钮
   */
  const renderAdminActions = () => {
    if (!isRoot && !isAdmin) {
      return null
    }

    return (
      <Card
        title={
          <Space>
            <CrownOutlined />
            <span>管理员操作</span>
          </Space>
        }
        extra={renderPermissionBadge()}
        style={{ marginBottom: 24 }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {isRoot && (
            <>
              <Button
                type="primary"
                icon={<CrownOutlined />}
                onClick={() => setForceSetModalOpen(true)}
                size="large"
                style={{ width: '100%' }}
              >
                Root直接修改分类（无需审核）
              </Button>
              <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
                Root权限专属，修改立即生效
              </Text>
            </>
          )}

          {!isRoot && isAdmin && (
            <Alert
              message="提示"
              description="您可以在下方申请列表中批准或拒绝申请。直接修改分类需要Root权限。"
              type="info"
              showIcon
            />
          )}
        </Space>
      </Card>
    )
  }

  /**
   * 函数级详细中文注释：渲染主内容区域
   */
  const renderContent = () => {
    if (!account) {
      return (
        <Empty
          description="请先连接钱包"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )
    }

    return (
      <>
        {renderPermissionDescription()}
        {renderAdminActions()}

        {/* 申请列表 */}
        <CategoryRequestList account={account} />

        {/* Root强制修改弹窗 */}
        {isRoot && (
          <CategoryManagementModal
            open={forceSetModalOpen}
            onClose={() => setForceSetModalOpen(false)}
            mode="force_set"
            deceasedId={0} // 实际使用时需要传入真实的逝者ID
            currentCategory={DeceasedCategory.Ordinary}
            account={account}
            onSuccess={() => {
              setForceSetModalOpen(false)
              // 刷新列表
            }}
          />
        )}
      </>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <Card
        title={
          <Space>
            <HistoryOutlined />
            <Title level={3} style={{ margin: 0 }}>
              逝者分类管理
            </Title>
          </Space>
        }
        extra={renderPermissionBadge()}
      >
        {renderContent()}
      </Card>
    </div>
  )
}
