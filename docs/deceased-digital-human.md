# Stardust 逝者数字人开发方案

## 1. 愿景与目标

- **愿景**：在现有 `pallet-deceased` 纪念体系上构建可信、可控的“数字人”形象，让亲友通过语音/视频/对话重温逝者记忆，同时保证治理与隐私合规。
- **核心目标**
  1. 利用链上押金、权限和投诉机制，确保数字人内容的真实性和可追责性（`pallets/deceased/src/lib.rs` 中的押金/治理逻辑 @pallets/deceased/src/lib.rs#4473-7511）。
  2. 形成“档案 → 记忆 → 多模态生成 → 交互呈现”的闭环，兼容现有前端与聊天系统。
  3. 分阶段交付（结构化记忆 → 聊天数字人 → 多模态实时 Avatar）。

## 2. 范围与非目标

| 范畴 | 说明 |
| --- | --- |
| ✅ 链端扩展 | 新增/扩展 Deceased 相关存储、事件、治理接口以支撑数字人格。 |
| ✅ Off-chain AI 服务 | 语料整理、语音/视频生成、情境故事脚本。 |
| ✅ 前端体验 | 纪念馆中的数字人入口、记忆编辑器、互动面板。 |
| ❌ | 不在本阶段实现完全去中心化推理或实时 VR/AR 渲染；使用托管 GPU 服务。 |

## 3. 总体架构

```
┌──────────────────────────────────────────────┐
│                前端体验 (dapp)               │
│  - 数字人主页 / 记忆编辑器 / 互动面板        │
│  - 与现有 chat、contacts、memorial 页面整合   │
└──────────────▲──────────────────────────────┘
               │GraphQL/WebSocket API
┌──────────────┴──────────────────────────────┐
│            Off-chain AI & 服务层              │
│  - Persona Builder：聚合链上档案 + IPFS 记忆  │
│  - Voice/Video Engine：TTS、Talking Avatar    │
│  - Dialogue Agent：与 chat session 对接        │
│  - Audit & Logging：模型版本、Prompt 指纹      │
└──────────────▲──────────────────────────────┘
               │Substrate RPC + IPFS
┌──────────────┴──────────────────────────────┐
│               On-chain 层                    │
│  - `pallet-deceased`：档案、押金、治理        │
│  - `deceased-data`：Life Moments/Life Media  │
│  - 新增 `deceased-persona`：数字人配置         │
│  - `pallet-contacts`：访问权限/好友关系        │
└──────────────────────────────────────────────┘
```

## 4. 数据与链端设计

### 4.1 复用的能力
- **押金体系**：`OwnerDepositRecords`、`check_deposit_sufficient`、`top_up_deposit` 等保障内容质量与交易成本 @pallets/deceased/src/lib.rs#3349-3418, #7117-7240。
- **治理与投诉**：`OwnerOperationComplaints` 与押金扣除策略（80/20 分配）可用于数字人不当内容的追责 @pallets/deceased/src/lib.rs#10202-10437。
- **联系人/权限**：未来数字人访问控制可依赖 `pallet-contacts` 的 `FriendStatus`、黑名单机制。

### 4.2 新增存储（建议在新 pallet `pallet-deceased-persona`）

| 存储 | 类型 | 说明 |
| --- | --- | --- |
| `PersonaProfiles` | `(deceased_id) -> PersonaProfile` | 记录数字人配置：人格标签、声音 timbre、授权状态、可用模态。 |
| `MemoryBlocks` | `(deceased_id, memory_id) -> MemoryBlock` | 结构化记忆段落：时间、地点、情绪、关联媒体 CID。可复用 `deceased-data` pallet。 |
| `PersonaAccessControl` | `(deceased_id, AccountId) -> AccessLevel` | 与联系人/分组联动，定义“公开/亲友/管理员”访问级别。 |
| `PersonaAuditLog` | `VecDeque<PersonaRenderLog>` | 记录每次 AI 输出的模型/Prompt 指纹，便于治理。 |

**PersonaProfile 结构建议**
```rust
pub struct PersonaProfile {
    pub deceased_id: u64,
    pub owner: AccountId,
    pub traits: BoundedVec<u8, MaxTraitLen>,  // 情感标签 JSON
    pub voice_cid: Option<Cid>,               // 语音样本
    pub face_mesh_cid: Option<Cid>,
    pub script_templates: BoundedVec<Cid, MaxTemplates>,
    pub status: PersonaStatus,               // Draft/Active/Suspended
    pub access_tier: AccessTier,             // Public/Contacts/FriendsOnly
    pub last_model_hash: Option<H256>,
    pub updated_at: BlockNumber,
}
```

### 4.3 Extrinsics / Runtime API
1. `create_persona(deceased_id, traits, config)`：仅 owner 可调用，自动检查押金 ≥ 最低阈值（沿用 `ensure_sufficient_deposit_internal`）。
2. `update_persona_config(...)`：更新语音/头像/模板 CID，触发版本递增与 `PersonaProfileUpdated` 事件。
3. `set_persona_access(deceased_id, AccessTier, allowed_accounts)`：与 `pallet-contacts` 集成，支持亲友白名单。
4. `log_persona_render(deceased_id, model_hash, prompt_hash, cid)`（可由链下 Worker 提交）记录生成历史。
5. `suspend_persona` / `resume_persona`：治理或 owner 根据投诉冻结数字人输出。
6. Runtime View API：`get_persona_profile(deceased_id)`、`list_memory_blocks(deceased_id)` 提供前端批量读取。

### 4.4 事件
- `PersonaCreated(deceased_id, owner)`
- `PersonaUpdated(deceased_id, version)`
- `PersonaAccessChanged(deceased_id, tier)`
- `PersonaRenderLogged(deceased_id, render_id)`
- `PersonaSuspended(deceased_id, reason)`

## 5. Off-chain AI & 服务层

| 模块 | 职责 | 依赖 |
| --- | --- | --- |
| Persona Builder | 监听链上 `PersonaProfile`/`MemoryBlock` 事件，聚合 IPFS 内容，生成 Prompt Context。 | Substrate WS、IPFS Gateway |
| Dialogue Agent | 基于大模型（可选 GPT-4o mini / Llama3 finetune）实现上下文问答，集成现有聊天 `lib/chat.ts` 会话机制。 | Chat session API @src/lib/chat.ts#426-507 |
| Voice Synthesizer | 将回答文本转语音，匹配 voice timbre；输出 WAV/MP4 并上传 IPFS。 |
| Avatar Renderer | 使用 Talking Head/TTS Avatar（如 SadTalker）驱动图像或 3D Mesh，生成短视频。 |
| Compliance Logger | 将模型版本、Prompt、输出 CID 记录并调用 `log_persona_render`。 |

### 数据流
1. 亲友在前端新增“记忆块” → 上传到 IPFS → `MemoryBlockCreated`。
2. Persona Builder 拉取最新档案 & 记忆，生成 Persona Context JSON。
3. 当用户发起对话或请求语音：
   - Dialogue Agent 拉取 Context + 用户请求。
   - 调用大模型生成回答。
   - Voice Synthesizer & Avatar Renderer 产出多模态内容 → 上传 IPFS。
   - Compliance Logger 把 `model_hash/prompt_hash/output_cid` 提交链上。
4. 前端展示并缓存结果，可通过聊天模块推送。

## 6. 前端设计（stardust-dapp）

### 6.1 页面与组件
1. **数字人主页 (`#/memorial/persona/:id`)**
   - 3D/视频播放器、实时聊天入口、押金状态提示。
   - 数据来源：`PersonaProfile`、`OwnerDepositRecords`。
2. **记忆编辑器**
   - 类似富文本/时间轴编辑器，支持上传音视频/图片（写入 IPFS + MemoryBlock）。
   - 需要表单校验（长度、CID、押金状态）。
3. **访问控制面板**
   - 可以设置访问级别、邀请联系人（调用 `set_persona_access`，关联 `pallet-contacts`）。
4. **互动中心 / Chat 集成**
   - 复用 `features/chat`，将数字人作为特殊账户（AI Agent）自动响应。
   - 支持语音/视频回复的消息类型（扩展 Message schema）。
5. **治理/日志面板**
   - 展示 `PersonaRenderLogged` 列表、模型版本、投诉入口。

### 6.2 UI/UX 要点
- 在 `MakerContactCard` 样式基础上设计“人格卡片”，突出押金信用。
- 对押金警告、治理状态给出醒目标签。
- 上传内容时提示“链上可追踪、不可撤销”，避免隐私泄露。

## 7. 合规与安全

1. **押金约束**：强制 `PersonaProfile` 依赖押金状态（Active 才允许生成）。押金不足触发补充警告（复用 `supplement_warning` 机制）。
2. **治理联动**：
   - 投诉入口：将数字人输出视为 `OwnerOperation`，可走 `OwnerOperationComplaints` 处理流程。
   - 冻结逻辑：投诉成立 → `PersonaSuspended` + 押金扣款，参考 @pallets/deceased/src/lib.rs#10202-10437。
3. **授权与隐私**：
   - 新增 `family_approval` 字段（链上 `PersonaProfile`）记录多签/agreement。
   - 访问控制与 `pallet-contacts` 黑名单互通，禁止未授权账户调用 AI。
4. **审计**：
   - 每次生成必须提交 `model_hash/prompt_hash/output_cid`，并在 off-chain 保存原始 Prompt（加密存储）。
   - 定期导出日志供治理审计。

## 8. 实施路线

| 阶段 | 时间 | 交付 | 说明 |
| --- | --- | --- | --- |
| Phase 0 | 第 1 月 | 需求细化 + PoC | 明确 PersonaProfile schema、AI 选型；实现链上原型与基础记忆上传。 |
| Phase 1 | 月 2-3 | 结构化记忆 + 语音回放 | 完成 MemoryBlock UI、简单 TTS，纪念馆可播放“语音回忆”。 |
| Phase 2 | 月 4-5 | 聊天型数字人 | 集成 Dialogue Agent、chat 页面；实现访问控制与押金警告联动。 |
| Phase 3 | 月 6+ | 多模态 Avatar + 治理闭环 | 上线视频头像、生成日志、投诉治理自动扣款；探索 VR/小程序接入。 |

## 9. 风险与缓解

| 风险 | 说明 | 缓解 |
| --- | --- | --- |
| 押金不足导致功能失效 | 大量数字人可能押金低于阈值 | 提前在 UI 中展示押金状态，并提供快捷补充入口（`top_up_deposit`). |
| AI 生成内容侵权/不当 | 模型滥用 | 全部输出需留存审计日志，严重违规可触发 `PersonaSuspended` 并扣押金。 |
| 性能与成本 | 多模态推理成本高 | 采用缓存策略：常用问答预生成；使用轻量模型 + 托管 GPU。 |
| 隐私问题 | 亲友记忆包含敏感信息 | 上链只存 CID + Hash，内容加密存储；访问时校验权限。 |

## 10. 下一步工作
1. 明确 `PersonaProfile`/`MemoryBlock` 详细字段及运行时配置。
2. 设计链上事件 → Off-chain 服务的订阅与重试机制。
3. 在 `stardust-dapp` 中增加“数字人”路由与组件骨架。
4. 选定语音/视频生成模型并编写 PoC pipeline。
5. 制定治理流程与 UI（投诉入口、警告展示）。

---
> 参考：`pallets/deceased/src/lib.rs` 押金/治理实现、`pallets/deceased/src/governance.rs` 中 `OwnerDepositRecord` 设计、`src/lib/chat.ts` 聊天接口。
