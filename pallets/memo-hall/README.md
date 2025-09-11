# pallet-memo-hall

独立的纪念馆 Pallet，实现纪念馆创建、主逝者绑定、KYC/限频风控及可选的 `link_grave_id` 与实体墓位松耦合。

## 设计要点
- 可选 `link_grave_id`：与 `pallet-memo-grave` 的实体墓位弱关联，保持低耦合。
- 创建风控：支持 KYC 与创建限频（窗口+上限），参数可治理调整。
- 隐私安全：仅存储元数据 CID，不落明文。

## 关键存储与事件
- `Halls`: 纪念馆主表；字段：`owner/kind/link_grave_id/metadata_cid`
- `CreateHallRate`: 限频计数；`*Param` 存储风控参数。
- 事件：`HallCreated/HallLinkedDeceased/HallParamsUpdated`。

## 与 memo-grave 的关系
- `memo-grave` 仅负责实体墓位；`park_id` 为可选；按 `Some(park_id)` 维护 `GravesByPark` 索引。
- 两者通过 `link_grave_id`（Hall -> Grave）进行可选关联；无循环依赖。

## 迁移路径
- 旧版本中 Hall 逻辑在 `pallet-memo-grave` 内；升级到新版本：
  1. 运行时升级至含 `pallet-memo-hall` 的版本；`memo-grave` StorageVersion 升至 v4 并移除 Hall 相关接口；
  2. 新建 Hall 均通过 `pallet-memo-hall::create_hall`；
  3. 若需迁移历史数据（可选），通过治理离线脚本读取旧链状态并在新 Pallet 重放 `HallCreated` 事件。

## 前端与查询层
- 前端新增独立“纪念馆”入口；支持选择关联墓位（可选）。
- Subsquid 索引 `pallet-memo-hall` 事件，按 `link_grave_id` 关联展示。

## 安全
- 不触碰 MEMO 资金与所有权；仅元数据与事件。
