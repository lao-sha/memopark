# 上线标准供奉规格（上架脚本/说明）

本说明给出通过 polkadot.js 脚本在链上上架/启用标准供奉规格的最小示例（花圈/蜡烛/清香/果品/自定义）。

## 建议的 kind_code 与含义（可按需调整）
- 11: WREATH 花圈（Instant）
- 12: CANDLE 蜡烛（Timed，默认最短 1 周，可按需续期）
- 13: INCENSE 清香（Timed，默认最短 1 周）
- 14: FRUIT 果品（Instant）
- 19: CUSTOM 自定义（Instant，名称自定义）

## 在 polkadot.js 中执行（Node/浏览器均可）
```js
import { ApiPromise, WsProvider } from '@polkadot/api'

// 工具：创建 Instant 规格
async function createInstant(api, sudo, kindCode, name, schemaCid) {
  const tx = api.tx.memoOfferings.createOffering(
    kindCode,
    api.createType('Bytes', name),
    api.createType('Bytes', schemaCid),
    /* kind_flag */ 0, // 0=Instant, 1=Timed
    /* min_duration */ null,
    /* max_duration */ null,
    /* can_renew */ false,
    /* expire_action */ 0,
    /* enabled */ true,
  )
  return api.tx.sudo.sudo(tx).signAndSend(sudo)
}

// 工具：创建 Timed 规格（如蜡烛/清香）
async function createTimed(api, sudo, kindCode, name, schemaCid, minWeeks=1, maxWeeks=null, canRenew=true, expireAction=0) {
  const tx = api.tx.memoOfferings.createOffering(
    kindCode,
    api.createType('Bytes', name),
    api.createType('Bytes', schemaCid),
    /* kind_flag */ 1,
    /* min_duration */ minWeeks,
    /* max_duration */ maxWeeks,
    /* can_renew */ canRenew,
    /* expire_action */ expireAction,
    /* enabled */ true,
  )
  return api.tx.sudo.sudo(tx).signAndSend(sudo)
}

async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider('ws://127.0.0.1:9944') })
  const sudo = /* 注入 sudo keyring 对象或用 extension 选择 Root 账户 */ null

  // 上架花圈/果品/自定义（Instant）
  await createInstant(api, sudo, 11, 'WREATH', 'bafy-...schema')
  await createInstant(api, sudo, 14, 'FRUIT', 'bafy-...schema')
  await createInstant(api, sudo, 19, 'CUSTOM', 'bafy-...schema')

  // 上架蜡烛/清香（Timed）
  await createTimed(api, sudo, 12, 'CANDLE', 'bafy-...schema', 1, null, true, 0)
  await createTimed(api, sudo, 13, 'INCENSE', 'bafy-...schema', 1, null, true, 0)

  console.log('Offerings created')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
```

说明：
- `schemaCid` 为前端约定的媒体 schema（可为任意占位 CID）。
- 上架完成后，前端可直接使用 `memoOfferings.offer((1,graveId), kind_code, amount, media[], duration?)` 下单。
- 供奉为付费动作：`amount` 必须 > 0，链上会实际转账至运行时 `DonationResolver` 解析账户。
