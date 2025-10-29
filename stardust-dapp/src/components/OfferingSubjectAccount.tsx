import React from 'react'
import { Button, Input, Space, Typography, Spin, message, Statistic } from 'antd'
import { getApi } from '../lib/polkadot-safe'
import { blake2AsU8a, encodeAddress } from '@polkadot/util-crypto'
import { hexToU8a, stringToU8a, u8aConcat } from '@polkadot/util'

/**
 * 函数级详细中文注释：供奉主题资金账户展示组件（基于 creator + deceased_id 派生）
 * 
 * 设计目标：
 * - 基于 EscrowPalletId + (creator, deceased_id) 派生主题账户地址
 * - 使用 creator 而非 owner，确保 owner 转移时账户地址不变
 * - 显示账户地址、余额、创建者信息
 * - 提供一键复制功能
 * 
 * 派生公式：
 * subject_account = derive(EscrowPalletId, (creator, deceased_id))
 * 
 * 说明：
 * - creator 是逝者的创建者账户，永久不可变
 * - owner 可通过治理转移，但不影响主题账户地址
 * - 保证资金连续性：owner 转移前后的供奉都进入同一主题账户
 */
export const OfferingSubjectAccount: React.FC<{
  deceasedId?: number | string
  showBalance?: boolean
  onApply?: (addr: string) => void
}> = ({ deceasedId, showBalance = true, onApply }) => {
  const [loading, setLoading] = React.useState(false)
  const [computed, setComputed] = React.useState<string>('')
  const [creator, setCreator] = React.useState<string>('')
  const [owner, setOwner] = React.useState<string>('')
  const [balance, setBalance] = React.useState<bigint | null>(null)
  const [error, setError] = React.useState<string>('')

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        setError('')
        setComputed('')
        setCreator('')
        setOwner('')
        setBalance(null)

        const did = Number(deceasedId || 0)
        if (!did || did <= 0) {
          setLoading(false)
          return
        }

        const api = await getApi()
        
        // 读取逝者信息
        const deceasedRaw: any = await api.query.deceased?.deceasedOf(did)
        if (!deceasedRaw || !deceasedRaw.isSome) {
          setError('逝者不存在')
          setLoading(false)
          return
        }

        const deceased = deceasedRaw.unwrap()
        const creatorAddr = deceased.creator?.toString() || ''
        const ownerAddr = deceased.owner?.toString() || ''
        
        setCreator(creatorAddr)
        setOwner(ownerAddr)

        if (!creatorAddr) {
          setError('逝者 creator 字段缺失')
          setLoading(false)
          return
        }

        // 派生主题账户地址
        // 公式：derive(EscrowPalletId, (creator, deceased_id))
        const escrowPalletIdHex = '0x6f74632f65736377' // PalletId(*b"otc/escw") 的十六进制
        const pidU8a = hexToU8a(escrowPalletIdHex)
        
        // 将 creator 地址解码为 public key
        const { decodeAddress } = await import('@polkadot/util-crypto')
        const creatorPubKey = decodeAddress(creatorAddr)
        
        // 将 deceased_id 编码为 u64
        const didU8a = api.createType('u64', did).toU8a()
        
        // 拼接: "modl" + PalletId + creator_pubkey + deceased_id
        const data = u8aConcat(
          stringToU8a('modl'),
          pidU8a,
          creatorPubKey,
          didU8a
        )
        
        // Blake2-256 哈希
        const hash = blake2AsU8a(data, 256)
        
        // 编码为 SS58 地址
        const ss58 = encodeAddress(hash, api.registry.chainSS58 || 42)
        setComputed(ss58)

        // 查询余额
        if (showBalance) {
          try {
            const accountInfo: any = await api.query.system.account(ss58)
            if (accountInfo && accountInfo.data) {
              setBalance(BigInt(accountInfo.data.free.toString()))
            }
          } catch (e) {
            console.error('查询余额失败:', e)
          }
        }

        setLoading(false)
      } catch (e: any) {
        console.error('派生主题账户失败:', e)
        setError(e?.message || '派生失败')
        setLoading(false)
      }
    })()
  }, [deceasedId, showBalance])

  async function copyAddr() {
    try {
      await navigator.clipboard.writeText(computed)
      message.success('已复制主题账户地址')
    } catch {
      message.error('复制失败')
    }
  }

  async function copyCreator() {
    try {
      await navigator.clipboard.writeText(creator)
      message.success('已复制创建者地址')
    } catch {
      message.error('复制失败')
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <Spin tip="正在计算主题账户..." />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <Typography.Text type="danger">{error}</Typography.Text>
      </div>
    )
  }

  if (!computed) {
    return null
  }

  return (
    <div style={{ width: '100%' }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        供奉主题资金账户（基于 creator + deceased_id 派生）
      </Typography.Text>
      
      <Space direction="vertical" style={{ width: '100%', marginTop: 6 }} size="small">
        {/* 主题账户地址 */}
        <Space.Compact style={{ width: '100%' }}>
          <Input
            readOnly
            placeholder="主题账户地址"
            value={computed}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
          <Button onClick={copyAddr}>复制</Button>
          {onApply && (
            <Button type="primary" onClick={() => onApply(computed)}>
              套用
            </Button>
          )}
        </Space.Compact>

        {/* 账户余额 */}
        {showBalance && balance !== null && (
          <Statistic
            title="账户余额（最小单位）"
            value={balance.toString()}
            style={{ marginTop: 8 }}
          />
        )}

        {/* 创建者信息 */}
        <div style={{ marginTop: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            创建者 (creator)：
          </Typography.Text>
          <Space.Compact style={{ width: '100%', marginTop: 4 }}>
            <Input
              readOnly
              value={creator}
              style={{ fontFamily: 'monospace', fontSize: 11 }}
              size="small"
            />
            <Button size="small" onClick={copyCreator}>
              复制
            </Button>
          </Space.Compact>
        </div>

        {/* 当前所有者信息（仅显示，说明 owner 可能不同） */}
        {owner && owner !== creator && (
          <div style={{ marginTop: 4 }}>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              当前所有者 (owner)：{owner}
            </Typography.Text>
            <Typography.Text type="warning" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
              ⚠️ owner 与 creator 不同（可能已通过治理转移），但主题账户仍基于 creator 派生，地址不变
            </Typography.Text>
          </div>
        )}

        {/* 说明信息 */}
        <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
          📌 说明：
          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
            <li>主题账户基于 creator（创建者）派生，永久不变</li>
            <li>即使 owner 通过治理转移，账户地址也不会改变</li>
            <li>保证资金连续性：owner 转移前后的供奉都进入同一账户</li>
            <li>派生公式：derive(EscrowPalletId, (creator, deceased_id))</li>
          </ul>
        </Typography.Text>
      </Space>
    </div>
  )
}

export default OfferingSubjectAccount

