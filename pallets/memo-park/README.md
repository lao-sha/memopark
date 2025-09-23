# pallet-memo-park

- 作用：登记陵园（全球国家/地区）、元数据（仅加密 CID）、治理主体（由 runtime 适配）。
- 隐私：链上只存承诺/加密 CID；明文在端侧/服务端加密后存 IPFS。
- 解耦：管理员权限通过 `ParkAdminOrigin` Trait 由 runtime 适配到官方治理（collective/multisig）。

## 存储
- `NextParkId: u64`
- `Parks: ParkId -> Park { owner, admin_group, country_iso2, region_code, metadata_cid, active }`
- `ParksByCountry: [u8;2] -> BoundedVec<ParkId>`

## Extrinsics
- `create_park(country_iso2, region_code, metadata_cid)`
- `update_park(id, region_code?, metadata_cid?, active?)`
- `set_park_admin(id, admin_group?)`
- `transfer_park(id, new_owner)`

## 权限
- 所有者或 `ParkAdminOrigin::ensure(park_id, origin)` 通过的起源。

## 集成
- 在 runtime 中实现 `ParkAdminOrigin`，建议使用 `pallet-collective` 或 `pallet-multisig` 规则。

## 强制接口（治理专用）
- 起源：`GovernanceOrigin`（Root 或 内容委员会 2/3 阈值）。
- 事件：所有强制操作需记录证据 CID（IPFS 明文，注意不加密）。
- 统一治理校验：所有 `gov_*` 接口使用内部辅助 `ensure_gov(origin)`，未授权统一返回 `NotAdmin` 模块错误，便于前端与索引统一处理。
- 列表：
  - `gov_update_park(id, region_code?, metadata_cid?, active?, evidence_cid)`：强制更新园区数据。
  - `gov_set_park_admin(id, admin_group?, evidence_cid)`：强制设置管理员标识。
  - `gov_transfer_park(id, new_owner, evidence_cid)`：强制转让所有权。
  - `gov_set_park_cover(id, cover_cid?, evidence_cid)`：事件化设置/清空封面（不落存储）。

## 委员会阈值 + 申诉治理流程
- 申诉：前端 `#/gov/appeal` 提交 `domain/action/target/reason_cid/evidence_cid`，链上冻结押金。
- 审批：内容委员会 2/3 通过进入公示；驳回/撤回按参数罚没至国库。
- 执行：公示期满路由至本模块 `gov_*` 执行并记录证据事件；CID 明文不加密。
- 模板：前端 `#/gov/templates` 提供常用动作说明与复制入口。

### 前端提示
- 强制接口仅对委员会/Root 可见；普通用户应看到“需内容委员会审批”的提示。
- 事件化封面：订阅 `GovParkCoverSet` 展示最新封面。
