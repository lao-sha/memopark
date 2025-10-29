import React from 'react'
import { Alert, Button, Card, Flex, Space, Switch, Typography, message } from 'antd'
import { getApi } from '../../lib/polkadot-safe'
import { useWallet } from '../../providers/WalletProvider'

/**
 * 函数级详细中文注释：OTC 管理页（只用于管理员/开发）
 * - 查询/切换 AllowBuyListings（默认 false，仅允许卖单）
 * - 需使用 Root/治理调用 set_listing_params(..., allow_buy_listings)
 */
const AdminOtcSettingsPage: React.FC = () => {
  const [allowBuy, setAllowBuy] = React.useState<boolean>(false)
  const [loading, setLoading] = React.useState(false)
  const wallet = useWallet()

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const api = await getApi()
      const v = await (api.query as any).otcListing.allowBuyListings()
      setAllowBuy(Boolean(v?.toJSON?.()))
    } catch (e) { message.error('读取失败') }
    setLoading(false)
  }, [])

  React.useEffect(() => { load() }, [load])

  async function toggle(val: boolean) {
    try {
      setLoading(true)
      const api = await getApi()
      // 仅传 allow_buy_listings，其它参数为 None；该调用需要 Root/治理
      const tx = (api.tx as any).otcListing.setListingParams(null, null, null, null, null, null, val)
      const hash = await wallet.signAndSendLocal('otcListing','setListingParams',[null,null,null,null,null,null,val])
      message.success(`已提交：${hash}`)
      setAllowBuy(val)
    } catch (e:any) { message.error(e?.message||'提交失败') } finally { setLoading(false) }
  }

  return (
    <Flex vertical gap={8} style={{ padding: 12, maxWidth: 640, margin: '0 auto' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>OTC 管理</Typography.Title>
      <Alert type="warning" showIcon message="仅管理员/治理可用；切换后影响全局做市商发布方向。" />
      <Card size="small" loading={loading} title="AllowBuyListings（允许挂买单）">
        <Space>
          <Switch checked={allowBuy} onChange={(v)=>toggle(v)} />
          <span>{allowBuy ? '已开启（允许买单）' : '已关闭（仅允许卖单）'}</span>
        </Space>
        <div style={{ marginTop: 8 }}>
          <Button onClick={load} size="small">刷新</Button>
        </div>
      </Card>
    </Flex>
  )
}

export default AdminOtcSettingsPage


