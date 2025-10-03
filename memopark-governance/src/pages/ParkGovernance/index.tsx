import { useState } from 'react'
import {
  Card,
  Form,
  InputNumber,
  Input,
  Button,
  Space,
  Alert,
  Switch,
  message,
  Tabs
} from 'antd'
import {
  ThunderboltOutlined,
  EditOutlined,
  UserSwitchOutlined,
  PictureOutlined
} from '@ant-design/icons'
import { useApi } from '@/contexts/Api'
import { useWallet } from '@/contexts/Wallet'
import { signAndSend } from '@/services/wallet/signer'
import {
  createParkUpdateTx,
  createParkSetAdminTx,
  createParkTransferTx,
  createParkSetCoverTx,
  isParkPalletAvailable
} from '@/services/blockchain/park'

/**
 * 陵园治理工具页面
 * 提供陵园的强制治理操作（需内容委员会或Root权限）
 */
export default function ParkGovernancePage() {
  const { api, isReady } = useApi()
  const { activeAccount } = useWallet()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [palletAvailable, setPalletAvailable] = useState(false)

  // 检查pallet是否可用
  useState(() => {
    if (isReady && api) {
      setPalletAvailable(isParkPalletAvailable(api))
    }
  })

  /**
   * 执行治理操作
   */
  const handleSubmit = async (action: 'update' | 'set_admin' | 'transfer' | 'set_cover') => {
    if (!api || !activeAccount) {
      message.error('请先连接钱包')
      return
    }

    if (!palletAvailable) {
      message.error('Park pallet未配置')
      return
    }

    try {
      const values = await form.validateFields()
      setLoading(true)

      let tx: any

      switch (action) {
        case 'update':
          tx = createParkUpdateTx(
            api,
            values.id,
            values.region_code || null,
            values.metadata_cid || null,
            typeof values.active === 'boolean' ? values.active : null,
            values.evidence_cid
          )
          break

        case 'set_admin':
          tx = createParkSetAdminTx(
            api,
            values.id,
            values.admin_group || null,
            values.evidence_cid
          )
          break

        case 'transfer':
          tx = createParkTransferTx(
            api,
            values.id,
            values.new_owner,
            values.evidence_cid
          )
          break

        case 'set_cover':
          tx = createParkSetCoverTx(
            api,
            values.id,
            values.cover_cid || null,
            values.evidence_cid
          )
          break

        default:
          throw new Error('未知操作')
      }

      await signAndSend(activeAccount, tx, {
        onSuccess: (hash) => {
          message.success(`操作成功！交易哈希: ${hash.slice(0, 10)}...`)
          form.resetFields()
        },
        onError: (error) => {
          message.error('操作失败：' + error.message)
        }
      })
    } catch (e: any) {
      if (e.errorFields) {
        message.error('请填写所有必填项')
      } else {
        message.error('操作失败：' + (e?.message || ''))
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isReady) {
    return (
      <Card>
        <Alert message="正在连接区块链..." type="info" showIcon />
      </Card>
    )
  }

  if (!palletAvailable) {
    return (
      <Card title="陵园治理工具">
        <Alert
          message="Pallet未配置"
          description="Park pallet未在链上配置，无法使用陵园治理功能。"
          type="warning"
          showIcon
        />
      </Card>
    )
  }

  return (
    <div>
      <Card title="陵园治理工具">
        <Alert
          message="权限说明"
          description="陵园治理操作需要内容委员会2/3多数通过或Root权限。所有操作需要提供证据CID（明文，不加密）。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Tabs
          items={[
            {
              key: 'form',
              label: '治理操作',
              children: (
                <Form form={form} layout="vertical">
                  <Form.Item
                    label="陵园ID"
                    name="id"
                    rules={[{ required: true, message: '请输入陵园ID' }]}
                  >
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      placeholder="输入陵园ID"
                    />
                  </Form.Item>

                  <Form.Item
                    label="地区代码（可选）"
                    name="region_code"
                    tooltip="更新陵园时使用"
                  >
                    <Input placeholder="例如：110000" />
                  </Form.Item>

                  <Form.Item
                    label="元数据CID（可选）"
                    name="metadata_cid"
                    tooltip="更新陵园元数据"
                  >
                    <Input placeholder="bafy... 或 Qm..." />
                  </Form.Item>

                  <Form.Item
                    label="激活状态（可选）"
                    name="active"
                    valuePropName="checked"
                    tooltip="更新陵园激活状态"
                  >
                    <Switch checkedChildren="激活" unCheckedChildren="停用" />
                  </Form.Item>

                  <Form.Item
                    label="管理员组ID（可选）"
                    name="admin_group"
                    tooltip="设置管理员时使用"
                  >
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      placeholder="管理员组ID"
                    />
                  </Form.Item>

                  <Form.Item
                    label="封面CID（可选）"
                    name="cover_cid"
                    tooltip="设置封面时使用"
                  >
                    <Input placeholder="bafy... 或 Qm..." />
                  </Form.Item>

                  <Form.Item
                    label="新所有者（转让时必填）"
                    name="new_owner"
                    tooltip="强制转让陵园所有权"
                  >
                    <Input placeholder="0x..." />
                  </Form.Item>

                  <Form.Item
                    label="证据CID（必填，明文不加密）"
                    name="evidence_cid"
                    rules={[
                      { required: true, message: '请输入证据CID' },
                      {
                        pattern: /^(bafy|Qm)/,
                        message: '请输入有效的IPFS CID'
                      }
                    ]}
                  >
                    <Input placeholder="bafy... 或 Qm..." />
                  </Form.Item>

                  <Space wrap>
                    <Button
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={() => handleSubmit('update')}
                      loading={loading}
                    >
                      强制更新
                    </Button>

                    <Button
                      icon={<UserSwitchOutlined />}
                      onClick={() => handleSubmit('set_admin')}
                      loading={loading}
                    >
                      设置管理员
                    </Button>

                    <Button
                      icon={<PictureOutlined />}
                      onClick={() => handleSubmit('set_cover')}
                      loading={loading}
                    >
                      设置封面
                    </Button>

                    <Button
                      icon={<ThunderboltOutlined />}
                      onClick={() => handleSubmit('transfer')}
                      loading={loading}
                      danger
                    >
                      强制转让
                    </Button>
                  </Space>
                </Form>
              )
            },
            {
              key: 'help',
              label: '操作说明',
              children: (
                <div>
                  <Alert
                    message="治理操作说明"
                    description={
                      <div style={{ fontSize: 13 }}>
                        <p><strong>强制更新</strong>：更新陵园的地区代码、元数据CID、激活状态</p>
                        <p><strong>设置管理员</strong>：设置陵园的管理员组ID</p>
                        <p><strong>设置封面</strong>：设置或清空陵园封面CID</p>
                        <p><strong>强制转让</strong>：将陵园所有权转让给新账户</p>
                        <p style={{ marginTop: 12 }}><strong>注意事项</strong>：</p>
                        <ul style={{ marginBottom: 0 }}>
                          <li>所有操作需要内容委员会2/3多数或Root权限</li>
                          <li>必须提供证据CID（明文，不加密）</li>
                          <li>可选字段留空表示不修改</li>
                          <li>操作不可撤销，请谨慎操作</li>
                        </ul>
                      </div>
                    }
                    type="info"
                    showIcon
                  />
                </div>
              )
            }
          ]}
        />
      </Card>
    </div>
  )
}

