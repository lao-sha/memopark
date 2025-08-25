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
