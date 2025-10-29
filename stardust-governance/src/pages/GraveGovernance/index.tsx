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
  LockOutlined,
  DeleteOutlined,
  RollbackOutlined
} from '@ant-design/icons'
import { useApi } from '@/contexts/Api'
import { useWallet } from '@/contexts/Wallet'
import { signAndSend } from '@/services/wallet/signer'
import {
  createGraveTransferTx,
  createGraveSetRestrictedTx,
  createGraveRemoveTx,
  createGraveRestoreTx,
  isGravePalletAvailable
} from '@/services/blockchain/grave'

/**
 * 墓地治理工具页面
 * 提供墓地的强制治理操作（需内容委员会或Root权限）
 */
export default function GraveGovernancePage() {
  const { api, isReady } = useApi()
  const { activeAccount } = useWallet()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [palletAvailable, setPalletAvailable] = useState(false)

  // 检查pallet是否可用
  useState(() => {
    if (isReady && api) {
      setPalletAvailable(isGravePalletAvailable(api))
    }
  })

  /**
   * 执行治理操作
   */
  const handleSubmit = async (action: 'transfer' | 'restrict' | 'remove' | 'restore') => {
    if (!api || !activeAccount) {
      message.error('请先连接钱包')
      return
    }

    if (!palletAvailable) {
      message.error('Grave pallet未配置')
      return
    }

    try {
      const values = await form.validateFields()
      setLoading(true)

      let tx: any

      switch (action) {
        case 'transfer':
          tx = createGraveTransferTx(
            api,
            values.id,
            values.new_owner,
            values.evidence_cid
          )
          break

        case 'restrict':
          tx = createGraveSetRestrictedTx(
            api,
            values.id,
            values.restricted,
            values.reason_code || 0,
            values.evidence_cid
          )
          break

        case 'remove':
          tx = createGraveRemoveTx(
            api,
            values.id,
            values.reason_code || 0,
            values.evidence_cid
          )
          break

        case 'restore':
          tx = createGraveRestoreTx(api, values.id, values.evidence_cid)
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
      <Card title="墓地治理工具">
        <Alert
          message="Pallet未配置"
          description="Grave pallet未在链上配置，无法使用墓地治理功能。"
          type="warning"
          showIcon
        />
      </Card>
    )
  }

  return (
    <div>
      <Card title="墓地治理工具">
        <Alert
          message="权限说明"
          description="墓地治理操作需要内容委员会2/3多数通过或Root权限。所有操作需要提供证据CID（明文，不加密）。"
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
                    label="墓地ID"
                    name="id"
                    rules={[{ required: true, message: '请输入墓地ID' }]}
                  >
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      placeholder="输入墓地ID"
                    />
                  </Form.Item>

                  <Form.Item
                    label="新所有者（仅转让时需要）"
                    name="new_owner"
                  >
                    <Input placeholder="0x..." />
                  </Form.Item>

                  <Form.Item
                    label="原因代码（0-255）"
                    name="reason_code"
                  >
                    <InputNumber
                      min={0}
                      max={255}
                      style={{ width: '100%' }}
                      placeholder="限制/移除原因代码"
                    />
                  </Form.Item>

                  <Form.Item
                    label="受限开关（设置受限时使用）"
                    name="restricted"
                    valuePropName="checked"
                  >
                    <Switch checkedChildren="受限" unCheckedChildren="正常" />
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
                      icon={<ThunderboltOutlined />}
                      onClick={() => handleSubmit('transfer')}
                      loading={loading}
                    >
                      强制转让
                    </Button>

                    <Button
                      icon={<LockOutlined />}
                      onClick={() => handleSubmit('restrict')}
                      loading={loading}
                    >
                      设置受限
                    </Button>

                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleSubmit('remove')}
                      loading={loading}
                    >
                      软删除
                    </Button>

                    <Button
                      icon={<RollbackOutlined />}
                      onClick={() => handleSubmit('restore')}
                      loading={loading}
                    >
                      恢复展示
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
                        <p><strong>强制转让</strong>：将墓地所有权转让给新账户（需提供新所有者地址）</p>
                        <p><strong>设置受限</strong>：限制墓地的某些操作（需提供原因代码）</p>
                        <p><strong>软删除</strong>：标记墓地为已删除状态（不会真正删除数据）</p>
                        <p><strong>恢复展示</strong>：恢复被限制或删除的墓地</p>
                        <p style={{ marginTop: 12 }}><strong>注意事项</strong>：</p>
                        <ul style={{ marginBottom: 0 }}>
                          <li>所有操作需要内容委员会2/3多数或Root权限</li>
                          <li>必须提供证据CID（明文，不加密）</li>
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

