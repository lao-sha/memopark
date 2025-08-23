# pallet-memorial-offerings

- 作用：祭祀品规格目录与供奉记录；替换旧 `pallet-ritual`。
- 隐私：媒体通过 `pallet-evidence` 存储，业务仅引用 `evidence_id`；不落明文。
- 解耦：目标采用 `(domain_code:u8, id:u64)`；存在性与权限通过 `TargetControl`；回调 `OnOfferingCommitted` 联动积分/统计。

## 存储
- `Specs: kind_code -> OfferingSpec { name, media_schema_cid }`
- `OfferingRecords: id -> OfferingRecord { who, target, kind_code, amount?, evidence_id?, time }`
- `OfferingsByTarget: target -> BoundedVec<id>`
- `NextOfferingId: u64`

## Extrinsics
- `register_spec(kind_code, name, media_schema_cid)`
- `update_spec(kind_code, name?, media_schema_cid?)`
- `offer(target, kind_code, amount?, evidence_id?)`
- `batch_offer([...])`

## 迁移
- 旧 `pallet-ritual` 下线，前端改为使用本 pallet 的 API。历史数据可选择迁移或保留只读。
