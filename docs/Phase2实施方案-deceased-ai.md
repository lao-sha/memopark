# Phase 2 实施方案 - pallet-deceased-ai 设计与实现

## 📋 目标概述

创建 `pallet-deceased-ai` 作为AI训练准备层，提供标准化的数据导出、权限管理和AI对接能力。

**时间周期**: 2个月
**核心目标**:
- ✅ 创建独立的AI处理pallet
- ✅ 实现安全的数据导出API
- ✅ 制定完整的AI对接标准

---

## 🏗️ 架构设计

### 1. Pallet职责划分

```
┌─────────────────────┐
│  pallet-deceased    │  ← Phase 1: 数据存储层
│  - 作品记录         │
│  - 元数据管理       │
│  - 权限控制         │
└──────────┬──────────┘
           │ 读取
           ↓
┌─────────────────────┐
│ pallet-deceased-ai  │  ← Phase 2: AI准备层
│  - 数据聚合         │
│  - 导出格式化       │
│  - AI服务管理       │
│  - 训练状态追踪     │
└──────────┬──────────┘
           │ RPC
           ↓
┌─────────────────────┐
│   AI训练系统        │  ← Phase 3: 外部AI服务
│  - 数据获取         │
│  - 模型训练         │
│  - 智能体生成       │
└─────────────────────┘
```

### 2. 核心功能模块

#### 模块1: AI服务提供商管理
- 注册/注销AI服务
- 授权管理
- 配额控制

#### 模块2: 数据导出引擎
- 按条件查询作品
- 批量导出
- 增量更新
- 格式转换(SCALE → JSON)

#### 模块3: 训练任务管理
- 创建训练任务
- 追踪训练状态
- 记录数据使用

#### 模块4: 智能体注册
- 登记训练完成的AI智能体
- 关联到逝者ID
- 版本管理

---

## 📊 数据结构设计

### 1. AI服务提供商

```rust
/// AI服务提供商注册信息
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
pub struct AIServiceProvider<AccountId, BlockNumber> {
    /// 服务提供商账户
    pub account: AccountId,
    /// 服务名称
    pub name: BoundedVec<u8, ConstU32<100>>,
    /// 服务描述
    pub description: BoundedVec<u8, ConstU32<500>>,
    /// API端点
    pub api_endpoint: BoundedVec<u8, ConstU32<200>>,
    /// 是否已验证
    pub verified: bool,
    /// 数据访问配额（每月）
    pub monthly_quota: u32,
    /// 已使用配额
    pub used_quota: u32,
    /// 注册时间
    pub registered_at: BlockNumber,
    /// 最后活跃时间
    pub last_active: BlockNumber,
}
```

### 2. 训练任务

```rust
/// AI训练任务记录
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
pub struct TrainingTask<AccountId, DeceasedId, BlockNumber> {
    /// 任务ID
    pub task_id: u64,
    /// 逝者ID
    pub deceased_id: DeceasedId,
    /// AI服务提供商
    pub provider: AccountId,
    /// 训练数据集快照哈希
    pub dataset_hash: [u8; 32],
    /// 包含的作品ID列表（最多1000个）
    pub work_ids: BoundedVec<u64, ConstU32<1000>>,
    /// 训练状态
    pub status: TrainingStatus,
    /// 创建时间
    pub created_at: BlockNumber,
    /// 完成时间（可选）
    pub completed_at: Option<BlockNumber>,
    /// 结果CID（IPFS存储训练结果）
    pub result_cid: Option<BoundedVec<u8, ConstU32<64>>>,
}

/// 训练状态枚举
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
pub enum TrainingStatus {
    /// 待处理
    Pending,
    /// 数据准备中
    PreparingData,
    /// 训练中
    Training,
    /// 已完成
    Completed,
    /// 失败
    Failed,
    /// 已取消
    Cancelled,
}
```

### 3. AI智能体注册

```rust
/// AI智能体元数据
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
pub struct AIAgent<AccountId, DeceasedId, BlockNumber> {
    /// 智能体ID
    pub agent_id: u64,
    /// 关联的逝者ID
    pub deceased_id: DeceasedId,
    /// 训练任务ID
    pub task_id: u64,
    /// 模型版本
    pub version: u32,
    /// 模型CID（IPFS存储）
    pub model_cid: BoundedVec<u8, ConstU32<64>>,
    /// 模型类型
    pub model_type: AIModelType,
    /// 训练提供商
    pub provider: AccountId,
    /// 部署状态
    pub deployment_status: DeploymentStatus,
    /// 创建时间
    pub created_at: BlockNumber,
    /// 最后更新时间
    pub updated_at: BlockNumber,
}

/// AI模型类型
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
pub enum AIModelType {
    /// 文本生成（GPT类）
    TextGeneration,
    /// 语音合成
    VoiceSynthesis,
    /// 视频生成
    VideoGeneration,
    /// 多模态
    Multimodal,
}

/// 部署状态
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
pub enum DeploymentStatus {
    /// 测试中
    Testing,
    /// 已上线
    Live,
    /// 已下线
    Offline,
}
```

### 4. 数据导出格式

```rust
/// 导出的作品数据（用于AI训练）
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo)]
pub struct ExportedWork {
    /// 作品ID
    pub work_id: u64,
    /// 逝者ID
    pub deceased_id: u64,
    /// 作品类型
    pub work_type: WorkType,
    /// 标题
    pub title: Vec<u8>,
    /// 描述
    pub description: Vec<u8>,
    /// IPFS CID
    pub ipfs_cid: Vec<u8>,
    /// 文件大小
    pub file_size: u64,
    /// 创作时间
    pub created_at: Option<u64>,
    /// 标签
    pub tags: Vec<Vec<u8>>,
    /// 情感倾向
    pub sentiment: Option<i8>,
    /// 风格标签
    pub style_tags: Vec<Vec<u8>>,
    /// 专业领域
    pub expertise_fields: Vec<Vec<u8>>,
    /// AI训练权重
    pub ai_weight: u8,
}

/// 批量导出响应
#[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo)]
pub struct BatchExportResponse {
    /// 作品列表
    pub works: Vec<ExportedWork>,
    /// 总数量
    pub total_count: u32,
    /// 当前批次偏移
    pub offset: u32,
    /// 是否还有更多数据
    pub has_more: bool,
    /// 数据集哈希（用于验证）
    pub dataset_hash: [u8; 32],
}
```

---

## 🔧 核心功能实现

### 功能1: AI服务注册与管理

```rust
/// 注册AI服务提供商
#[pallet::call_index(0)]
#[pallet::weight(Weight::from_parts(10_000, 0))]
pub fn register_ai_provider(
    origin: OriginFor<T>,
    name: Vec<u8>,
    description: Vec<u8>,
    api_endpoint: Vec<u8>,
    monthly_quota: u32,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 验证参数
    let name_bounded: BoundedVec<u8, ConstU32<100>> = name
        .try_into()
        .map_err(|_| Error::<T>::NameTooLong)?;

    // ... 其他验证和存储逻辑

    Ok(())
}

/// 更新配额
#[pallet::call_index(1)]
pub fn update_quota(
    origin: OriginFor<T>,
    provider: T::AccountId,
    new_quota: u32,
) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;
    // ... 更新逻辑
    Ok(())
}

/// 验证服务提供商
#[pallet::call_index(2)]
pub fn verify_provider(
    origin: OriginFor<T>,
    provider: T::AccountId,
) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;
    // ... 验证逻辑
    Ok(())
}
```

### 功能2: 数据查询与导出

```rust
/// 按条件查询可用于AI训练的作品
#[pallet::call_index(10)]
pub fn query_training_data(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    work_type_filter: Option<WorkType>,
    offset: u32,
    limit: u32,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 检查权限
    Self::ensure_ai_provider(&who)?;

    // 检查配额
    Self::check_and_consume_quota(&who, limit)?;

    // 查询数据（从 pallet-deceased 读取）
    let works = Self::do_query_works(deceased_id, work_type_filter, offset, limit)?;

    // 记录访问日志
    Self::log_data_access(&who, deceased_id, works.len() as u32);

    Ok(())
}

/// 批量导出训练数据
#[pallet::call_index(11)]
pub fn export_training_dataset(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 权限和配额检查
    Self::ensure_ai_provider(&who)?;

    // 导出所有授权的作品
    let works = Self::do_export_all_works(deceased_id)?;

    // 计算数据集哈希
    let dataset_hash = Self::calculate_dataset_hash(&works);

    // 发出事件
    Self::deposit_event(Event::DatasetExported {
        provider: who,
        deceased_id,
        work_count: works.len() as u32,
        dataset_hash,
    });

    Ok(())
}
```

### 功能3: 训练任务管理

```rust
/// 创建训练任务
#[pallet::call_index(20)]
pub fn create_training_task(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    work_ids: Vec<u64>,
    dataset_hash: [u8; 32],
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 权限检查
    Self::ensure_ai_provider(&who)?;

    // 验证作品ID列表
    ensure!(work_ids.len() <= 1000, Error::<T>::TooManyWorksInTask);

    // 验证所有作品都已授权AI训练
    for work_id in &work_ids {
        Self::ensure_work_ai_authorized(deceased_id, *work_id)?;
    }

    // 创建任务
    let task_id = Self::do_create_task(who.clone(), deceased_id, work_ids, dataset_hash)?;

    // 发出事件
    Self::deposit_event(Event::TrainingTaskCreated {
        task_id,
        deceased_id,
        provider: who,
    });

    Ok(())
}

/// 更新训练任务状态
#[pallet::call_index(21)]
pub fn update_task_status(
    origin: OriginFor<T>,
    task_id: u64,
    new_status: TrainingStatus,
    result_cid: Option<Vec<u8>>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 只有任务创建者可以更新
    let task = TrainingTasks::<T>::get(task_id)
        .ok_or(Error::<T>::TaskNotFound)?;
    ensure!(task.provider == who, Error::<T>::NotTaskOwner);

    // 更新状态
    Self::do_update_task_status(task_id, new_status, result_cid)?;

    Ok(())
}
```

### 功能4: AI智能体注册

```rust
/// 注册训练完成的AI智能体
#[pallet::call_index(30)]
pub fn register_ai_agent(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    task_id: u64,
    model_cid: Vec<u8>,
    model_type: AIModelType,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 验证训练任务
    let task = TrainingTasks::<T>::get(task_id)
        .ok_or(Error::<T>::TaskNotFound)?;
    ensure!(task.provider == who, Error::<T>::NotTaskOwner);
    ensure!(task.status == TrainingStatus::Completed, Error::<T>::TaskNotCompleted);

    // 创建智能体记录
    let agent_id = Self::do_register_agent(
        deceased_id,
        task_id,
        model_cid,
        model_type,
        who.clone(),
    )?;

    // 发出事件
    Self::deposit_event(Event::AIAgentRegistered {
        agent_id,
        deceased_id,
        provider: who,
        model_type,
    });

    Ok(())
}

/// 更新智能体部署状态
#[pallet::call_index(31)]
pub fn update_agent_status(
    origin: OriginFor<T>,
    agent_id: u64,
    new_status: DeploymentStatus,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 权限检查
    let agent = AIAgents::<T>::get(agent_id)
        .ok_or(Error::<T>::AgentNotFound)?;
    ensure!(agent.provider == who, Error::<T>::NotAgentOwner);

    // 更新状态
    Self::do_update_agent_status(agent_id, new_status)?;

    Ok(())
}
```

---

## 🔐 权限与安全设计

### 1. 权限层级

```
Root (超级管理员)
  ├─ 注册/注销AI服务
  ├─ 修改配额
  └─ 强制取消任务

GovernanceOrigin (治理委员会)
  ├─ 验证AI服务
  ├─ 审核智能体
  └─ 设置全局限制

AIServiceProvider (已注册的AI服务)
  ├─ 查询训练数据（受配额限制）
  ├─ 导出数据集（受配额限制）
  ├─ 创建训练任务
  └─ 注册智能体

DeceasedOwner (逝者所有者)
  ├─ 查看自己逝者的AI使用情况
  ├─ 撤销AI训练授权
  └─ 指定授权的AI服务
```

### 2. 隐私保护机制

- **数据脱敏**: 导出时移除敏感字段（uploader账户等）
- **隐私级别遵守**: 严格遵守作品的 PrivacyLevel 设置
- **访问审计**: 记录所有数据访问日志
- **配额限制**: 防止滥用和过度访问

### 3. 数据完整性

- **哈希校验**: 使用 Blake2-256 计算数据集哈希
- **版本追踪**: 记录数据集的版本信息
- **不可变性**: 训练任务创建后数据集快照不可变

---

## 📡 RPC接口设计

### 1. 数据查询RPC

```rust
#[rpc(name = "deceasedAi_queryTrainingData")]
fn query_training_data(
    deceased_id: u64,
    work_type: Option<String>,
    offset: u32,
    limit: u32,
) -> Result<BatchExportResponse>;

#[rpc(name = "deceasedAi_getWorkDetails")]
fn get_work_details(
    work_id: u64,
) -> Result<ExportedWork>;
```

### 2. 任务管理RPC

```rust
#[rpc(name = "deceasedAi_getTaskStatus")]
fn get_task_status(
    task_id: u64,
) -> Result<TrainingTask>;

#[rpc(name = "deceasedAi_listTasks")]
fn list_tasks(
    provider: AccountId,
    status: Option<TrainingStatus>,
    offset: u32,
    limit: u32,
) -> Result<Vec<TrainingTask>>;
```

### 3. 智能体查询RPC

```rust
#[rpc(name = "deceasedAi_getAgent")]
fn get_agent(
    agent_id: u64,
) -> Result<AIAgent>;

#[rpc(name = "deceasedAi_listAgentsByDeceased")]
fn list_agents_by_deceased(
    deceased_id: u64,
) -> Result<Vec<AIAgent>>;
```

---

## 🧪 测试计划

### 1. 单元测试

- AI服务注册/注销
- 配额管理和消耗
- 数据查询权限控制
- 训练任务生命周期
- 智能体注册和更新

### 2. 集成测试

- pallet-deceased 与 pallet-deceased-ai 数据同步
- RPC接口端到端测试
- 权限系统集成测试

### 3. 压力测试

- 大量作品导出性能
- 并发数据访问
- 配额限制有效性

---

## 📅 实施时间表

### 第1-2周: 基础架构
- [ ] 创建 pallet-deceased-ai 基础结构
- [ ] 定义所有数据结构
- [ ] 配置 Config trait

### 第3-4周: AI服务管理
- [ ] 实现服务注册功能
- [ ] 实现配额管理
- [ ] 实现权限验证

### 第5-6周: 数据导出引擎
- [ ] 实现数据查询接口
- [ ] 实现批量导出功能
- [ ] 实现格式转换逻辑

### 第7-8周: 训练任务与智能体
- [ ] 实现训练任务管理
- [ ] 实现智能体注册
- [ ] 完善状态追踪

### 第9-10周: RPC接口
- [ ] 设计和实现所有RPC端点
- [ ] 测试RPC接口
- [ ] 优化性能

### 第11-12周: 测试与文档
- [ ] 编写完整单元测试
- [ ] 集成测试
- [ ] 编写API文档
- [ ] 编写使用指南

---

## 📚 依赖关系

### Pallet依赖

```toml
[dependencies]
# Deceased pallet (读取作品数据)
pallet-deceased = { path = "../deceased", default-features = false }

# FRAME dependencies
frame-support = { version = "4.0.0-dev", default-features = false }
frame-system = { version = "4.0.0-dev", default-features = false }
frame-benchmarking = { version = "4.0.0-dev", default-features = false, optional = true }

# Substrate primitives
sp-std = { version = "8.0.0", default-features = false }
sp-runtime = { version = "24.0.0", default-features = false }
sp-core = { version = "21.0.0", default-features = false }
sp-io = { version = "23.0.0", default-features = false }

# SCALE codec
codec = { package = "parity-scale-codec", version = "3.6.1", default-features = false, features = ["derive"] }
scale-info = { version = "2.5.0", default-features = false, features = ["derive"] }
```

### Runtime配置

```rust
impl pallet_deceased_ai::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type DeceasedId = u64;
    type GovernanceOrigin = EnsureRootOrHalfCouncil;
    type WeightInfo = ();

    // 依赖 pallet-deceased 提供数据
    type DeceasedProvider = Deceased;

    // 配额限制
    type DefaultMonthlyQuota = ConstU32<10000>;
    type MaxProvidersPerDeceased = ConstU32<10>;
}
```

---

## 🎯 验收标准

### 功能完整性
- ✅ 所有10个核心extrinsics实现并测试通过
- ✅ RPC接口完整可用
- ✅ 权限系统正常工作
- ✅ 配额限制有效

### 性能指标
- ✅ 单次导出1000个作品 < 5秒
- ✅ 查询响应时间 < 500ms
- ✅ 并发10个AI服务无性能问题

### 文档完整性
- ✅ API文档覆盖所有接口
- ✅ 使用示例清晰完整
- ✅ 架构设计文档完善

---

## 🔄 与Phase 3的衔接

Phase 2完成后，将为Phase 3（智能体实现）提供：

1. **标准化数据接口** - AI训练系统可直接调用RPC获取数据
2. **训练任务追踪** - 完整的任务生命周期管理
3. **智能体注册机制** - 训练完成的模型可注册到链上
4. **权限和配额控制** - 保护数据安全和系统稳定

Phase 3将在此基础上：
- 实现实际的AI训练流程（链下）
- 开发智能体交互接口
- 实现智能体市场和交易

---

**下一步**: 开始创建 `pallet-deceased-ai` 基础结构
