# pallet-memo-grave

- 作用：管理墓地（单/双/多人）、归属陵园、容量/转让、安葬/起掘记录。
- 隐私：仅记录承诺/加密 CID 的元数据；不落明文；媒体走 `pallet-evidence`。
- 解耦：与陵园通过 `park_id` 关联；与逝者通过 `deceased_id` 关联；安葬事件通过 `OnIntermentCommitted` 钩子联动。

## 存储
- `NextGraveId: u64`
- `Graves: GraveId -> Grave { park_id, owner, admin_group, kind_code, capacity, metadata_cid, active }`
- `GravesByPark: ParkId -> BoundedVec<GraveId>`
- `Interments: GraveId -> BoundedVec<IntermentRecord>`

## Extrinsics
- `create_grave(park_id, kind_code, capacity?, metadata_cid)`
- `update_grave(id, kind_code?, capacity?, metadata_cid?, active?)`
- `transfer_grave(id, new_owner)`
- `inter(id, deceased_id, slot?, note_cid?)`
- `exhume(id, deceased_id)`

## 权限
- 墓地主人或 `ParkAdminOrigin::ensure(park_id, origin)`。
- 命名变更：本模块已由 `pallet-grave` 更名为 `pallet-memo-grave`，与 `memo-*` 命名统一。
