# 八字 / 梅花公共 AI·Market·NFT 模块抽象设计

## 1. 背景与目标
- `pallet-bazi-chart` 已提供底层命盘计算与存储能力，未来的 `pallet-bazi-chat`（AI 咨询入口）与八字增值服务会复制梅花生态中 AI 解卦、服务市场、卦象 NFT 的模式。
- 现有 `pallet-meihua-ai`、`pallet-meihua-market`、`pallet-meihua-nft` 已经跑通完整业务闭环，但实现里硬编码了“梅花卦象”语义，复用到八字或其他玄学门类（紫微斗数、奇门等）会重复造轮子。
- 本文分析抽离为 `pallet-xuanxue-ai`、`pallet-xuanxue-market`、`pallet-xuanxue-nft` 等领域公用模块的合理性与可行性，并给出设计蓝图。

## 2. 现状评估
### 2.1 八字模块
- `pallets/bazi-chart/src/lib.rs` 中的配置与存储 (`BaziCharts`, `ChartById`) 仅聚焦命盘计算和持久化，没有服务、AI、NFT 延伸能力。
- 八字聊天/AI 模块尚未落地，意味着抽象可直接以“公共模块”优先，自上而下为八字接入做准备。

### 2.2 梅花生态支持模块
| 模块 | 定位 | 与领域的耦合点 |
| --- | --- | --- |
| `pallet-meihua-ai` | 链上解卦请求排队、预言机结算、争议处理 | `InterpretationRequest` 将业务主体写死为 `hexagram_id`，`InterpretationType` 也围绕卦象语义构建。 |
| `pallet-meihua-market` | 占卜服务撮合与履约 | 结构基本通用，`Specialty`/`ProviderTier` 可以参数化，逻辑和资产类型无直接梅花依赖。 |
| `pallet-meihua-nft` | 卦象 NFT 铸造、交易、版税 | `HexagramProvider` trait、稀有度算法强依赖梅花卦象数据格式。 |

## 3. 抽离的合理性
1. **业务模式一致**：八字、梅花、奇门等玄学模块都需要“占卜卡片/命盘 → AI 解释/真人服务 → NFT 化”这一流程，抽象为“玄学资产 + 服务 + 数字所有权”三层更贴近领域本质。
2. **治理与经济模型复用**：AI 请求费用、服务抽成、NFT 版税都需要统一风控与治理开关，若分别实现将导致多套参数与权限配置。
3. **运行时膨胀可控**：在现有架构里，每个模块独立包含一套订单、争议、结算逻辑；抽象后可通过通用 pallet + 细分配置降低重复链上状态。
4. **跨模块互操作**：公共 AI/市场/NFT 模块天然支持多个“玄学资产类型”并存，允许同一个市场里既售卖梅花卦象、又售卖八字服务；NFT 也可以允许跨资产合集，提升应用体验。

## 4. 可行性分析
- `pallet-meihua-ai` 除了 `hexagram_id`、`InterpretationType` 命名外，其请求/预言机/争议流程完全通用，可通过引入 `DivinationSubjectId` 泛型和 `SubjectInspector` trait 替换硬编码字段，实现跨模块复用。
- `pallet-meihua-market` 已对外暴露 Provider / Package / Order 基本结构，只需把领域特定枚举（擅长领域、服务类型）抽象为运行时常量或 `Parameter + MaxEncodedLen` 泛型，即可作为公共市场层。
- `pallet-meihua-nft` 里 `HexagramProvider` 是一个天然的抽象点，只需将其泛化为 `EsotericAssetProvider`，并为稀有度评估提供 hook（或权重表配置）即可支撑不同命盘数据。
- 运行时层面：公共 pallet 可以通过 `Config` trait 关联不同资产提供者（例如 `type SubjectProvider = BaziChartProvider` 或 `MeihuaHexagramProvider`），不会破坏当前 runtime 编译。

## 5. 总体架构（目标）
```
┌─────────────────────────────────────────────┐
│                 Xuanxue Runtime             │
├────────────┬──────────────────┬────────────┤
│ Domain Pallets (Bazi, Meihua, …)           │
│ - 生成玄学资产 (Chart/Hexagram/…)          │
├────────────┼──────────────────┼────────────┤
│ Shared Support Layer                       │
│ - pallet-xuanxue-ai      (解读请求/预言机) │
│ - pallet-xuanxue-market  (服务撮合)       │
│ - pallet-xuanxue-nft     (NFT 铸造/交易)  │
├────────────┴──────────────────┴────────────┤
│ Common infra: Treasury, Governance, OCW, … │
└─────────────────────────────────────────────┘
```

## 6. 模块设计要点
### 6.1 pallet-xuanxue-ai（通用解读与预言机）
1. **核心数据结构**
   - `DivinationSubjectId`：`Config` 中定义的资产 ID（u64/by hash），映射到八字命盘或卦象等。
   - `InterpretationTemplateId`/`TopicId`：替代硬编码的解读类型，让运行时可以通过枚举或 `BoundedVec<u8>` 描述自定义主题。
   - `OracleNode`、`InterpretationResult` 复用现有结构，新增 `subject_kind` 字段用于跨领域统计。
2. **关键 Trait**
   - `SubjectInspector`: { `fn exists(id)`; `fn owner(id)`; `fn metadata(id) -> SubjectMetadata` }。
   - `TopicCatalog`: 由治理配置各种主题的费用倍率/特性，供每个领域独立扩展。
3. **流程**
   - Domain pallet（八字/梅花等）将资产 ID + 主题 + 附加上下文 hash 提交给共享 AI pallet；
   - OCW/预言机调度、争议判定沿用现有逻辑；
   - 费用拆分（预言机/金库/领域激励）通过 `Config` 里的策略 hook。
4. **扩展点**
   - 支持多资产来源（同一个请求可以引用“八字 + 当前卦”的组合），通过 `Vec<SubjectRef>` 承载。
   - 为 `pallet-bazi-chat` 暴露回调接口，让会话中触发的 AI 请求直接落在共享 pallet。

### 6.2 pallet-xuanxue-market（通用占卜服务市场）
1. **Provider 抽象**：保留押金、等级、评分等字段，`specialties` 改成运行时可配置的 bitset（或 `BoundedVec<DomainTag>`），允许每个领域自己映射标签。
2. **订单模型**：现有 `Order` 结构已经包含 `question_cid`、`answer_cid` 等通用字段；新增 `subject_refs` 字段以便指向不同玄学资产或多资产组合。
3. **领域适配**：通过 `Config` 中的 `type DomainResolver: MarketDomainResolver` 返回每个订单可接受的领域/资产类型，避免梅花/八字之间互相污染。
4. **经济模型**：平台抽成、分润算法复用，并提供 Governance hook 改变费率、仲裁流程。

### 6.3 pallet-xuanxue-nft（通用玄学 NFT）
1. **资产提供者 Trait**：`EsotericAssetProvider` 统一 `exists/owner/data_for_rarity` 等方法，支持八字（命盘 hash）、梅花卦象、甚至 AI 生成图像。
2. **稀有度/属性 Pipeline**：
   - 引入 `RarityCalculator` trait（可选 OCW），从 `SubjectMetadata` 推导稀有度等级。
   - Metadata 中采用 `KeyValueProperty` 可扩展字段，避免写死“上卦/下卦”。
3. **NFT 与服务联动**：
   - 在 listing 里增加 `linked_subject` 与 `service_bundle_id`，让用户可同时购买命盘 NFT + 咨询权益。
4. **安全性**：对不同资产类型可配置铸造权限控制（仅资产所有者/治理/授权账户）。

## 7. 运行时集成建议
| 步骤 | 八字 | 梅花 |
| --- | --- | --- |
| Asset Provider | 基于 `pallet-bazi-chart` 暴露 `BaziChartProvider` trait，实现 `exists/owner/metadata`； | 现有 `pallet-meihua` 暴露 `HexagramProvider` 即可实现新 trait。 |
| AI 请求入口 | `pallet-bazi-chat` → 调用 `pallet-xuanxue-ai::request_interpretation`，subject 为八字 ID，topic 取治理配置的八字专题。 | `pallet-meihua` 直接迁移现有 extrinsic 到共享 pallet，并同样通过 topic 系统承载“变卦/体用”等类型。 |
| 服务市场 | Domain pallet 仅负责注册其专家/套餐映射到 market pallet；可通过标签过滤出“八字老师”或“梅花老师”。 | 迁移后 market pallet 原接口不变，仅新增 domain 参数。 |
| NFT | 共用 `pallet-xuanxue-nft`，两种资产都能铸造并交易，用户可在一个收藏夹里混合展示。 |

## 8. 迁移与实施计划
1. **阶段 0：接口梳理**
   - 定义 `SubjectInspector`、`EsotericAssetProvider`、`MarketDomainResolver` 等 trait；
   - 在现有梅花模块内部先实现这些 trait（保持功能不变），验证抽象边界。
2. **阶段 1：复制-粘贴式抽离**
   - 新建 `pallet-xuanxue-ai`，将 `pallet-meihua-ai` 代码迁移过来并将 `hexagram_id` 改为泛型 subject；
   - 同步编译通过后，让梅花 runtime 依赖新 pallet，八字暂时只编译不接入 extrinsic。
3. **阶段 2：Market/NFT 抽象**
   - 类似步骤对 market / NFT 进行迁移；
   - 引入领域标签/资产 provider 的配置。
4. **阶段 3：八字接入**
   - `pallet-bazi-chart` 增加 `impl SubjectInspector for BaziChart`；
   - `pallet-bazi-chat` 直接复用共享 AI pallet；
   - 为八字服务创建默认 topic、market 标签、NFT 属性模板。
5. **阶段 4：统一治理与指标**
   - 通过 runtime 参数或治理 pallet，对三大公用模块开放统一的调参/指标接口。

## 9. 风险与缓解
| 风险 | 影响 | 缓解策略 |
| --- | --- | --- |
| Trait 抽象不足导致运行时 break | 会引入 breaking change | 先在梅花模块内部引入 trait 再迁移，确保 `impl` 通过编译后才启用公共 pallet。 |
| 运行时重量增加 | 编译产物体积、链上存储上升 | 公共 pallet 需 feature-gate 未使用功能；同时通过 runtime `construct_runtime!` 只注册所需 extrinsic。 |
| 多领域费用、版税冲突 | 错误的费用配置影响经济模型 | Fee 配置结构中加入 `domain_id` 维度，默认继承全局值，可被治理覆盖。 |
| NFT 稀有度算法差异 | 不同玄学资产计算逻辑不同 | 把稀有度算法挂钩 trait/OCW，领域自行实现；公共 pallet 只负责调用。 |

## 10. 后续工作
1. 编写 `SubjectMetadata` / `DivinationTopic` 规范与编码格式；
2. 为共享模块补充端到端集成测试（梅花 + 八字混合场景）；
3. 将市场与 NFT 模块的事件/metrics 指标统一输出，便于前端复用；
4. 设计跨领域激励计划（例如 NFT 二次交易手续费回流对应领域国库）。
