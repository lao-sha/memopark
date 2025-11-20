# pallet-stardust-ipfs 优化改造完整方案

> 基于前期分析，整合：域索引、分层配置、自动化巡检扣费、运营者激励

---

## 一、改造目标总览

### 1.1 核心优化点

```
✅ Pin查找效率：     全局扫描 → 域索引（O(n) → O(1)）
✅ 周期扣费自动化：  手动治理调用 → on_finalize自动扣费
✅ 巡检灵活性：      固定周期 → 分层巡检（关键/普通/临时）
✅ 副本配置：        固定5副本 → 分层副本（5/3/1副本）
✅ 费用模型：        三层扣费 → 四层回退 + 宽限期
✅ 运营者激励：      手动分配 → 自动分配 + 保证金保护
```

### 1.2 改造策略

```
阶段1：存储结构改造（Breaking Changes）
  - 新增域索引存储
  - 新增分层配置存储
  - 新增健康巡检存储

阶段2：自动化机制（功能增强）
  - on_finalize 自动扣费
  - on_finalize 自动巡检
  - 运营者自动奖励分配

阶段3：治理接口（可选）
  - 动态调整费率
  - 动态调整巡检周期
  - 动态调整副本策略
```

---

## 二、新增存储结构设计

### 2.1 域索引存储（Pin查找优化）

```rust
/// 函数级详细中文注释：域维度Pin索引，O(1)查找某域下的所有CID
/// 
/// 设计目标：
/// - 替代全局扫描 PendingPins::iter()
/// - 支持域级别的优先级调度
/// - 便于域级别的批量操作（如暂停某域的扣费）
/// 
/// 存储结构：
/// - Key: (domain: Vec<u8>, cid_hash: Hash)
/// - Value: ()（标记存在即可）
/// 
/// 使用场景：
/// - OCW巡检时，按域顺序扫描：Deceased → Grave → Offerings → Media...
/// - 统计各域的Pin数量和存储容量
/// - 实现域级别的优先级队列
#[pallet::storage]
#[pallet::getter(fn domain_pins)]
pub type DomainPins<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    BoundedVec<u8, ConstU32<32>>,  // domain (如 b"deceased", b"grave")
    Blake2_128Concat,
    T::Hash,                        // cid_hash
    (),                             // 标记存在
    OptionQuery,
>;

/// 函数级详细中文注释：CID到Subject的反向映射，用于扣费时查找资金账户
/// 
/// 设计目标：
/// - 周期扣费时，根据 cid_hash 查找对应的 SubjectFunding 账户
/// - 支持一个CID属于多个Subject的场景（如共享媒体文件）
/// 
/// 存储结构：
/// - Key: cid_hash
/// - Value: BoundedVec<SubjectInfo>（主Subject + 可选共享Subject列表）
/// 
/// SubjectInfo 包含：
/// - subject_type: SubjectType (Deceased/Grave/Offerings/...)
/// - subject_id: u64
/// - funding_share: Percent（该Subject承担的费用比例，默认100%）
#[pallet::storage]
#[pallet::getter(fn cid_to_subject)]
pub type CidToSubject<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::Hash,                                    // cid_hash
    BoundedVec<SubjectInfo, ConstU32<8>>,      // 最多8个Subject共享
    OptionQuery,
>;

/// Subject信息结构体
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct SubjectInfo {
    /// Subject类型
    pub subject_type: SubjectType,
    /// Subject ID（如 deceased_id, grave_id）
    pub subject_id: u64,
    /// 费用分摊比例（0-100，默认100表示独占）
    pub funding_share: u8,
}

/// Subject类型枚举
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum SubjectType {
    Deceased,
    Grave,
    Offerings,
    OtcOrder,
    Evidence,
    // 预留扩展
    Custom(BoundedVec<u8, ConstU32<32>>),
}
```

### 2.2 分层配置存储（副本+巡检策略）

```rust
/// 函数级详细中文注释：分层Pin策略配置
/// 
/// 设计目标：
/// - 根据内容重要性，配置不同的副本数和巡检周期
/// - 平衡存储成本和可靠性
/// - 支持运行时动态调整（治理提案）
/// 
/// 分层等级：
/// - Critical（关键）：逝者核心档案、证据类数据
/// - Standard（标准）：墓位封面、供奉品图片
/// - Temporary（临时）：OTC订单聊天记录、临时媒体
#[pallet::storage]
#[pallet::getter(fn pin_tier_config)]
pub type PinTierConfig<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    PinTier,
    TierConfig,
    ValueQuery,
>;

/// Pin分层等级
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum PinTier {
    /// 关键级：5副本，6小时巡检
    Critical,
    /// 标准级：3副本，24小时巡检（默认）
    Standard,
    /// 临时级：1副本，7天巡检
    Temporary,
}

/// 分层配置参数
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct TierConfig {
    /// 副本数
    pub replicas: u32,
    /// 巡检周期（区块数）
    pub health_check_interval: u32,
    /// 存储费率系数（相对于基准费率的倍数，基数10000）
    /// 例如：10000=1.0x, 15000=1.5x, 5000=0.5x
    pub fee_multiplier: u16,
    /// 宽限期（区块数）
    pub grace_period_blocks: u32,
    /// 是否启用
    pub enabled: bool,
}

/// 默认分层配置
impl Default for TierConfig {
    fn default() -> Self {
        Self {
            replicas: 3,
            health_check_interval: 7200,  // 24小时（假设3秒/块）
            fee_multiplier: 10000,        // 1.0x
            grace_period_blocks: 201600,  // 7天
            enabled: true,
        }
    }
}

/// 函数级详细中文注释：CID分层映射，记录每个CID的优先级等级
/// 
/// 存储结构：
/// - Key: cid_hash
/// - Value: PinTier
/// 
/// 默认规则：
/// - 未显式设置：Standard（标准级）
/// - 业务pallet调用时指定（如 pin_cid_for_deceased 传递 tier 参数）
#[pallet::storage]
#[pallet::getter(fn cid_tier)]
pub type CidTier<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    T::Hash,
    PinTier,
    ValueQuery,
    GetDefault,  // 默认返回 Standard
>;
```

### 2.3 健康巡检存储（自动化维护）

```rust
/// 函数级详细中文注释：健康巡检队列，按优先级和到期时间排序
/// 
/// 设计目标：
/// - 替代全局扫描，提供高效的巡检调度
/// - 支持优先级队列（Critical优先）
/// - 自动去重和过期清理
/// 
/// 存储结构：
/// - Key: (next_check_block, cid_hash)
/// - Value: HealthCheckTask
/// 
/// 调度逻辑：
/// - on_finalize 时，扫描 next_check_block <= current_block 的任务
/// - 执行巡检后，重新插入队列（next_check_block + interval）
#[pallet::storage]
#[pallet::getter(fn health_check_queue)]
pub type HealthCheckQueue<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    BlockNumberFor<T>,  // next_check_block
    Blake2_128Concat,
    T::Hash,            // cid_hash
    HealthCheckTask<BlockNumberFor<T>>,
    OptionQuery,
>;

/// 健康巡检任务
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct HealthCheckTask<BlockNumber> {
    /// CID分层等级
    pub tier: PinTier,
    /// 上次巡检时间
    pub last_check: BlockNumber,
    /// 上次巡检结果
    pub last_status: HealthStatus,
    /// 连续失败次数
    pub consecutive_failures: u8,
}

/// 健康状态
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum HealthStatus {
    /// 健康：副本数 >= 目标副本数
    Healthy { current_replicas: u32 },
    /// 降级：副本数 < 目标副本数，但 >= 最低阈值（2）
    Degraded { current_replicas: u32, target: u32 },
    /// 危险：副本数 < 2
    Critical { current_replicas: u32 },
    /// 未知：巡检失败（网络错误等）
    Unknown,
}

/// 函数级详细中文注释：巡检统计数据，用于链上仪表板展示
/// 
/// 存储内容：
/// - 总Pin数、总存储量
/// - 健康/降级/危险CID数量
/// - 上次巡检时间
/// - 累计修复次数
#[pallet::storage]
#[pallet::getter(fn health_check_stats)]
pub type HealthCheckStats<T: Config> = StorageValue<
    _,
    GlobalHealthStats<BlockNumberFor<T>>,
    ValueQuery,
>;

#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct GlobalHealthStats<BlockNumber> {
    pub total_pins: u64,
    pub total_size_bytes: u64,
    pub healthy_count: u64,
    pub degraded_count: u64,
    pub critical_count: u64,
    pub last_full_scan: BlockNumber,
    pub total_repairs: u64,
}
```

### 2.4 周期扣费队列（自动化扣费）

```rust
/// 函数级详细中文注释：周期扣费队列，替代手动 charge_due 调用
/// 
/// 设计目标：
/// - on_finalize 自动扫描到期的扣费任务
/// - 支持四层回退充电机制
/// - 自动进入宽限期/Unpin流程
/// 
/// 存储结构：
/// - Key: (due_block, cid_hash)
/// - Value: BillingTask
/// 
/// 调度逻辑：
/// - on_finalize 时，批量处理 due_block <= current_block 的任务
/// - 扣费成功：更新 due_block += billing_period
/// - 扣费失败：进入宽限期或标记Unpin
#[pallet::storage]
#[pallet::getter(fn billing_queue)]
pub type BillingQueue<T: Config> = StorageDoubleMap<
    _,
    Blake2_128Concat,
    BlockNumberFor<T>,  // due_block
    Blake2_128Concat,
    T::Hash,            // cid_hash
    BillingTask<BlockNumberFor<T>, BalanceOf<T>>,
    OptionQuery,
>;

/// 扣费任务
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct BillingTask<BlockNumber, Balance> {
    /// 扣费周期（块数）
    pub billing_period: u32,
    /// 每周期费用
    pub amount_per_period: Balance,
    /// 上次扣费时间
    pub last_charge: BlockNumber,
    /// 宽限期状态
    pub grace_status: GraceStatus<BlockNumber>,
    /// 扣费层级（记录当前使用哪层资金）
    pub charge_layer: ChargeLayer,
}

/// 宽限期状态
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum GraceStatus<BlockNumber> {
    /// 正常状态
    Normal,
    /// 宽限期中（记录进入时间和截止时间）
    InGrace { entered_at: BlockNumber, expires_at: BlockNumber },
    /// 宽限期已过期，待Unpin
    Expired,
}

/// 充电层级（四层回退）
#[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub enum ChargeLayer {
    /// 第1层：SubjectFunding账户（用户充值）
    SubjectFunding,
    /// 第2层：IpfsPoolAccount公共池（系统缓冲）
    IpfsPool,
    /// 第3层：OperatorEscrowAccount运营者保证金（运营者垫付）
    OperatorEscrow,
    /// 第4层：宽限期（不扣费，等待充值）
    GracePeriod,
}
```

---

## 三、核心逻辑改造

### 3.1 Pin请求流程（request_pin_for_deceased）

```rust
/// 函数级详细中文注释：逝者维度Pin请求（优化版）
/// 
/// 改进点：
/// 1. 支持分层策略选择（tier参数）
/// 2. 自动注册到域索引（DomainPins）
/// 3. 自动注册到巡检队列（HealthCheckQueue）
/// 4. 自动注册到扣费队列（BillingQueue）
#[pallet::call_index(0)]
#[pallet::weight(Weight::from_parts(200_000, 0))]
pub fn request_pin_for_deceased(
    origin: OriginFor<T>,
    deceased_id: u64,
    cid: Vec<u8>,
    tier: Option<PinTier>,  // 新增：分层策略，None则使用默认Standard
) -> DispatchResult {
    let caller = ensure_signed(origin)?;
    
    // 1. 验证逝者存在性和权限
    let owner = T::OwnerProvider::owner_of(deceased_id)
        .ok_or(Error::<T>::DeceasedNotFound)?;
    ensure!(caller == owner, Error::<T>::NotOwner);
    
    let creator = T::CreatorProvider::creator_of(deceased_id)
        .ok_or(Error::<T>::DeceasedNotFound)?;
    
    // 2. 计算CID哈希
    let cid_hash = T::Hashing::hash(&cid);
    
    // 3. 防重复Pin
    ensure!(!PinMeta::<T>::contains_key(&cid_hash), Error::<T>::AlreadyPinned);
    
    // 4. 获取分层配置
    let tier = tier.unwrap_or(PinTier::Standard);
    let tier_config = Self::get_tier_config(&tier)?;
    
    // 5. 计算费用（根据tier的fee_multiplier调整）
    let base_fee = Self::calculate_pin_fee(&cid, tier_config.replicas)?;
    let adjusted_fee = base_fee * tier_config.fee_multiplier as u128 / 10000;
    
    // 6. 执行Triple-Charge扣费（初始Pin）
    Self::triple_charge(
        &caller,
        deceased_id,
        SubjectType::Deceased,
        adjusted_fee,
    )?;
    
    // 7. 注册到域索引
    let domain = BoundedVec::try_from(b"deceased".to_vec())
        .map_err(|_| Error::<T>::DomainTooLong)?;
    DomainPins::<T>::insert(&domain, &cid_hash, ());
    
    // 8. 注册CID→Subject映射
    let subject_info = SubjectInfo {
        subject_type: SubjectType::Deceased,
        subject_id: deceased_id,
        funding_share: 100,  // 独占100%费用
    };
    CidToSubject::<T>::insert(
        &cid_hash,
        BoundedVec::try_from(vec![subject_info]).unwrap(),
    );
    
    // 9. 记录分层等级
    CidTier::<T>::insert(&cid_hash, tier.clone());
    
    // 10. 注册到健康巡检队列
    let current_block = <frame_system::Pallet<T>>::block_number();
    let next_check = current_block + tier_config.health_check_interval.into();
    let check_task = HealthCheckTask {
        tier: tier.clone(),
        last_check: current_block,
        last_status: HealthStatus::Unknown,  // 初始状态未知
        consecutive_failures: 0,
    };
    HealthCheckQueue::<T>::insert(next_check, &cid_hash, check_task);
    
    // 11. 注册到周期扣费队列
    let period_fee = Self::calculate_period_fee(&cid, tier_config.replicas)?;
    let billing_period = T::DefaultBillingPeriod::get();  // 如30天
    let next_billing = current_block + billing_period.into();
    let billing_task = BillingTask {
        billing_period,
        amount_per_period: period_fee,
        last_charge: current_block,
        grace_status: GraceStatus::Normal,
        charge_layer: ChargeLayer::SubjectFunding,
    };
    BillingQueue::<T>::insert(next_billing, &cid_hash, billing_task);
    
    // 12. 存储Pin元信息
    let meta = PinMetadata {
        replicas: tier_config.replicas,
        size: Self::estimate_cid_size(&cid)?,
        created_at: current_block,
        last_activity: current_block,
    };
    PinMeta::<T>::insert(&cid_hash, meta);
    
    // 13. 标记为待Pin（OCW处理）
    PinStateOf::<T>::insert(&cid_hash, 0);  // 0=Pending
    
    // 14. 发送事件
    Self::deposit_event(Event::PinRequested {
        cid_hash,
        deceased_id,
        tier,
        replicas: tier_config.replicas,
        caller,
    });
    
    Ok(())
}
```

### 3.2 OCW健康巡检（on_finalize集成）

```rust
/// 函数级详细中文注释：区块结束时的自动化任务
/// 
/// 执行顺序（优先级从高到低）：
/// 1. 健康巡检（确保数据安全）
/// 2. 周期扣费（确保资金流转）
/// 3. 统计更新（链上仪表板）
#[pallet::hooks]
impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
    fn on_finalize(n: BlockNumberFor<T>) {
        let current_block = n;
        
        // ======== 任务1：健康巡检 ========
        // 限流：每块最多处理10个巡检任务
        let max_checks_per_block = T::MaxHealthChecksPerBlock::get();
        let mut processed = 0u32;
        
        // 遍历到期的巡检任务（next_check_block <= current_block）
        for (check_block, cid_hash, task) in 
            HealthCheckQueue::<T>::iter_prefix(current_block)
                .take(max_checks_per_block as usize)
        {
            // 执行巡检（通过OCW调用IPFS Cluster status API）
            if let Ok(status) = Self::check_pin_health(&cid_hash) {
                // 更新健康状态
                Self::update_health_status(&cid_hash, &status);
                
                // 判断是否需要修复
                let tier_config = Self::get_tier_config(&task.tier)
                    .unwrap_or_default();
                
                match status {
                    HealthStatus::Healthy { .. } => {
                        // 健康：重新入队，下次巡检时间 = now + interval
                        let next_check = current_block + 
                            tier_config.health_check_interval.into();
                        let mut new_task = task.clone();
                        new_task.last_check = current_block;
                        new_task.last_status = status;
                        new_task.consecutive_failures = 0;
                        HealthCheckQueue::<T>::insert(next_check, &cid_hash, new_task);
                    },
                    HealthStatus::Degraded { current_replicas, target } => {
                        // 降级：触发自动修复
                        Self::trigger_auto_repair(&cid_hash, current_replicas, target);
                        
                        // 缩短巡检间隔（降级期间更频繁检查）
                        let urgent_interval = tier_config.health_check_interval / 4;
                        let next_check = current_block + urgent_interval.into();
                        let mut new_task = task.clone();
                        new_task.last_check = current_block;
                        new_task.last_status = status;
                        new_task.consecutive_failures += 1;
                        HealthCheckQueue::<T>::insert(next_check, &cid_hash, new_task);
                        
                        // 发送告警事件
                        Self::deposit_event(Event::HealthDegraded {
                            cid_hash: cid_hash.clone(),
                            current_replicas,
                            target,
                        });
                    },
                    HealthStatus::Critical { current_replicas } => {
                        // 危险：立即触发紧急修复
                        Self::trigger_emergency_repair(&cid_hash, current_replicas);
                        
                        // 极短巡检间隔（每小时检查一次）
                        let critical_interval = 1200;  // ~1小时
                        let next_check = current_block + critical_interval.into();
                        let mut new_task = task.clone();
                        new_task.last_check = current_block;
                        new_task.last_status = status;
                        new_task.consecutive_failures += 1;
                        HealthCheckQueue::<T>::insert(next_check, &cid_hash, new_task);
                        
                        // 发送紧急告警
                        Self::deposit_event(Event::HealthCritical {
                            cid_hash: cid_hash.clone(),
                            current_replicas,
                        });
                    },
                    HealthStatus::Unknown => {
                        // 未知：可能是网络问题，稍后重试
                        let retry_interval = 600;  // ~30分钟后重试
                        let next_check = current_block + retry_interval.into();
                        let mut new_task = task.clone();
                        new_task.last_check = current_block;
                        new_task.last_status = status;
                        new_task.consecutive_failures += 1;
                        
                        // 连续失败5次，发送告警
                        if new_task.consecutive_failures >= 5 {
                            Self::deposit_event(Event::HealthCheckFailed {
                                cid_hash: cid_hash.clone(),
                                failures: new_task.consecutive_failures,
                            });
                        }
                        
                        HealthCheckQueue::<T>::insert(next_check, &cid_hash, new_task);
                    },
                }
                
                processed += 1;
            }
            
            // 移除旧的队列项
            HealthCheckQueue::<T>::remove(check_block, &cid_hash);
        }
        
        // ======== 任务2：周期扣费 ========
        let max_charges_per_block = T::MaxChargesPerBlock::get();
        let mut charged = 0u32;
        
        for (due_block, cid_hash, mut task) in 
            BillingQueue::<T>::iter_prefix(current_block)
                .take(max_charges_per_block as usize)
        {
            // 执行四层回退扣费
            match Self::four_layer_charge(&cid_hash, &mut task) {
                Ok(ChargeResult::Success { layer }) => {
                    // 扣费成功：更新下次扣费时间
                    let next_billing = current_block + task.billing_period.into();
                    task.last_charge = current_block;
                    task.charge_layer = layer;
                    task.grace_status = GraceStatus::Normal;
                    BillingQueue::<T>::insert(next_billing, &cid_hash, task);
                    
                    charged += 1;
                },
                Ok(ChargeResult::EnterGrace { expires_at }) => {
                    // 进入宽限期：发送通知
                    task.grace_status = GraceStatus::InGrace {
                        entered_at: current_block,
                        expires_at,
                    };
                    let next_billing = current_block + 1200.into();  // 1小时后再试
                    BillingQueue::<T>::insert(next_billing, &cid_hash, task);
                    
                    Self::deposit_event(Event::GracePeriodStarted {
                        cid_hash: cid_hash.clone(),
                        expires_at,
                    });
                },
                Err(_) => {
                    // 宽限期已过，标记Unpin
                    task.grace_status = GraceStatus::Expired;
                    Self::mark_for_unpin(&cid_hash);
                    
                    Self::deposit_event(Event::MarkedForUnpin {
                        cid_hash: cid_hash.clone(),
                        reason: UnpinReason::InsufficientFunds,
                    });
                },
            }
            
            // 移除旧的队列项
            BillingQueue::<T>::remove(due_block, &cid_hash);
        }
        
        // ======== 任务3：统计更新 ========
        if current_block % 7200u32.into() == 0u32.into() {  // 每24小时更新一次
            Self::update_global_health_stats();
        }
    }
}
```

### 3.3 四层回退充电机制（调整后）

```rust
/// 函数级详细中文注释：四层回退充电机制（自动容错）
/// 
/// 充电顺序（调整后）：
/// 1. IpfsPoolAccount（系统公共池）      ← 第一顺序，确保运营者及时获得收益
/// 2. SubjectFunding（用户充值账户）     ← 第二顺序，从用户账户补充公共池
/// 3. OperatorEscrowAccount（运营者保证金）← 第三顺序，极端情况运营者垫付
/// 4. GracePeriod（宽限期，不扣费）      ← 最后宽限期，等待充值
/// 
/// 设计理念：
/// - 优先从公共池扣费，避免用户账户不足导致运营者收益延迟
/// - 公共池由供奉路由持续补充（2% × 50%）
/// - 用户账户作为第二层备份，确保公共池不被耗尽
/// - 运营者保证金作为最后防线，保护运营者利益
/// 
/// 返回：
/// - Ok(ChargeResult::Success)：扣费成功
/// - Ok(ChargeResult::EnterGrace)：进入宽限期
/// - Err(Error::GraceExpired)：宽限期已过
fn four_layer_charge(
    cid_hash: &T::Hash,
    task: &mut BillingTask<BlockNumberFor<T>, BalanceOf<T>>,
) -> Result<ChargeResult<BlockNumberFor<T>>, Error<T>> {
    let amount = task.amount_per_period;
    
    // 获取Subject信息
    let subjects = CidToSubject::<T>::get(cid_hash)
        .ok_or(Error::<T>::SubjectNotFound)?;
    
    // ===== 第1层：IpfsPoolAccount（系统公共池）=====
    let pool_account = Self::ipfs_pool_account();
    if T::Currency::free_balance(&pool_account) >= amount {
        // 从公共池扣费
        let _ = T::Currency::withdraw(
            &pool_account,
            amount,
            frame_support::traits::WithdrawReasons::TRANSFER,
            ExistenceRequirement::KeepAlive,
        )?;
        
        // 分配给运营者
        Self::distribute_to_operators(cid_hash, amount)?;
        
        TotalChargedFromPool::<T>::mutate(|total| *total += amount);
        
        // 成功从公共池扣费，标记为正常状态
        return Ok(ChargeResult::Success {
            layer: ChargeLayer::IpfsPool,
        });
    }
    
    // ===== 第2层：SubjectFunding（用户充值账户）=====
    // 公共池不足时，尝试从用户账户补充公共池
    for subject_info in subjects.iter() {
        let funding_account = Self::derive_subject_funding_account(
            subject_info.subject_type,
            subject_info.subject_id,
        );
        
        // 计算该Subject应承担的费用
        let share_amount = amount * subject_info.funding_share as u128 / 100;
        
        if T::Currency::free_balance(&funding_account) >= share_amount {
            // 从用户账户转入公共池
            T::Currency::transfer(
                &funding_account,
                &pool_account,
                share_amount,
                ExistenceRequirement::KeepAlive,
            )?;
            
            // 分配给运营者
            Self::distribute_to_operators(cid_hash, share_amount)?;
            
            TotalChargedFromSubject::<T>::mutate(|total| *total += share_amount);
            
            // 发出警告：公共池已不足，需要及时补充
            Self::deposit_event(Event::IpfsPoolLowBalance {
                current: T::Currency::free_balance(&pool_account),
            });
            
            return Ok(ChargeResult::Success {
                layer: ChargeLayer::SubjectFunding,
            });
        }
    }
    
    // ===== 第3层：OperatorEscrowAccount =====
    // 从存储该CID的运营者保证金中平摊扣除
    let operators = Self::get_pin_operators(cid_hash)?;
    let per_operator = amount / operators.len() as u128;
    
    let mut escrow_success = true;
    for operator in operators.iter() {
        let escrow_account = Self::operator_escrow_account(operator);
        if T::Currency::free_balance(&escrow_account) < per_operator {
            escrow_success = false;
            break;
        }
    }
    
    if escrow_success {
        // 从运营者保证金扣费
        for operator in operators.iter() {
            let escrow_account = Self::operator_escrow_account(operator);
            T::Currency::transfer(
                &escrow_account,
                &pool_account,
                per_operator,
                ExistenceRequirement::KeepAlive,
            )?;
        }
        
        // 分配给运营者（实际上是返还给他们，因为他们垫付了）
        Self::distribute_to_operators(cid_hash, amount)?;
        
        // 进入3天短宽限期，催促用户充值
        let current_block = <frame_system::Pallet<T>>::block_number();
        let short_grace = 86400u32;  // 3天
        let expires_at = current_block + short_grace.into();
        
        // 发送紧急通知
        Self::deposit_event(Event::OperatorEscrowUsed {
            cid_hash: *cid_hash,
            amount,
        });
        
        return Ok(ChargeResult::EnterGrace { expires_at });
    }
    
    // ===== 第4层：检查宽限期 =====
    match &task.grace_status {
        GraceStatus::Normal => {
            // 首次失败，进入最后的宽限期
            let current_block = <frame_system::Pallet<T>>::block_number();
            let final_grace = 86400u32;  // 3天最后期限
            let expires_at = current_block + final_grace.into();
            
            Ok(ChargeResult::EnterGrace { expires_at })
        },
        GraceStatus::InGrace { expires_at, .. } => {
            // 检查是否过期
            let current_block = <frame_system::Pallet<T>>::block_number();
            if current_block > *expires_at {
                Err(Error::<T>::GraceExpired)
            } else {
                Ok(ChargeResult::EnterGrace { expires_at: *expires_at })
            }
        },
        GraceStatus::Expired => {
            Err(Error::<T>::GraceExpired)
        },
    }
}

/// 充电结果
enum ChargeResult<BlockNumber> {
    Success { layer: ChargeLayer },
    EnterGrace { expires_at: BlockNumber },
}
```

### 3.4 运营者自动奖励分配

```rust
/// 函数级详细中文注释：自动分配存储费给运营者
/// 
/// 分配逻辑：
/// 1. 查询哪些运营者存储了该CID（IPFS Cluster status API）
/// 2. 平均分配费用给所有运营者
/// 3. 累计到运营者奖励账户（可提现）
/// 
/// 防作弊：
/// - 运营者必须在IPFS Cluster中有该CID的Pin记录
/// - 定期健康巡检验证运营者确实存储了数据
/// - 虚假报告会被申诉系统惩罚
fn distribute_to_operators(
    cid_hash: &T::Hash,
    total_amount: BalanceOf<T>,
) -> DispatchResult {
    // 1. 从PinAssignments获取运营者列表（链上记录）
    let operators = PinAssignments::<T>::get(cid_hash)
        .ok_or(Error::<T>::NoOperatorsAssigned)?;
    
    // 2. 计算每个运营者的奖励
    let per_operator = total_amount / operators.len() as u128;
    
    // 3. 累计到运营者奖励账户
    for operator in operators.iter() {
        OperatorRewards::<T>::mutate(operator, |balance| {
            *balance = balance.saturating_add(per_operator);
        });
        
        Self::deposit_event(Event::OperatorRewarded {
            operator: operator.clone(),
            cid_hash: *cid_hash,
            amount: per_operator,
        });
    }
    
    Ok(())
}

/// 函数级详细中文注释：运营者提取奖励
/// 
/// 流程：
/// 1. 检查奖励余额
/// 2. 从IpfsPoolAccount转账到运营者账户
/// 3. 更新奖励记录
#[pallet::call_index(20)]
#[pallet::weight(Weight::from_parts(100_000, 0))]
pub fn operator_claim_rewards(origin: OriginFor<T>) -> DispatchResult {
    let operator = ensure_signed(origin)?;
    
    // 1. 获取奖励余额
    let reward = OperatorRewards::<T>::get(&operator);
    ensure!(reward > Zero::zero(), Error::<T>::NoRewardsAvailable);
    
    // 2. 转账
    let pool_account = Self::ipfs_pool_account();
    T::Currency::transfer(
        &pool_account,
        &operator,
        reward,
        ExistenceRequirement::KeepAlive,
    )?;
    
    // 3. 清零奖励
    OperatorRewards::<T>::remove(&operator);
    
    // 4. 发送事件
    Self::deposit_event(Event::RewardsClaimed {
        operator,
        amount: reward,
    });
    
    Ok(())
}
```

---

## 四、治理接口设计

### 4.1 动态调整分层配置

```rust
/// 函数级详细中文注释：治理提案调整分层配置
/// 
/// 使用场景：
/// - 网络负载调整：降低巡检频率以减轻节点压力
/// - 经济模型调整：修改费率系数以平衡用户成本和运营者收益
/// - 应急响应：临时提高关键数据的副本数
#[pallet::call_index(30)]
#[pallet::weight(Weight::from_parts(50_000, 0))]
pub fn update_tier_config(
    origin: OriginFor<T>,
    tier: PinTier,
    config: TierConfig,
) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;
    
    // 验证配置合理性
    ensure!(config.replicas > 0 && config.replicas <= 10, Error::<T>::InvalidReplicas);
    ensure!(
        config.health_check_interval >= 600,  // 至少30分钟
        Error::<T>::IntervalTooShort
    );
    ensure!(
        config.fee_multiplier >= 1000 && config.fee_multiplier <= 100000,  // 0.1x ~ 10x
        Error::<T>::InvalidMultiplier
    );
    
    // 更新配置
    PinTierConfig::<T>::insert(&tier, config.clone());
    
    Self::deposit_event(Event::TierConfigUpdated { tier, config });
    
    Ok(())
}
```

### 4.2 紧急暂停/恢复

```rust
/// 函数级详细中文注释：紧急暂停自动扣费（应急开关）
/// 
/// 使用场景：
/// - 发现扣费逻辑漏洞，需要暂停保护用户资金
/// - IPFS集群故障，暂停扣费直到恢复
/// - 链上治理投票期间，暂停重大变更
#[pallet::call_index(31)]
#[pallet::weight(Weight::from_parts(30_000, 0))]
pub fn emergency_pause_billing(origin: OriginFor<T>) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;
    
    BillingPaused::<T>::put(true);
    
    Self::deposit_event(Event::BillingPaused { by: Self::governance_account() });
    
    Ok(())
}

/// 恢复自动扣费
#[pallet::call_index(32)]
#[pallet::weight(Weight::from_parts(30_000, 0))]
pub fn resume_billing(origin: OriginFor<T>) -> DispatchResult {
    T::GovernanceOrigin::ensure_origin(origin)?;
    
    BillingPaused::<T>::put(false);
    
    Self::deposit_event(Event::BillingResumed { by: Self::governance_account() });
    
    Ok(())
}
```

---

## 五、实施计划

### 5.1 阶段划分

```
阶段1：存储结构改造（Week 1）
  ✅ Day 1-2：新增存储项定义
  ✅ Day 3-4：迁移逻辑适配（Migrations）
  ✅ Day 5：单元测试

阶段2：Pin请求流程改造（Week 2）
  ✅ Day 1-2：request_pin_for_deceased 改造
  ✅ Day 3：request_pin_for_grave 改造
  ✅ Day 4：其他Pin接口改造
  ✅ Day 5：集成测试

阶段3：自动化机制开发（Week 3）
  ✅ Day 1-2：on_finalize 健康巡检
  ✅ Day 3-4：on_finalize 周期扣费
  ✅ Day 5：压力测试

阶段4：治理接口开发（Week 4）
  ✅ Day 1-2：分层配置治理
  ✅ Day 3-4：紧急暂停/恢复
  ✅ Day 5：前端Dashboard集成

阶段5：主网准备（Week 5）
  ✅ Day 1-2：审计和安全检查
  ✅ Day 3-4：文档完善
  ✅ Day 5：社区测试
```

### 5.2 迁移策略（Breaking Changes处理）

```rust
/// 函数级详细中文注释：V0→V1迁移
/// 
/// 迁移内容：
/// 1. PendingPins → DomainPins + CidToSubject
/// 2. 为所有现有Pin分配默认tier（Standard）
/// 3. 初始化健康巡检队列
/// 4. 初始化周期扣费队列
pub mod migrations {
    use super::*;
    
    pub fn migrate_to_v1<T: Config>() -> Weight {
        let mut weight = Weight::zero();
        
        // 1. 遍历现有的PinMeta
        for (cid_hash, meta) in PinMeta::<T>::iter() {
            // 根据CID内容推断domain（简化处理，实际可能需要链外数据）
            let domain = Self::infer_domain_from_cid(&cid_hash);
            
            // 插入DomainPins
            if let Ok(domain_vec) = BoundedVec::try_from(domain.as_bytes().to_vec()) {
                DomainPins::<T>::insert(&domain_vec, &cid_hash, ());
            }
            
            // 分配默认tier
            CidTier::<T>::insert(&cid_hash, PinTier::Standard);
            
            // 注册健康巡检（从下一个块开始）
            let current_block = <frame_system::Pallet<T>>::block_number();
            let check_task = HealthCheckTask {
                tier: PinTier::Standard,
                last_check: current_block,
                last_status: HealthStatus::Unknown,
                consecutive_failures: 0,
            };
            HealthCheckQueue::<T>::insert(
                current_block + 1u32.into(),
                &cid_hash,
                check_task,
            );
            
            // 注册周期扣费（7天后首次扣费）
            let billing_task = BillingTask {
                billing_period: 201600,  // 7天
                amount_per_period: Self::calculate_period_fee_from_meta(&meta),
                last_charge: current_block,
                grace_status: GraceStatus::Normal,
                charge_layer: ChargeLayer::SubjectFunding,
            };
            BillingQueue::<T>::insert(
                current_block + 201600u32.into(),
                &cid_hash,
                billing_task,
            );
            
            weight += T::DbWeight::get().reads_writes(1, 4);
        }
        
        weight
    }
}
```

---

## 六、配置建议总结

### 6.1 分层配置推荐值

| 分层等级 | 副本数 | 巡检周期 | 费率系数 | 宽限期 | 适用场景 |
|---------|--------|---------|---------|--------|----------|
| **Critical** | 5 | 6小时 (7200块) | 1.5x | 7天 | 逝者核心档案、证据类数据 |
| **Standard** | 3 | 24小时 (28800块) | 1.0x | 7天 | 墓位封面、供奉品图片 |
| **Temporary** | 1 | 7天 (604800块) | 0.5x | 3天 | OTC聊天记录、临时媒体 |

### 6.2 全局参数推荐

```rust
// runtime/src/configs/ipfs.rs

parameter_types! {
    // 每块最多处理的健康巡检数（防止区块拥堵）
    pub const MaxHealthChecksPerBlock: u32 = 10;
    
    // 每块最多处理的扣费数（防止区块拥堵）
    pub const MaxChargesPerBlock: u32 = 20;
    
    // 默认扣费周期（30天）
    pub const DefaultBillingPeriod: u32 = 864000;  // 30天 * 28800块/天
    
    // 基础存储费率（0.0001 DUST/MB/天）
    pub const BaseStorageFeeRate: u128 = 100_000_000_000;  // 0.0001 * 10^15
    
    // IPFS Pool账户ID
    pub const IpfsPoolPalletId: PalletId = PalletId(*b"py/ipfsp");
}
```

### 6.3 运营者经济模型

```
保守估算（网络初期）：
- 运营者数量：10个
- 总存储量：50TB（5TB/运营者）
- 平均CID大小：10MB
- 总CID数：5,000,000个
- 平均副本数：3
- 总副本任务：15,000,000个

每个运营者：
- 存储任务：1,500,000个副本
- 存储容量：15TB实际占用
- 月收益：1,500,000 × 10MB × 0.0001 DUST/MB/天 × 30天 = 45,000 DUST
- 月成本：电费500元 + 带宽500元 = 1,000元
- 月净利润（1 DUST = 1元）：45,000 - 1,000 = 44,000元
- 年ROI：(44,000 × 12) / 50,000 (初始投入) = 1056% ✅
```

---

## 七、前端Dashboard集成

### 7.1 健康仪表板页面

```typescript
// stardust-dapp/src/pages/ipfs/HealthDashboard.tsx

interface HealthDashboardProps {
  api: ApiPromise;
}

export const HealthDashboard: React.FC<HealthDashboardProps> = ({ api }) => {
  const [stats, setStats] = useState<GlobalHealthStats | null>(null);
  
  useEffect(() => {
    // 订阅链上健康统计
    const unsub = api.query.memoIpfs.healthCheckStats((data) => {
      setStats(data.toJSON());
    });
    
    return () => { unsub.then(u => u()); };
  }, [api]);
  
  return (
    <div className="health-dashboard">
      <Card title="IPFS网络健康状态">
        <Statistic.Group>
          <Statistic title="总Pin数" value={stats?.total_pins} />
          <Statistic 
            title="健康率" 
            value={((stats?.healthy_count / stats?.total_pins) * 100).toFixed(2)} 
            suffix="%" 
          />
          <Statistic 
            title="降级数" 
            value={stats?.degraded_count} 
            valueStyle={{ color: '#faad14' }} 
          />
          <Statistic 
            title="危险数" 
            value={stats?.critical_count} 
            valueStyle={{ color: '#f5222d' }} 
          />
        </Statistic.Group>
      </Card>
      
      {/* 分层统计 */}
      <Card title="分层Pin统计" style={{ marginTop: 16 }}>
        <Table 
          dataSource={[
            { tier: 'Critical', count: stats?.critical_tier_count, avg_replicas: 5 },
            { tier: 'Standard', count: stats?.standard_tier_count, avg_replicas: 3 },
            { tier: 'Temporary', count: stats?.temporary_tier_count, avg_replicas: 1 },
          ]}
          columns={[
            { title: '分层等级', dataIndex: 'tier', key: 'tier' },
            { title: 'Pin数量', dataIndex: 'count', key: 'count' },
            { title: '平均副本数', dataIndex: 'avg_replicas', key: 'avg_replicas' },
          ]}
        />
      </Card>
    </div>
  );
};
```

### 7.2 运营者奖励页面

```typescript
// stardust-dapp/src/pages/ipfs/OperatorRewards.tsx

export const OperatorRewardsPage: React.FC = () => {
  const { api, account } = useSubstrate();
  const [rewards, setRewards] = useState<Balance | null>(null);
  
  const handleClaim = async () => {
    if (!api || !account) return;
    
    const tx = api.tx.memoIpfs.operatorClaimRewards();
    await tx.signAndSend(account, ({ status }) => {
      if (status.isInBlock) {
        message.success('奖励提取成功！');
        // 刷新余额
        fetchRewards();
      }
    });
  };
  
  return (
    <Card title="运营者奖励">
      <Descriptions column={1}>
        <Descriptions.Item label="可提取奖励">
          {rewards ? formatBalance(rewards) : '0'} DUST
        </Descriptions.Item>
        <Descriptions.Item label="累计收益">
          {/* 从链上查询累计历史 */}
        </Descriptions.Item>
      </Descriptions>
      
      <Button 
        type="primary" 
        onClick={handleClaim}
        disabled={!rewards || rewards.isZero()}
      >
        提取奖励
      </Button>
    </Card>
  );
};
```

---

## 八、总结与后续

### 8.1 改造效果预期

```
性能提升：
✅ Pin查找效率：全局扫描 O(n) → 域索引 O(1)，速度提升100倍+
✅ 扣费自动化：手动治理调用 → on_finalize自动，降低治理成本90%
✅ 巡检响应：固定周期 → 动态调整，危险CID巡检频率提升4倍

成本优化：
✅ 副本数灵活：固定5副本 → 分层1/3/5副本，平均成本降低40%
✅ 运营者收益：自动分配 + 保证金保护，吸引更多运营者加入

用户体验：
✅ 宽限期保护：7天缓冲期，避免因短期余额不足导致数据丢失
✅ 前端Dashboard：实时监控健康状态，透明化费用流向
```

### 8.2 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| on_finalize阻塞 | 限流（MaxHealthChecksPerBlock=10） |
| 迁移失败 | 灰度发布，先在测试网验证2周 |
| 费用模型不合理 | 治理提案动态调整，初期保守设置 |
| 运营者串通作弊 | 申诉系统 + 保证金惩罚 |

### 8.3 后续优化方向

```
Phase 2（中期）：
- 引入经济模型动态调节（根据MEMO价格自动调整费率）
- 优化OCW并发度（并行巡检多个CID）
- 支持跨链IPFS Pin（Polkadot → Kusama）

Phase 3（长期）：
- 引入零知识证明验证存储（降低信任假设）
- 支持冷热数据分层存储（SSD + HDD混合）
- 实现去中心化IPFS Gateway（运营者提供HTTP访问）
```

---

**完成标志**：
- ✅ 存储结构设计完成
- ✅ 核心逻辑流程设计完成
- ✅ 治理接口设计完成
- ✅ 实施计划明确
- ✅ 前端集成方案明确

**下一步**：开始编码实现阶段1（存储结构改造）。

