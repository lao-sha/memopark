// 使用 @polkadot/api 查询任意地址余额
import { ApiPromise, WsProvider } from '@polkadot/api'

async function main() {
  const addr = process.argv[2]
  const ws = process.env.WS_ENDPOINT || 'ws://127.0.0.1:9944'
  if (!addr) {
    console.error('用法: node scripts/query-balance.mjs <SS58地址> [WS_ENDPOINT]')
    process.exit(1)
  }
  try {
    const api = await ApiPromise.create({ provider: new WsProvider(ws, 3000), throwOnConnect: true })
    const info = await api.query.system.account(addr)
    const free = info.data.free.toString()
    const decimals = (api.registry.chainDecimals && api.registry.chainDecimals[0]) || 12
    const symbol = (api.registry.chainTokens && api.registry.chainTokens[0]) || 'UNIT'
    function fmt(amount, d) {
      try {
        const n = BigInt(amount)
        const div = BigInt(10) ** BigInt(d)
        const whole = n / div
        const frac = n % div
        if (frac === 0n) return whole.toString()
        let s = frac.toString().padStart(d, '0').replace(/0+$/, '')
        return s ? `${whole}.${s}` : whole.toString()
      } catch (e) { return amount }
    }
    console.log(JSON.stringify({ address: addr, free, formatted: fmt(free, decimals), decimals, symbol }, null, 2))
    process.exit(0)
  } catch (e) {
    console.error('[query-error]', e && (e.message || String(e)))
    process.exit(2)
  }
}

main()


