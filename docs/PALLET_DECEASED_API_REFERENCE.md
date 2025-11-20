# pallet-deceased 完整接口文档

## 文档概览

**生成时间**: 2025-11-19
**文档版本**: v1.0
**覆盖范围**: pallet-deceased 的链端和前端所有接口
**维护状态**: ✅ 最新版本

---

## 📖 目录

1. [链端 Extrinsics 接口 (68个)](#1-链端-extrinsics-接口)
2. [前端查询接口 (8个)](#2-前端查询接口)
3. [前端交易构建接口 (16个)](#3-前端交易构建接口)
4. [数据类型定义](#4-数据类型定义)
5. [权限体系说明](#5-权限体系说明)
6. [使用示例](#6-使用示例)

---

## 1. 链端 Extrinsics 接口

### 1.1 基础管理类 (4个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **0** | `create_deceased` | Signed | `name, gender_code, name_full_cid, birth_ts, death_ts, links` | **创建逝者记录**<br/>• 自动锁定永久质押押金(10-50 USDT)<br/>• 创建者自动成为owner<br/>• 自动Pin姓名到IPFS |
| **1** | `update_deceased` | Owner | `id, name, gender_code, name_full_cid, birth_ts, death_ts, links` | **更新逝者信息**<br/>• 核心字段不可修改<br/>• 自动Pin更新内容到IPFS |
| **30** | `transfer_deceased_owner` | Owner | `id, new_owner` | **转让逝者所有权**<br/>• 释放旧owner押金<br/>• 锁定新owner押金 |
| **39** | `set_visibility` | Owner | `id, public` | **设置逝者可见性**<br/>• true=公开, false=私密 |

### 1.2 头像管理类 (3个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **40** | `set_main_image` | Owner | `id, cid` | **设置主图**<br/>• 自动Pin到IPFS<br/>• 仅owner可操作 |
| **41** | `clear_main_image` | Owner | `id` | **清空主图**<br/>• 释放IPFS pin资源 |
| **45** | `gov_set_main_image` | Governance | `id, cid, evidence_cid` | **治理强制修改主图**<br/>• 需要证据CID |

### 1.3 治理接口类 (4个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **42** | `gov_update_profile` | Governance | `id, name, gender_code, name_full_cid, birth_ts, death_ts, links, evidence_cid` | **治理更新逝者资料**<br/>• 可修改所有字段<br/>• 必须提供证据CID |
| **44** | `gov_set_visibility` | Governance | `id, public, evidence_cid` | **治理设置可见性**<br/>• 强制公开/私密<br/>• 需要证据CID |
| **46** | `gov_transfer_owner` | Governance | `id, new_owner, evidence_cid` | **治理转移owner**<br/>• 无需旧owner同意<br/>• 需要证据CID |
| **81** | `force_set_category` | Root | `deceased_id, category_code, note_cid` | **Root直接修改分类**<br/>• 绕过申请流程<br/>• 最高权限 |

### 1.4 关系管理类 (7个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **4** | `propose_relation` | Signed | `from, to, kind, note` | **发起关系提案**<br/>• 0=父母,1=配偶,2=兄弟姐妹,3=子女<br/>• 需要对方同意 |
| **5** | `approve_relation` | Owner(to) | `from, to` | **批准关系提案**<br/>• 接收方操作<br/>• 建立双向关系 |
| **6** | `reject_relation` | Owner(to) | `from, to` | **拒绝关系提案**<br/>• 接收方操作 |
| **9** | `cancel_relation_proposal` | Owner(from) | `from, to` | **撤回关系提案**<br/>• 发起方操作 |
| **7** | `revoke_relation` | Owner(任一方) | `from, to` | **撤销关系**<br/>• 任一方可操作<br/>• 立即删除关系 |
| **8** | `update_relation_note` | Owner(任一方) | `from, to, note` | **更新关系备注**<br/>• 任一方可操作 |
| **70** | `follow_deceased` | Signed | `deceased_id` | **关注逝者**<br/>• 社交功能<br/>• 无押金要求 |

### 1.5 亲友团管理类 (8个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **32** | `set_friend_policy` | Owner | `deceased_id, require_approval, is_private, max_members` | **设置亲友团策略**<br/>• 开放/私密模式<br/>• 自动批准/需审核 |
| **33** | `request_join` | Signed | `deceased_id, note` | **申请加入亲友团**<br/>• 留言说明理由 |
| **34** | `approve_join` | Owner | `deceased_id, who` | **批准加入申请**<br/>• 仅owner可操作 |
| **35** | `reject_join` | Owner | `deceased_id, who` | **拒绝加入申请**<br/>• 仅owner可操作 |
| **36** | `leave_friend_group` | Member | `deceased_id` | **退出亲友团**<br/>• 成员自愿退出 |
| **37** | `kick_friend` | Owner | `deceased_id, who` | **移除成员**<br/>• 仅owner可操作 |
| **38** | `set_friend_role` | Owner | `deceased_id, who, role` | **设置成员角色**<br/>• 0=Member, 1=Core |
| **72** | `remove_follower` | Owner | `deceased_id, follower` | **移除关注者**<br/>• 仅owner可操作 |

### 1.6 分类系统类 (4个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **80** | `request_category_change` | Signed | `deceased_id, target_category_code, reason_cid, evidence_cids` | **申请分类修改**<br/>• 锁定10 DUST押金<br/>• 等待委员会审核 |
| **82** | `approve_category_change` | Governance | `request_id` | **批准分类修改**<br/>• 执行分类修改<br/>• 退还全额押金 |
| **83** | `reject_category_change` | Governance | `request_id, reason_cid` | **拒绝分类修改**<br/>• 50%扣款至国库<br/>• 50%退还申请人 |
| **71** | `unfollow_deceased` | Signed | `deceased_id` | **取消关注逝者**<br/>• 移除关注关系 |

### 1.7 作品管理类 (7个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **20** | `upload_work` | Owner | `deceased_id, work_type_encoded, title, description, ipfs_cid, file_size, created_at, tags, privacy_level_code, ai_training_enabled` | **上传单个作品**<br/>• 支持文本/音频/视频<br/>• 可设置隐私级别 |
| **21** | `batch_upload_works` | Owner | `deceased_id, works_encoded` | **批量上传作品**<br/>• 最多50个作品<br/>• 自动统计更新 |
| **22** | `update_work` | Owner | `work_id, title, description, tags, privacy_level_code, ai_training_enabled` | **更新作品元数据**<br/>• 已验证作品无法修改 |
| **23** | `delete_work` | Owner | `work_id` | **删除作品**<br/>• 仅owner可操作<br/>• 自动更新统计 |
| **24** | `verify_work` | Owner/Governance | `work_id` | **验证作品**<br/>• 标记为已验证<br/>• 验证后无法修改 |
| **25** | `view_work` | Signed | `work_id` | **浏览作品**<br/>• 防刷机制<br/>• 每日1000次限制 |
| **26** | `share_work` | Signed | `work_id` | **分享作品**<br/>• 防刷机制<br/>• 每日100次限制 |

### 1.8 作品互动类 (3个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **27** | `favorite_work` | Signed | `work_id, is_favorite` | **收藏作品**<br/>• 防刷机制<br/>• 每日50次限制 |
| **28** | `report_ai_training_usage` | OCW | `work_id, count` | **报告AI训练使用**<br/>• OCW专用接口<br/>• 统计AI使用量 |
| **29** | `top_up_deposit` | Owner | `deceased_id, amount_usdt` | **补充押金**<br/>• 补充逝者押金 |

### 1.9 押金管理类 (3个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **60** | `supplement_deposit` | Owner | `deceased_id, amount_usdt` | **响应补充押金**<br/>• 用户响应警告<br/>• 方案3押金机制 |
| **61** | `unlock_excess_deposit` | Owner | `deceased_id` | **解锁多余押金**<br/>• 保留10 USDT目标值<br/>• 退还超额部分 |
| **62** | `force_supplement_deposit` | Root | `deceased_id` | **强制补充押金**<br/>• Root权限<br/>• 逾期处理机制 |

### 1.10 内容操作治理类 (6个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **73** | `owner_execute_operation` | Owner | `deceased_id, operation, content_type, content_id, new_content_cid, reason` | **拥有者执行操作**<br/>• 基于永久质押<br/>• 无需额外押金 |
| **74** | `complain_owner_operation` | Signed | `operation_id, complaint_type, reason, evidence_cids` | **投诉拥有者操作**<br/>• 锁定2 USDT押金 |
| **75** | `review_owner_complaint` | Governance | `complaint_id, decision, review_note` | **审核操作投诉**<br/>• 治理权限<br/>• 分配押金 |
| **76** | `non_owner_execute_operation` | Signed | `deceased_id, operation, content_type, content_id, new_content_cid, reason` | **非拥有者执行操作**<br/>• 支付1 USDT服务费<br/>• 锁定2 USDT押金 |
| **77** | `owner_delete_non_owner_operation` | Owner | `operation_id` | **删除非拥有者操作**<br/>• 拥有者无成本删除<br/>• 保护owner权益 |
| **84** | `auto_finalize_operation` | System | `operation_id` | **自动确认操作**<br/>• 30天无投诉自动生效 |

### 1.11 文本内容管理类 (3个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **78** | `create_text` | Owner | `deceased_id, kind, cid, title, summary` | **创建文本内容**<br/>• 文章或留言<br/>• IPFS存储 |
| **79** | `update_text` | Owner | `text_id, new_cid, new_title, new_summary` | **更新文本内容**<br/>• 更新IPFS CID |
| **85** | `delete_text` | Owner | `text_id` | **删除文本内容** |

### 1.12 多媒体内容管理类 (3个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **87** | `create_album` | Owner | `deceased_id, name, description, cover_cid` | **创建相册**<br/>• 设置封面CID |
| **88** | `update_album` | Owner | `album_id, name, description, cover_cid` | **更新相册信息** |
| **89** | `delete_album` | Owner | `album_id` | **删除相册** |

### 1.13 媒体管理类 (3个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **90** | `create_media` | Owner | `deceased_id, album_id, cid, type, duration, file_size` | **创建媒体文件**<br/>• 图片/音频/视频 |
| **91** | `update_media` | Owner | `media_id, cid, type, duration, file_size` | **更新媒体文件** |
| **92** | `delete_media` | Owner | `media_id` | **删除媒体文件** |

### 1.14 生平信息类 (1个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **86** | `update_life` | Owner | `deceased_id, cid` | **更新生平信息**<br/>• IPFS CID格式 |

### 1.15 投诉系统类 (4个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **96** | `complain_text` | Signed | `text_id, complaint_type, reason, evidence_cids` | **投诉文本内容**<br/>• 锁定投诉押金 |
| **97** | `review_text_complaint` | Governance | `complaint_id, decision, review_note` | **审核文本投诉** |
| **98** | `complain_media` | Signed | `media_id, complaint_type, reason, evidence_cids` | **投诉媒体内容**<br/>• 锁定投诉押金 |
| **99** | `review_media_complaint` | Governance | `complaint_id, decision, review_note` | **审核媒体投诉** |

### 1.16 治理提案类 (3个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **100** | `submit_token_revision_proposal` | Owner | `deceased_id, new_token, reason_cid` | **提交token修改提案**<br/>• 3次自主修改限制后<br/>• 需要治理投票 |
| **101** | `vote_token_revision_proposal` | Committee | `proposal_id, vote` | **投票token修改提案**<br/>• 委员会成员投票 |
| **102** | `record_owner_operation` | System | `deceased_id, operation_type, content_cid, reason` | **记录拥有者操作**<br/>• 审计追踪 |

### 1.17 审核和记录类 (2个)

| Call Index | 函数名 | 权限 | 参数 | 功能说明 |
|-----------|--------|------|------|---------|
| **103** | `submit_operation_complaint` | Signed | `operation_id, complaint_type, evidence_cids` | **提交操作投诉** |
| **104** | `review_operation_complaint` | Governance | `complaint_id, decision` | **审核操作投诉** |

---

## 2. 前端查询接口

### 2.1 基础查询 (8个)

| 方法名 | 参数 | 返回类型 | 功能说明 |
|-------|------|---------|---------|
| `getDeceased` | `id: number` | `Promise<DeceasedInfo \| null>` | **查询单个逝者**<br/>• 包含完整信息<br/>• 自动查询分类 |
| `listDeceased` | `filter?: DeceasedFilter` | `Promise<DeceasedInfo[]>` | **查询逝者列表**<br/>• 支持过滤条件<br/>• 按创建时间倒序 |
| `getMessages` | `deceasedId: number` | `Promise<TextMessage[]>` | **查询文本消息**<br/>• 获取所有留言 |
| `getEulogies` | `deceasedId: number` | `Promise<Eulogy[]>` | **查询悼词**<br/>• 获取所有悼词 |
| `getAlbums` | `deceasedId: number` | `Promise<Album[]>` | **查询相册列表**<br/>• 包含照片数量 |
| `getPhotos` | `deceasedId: number, albumId: number` | `Promise<Photo[]>` | **查询相册照片**<br/>• 指定相册的所有照片 |
| `getVideoCollections` | `deceasedId: number` | `Promise<VideoCollection[]>` | **查询视频集列表**<br/>• 包含视频数量 |
| `getVideos` | `deceasedId: number, collectionId: number` | `Promise<Video[]>` | **查询视频集视频**<br/>• 指定视频集的所有视频 |

### 2.2 分类系统查询 (4个)

| 方法名 | 参数 | 返回类型 | 功能说明 |
|-------|------|---------|---------|
| `getDeceasedCategory` | `deceasedId: number` | `Promise<DeceasedCategory>` | **查询逝者分类**<br/>• 获取当前分类 |
| `getCategoryChangeRequest` | `requestId: number` | `Promise<CategoryChangeRequest \| null>` | **查询分类修改申请**<br/>• 申请详细信息 |
| `getUserCategoryRequests` | `account: string, deceasedId: number` | `Promise<number[]>` | **查询用户申请历史**<br/>• 指定逝者的申请ID列表 |
| `getNextRequestId` | - | `Promise<number>` | **查询下一个申请ID**<br/>• 用于预测ID |

---

## 3. 前端交易构建接口

### 3.1 基础操作 (4个)

| 方法名 | 参数 | 返回类型 | 功能说明 |
|-------|------|---------|---------|
| `buildCreateDeceasedTx` | `CreateDeceasedParams` | `SubmittableExtrinsic` | **构建创建逝者交易**<br/>• 包含所有必要字段 |
| `buildUpdateDeceasedTx` | `UpdateDeceasedParams` | `SubmittableExtrinsic` | **构建更新逝者交易**<br/>• 支持部分字段更新 |
| `buildDeleteDeceasedTx` | `deceasedId: number` | `SubmittableExtrinsic` | **构建删除逝者交易**<br/>• 仅创建者可删除 |
| `buildTransferOwnershipTx` | `deceasedId: number, newOwner: string` | `SubmittableExtrinsic` | **构建转让所有权交易** |

### 3.2 内容管理 (8个)

| 方法名 | 参数 | 返回类型 | 功能说明 |
|-------|------|---------|---------|
| `buildAddMessageTx` | `AddMessageParams` | `SubmittableExtrinsic` | **构建添加消息交易**<br/>• 文本消息和标签 |
| `buildAddEulogyTx` | `AddEulogyParams` | `SubmittableExtrinsic` | **构建添加悼词交易**<br/>• 标题和内容CID |
| `buildCreateAlbumTx` | `CreateAlbumParams` | `SubmittableExtrinsic` | **构建创建相册交易**<br/>• 名称描述和封面 |
| `buildAddPhotoTx` | `AddPhotoParams` | `SubmittableExtrinsic` | **构建添加照片交易**<br/>• CID、说明和标签 |
| `buildCreateVideoCollectionTx` | `CreateVideoCollectionParams` | `SubmittableExtrinsic` | **构建创建视频集交易** |
| `buildAddVideoTx` | `AddVideoParams` | `SubmittableExtrinsic` | **构建添加视频交易**<br/>• 包含时长信息 |

### 3.3 分类系统 (4个)

| 方法名 | 参数 | 返回类型 | 功能说明 |
|-------|------|---------|---------|
| `buildRequestCategoryChangeTx` | `SubmitCategoryChangeParams` | `SubmittableExtrinsic` | **构建申请分类修改交易**<br/>• 需要理由和证据CID |
| `buildApproveCategoryChangeTx` | `requestId: number` | `SubmittableExtrinsic` | **构建批准申请交易**<br/>• 治理权限 |
| `buildRejectCategoryChangeTx` | `ProcessCategoryChangeParams` | `SubmittableExtrinsic` | **构建拒绝申请交易**<br/>• 可选理由CID |
| `buildForceSetCategoryTx` | `ForceSetCategoryParams` | `SubmittableExtrinsic` | **构建强制设置分类交易**<br/>• Root权限 |

---

## 4. 数据类型定义

### 4.1 逝者基本信息

```typescript
interface DeceasedInfo {
  id: number
  owner: string                    // 拥有者账户
  creator: string                  // 创建者账户
  fullName: string                 // 完整姓名
  fullNameCid: string             // 姓名IPFS CID
  birthDate: number               // 出生日期(时间戳)
  deathDate: number               // 死亡日期(时间戳)
  gender: Gender                  // 性别枚举
  mainImageCid: string            // 主图IPFS CID
  bio: string                     // 简介
  bioCid: string                  // 简介IPFS CID
  category: DeceasedCategory      // 分类

  // Pin状态
  fullNamePinStatus: PinStatus
  mainImagePinStatus: PinStatus
  bioPinStatus: PinStatus

  // 生命周期
  lifeYears?: number
  createdAt: number
  updatedAt: number
}
```

### 4.2 分类枚举

```typescript
enum DeceasedCategory {
  Ordinary = 0,         // 普通民众
  HistoricalFigure = 1, // 历史人物
  Martyr = 2,           // 革命烈士
  Hero = 3,             // 英雄模范
  PublicFigure = 4,     // 公众人物
  ReligiousFigure = 5,  // 宗教人物
  EventHall = 6,        // 事件馆
}
```

### 4.3 过滤条件

```typescript
interface DeceasedFilter {
  owner?: string        // 按拥有者过滤
  creator?: string      // 按创建者过滤
  gender?: Gender       // 按性别过滤
  limit?: number        // 限制返回数量
}
```

### 4.4 Pin状态

```typescript
enum PinStatus {
  Unpinned = 'Unpinned',       // 未固定
  Pinning = 'Pinning',         // 固定中
  Pinned = 'Pinned',           // 已固定
  PinFailed = 'PinFailed',     // 固定失败
}
```

---

## 5. 权限体系说明

### 5.1 权限等级

| 权限级别 | 说明 | 可执行操作 |
|---------|------|-----------|
| **Root** | 最高权限 | • 强制修改分类<br/>• 强制补充押金<br/>• 所有治理操作 |
| **Governance** | 治理权限 | • 强制修改逝者信息<br/>• 审核投诉<br/>• 批准/拒绝分类申请 |
| **Owner** | 拥有者 | • 修改逝者信息<br/>• 管理内容<br/>• 转让所有权 |
| **Signed** | 签名用户 | • 创建逝者<br/>• 申请分类修改<br/>• 社交操作 |

### 5.2 押金机制

#### 创建押金（永久质押）
- **基础押金**: 10 USDT（创建时锁定）
- **扩展押金**: 20-50 USDT（按规模递增）
- **转让机制**: 旧owner释放，新owner锁定

#### 操作押金（临时锁定）
- **分类申请**: 10 DUST（批准退还，拒绝50%扣款）
- **投诉押金**: 2 USDT（成立时分配给投诉人）
- **非owner操作**: 1 USDT服务费 + 2 USDT押金

### 5.3 防刷机制

#### 每日限额（Phase 5）
- **浏览作品**: 1000次/天，单作品10次/天
- **分享作品**: 100次/天，1分钟防重复
- **收藏作品**: 50次/天
- **异常检测**: 自动警告和限制

---

## 6. 使用示例

### 6.1 创建逝者

```typescript
// 1. 构建交易
const createParams: CreateDeceasedParams = {
  fullName: "张三",
  fullNameCid: "QmFullNameCID...",
  birthDate: 631152000, // 1990-01-01
  deathDate: 1640995200, // 2022-01-01
  gender: Gender.Male,
  mainImageCid: "QmImageCID...",
  bio: "生平简介",
  bioCid: "QmBioCID..."
}

const tx = deceasedService.buildCreateDeceasedTx(createParams)

// 2. 签名并提交
await tx.signAndSend(signer, (result) => {
  if (result.status.isInBlock) {
    console.log('逝者创建成功')
  }
})
```

### 6.2 查询逝者列表

```typescript
// 查询特定用户创建的逝者
const filter: DeceasedFilter = {
  owner: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  gender: Gender.Male,
  limit: 50
}

const deceasedList = await deceasedService.listDeceased(filter)
console.log(`找到 ${deceasedList.length} 位逝者`)
```

### 6.3 分页查询

```typescript
// 使用分页Hook
import { useDeceasedPagination } from '../hooks/useDeceasedPagination'

function DeceasedListPage() {
  const [allDeceased, setAllDeceased] = useState<DeceasedInfo[]>([])

  const pagination = useDeceasedPagination(allDeceased, {
    pageSize: 20,
    showSizeChanger: true,
    showQuickJumper: true,
  })

  return (
    <div>
      <DeceasedPaginatedList
        allDeceased={allDeceased}
        pageSize={20}
        showPerformanceStats={true}
      />
    </div>
  )
}
```

### 6.4 申请分类修改

```typescript
// 申请将普通逝者升级为英雄模范
const changeParams: SubmitCategoryChangeParams = {
  deceasedId: 123,
  targetCategory: DeceasedCategory.Hero,
  reasonCid: "QmReasonCID...",
  evidenceCids: ["QmEvidence1CID...", "QmEvidence2CID..."]
}

const tx = deceasedService.buildRequestCategoryChangeTx(changeParams)
await tx.signAndSend(signer)
```

### 6.5 权限检查

```typescript
// 检查是否是逝者owner
async function checkOwnership(deceasedId: number, account: string): Promise<boolean> {
  const deceased = await deceasedService.getDeceased(deceasedId)
  return deceased?.owner === account
}

// 检查是否可以修改逝者信息
async function canUpdateDeceased(deceasedId: number, account: string): Promise<boolean> {
  return await checkOwnership(deceasedId, account)
}
```

---

## 📚 参考文档

- [pallet-deceased 代码审查报告](./PALLET_DECEASED_QUERY_AUDIT.md)
- [Substrate Extrinsics 文档](https://docs.substrate.io/fundamentals/transaction-types/)
- [Polkadot.js API 文档](https://polkadot.js.org/docs/api/)

---

**文档维护人**: Claude Code
**最后更新**: 2025-11-19
**版本**: v1.0