# Stardust 区块链梅花易数排盘（含 AI 扩展）设计文档

## 1. 背景与现状
- **梅花易数应用**：`mhys` 项目已实现传统起卦算法、体用分析与 AI 解卦流程，包含数字转卦逻辑 `calculateHexagrams`、时间取数 `generateTimeBasedNumbers` 以及前端交互组件（起卦表单、卦象展示、设置与历史记录等）。@mhys/src/lib/meihua.ts#55-149 @mhys/src/app/page.tsx#14-105 @mhys/src/components/HexagramDisplay.tsx#42-120 @mhys/README.md#1-184
- **AI 解释链路**：前端通过 `/api/interpret` 将卦象上下文与体用五行交由大模型生成 500+ 字的古风断语，可配置自定义 Base URL 与模型。@mhys/src/app/api/interpret/route.ts#3-161 @mhys/src/components/SettingsDialog.tsx#6-126
- **Stardust 链基础**：Substrate Runtime 已集成多条业务 Pallet（纪念园区、AI Chat、Bazi Chart 等），并提供 React DApp、Subsquid ETL 与 AI 推理服务目录，适合作为链上占卜记录、AI 结论与激励管理的基座。@stardust/CLAUDE.md#5-175 @stardust/runtime/Cargo.toml#29-101

## 2. 设计目标
1. **链上可信排盘**：将起卦输入、体用五行、三卦（本/互/变）与 Query 元数据写入链上 Pallet，确保不可篡改与可审计。
2. **AI 扩展闭环**：沿用 `mhys` 的 prompt 体例，将 AI 解释结果与签名、使用模型参数链上存证，可溯源不同模型的版本差异。
3. **跨应用复用**：通过 Runtime 提供统一的 `HexagramRecordId` 与事件，供 React DApp、Subsquid、治理模块或 NFT 纪念品互操作。
4. **隐私与激励**：支持对问题正文做哈希/加密上链，开放用户对高质量 AI 解卦投票或打赏的机制，激励生态参与。

## 3. 总体架构
| 层级 | 组件 | 说明 |
| --- | --- | --- |
| 前端层 | Stardust DApp 新增「梅花易数」面板；复用 `mhys` 的起卦 UI/动画逻辑并改写为 React 19 + AntD 组件。@stardust/CLAUDE.md#85-168 | 负责采集数字/问题、展示卦象与 AI 结果、发起链上交易。 |
| 服务层 | (1) WASM Pallet `pallet-meihua-chart`；(2) AI Inference Service（可基于已有 `ai-inference-service/`） | Pallet 持久化排盘，Off-chain Worker/AI 服务负责验证或补全 AI 解释。 |
| AI 层 | 兼容 OpenAI/DeepSeek 等模型，沿用 `mhys` prompt 规则，接入 `pallet-ai-chat` 与 `pallet-ai-trader` 的治理/配额体系。@stardust/runtime/Cargo.toml#36-68 | 记录模型、API、消耗配额并可被治理参数限制。 |
| 数据层 | Subsquid 索引 + IPFS | 对链上事件建索引，支持在 IPFS 存大段 AI 解释或多媒体卦象注解。 |

## 4. 链上排盘 Pallet 设计
### 4.1 数据结构
```rust
#[derive(Encode, Decode, TypeInfo)]
pub struct DivinationInput {
    pub question_commitment: Hash,      // 明文可选
    pub num1: u64,
    pub num2: u64,
    pub num3: u64,
    pub generated_at: Moment,
}

#[derive(Encode, Decode, TypeInfo)]
pub struct HexagramSnapshot {
    pub main: [bool; 6],
    pub mutual: [bool; 6],
    pub changed: [bool; 6],
    pub moving_line: u8,
    pub ti_trigram: u8,
    pub yong_trigram: u8,
    pub ti_wuxing: u8,
    pub yong_wuxing: u8,
}

#[derive(Encode, Decode, TypeInfo)]
pub struct AiInsight {
    pub provider: BoundedVec<u8, ConstU32<64>>, // gpt-4o, deepseek-v3...
    pub prompt_hash: Hash,
    pub content_cid: Option<Cid>,              // 大文本上 IPFS
    pub checksum: Hash,
    pub signature: Option<MultiSignature>,
    pub created_block: BlockNumber,
}

#[derive(Encode, Decode, TypeInfo)]
pub struct HexagramRecord {
    pub owner: AccountId,
    pub input: DivinationInput,
    pub snapshot: HexagramSnapshot,
    pub ai: Option<AiInsight>,
    pub extra: BoundedBTreeMap<BoundedVec<u8, _>, BoundedVec<u8, _>, ConstU32<8>>, // 扩展字段
}
```

### 4.2 存储项
- `Records: Map<HexagramRecordId, HexagramRecord>`
- `OwnerIndex: DoubleMap<AccountId, u64, HexagramRecordId>`（分页）
- `QuestionIndex: Map<Hash, HexagramRecordId>`（去重）
- `LatestRecordId: HexagramRecordId`
- `ModelQuota: Map<(AccountId, ProviderId), Quota>`（可复用 `pallet-ai-chat` 配额逻辑）

### 4.3 Extrinsics
1. `submit_divination(origin, input, snapshot, proof)`
   - 校验 `snapshot` 是否符合 `calculateHexagrams` 算法，可在链上重算或通过 zk-proof/可验证计算（MVP 可直接重算）。
   - 事件：`DivinationStored { record_id, owner }`
2. `attach_ai_interpretation(origin, record_id, ai_insight)`
   - 需记录 `prompt_hash`（哈希 `mhys` prompt 模板+问题+卦象数据）。
   - 事件：`AiInsightAttached { record_id }`
3. `vote_ai_quality(origin, record_id, score)`
   - 为激励机制/声誉系统做准备，可与 `pallet-credit` 或 `pallet-affiliate` 的奖励挂钩。@stardust/runtime/Cargo.toml#72-99
4. `set_question_plaintext(origin, record_id, plaintext, proof)`（可选）
   - 允许拥有者在未来揭示原问题文字，供社区验证。

### 4.4 事件与错误
- 事件：`DivinationStored`、`AiInsightAttached`、`AiQualityVoted`, `QuestionRevealed`
- 错误：`InvalidSnapshot`, `DuplicateQuestion`, `QuotaExceeded`, `RecordNotFound`, `NotRecordOwner`

### 4.5 经济与权限
- 对 `submit_divination` 收取基础权重 + 存储押金，押金可在记录删除/过期后退还。
- `AiInsightAttached` 依据 AI provider 奖励或扣费，费用进入 `pallet-storage-treasury`。@stardust/runtime/Cargo.toml#84-100
- 治理通过 `pallet-governance-params` 统一调参（押金、配额、最大字数等）。@stardust/runtime/Cargo.toml#42-44

## 5. AI 扩展设计
1. **Prompt 规范**：沿用 `mhys` 系统提示，确保体用五行、卦象类象、互变卦趋势与锦囊格式一致，方便前端与链上校验。@mhys/src/app/api/interpret/route.ts#19-153
2. **服务对接**：
   - 前端设置页沿用 `SettingsDialog` 交互，提供 API Base URL/Key/Model 输入；改写为 AntD `Drawer` + `Form` 组件。
   - AI 网关将请求与响应摘要发送到 Pallet，携带 `prompt_hash` 与响应 `blake2` 校验值，确保链上可验证。
3. **链下验证**：`ai-inference-service/` 在接收到链上事件后，对 IPFS CID 内容进行二次签名，或触发 `pallet-ai-chat` 记录使用量。
4. **模型治理**：通过 `pallet-ai-trader` 或 `pallet-ai-chat` 引入模型白名单、价格与限流，避免滥用。@stardust/runtime/Cargo.toml#36-68

## 6. 前端 & 用户旅程
1. **起卦阶段**：
   - UI 交互复用 `DivinationForm`（输入 3 个数字或使用时间自动生成），并展示 Hero/动画。@mhys/src/app/page.tsx#34-105
   - 计算逻辑调用 `calculateHexagrams` 并即时预览卦象线条。
2. **链上提交**：
   - 用户点击「写入区块链」，DApp 将 `DivinationInput`、`HexagramSnapshot`、`question_commitment` 打包为 extrinsic。
   - 若用户暂不想公开问题内容，可仅提交 hash；未来通过 `QuestionRevealed` 解锁。
3. **AI 解卦**：
   - 若本地已有 API Key，则直接调用 AI 服务并将结果保存至 IPFS；否则可以使用链上共享额度（需治理授权）。
   - 完成后调用 `attach_ai_interpretation` 写入链上，并在 Modal 中显示与 `mhys` 相同的古风输出。@mhys/src/components/HexagramDisplay.tsx#42-120
4. **历史与检索**：
   - `HistoryDialog` 逻辑扩展为链上分页查询，利用 Subsquid 提供 GraphQL 端点。
   - 允许将特定 AI 解卦分享到纪念园区或 NFT 纪念碑文。

## 7. 数据流与时序
1. 用户输入/自动生成数字 (`generateTimeBasedNumbers`) → 前端计算 `HexagramSnapshot`。@mhys/src/lib/meihua.ts#127-149
2. DApp 发送 `submit_divination` extrinsic，链上重算校验并存储记录。
3. 事件触发 Subsquid 索引与 Off-chain Worker，写入缓存。
4. 前端/服务调用大模型生成解释文本，连同 `prompt_hash`、`checksum`、`CID` 通过 `attach_ai_interpretation` 上链。
5. 订阅事件的 DApp 刷新 UI，展示链上确认状态；其他用户可对记录评分、引用。

## 8. 安全、隐私与可扩展性
- **数据隐私**：问题正文默认做哈希；如需保密，可使用前端加密（E2EE）并仅上传密文至 IPFS。
- **篡改防护**：链上重算 `HexagramSnapshot`，确保与输入数字一致；`prompt_hash` 防止 AI 内容与输入不一致。
- **配额控制**：依赖 `pallet-ai-chat` 的配额系统，对单账户/模型的调用频率与成本进行治理约束。
- **兼容性**：Pallet 使用 `BoundedVec`/`BoundedBTreeMap` 控制存储，支持未来迁移至 `pallet-bazi-chart` 形成命理组合功能。@stardust/runtime/Cargo.toml#100-101

## 9. 实施路线
1. **Phase A（链上 MVP）**
   - 编写 `pallet-meihua-chart` 基础结构、存储与 extrinsic
   - 在 Runtime 中注册 Pallet 并通过链规格
2. **Phase B（AI 扩展）**
   - 打通 AI 网关 → IPFS → Pallet 流程
   - 在 React DApp 中实现设置面板、AI Modal 与交易签名
3. **Phase C（生态集成）**
   - Subsquid 索引 + Dashboard
   - 与 `pallet-memorial`、`pallet-affiliate` 建立激励/纪念品联动
   - 治理参数化（押金、配额）

---
本设计在保持 `mhys` 古风 AI 解卦体验的同时，利用 Stardust 链提供的多 Pallet 基础、AI 管理与 Subsquid 数据通路，实现可信、可追溯且具扩展性的区块链梅花易数排盘系统。
