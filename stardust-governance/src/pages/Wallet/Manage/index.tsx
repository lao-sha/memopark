/**
 * 函数级详细中文注释：钱包管理页面
 * - 查看所有账户
 * - 切换当前账户
 * - 删除账户
 * - 设置别名
 */
import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Typography, 
  message, 
  Modal,
  Input,
  Tag,
  Tooltip
} from 'antd'
import { 
  WalletOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  ExportOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '../../../contexts/Wallet'
import { 
  loadAllKeystores,
  removeKeystore,
  setAlias,
  getAlias,
  exportKeystoreJsonForAddress
} from '../../../lib/keystore'
import { queryBalance, formatBalance } from '../../../lib/polkadot'

const { Title, Text } = Typography

interface AccountInfo {
  address: string
  alias: string
  balance: string
  isCurrent: boolean
}

export const ManageWallet: React.FC = () => {
  const navigate = useNavigate()
  const { accounts, activeAccount, setActiveAccount, refreshBalance } = useWallet()
  const [accountList, setAccountList] = useState<AccountInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [aliasModalVisible, setAliasModalVisible] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState('')
  const [aliasInput, setAliasInput] = useState('')

  /**
   * 加载账户列表和余额
   */
  const loadAccounts = async () => {
    setLoading(true)
    try {
      const keystores = loadAllKeystores()
      const list: AccountInfo[] = []

      for (const ks of keystores) {
        let balance = '0.0000'
        try {
          const balanceData = await queryBalance(ks.address)
          balance = formatBalance(balanceData.free, 12)
        } catch (e) {
          console.error('[余额查询] 失败:', e)
        }

        list.push({
          address: ks.address,
          alias: getAlias(ks.address),
          balance,
          isCurrent: ks.address === activeAccount
        })
      }

      setAccountList(list)
    } catch (e: any) {
      message.error('加载账户失败：' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [activeAccount])

  /**
   * 切换账户
   */
  const handleSwitch = (address: string) => {
    setActiveAccount(address)
    message.success('账户已切换')
  }

  /**
   * 删除账户
   */
  const handleDelete = (address: string) => {
    if (address === activeAccount && accountList.length > 1) {
      message.error('当前使用的账户无法删除，请先切换到其他账户')
      return
    }

    if (accountList.length === 1) {
      message.error('不能删除最后一个账户')
      return
    }

    Modal.confirm({
      title: '确认删除账户',
      content: (
        <div>
          <p>确定要删除这个账户吗？</p>
          <Text code style={{ wordBreak: 'break-all' }}>
            {address}
          </Text>
          <p style={{ marginTop: 12, color: 'red' }}>
            ⚠️ 请确保已备份助记词，删除后无法恢复！
          </p>
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        try {
          removeKeystore(address)
          message.success('账户已删除')
          loadAccounts()
        } catch (e: any) {
          message.error('删除失败：' + e.message)
        }
      }
    })
  }

  /**
   * 设置别名
   */
  const handleSetAlias = () => {
    if (!aliasInput.trim()) {
      message.error('请输入别名')
      return
    }

    try {
      setAlias(selectedAddress, aliasInput.trim())
      message.success('别名已设置')
      setAliasModalVisible(false)
      setAliasInput('')
      loadAccounts()
    } catch (e: any) {
      message.error('设置失败：' + e.message)
    }
  }

  /**
   * 导出 Keystore
   */
  const handleExport = (address: string) => {
    try {
      const alias = getAlias(address)
      const filename = alias 
        ? `memopark-${alias}.json` 
        : `memopark-${address.slice(0, 8)}.json`
      
      const success = exportKeystoreJsonForAddress(address, filename)
      if (success) {
        message.success('Keystore 已导出')
      } else {
        message.error('导出失败')
      }
    } catch (e: any) {
      message.error('导出失败：' + e.message)
    }
  }

  /**
   * 表格列定义
   */
  const columns = [
    {
      title: '别名',
      dataIndex: 'alias',
      key: 'alias',
      width: 120,
      render: (alias: string, record: AccountInfo) => (
        <Space>
          {alias ? (
            <Tag color="blue">{alias}</Tag>
          ) : (
            <Text type="secondary">未设置</Text>
          )}
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedAddress(record.address)
              setAliasInput(alias)
              setAliasModalVisible(true)
            }}
          />
        </Space>
      )
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      render: (address: string, record: AccountInfo) => (
        <Space>
          <Tooltip title={address}>
            <Text code style={{ fontSize: 11 }}>
              {address.slice(0, 10)}...{address.slice(-10)}
            </Text>
          </Tooltip>
          <Button
            size="small"
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(address)
              message.success('已复制地址')
            }}
          />
          {record.isCurrent && (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              当前
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: '余额',
      dataIndex: 'balance',
      key: 'balance',
      width: 150,
      render: (balance: string) => (
        <Text strong style={{ color: '#1890ff' }}>
          {balance} DUST
        </Text>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 250,
      render: (_: any, record: AccountInfo) => (
        <Space>
          {!record.isCurrent && (
            <Button
              size="small"
              type="primary"
              onClick={() => handleSwitch(record.address)}
            >
              切换
            </Button>
          )}
          <Button
            size="small"
            icon={<ExportOutlined />}
            onClick={() => handleExport(record.address)}
          >
            导出
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.address)}
            disabled={record.isCurrent && accountList.length === 1}
          >
            删除
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <WalletOutlined />
            <span>钱包管理</span>
            <Tag color="blue">{accountList.length} 个账户</Tag>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/wallet/recover')}
          >
            恢复钱包
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={accountList}
          rowKey="address"
          loading={loading}
          pagination={false}
        />

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button onClick={loadAccounts} loading={loading}>
            刷新余额
          </Button>
        </div>
      </Card>

      {/* 设置别名 Modal */}
      <Modal
        title="设置别名"
        open={aliasModalVisible}
        onOk={handleSetAlias}
        onCancel={() => {
          setAliasModalVisible(false)
          setAliasInput('')
        }}
        okText="确定"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>为账户设置一个易于识别的别名：</Text>
          <Input
            placeholder="例如：开发账户、测试账户"
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            onPressEnter={handleSetAlias}
            autoFocus
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            别名仅在本地显示，不会上传到链上
          </Text>
        </Space>
      </Modal>
    </div>
  )
}

export default ManageWallet

