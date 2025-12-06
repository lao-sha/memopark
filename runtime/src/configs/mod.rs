// This is free and unencumbered software released into the public domain.
//
// Anyone is free to copy, modify, publish, use, compile, sell, or
// distribute this software, either in source code form or as a compiled
// binary, for any purpose, commercial or non-commercial, and by any
// means.
//
// In jurisdictions that recognize copyright laws, the author or authors
// of this software dedicate any and all copyright interest in the
// software to the public domain. We make this dedication for the benefit
// of the public at large and to the detriment of our heirs and
// successors. We intend this dedication to be an overt act of
// relinquishment in perpetuity of all present and future rights to this
// software under copyright law.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
// IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
// OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
// ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.
//
// For more information, please refer to <http://unlicense.org>

// Substrate and Polkadot dependencies
// 移除重复导入，避免与下方 `use super::{ ... Runtime, RuntimeCall, RuntimeEvent, ... }` 冲突
use frame_support::traits::{Contains, EnsureOrigin, OriginTrait};
use frame_support::{
    derive_impl, parameter_types,
    traits::{ConstBool, ConstU128, ConstU16, ConstU32, ConstU64, ConstU8, VariantCountOf},
    weights::{
        constants::{RocksDbWeight, WEIGHT_REF_TIME_PER_SECOND},
        IdentityFee, Weight,
    },
    PalletId,
};
use frame_system::limits::{BlockLength, BlockWeights};
use pallet_transaction_payment::{ConstFeeMultiplier, Multiplier};
use sp_consensus_aura::sr25519::AuthorityId as AuraId;
use sp_core::Get;
use sp_runtime::{traits::AccountIdConversion, traits::One, traits::SaturatedConversion, Perbill};
use sp_version::RuntimeVersion;
use alloc::string::ToString;
// ===== stardust-appeals 运行时配置（占位骨架） =====
impl pallet_stardust_appeals::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    
    /// Phase 1.5优化：使用Fungible traits替代Currency
    /// - 完全移除Currency和ReservableCurrency
    /// - 使用官方fungible API（pallet-balances Holds API）
    type Fungible = Balances;
    
    /// Phase 1.5优化：RuntimeHoldReason绑定
    /// - 连接pallet级HoldReason和Runtime级RuntimeHoldReason
    type RuntimeHoldReason = RuntimeHoldReason;

    // ========== Phase 2治理优化：以下参数已迁移到pallet-governance-params ==========
    // ❌ 已移除：type AppealDeposit = frame_support::traits::ConstU128<10_000_000_000>;
    //    → 改为通过 pallet_governance_params 动态查询
    //
    // ❌ 已移除：type RejectedSlashBps = frame_support::traits::ConstU16<3000>;
    //    → 改为通过 pallet_governance_params 动态查询
    //
    // ❌ 已移除：type WithdrawSlashBps = frame_support::traits::ConstU16<1000>;
    //    → 改为通过 pallet_governance_params 动态查询
    //
    // ❌ 已移除：type NoticeDefaultBlocks = frame_support::traits::ConstU32<{ 30 * DAYS as u32 }>;
    //    → 改为通过 pallet_governance_params 动态查询
    //
    // ✅ 优势：
    // - 参数可通过治理投票动态调整，无需升级runtime
    // - 统一参数管理，避免重复定义
    // - 符合去中心化治理原则

    /// 限频窗口（块）
    type WindowBlocks = frame_support::traits::ConstU32<600>;
    /// 窗口内最多提交次数
    type MaxPerWindow = frame_support::traits::ConstU32<5>;

    /// 国库账户（罚没接收）
    type TreasuryAccount = TreasuryAccount;
    /// 执行路由占位实现
    type Router = ContentGovernanceRouter;
    /// 审批起源：Root | 委员会阈值(2/3)
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    /// 每块最多执行 50 条（示例）
    type MaxExecPerBlock = frame_support::traits::ConstU32<50>;
    /// 函数级中文注释：只读分页返回上限（示例：512 条）。
    type MaxListLen = frame_support::traits::ConstU32<512>;
    /// 函数级中文注释：执行失败最大重试次数（示例：3 次）。
    type MaxRetries = frame_support::traits::ConstU8<3>;
    /// 函数级中文注释：失败重试基础退避区块数（示例：600 块 ≈ 1 小时@6s）。
    type RetryBackoffBlocks = frame_support::traits::ConstU32<600>;
    /// 函数级中文注释：动态押金策略实现：按 domain/action 给出基准押金倍数；没有匹配则回退固定押金。
    type AppealDepositPolicy = ContentAppealDepositPolicy;
    /// 权重实现（占位）
    type WeightInfo = pallet_stardust_appeals::weights::SubstrateWeight<Runtime>;
    /// 函数级中文注释：最近活跃度提供者（用于"应答自动否决"判断）。
    type LastActiveProvider = ContentLastActiveProvider;
    /// 函数级中文注释：CID 最小长度默认值（示例：10字节）。
    type MinEvidenceCidLen = frame_support::traits::ConstU32<10>;
    /// 函数级中文注释：理由 CID 最小长度默认值（示例：8字节）。
    type MinReasonCidLen = frame_support::traits::ConstU32<8>;
    /// 函数级中文注释：作品信息提供者（Phase 4：阶段4接口补充）。
    /// - 从deceased pallet读取作品信息和统计数据
    /// - 供押金计算使用（Phase 2差异化押金机制）
    /// - 供影响力评分使用（Phase 3高级影响力评估）
    type WorksProvider = DeceasedWorksProvider;

    /// 函数级中文注释：作品投诉基础押金（Phase 2：差异化押金机制）
    /// - 用于作品投诉的基础押金金额
    /// - 实际押金 = 基础押金 × 各种系数
    /// - 示例：10 DUST（10,000,000,000,000最小单位）
    type BaseWorkComplaintDeposit = frame_support::traits::ConstU128<10_000_000_000_000>;

    /// 函数级中文注释：作品投诉最小押金限制（Phase 2：保护机制）
    /// - 防止高信誉+低影响力导致押金过低
    /// - 保证投诉的基本严肃性
    /// - 示例：5 DUST
    type MinWorkComplaintDeposit = frame_support::traits::ConstU128<5_000_000_000_000>;

    /// 函数级中文注释：作品投诉最大押金限制（Phase 2：保护机制）
    /// - 防止低信誉+高影响力导致押金过高
    /// - 即使极端情况下押金也不会过高
    /// - 示例：1000 DUST
    type MaxWorkComplaintDeposit = frame_support::traits::ConstU128<1_000_000_000_000_000>;

    /// 函数级中文注释：用户信誉提供者（Phase 2：差异化押金机制）
    /// - 返回用户信誉值（0-100）
    /// - 用于押金系数计算（高信誉=低系数）
    /// - 占位实现：默认返回50（标准押金1.0x）
    type ReputationProvider = DefaultReputationProvider;
}

/// 函数级中文注释：内容治理申诉的动态押金策略实现（USD锚定版本）
/// 
/// ## 核心逻辑
/// 1. 基础押金金额：$10 USD（固定）
/// 2. 从 pallet-pricing 获取DUST/USDT实时市场价格
/// 3. 计算押金DUST数量 = $10 / (DUST价格 in USDT)
/// 4. 根据 domain/action 应用倍数（1x, 1.5x, 2x）
/// 
/// ## 价格安全机制
/// - 最低价格保护：如果市场价格为0或过低，使用默认价格（0.000001 USDT/DUST）
/// - 最高押金上限：单次押金不超过 100,000 DUST（防止价格异常导致押金过高）
/// - 最低押金下限：单次押金不少于 1 DUST（保证押金有意义）
/// 
/// ## 倍数规则（可后续治理升级）
/// - 逝者媒体域(4)：替换 URI(31)/冻结视频集(32) → 2× 基准；隐藏媒体(30) → 1× 基准
/// - 逝者文本域(3)：删除类(20/21) → 1.5× 基准；编辑类(22/23) → 1× 基准
/// - 逝者档案域(2)：主图/可见性调整(1/2/3) → 1× 基准；治理转移拥有者(4) → 1.5× 基准
/// - 其他 → None（回退到固定押金）
pub struct ContentAppealDepositPolicy;
impl pallet_stardust_appeals::AppealDepositPolicy for ContentAppealDepositPolicy {
    type AccountId = AccountId;
    type Balance = Balance;
    type BlockNumber = BlockNumber;
    
    fn calc_deposit(
        _who: &Self::AccountId,
        domain: u8,
        _target: u64,
        action: u8,
    ) -> Option<Self::Balance> {
        // 1. 获取DUST/USDT市场价格（精度 10^6，即 1,000,000 = 1 USDT）
        let dust_price_usdt = pallet_pricing::Pallet::<Runtime>::get_dust_market_price_weighted();
        
        // 2. 价格安全检查：如果价格为0或过低，使用默认最低价格
        let safe_price = if dust_price_usdt == 0 || dust_price_usdt < 1 {
            1u64 // 0.000001 USDT/DUST（最低保护价格）
        } else {
            dust_price_usdt
        };
        
        // 3. 计算$1 USD等价的DUST数量
        // $1 USD = 1,000,000（精度 10^6）
        // MEMO数量 = $1 / (DUST价格 in USDT) = 1,000,000 / safe_price
        // 结果需要转换为DUST精度（10^12）
        const ONE_USD: u128 = 1_000_000u128; // $1 in USDT (precision 10^6)
        const DUST_PRECISION: u128 = 1_000_000_000_000u128; // 10^12

        let base_deposit_dust = ONE_USD
            .saturating_mul(DUST_PRECISION)
            .checked_div(safe_price as u128)
            .unwrap_or(1 * DUST_PRECISION); // 默认1 DUST
        
        // 4. 根据 domain/action 确定倍数（以万分比表示）
        let mult_bp: u16 = match (domain, action) {
            (4, 31) | (4, 32) => 20000, // 2.0x
            (4, 30) => 10000,           // 1.0x
            (3, 20) | (3, 21) => 15000, // 1.5x
            (3, 22) | (3, 23) => 10000, // 1.0x
            (2, 1) | (2, 2) | (2, 3) => 10000, // 1.0x
            (2, 4) => 15000, // 治理转移拥有者 1.5x
            _ => return None, // 不支持的域/操作，回退到固定押金
        };
        
        // 5. 应用倍数：final_deposit = base_deposit * (mult_bp / 10000)
        let mult = sp_runtime::Perbill::from_parts((mult_bp as u32) * 100); // 100bp = 1%
        let final_deposit = mult.mul_floor(base_deposit_dust);
        
        // 6. 安全限制
        const MAX_DEPOSIT: Balance = 100_000 * DUST_PRECISION; // 最高 100,000 DUST
        const MIN_DEPOSIT: Balance = 1 * DUST_PRECISION; // 最低 1 DUST
        
        let safe_deposit = final_deposit.clamp(MIN_DEPOSIT, MAX_DEPOSIT);
        
        Some(safe_deposit)
    }
}

/// 函数级详细中文注释：内容治理最近活跃度提供者实现。
/// - 仅对 2=deceased 域返回最近活跃块高：读取 `pallet-deceased::LastActiveOf`；其他域返回 None。
pub struct ContentLastActiveProvider;
impl pallet_stardust_appeals::LastActiveProvider for ContentLastActiveProvider {
    type BlockNumber = BlockNumber;
    fn last_active_of(domain: u8, target: u64) -> Option<Self::BlockNumber> {
        match domain {
            2 => pallet_deceased::pallet::LastActiveOf::<Runtime>::get(target),
            _ => None,
        }
    }
}

/// 函数级详细中文注释：逝者作品信息提供者实现（Phase 4：阶段4接口补充）
///
/// ## 功能说明
/// - 从deceased pallet读取作品的基本信息和统计数据
/// - 将DeceasedWork和WorkEngagementStats组合为WorkInfo结构
/// - 供stardust-appeals pallet的押金计算使用
///
/// ## 数据来源
/// - DeceasedWorks<Runtime>: 作品基本信息（work_id, deceased_id, work_type, uploader等）
/// - WorkEngagementStats<Runtime>: 作品统计数据（view_count, share_count等）
///
/// ## 设计理念
/// - Runtime层adapter，避免pallets之间的直接依赖
/// - 读取多个存储项并组合数据
/// - 为Phase 3高级影响力评估提供统计数据
pub struct DeceasedWorksProvider;
impl pallet_stardust_appeals::WorksProvider for DeceasedWorksProvider {
    type AccountId = AccountId;

    /// 获取作品完整信息（包含Phase 3统计数据）
    fn get_work_info(work_id: u64) -> Option<pallet_stardust_appeals::WorkInfo<Self::AccountId>> {
        // 1. 读取作品基本信息
        let work = pallet_deceased::pallet::DeceasedWorks::<Runtime>::get(work_id)?;

        // 2. 读取作品统计数据（如果不存在则返回默认值全0）
        let engagement = pallet_deceased::pallet::WorkEngagementStats::<Runtime>::get(work_id);

        // 3. 转换work_type为字符串
        let work_type_str = work.work_type.as_str().to_string();

        // 4. 转换privacy_level为u8代码
        let privacy_level_code: u8 = match work.privacy_level {
            pallet_deceased::works::PrivacyLevel::Public => 0,
            pallet_deceased::works::PrivacyLevel::Family => 1,
            pallet_deceased::works::PrivacyLevel::Descendants => 2,
            pallet_deceased::works::PrivacyLevel::Private => 3,
        };

        // 5. 计算上传时间（将BlockNumber转换为Unix时间戳）
        // 假设6秒一个区块，创世区块对应时间戳0
        let uploaded_at_timestamp = work.uploaded_at.saturated_into::<u64>() * 6u64;

        // 6. 构建WorkInfo结构
        Some(pallet_stardust_appeals::WorkInfo {
            work_id,
            deceased_id: work.deceased_id,
            work_type: work_type_str,
            uploader: work.uploader,
            privacy_level: privacy_level_code,
            ai_training_enabled: work.ai_training_enabled,
            is_verified: work.verified,
            ipfs_cid: Some(work.ipfs_cid.into_inner()),

            // Phase 3 统计数据（从WorkEngagementStats读取）
            view_count: engagement.view_count,
            share_count: engagement.share_count,
            favorite_count: engagement.favorite_count,
            comment_count: engagement.comment_count,
            ai_training_usage: engagement.ai_training_usage,
            file_size: work.file_size,
            uploaded_at: uploaded_at_timestamp as u32,
        })
    }

    /// 检查作品是否存在
    fn work_exists(work_id: u64) -> bool {
        pallet_deceased::pallet::DeceasedWorks::<Runtime>::contains_key(work_id)
    }

    /// 获取作品所有者（逝者的owner）
    fn get_work_owner(work_id: u64) -> Option<Self::AccountId> {
        let work = pallet_deceased::pallet::DeceasedWorks::<Runtime>::get(work_id)?;
        // 将u64转换为T::DeceasedId类型
        use codec::{Encode, Decode};
        let deceased_id_bytes = work.deceased_id.encode();
        let deceased_id: u64 = Decode::decode(&mut &deceased_id_bytes[..]).ok()?;
        let deceased = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(deceased_id)?;
        Some(deceased.owner)
    }
}

/// 函数级详细中文注释：默认信誉提供者（Phase 2占位实现）
///
/// ## 功能说明
/// - 为作品投诉押金计算提供用户信誉值
/// - 当前为占位实现，总是返回50（中等信誉）
///
/// ## 未来实现
/// - 集成pallet-reputation或类似信誉管理pallet
/// - 根据用户历史行为计算信誉值
/// - 支持动态信誉更新
///
/// ## 信誉值范围
/// - 0-100: 数字越大信誉越高
/// - 50: 中等信誉（默认值）
/// - 押金系数：信誉越高，押金系数越低
pub struct DefaultReputationProvider;
impl pallet_stardust_appeals::ReputationProvider for DefaultReputationProvider {
    type AccountId = AccountId;

    /// 获取用户信誉值（占位实现：总是返回50）
    fn get_reputation(_who: &Self::AccountId) -> Option<u8> {
        Some(50) // 默认中等信誉
    }
}
// ====== 委员会（Council）运行时配置 ======
parameter_types! {
    /// 函数级中文注释：委员会动议最长投票期（示例：7天）。
    pub const CouncilMotionDuration: BlockNumber = 7 * DAYS;
    /// 函数级中文注释：委员会并行提案上限（示例：50）。
    pub const CouncilMaxProposals: u32 = 50;
    /// 函数级中文注释：委员会最大成员数（示例：50）。
    pub const CouncilMaxMembers: u32 = 50;
    /// 函数级中文注释：提案最大权重上限（简化为 2 秒计算上限）。
    pub const CouncilMaxProposalWeight: Weight = Weight::from_parts(2u64 * WEIGHT_REF_TIME_PER_SECOND, u64::MAX);
}

type CouncilCollective = pallet_collective::Instance1;
impl pallet_collective::Config<CouncilCollective> for Runtime {
    /// 函数级中文注释：起源类型绑定到运行时。
    type RuntimeOrigin = RuntimeOrigin;
    /// 函数级中文注释：可被动议执行的调用类型。
    type Proposal = RuntimeCall;
    /// 函数级中文注释：事件类型绑定到运行时事件。
    type RuntimeEvent = RuntimeEvent;
    /// 函数级中文注释：动议持续时间配置。
    type MotionDuration = CouncilMotionDuration;
    /// 函数级中文注释：并行提案数上限。
    type MaxProposals = CouncilMaxProposals;
    /// 函数级中文注释：成员数上限。
    type MaxMembers = CouncilMaxMembers;
    /// 函数级中文注释：默认投票策略（跟随 Prime）。
    type DefaultVote = pallet_collective::PrimeDefaultVote;
    /// 函数级中文注释：权重信息（占位）。
    type WeightInfo = pallet_collective::weights::SubstrateWeight<Runtime>;
    /// 函数级中文注释：允许设置成员的起源（Root）。
    type SetMembersOrigin = frame_system::EnsureRoot<AccountId>;
    /// 函数级中文注释：提案最大可执行权重上限。
    type MaxProposalWeight = CouncilMaxProposalWeight;
    /// 函数级中文注释：可无成本否决提案的起源（Root）。
    type DisapproveOrigin = frame_system::EnsureRoot<AccountId>;
    /// 函数级中文注释：可杀死恶意提案的起源（Root）。
    type KillOrigin = frame_system::EnsureRoot<AccountId>;
    /// 函数级中文注释：提案押金/成本考虑（无）。
    type Consideration = ();
}

// ====== 技术与安全委员会（Technical Committee）运行时配置 ======
parameter_types! {
    /// 函数级中文注释：技术委员会动议持续期（示例：3天）。
    pub const TechMotionDuration: BlockNumber = 3 * DAYS;
    /// 函数级中文注释：技术委员会并行提案上限。
    pub const TechMaxProposals: u32 = 30;
    /// 函数级中文注释：技术委员会最大成员数。
    pub const TechMaxMembers: u32 = 15;
    /// 函数级中文注释：技术委员会提案最大权重上限（2 秒）。
    pub const TechMaxProposalWeight: Weight = Weight::from_parts(2u64 * WEIGHT_REF_TIME_PER_SECOND, u64::MAX);
}

// ====== 内容委员会（Content Committee）运行时配置 ======
parameter_types! {
    /// 函数级中文注释：内容委员会动议持续期（示例：5天）。
    pub const ContentMotionDuration: BlockNumber = 5 * DAYS;
    /// 函数级中文注释：内容委员会并行提案上限。
    pub const ContentMaxProposals: u32 = 50;
    /// 函数级中文注释：内容委员会最大成员数。
    pub const ContentMaxMembers: u32 = 25;
    /// 函数级中文注释：内容委员会提案最大权重上限（2 秒）。
    pub const ContentMaxProposalWeight: Weight = Weight::from_parts(2u64 * WEIGHT_REF_TIME_PER_SECOND, u64::MAX);
}

type ContentCollective = pallet_collective::Instance3;
impl pallet_collective::Config<ContentCollective> for Runtime {
    type RuntimeOrigin = RuntimeOrigin;
    type Proposal = RuntimeCall;
    type RuntimeEvent = RuntimeEvent;
    type MotionDuration = ContentMotionDuration;
    type MaxProposals = ContentMaxProposals;
    type MaxMembers = ContentMaxMembers;
    type DefaultVote = pallet_collective::PrimeDefaultVote;
    type WeightInfo = pallet_collective::weights::SubstrateWeight<Runtime>;
    type SetMembersOrigin = frame_system::EnsureRoot<AccountId>;
    type MaxProposalWeight = ContentMaxProposalWeight;
    type DisapproveOrigin = frame_system::EnsureRoot<AccountId>;
    type KillOrigin = frame_system::EnsureRoot<AccountId>;
    type Consideration = ();
}

type TechnicalCollective = pallet_collective::Instance2;
impl pallet_collective::Config<TechnicalCollective> for Runtime {
    /// 函数级中文注释：起源类型绑定到运行时。
    type RuntimeOrigin = RuntimeOrigin;
    /// 函数级中文注释：可被动议执行的调用类型。
    type Proposal = RuntimeCall;
    /// 函数级中文注释：事件类型绑定到运行时事件。
    type RuntimeEvent = RuntimeEvent;
    /// 函数级中文注释：动议持续时间配置。
    type MotionDuration = TechMotionDuration;
    /// 函数级中文注释：并行提案数上限。
    type MaxProposals = TechMaxProposals;
    /// 函数级中文注释：成员数上限。
    type MaxMembers = TechMaxMembers;
    /// 函数级中文注释：默认投票策略（跟随 Prime）。
    type DefaultVote = pallet_collective::PrimeDefaultVote;
    /// 函数级中文注释：权重信息（占位）。
    type WeightInfo = pallet_collective::weights::SubstrateWeight<Runtime>;
    /// 函数级中文注释：允许设置成员的起源（Root）。
    type SetMembersOrigin = frame_system::EnsureRoot<AccountId>;
    /// 函数级中文注释：提案最大可执行权重上限。
    type MaxProposalWeight = TechMaxProposalWeight;
    /// 函数级中文注释：可无成本否决提案的起源（Root）。
    type DisapproveOrigin = frame_system::EnsureRoot<AccountId>;
    /// 函数级中文注释：可杀死恶意提案的起源（Root）。
    type KillOrigin = frame_system::EnsureRoot<AccountId>;
    /// 函数级中文注释：提案押金/成本考虑（无）。
    type Consideration = ();
}

// 引入以区块数表示的一天常量
use crate::{DAYS, UNIT};
use alloc::vec;
// 引入以区块数表示的一分钟常量，用于设备挑战 TTL 等时间参数
// 引入余额单位常量（已移除与设备/挖矿相关依赖，无需引入 MINUTES/MILLI_UNIT）

// Local module imports
use super::{
    AccountId, Aura, Balance, Balances, Block, BlockNumber, Hash, StardustIpfs, Nonce, PalletInfo, Runtime,
    RuntimeCall, RuntimeEvent, RuntimeFreezeReason, RuntimeHoldReason, RuntimeOrigin, RuntimeTask,
    System, EXISTENTIAL_DEPOSIT, SLOT_DURATION, VERSION, ChatPermission,
};
use sp_runtime::traits::IdentityLookup;

/// 函数级中文注释：基于区块哈希的简单随机数实现
/// 注意：这不是密码学安全的随机数,仅用于ID生成等非安全关键场景
pub struct SimpleRandomness;

impl frame_support::traits::Randomness<Hash, BlockNumber> for SimpleRandomness {
    fn random(subject: &[u8]) -> (Hash, BlockNumber) {
        let block_number = System::block_number();
        let block_hash = System::block_hash(block_number);

        // 将 subject 与区块哈希混合
        let mut data = subject.to_vec();
        data.extend_from_slice(block_hash.as_ref());
        data.extend_from_slice(&block_number.to_le_bytes());

        let hash = sp_core::hashing::blake2_256(&data);
        (Hash::from(hash), block_number)
    }
}

// =================== 🆕 2025-11-26: Sudo特权签名Origin ===================
/// 函数级详细中文注释：Sudo账户特权Origin实现
///
/// ### 功能说明
/// - 允许Sudo账户作为特权签名用户调用受保护的函数
/// - 绕过频率限制、数量限制等普通用户限制
///
/// ### 设计理念
/// - 从pallet_sudo读取当前Sudo账户
/// - 验证调用者是否为Sudo账户
/// - 返回Sudo账户作为Success类型，供ensure_signed后续使用
///
/// ### 使用场景
/// - Root账户创建逝者（无数量/时间限制）
/// - 其他需要特权操作的场景
pub struct EnsureSudo;

impl EnsureOrigin<RuntimeOrigin> for EnsureSudo {
    type Success = AccountId;

    fn try_origin(o: RuntimeOrigin) -> Result<Self::Success, RuntimeOrigin> {
        // 1. 尝试获取签名者
        let signed = o.clone().into_signer();

        if let Some(who) = signed {
            // 2. 获取当前Sudo账户（使用 Key::<T>::get() 而非 Pallet::key()）
            if let Some(sudo_key) = pallet_sudo::Key::<Runtime>::get() {
                // 3. 验证是否为Sudo账户
                if who == sudo_key {
                    return Ok(who);
                }
            }
        }

        Err(o)
    }

    #[cfg(feature = "runtime-benchmarks")]
    fn try_successful_origin() -> Result<RuntimeOrigin, ()> {
        // 基准测试用：返回Sudo账户的签名Origin
        if let Some(sudo_key) = pallet_sudo::Key::<Runtime>::get() {
            Ok(RuntimeOrigin::signed(sudo_key))
        } else {
            Err(())
        }
    }
}
// ==========================================================================

const NORMAL_DISPATCH_RATIO: Perbill = Perbill::from_percent(75);

parameter_types! {
    pub const BlockHashCount: BlockNumber = 2400;
    pub const Version: RuntimeVersion = VERSION;

    /// We allow for 2 seconds of compute with a 6 second average block time.
    pub RuntimeBlockWeights: BlockWeights = BlockWeights::with_sensible_defaults(
        Weight::from_parts(2u64 * WEIGHT_REF_TIME_PER_SECOND, u64::MAX),
        NORMAL_DISPATCH_RATIO,
    );
    pub RuntimeBlockLength: BlockLength = BlockLength::max_with_normal_ratio(5 * 1024 * 1024, NORMAL_DISPATCH_RATIO);
    pub const SS58Prefix: u8 = 42;
}

// 函数级中文注释：deceased-data 费用/押金与成熟期参数
parameter_types! {
    /// 相册押金（示例：0.02 UNIT）。
    pub const MediaAlbumDeposit: Balance = 20_000_000_000_000;
    /// 媒体押金（示例：0.005 UNIT）。
    pub const MediaMediaDeposit: Balance = 5_000_000_000_000;
    pub const DataMediaDeposit: Balance = 5_000_000_000_000;
    /// 创建相册小额手续费（示例：0.001 UNIT）。
    pub const MediaCreateFee: Balance = 1_000_000_000_000;
    /// 投诉观察/成熟期：365 天。直接复用 DAYS 常量，避免类型不匹配。
    pub const MediaComplaintPeriod: BlockNumber = 365 * DAYS;

    // ========== 留言免押金配置 ==========
    /// 函数级中文注释：文本/留言押金 - 设为0实现免押金
    /// - 原值：5_000_000_000_000 (5 DUST)
    /// - 新值：0（免押金）
    /// - 日期：2025-11-26
    pub const TextDepositZero: Balance = 0;

    /// 函数级中文注释：每日最大留言数（全局）
    pub const MaxMessagesPerUserDaily: u32 = 20;

    /// 函数级中文注释：每日对单个逝者最大留言数
    pub const MaxMessagesPerDeceasedDaily: u32 = 5;

    // ========== 🆕 2025-11-26: 留言付费配置 ==========
    /// 函数级详细中文注释：留言费用金额（固定 10,000 DUST）
    ///
    /// ### 配置说明
    /// - 金额：10,000 DUST（10^12 * 10,000 = 10_000_000_000_000_000）
    /// - 用途：用户给逝者留言需支付此费用
    /// - 资金流向：与供奉品一致（通过 pallet-affiliate 分配）
    ///   - 5% 销毁（通缩）
    ///   - 2% 国库（平台运营）
    ///   - 3% 存储（IPFS 费用）
    ///   - 90% 推荐链（15层，每层6%）
    pub const MessageFee: Balance = 10_000_000_000_000_000; // 10,000 DUST
}

/// The default types are being injected by [`derive_impl`](`frame_support::derive_impl`) from
/// [`SoloChainDefaultConfig`](`struct@frame_system::config_preludes::SolochainDefaultConfig`),
/// but overridden as needed.
#[derive_impl(frame_system::config_preludes::SolochainDefaultConfig)]
impl frame_system::Config for Runtime {
    /// The block type for the runtime.
    type Block = Block;
    /// Block & extrinsics weights: base values and limits.
    type BlockWeights = RuntimeBlockWeights;
    /// The maximum length of a block (in bytes).
    type BlockLength = RuntimeBlockLength;
    /// The identifier used to distinguish between accounts.
    type AccountId = AccountId;
    /// The type for storing how many extrinsics an account has signed.
    type Nonce = Nonce;
    /// The type for hashing blocks and tries.
    type Hash = Hash;
    /// Maximum number of block number to block hash mappings to keep (oldest pruned first).
    type BlockHashCount = BlockHashCount;
    /// The weight of database operations that the runtime can invoke.
    type DbWeight = RocksDbWeight;
    /// Version of the runtime.
    type Version = Version;
    /// The data to be stored in an account.
    type AccountData = pallet_balances::AccountData<Balance>;
    /// This is used as an identifier of the chain. 42 is the generic substrate prefix.
    type SS58Prefix = SS58Prefix;
    type MaxConsumers = frame_support::traits::ConstU32<16>;
    /// 函数级中文注释：基础调用过滤器，接入 origin-restriction 软策略（当前默认放行）。
    type BaseCallFilter = crate::configs::OriginRestrictionFilter;
}

impl pallet_aura::Config for Runtime {
    type AuthorityId = AuraId;
    type DisabledValidators = ();
    type MaxAuthorities = ConstU32<32>;
    type AllowMultipleBlocksPerSlot = ConstBool<false>;
    type SlotDuration = pallet_aura::MinimumPeriodTimesTwo<Runtime>;
}

impl pallet_grandpa::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;

    type WeightInfo = ();
    type MaxAuthorities = ConstU32<32>;
    type MaxNominators = ConstU32<0>;
    type MaxSetIdSessionEntries = ConstU64<0>;

    type KeyOwnerProof = sp_core::Void;
    type EquivocationReportSystem = ();
}

impl pallet_timestamp::Config for Runtime {
    /// A timestamp: milliseconds since the unix epoch.
    type Moment = u64;
    type OnTimestampSet = Aura;
    type MinimumPeriod = ConstU64<{ SLOT_DURATION / 2 }>;
    type WeightInfo = ();
}

impl pallet_balances::Config for Runtime {
    type MaxLocks = ConstU32<50>;
    type MaxReserves = ();
    type ReserveIdentifier = [u8; 8];
    /// The type for recording an account's balance.
    type Balance = Balance;
    /// The ubiquitous event type.
    type RuntimeEvent = RuntimeEvent;
    type DustRemoval = ();
    type ExistentialDeposit = ConstU128<EXISTENTIAL_DEPOSIT>;
    type AccountStore = System;
    type WeightInfo = pallet_balances::weights::SubstrateWeight<Runtime>;
    type FreezeIdentifier = RuntimeFreezeReason;
    type MaxFreezes = VariantCountOf<RuntimeFreezeReason>;
    type RuntimeHoldReason = RuntimeHoldReason;
    type RuntimeFreezeReason = RuntimeFreezeReason;
    type DoneSlashHandler = ();
}

// 函数级中文注释：2025-10-22 已删除 pallet-balance-tiers 配置
// - 功能与固定免费次数重复，复杂度过高
// - 新用户 Gas 已由固定免费次数覆盖（做市商代付）
// - 活动空投、邀请奖励改用直接转账 DUST

// 函数级中文注释：2025-10-28 移除旧的 pallet-buyer-credit 和 pallet-maker-credit 配置
// 已整合为统一的 pallet-credit

parameter_types! {
    /// 函数级中文注释：统一信用系统参数 - 最小持仓量（用于资产信任评估）
    /// - 100 DUST 作为基准，持仓>=100倍（10000 DUST）视为高信任
    pub const CreditMinimumBalance: Balance = 100 * UNIT;
    
    // 买家信用配置
    /// 函数级中文注释：买家初始信用分（0-1000，建议500）
    pub const InitialBuyerCreditScore: u16 = 500;
    /// 函数级中文注释：订单完成信用分增加（建议10）
    pub const OrderCompletedBonus: u16 = 10;
    /// 函数级中文注释：订单违约信用分扣除（建议50）
    pub const OrderDefaultPenalty: u16 = 50;
    
    // 做市商信用配置
    /// 函数级中文注释：做市商初始信用分（800-1000，建议820）
    pub const InitialMakerCreditScore: u16 = 820;
    /// 函数级中文注释：订单按时完成信用分增加（建议2）
    pub const MakerOrderCompletedBonus: u16 = 2;
    /// 函数级中文注释：订单超时信用分扣除（建议10）
    pub const MakerOrderTimeoutPenalty: u16 = 10;
    /// 函数级中文注释：争议败诉信用分扣除（建议20）
    pub const MakerDisputeLossPenalty: u16 = 20;
    /// 函数级中文注释：做市商服务暂停阈值（建议750）
    pub const MakerSuspensionThreshold: u16 = 750;
    /// 函数级中文注释：做市商警告阈值（建议800）
    pub const MakerWarningThreshold: u16 = 800;
}

/// 函数级中文注释：统一信用风控模块配置
/// - 整合了买家信用和做市商信用两个子系统
/// - 买家信用：多维度信任评估、新用户分层冷启动、信用等级体系、快速学习机制
/// - 做市商信用：信用评分体系（800-1000分）、履约率追踪、违约惩罚、动态保证金
/// 函数级中文注释：Credit Pallet 配置实现
/// - 🔴 stable2506 API 变更：RuntimeEvent 自动继承，无需显式设置
impl pallet_credit::Config for Runtime {
    /// 函数级中文注释：使用原生币（Balances）作为 Currency
    type Currency = Balances;
    
    // 买家信用配置
    /// 函数级中文注释：买家初始信用分（0-1000）
    type InitialBuyerCreditScore = InitialBuyerCreditScore;
    /// 函数级中文注释：订单完成信用分增加
    type OrderCompletedBonus = OrderCompletedBonus;
    /// 函数级中文注释：订单违约信用分扣除
    type OrderDefaultPenalty = OrderDefaultPenalty;
    /// 函数级中文注释：每日区块数（用于日限额计算）
    type BlocksPerDay = ConstU32<{ DAYS as u32 }>;
    /// 函数级中文注释：最小持仓量（用于资产信任评估）
    type MinimumBalance = CreditMinimumBalance;
    
    // 做市商信用配置
    /// 函数级中文注释：做市商初始信用分（800-1000）
    type InitialMakerCreditScore = InitialMakerCreditScore;
    /// 函数级中文注释：订单按时完成信用分增加
    type MakerOrderCompletedBonus = MakerOrderCompletedBonus;
    /// 函数级中文注释：订单超时信用分扣除
    type MakerOrderTimeoutPenalty = MakerOrderTimeoutPenalty;
    /// 函数级中文注释：争议败诉信用分扣除
    type MakerDisputeLossPenalty = MakerDisputeLossPenalty;
    /// 函数级中文注释：做市商服务暂停阈值
    type MakerSuspensionThreshold = MakerSuspensionThreshold;
    /// 函数级中文注释：做市商警告阈值
    type MakerWarningThreshold = MakerWarningThreshold;
    
    /// 函数级中文注释：Weight 信息
    type CreditWeightInfo = ();
}

parameter_types! {
    pub FeeMultiplier: Multiplier = Multiplier::one();
}

/// 函数级中文注释：交易支付模块配置
/// - 2025-10-22：已恢复默认交易支付处理器（删除 balance-tiers 后）
/// - 使用标准 CurrencyAdapter 处理交易费用
/// - 免费 Gas 功能由固定免费次数实现（做市商代付）
impl pallet_transaction_payment::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    /// 函数级中文注释：使用标准交易支付处理器（默认实现）
    type OnChargeTransaction = pallet_transaction_payment::FungibleAdapter<Balances, ()>;
    type OperationalFeeMultiplier = ConstU8<5>;
    type WeightToFee = IdentityFee<Balance>;
    type LengthToFee = IdentityFee<Balance>;
    type FeeMultiplierUpdate = ConstFeeMultiplier<FeeMultiplier>;
    type WeightInfo = pallet_transaction_payment::weights::SubstrateWeight<Runtime>;
}

impl pallet_sudo::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type RuntimeCall = RuntimeCall;
    type WeightInfo = pallet_sudo::weights::SubstrateWeight<Runtime>;
}

/// Configure the pallet-template in pallets/template.
impl pallet_template::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = pallet_template::weights::SubstrateWeight<Runtime>;
}

// 已移除：pallet_karma 配置块与相关常量

// ===== temple 已移除；保留 agent/order 配置 =====

// 已移除：pallet-agent 配置与参数

// ===== memorial-park/grave/deceased 运行时参数占位（可按需调整） =====
parameter_types! {
    pub const ParkMaxRegionLen: u32 = 64;
    pub const ParkMaxCidLen: u32 = 64;
    pub const ParkMaxPerCountry: u32 = 100_000;
    // pub const GraveMaxFollowers: u32 = 100_000;  // 🗑️ 2025-11-16: 已删除 - pallet-stardust-grave 已移除
}
pub struct RootOnlyParkAdmin;
impl pallet_stardust_park::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxRegionLen = ParkMaxRegionLen;
    type MaxCidLen = ParkMaxCidLen;
    type MaxParksPerCountry = ParkMaxPerCountry;
    type ParkAdmin = RootOnlyParkAdmin; // 由本地适配器校验 Root
    /// 函数级中文注释：治理起源采用 Root | 委员会阈值(2/3)。
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance1, 2, 3>,
    >;
}

// 🗑️ 2025-11-16: 已删除 pallet-stardust-grave 参数定义
/*
parameter_types! {
    pub const GraveMaxCidLen: u32 = 64;
    pub const GraveMaxPerPark: u32 = 4096;
    pub const GraveMaxIntermentsPerGrave: u32 = 128;
    pub const GraveMaxIdsPerName: u32 = 1024;
    pub const GraveMaxComplaints: u32 = 100;
    pub const GraveMaxAdmins: u32 = 16;
    pub const GraveSlugLen: u32 = 10;
    pub const GraveFollowCooldownBlocks: u32 = 30;
    pub const GraveFollowDeposit: Balance = 0;
    pub const GraveCreateFee: Balance = 0;
    pub const GraveMaxCoverOptions: u32 = 256;
}
pub struct NoopIntermentHook;
*/

// 🗑️ 2025-11-16: 已删除 pallet-stardust-grave Config 实现
/*
// 重命名 crate：从 pallet_grave → pallet_stardust_grave
/// 函数级中文注释：Stardust Grave Pallet 配置实现
/// - 🔴 stable2506 API 变更：RuntimeEvent 自动继承，无需显式设置
impl pallet_stardust_grave::Config for Runtime {
    type WeightInfo = pallet_stardust_grave::weights::TestWeights;
    type MaxCidLen = GraveMaxCidLen;
    type MaxPerPark = GraveMaxPerPark;
    type MaxIntermentsPerGrave = GraveMaxIntermentsPerGrave;
    type OnInterment = NoopIntermentHook;
    type ParkAdmin = RootOnlyParkAdmin;
    type MaxIdsPerName = GraveMaxIdsPerName;
    type MaxComplaintsPerGrave = GraveMaxComplaints;
    type MaxAdminsPerGrave = GraveMaxAdmins;
    type MaxFollowers = GraveMaxFollowers;
    type SlugLen = GraveSlugLen;
    type DeceasedTokenProvider = DeceasedTokenProviderAdapter;
    type FollowCooldownBlocks = GraveFollowCooldownBlocks;
    type Currency = Balances;
    type FollowDeposit = GraveFollowDeposit;
    /// 函数级中文注释：绑定创建费与收款账户（指向国库 PalletId 派生地址）。
    type CreateFee = GraveCreateFee;
    type FeeCollector = TreasuryAccount;
    /// 函数级中文注释：治理起源绑定（Root | 内容委员会阈值 2/3）。
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    /// 函数级中文注释：注入公共封面目录容量上限。
    type MaxCoverOptions = GraveMaxCoverOptions;
    /// 函数级中文注释：注入公共音频目录容量上限（与封面目录同级）。
    type MaxAudioOptions = GraveMaxCoverOptions;
    /// 函数级中文注释：每墓位私有音频候选上限（示例沿用封面上限）。
    type MaxPrivateAudioOptions = GraveMaxCoverOptions;
    /// 函数级中文注释：每墓位播放列表长度上限（示例沿用封面上限）。
    type MaxAudioPlaylistLen = GraveMaxCoverOptions;
    /// 函数级中文注释：首页轮播上限/字段长度（示例值）。
    type MaxCarouselItems = frame_support::traits::ConstU32<20>;
    type MaxTitleLen = frame_support::traits::ConstU32<64>;
    type MaxLinkLen = frame_support::traits::ConstU32<128>;
    // ============= IPFS自动Pin配置 =============
    /// 函数级中文注释：使用MemoIpfs提供实际的自动pin功能
    type IpfsPinner = StardustIpfs;
    type Balance = Balance;
    type DefaultStoragePrice = ConstU128<{ 1 * crate::UNIT }>;
}
*/

// ===== deceased 配置 =====
parameter_types! {
    pub const DeceasedStringLimit: u32 = 256;
    pub const DeceasedMaxLinks: u32 = 8;

    // ✅ 墓位容量无限制说明
    // - **已删除**：DeceasedMaxPerGrave（原6人硬上限）
    // - **改为**：Vec 无容量限制，支持家族墓、纪念墓
    // - **保护**：经济成本（每人约10 DUST）天然防止恶意填充
    // - **性能**：前端分页加载，1000人墓位仅8KB Storage

    /// 函数级中文注释：每个逝者最大关注者数量
    /// - 建议值：10000（防止状态膨胀）
    /// - 可根据实际需求调整
    pub const DeceasedMaxFollowers: u32 = 10000;

    // ========== 🆕 2025-11-26: 逝者创建频率限制配置 ==========
    /// 函数级中文注释：每日最大逝者创建数（每用户）
    /// - 用于防止批量创建攻击
    /// - 建议值：3（满足绝大多数正常用户需求）
    pub const MaxDeceasedCreationsPerUserDaily: u32 = 3;

    /// 函数级中文注释：用户最大逝者总数
    /// - 用于防止单用户创建过多逝者
    /// - 建议值：20（足够创建整个家庭树）
    pub const MaxDeceasedPerUser: u32 = 20;

    /// 函数级中文注释：创建最小间隔（区块数）
    /// - 用于防止短时间内连续创建
    /// - 建议值：100块（约10分钟，假设6秒/块）
    pub const MinCreationIntervalBlocks: BlockNumber = 100;
    // ==========================================================

    // ========== 🆕 2025-11-26: Article押金机制配置 ==========
    /// 函数级详细中文注释：非拥有者创建 Article 的押金（USDT，精度 10^6）
    /// - 默认值：1_000_000 (1 USDT)
    /// - 可通过治理调整
    /// - 用于防止非拥有者滥用创建文章权限
    pub const ArticleDepositUsdt: u64 = 1_000_000;

    /// 函数级详细中文注释：Article 押金锁定期（区块数）
    /// - 默认值：288_000 (约 20 天，6秒/块)
    /// - 计算：20 * 24 * 60 * 60 / 6 = 288_000
    /// - 到期后自动退还押金
    pub const ArticleDepositLockPeriod: BlockNumber = 288_000;

    /// 函数级详细中文注释：每块最大处理到期文章数
    /// - 默认值：50
    /// - 防止 on_initialize 权重过大导致区块超重
    /// - 可根据链上负载调整
    pub const MaxExpiringArticlesPerBlock: u32 = 50;
    // ==========================================================
}

impl pallet_deceased::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type DeceasedId = u64;
    type StringLimit = ConstU32<256>;  // DeceasedStringLimit
    type MaxLinks = ConstU32<8>;  // DeceasedMaxLinks
    type TokenLimit = ConstU32<64>;  // GraveMaxCidLen
    type WeightInfo = ();
    /// 函数级中文注释：绑定 pallet-social 提供关注功能
    type Social = crate::Social;
    /// 函数级中文注释：绑定治理起源为 Root | 内容委员会阈值(2/3) 双通道，用于 gov* 接口。
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;

    // ============= Token修改治理配置 =============
    /// 函数级中文注释：Token修改治理委员会起源
    /// 使用内容委员会（Instance3）的多数决议(3/5)来批准Token修改提案
    type CommitteeOrigin = pallet_collective::EnsureProportionAtLeast<
        AccountId,
        pallet_collective::Instance3,
        3,
        5
    >;

    /// 函数级中文注释：Token修改提案批准阈值
    /// 需要3票赞成即可通过提案（对应上述3/5的多数要求）
    type ApprovalThreshold = ConstU32<3>;

    // ============= IPFS自动Pin配置 =============
    /// 函数级中文注释：使用MemoIpfs提供实际的自动pin功能
    type IpfsPinner = StardustIpfs;
    type Balance = Balance;
    type DefaultStoragePrice = ConstU128<{ 1 * crate::UNIT }>;
    type TreasuryAccount = TreasuryAccount;

    // ========== 🆕 2025-10-28: Text 模块配置（整合自 deceased-text）==========
    // ========== 🔄 2025-11-26: 留言免押金改革 ==========
    type TextId = u64;
    type MaxMessagesPerDeceased = DataMaxMessagesPerDeceased;
    type MaxEulogiesPerDeceased = DataMaxEulogiesPerDeceased;
    /// 函数级中文注释：文本/留言押金 - 改为0实现免押金
    /// - 修改前：DataMediaDeposit (5 DUST)
    /// - 修改后：TextDepositZero (0)
    /// - 日期：2025-11-26
    type TextDeposit = TextDepositZero;
    type ComplaintDeposit = DataMediaDeposit;
    type ComplaintPeriod = MediaComplaintPeriod;
    type ArbitrationAccount = TreasuryAccount;
    /// 函数级中文注释：每日最大留言数（全局）
    type MaxMessagesPerUserDaily = MaxMessagesPerUserDaily;
    /// 函数级中文注释：每日对单个逝者最大留言数
    type MaxMessagesPerDeceasedDaily = MaxMessagesPerDeceasedDaily;

    // ========== 🆕 2025-11-26: 留言付费配置 ==========
    /// 函数级详细中文注释：留言费用金额（固定 10,000 DUST）
    /// - 用户给逝者留言需支付此费用
    /// - 资金流向与供奉品一致
    type MessageFee = ConstU128<{ 10_000 * crate::UNIT }>;  // 10,000 DUST

    /// 函数级详细中文注释：留言费用分配器
    /// - 复用 pallet-affiliate 的 do_distribute_rewards
    /// - 资金分配：5%销毁 + 2%国库 + 3%存储 + 90%推荐链
    type MessageFeeDistributor = MessageFeeDistributorImpl;

    // ========== 🆕 2025-10-28: Media 模块配置（整合自 deceased-media）==========
    type AlbumId = u64;
    type VideoCollectionId = u64;
    type MediaId = u64;
    type MaxAlbumsPerDeceased = DataMaxAlbumsPerDeceased;
    type MaxVideoCollectionsPerDeceased = DataMaxVideoCollectionsPerDeceased;
    type MaxPhotoPerAlbum = DataMaxPhotosPerAlbum;
    type MaxTags = DataMaxTags;
    type MaxReorderBatch = DataMaxReorderBatch;
    type AlbumDeposit = MediaAlbumDeposit;
    type VideoCollectionDeposit = MediaAlbumDeposit;
    type MediaDeposit = DataMediaDeposit;
    type CreateFee = MediaCreateFee;
    type FeeCollector = TreasuryAccount;

    // ========== 共享配置 ==========
    type Currency = Balances;
    type MaxTokenLen = ConstU32<64>;  // GraveMaxCidLen

    // ========== 🆕 方案D：治理机制配置 ==========
    /// 函数级中文注释：Pricing Provider - 提供DUST/USDT汇率
    /// 已连接到 pallet-pricing 获取实时市场价格
    type PricingProvider = RealPricingProvider;

    /// 函数级中文注释：Fungible接口 - 支持hold机制的资产管理
    /// 使用Balances pallet提供hold功能
    type Fungible = Balances;

    /// 函数级中文注释：RuntimeHoldReason - hold机制的原因类型
    type RuntimeHoldReason = RuntimeHoldReason;

    // ========== 随机数和时间配置 ==========
    /// 函数级中文注释：特权起源 - Sudo账户可作为特权签名用户
    /// - 🆕 2025-11-26：从EnsureRoot改为EnsureSudo
    /// - 允许Sudo账户创建逝者时绕过频率限制
    /// - Sudo账户无数量限制、无时间间隔限制
    type PrivilegedOrigin = EnsureSudo;

    /// 函数级中文注释：随机数源 - 用于生成唯一ID
    /// 注意：使用SimpleRandomness,基于区块哈希,仅用于ID生成的辅助随机性
    type Randomness = SimpleRandomness;

    /// 函数级中文注释：Unix时间提供器 - 用于时间戳相关功能
    type UnixTime = pallet_timestamp::Pallet<Runtime>;

    // ========== 🆕 2025-11-26: 逝者创建频率限制配置 ==========
    /// 函数级中文注释：每日最大逝者创建数（每用户）
    /// - 替代押金机制的防滥用措施
    /// - 配合投诉治理机制使用
    type MaxDeceasedCreationsPerUserDaily = MaxDeceasedCreationsPerUserDaily;

    /// 函数级中文注释：用户最大逝者总数
    /// - 防止单用户创建过多逝者导致的状态膨胀
    type MaxDeceasedPerUser = MaxDeceasedPerUser;

    /// 函数级中文注释：创建最小间隔（区块数）
    /// - 用于防止短时间内连续创建
    type MinCreationIntervalBlocks = MinCreationIntervalBlocks;
    // ==========================================================

    // ========== 🆕 2025-11-26: Article押金机制配置 ==========
    /// 函数级详细中文注释：非拥有者创建 Article 的押金（USDT，精度 10^6）
    /// - 1_000_000 = 1 USDT
    /// - 非拥有者创建文章时需缴纳此押金
    /// - 押金到期后自动退还
    type ArticleDepositUsdt = ArticleDepositUsdt;

    /// 函数级详细中文注释：Article 押金锁定期（区块数）
    /// - 288_000 = 约20天（6秒/块）
    /// - 到期后 on_initialize 自动释放押金
    type ArticleDepositLockPeriod = ArticleDepositLockPeriod;

    /// 函数级详细中文注释：每块最大处理到期文章数
    /// - 50 = 每块最多处理50篇到期文章
    /// - 防止 on_initialize 权重过大
    type MaxExpiringArticlesPerBlock = MaxExpiringArticlesPerBlock;
    // ==========================================================
}

/// 函数级详细中文注释：Real Pricing Provider 实现（连接 pallet-pricing）
///
/// ## 功能说明
/// - 从 pallet-pricing 获取 DUST/USDT 市场加权平均价格
/// - 用于 deceased 治理模块的押金计算
///
/// ## 价格来源
/// - 使用 `pallet_pricing::get_dust_market_price_weighted()`
/// - 综合 OTC 和 Bridge 两个市场的交易数据
/// - 精度：10^6（即 1,000,000 = 1 USDT）
///
/// ## 安全机制
/// - 如果市场价格为 0，返回错误（不使用默认价格）
/// - 价格异常时由调用方处理
pub struct RealPricingProvider;
impl pallet_deceased::governance::PricingProvider for RealPricingProvider {
    fn get_current_exchange_rate() -> Result<u64, &'static str> {
        // 从 pallet-pricing 获取 DUST 市场加权平均价格
        let price = pallet_pricing::Pallet::<Runtime>::get_dust_market_price_weighted();

        // 价格为 0 表示市场无数据，返回错误
        if price == 0 {
            return Err("Market price unavailable");
        }

        Ok(price)
    }
}

/// 函数级详细中文注释：留言费用分配器实现（2025-11-26 留言付费功能）
///
/// ### 功能说明
/// - 复用 pallet-affiliate 的 do_distribute_rewards
/// - 资金流向与供奉品完全一致
/// - 支持15层推荐链分配
///
/// ### 资金分配
/// - 销毁：5%
/// - 国库：2%
/// - 存储：3%
/// - 推荐链：90%（15层，每层6%）
///
/// ### 设计理念
/// - 与 MemorialOfferingHook 共享相同的分配逻辑
/// - 确保留言费用与供奉品费用的一致性
/// - 复用经过验证的联盟分账机制
pub struct MessageFeeDistributorImpl;

impl pallet_deceased::MessageFeeDistributor<AccountId, Balance>
    for MessageFeeDistributorImpl
{
    fn distribute_message_fee(
        payer: &AccountId,
        amount: Balance,
    ) -> Result<Balance, sp_runtime::DispatchError> {
        // 直接调用 pallet-affiliate 的分配函数
        // 资金流向与供奉品完全一致
        pallet_affiliate::Pallet::<Runtime>::do_distribute_rewards(
            payer,
            amount,
            None,  // 无时长参数（非定时供奉）
        )
    }
}

// ===== deceased-data 配置 =====
parameter_types! {
    pub const DataMaxAlbumsPerDeceased: u32 = 64;
    pub const DataMaxVideoCollectionsPerDeceased: u32 = 64;
    pub const DataMaxPhotosPerAlbum: u32 = 256;
    pub const DataStringLimit: u32 = 512;
    pub const DataMaxTags: u32 = 16;
    pub const DataMaxReorderBatch: u32 = 100;
    /// 函数级中文注释：每位逝者最多留言条数（Message 未分类，按逝者维度索引）
    pub const DataMaxMessagesPerDeceased: u32 = 10_000;
    /// 函数级中文注释：每位逝者最多悼词条数（Eulogy 未分类，按逝者维度索引）
    pub const DataMaxEulogiesPerDeceased: u32 = 10_000;
}

/// 函数级中文注释：逝者访问适配器，实现 `DeceasedAccess`，以 `pallet-deceased` 为后端。
pub struct DeceasedProviderAdapter;

// 🗑️ 2025-11-16: 已删除 DeceasedTokenProviderAdapter for pallet-stardust-grave
/*
/// 函数级中文注释：Deceased token 适配器，将 `pallet-deceased` 的 `deceased_token` 转换为 `BoundedVec<u8, GraveMaxCidLen>`。
pub struct DeceasedTokenProviderAdapter;
impl pallet_stardust_grave::pallet::DeceasedTokenAccess<GraveMaxCidLen>
    for DeceasedTokenProviderAdapter
{
    fn token_of(id: u64) -> Option<frame_support::BoundedVec<u8, GraveMaxCidLen>> {
        if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(id) {
            let bytes: Vec<u8> = d.deceased_token.to_vec();
            let max = GraveMaxCidLen::get() as usize;
            let mut v = bytes;
            if v.len() > max {
                v.truncate(max);
            }
            frame_support::BoundedVec::<u8, GraveMaxCidLen>::try_from(v).ok()
        } else {
            None
        }
    }
}
*/

// （已移除对 pallet-deceased-data 的适配实现）

// 🆕 2025-10-28 已注释: DeceasedAccess/TokenAccess 实现已移除 - deceased-text/media整合到deceased
/*
// ===== 为新拆分的内容 Pallet 实现相同的适配器（保持低耦合复用） =====
impl pallet_deceased_media::DeceasedAccess<AccountId, u64> for DeceasedProviderAdapter {
    /// 检查逝者是否存在
    fn deceased_exists(id: u64) -> bool {
        pallet_deceased::pallet::DeceasedOf::<Runtime>::contains_key(id)
    }
    /// 检查操作者是否可管理该逝者
    fn can_manage(who: &AccountId, deceased_id: u64) -> bool {
        if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(deceased_id) {
            d.owner == *who
        } else {
            false
        }
    }
}
impl pallet_deceased_media::DeceasedTokenAccess<GraveMaxCidLen, u64>
    for DeceasedTokenProviderAdapter
{
    fn token_of(id: u64) -> Option<frame_support::BoundedVec<u8, GraveMaxCidLen>> {
        if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(id) {
            let mut v = d.deceased_token.to_vec();
            let max = GraveMaxCidLen::get() as usize;
            if v.len() > max {
                v.truncate(max);
            }
            frame_support::BoundedVec::<u8, GraveMaxCidLen>::try_from(v).ok()
        } else {
            None
        }
    }
}

impl pallet_deceased_text::DeceasedAccess<AccountId, u64> for DeceasedProviderAdapter {
    fn deceased_exists(id: u64) -> bool {
        pallet_deceased::pallet::DeceasedOf::<Runtime>::contains_key(id)
    }
    fn can_manage(who: &AccountId, deceased_id: u64) -> bool {
        if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(deceased_id) {
            d.owner == *who
        } else {
            false
        }
    }
}
impl pallet_deceased_text::DeceasedTokenAccess<GraveMaxCidLen, u64>
    for DeceasedTokenProviderAdapter
{
    fn token_of(id: u64) -> Option<frame_support::BoundedVec<u8, GraveMaxCidLen>> {
        if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(id) {
            let mut v = d.deceased_token.to_vec();
            let max = GraveMaxCidLen::get() as usize;
            if v.len() > max {
                v.truncate(max);
            }
            frame_support::BoundedVec::<u8, GraveMaxCidLen>::try_from(v).ok()
        } else {
            None
        }
    }
}
*/

// （已移除 pallet-deceased-data 的 Config 实现）

// ===== 🆕 2025-10-28: deceased-media 配置已移除 - 整合到 pallet-deceased =====
// parameter_types! {
//     pub const MediaMaxAlbumsPerDeceased: u32 = 64;
//     pub const MediaMaxVideoCollectionsPerDeceased: u32 = 64;
//     pub const MediaMaxPhotosPerAlbum: u32 = 256;
//     pub const MediaStringLimit: u32 = 512;
//     pub const MediaMaxTags: u32 = 16;
//     pub const MediaMaxReorderBatch: u32 = 100;
// }
/*  // 2025-10-28 已移除 - 整合到 pallet-deceased
impl pallet_deceased_media::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type DeceasedId = u64;
    type AlbumId = u64;
    type VideoCollectionId = u64;
    type MediaId = u64;
    type MaxAlbumsPerDeceased = MediaMaxAlbumsPerDeceased;
    type MaxVideoCollectionsPerDeceased = MediaMaxVideoCollectionsPerDeceased;
    type MaxPhotoPerAlbum = MediaMaxPhotosPerAlbum;
    type StringLimit = MediaStringLimit;
    type MaxTags = MediaMaxTags;
    type MaxReorderBatch = MediaMaxReorderBatch;
    type MaxTokenLen = ConstU32<64>;  // GraveMaxCidLen
    type DeceasedProvider = DeceasedProviderAdapter;
    type DeceasedTokenProvider = DeceasedTokenProviderAdapter;
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    type Currency = Balances;
    type AlbumDeposit = MediaAlbumDeposit;
    type VideoCollectionDeposit = MediaAlbumDeposit;
    type MediaDeposit = DataMediaDeposit;
    type CreateFee = MediaCreateFee;
    type FeeCollector = TreasuryAccount;
    type ComplaintDeposit = DataMediaDeposit;
    type ArbitrationAccount = TreasuryAccount;
    type ComplaintPeriod = MediaComplaintPeriod;
    // ============= IPFS自动Pin配置 =============
    /// 函数级中文注释：使用MemoIpfs提供实际的自动pin功能
    type IpfsPinner = StardustIpfs;
    type Balance = Balance;
    type DefaultStoragePrice = ConstU128<{ 1 * crate::UNIT }>;
}
*/

// ===== 🆕 2025-10-28: deceased-text 配置已移除 - 整合到 pallet-deceased =====
// parameter_types! {}
/*  // 2025-10-28 已移除 - 整合到 pallet-deceased
impl pallet_deceased_text::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type DeceasedId = u64;
    type TextId = u64;
    type StringLimit = DataStringLimit;
    type MaxTokenLen = ConstU32<64>;  // GraveMaxCidLen
    type MaxMessagesPerDeceased = DataMaxMessagesPerDeceased;
    type MaxEulogiesPerDeceased = DataMaxEulogiesPerDeceased;
    type DeceasedProvider = DeceasedProviderAdapter;
    type DeceasedTokenProvider = DeceasedTokenProviderAdapter;
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance1, 2, 3>,
    >;
    type Currency = Balances;
    type TextDeposit = DataMediaDeposit;
    type ComplaintDeposit = DataMediaDeposit;
    type ArbitrationAccount = TreasuryAccount;
    type ComplaintPeriod = MediaComplaintPeriod;
    // ============= IPFS自动Pin配置 =============
    /// 函数级中文注释：使用MemoIpfs提供实际的自动pin功能
    type IpfsPinner = StardustIpfs;
    type Balance = Balance;
    type DefaultStoragePrice = ConstU128<{ 1 * crate::UNIT }>;
}
*/

// ========= OriginRestriction 过滤器与配置 =========
/// 函数级中文注释：基础调用过滤器；当前读取 origin-restriction 的全局开关（allow_all=true 放行全部）。
pub struct OriginRestrictionFilter;
impl Contains<RuntimeCall> for OriginRestrictionFilter {
    fn contains(_c: &RuntimeCall) -> bool {
        // allow=true → 放行；false → 暂时仍放行（占位，后续细化），避免破坏性变更
        let allow = pallet_origin_restriction::GlobalAllow::<Runtime>::get();
        let _ = allow;
        true
    }
}

impl pallet_origin_restriction::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    /// 函数级中文注释：治理起源采用 Root | 委员会阈值(2/3) 双通道。
    type AdminOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance1, 2, 3>,
    >;
}

// 方案B：移除单点治理账户（内容治理签名账户）

// ===== ledger 配置（精简） =====
impl pallet_ledger::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type GraveId = u64;
    type Balance = Balance;
    /// 一周按 6s/块 × 60 × 60 × 24 × 7 = 100_800 块（可由治理升级调整）
    type BlocksPerWeek = frame_support::traits::ConstU32<100_800>;
    /// 函数级中文注释：绑定 ledger 手写占位权重（后续可替换为基准生成版）。
    type WeightInfo = pallet_ledger::weights::SubstrateWeight<Runtime>;
}

parameter_types! {
    // Sacrifice（祭祀品目录）参数
    pub const MemorialStringLimit: u32 = 64;
    pub const MemorialUriLimit: u32 = 128;
    pub const MemorialDescLimit: u32 = 256;

    // Offerings（供奉业务）参数
    pub const MemorialMaxCidLen: u32 = 64;
    pub const MemorialMaxNameLen: u32 = 64;
    pub const MemorialMaxOfferingsPerTarget: u32 = 10_000;
    pub const MemorialMaxMediaPerOffering: u32 = 8;
    pub const MemorialOfferWindow: BlockNumber = 600;           // 限频窗口：600块（约1小时）
    pub const MemorialOfferMaxInWindow: u32 = 100;              // 窗口内最多供奉100次
    pub const MemorialMinOfferAmount: Balance = 1_000_000_000;  // 最低供奉金额：0.001 DUST

    // P3新增：续费检查频率配置
    /// 函数级中文注释：续费检查频率（多少块检查一次）
    /// - 默认值：100（约10分钟）
    /// - 可通过治理调整以适应链上负载
    pub const MemorialRenewalCheckInterval: u32 = 100;

    // P0修复：供奉平台账户配置
    /// 函数级中文注释：Memorial平台托管账户PalletId
    /// - 用于接收供奉品交易的平台分成
    /// - 示例：b"memoripl" = Memorial Platform
    pub const MemorialPalletId: frame_support::PalletId = frame_support::PalletId(*b"memoripl");
}

/// 函数级中文注释：Memorial会员信息提供者适配器
pub struct MemorialMembershipProvider;
impl pallet_memorial::MembershipProvider<AccountId> for MemorialMembershipProvider {
    fn is_valid_member(who: &AccountId) -> bool {
        pallet_membership::Pallet::<Runtime>::is_member_valid(who)
    }

    fn get_discount() -> u8 {
        30  // VIP折扣：30%（用户支付70%）
    }
}

/// 函数级详细中文注释：Deceased 目标适配器（通用供奉系统 - P0）
///
/// ## 功能说明
/// - 实现 OfferingTarget trait，支持直接向逝者供奉
/// - 解耦供奉系统与 grave pallet 的强依赖
/// - 从 pallet-deceased 读取逝者信息
///
/// ## 权限逻辑
/// - 公开逝者：所有人可供奉
/// - 私人逝者：仅家属和授权用户可供奉
///
/// ## 设计理念
/// - 逝者是供奉的真正目标（而非墓位）
/// - 墓位只是物理位置，不应成为供奉的必要条件
/// - 支持无墓位逝者（如失踪人员、虚拟纪念）
pub struct DeceasedTargetAdapter;

impl pallet_memorial::OfferingTarget<AccountId> for DeceasedTargetAdapter {
    /// 检查逝者是否存在
    fn exists(target_id: u64) -> bool {
        pallet_deceased::pallet::DeceasedOf::<Runtime>::contains_key(target_id)
    }

    /// 获取逝者所有者（用于分账）
    fn get_owner(target_id: u64) -> Option<AccountId> {
        pallet_deceased::pallet::DeceasedOf::<Runtime>::get(target_id).map(|d| d.owner)
    }

    /// 检查用户是否可访问该逝者（供奉权限判定）
    fn is_accessible(who: &AccountId, target_id: u64) -> bool {
        if let Some(deceased) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(target_id) {
            // 如果是所有者，直接允许
            if deceased.owner == *who {
                return true;
            }

            // TODO: 检查可见性和亲友关系
            // 当前简化版本：公开逝者所有人可访问
            // 未来扩展：根据 deceased.visibility 和 FriendsOf 判断
            true
        } else {
            false
        }
    }

    /// 获取逝者显示名称
    fn get_display_name(target_id: u64) -> Option<frame_support::BoundedVec<u8, frame_support::traits::ConstU32<256>>> {
        use frame_support::BoundedVec;

        pallet_deceased::pallet::DeceasedOf::<Runtime>::get(target_id).and_then(|d| {
            // 从 deceased.name 转换为 BoundedVec<u8, ConstU32<256>>
            let name_vec: Vec<u8> = d.name.into_inner();
            BoundedVec::try_from(name_vec).ok()
        })
    }
}

/// 函数级详细中文注释：Pet 目标适配器（通用供奉系统 - P0）
///
/// ## 功能说明
/// - 实现 OfferingTarget trait，支持直接向宠物供奉
/// - 宠物纪念是独立的供奉目标类型
/// - 从 pallet-stardust-pet 读取宠物信息
///
/// ## 权限逻辑
/// - 公开宠物：所有人可供奉
/// - 私人宠物：仅所有者可供奉
///
/// ## 设计理念
/// - 宠物与人类逝者具有同等纪念价值
/// - 独立的宠物管理系统，不依赖人类逝者架构
/// - 支持宠物主人为爱宠建立纪念空间
pub struct PetTargetAdapter;

impl pallet_memorial::OfferingTarget<AccountId> for PetTargetAdapter {
    /// 检查宠物是否存在
    fn exists(target_id: u64) -> bool {
        pallet_stardust_pet::pallet::PetOf::<Runtime>::contains_key(target_id)
    }

    /// 获取宠物所有者（用于分账）
    fn get_owner(target_id: u64) -> Option<AccountId> {
        pallet_stardust_pet::pallet::PetOf::<Runtime>::get(target_id).map(|p| p.owner)
    }

    /// 检查用户是否可访问该宠物（供奉权限判定）
    fn is_accessible(who: &AccountId, target_id: u64) -> bool {
        if let Some(pet) = pallet_stardust_pet::pallet::PetOf::<Runtime>::get(target_id) {
            // 如果是所有者，直接允许
            if pet.owner == *who {
                return true;
            }

            // TODO: 检查可见性设置
            // 当前简化版本：所有宠物都公开可访问
            // 未来扩展：根据 pet.visibility 判断
            true
        } else {
            false
        }
    }

    /// 获取宠物显示名称
    fn get_display_name(target_id: u64) -> Option<frame_support::BoundedVec<u8, frame_support::traits::ConstU32<256>>> {
        use frame_support::BoundedVec;

        pallet_stardust_pet::pallet::PetOf::<Runtime>::get(target_id).and_then(|p| {
            // 从 pet.name 转换为 BoundedVec<u8, ConstU32<256>>
            let name_vec: Vec<u8> = p.name.into_inner();
            BoundedVec::try_from(name_vec).ok()
        })
    }
}

/// 函数级详细中文注释：Memorial供奉回调实现（集成affiliate分账）
///
/// ### 核心功能：Affiliate分账处理
/// - 触发affiliate联盟分账系统
/// - 支持15层推荐链分账
/// - 100%资金进入推荐链分账
/// - 统一购买和续费的分账逻辑
///
/// ### 接口说明
/// - 接口从 `on_offering(target: (u8, u64), kind_code, ...)` 改为 `on_offering(grave_id: u64, sacrifice_id, ...)`
/// - 移除 domain 概念，仅支持墓地
/// - 参数 kind_code 改为 sacrifice_id
pub struct MemorialOfferingHook;
impl pallet_memorial::OnOfferingCommitted<AccountId> for MemorialOfferingHook {
    fn on_offering(
        _grave_id: u64,
        _sacrifice_id: u64,
        who: &AccountId,
        amount: u128,
        duration_weeks: Option<u32>,
    ) {
        // ===== Affiliate分账处理 =====

        // 调用affiliate分账系统进行联盟奖励分配
        // 这确保了购买和续费都走相同的分账逻辑
        let _ = pallet_affiliate::Pallet::<Runtime>::do_distribute_rewards(
            who,
            amount,  // amount 已经是 Balance (u128) 类型
            duration_weeks,
        );

        // 🎯 完成统一分账：
        // 1. Affiliate分账系统执行15层推荐链分账（100%资金）
        // 2. 不再有墓地所有者和平台直接分成
        // 3. 保证购买和续费使用完全相同的分账机制
    }
}

impl pallet_memorial::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;

    // === 基础配置 ===
    type StringLimit = MemorialStringLimit;
    type UriLimit = MemorialUriLimit;
    type DescriptionLimit = MemorialDescLimit;

    // === 供奉业务配置 ===
    type MaxCidLen = MemorialMaxCidLen;
    type MaxOfferingsPerTarget = MemorialMaxOfferingsPerTarget;
    type MaxMediaPerOffering = MemorialMaxMediaPerOffering;
    type OfferWindow = MemorialOfferWindow;
    type OfferMaxInWindow = MemorialOfferMaxInWindow;
    type MinOfferAmount = MemorialMinOfferAmount;

    // P3新增：续费检查频率配置
    type RenewalCheckInterval = MemorialRenewalCheckInterval;

    // === Trait 接口 ===
    type MembershipProvider = MemorialMembershipProvider;
    type OnOfferingCommitted = MemorialOfferingHook;

    // === P0修复：资金管理配置 ===
    /// 函数级中文注释：平台托管账户PalletId
    type PalletId = MemorialPalletId;

    // === 管理员权限 ===
    /// 函数级中文注释：管理员 Origin：Root | 内容委员会(Instance3，2/3)
    type AdminOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
}

// ===== Treasury 配置 =====
parameter_types! {
    pub const TreasuryPalletId: frame_support::PalletId = frame_support::PalletId(*b"py/trsry");
    pub const TreasurySpendPeriod: BlockNumber = 7 * DAYS;
    pub const TreasuryPayoutPeriod: BlockNumber = 7 * DAYS;
    pub const TreasuryBurn: sp_runtime::Permill = sp_runtime::Permill::from_percent(0);
    pub const TreasuryMaxApprovals: u32 = 100;
    /// 函数级详细中文注释：委员会托管账户 PalletId
    /// - 用于接收供奉品审核罚没资金（拒绝或撤回时罚没5%押金）
    /// - PalletId = "py/cmmte" 派生稳定的链上账户地址
    pub const CommitteePalletId: frame_support::PalletId = frame_support::PalletId(*b"py/cmmte");
}

pub struct NativePaymaster;
#[cfg(not(feature = "runtime-benchmarks"))]
impl frame_support::traits::tokens::Pay for NativePaymaster {
    type Balance = Balance;
    type AssetKind = (); // 仅原生
    type Beneficiary = AccountId;
    type Id = ();
    type Error = sp_runtime::DispatchError;
    fn pay(
        who: &Self::Beneficiary,
        _asset_kind: Self::AssetKind,
        amount: Self::Balance,
    ) -> Result<Self::Id, Self::Error> {
        <Balances as frame_support::traits::fungible::Mutate<AccountId>>::transfer(
            &PlatformAccount::get(),
            who,
            amount,
            frame_support::traits::tokens::Preservation::Expendable,
        )?;
        Ok(())
    }
    fn check_payment(_: Self::Id) -> frame_support::traits::tokens::PaymentStatus {
        frame_support::traits::tokens::PaymentStatus::Success
    }
}
#[cfg(feature = "runtime-benchmarks")]
impl frame_support::traits::tokens::Pay for NativePaymaster {
    type Balance = Balance;
    type AssetKind = (); // 仅原生
    type Beneficiary = AccountId;
    type Id = ();
    type Error = sp_runtime::DispatchError;
    fn pay(
        who: &Self::Beneficiary,
        _asset_kind: Self::AssetKind,
        amount: Self::Balance,
    ) -> Result<Self::Id, Self::Error> {
        <Balances as frame_support::traits::fungible::Mutate<AccountId>>::transfer(
            &PlatformAccount::get(),
            who,
            amount,
            frame_support::traits::tokens::Preservation::Expendable,
        )?;
        Ok(())
    }
    fn check_payment(_: Self::Id) -> frame_support::traits::tokens::PaymentStatus {
        frame_support::traits::tokens::PaymentStatus::Success
    }
    fn ensure_successful(_: &Self::Beneficiary, _: Self::AssetKind, _: Self::Balance) {}
    fn ensure_concluded(_: Self::Id) {}
}

pub struct UnitBalanceConverter;
#[cfg(not(feature = "runtime-benchmarks"))]
impl frame_support::traits::tokens::ConversionFromAssetBalance<Balance, (), Balance>
    for UnitBalanceConverter
{
    type Error = sp_runtime::DispatchError;
    fn from_asset_balance(amount: Balance, _asset: ()) -> Result<Balance, Self::Error> {
        Ok(amount)
    }
}
#[cfg(feature = "runtime-benchmarks")]
impl frame_support::traits::tokens::ConversionFromAssetBalance<Balance, (), Balance>
    for UnitBalanceConverter
{
    type Error = sp_runtime::DispatchError;
    fn from_asset_balance(amount: Balance, _asset: ()) -> Result<Balance, Self::Error> {
        Ok(amount)
    }
    fn ensure_successful(_: ()) {}
}

impl pallet_treasury::Config for Runtime {
    type Currency = Balances;
    type RejectOrigin = frame_system::EnsureRoot<AccountId>;
    type SpendPeriod = TreasurySpendPeriod;
    type Burn = TreasuryBurn;
    type PalletId = TreasuryPalletId;
    type BurnDestination = (); // 丢弃
    type WeightInfo = pallet_treasury::weights::SubstrateWeight<Runtime>;
    type SpendFunds = ();
    type MaxApprovals = TreasuryMaxApprovals;
    type SpendOrigin =
        frame_system::EnsureRootWithSuccess<AccountId, ConstU128<1_000_000_000_000_000_000>>; // Root 最多可一次性支出 1e18 单位
    type AssetKind = ();
    type Beneficiary = AccountId;
    type BeneficiaryLookup = IdentityLookup<AccountId>;
    type RuntimeEvent = RuntimeEvent;
    type Paymaster = NativePaymaster;
    type BalanceConverter = UnitBalanceConverter;
    type PayoutPeriod = TreasuryPayoutPeriod;
    type BlockNumberProvider = frame_system::Pallet<Runtime>;
}

/// 函数级中文注释：国库账户解析器——由 Treasury PalletId 派生稳定账户地址。
pub struct TreasuryAccount;
impl sp_core::Get<AccountId> for TreasuryAccount {
    fn get() -> AccountId {
        TreasuryPalletId::get().into_account_truncating()
    }
}

/// 函数级详细中文注释：委员会账户解析器——由 Committee PalletId 派生稳定账户地址。
/// - 用于接收供奉品审核罚没资金
/// - 当用户提交的供奉品被拒绝或撤回时，5%的押金将罚没至此账户
/// - 委员会可通过治理提案使用这些资金，用于激励审核工作或其他委员会运营
pub struct CommitteeAccount;
impl sp_core::Get<AccountId> for CommitteeAccount {
    fn get() -> AccountId {
        CommitteePalletId::get().into_account_truncating()
    }
}
// ===== pricing 配置 =====
// 函数级中文注释：汇率更新间隔（区块数）
// 14400 个区块 ≈ 24小时（假设6秒出块）
parameter_types! {
    pub const ExchangeRateUpdateInterval: u32 = 14400;
}

// 函数级中文注释：OCW 使用 offchain local storage 存储汇率
// 不需要 SendTransactionTypes，因为不提交 unsigned 交易
// 汇率通过 get_cny_usdt_rate() 提供默认值 (7.2)

impl pallet_pricing::pallet::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    /// 最大价格偏离：2000 bps = 20%
    /// 订单价格与基准价格的偏离不得超过 ±20%
    /// 例如：基准价 1.0 USDT/DUST，允许范围 0.8 ~ 1.2 USDT/DUST
    type MaxPriceDeviation = ConstU16<2000>;
    /// 汇率更新间隔：14400 个区块 ≈ 24小时
    type ExchangeRateUpdateInterval = ExchangeRateUpdateInterval;
}

// ====== 适配器实现（临时占位：允许 Root/无操作）======
// 修正命名：由旧 crate 前缀 memorial 切换为 memo，保证与 `pallets/memo-park` 对应
impl pallet_stardust_park::pallet::ParkAdminOrigin<RuntimeOrigin> for RootOnlyParkAdmin {
    /// 函数级中文注释：管理员校验：允许 Root 或委员会阈值(2/3)。
    fn ensure(_park_id: u64, origin: RuntimeOrigin) -> frame_support::dispatch::DispatchResult {
        if frame_system::EnsureRoot::<AccountId>::try_origin(origin.clone()).is_ok() {
            return Ok(());
        }
        pallet_collective::EnsureProportionAtLeast::<AccountId, pallet_collective::Instance1, 2, 3>::try_origin(origin)
            .map(|_| ())
            .map_err(|_| sp_runtime::DispatchError::BadOrigin)
    }
}

// 🗑️ 2025-11-16: 已删除 ParkAdminOrigin for pallet-stardust-grave
/*
impl pallet_stardust_grave::pallet::ParkAdminOrigin<RuntimeOrigin> for RootOnlyParkAdmin {
    /// 函数级中文注释：管理员校验：允许 Root 或委员会阈值(2/3)。
    fn ensure(_park_id: u64, origin: RuntimeOrigin) -> frame_support::dispatch::DispatchResult {
        if frame_system::EnsureRoot::<AccountId>::try_origin(origin.clone()).is_ok() {
            return Ok(());
        }
        pallet_collective::EnsureProportionAtLeast::<AccountId, pallet_collective::Instance1, 2, 3>::try_origin(origin)
            .map(|_| ())
            .map_err(|_| sp_runtime::DispatchError::BadOrigin)
    }
}

impl pallet_stardust_grave::pallet::OnIntermentCommitted for NoopIntermentHook {
    /// 函数级中文注释：安葬回调空实现，占位方便后续接入统计/KPI。
    fn on_interment(_grave_id: u64, _deceased_id: u64) {}
}
*/

parameter_types! {
    pub const EvidenceMaxCidLen: u32 = 64;
    pub const EvidenceMaxImg: u32 = 20;
    pub const EvidenceMaxVid: u32 = 5;
    pub const EvidenceMaxDoc: u32 = 5;
    pub const EvidenceMaxMemoLen: u32 = 64;
    pub const EvidenceNsBytes: [u8; 8] = *b"evid___ ";
}
pub struct AllowAllEvidenceAuthorizer;
impl pallet_evidence::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxCidLen = EvidenceMaxCidLen;
    type MaxImg = EvidenceMaxImg;
    type MaxVid = EvidenceMaxVid;
    type MaxDoc = EvidenceMaxDoc;
    type MaxMemoLen = EvidenceMaxMemoLen;
    type EvidenceNsBytes = EvidenceNsBytes;
    // 🆕 2025-10-28：新增统一内容CID和加密方案长度配置
    type MaxContentCidLen = frame_support::traits::ConstU32<64>;  // 内容CID最大长度
    type MaxSchemeLen = frame_support::traits::ConstU32<32>;      // 加密方案名称最大长度
    // 无授权中心：占位实现，默认允许
    type Authorizer = AllowAllEvidenceAuthorizer;
    /// 函数级中文注释：每主体证据与账号限频的示例默认值。
    type MaxPerSubjectTarget = frame_support::traits::ConstU32<10_000>;
    type MaxPerSubjectNs = frame_support::traits::ConstU32<10_000>;
    type WindowBlocks = frame_support::traits::ConstU32<600>;
    type MaxPerWindow = frame_support::traits::ConstU32<100>;
    type EnableGlobalCidDedup = frame_support::traits::ConstBool<false>;
    type MaxListLen = frame_support::traits::ConstU32<512>;
    /// 函数级中文注释：绑定权重实现，当前为手写估算版；后续可替换为基准生成版
    type WeightInfo = pallet_evidence::weights::SubstrateWeight<Runtime>;
    /// 函数级中文注释：家庭关系校验适配器（占位实现）。
    type FamilyVerifier = FamilyVerifierAdapter;
    /// 函数级中文注释：授权用户与密钥长度上限（与前端 RSA-2048/SPKI 长度匹配）。
    type MaxAuthorizedUsers = frame_support::traits::ConstU32<64>;
    type MaxKeyLen = frame_support::traits::ConstU32<4096>;
    // ============= IPFS自动Pin配置 =============
    /// 函数级中文注释：使用MemoIpfs提供实际的自动pin功能
    type IpfsPinner = StardustIpfs;
    type Balance = Balance;
    type DefaultStoragePrice = ConstU128<{ 1 * crate::UNIT }>;
}
impl pallet_evidence::pallet::EvidenceAuthorizer<AccountId> for AllowAllEvidenceAuthorizer {
    fn is_authorized(_ns: [u8; 8], _who: &AccountId) -> bool {
        true
    }
}

/// 函数级中文注释：家庭关系验证适配器（占位实现）。
/// - 当前始终返回 false；后续可根据 `pallet-stardust-grave` 的成员/亲属关系完善。
pub struct FamilyVerifierAdapter;
impl pallet_evidence::pallet::FamilyRelationVerifier<AccountId> for FamilyVerifierAdapter {
    fn is_family_member(_user: &AccountId, _deceased_id: u64) -> bool { false }
    fn is_authorized_for_deceased(_user: &AccountId, _deceased_id: u64) -> bool { false }
}

// 已移除：pallet-order 参数与 Config

// 已移除：Karma 适配器实现

// 托管 PalletId 与平台账户占位（示例）
parameter_types! {
    // PalletId 仅支持 8 字节，固定使用前 8 字节常量
    pub const ConstPalletId: frame_support::PalletId = frame_support::PalletId(*b"otc/orde");
}
pub struct PlatformAccount;
impl sp_core::Get<AccountId> for PlatformAccount {
    fn get() -> AccountId {
        sp_core::crypto::AccountId32::new([0u8; 32]).into()
    }
}

/// 函数级详细中文注释：语义化黑洞账户（dead = 已销毁）
/// 
/// 设计原理：
/// - 使用后4位为 0x0000dead 的地址，前28位为0
/// - "dead" 在加密货币社区表示"死亡/销毁"，语义清晰直观
/// - 符合以太坊生态惯例（如 0x000...dead），便于跨生态用户理解
/// - 无人掌握该地址的私钥，因此资金只进不出，等价于永久销毁
/// 
/// 地址表示：
/// - 十六进制: 0x0000000000000000000000000000000000000000000000000000000000000dead
/// - 二进制后4字节: 0x00 0x00 0xde 0xad
/// - "dead" 的十进制值: 57005
/// - SS58 (Format=42): 需要实际计算（使用 encodeAddress）
/// 
/// 语义优势：
/// - ✅ 一眼识别：看到 "dead" 立即理解是销毁地址
/// - ✅ 记忆简单：比全0地址更容易记住
/// - ✅ 跨生态兼容：与 EVM 生态惯例一致
/// - ✅ 专业形象：展示对行业惯例的理解
/// 
/// 安全性保证：
/// - ✅ 无私钥：理论上不可能生成对应的私钥（SHA256 碰撞难度 2^256）
/// - ✅ 只进不出：可以接收代币，但永远无法签名交易转出
/// - ✅ 完全透明：链上任何人可查询该账户余额，验证累计销毁量
/// - ✅ 安全性等同：与全0地址安全性完全相同
/// 
/// 审计方式：
/// ```javascript
/// // 方法1: 通过地址生成
/// const { encodeAddress } = require('@polkadot/keyring');
/// const bytes = new Uint8Array(32);
/// bytes[28] = 0x00; bytes[29] = 0x00; bytes[30] = 0xde; bytes[31] = 0xad;
/// const burnAddress = encodeAddress(bytes, 42);
/// const accountInfo = await api.query.system.account(burnAddress);
/// console.log('累计销毁:', accountInfo.data.free.toString(), 'DUST');
/// 
/// // 方法2: 直接查询（地址需要先计算）
/// const burnAddress = 'CALCULATED_ADDRESS'; // 从链端获取
/// const accountInfo = await api.query.system.account(burnAddress);
/// ```
/// 
/// 行业对比：
/// - 以太坊: 0x000...dead（广泛使用）
/// - Moonbeam: 0x000...dead（EVM 兼容链）
/// - Stardust: 0x000...0dead ✅（兼顾 Substrate 与 EVM 惯例）
/// 
/// 使用场景：
/// - 供奉分账中的销毁部分（3%）
/// - 其他需要永久锁定代币的场景
/// - 通缩机制的核心实现
pub struct BurnAccount;
impl sp_core::Get<AccountId> for BurnAccount {
    /// 函数级详细中文注释：返回后4位为 0x0000dead 的黑洞账户
    /// - 前28字节：全0（0x00）
    /// - 后4字节：0x00 0x00 0xde 0xad（"dead"）
    fn get() -> AccountId {
        let mut bytes = [0u8; 32];
        // 后4字节设为 0x0000dead
        bytes[28..32].copy_from_slice(&[0x00, 0x00, 0xde, 0xad]);
        sp_core::crypto::AccountId32::new(bytes).into()
    }
}

// ===== escrow/arbitration 配置 =====

// ===== 新 OTC 三件套参数（占位，可按需调整） =====
parameter_types! {
    pub const OtcMaxCidLen: u32 = 64;
}
// 函数级中文注释：移除 pallet_otc_maker 配置
// - 功能已被 pallet-market-maker 完全替代
// - 没有实际使用，避免冗余

// ===== market-maker 配置 =====
parameter_types! {
    /// 函数级中文注释：做市商最小押金（示例：1000 DUST）
    pub const MarketMakerMinDeposit: Balance = 1_000_000_000_000_000; // 1000 UNIT
    /// 函数级中文注释：资料提交窗口（24 小时 = 86400 秒）
    pub const MarketMakerInfoWindow: u32 = 86_400;
    /// 函数级中文注释：审核窗口（7 天 = 604800 秒）
    pub const MarketMakerReviewWindow: u32 = 604_800;
    /// 函数级中文注释：驳回最大扣罚比例（10000 bps = 100%）
    pub const MarketMakerRejectSlashBpsMax: u16 = 10_000;
    /// 函数级中文注释：最大交易对数量（预留）
    pub const MarketMakerMaxPairs: u32 = 10;
    /// 函数级中文注释：做市商 Pallet ID
    pub const MarketMakerPalletId: frame_support::PalletId = frame_support::PalletId(*b"mm/pool!");
}

/// 🆕 2025-10-23：做市商审核员列表（方案A - Phase 2）
/// 
/// # 设计说明
/// - 审核员在做市商提交申请时自动收到通知（通过pallet-chat）
/// - 审核员可以查看私密资料（private_cid）并联系做市商
/// - 初始化为空列表，由治理后续添加专业审核员账户
/// 
/// # 配置方法（链启动后通过治理添加）
/// 1. 运营者提交治理提案
/// 2. 委员会投票通过
/// 3. Root或委员会2/3多数执行 setStorage 添加审核员账户
pub struct MarketMakerReviewerAccounts;
impl sp_core::Get<Vec<AccountId>> for MarketMakerReviewerAccounts {
    fn get() -> Vec<AccountId> {
        // 初始化为空列表，由治理后续添加
        // 示例格式（后续通过治理添加）：
        // vec![
        //     hex_literal::hex!("审核员1的SS58地址...").into(),
        //     hex_literal::hex!("审核员2的SS58地址...").into(),
        // ]
        Vec::new()
    }
}

// 🗑️ 2025-10-29：pallet-market-maker 已整合到 pallet-trading，配置已删除


// ===== KYC 适配器（基于 pallet-identity 的 judgement） =====
// 函数级中文注释：KYC 适配器已移除
// - pallet-otc-maker 已废弃
// - pallet-memo-hall 未被 runtime 使用
// - pallet-stardust-grave 定义了 KycProvider 但未实际使用
// - 如果未来需要 KYC，可以在此重新实现

// ===== identity 配置与参数 =====
parameter_types! {
    /// 基础身份信息押金（u128）。可按需调整为更高值以抑制状态膨胀。
    pub const IdentityBasicDeposit: u128 = 1_000_000_000; // 约等于 0.001 UNIT（示例）
    /// 按字节计费押金（u128），用于限制过大信息体。
    pub const IdentityByteDeposit: u128 = 10_000; // 每字节押金（示例）
    /// 用户名登记押金（u128）。
    pub const IdentityUsernameDeposit: u128 = 1_000_000_000; // 示例
    /// 子账号押金（u128）。
    pub const IdentitySubAccountDeposit: u128 = 1_000_000_000; // 示例
    /// 最多子账号数。
    pub const IdentityMaxSubAccounts: u32 = 100;
    /// 最多注册机构数。
    pub const IdentityMaxRegistrars: u32 = 20;
    /// 用户名待接受过期时间（区块）。例如 1 天：6 秒/块 → 14_400 块。
    pub const IdentityPendingUsernameExpiration: u32 = 14_400;
    /// 用户名解绑宽限期（区块）。例如 30 天。
    pub const IdentityUsernameGracePeriod: u32 = 432_000;
    /// 用户名后缀最大长度。
    pub const IdentityMaxSuffixLength: u32 = 16;
    /// 用户名总长度（含后缀与分隔符）最大值。
    pub const IdentityMaxUsernameLength: u32 = 32;
}

impl pallet_identity::Config for Runtime {
    /// 事件类型
    type RuntimeEvent = RuntimeEvent;
    /// 货币实现（需支持可保留押金）
    type Currency = Balances;
    /// 押金参数
    type BasicDeposit = IdentityBasicDeposit;
    type ByteDeposit = IdentityByteDeposit;
    type UsernameDeposit = IdentityUsernameDeposit;
    type SubAccountDeposit = IdentitySubAccountDeposit;
    /// 规模参数
    type MaxSubAccounts = IdentityMaxSubAccounts;
    type MaxRegistrars = IdentityMaxRegistrars;
    /// 身份信息类型（采用官方 legacy 结构，字段上限 64）
    type IdentityInformation =
        pallet_identity::legacy::IdentityInfo<frame_support::traits::ConstU32<64>>;
    /// 被罚没资金处理（占位：丢弃）
    type Slashed = ();
    /// Root 权限用于强制操作/登记管理员
    type ForceOrigin = frame_system::EnsureRoot<AccountId>;
    type RegistrarOrigin = frame_system::EnsureRoot<AccountId>;
    /// 离线签名/公钥类型（多签通用）
    type OffchainSignature = sp_runtime::MultiSignature;
    type SigningPublicKey = sp_runtime::MultiSigner;
    /// 用户名权限与时限
    type UsernameAuthorityOrigin = frame_system::EnsureRoot<AccountId>;
    type PendingUsernameExpiration = IdentityPendingUsernameExpiration;
    type UsernameGracePeriod = IdentityUsernameGracePeriod;
    type MaxSuffixLength = IdentityMaxSuffixLength;
    type MaxUsernameLength = IdentityMaxUsernameLength;
    /// 基准权重
    type WeightInfo = pallet_identity::weights::SubstrateWeight<Runtime>;
    // 新版 pallet-identity 已不需要 BenchmarkHelper 关联类型
}

// ===== stardust-pet 配置（最小实现） =====
parameter_types! { pub const PetStringLimit: u32 = 64; }
impl pallet_stardust_pet::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type StringLimit = PetStringLimit;
}
// 函数级中文注释：2025-10-20 已删除 pallet-otc-listing 配置
// 原因：OTC订单重构已完成，挂单机制已由直接选择做市商替代
parameter_types! { 
    pub const OtcOrderConfirmTTL: BlockNumber = 2 * DAYS;
    
    // 🆕 首购固定USD价值（10美元，精度10^6）
    pub const FirstPurchaseUsdValue: u128 = 10_000_000; // 10.000000 USD
    
    // 🆕 首购DUST数量安全边界（防止汇率异常）
    pub const MinFirstPurchaseDustAmount: Balance = 100_000_000_000_000_000_000; // 100 DUST
    pub const MaxFirstPurchaseDustAmount: Balance = 10_000_000_000_000_000_000_000; // 10,000 DUST
    
    // 🆕 做市商首购订单配额（最多同时10个）- 2025-11-03 优化（原5个太少）
    pub const MaxFirstPurchaseOrdersPerMaker: u32 = 10;
}

// 🆕 函数级详细中文注释：价格提供者实现（从pallet-pricing获取DUST/USD汇率）
// 🆕 2025-11-03：Pricing Provider 实现（用于 OTC Order 和 Bridge）
// ✅ 2025-11-03：已接入真实的 pallet-pricing，使用加权市场价格
pub struct PricingProviderImpl;

impl PricingProviderImpl {
    /// 函数级中文注释：获取 DUST/USD 汇率（内部实现）
    /// 
    /// ## 价格来源
    /// - 使用 `pallet_pricing::Pallet::<Runtime>::get_dust_market_price_weighted()`
    /// - 这是加权平均价格，综合 OTC 和 Bridge 两个市场的交易数据
    /// - 精度：10^6（即 1,000,000 = 1 USD）
    /// 
    /// ## 冷启动保护
    /// - 如果市场数据不足，pallet-pricing 会返回默认价格（0.000001 USD）
    /// - 当交易量达到阈值后，会使用真实市场价格
    /// 
    /// ## 返回值
    /// - Some(price): 价格（精度 10^6）
    /// - None: 价格为 0 或获取失败（极少发生）
    fn get_price_internal() -> Option<Balance> {
        let price = pallet_pricing::Pallet::<Runtime>::get_dust_market_price_weighted();
        
        // 如果价格为 0，返回 None（表示价格不可用）
        if price == 0 {
            None
        } else {
            Some(price as Balance)
        }
    }
}

// 为 pallet-otc-order 实现 PricingProvider
impl pallet_otc_order::PricingProvider<Balance> for PricingProviderImpl {
    fn get_dust_to_usd_rate() -> Option<Balance> {
        Self::get_price_internal()
    }
}

// 为 pallet-bridge 实现 PricingProvider
impl pallet_bridge::PricingProvider<Balance> for PricingProviderImpl {
    fn get_dust_to_usd_rate() -> Option<Balance> {
        Self::get_price_internal()
    }
}

// 🆕 2025-11-03：临时的 Credit 接口 wrapper（待 pallet-credit 实现完整接口）
pub struct CreditWrapper;
impl pallet_credit::BuyerCreditInterface<AccountId> for CreditWrapper {
    fn get_buyer_credit_score(_buyer: &AccountId) -> Result<u16, sp_runtime::DispatchError> {
        Ok(100)  // 默认满分
    }
    fn check_buyer_daily_limit(_buyer: &AccountId, _amount_usd_cents: u64) -> Result<(), sp_runtime::DispatchError> {
        Ok(())  // 默认通过
    }
    fn check_buyer_single_limit(_buyer: &AccountId, _amount_usd_cents: u64) -> Result<(), sp_runtime::DispatchError> {
        Ok(())  // 默认通过
    }
}

// 🆕 2025-11-10：临时实现 BuyerQuotaInterface（实际使用 pallet-credit 实现）
impl pallet_credit::quota::BuyerQuotaInterface<AccountId> for CreditWrapper {
    fn get_available_quota(_buyer: &AccountId) -> Result<u64, sp_runtime::DispatchError> {
        Ok(200_000_000)  // 默认200 USD额度
    }

    fn occupy_quota(_buyer: &AccountId, _amount_usd: u64) -> sp_runtime::DispatchResult {
        Ok(())  // 默认通过
    }

    fn release_quota(_buyer: &AccountId, _amount_usd: u64) -> sp_runtime::DispatchResult {
        Ok(())  // 默认通过
    }

    fn check_concurrent_limit(_buyer: &AccountId) -> Result<bool, sp_runtime::DispatchError> {
        Ok(true)  // 默认允许
    }

    fn record_order_completed(_buyer: &AccountId, _order_id: u64) -> sp_runtime::DispatchResult {
        Ok(())  // 默认通过
    }

    fn record_order_cancelled(_buyer: &AccountId, _order_id: u64) -> sp_runtime::DispatchResult {
        Ok(())  // 默认通过
    }

    fn record_violation(
        _buyer: &AccountId,
        _violation_type: pallet_credit::quota::ViolationType,
    ) -> sp_runtime::DispatchResult {
        Ok(())  // 默认通过
    }

    fn is_suspended(_buyer: &AccountId) -> Result<bool, sp_runtime::DispatchError> {
        Ok(false)  // 默认不暂停
    }

    fn is_blacklisted(_buyer: &AccountId) -> Result<bool, sp_runtime::DispatchError> {
        Ok(false)  // 默认不拉黑
    }
}


// 函数级中文注释：法币网关授权账户（用于调用首购接口）
// 这是一个特殊的账户，由链下服务控制，用于触发首购交易
pub struct FiatGatewayAccount;
impl Get<AccountId> for FiatGatewayAccount {
    fn get() -> AccountId {
        // 使用固定的公钥派生账户地址
        // 格式：b"fiat_gateway" 的 blake2_256 哈希作为账户ID
        use sp_core::crypto::AccountId32;
        AccountId32::from([
            0x66, 0x69, 0x61, 0x74, 0x5f, 0x67, 0x61, 0x74, 0x65,
            0x77, 0x61, 0x79, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00
        ])
    }
}

// 函数级中文注释：法币网关托管账户（用于存放待分发的DUST）
// 这个账户持有所有待分发给首购用户的DUST代币
pub struct FiatGatewayTreasuryAccount;
impl Get<AccountId> for FiatGatewayTreasuryAccount {
    fn get() -> AccountId {
        // 使用 PalletId 派生子账户
        use sp_runtime::traits::AccountIdConversion;
        frame_support::PalletId(*b"fiat/tsy").into_account_truncating()
    }
}

// 🗑️ 2025-10-29：pallet-otc-order 已整合到 pallet-trading，配置已删除

// ===== 🆕 2025-10-29：Trading Pallet 参数配置 =====
parameter_types! {
    /// Trading pallet账户（用于做市商押金和托管）
    pub const TradingPalletId: frame_support::PalletId = frame_support::PalletId(*b"trdg/plt");

    // 做市商配置 - 2025-11-10 更新：动态押金管理
    /// 做市商押金目标USD价值（1000 USD，精度10^6）
    pub const TargetDepositUsd: u64 = 1_000_000_000;
    /// 押金补充触发阈值（950 USD，精度10^6）
    pub const DepositReplenishThreshold: u64 = 950_000_000;
    /// 押金补充目标（1050 USD，精度10^6）
    pub const DepositReplenishTarget: u64 = 1_050_000_000;
    /// 价格检查间隔（区块数，每小时检查一次）
    pub const PriceCheckInterval: BlockNumber = 600; // 假设6s/block，600块=1小时
    /// 申诉时限（区块数，7天）
    pub const AppealDeadline: BlockNumber = 100800; // 7天 * 24小时 * 600块/小时

    // 传统配置保持兼容
    pub const MakerDepositAmount: Balance = 1_000_000_000_000_000_000; // 1000 DUST (兼容性)
    pub const MakerApplicationTimeout: BlockNumber = 3 * DAYS;
    pub const WithdrawalCooldown: BlockNumber = 5 * DAYS; // 7天→5天 - 2025-11-03 优化

    // OTC订单配置 - 2025-11-10 新增：金额限制
    /// OTC订单最大USD金额（200 USD，精度10^6）
    pub const MaxOrderUsdAmount: u64 = 200_000_000;
    /// OTC订单最小USD金额（20 USD，精度10^6，首购除外）
    pub const MinOrderUsdAmount: u64 = 20_000_000;
    /// 首购订单固定USD金额（10 USD，精度10^6）
    pub const FirstPurchaseUsdAmount: u64 = 10_000_000;
    /// 金额验证容差（1%，用于处理价格微小波动）
    pub const AmountValidationTolerance: u16 = 100; // 100 bps = 1%

    // OTC订单清理配置
    pub const OrderArchiveThresholdDays: u32 = 150; // 5个月
    pub const MaxOrderCleanupPerBlock: u32 = 50;
    
    // Bridge配置
    pub const SwapTimeout: BlockNumber = 30 * crate::MINUTES;
    pub const SwapArchiveThresholdDays: u32 = 180; // 6个月
    pub const MaxSwapCleanupPerBlock: u32 = 50;
    pub const MaxVerificationFailures: u32 = 3;
    pub const MaxOrdersPerBlock: u32 = 100;
    
    // OCW配置
    pub const OcwSwapTimeoutBlocks: BlockNumber = 100; // ~10分钟 - 2025-11-03 优化（原10区块太短）
    pub const OcwMinSwapAmount: Balance = 10_000_000_000_000_000; // 10 DUST
    pub const UnsignedPriorityTrading: sp_runtime::transaction_validity::TransactionPriority = sp_runtime::transaction_validity::TransactionPriority::MAX / 2;
}

// 🔴 2025-11-03：已注释（pallet-trading 重构为模块化）
// Trading Pallet 已拆分为 pallet-maker, pallet-otc-order, pallet-bridge
// 详见下方的独立配置
/*
impl pallet_trading::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type PalletId = TradingPalletId;
    type MakerDepositAmount = MakerDepositAmount;
    type MakerApplicationTimeout = MakerApplicationTimeout;
    type WithdrawalCooldown = WithdrawalCooldown;
    type MakerCredit = pallet_credit::Pallet<Runtime>;
    type ConfirmTTL = OtcOrderConfirmTTL;
    type CancelWindow = ConstU64<{ 5 * 60 * 1000 }>;
    type MaxExpiringPerBlock = frame_support::traits::ConstU32<200>;
    type OpenWindow = ConstU32<600>;
    type OpenMaxInWindow = ConstU32<30>;
    type PaidWindow = ConstU32<600>;
    type PaidMaxInWindow = ConstU32<100>;
    type FiatGatewayAccount = FiatGatewayAccount;
    type FiatGatewayTreasuryAccount = FiatGatewayTreasuryAccount;
    type FirstPurchaseUsdValue = FirstPurchaseUsdValue;
    type MinFirstPurchaseDustAmount = MinFirstPurchaseDustAmount;
    type MaxFirstPurchaseDustAmount = MaxFirstPurchaseDustAmount;
    type MaxFirstPurchaseOrdersPerMaker = MaxFirstPurchaseOrdersPerMaker;
    type Pricing = PricingProviderImpl;
    type OrderArchiveThresholdDays = OrderArchiveThresholdDays;
    type MaxOrderCleanupPerBlock = MaxOrderCleanupPerBlock;
    type TronTxHashRetentionPeriod = ConstU32<2592000>;
    type Escrow = pallet_escrow::Pallet<Runtime>;
    type AffiliateDistributor = EmptyAffiliateDistributor;
    type SwapTimeout = SwapTimeout;
    type SwapArchiveThresholdDays = SwapArchiveThresholdDays;
    type MaxSwapCleanupPerBlock = MaxSwapCleanupPerBlock;
    type MaxVerificationFailures = MaxVerificationFailures;
    type MaxOrdersPerBlock = MaxOrdersPerBlock;
    type OcwSwapTimeoutBlocks = OcwSwapTimeoutBlocks;
    type OcwMinSwapAmount = OcwMinSwapAmount;
    type UnsignedPriority = UnsignedPriorityTrading;
    type WeightInfo = ();
    type GovernanceOrigin = frame_system::EnsureSigned<AccountId>;
}
*/

// ===== 🆕 2025-11-03：pallet-trading 模块化重构配置 =====

// 1️⃣ Maker 模块配置（做市商管理）
/// 函数级中文注释：Maker Pallet 配置实现
/// - 🔴 stable2506 API 变更：RuntimeEvent 自动继承，无需显式设置
/// - 🔧 2025-11-27：GovernanceOrigin 配置修复，支持委员会投票审批
impl pallet_maker::Config for Runtime {
    type Currency = Balances;
    type MakerCredit = pallet_credit::Pallet<Runtime>;
    /// 治理权限配置：Root 或委员会 2/3 多数
    /// - EnsureRoot: sudo 账户直接调用（紧急情况）
    /// - EnsureProportionAtLeast<..., 2, 3>: 主委员会 2/3 成员投票通过
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance1, 2, 3>,
    >;
    type Timestamp = pallet_timestamp::Pallet<Runtime>;
    type MakerDepositAmount = MakerDepositAmount;
    type TargetDepositUsd = TargetDepositUsd;
    type DepositReplenishThreshold = DepositReplenishThreshold;
    type DepositReplenishTarget = DepositReplenishTarget;
    type PriceCheckInterval = PriceCheckInterval;
    type AppealDeadline = AppealDeadline;
    type Pricing = PricingImpl; // 需要实现
    type MakerApplicationTimeout = MakerApplicationTimeout;
    type WithdrawalCooldown = WithdrawalCooldown;
    type WeightInfo = ();
}

/// 函数级详细中文注释：定价服务实现
/// 调用 pallet-pricing 获取市场加权平均价格
pub struct PricingImpl;

impl pallet_maker::PricingProvider<Balance> for PricingImpl {
    fn get_dust_to_usd_rate() -> Option<Balance> {
        // 调用 pallet-pricing 获取 DUST 市场加权平均价格
        // 返回值：u64，精度 10^6 (USDT/DUST)
        let price = pallet_pricing::Pallet::<Runtime>::get_dust_market_price_weighted();

        // 价格为 0 表示市场无数据或冷启动未完成，返回 None
        if price > 0 {
            Some(price as Balance)
        } else {
            None
        }
    }
}

/// 函数级详细中文注释：Maker Pallet 接口实现（同时实现 OTC 和 Bridge）
pub struct MakerPalletImpl;

// 为 OTC Order 实现 MakerInterface
impl pallet_otc_order::MakerInterface<AccountId, Balance> for MakerPalletImpl {
    fn get_maker_application(maker_id: u64) -> Option<pallet_otc_order::MakerApplicationInfo<AccountId, Balance>> {
        use pallet_maker::ApplicationStatus;
        
        let app = pallet_maker::Pallet::<Runtime>::maker_applications(maker_id)?;
        
        Some(pallet_otc_order::MakerApplicationInfo {
            account: app.owner,
            tron_address: app.tron_address,
            is_active: matches!(app.status, ApplicationStatus::Active),
            _phantom: core::marker::PhantomData,
        })
    }
    
    fn is_maker_active(maker_id: u64) -> bool {
        pallet_maker::Pallet::<Runtime>::is_maker_active(maker_id)
    }
}

// 为 Bridge 实现 MakerInterface
impl pallet_bridge::MakerInterface<AccountId, Balance> for MakerPalletImpl {
    fn get_maker_application(maker_id: u64) -> Option<pallet_bridge::MakerApplicationInfo<AccountId, Balance>> {
        use pallet_maker::ApplicationStatus;
        
        let app = pallet_maker::Pallet::<Runtime>::maker_applications(maker_id)?;
        
        Some(pallet_bridge::MakerApplicationInfo {
            account: app.owner,
            tron_address: app.tron_address,
            is_active: matches!(app.status, ApplicationStatus::Active),
            _phantom: core::marker::PhantomData,
        })
    }
    
    fn is_maker_active(maker_id: u64) -> bool {
        pallet_maker::Pallet::<Runtime>::is_maker_active(maker_id)
    }
    
    fn get_maker_id(who: &AccountId) -> Option<u64> {
        pallet_maker::Pallet::<Runtime>::get_maker_id(who)
    }
}

// 为 Bridge 和 OTC Order 实现统一的 MakerCreditInterface
pub struct MakerCreditImpl;

// 为 Bridge 实现 CreditInterface
impl pallet_bridge::CreditInterface for MakerCreditImpl {
    fn record_maker_order_completed(
        maker_id: u64,
        order_id: u64,
        response_time_seconds: u32,
    ) -> sp_runtime::DispatchResult {
        pallet_credit::Pallet::<Runtime>::record_maker_order_completed(
            maker_id,
            order_id,
            response_time_seconds,
        )
    }
    
    fn record_maker_order_timeout(
        maker_id: u64,
        order_id: u64,
    ) -> sp_runtime::DispatchResult {
        pallet_credit::Pallet::<Runtime>::record_maker_order_timeout(maker_id, order_id)
    }
    
    fn record_maker_dispute_result(
        maker_id: u64,
        order_id: u64,
        maker_win: bool,
    ) -> sp_runtime::DispatchResult {
        pallet_credit::Pallet::<Runtime>::record_maker_dispute_result(maker_id, order_id, maker_win)
    }
}

// 为 OTC Order 实现 MakerCreditInterface（复用相同的实现）
impl pallet_otc_order::MakerCreditInterface for MakerCreditImpl {
    fn record_maker_order_completed(
        maker_id: u64,
        order_id: u64,
        response_time_seconds: u32,
    ) -> sp_runtime::DispatchResult {
        pallet_credit::Pallet::<Runtime>::record_maker_order_completed(
            maker_id,
            order_id,
            response_time_seconds,
        )
    }
    
    fn record_maker_order_timeout(
        maker_id: u64,
        order_id: u64,
    ) -> sp_runtime::DispatchResult {
        pallet_credit::Pallet::<Runtime>::record_maker_order_timeout(maker_id, order_id)
    }
    
    fn record_maker_dispute_result(
        maker_id: u64,
        order_id: u64,
        maker_win: bool,
    ) -> sp_runtime::DispatchResult {
        pallet_credit::Pallet::<Runtime>::record_maker_dispute_result(maker_id, order_id, maker_win)
    }
}

// 2️⃣ OTC Order 模块配置（OTC 订单管理）
/// 函数级中文注释：OtcOrder Pallet 配置实现
/// - 🔴 stable2506 API 变更：RuntimeEvent 自动继承，无需显式设置
impl pallet_otc_order::Config for Runtime {
    type Currency = Balances;
    type Timestamp = pallet_timestamp::Pallet<Runtime>;
    type Escrow = pallet_escrow::Pallet<Runtime>;
    type Credit = CreditWrapper;  // 🚧 临时使用 wrapper，待 pallet-credit 完善
    type MakerCredit = MakerCreditImpl;  // ✅ 2025-11-03：做市商信用接口
    type Pricing = PricingProviderImpl;
    type MakerPallet = MakerPalletImpl;  // Maker Pallet 接口
    type CommitteeOrigin = frame_system::EnsureSigned<AccountId>;  // 🆕 2025-11-13：KYC管理权限
    type IdentityProvider = ();  // 🆕 2025-11-13：临时使用空实现（待 pallet_identity 集成）

    // 订单超时配置
    type OrderTimeout = ConstU64<7_200_000>;  // 2 小时（毫秒）- 2025-11-03 优化
    type EvidenceWindow = ConstU64<86_400_000>;  // 24 小时（毫秒）

    // 订单金额配置 - 2025-11-10 新增
    type MaxOrderUsdAmount = MaxOrderUsdAmount;     // 200 USD
    type MinOrderUsdAmount = MinOrderUsdAmount;     // 20 USD (首购除外)
    type FirstPurchaseUsdAmount = FirstPurchaseUsdAmount;  // 10 USD
    type AmountValidationTolerance = AmountValidationTolerance;  // 1%

    // 首购配置（固定 $10 USD，动态 DUST）
    type FirstPurchaseUsdValue = FirstPurchaseUsdValue;  // 10_000_000 ($10 USD，精度10^6)
    type MinFirstPurchaseDustAmount = MinFirstPurchaseDustAmount;  // 100 DUST
    type MaxFirstPurchaseDustAmount = MaxFirstPurchaseDustAmount;  // 10,000 DUST
    type MaxFirstPurchaseOrdersPerMaker = MaxFirstPurchaseOrdersPerMaker;  // 5

    // 🆕 2025-11-28: 聊天权限管理器
    type ChatPermission = ChatPermission;

    type WeightInfo = ();
}

// 3️⃣ Bridge 模块配置（DUST ↔ USDT 桥接）
/// 函数级中文注释：Bridge Pallet 配置实现
/// - 🔴 stable2506 API 变更：RuntimeEvent 自动继承，无需显式设置
impl pallet_bridge::Config for Runtime {
    type Currency = Balances;
    type Escrow = pallet_escrow::Pallet<Runtime>;
    type Pricing = PricingProviderImpl;  // 🆕 2025-11-03：添加价格提供者
    type MakerPallet = MakerPalletImpl;  // 重用 MakerPalletImpl
    type Credit = MakerCreditImpl;  // ✅ 2025-11-03：添加真实 Credit 接口
    type GovernanceOrigin = frame_system::EnsureSigned<AccountId>;
    
    // 兑换配置
    type MinSwapAmount = OcwMinSwapAmount;  // 10 DUST
    type SwapTimeout = SwapTimeout;  // 30 分钟
    type OcwSwapTimeoutBlocks = OcwSwapTimeoutBlocks;  // 100 区块（2025-11-03优化）
    
    type WeightInfo = ();
}

/// 函数级中文注释：AI策略管理模块配置
/// 🆕 2025-11-04：AI驱动的自动化交易系统
impl pallet_ai_trader::Config for Runtime {
    type WeightInfo = ();
    
    // 最大值配置
    type MaxNameLength = ConstU32<64>;      // 策略名称最大64字节
    type MaxSymbolLength = ConstU32<32>;    // 交易对符号最大32字节
    type MaxCIDLength = ConstU32<64>;       // IPFS CID最大64字节
    type MaxFeatures = ConstU32<20>;        // 最多20个特征
    type MaxEndpointLength = ConstU32<256>; // API端点URL最大256字节
    
    // OCW授权ID
    type AuthorityId = pallet_ai_trader::ocw::crypto::TestAuthId;
}

/// 函数级中文注释：DUST 跨链桥接模块配置
/// 🆕 2025-11-05：Stardust ↔ Arbitrum 桥接
impl pallet_dust_bridge::Config for Runtime {
    // 货币类型（DUST）
    type Currency = Balances;
    
    // 治理权限（用于设置桥接账户等管理操作）
    // Root 或技术委员会 2/3 批准
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance2, 2, 3>,
    >;
    
    // 最小桥接金额（1 DUST，防止粉尘攻击）
    type MinBridgeAmount = ConstU128<1_000_000_000_000>;
    
    // 最大桥接金额（1,000,000 DUST，风险控制）
    type MaxBridgeAmount = ConstU128<1_000_000_000_000_000_000>;
    
    // 桥接超时时间（1小时 = 600个区块，假设6秒/区块）
    type BridgeTimeout = ConstU32<600>;
}

/// 函数级详细中文注释：空的推荐关系提供者（Trading暂不使用推荐功能）
pub struct EmptyReferralProvider;
// impl pallet_stardust_referrals::ReferralProvider<AccountId> for EmptyReferralProvider {
//     fn sponsor_of(_who: &AccountId) -> Option<AccountId> { None }
//     fn ancestors(_who: &AccountId, _max: u32) -> alloc::vec::Vec<AccountId> { alloc::vec::Vec::new() }
//     fn is_banned(_who: &AccountId) -> bool { false }
//     fn find_account_by_code(_code: &alloc::vec::Vec<u8>) -> Option<AccountId> { None }
//     fn get_referral_code(_who: &AccountId) -> Option<alloc::vec::Vec<u8>> { None }
//     fn try_auto_claim_code(_who: &AccountId) -> bool { false }
//     fn bind_sponsor_internal(_who: &AccountId, _sponsor: &AccountId) -> Result<(), &'static str> { Ok(()) }
// }

/// 函数级详细中文注释：空的联盟分配器（Trading暂不使用联盟功能）
pub struct EmptyAffiliateDistributor;
impl pallet_affiliate::types::AffiliateDistributor<AccountId, Balance, BlockNumber> 
    for EmptyAffiliateDistributor 
{
    fn distribute_rewards(
        _buyer: &AccountId,
        _amount: Balance,
        _target: Option<(u8, u64)>,
    ) -> Result<Balance, sp_runtime::DispatchError> {
        Ok(0) // 不分配，直接返回0
    }
}

parameter_types! { pub const EscrowPalletId: frame_support::PalletId = frame_support::PalletId(*b"otc/escw"); }
impl pallet_escrow::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type EscrowPalletId = EscrowPalletId;
    /// 函数级中文注释：授权外部入口的 Origin（Root | 内容委员会阈值）。
    type AuthorizedOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    /// 函数级中文注释：管理员 Origin（同上）。
    type AdminOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    /// 函数级中文注释：每块最多处理的到期项（示例：200）。
    type MaxExpiringPerBlock = frame_support::traits::ConstU32<200>;
    /// 函数级中文注释：到期策略（示例：NoopPolicy）。
    type ExpiryPolicy = NoopExpiryPolicy;
}
/// 函数级中文注释：到期策略占位实现——不做任何资金处理，仅用于演示。
pub struct NoopExpiryPolicy;
impl pallet_escrow::pallet::ExpiryPolicy<AccountId, BlockNumber> for NoopExpiryPolicy {
    fn on_expire(
        _id: u64,
    ) -> Result<pallet_escrow::pallet::ExpiryAction<AccountId>, sp_runtime::DispatchError> {
        Ok(pallet_escrow::pallet::ExpiryAction::Noop)
    }
    fn now() -> BlockNumber {
        <frame_system::Pallet<Runtime>>::block_number()
    }
}

parameter_types! { pub const ArbMaxEvidence: u32 = 16; pub const ArbMaxCidLen: u32 = 64; }

// 🆕 纠纷押金常量配置（方案 A：托管扣押金，订单金额15%）
const DISPUTE_RESPONSE_BLOCKS: u32 = 7 * 14400; // 7天（假设每天14400个区块，6秒/区块）
const DEPOSIT_RATIO_BPS: u16 = 1500; // 15% = 1500 basis points

impl pallet_arbitration::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxEvidence = ArbMaxEvidence;
    type MaxCidLen = ArbMaxCidLen;
    type Escrow = pallet_escrow::Pallet<Runtime>;
    type WeightInfo = pallet_arbitration::weights::SubstrateWeight<Runtime>;
    type Router = ArbitrationRouter;
    /// 函数级中文注释：仲裁裁决起源绑定为 Root | 内容委员会阈值(2/3)
    type DecisionOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;

    /// 🆕 双向押金相关配置（方案 A：从托管账户扣除押金）
    /// - 押金来源：托管账户（不是用户账户）
    /// - 押金比例：订单金额的 15%
    /// - 双向机制：发起方和应诉方都需从托管扣押金
    type Fungible = pallet_balances::Pallet<Runtime>;
    type RuntimeHoldReason = RuntimeHoldReason;
    type DepositRatioBps = ConstU16<DEPOSIT_RATIO_BPS>;  // 15% 押金比例
    type ResponseDeadline = ConstU32<DISPUTE_RESPONSE_BLOCKS>;
    type RejectedSlashBps = ConstU16<3000>;          // 败诉罚没 30%
    type PartialSlashBps = ConstU16<5000>;           // 部分胜诉罚没 50%
    type TreasuryAccount = TreasuryAccount;
}

// 已移除：Karma 授权命名空间常量

// ===== 仲裁域路由：把仲裁请求分发到对应业务 pallet =====
// 函数级中文注释：定义业务域命名空间（用于仲裁路由）
parameter_types! {
    /// OTC订单命名空间
    pub const OtcOrderNsBytes: [u8; 8] = *b"otc_ord_";
    /// SimpleBridge命名空间  
    pub const SimpleBridgeNsBytes: [u8; 8] = *b"sm_brdge";
}

pub struct ArbitrationRouter;
/// 函数级中文注释：仲裁域路由器实现。转发到对应业务 Pallet 的校验与执行接口。
///
/// 支持的业务域：
/// 1. OTC订单 (b"otc_ord_") - 买家或卖家可发起争议
/// 2. SimpleBridge (b"sm_brdge") - 用户或做市商可发起争议
impl pallet_arbitration::pallet::ArbitrationRouter<AccountId, Balance> for ArbitrationRouter {
    /// 函数级中文注释：权限校验 - 验证用户是否有权对指定域的对象发起争议
    fn can_dispute(domain: [u8; 8], who: &AccountId, id: u64) -> bool {
        if domain == OtcOrderNsBytes::get() {
            // OTC订单：买家或卖家可发起
            // ✅ 2025-11-03：已实现仲裁接口
            pallet_otc_order::Pallet::<Runtime>::can_dispute_order(who, id)
        } else if domain == SimpleBridgeNsBytes::get() {
            // SimpleBridge (Bridge)：用户或做市商可发起
            // ✅ 2025-11-03：已实现仲裁接口
            pallet_bridge::Pallet::<Runtime>::can_dispute_swap(who, id)
        } else {
            false
        }
    }
    /// 函数级中文注释：将仲裁裁决应用到对应域
    ///
    /// 裁决类型：
    /// - Release: 全额放款给卖家/做市商（买家败诉）
    /// - Refund: 全额退款给买家（卖家/做市商败诉）
    /// - Partial(bps): 按比例分账（双方都有责任）
    fn apply_decision(
        domain: [u8; 8],
        id: u64,
        decision: pallet_arbitration::pallet::Decision,
    ) -> frame_support::dispatch::DispatchResult {
        if domain == OtcOrderNsBytes::get() {
            // OTC订单域：应用仲裁裁决
            // ✅ 2025-11-03：已实现仲裁接口
            pallet_otc_order::Pallet::<Runtime>::apply_arbitration_decision(id, decision)
        } else if domain == SimpleBridgeNsBytes::get() {
            // SimpleBridge (Bridge) 域：应用仲裁裁决
            // ✅ 2025-11-03：已实现仲裁接口
            pallet_bridge::Pallet::<Runtime>::apply_arbitration_decision(id, decision)
        } else {
            Err(sp_runtime::DispatchError::Other("UnsupportedDomain"))
        }
    }

    /// 🆕 函数级中文注释：获取纠纷对方账户
    ///
    /// 用途：双向押金机制需要知道谁是应诉方
    /// - OTC订单：发起方是买家则返回卖家，发起方是卖家则返回买家
    /// - SimpleBridge：发起方是用户则返回做市商账户
    ///
    /// TODO: 实现完整的对方账户查询逻辑
    fn get_counterparty(
        domain: [u8; 8],
        initiator: &AccountId,
        id: u64,
    ) -> Result<AccountId, sp_runtime::DispatchError> {
        if domain == OtcOrderNsBytes::get() {
            // OTC订单：从订单信息中获取对方
            let order = pallet_otc_order::Orders::<Runtime>::get(id)
                .ok_or(sp_runtime::DispatchError::Other("OrderNotFound"))?;

            if initiator == &order.taker {
                // 发起方是买家，对方是卖家
                Ok(order.maker)
            } else if initiator == &order.maker {
                // 发起方是卖家，对方是买家
                Ok(order.taker)
            } else {
                Err(sp_runtime::DispatchError::Other("NotParticipant"))
            }
        } else if domain == SimpleBridgeNsBytes::get() {
            // SimpleBridge (Bridge)：查询对方账户
            // - 官方桥接：无对方（系统自动处理），返回系统账户
            // - 做市商桥接：查询 MakerSwaps 获取做市商账户

            // 先尝试查询做市商桥接记录
            if let Some(maker_swap) = pallet_bridge::MakerSwaps::<Runtime>::get(id) {
                // 做市商桥接：发起方是用户则返回做市商，发起方是做市商则返回用户
                if initiator == &maker_swap.user {
                    Ok(maker_swap.maker)
                } else if initiator == &maker_swap.maker {
                    Ok(maker_swap.user)
                } else {
                    Err(sp_runtime::DispatchError::Other("NotParticipant"))
                }
            } else if let Some(swap_req) = pallet_bridge::SwapRequests::<Runtime>::get(id) {
                // 官方桥接：只有用户参与，返回平台账户作为对方
                if initiator == &swap_req.user {
                    Ok(PlatformAccount::get())
                } else {
                    Err(sp_runtime::DispatchError::Other("NotParticipant"))
                }
            } else {
                Err(sp_runtime::DispatchError::Other("SwapNotFound"))
            }
        } else {
            Err(sp_runtime::DispatchError::Other("UnsupportedDomain"))
        }
    }

    /// 🆕 函数级中文注释：获取订单/交易金额（用于计算押金）
    ///
    /// 用途：方案 A - 从托管账户扣除订单金额15%作为押金
    /// - OTC订单：返回订单的 DUST 数量（order.qty）
    /// - SimpleBridge：返回兑换的 DUST 金额（swap.dust_amount）
    ///
    /// 返回值：订单/交易的 DUST 金额（Balance 类型）
    fn get_order_amount(domain: [u8; 8], id: u64) -> Result<Balance, sp_runtime::DispatchError> {
        if domain == OtcOrderNsBytes::get() {
            // OTC订单：从订单信息中获取 DUST 数量
            let order = pallet_otc_order::Orders::<Runtime>::get(id)
                .ok_or(sp_runtime::DispatchError::Other("OrderNotFound"))?;

            // 返回订单的 DUST 数量（qty 字段）
            Ok(order.qty)
        } else if domain == SimpleBridgeNsBytes::get() {
            // SimpleBridge (Bridge)：查询兑换金额
            // - 官方桥接：返回 swap.dust_amount
            // - 做市商桥接：返回 maker_swap.dust_amount

            // 先尝试查询做市商桥接记录
            if let Some(maker_swap) = pallet_bridge::MakerSwaps::<Runtime>::get(id) {
                Ok(maker_swap.dust_amount)
            } else if let Some(swap_req) = pallet_bridge::SwapRequests::<Runtime>::get(id) {
                Ok(swap_req.dust_amount)
            } else {
                Err(sp_runtime::DispatchError::Other("SwapNotFound"))
            }
        } else {
            Err(sp_runtime::DispatchError::Other("UnsupportedDomain"))
        }
    }
}

// ===== 内容治理执行路由：将决议分发到目标 Pallet 强制接口 =====
pub struct ContentGovernanceRouter;
/// 函数级中文注释：内容治理路由器实现。
/// - 根据 (domain, action) 将调用分发到相应 pallet 的 gov*/force* 接口；
/// - MVP：先覆盖常见内容域（grave/deceased/deceased-text/deceased-media/offerings/park）；
/// - 安全：仅在 memo-content-governance Pallet 审批通过后由 Hooks 调用，无需二次权限判断。
impl pallet_stardust_appeals::AppealRouter<AccountId> for ContentGovernanceRouter {
    fn execute(
        _who: &AccountId,
        domain: u8,
        target: u64,
        action: u8,
    ) -> frame_support::dispatch::DispatchResult {
        match (domain, action) {
            // 🗑️ 2025-11-16: 已删除 domain=1 (grave) 所有治理操作
            /*
            // 1=grave：治理强制执行（示例：10=清空封面；11=强制转让墓地 owner 到平台账户）
            (1, 10) => {
                // 清空封面
                pallet_stardust_grave::pallet::Pallet::<Runtime>::clear_cover_via_governance(
                    RuntimeOrigin::root(),
                    target,
                )
            }
            (1, 11) => pallet_stardust_grave::pallet::Pallet::<Runtime>::gov_transfer_grave(
                RuntimeOrigin::root(),
                target,
                PlatformAccount::get(),
                vec![],
            ),
            // 1=grave：12=设置限制；13=软删除；14=恢复
            (1, 12) => pallet_stardust_grave::pallet::Pallet::<Runtime>::gov_set_restricted(
                RuntimeOrigin::root(),
                target,
                true,
                1u8,
                vec![],
            ),
            (1, 13) => pallet_stardust_grave::pallet::Pallet::<Runtime>::gov_remove_grave(
                RuntimeOrigin::root(),
                target,
                1u8,
                vec![],
            ),
            (1, 14) => pallet_stardust_grave::pallet::Pallet::<Runtime>::gov_restore_grave(
                RuntimeOrigin::root(),
                target,
                vec![],
            ),
            */
            // 2=deceased：更新 profile（此处作为示例仅切换可见性为 true）
            (2, 1) => {
                // 证据由上层记录；此处直接调用 gov_set_visibility(true)
                pallet_deceased::pallet::Pallet::<Runtime>::gov_set_visibility(
                    RuntimeOrigin::root(),
                    target as u64,
                    true,
                    vec![],
                )
            }
            // 2=deceased：2=清空主图；3=设置主图（以事件化为主，字段存储在 deceased）
            (2, 2) => pallet_deceased::pallet::Pallet::<Runtime>::gov_set_main_image(
                RuntimeOrigin::root(),
                target as u64,
                None,
                vec![],
            ),
            (2, 3) => {
                // 占位：设置为默认头像（前端约定 CID），此处用 None 保持接口对齐
                pallet_deceased::pallet::Pallet::<Runtime>::gov_set_main_image(
                    RuntimeOrigin::root(),
                    target as u64,
                    None,
                    vec![],
                )
            }
            // 2=deceased：4=治理转移拥有者
            (2, 4) => {
                // 运行时通过治理 Pallet 的只读接口查找 new_owner
                if let Some((_id, new_owner)) = pallet_stardust_appeals::pallet::Pallet::<
                    Runtime,
                >::find_owner_transfer_params(target)
                {
                    pallet_deceased::pallet::Pallet::<Runtime>::gov_transfer_owner(
                        RuntimeOrigin::root(),
                        target as u64,
                        new_owner,
                        vec![],
                    )
                } else {
                    Err(sp_runtime::DispatchError::Other("MissingNewOwner"))
                }
            }
            // 5=park：转移园区所有权（占位，new_owner=平台账户）
            (5, 40) => pallet_stardust_park::pallet::Pallet::<Runtime>::gov_transfer_park(
                RuntimeOrigin::root(),
                target as u64,
                PlatformAccount::get(),
                vec![],
            ),
            // 5=park：41=设置园区封面（事件化）
            (5, 41) => pallet_stardust_park::pallet::Pallet::<Runtime>::gov_set_park_cover(
                RuntimeOrigin::root(),
                target as u64,
                None,
                vec![],
            ),
            _ => Err(sp_runtime::DispatchError::Other("UnsupportedContentAction")),
        }
    }
}

// ===== exchange 配置 =====
// duplicate import removed

// 已移除：pallet-exchange 参数与 Config

// 已移除：evidence 授权适配器（改为 () ）

// 已移除：Exchange 管理员适配器实现

parameter_types! { pub const IpfsMaxCidHashLen: u32 = 64; }
/// 函数级中文注释：为 stardust-ipfs 绑定运行时类型。注意 OCW 需要签名类型约束。
impl pallet_stardust_ipfs::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type Balance = Balance;
    /// 函数级详细中文注释：费用接收账户改为存储专用账户
    /// - 修改前：使用 TreasuryAccount（费用进入国库，与其他资金混合）
    /// - 修改后：使用 DecentralizedStorageAccount（费用进入存储专用账户，专款专用）
    /// - 优势：存储费用独立管理、审计清晰、与 pallet-storage-treasury 打通
    type FeeCollector = DecentralizedStorageAccount;
    type GovernanceOrigin = frame_system::EnsureSigned<AccountId>;
    type MaxCidHashLen = IpfsMaxCidHashLen;
    type MaxPeerIdLen = frame_support::traits::ConstU32<128>;
    type MinOperatorBond = frame_support::traits::ConstU128<10_000_000_000_000>; // 0.01 UNIT 示例
    type MinCapacityGiB = frame_support::traits::ConstU32<100>; // 至少 100 GiB 示例
    type WeightInfo = ();
    /// 函数级中文注释：使用独立的主题资金 PalletId，语义清晰，职责单一。
    /// - 派生逝者资金账户：SubjectPalletId.into_sub_account_truncating((1, subject_id))
    /// - 与 OTC 托管、联盟计酬托管完全隔离，各司其职
    /// - 未来可扩展到墓地(domain=2)、陵园(domain=3)等其他业务域
    type SubjectPalletId = SubjectPalletId;
    /// 函数级中文注释：绑定逝者域常量（domain=1），用于 (domain, creator, deceased_id) 稳定派生。
    type DeceasedDomain = ConstU8<1>;
    /// 函数级详细中文注释：CreatorProvider适配器（从pallet-deceased读取creator字段）
    /// 
    /// ### 功能
    /// - 从pallet-deceased读取creator（创建者）
    /// - 用于SubjectFunding账户派生
    /// 
    /// ### 设计理念
    /// - creator不可变，确保地址稳定
    /// - 与owner解耦，支持owner转让
    type CreatorProvider = DeceasedCreatorAdapter;
    
    /// 函数级详细中文注释：OwnerProvider适配器（从pallet-deceased读取owner字段）
    /// 
    /// ### 功能
    /// - 从pallet-deceased读取owner（当前所有者）
    /// - 用于权限检查
    /// 
    /// ### 设计理念
    /// - owner可转让，支持所有权转移
    /// - 与creator分离，creator用于派生地址，owner用于权限检查
    type OwnerProvider = DeceasedOwnerAdapter;
    
    // ⭐ 新增：双重扣款配置
    /// 函数级中文注释：IPFS 池账户（公共费用来源）
    /// - 由 pallet-storage-treasury 定期补充（供奉路由 2% × 50%）
    /// - 用于为 deceased 提供免费配额
    type IpfsPoolAccount = IpfsPoolAccount;
    
    /// 函数级中文注释：运营者托管账户（服务费接收方）
    /// - 接收所有 pin 服务费用
    /// - 待运营者完成任务后基于 SLA 分配
    type OperatorEscrowAccount = OperatorEscrowAccount;
    
    /// 函数级中文注释：每月公共费用配额（100 DUST）
    type MonthlyPublicFeeQuota = MonthlyPublicFeeQuota;
    
    /// 函数级中文注释：配额重置周期（28 天）
    type QuotaResetPeriod = QuotaResetPeriod;
    
    /// 函数级详细中文注释：默认扣费周期（7 天）✅ 新增
    /// 
    /// ### 说明
    /// - 周期性扣费的间隔时间
    /// - 默认：100,800 区块 ≈ 7天（假设6秒/块）
    /// - 用于on_finalize自动扣费调度
    /// - 可通过治理动态调整
    /// 
    /// ### 计算公式
    /// 块数 = 天数 × 24 × 60 × 60 ÷ 6 = 天数 × 14400
    /// - 1天 = 14,400块
    /// - 7天 = 100,800块
    /// - 28天 = 403,200块
    type DefaultBillingPeriod = DefaultBillingPeriod;
}

/// 函数级详细中文注释：逝者creator只读适配器
/// 
/// ### 功能
/// - 从pallet-deceased读取creator字段
/// - 用于SubjectFunding账户派生
/// 
/// ### 设计理念
/// - **creator不可变**：创建时设置，永不改变
/// - **地址稳定**：不受owner转让影响
/// - **低耦合**：通过trait解耦，不直接依赖pallet-deceased
/// 
/// ### 实现细节
/// - 从DeceasedOf storage读取deceased信息
/// - 返回creator字段
/// - 如果deceased不存在返回None
pub struct DeceasedCreatorAdapter;
impl pallet_stardust_ipfs::CreatorProvider<AccountId> for DeceasedCreatorAdapter {
    /// 函数级详细中文注释：从pallet-deceased读取creator字段
    /// 
    /// ### 参数
    /// - `deceased_id`: 逝者ID
    /// 
    /// ### 返回
    /// - `Some(creator)`: 逝者存在，返回创建者账户
    /// - `None`: 逝者不存在
    /// 
    /// ### 注意
    /// - creator是不可变的，创建时设置后永不改变
    /// - 与owner不同，owner可以被转让
    fn creator_of(deceased_id: u64) -> Option<AccountId> {
        use pallet_deceased::pallet::DeceasedOf as DMap;
        DMap::<Runtime>::get(deceased_id).map(|d| d.creator)
    }
}

/// 函数级详细中文注释：逝者owner只读适配器
/// 
/// ### 功能
/// - 从pallet-deceased读取owner字段
/// - 用于权限检查
/// 
/// ### 设计理念
/// - **owner可转让**：支持所有权转移
/// - **权限控制**：用于检查操作权限
/// - **与creator分离**：creator用于派生地址，owner用于权限检查
/// - **低耦合**：通过trait解耦，不直接依赖pallet-deceased
/// 
/// ### 实现细节
/// - 从DeceasedOf storage读取deceased信息
/// - 返回owner字段
/// - 如果deceased不存在返回None
pub struct DeceasedOwnerAdapter;
impl pallet_stardust_ipfs::OwnerProvider<AccountId> for DeceasedOwnerAdapter {
    /// 函数级详细中文注释：从pallet-deceased读取owner字段
    /// 
    /// ### 参数
    /// - `deceased_id`: 逝者ID
    /// 
    /// ### 返回
    /// - `Some(owner)`: 逝者存在，返回当前所有者账户
    /// - `None`: 逝者不存在
    /// 
    /// ### 注意
    /// - owner可以被转让，与creator不同
    /// - 用于权限检查，不用于资金账户派生
    fn owner_of(deceased_id: u64) -> Option<AccountId> {
        use pallet_deceased::pallet::DeceasedOf as DMap;
        DMap::<Runtime>::get(deceased_id).map(|d| d.owner)
    }
}

/// 函数级中文注释：SLA 数据提供者，从 `pallet-stardust-ipfs` 读取运营者统计
pub struct SlaFromIpfs;
// （已下线）SLA Provider 适配器不再实现 endowment 的 trait
impl SlaFromIpfs {
    /// 函数级中文注释：占位保留工具函数，可被迁移脚本或索引层复用（不依赖 endowment trait）。
    pub fn foreach_active_operator<F: FnMut(&AccountId, u32, u32, BlockNumber)>(mut f: F) {
        use pallet_stardust_ipfs::pallet::{OperatorSla as SlaMap, Operators as OpMap};
        for (op, s) in SlaMap::<Runtime>::iter() {
            if let Some(info) = OpMap::<Runtime>::get(&op) {
                if info.status == 0 {
                    f(&op, s.probe_ok, s.probe_fail, s.last_update);
                }
            }
        }
    }
}

// ===== affiliate（计酬）配置 =====
parameter_types! {
    /// 函数级中文注释：计酬最大层级（与推荐层级上限相近）。
    pub const AffiliateMaxHops: u32 = 10;
    /// 函数级中文注释：佣金池 PalletId，用于派生模块资金账户。
    pub const AffiliatePalletId: PalletId = PalletId(*b"affiliat");
    
    /// 函数级中文注释：主题资金 PalletId，用于派生各域主题的资金子账户。
    /// - domain=1: 逝者（deceased）
    /// - domain=2: 墓地（grave）- 未来扩展
    /// - domain=3: 陵园（cemetery）- 未来扩展
    /// - 每个 (domain, subject_id) 对应一个独立的子账户，实现资金天然隔离
    pub const SubjectPalletId: PalletId = PalletId(*b"subjects");
}

/// 函数级中文注释：佣金池账户解析器——由 PalletId 派生稳定账户地址。
pub struct CommissionAccount;
impl sp_core::Get<AccountId> for CommissionAccount {
    fn get() -> AccountId {
        AffiliatePalletId::get().into_account_truncating()
    }
}

/// 函数级中文注释：极差费率配置（万分比）。可在未来迁移为存储项/治理参数。
pub struct AffiliateTierRates;
impl sp_core::Get<&'static [u16]> for AffiliateTierRates {
    fn get() -> &'static [u16] {
        // 第1层 8%，第2层 5%，第3层 2%（示例，可治理升级）
        const R: &[u16] = &[800, 500, 200];
        R
    }
}

parameter_types! {
    /// 函数级中文注释：联盟计酬托管账户地址（供 weekly 使用）
    pub AffiliateEscrowAccount: AccountId = AffiliatePalletId::get().into_account_truncating();
    
    /// 函数级详细中文注释：去中心化存储费用账户 PalletId
    /// - 用于接收供奉产生的去中心化存储费用（IPFS + 未来扩展）
    /// - 独立于国库账户，便于资金分类和审计
    /// - ⚠️ 破坏式调整：PalletId 从 py/storg 改为 py/dstor（主网未上线，允许调整）
    /// - PalletId 必须是 8 字节，py/dstor = Decentralized Storage
    pub DecentralizedStoragePalletId: PalletId = PalletId(*b"py/dstor");
}

/// 函数级详细中文注释：去中心化存储费用账户地址
/// - 接收供奉产生的存储费用（通常为2%）
/// - 用于支付 IPFS 存储成本及未来其他去中心化存储方案（Arweave、Filecoin等）
/// - 资金用途：IPFS 节点运维、存储空间扩展、多副本备份、跨链存储桥接
pub struct DecentralizedStorageAccount;
impl sp_core::Get<AccountId> for DecentralizedStorageAccount {
    fn get() -> AccountId {
        DecentralizedStoragePalletId::get().into_account_truncating()
    }
}

// ============================================================================
// 存储费用专用账户管理层配置 (pallet-storage-treasury)
// ============================================================================
parameter_types! {
    // 函数级详细中文注释：存储费用自动分配周期
    // - 每隔 100_800 区块（约 7 天）自动执行一次路由分配
    // - 按 6 秒/块计算：100_800 块 = 604,800 秒 = 7 天
    // - 可通过治理调整分配频率
    pub const StorageDistributionPeriod: BlockNumber = 100_800;
    
    // 函数级详细中文注释：存储服务运营者池 PalletId 定义
    // - IPFS 运营者池：py/ipfs+ (8字节)
    // - Arweave 运营者池：py/arwve (8字节)
    // - 节点运维激励池：py/nodes (8字节)
    // - 使用 PalletId 派生确保地址唯一且可预测
    pub IpfsPoolPalletId: PalletId = PalletId(*b"py/ipfs+");
    pub ArweavePoolPalletId: PalletId = PalletId(*b"py/arwve");
    pub NodeMaintenancePoolPalletId: PalletId = PalletId(*b"py/nodes");
}

/// 函数级详细中文注释：IPFS 运营者池账户
/// - 接收存储费用路由分配的 50%
/// - 从 IpfsPoolPalletId 派生，确保地址唯一性
/// - 无私钥控制，通过 pallet 逻辑或治理管理
pub struct IpfsPoolAccount;
impl sp_core::Get<AccountId> for IpfsPoolAccount {
    fn get() -> AccountId {
        IpfsPoolPalletId::get().into_account_truncating()
    }
}

/// 函数级详细中文注释：Arweave 运营者池账户
/// - 接收存储费用路由分配的 30%
/// - 从 ArweavePoolPalletId 派生，用于永久存储备份
/// - 无私钥控制，通过 pallet 逻辑或治理管理
pub struct ArweavePoolAccount;
impl sp_core::Get<AccountId> for ArweavePoolAccount {
    fn get() -> AccountId {
        ArweavePoolPalletId::get().into_account_truncating()
    }
}

/// 函数级详细中文注释：节点运维激励池账户
/// - 接收存储费用路由分配的 20%
/// - 从 NodeMaintenancePoolPalletId 派生，用于基础设施维护
/// - 无私钥控制，通过 pallet 逻辑或治理管理
pub struct NodeMaintenancePoolAccount;
impl sp_core::Get<AccountId> for NodeMaintenancePoolAccount {
    fn get() -> AccountId {
        NodeMaintenancePoolPalletId::get().into_account_truncating()
    }
}

parameter_types! {
    /// 函数级中文注释：运营者托管账户 PalletId
    /// 
    /// 用途：
    /// - 接收所有 IPFS pin 服务费用
    /// - 待运营者完成任务后基于 SLA 分配
    /// - py/opesc (8字节)
    pub OperatorEscrowPalletId: PalletId = PalletId(*b"py/opesc");
    
    /// 函数级中文注释：每月公共费用配额
    /// 
    /// 说明：
    /// - 每个 deceased 每月可使用的免费额度
    /// - 100 DUST ≈ 10,000 GiB/月（假设 0.01 DUST/GiB）
    /// - 可通过治理调整
    pub const MonthlyPublicFeeQuota: Balance = 100 * crate::UNIT;
    
    /// 函数级中文注释：配额重置周期
    /// 
    /// 说明：
    /// - 100,800 区块/周 × 4 = 403,200 区块 ≈ 28 天
    /// - 配额每月自动重置
    pub const QuotaResetPeriod: BlockNumber = 100_800 * 4;
    
    /// 函数级详细中文注释：默认扣费周期 ✅ 新增
    /// 
    /// ### 说明
    /// - 周期性扣费的间隔时间
    /// - 默认：100,800 区块 ≈ 7天（6秒/块）
    /// - 用于on_finalize自动扣费调度
    /// 
    /// ### 计算依据
    /// - 6秒/块 × 100,800 = 604,800秒 = 7天
    /// - 1天 = 14,400块（24 × 60 × 60 ÷ 6）
    /// - 1周 = 100,800块（7 × 14,400）
    /// 
    /// ### 调整建议
    /// - 测试网：可设为14,400块（1天）以加快测试
    /// - 生产网：推荐100,800块（7天），平衡用户体验和系统开销
    /// - 长周期：可设为403,200块（28天），但宽限期需相应延长
    pub const DefaultBillingPeriod: BlockNumber = 100_800;
}

/// 函数级中文注释：运营者托管账户
/// 
/// 用途：
/// - 接收从 IPFS 池或 SubjectFunding 扣除的费用
/// - 待运营者完成 pin 任务后基于 SLA 考核分配
/// - 无私钥控制，通过 pallet 逻辑或治理管理
pub struct OperatorEscrowAccount;
impl sp_core::Get<AccountId> for OperatorEscrowAccount {
    fn get() -> AccountId {
        OperatorEscrowPalletId::get().into_account_truncating()
    }
}

/// 函数级详细中文注释：存储费用专用账户管理模块配置
/// - 负责收集、管理和分配去中心化存储相关的资金
/// - 与国库账户、推荐账户完全隔离，资金用途明确
/// - 采用路由表机制，委员会治理分配规则
/// - 每周自动执行资金分配，无需人工干预
impl pallet_storage_treasury::Config for Runtime {
    /// 运行时事件类型
    type RuntimeEvent = RuntimeEvent;
    
    /// 货币类型（用于转账）
    type Currency = Balances;
    
    /// 函数级中文注释：存储费用专用 PalletId
    /// - 使用与 DecentralizedStorageAccount 相同的 PalletId
    /// - 确保派生的账户地址一致
    type StoragePalletId = DecentralizedStoragePalletId;
    
    /// 函数级详细中文注释：治理权限
    /// - Root | 技术委员会 2/3
    /// - 可以修改路由表、提取资金
    /// - 确保存储费用分配的民主决策
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance1, 2, 3>,
    >;
    
    /// 函数级详细中文注释：自动分配周期
    /// - 每 7 天（100_800 区块）自动执行一次路由分配
    /// - 从托管账户按路由表比例分配给各存储服务商
    type DistributionPeriod = StorageDistributionPeriod;
}


// ============================================================================
// 极简桥接模块配置 (pallet-simple-bridge)
// ============================================================================

// 函数级详细中文注释：SimpleBridge 配置实现
// - MVP 设计：只支持 DUST → USDT (TRC20) 兑换
// - 固定汇率：0.5 USDT/DUST（桥接服务端配置）
// - 托管模式：DUST 锁定在桥接账户
// - 注意：Currency、GovernanceOrigin、PalletId 继承自 pallet_market_maker::Config
// 🗑️ 2025-10-29：pallet-simple-bridge 已整合到 pallet-trading，配置已删除



parameter_types! {
    /// 函数级中文注释：推荐码最大长度（16字符）
    pub const AffiliateMaxCodeLen: u32 = 16;
    
    /// 函数级中文注释：推荐链最大搜索深度（防止无限循环）
    pub const AffiliateMaxSearchHops: u32 = 50;
}

/// 函数级中文注释：会员信息提供者适配器
pub struct AffiliateMembershipProvider;
impl pallet_affiliate::MembershipProvider<AccountId> for AffiliateMembershipProvider {
    fn is_valid_member(who: &AccountId) -> bool {
        pallet_membership::Pallet::<Runtime>::is_member_valid(who)
    }
}

// 🆕 2025-10-28 已移除：AffiliateDistributorAdapter（已不再需要）
// pallet-membership 和 pallet-otc-order 已更新为直接调用 pallet-affiliate

impl pallet_affiliate::Config for Runtime {
    /// 事件类型
    type RuntimeEvent = RuntimeEvent;

    /// 货币系统（支持锁定和保留，用于治理押金）
    type Currency = Balances;

    /// 托管 PalletId（使用现有的 AffiliatePalletId）
    type EscrowPalletId = AffiliatePalletId;

    /// 提款权限（Root 或 财务委员会）
    type WithdrawOrigin = frame_system::EnsureRoot<AccountId>;

    /// 管理员权限（配置管理 + 紧急暂停治理）
    /// 注：紧急暂停需要技术委员会5/7超级多数，恢复需要全票
    type AdminOrigin = frame_system::EnsureRoot<AccountId>;

    /// 会员信息提供者
    type MembershipProvider = AffiliateMembershipProvider;

    /// 推荐码最大长度
    type MaxCodeLen = AffiliateMaxCodeLen;

    /// 推荐链最大搜索深度
    type MaxSearchHops = AffiliateMaxSearchHops;

    /// 销毁账户（5%销毁）
    type BurnAccount = BurnAccount;

    /// 国库账户（2%国库）
    type TreasuryAccount = TreasuryAccount;

    /// 存储费用账户（3%存储）
    type StorageAccount = DecentralizedStorageAccount;
}

// ========================================
// 治理参数说明（硬编码在 pallet 中）
// ========================================
//
// 即时分成比例治理系统参数：
//
// **提案押金**：
// - 微调提案（≤10%变化）：1,000 DUST
// - 重大提案（>10%变化）：10,000 DUST
//
// **时间参数**：
// - 提案执行延迟：43200 区块（3天）
// - 提案冷却期：100800 区块（7天）
// - 失败冷却期：432000 区块（30天）
//
// **权重计算**：
// - 持币权重：70%（平方根，上限1000）
// - 参与权重：20%（历史投票次数）
// - 贡献权重：10%（推荐贡献 + 委员会成员）
//
// **信念投票**：
// - 不锁定：1x
// - 锁定1周：1.5x
// - 锁定2周：2x
// - 锁定4周：3x
// - 锁定8周：4x
// - 锁定16周：5x
// - 锁定32周：6x
//
// **通过条件**：
// - 微调提案：技术委员会2/3多数
// - 重大提案：全民公投
//   - 最低参与率：15%
//   - 自适应阈值：
//     - 50%+参与 → 50%支持
//     - 30-50%参与 → 55%支持
//     - 15-30%参与 → 60%支持
//
// **反垃圾机制**：
// - 最大并发提案：3个/账户
// - 提案间隔：7天
// - 失败后冷却期：30天
//
// **紧急机制**：
// - 暂停：技术委员会5/7超级多数
// - 恢复：Root 或 技术委员会全票（7/7）
//
// **唯一修改通道**：
// InstantLevelPercents 只能通过 execute_percentage_change() 修改
// 该函数仅在提案通过并到达执行区块时自动调用
//
// ========================================

// ===== pallet_membership 运行时配置 =====
parameter_types! {
    pub const MembershipPalletId: PalletId = PalletId(*b"membersp");
    pub const BlocksPerYear: BlockNumber = 5_256_000; // 6秒一个块：365 * 24 * 60 * 60 / 6
    pub const Units: Balance = 1_000_000_000_000; // 1 DUST = 10^12
    pub const MinMembershipPrice: Balance = 100_000_000_000_000; // 100 DUST
    pub const MaxMembershipPrice: Balance = 10_000_000_000_000_000; // 10,000 DUST
    /// 🆕 2025-11-10：最低持币价值（美分）
    /// 10000美分 = 100美元
    pub const MinHoldingValueCents: u64 = 10000;
}

/// 函数级中文注释：Membership Pallet 配置实现
/// - 🔴 stable2506 API 变更：RuntimeEvent 自动继承，无需显式设置
/// - 🆕 2025-11-10：增加持币门槛验证（持币价值≥100美元）
impl pallet_membership::Config for Runtime {
    type Currency = Balances;
    type PalletId = MembershipPalletId;
    type BlocksPerYear = BlocksPerYear;
    type Units = Units;
    // 🆕 2025-10-28 更新：直接连接 Runtime（实现了 pallet_affiliate::Config）
    type AffiliateConfig = Runtime;
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance2, 2, 3>,
    >;
    type MinMembershipPrice = MinMembershipPrice;
    type MaxMembershipPrice = MaxMembershipPrice;
    type AffiliatePalletId = AffiliatePalletId;
    // 🆕 2025-11-10：连接 pallet_pricing 用于价格查询
    type PricingConfig = Runtime;
    type MinHoldingValueCents = MinHoldingValueCents;
    type WeightInfo = ();
}

// 已移除：OpenGov 轨道相关 Cow（未使用）
use alloc::vec::Vec;

parameter_types! {
    pub const MaxVotesPerAccount: u32 = 256;
    pub const VoteLockingPeriod: BlockNumber = 7 * DAYS; // 约 7 天
}
parameter_types! { pub const MaxVotes: u32 = 256; }
parameter_types! { pub const MaxTurnoutLimit: Balance = 0; }

// 方案B：已移除 conviction-voting 配置

parameter_types! { pub const UndecidingTimeout: BlockNumber = 7 * DAYS; }

// 方案B：已移除 referenda 轨道配置

parameter_types! { pub const SubmissionDeposit: Balance = 0; }
parameter_types! { pub const MaxQueued: u32 = 100; }
parameter_types! { pub const AlarmInterval: BlockNumber = 10; }

// 方案B：已移除 referenda 配置

/// 函数级详细中文注释：初始化存储费用路由表
/// - 设置默认的存储费用分配规则：
///   * IPFS 运营者池 50%（去中心化存储主力）
///   * Arweave 运营者池 30%（永久存储备份）
///   * 节点运维激励 20%（基础设施维护）
/// - 总计 100%，所有存储费用都会自动分配
/// - 使用 PalletId 派生账户，确保地址唯一性和可预测性
/// - 治理后续可通过 set_storage_route_table 调整
/// - 应在 Runtime 升级或初始化时调用
#[allow(dead_code)]
pub fn initialize_storage_routes() {
    use sp_runtime::Permill;
    
    // 使用 PalletId 派生的账户地址
    // - IpfsPoolAccount: 从 py/ipfs+ 派生
    // - ArweavePoolAccount: 从 py/arwve 派生
    // - NodeMaintenancePoolAccount: 从 py/nodes 派生
    let routes = alloc::vec![
        (0u8, IpfsPoolAccount::get(),          Permill::from_percent(50)),  // IPFS 50%
        (1u8, ArweavePoolAccount::get(),       Permill::from_percent(30)),  // Arweave 30%
        (3u8, NodeMaintenancePoolAccount::get(), Permill::from_percent(20)),  // 节点运维 20%
    ];
    
    // 调用 set_storage_route_table 设置路由表
    let _ = pallet_storage_treasury::Pallet::<Runtime>::set_storage_route_table(
        frame_system::RawOrigin::Root.into(),
        routes,
    );
}

/// 函数级详细中文注释：初始化供奉路由表（职责转移方案 + SubjectFunding）
/// - 设置默认的资金分配规则（2024-10-10 调整版）：
///   * SubjectFunding 2%（主题账户，给逝者家属）
///   * 销毁 3%（通缩机制）
///   * 国库 3%（平台运营）
///   * 去中心化存储费用 2%（IPFS 及未来扩展）
///   * 推荐分配 90%（强激励推荐网络扩张）
impl pallet_chat::Config for Runtime {
    /// 事件类型
    type RuntimeEvent = RuntimeEvent;
    
    /// 函数级中文注释：IPFS CID 最大长度（通常为46-59字节）
    /// - CIDv0: 46字节（Qm开头）
    /// - CIDv1: 约59字节（b开头）
    /// - 设为128字节保证兼容未来扩展
    type MaxCidLen = frame_support::traits::ConstU32<128>;
    
    /// 函数级中文注释：每个用户最多会话数（100个会话）
    /// - 防止状态膨胀
    /// - 一般用户足够使用
    type MaxSessionsPerUser = frame_support::traits::ConstU32<100>;
    
    /// 函数级中文注释：每个会话最多保留消息数（最近1000条）
    /// - 链上只保留最近的消息索引
    /// - 历史消息通过IPFS查询
    /// - 节省链上存储空间
    type MaxMessagesPerSession = frame_support::traits::ConstU32<1000>;
    
    /// Weight info
    type WeightInfo = pallet_chat::SubstrateWeight<Runtime>;
    
    /// 函数级中文注释：消息发送速率限制窗口期（100个区块，约10分钟）
    /// - 防止垃圾消息攻击
    type RateLimitWindow = frame_support::traits::ConstU32<100>;
    
    /// 函数级中文注释：速率限制窗口内最多发送消息数（20条）
    /// - 防止刷屏
    type MaxMessagesPerWindow = frame_support::traits::ConstU32<20>;
    
    /// 函数级中文注释：消息过期时间（1,296,000个区块，约90天）
    /// - 自动清理过期消息
    /// - 节省存储空间
    type MessageExpirationTime = frame_support::traits::ConstU32<1296000>;

    // ========== ChatUserId相关配置 ==========
    /// 函数级中文注释：随机数源 - 用于生成ChatUserId
    /// 注意：使用SimpleRandomness,基于区块哈希,仅用于ID生成的辅助随机性
    type Randomness = SimpleRandomness;

    /// 函数级中文注释：时间提供器 - 用于时间戳
    type UnixTime = pallet_timestamp::Pallet<Runtime>;

    /// 函数级中文注释：用户昵称最大长度（64字节，约21个中文字符）
    type MaxNicknameLength = frame_support::traits::ConstU32<64>;

    /// 函数级中文注释：用户个性签名最大长度（256字节）
    type MaxSignatureLength = frame_support::traits::ConstU32<256>;
}

// ========= 🆕 2025-11-13: Phase 3 AI Chat Integration =========

// ===== deceased-ai 配置 =====
parameter_types! {
    /// 函数级中文注释：默认月度配额（每个AI服务提供商）
    /// - 推荐值：10000次查询/月
    /// - 防止滥用
    pub const DefaultMonthlyQuota: u32 = 10_000;

    /// 函数级中文注释：每个逝者最多授权的AI服务提供商数量
    /// - 推荐值：10个
    /// - 防止状态膨胀
    pub const MaxProvidersPerDeceased: u32 = 10;
}

/// 函数级详细中文注释：DeceasedAI Pallet 配置实现
/// - Phase 3 第二层：AI训练准备层
/// - 负责AI服务管理和训练任务调度
impl pallet_deceased_ai::Config for Runtime {
    type DeceasedId = u64;
    type DeceasedProvider = DeceasedAIDataAdapter;
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    type WeightInfo = ();
    type DefaultMonthlyQuota = DefaultMonthlyQuota;
    type MaxProvidersPerDeceased = MaxProvidersPerDeceased;
}

// ===== ai-chat 配置 =====
parameter_types! {
    /// 函数级中文注释：单个会话最大消息数（1000条）
    /// - 防止会话存储无限膨胀
    /// - 1000条消息约可支持50轮对话
    pub const MaxMessagesPerSession: u32 = 1000;

    /// 函数级中文注释：单用户最大活跃会话数（10个）
    /// - 防止用户创建过多会话
    /// - 10个会话足够日常使用
    pub const MaxActiveConversations: u32 = 10;

    /// 函数级中文注释：会话过期区块数（30天 = 432000区块，假设6秒/块）
    /// - 超过30天无活动的会话自动过期
    /// - 过期后需要重新激活
    pub const SessionExpiryBlocks: BlockNumber = 30 * DAYS;
}

/// 函数级详细中文注释：AIChat Pallet 配置实现
/// - Phase 3 第三层：AI对话集成层
/// - 负责实时对话管理和OCW AI请求处理
/// - 🔴 stable2506 API 变更：RuntimeEvent 自动继承，无需显式设置
impl pallet_ai_chat::Config for Runtime {
    type DeceasedId = u64;
    type DeceasedProvider = DeceasedAIDataAdapter;
    type GovernanceOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    type WeightInfo = ();
    type MaxMessagesPerSession = MaxMessagesPerSession;
    type MaxActiveConversations = MaxActiveConversations;
    type SessionExpiryBlocks = SessionExpiryBlocks;
}

/// 函数级详细中文注释：DeceasedAI数据提供者适配器
/// - 为 pallet-ai-chat 提供访问 pallet-deceased-ai 的接口
/// - 实现 DeceasedDataProvider trait
pub struct DeceasedAIDataAdapter;
impl pallet_deceased_ai::DeceasedDataProvider<u64, AccountId> for DeceasedAIDataAdapter {
    fn deceased_exists(deceased_id: u64) -> bool {
        pallet_deceased::pallet::DeceasedOf::<Runtime>::contains_key(deceased_id)
    }

    fn is_deceased_owner(who: &AccountId, deceased_id: u64) -> bool {
        if let Some(d) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(deceased_id) {
            d.owner == *who
        } else {
            false
        }
    }

    fn get_deceased_works(
        deceased_id: u64,
        offset: u32,
        limit: u32,
    ) -> Result<(Vec<u64>, u32), sp_runtime::DispatchError> {
        // 从 WorksByDeceased 存储读取该逝者的所有作品 ID
        let all_work_ids = pallet_deceased::pallet::WorksByDeceased::<Runtime>::get(deceased_id);

        // 计算总数
        let total = all_work_ids.len() as u32;

        // 应用分页
        let start = offset as usize;
        let end = core::cmp::min(start + limit as usize, all_work_ids.len());

        // 返回分页结果
        let paged_ids: Vec<u64> = all_work_ids[start..end].to_vec();

        Ok((paged_ids, total))
    }

    fn get_work_details(work_id: u64) -> Result<pallet_deceased_ai::ExportedWork, sp_runtime::DispatchError> {
        // 从 DeceasedWorks 存储读取作品信息
        let work = pallet_deceased::pallet::DeceasedWorks::<Runtime>::get(work_id)
            .ok_or(sp_runtime::DispatchError::Other("WorkNotFound"))?;

        // 转换 WorkType 枚举为字符串
        let work_type_str = work.work_type.as_str();
        let work_type_bytes: Vec<u8> = work_type_str.as_bytes().to_vec();
        let work_type_bounded = frame_support::BoundedVec::try_from(work_type_bytes)
            .map_err(|_| sp_runtime::DispatchError::Other("WorkTypeConversionFailed"))?;

        // 计算 AI 训练权重
        let ai_weight = work.ai_training_weight();

        // 构建 ExportedWork 结构
        Ok(pallet_deceased_ai::ExportedWork {
            work_id,
            deceased_id: work.deceased_id,
            work_type_str: work_type_bounded,
            title: work.title,
            description: work.description,
            ipfs_cid: work.ipfs_cid,
            file_size: work.file_size,
            created_at: work.created_at,
            tags: work.tags,
            sentiment: work.sentiment,
            style_tags: work.style_tags,
            expertise_fields: work.expertise_fields,
            ai_weight,
        })
    }

    fn get_ai_training_works(deceased_id: u64) -> Result<Vec<u64>, sp_runtime::DispatchError> {
        // 从 WorksByDeceased 存储读取该逝者的所有作品 ID
        let all_work_ids = pallet_deceased::pallet::WorksByDeceased::<Runtime>::get(deceased_id);

        // 过滤出 ai_training_enabled == true 的作品
        let mut ai_training_works = Vec::new();
        for work_id in all_work_ids.iter() {
            if let Some(work) = pallet_deceased::pallet::DeceasedWorks::<Runtime>::get(work_id) {
                if work.ai_training_enabled {
                    ai_training_works.push(*work_id);
                }
            }
        }

        Ok(ai_training_works)
    }
}

// ========= Deposits（通用押金管理） =========
// 函数级中文注释：通用押金管理模块配置
// - 统一管理申诉押金、审核押金、投诉押金
// - 资金安全：使用Currency trait冻结押金
// - 权限控制：释放和罚没需要治理权限
// [已归档 2025-11-03] 迁移到 Holds API，参考 pallet-stardust-appeals
/*
impl pallet_deposits::Config for Runtime {
    /// 事件类型
    type RuntimeEvent = RuntimeEvent;
    
    /// 函数级中文注释：货币类型（DUST）
    /// - 使用Balances模块管理押金
    type Currency = Balances;
    
    /// 函数级中文注释：释放押金的权限
    /// - Root权限：超级管理员
    /// - 内容委员会2/3多数：去中心化治理
    /// - 用于批准申诉后的全额退回
    type ReleaseOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    
    /// 函数级中文注释：罚没押金的权限
    /// - Root权限：超级管理员
    /// - 内容委员会2/3多数：去中心化治理
    /// - 用于驳回申诉后的部分罚没（10%）
    type SlashOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, pallet_collective::Instance3, 2, 3>,
    >;
    
    /// 函数级中文注释：每个账户最多可持有的押金数量（100个）
    /// - 防止状态膨胀
    /// - 一般用户足够使用（申诉+投诉+审核）
    /// M-2修复：提高上限 100 → 128，支持更多并发押金
    type MaxDepositsPerAccount = frame_support::traits::ConstU32<128>;
}
*/

// ========= 🆕 2025-11-03 Frontier: EVM 配置 =========
// ⚠️ 临时禁用以排查 runtime 启动问题
// pub mod evm;
// pub use evm::*;

// ========= 🆕 2025-01-20 Governance Params 配置 =========
pub mod governance_params;

// ========= 🆕 2025-11-17 Social（社交关系管理）配置 =========

/// 函数级详细中文注释：社交关注系统目标验证器
///
/// ### 职责
/// - 验证不同类型目标的存在性
/// - 检查用户对目标的管理权限
/// - 验证目标的可见性和访问控制
///
/// ### 实现逻辑
/// - **Deceased**：从 pallet-deceased 查询逝者信息
/// - **User**：检查账户是否存在（系统账户或已活跃账户）
/// - **Grave**：从 pallet-stardust-grave 查询墓地信息（如果启用）
/// - **Pet**：从 pallet-stardust-pet 查询宠物信息
/// - **Memorial**：从 pallet-memorial 查询纪念馆信息
///
/// ### 设计理念
/// - 解耦验证逻辑：social pallet 不直接依赖其他 pallet
/// - 运行时注入：runtime 层面实现具体验证逻辑
/// - 类型扩展：新增目标类型时只需扩展此实现
pub struct SocialTargetValidator;

impl pallet_social::TargetValidator<AccountId> for SocialTargetValidator {
    /// 函数级中文注释：验证目标是否存在
    fn target_exists(target: &pallet_social::Target) -> bool {
        use pallet_social::TargetType;

        match target.target_type {
            // 逝者：检查 deceased 是否存在
            TargetType::Deceased => {
                pallet_deceased::pallet::DeceasedOf::<Runtime>::contains_key(target.target_id)
            },

            // 用户：暂时允许所有用户（未来可添加账户验证）
            TargetType::User => {
                // TODO: 可以添加账户是否已活跃的检查
                // frame_system::pallet::Account::<Runtime>::contains_key(&account_id)
                true
            },

            // 墓地：检查 grave 是否存在（如果启用）
            TargetType::Grave => {
                // 🗑️ 2025-11-16: pallet_stardust_grave 已删除
                // pallet_stardust_grave::pallet::Graves::<Runtime>::contains_key(target.target_id)
                false  // 暂时禁用，等待新的 memorial-space 实现
            },

            // 宠物：检查 pet 是否存在
            TargetType::Pet => {
                pallet_stardust_pet::pallet::PetOf::<Runtime>::contains_key(target.target_id)
            },

            // 纪念馆：暂时禁用，等待具体需求
            TargetType::Memorial => {
                // TODO: 实现 memorial hall 的验证逻辑
                false
            },
        }
    }

    /// 函数级中文注释：验证用户是否有权限管理目标
    fn can_manage_target(who: &AccountId, target: &pallet_social::Target) -> bool {
        use pallet_social::TargetType;

        match target.target_type {
            // 逝者：检查是否为 owner
            TargetType::Deceased => {
                if let Some(deceased) = pallet_deceased::pallet::DeceasedOf::<Runtime>::get(target.target_id) {
                    deceased.owner == *who
                } else {
                    false
                }
            },

            // 用户：只能管理自己
            TargetType::User => {
                // 将 target_id 转换为 AccountId 进行比较
                // 注意：这里假设 target_id 是账户的某种标识符
                // 实际实现可能需要更复杂的映射逻辑
                // TODO: 实现 user_id → AccountId 的映射
                true  // 暂时允许，实际应该检查 target_id 对应的账户是否为 who
            },

            // 墓地：检查是否为 owner（如果启用）
            TargetType::Grave => {
                // 🗑️ 2025-11-16: pallet_stardust_grave 已删除
                false
            },

            // 宠物：检查是否为 owner
            TargetType::Pet => {
                if let Some(pet) = pallet_stardust_pet::pallet::PetOf::<Runtime>::get(target.target_id) {
                    pet.owner == *who
                } else {
                    false
                }
            },

            // 纪念馆：暂时禁用
            TargetType::Memorial => {
                // TODO: 实现 memorial hall 的权限检查
                false
            },
        }
    }

    /// 函数级中文注释：验证目标是否可见（用于关注前检查）
    fn is_target_visible(_who: &AccountId, target: &pallet_social::Target) -> bool {
        use pallet_social::TargetType;

        match target.target_type {
            // 逝者：检查可见性设置
            TargetType::Deceased => {
                // 使用 VisibilityOf 存储检查可见性
                // 如果 VisibilityOf 返回 None，表示公开（默认值）
                pallet_deceased::pallet::VisibilityOf::<Runtime>::get(target.target_id)
                    .unwrap_or(true)  // None 视为 true（默认公开）
            },

            // 用户：默认公开
            TargetType::User => true,

            // 墓地：检查可见性（如果启用）
            TargetType::Grave => false,  // 🗑️ 2025-11-16: 已删除

            // 宠物：默认公开（Pet 结构体没有可见性字段）
            TargetType::Pet => {
                // Pet 默认公开，只要存在就可见
                pallet_stardust_pet::pallet::PetOf::<Runtime>::contains_key(target.target_id)
            },

            // 纪念馆：暂时禁用
            TargetType::Memorial => {
                // TODO: 实现 memorial hall 的可见性检查
                false
            },
        }
    }
}

/// 函数级详细中文注释：社交关系管理模块配置
///
/// ### 功能定位
/// - 统一管理多种类型目标的关注关系
/// - 支持 Deceased、User、Grave、Pet、Memorial 等目标类型
/// - 提供双向索引（关注列表 + 关注者列表）
/// - 兼容 pallet-deceased 的原有关注功能
///
/// ### 配置参数
/// - **MaxFollowersPerTarget**: 每个目标最多关注者数量（10,000）
///   - 继承自 deceased 的 MaxFollowers 参数
///   - 防止热门目标的关注者列表过大
///
/// - **MaxFollowingPerUser**: 每个用户最多关注数量（1,000）
///   - 防止用户无限制关注导致的存储膨胀
///   - 一般用户完全足够使用
///
/// - **MaxBatchSize**: 批量操作最大数量（100）
///   - 单次批量关注/取消关注的最大目标数量
///   - 平衡用户体验和 Gas 消耗
///
/// ### 目标验证器
/// - 使用 SocialTargetValidator 实现跨 pallet 验证
/// - 验证目标存在性、权限和可见性
/// - 支持未来扩展新的目标类型
impl pallet_social::Config for Runtime {
    /// 事件类型
    type RuntimeEvent = RuntimeEvent;

    /// 函数级中文注释：每个目标最多关注者数量（10,000）
    /// - 继承自 pallet-deceased 的 MaxFollowers
    /// - 防止热门目标（如名人逝者）的关注者列表过大
    /// - 达到上限后新关注会失败
    type MaxFollowersPerTarget = frame_support::traits::ConstU32<10_000>;

    /// 函数级中文注释：每个用户最多关注数量（1,000）
    /// - 防止用户无限制关注导致存储膨胀
    /// - 1,000 个关注对象对一般用户完全足够
    /// - 达到上限后无法继续关注
    type MaxFollowingPerUser = frame_support::traits::ConstU32<1_000>;

    /// 函数级中文注释：批量操作最大数量（100）
    /// - 单次 batch_follow 或 batch_unfollow 的最大目标数量
    /// - 平衡用户体验和 Gas 消耗
    /// - 超过上限会返回错误
    type MaxBatchSize = frame_support::traits::ConstU32<100>;

    /// 函数级中文注释：目标验证器
    /// - 使用 SocialTargetValidator 实现跨 pallet 验证
    /// - 验证目标存在性、权限和可见性
    /// - 解耦 social pallet 与其他 pallet 的直接依赖
    type TargetValidator = SocialTargetValidator;
}

/// 函数级详细中文注释：八字排盘系统配置 v1.0.0
///
/// ### 功能定位
/// - 实现中国传统命理八字排盘计算
/// - 支持四柱、大运、五行强度、喜用神判断
/// - ⭐ 唯一支持子时双模式的区块链八字系统
///
/// ### 配置参数
/// - **MaxChartsPerAccount**: 每个账户最多创建的八字数量（10）
///   - 防止存储膨胀
///   - 一般用户需要的八字数量（自己+家人）足够使用
///
/// - **MaxDaYunSteps**: 大运最大步数（12）
///   - 每步大运10年，12步共120年
///   - 覆盖人类正常寿命范围
///
/// - **MaxCangGan**: 每个地支最多藏干数量（3）
///   - 地支藏干最多3个（主气+中气+余气）
///   - 固定值，命理学标准
///
/// ### 技术特性
/// - 儒略日数算法（日柱计算）
/// - 立春边界处理（年柱计算）
/// - 五虎遁口诀（月柱计算）
/// - 五鼠遁口诀（时柱计算）
/// - 权威藏干表（辰=戊乙癸）
/// - 子时双模式支持
impl pallet_bazi_chart::Config for Runtime {
    /// 权重信息（使用默认实现）
    type WeightInfo = ();

    /// 函数级中文注释：每个账户最多创建的八字数量（10）
    /// - 防止用户无限创建导致存储膨胀
    /// - 10个八字对家庭使用完全足够（自己+父母+配偶+子女等）
    /// - 达到上限后无法继续创建
    type MaxChartsPerAccount = frame_support::traits::ConstU32<10>;

    /// 函数级中文注释：大运最大步数（12步，120年）
    /// - 每步大运10年
    /// - 12步共120年，覆盖人类正常寿命
    /// - 命理学标准配置
    type MaxDaYunSteps = frame_support::traits::ConstU32<12>;

    /// 函数级中文注释：每个地支最多藏干数量（3个）
    /// - 主气 + 中气 + 余气
    /// - 命理学固定配置
    /// - 例：辰藏干为 戊（主）、乙（中）、癸（余）
    type MaxCangGan = frame_support::traits::ConstU32<3>;
}

// ========= 🆕 2025-11-29 梅花易数系统（区块链占卜）=========

/// 函数级详细中文注释：梅花易数排盘 Pallet 配置
///
/// ### 功能定位
/// - 实现区块链上的梅花易数排盘系统
/// - 支持时间起卦、双数起卦、随机起卦、手动起卦
/// - 卦象存储与查询、AI 解卦请求
///
/// ### 配置参数
/// - **MaxUserHexagrams**: 每用户最大卦象数（100）
/// - **MaxPublicHexagrams**: 公开卦象列表上限（1000）
/// - **DailyFreeDivinations**: 每日免费起卦次数（3）
/// - **MaxDailyDivinations**: 每日最大起卦次数（20）
/// - **AiInterpretationFee**: AI 解卦费用（10 DUST）
impl pallet_meihua::Config for Runtime {
    type Currency = Balances;
    type Randomness = SimpleRandomness;
    type MaxUserHexagrams = frame_support::traits::ConstU32<100>;
    type MaxPublicHexagrams = frame_support::traits::ConstU32<1000>;
    type DailyFreeDivinations = frame_support::traits::ConstU32<3>;
    type MaxDailyDivinations = frame_support::traits::ConstU32<20>;
    type AiInterpretationFee = frame_support::traits::ConstU128<{ 10 * UNIT }>;
    type TreasuryAccount = TreasuryAccount;
    type AiOracleOrigin = frame_system::EnsureRoot<AccountId>;
}

/// 函数级详细中文注释：梅花易数 AI 解卦 Pallet 配置
///
/// ### 功能定位
/// - 基于链下预言机的 AI 智能解卦系统
/// - 预言机节点注册与管理
/// - 解读结果提交与存储
///
/// ### 配置参数
/// - **BaseInterpretationFee**: 基础解读费用（5 DUST）
/// - **MinOracleStake**: 预言机最低质押（1000 DUST）
// 🗑️ 2025-12-01 已删除：pallet-meihua-ai/market/nft 功能已抽离到通用模块 pallet-divination-ai/market/nft
// /// - **DisputeDeposit**: 争议押金（50 DUST）
// /// - **RequestTimeout**: 请求超时（1小时 = 600块）
// /// - **ProcessingTimeout**: 处理超时（24小时 = 14400块）
// /// - **DisputePeriod**: 争议期限（7天 = 100800块）
// impl pallet_meihua_ai::Config for Runtime {
//     type Currency = Balances;
//     type Randomness = SimpleRandomness;
//     type BaseInterpretationFee = frame_support::traits::ConstU128<{ 5 * UNIT }>;
//     type MinOracleStake = frame_support::traits::ConstU128<{ 1000 * UNIT }>;
//     type DisputeDeposit = frame_support::traits::ConstU128<{ 50 * UNIT }>;
//     type RequestTimeout = frame_support::traits::ConstU32<600>;
//     type ProcessingTimeout = frame_support::traits::ConstU32<14400>;
//     type DisputePeriod = frame_support::traits::ConstU32<100800>;
//     type MaxCidLength = frame_support::traits::ConstU32<64>;
//     type MaxOracles = frame_support::traits::ConstU32<100>;
//     type TreasuryAccount = TreasuryAccount;
//     type ArbitratorOrigin = frame_system::EnsureRoot<AccountId>;
//     type GovernanceOrigin = frame_system::EnsureRoot<AccountId>;
// }
//
// /// 函数级详细中文注释：梅花易数占卜服务市场 Pallet 配置
// ///
// /// ### 功能定位
// /// - 去中心化的占卜服务交易市场
// /// - 服务提供者注册与管理
// /// - 订单创建与流转、评价与信誉系统
// ///
// /// ### 配置参数
// /// - **MinDeposit**: 服务提供者最小保证金（100 DUST）
// /// - **MinServicePrice**: 最小服务价格（1 DUST）
// /// - **OrderTimeout**: 订单超时（48小时 = 28800块）
// /// - **AcceptTimeout**: 接单超时（2小时 = 1200块）
// /// - **ReviewPeriod**: 评价期限（7天 = 100800块）
// /// - **WithdrawalCooldown**: 提现冷却期（24小时 = 14400块）
// impl pallet_meihua_market::Config for Runtime {
//     type Currency = Balances;
//     type MinDeposit = frame_support::traits::ConstU128<{ 100 * UNIT }>;
//     type MinServicePrice = frame_support::traits::ConstU128<{ 1 * UNIT }>;
//     type OrderTimeout = frame_support::traits::ConstU32<28800>;
//     type AcceptTimeout = frame_support::traits::ConstU32<1200>;
//     type ReviewPeriod = frame_support::traits::ConstU32<100800>;
//     type WithdrawalCooldown = frame_support::traits::ConstU32<14400>;
//     type MaxNameLength = frame_support::traits::ConstU32<64>;
//     type MaxBioLength = frame_support::traits::ConstU32<256>;
//     type MaxDescriptionLength = frame_support::traits::ConstU32<1024>;
//     type MaxCidLength = frame_support::traits::ConstU32<64>;
//     type MaxPackagesPerProvider = frame_support::traits::ConstU32<10>;
//     type MaxFollowUpsPerOrder = frame_support::traits::ConstU32<5>;
//     type PlatformAccount = TreasuryAccount;
//     type GovernanceOrigin = frame_system::EnsureRoot<AccountId>;
// }
//
// /// 函数级详细中文注释：梅花易数 NFT Pallet 配置
// ///
// /// ### 功能定位
// /// - 卦象 NFT 铸造、交易、收藏系统
// /// - 根据卦象特征自动判定稀有度
// /// - 版税分配、出价机制
// ///
// /// ### 配置参数
// /// - **BaseMintFee**: 基础铸造费用（10 DUST）
// /// - **PlatformFeeRate**: 平台手续费率（2.5% = 250/10000）
// /// - **MaxRoyaltyRate**: 最大版税比例（10% = 1000/10000）
// /// - **OfferValidityPeriod**: 出价有效期（7天 = 100800块）
// ///
// /// ### HexagramProvider 实现
// /// - 通过 pallet_meihua::Pallet 提供卦象数据查询
// impl pallet_meihua_nft::Config for Runtime {
//     type NftCurrency = Balances;
//     type HexagramProvider = MeihuaHexagramProvider;
//     type MaxNameLength = frame_support::traits::ConstU32<64>;
//     type MaxCidLength = frame_support::traits::ConstU32<64>;
//     type MaxCollectionsPerUser = frame_support::traits::ConstU32<100>;
//     type MaxNftsPerCollection = frame_support::traits::ConstU32<1000>;
//     type MaxOffersPerNft = frame_support::traits::ConstU32<100>;
//     type BaseMintFee = frame_support::traits::ConstU128<{ 10 * UNIT }>;
//     type PlatformFeeRate = frame_support::traits::ConstU16<250>;
//     type MaxRoyaltyRate = frame_support::traits::ConstU16<1000>;
//     type OfferValidityPeriod = frame_support::traits::ConstU32<100800>;
//     type PlatformAccount = TreasuryAccount;
//     type GovernanceOrigin = frame_system::EnsureRoot<AccountId>;
// }
//
// /// 梅花易数卦象数据提供者实现
// ///
// /// 连接 pallet-meihua-nft 与 pallet-meihua
// /// 实现 HexagramProvider trait，提供卦象存在性检查、创建者查询、卦象数据查询
// pub struct MeihuaHexagramProvider;
//
// impl pallet_meihua_nft::pallet::HexagramProvider<AccountId> for MeihuaHexagramProvider {
//     /// 检查卦象是否存在
//     fn hexagram_exists(hexagram_id: u64) -> bool {
//         pallet_meihua::Hexagrams::<Runtime>::contains_key(hexagram_id)
//     }
//
//     /// 获取卦象创建者
//     fn hexagram_creator(hexagram_id: u64) -> Option<AccountId> {
//         pallet_meihua::Hexagrams::<Runtime>::get(hexagram_id)
//             .map(|divination| divination.ben_gua.diviner)
//     }
//
//     /// 获取卦象数据（用于稀有度计算）
//     fn hexagram_data(hexagram_id: u64) -> Option<pallet_meihua_nft::pallet::HexagramData> {
//         pallet_meihua::Hexagrams::<Runtime>::get(hexagram_id).map(|divination| {
//             // 从时间戳转换为农历日期
//             let (lunar_month, lunar_day) = pallet_meihua::lunar::timestamp_to_lunar(divination.ben_gua.timestamp)
//                 .map(|lunar| (lunar.month, lunar.day))
//                 .unwrap_or((1, 1)); // 转换失败时使用默认值
//
//             pallet_meihua_nft::pallet::HexagramData {
//                 upper_trigram: divination.ben_gua.shang_gua.number(),
//                 lower_trigram: divination.ben_gua.xia_gua.number(),
//                 lunar_month,
//                 lunar_day,
//             }
//         })
//     }
// }

// ========= 🆕 2025-11-28 Chat Permission（聊天权限系统）=========

/// 函数级详细中文注释：聊天权限系统配置 v4.0
///
/// ### 功能定位
/// - 实现基于场景的多场景共存聊天权限控制
/// - 支持多种场景类型：做市商、订单、纪念馆、群聊、自定义
/// - 四层权限判断：黑名单 → 好友 → 场景授权 → 隐私设置
///
/// ### 配置参数
/// - **MaxBlockListSize**: 每个用户最大黑名单数量（100）
/// - **MaxWhitelistSize**: 每个用户最大白名单数量（100）
/// - **MaxScenesPerPair**: 每对用户间最大场景授权数量（20）
///
/// ### 设计理念
/// - 场景授权：业务 pallet 在创建订单/纪念馆时自动授予聊天权限
/// - 双向存储：使用排序后的用户对作为 key，保证一致性
/// - 过期清理：支持场景授权自动过期
/// - 低耦合：通过 trait 与业务 pallet 解耦
/// - 🔴 stable2506 API 变更：RuntimeEvent 自动继承，无需显式设置
impl pallet_chat_permission::Config for Runtime {
    /// 函数级中文注释：每个用户最大黑名单数量（100）
    /// - 防止存储膨胀
    /// - 100 个黑名单对普通用户完全足够
    type MaxBlockListSize = frame_support::traits::ConstU32<100>;

    /// 函数级中文注释：每个用户最大白名单数量（100）
    /// - 仅在 Whitelist 模式下生效
    /// - 控制存储开销
    type MaxWhitelistSize = frame_support::traits::ConstU32<100>;

    /// 函数级中文注释：每对用户间最大场景授权数量（20）
    /// - 同一对用户可以有多个场景授权（如订单+做市商）
    /// - 20 个授权足够覆盖所有业务场景
    type MaxScenesPerPair = frame_support::traits::ConstU32<20>;
}

// ========= 🆕 2025-11-29 通用占卜系统配置 =========

/// 组合占卜结果提供者
///
/// 将多个玄学系统（梅花、八字等）的查询统一路由到各自的 pallet。
/// 这是实现 `DivinationProvider` trait 的运行时适配器。
///
/// ### 支持的占卜类型
/// - Meihua（梅花易数）: 路由到 pallet-meihua
/// - Bazi（八字命理）: 暂未实现（pallet-bazi-chart 使用 Hash 作为 ID）
/// - 其他类型：暂未实现
///
/// ### 设计说明
/// 目前主要支持梅花易数。八字命理由于存储结构不同（使用 Hash 而非 u64 作为 ID），
/// 需要后续进行接口适配。其他玄学系统（六爻、奇门、紫微）将在后续版本中逐步支持。
pub struct CombinedDivinationProvider;

impl pallet_divination_common::DivinationProvider<AccountId> for CombinedDivinationProvider {
    /// 检查占卜结果是否存在
    fn result_exists(divination_type: pallet_divination_common::DivinationType, result_id: u64) -> bool {
        match divination_type {
            pallet_divination_common::DivinationType::Meihua => {
                pallet_meihua::Hexagrams::<Runtime>::contains_key(result_id)
            }
            // 其他类型暂未实现
            _ => false,
        }
    }

    /// 获取占卜结果的创建者
    fn result_creator(
        divination_type: pallet_divination_common::DivinationType,
        result_id: u64,
    ) -> Option<AccountId> {
        match divination_type {
            pallet_divination_common::DivinationType::Meihua => {
                pallet_meihua::Hexagrams::<Runtime>::get(result_id)
                    .map(|h| h.ben_gua.diviner)
            }
            _ => None,
        }
    }

    /// 获取稀有度计算数据
    fn rarity_data(
        divination_type: pallet_divination_common::DivinationType,
        result_id: u64,
    ) -> Option<pallet_divination_common::RarityInput> {
        match divination_type {
            pallet_divination_common::DivinationType::Meihua => {
                pallet_meihua::Hexagrams::<Runtime>::get(result_id).map(|divination| {
                    // 判断是否为纯卦（上下卦相同）
                    let is_pure = divination.ben_gua.shang_gua == divination.ben_gua.xia_gua;
                    // 从时间戳转换为农历日期判断特殊日期
                    let is_special = pallet_meihua::lunar::timestamp_to_lunar(divination.ben_gua.timestamp)
                        .map(|lunar| {
                            // 重阳节（九月初九）或其他特殊日期
                            (lunar.month == 9 && lunar.day == 9) ||
                            (lunar.month == 1 && lunar.day == 1) ||  // 春节
                            (lunar.month == 5 && lunar.day == 5)     // 端午
                        })
                        .unwrap_or(false);

                    pallet_divination_common::RarityInput {
                        primary_score: if is_pure { 80 } else { 30 },
                        secondary_score: 10,
                        is_special_date: is_special,
                        is_special_combination: is_pure,
                        custom_factors: [0, 0, 0, 0],
                    }
                })
            }
            _ => None,
        }
    }

    /// 获取占卜结果摘要（用于 AI 解读）
    fn result_summary(
        divination_type: pallet_divination_common::DivinationType,
        result_id: u64,
    ) -> Option<alloc::vec::Vec<u8>> {
        match divination_type {
            pallet_divination_common::DivinationType::Meihua => {
                pallet_meihua::Hexagrams::<Runtime>::get(result_id).map(|divination| {
                    // 生成梅花卦象摘要
                    // bian_gua 是 (上卦, 下卦) 元组
                    let summary = alloc::format!(
                        "Meihua Hexagram: Ben={:?}/{:?}, Bian={:?}/{:?}, Dong={}",
                        divination.ben_gua.shang_gua,
                        divination.ben_gua.xia_gua,
                        divination.bian_gua.0,  // 变卦上卦
                        divination.bian_gua.1,  // 变卦下卦
                        divination.ben_gua.dong_yao
                    );
                    summary.into_bytes()
                })
            }
            _ => None,
        }
    }

    /// 检查是否可以铸造为 NFT
    ///
    /// 注意：pallet-meihua 的 FullDivination 结构体中没有 is_nfted 字段，
    /// 需要通过 pallet-divination-nft 的 ResultNftMapping 来检查是否已铸造。
    /// 这里简化处理：只检查卦象是否存在，实际的铸造检查由 NFT 模块负责。
    fn is_nftable(divination_type: pallet_divination_common::DivinationType, result_id: u64) -> bool {
        match divination_type {
            pallet_divination_common::DivinationType::Meihua => {
                pallet_meihua::Hexagrams::<Runtime>::contains_key(result_id)
            }
            _ => false,
        }
    }

    /// 标记为已铸造 NFT
    ///
    /// 注意：由于 pallet-meihua 的 FullDivination 结构体中没有 is_nfted 字段，
    /// 此方法为空操作。实际的 NFT 铸造记录由 pallet-divination-nft 的 ResultNftMapping 管理。
    fn mark_as_nfted(_divination_type: pallet_divination_common::DivinationType, _result_id: u64) {
        // 空操作 - NFT 铸造状态由 pallet-divination-nft 自行管理
    }
}

/// 函数级详细中文注释：通用占卜 NFT Pallet 配置
///
/// ### 功能定位
/// - 支持多种占卜类型的 NFT 铸造与交易
/// - 基于占卜结果自动计算稀有度
/// - 版税分配、出价机制
///
/// ### 配置参数
/// - **BaseMintFee**: 基础铸造费用（10 DUST）
/// - **PlatformFeeRate**: 平台手续费率（2.5% = 250/10000）
/// - **MaxRoyaltyRate**: 最大版税比例（10% = 1000/10000）
/// - **OfferValidityPeriod**: 出价有效期（7天 = 100800块）
impl pallet_divination_nft::Config for Runtime {
    type NftCurrency = Balances;
    type DivinationProvider = CombinedDivinationProvider;
    type MaxNameLength = frame_support::traits::ConstU32<64>;
    type MaxCidLength = frame_support::traits::ConstU32<64>;
    type MaxCollectionsPerUser = frame_support::traits::ConstU32<100>;
    type MaxNftsPerCollection = frame_support::traits::ConstU32<1000>;
    type MaxOffersPerNft = frame_support::traits::ConstU32<100>;
    type BaseMintFee = frame_support::traits::ConstU128<{ 10 * UNIT }>;
    type PlatformFeeRate = frame_support::traits::ConstU16<250>;
    type MaxRoyaltyRate = frame_support::traits::ConstU16<1000>;
    type OfferValidityPeriod = frame_support::traits::ConstU32<100800>;
    type PlatformAccount = TreasuryAccount;
    type GovernanceOrigin = frame_system::EnsureRoot<AccountId>;
}

/// 函数级详细中文注释：通用占卜 AI 解读 Pallet 配置
///
/// ### 功能定位
/// - 基于预言机网络的多类型 AI 智能解读
/// - 支持不同占卜类型的专业解读
/// - 质量评估与争议处理
///
/// ### 配置参数
/// - **BaseInterpretationFee**: 基础解读费用（5 DUST）
/// - **MinOracleStake**: 预言机最低质押（100 DUST）
/// - **DisputeDeposit**: 争议押金（10 DUST）
/// - **RequestTimeout**: 请求超时（1小时 = 600块）
/// - **ProcessingTimeout**: 处理超时（4小时 = 2400块）
/// - **DisputePeriod**: 争议期限（24小时 = 14400块）
impl pallet_divination_ai::Config for Runtime {
    type AiCurrency = Balances;
    type DivinationProvider = CombinedDivinationProvider;
    type BaseInterpretationFee = frame_support::traits::ConstU128<{ 5 * UNIT }>;
    type MinOracleStake = frame_support::traits::ConstU128<{ 100 * UNIT }>;
    type DisputeDeposit = frame_support::traits::ConstU128<{ 10 * UNIT }>;
    type RequestTimeout = frame_support::traits::ConstU32<600>;
    type ProcessingTimeout = frame_support::traits::ConstU32<2400>;
    type DisputePeriod = frame_support::traits::ConstU32<14400>;
    type MaxCidLength = frame_support::traits::ConstU32<64>;
    type MaxOracles = frame_support::traits::ConstU32<100>;
    type TreasuryAccount = TreasuryAccount;
    type ArbitratorOrigin = frame_system::EnsureRoot<AccountId>;
    type GovernanceOrigin = frame_system::EnsureRoot<AccountId>;
}

/// 函数级详细中文注释：通用占卜服务市场 Pallet 配置
///
/// ### 功能定位
/// - 去中心化的多类型占卜服务交易市场
/// - 服务提供者注册与等级管理
/// - 订单流转、评价与信誉系统
///
/// ### 配置参数
/// - **MinDeposit**: 服务提供者最小保证金（100 DUST）
/// - **MinServicePrice**: 最小服务价格（1 DUST）
/// - **OrderTimeout**: 订单超时（48小时 = 28800块）
/// - **AcceptTimeout**: 接单超时（2小时 = 1200块）
/// - **ReviewPeriod**: 评价期限（7天 = 100800块）
/// - **WithdrawalCooldown**: 提现冷却期（24小时 = 14400块）
impl pallet_divination_market::Config for Runtime {
    type Currency = Balances;
    type DivinationProvider = CombinedDivinationProvider;
    type MinDeposit = frame_support::traits::ConstU128<{ 100 * UNIT }>;
    type MinServicePrice = frame_support::traits::ConstU128<{ 1 * UNIT }>;
    type OrderTimeout = frame_support::traits::ConstU32<28800>;
    type AcceptTimeout = frame_support::traits::ConstU32<1200>;
    type ReviewPeriod = frame_support::traits::ConstU32<100800>;
    type WithdrawalCooldown = frame_support::traits::ConstU32<14400>;
    type MaxNameLength = frame_support::traits::ConstU32<64>;
    type MaxBioLength = frame_support::traits::ConstU32<256>;
    type MaxDescriptionLength = frame_support::traits::ConstU32<1024>;
    type MaxCidLength = frame_support::traits::ConstU32<64>;
    type MaxPackagesPerProvider = frame_support::traits::ConstU32<10>;
    type MaxFollowUpsPerOrder = frame_support::traits::ConstU32<5>;
    type PlatformAccount = TreasuryAccount;
    type GovernanceOrigin = frame_system::EnsureRoot<AccountId>;
}

// ========= 🆕 2025-11-30 塔罗牌排盘系统配置 =========

/// 函数级详细中文注释：塔罗牌排盘 Pallet 配置
///
/// ### 功能定位
/// - 实现区块链上的塔罗牌占卜系统
/// - 支持随机抽牌、时间起卦、数字起卦、手动指定
/// - 多种牌阵支持（单张、三牌、凯尔特十字等）
/// - AI 解读请求（链下预言机触发）
///
/// ### 配置参数
/// - **MaxCardsPerReading**: 每次占卜最大牌数（12张，对应年度运势牌阵）
/// - **MaxUserReadings**: 每用户最大占卜记录数（100）
/// - **MaxPublicReadings**: 公开占卜列表上限（1000）
/// - **DailyFreeDivinations**: 每日免费占卜次数（3）
/// - **MaxDailyDivinations**: 每日最大占卜次数（20）
/// - **AiInterpretationFee**: AI 解读费用（10 DUST）
impl pallet_tarot::Config for Runtime {
    type Currency = Balances;
    type Randomness = SimpleRandomness;
    type MaxCardsPerReading = frame_support::traits::ConstU32<12>;
    type MaxUserReadings = frame_support::traits::ConstU32<100>;
    type MaxPublicReadings = frame_support::traits::ConstU32<1000>;
    type DailyFreeDivinations = frame_support::traits::ConstU32<3>;
    type MaxDailyDivinations = frame_support::traits::ConstU32<20>;
    type AiInterpretationFee = frame_support::traits::ConstU128<{ 10 * UNIT }>;
    type TreasuryAccount = TreasuryAccount;
    type AiOracleOrigin = frame_system::EnsureRoot<AccountId>;
}

// ========= 🆕 2025-12-01 奇门遁甲排盘系统配置 =========

/// 函数级详细中文注释：奇门遁甲排盘 Pallet 配置
///
/// ### 功能定位
/// - 实现区块链上的奇门遁甲排盘系统
/// - 支持时间起局、数字起局、随机起局、手动指定
/// - 完整的四盘排布（天盘、地盘、人盘、神盘）
/// - AI 解读请求（链下预言机触发）
///
/// ### 配置参数
/// - **MaxUserCharts**: 每用户最大排盘记录数（100）
/// - **MaxPublicCharts**: 公开排盘列表上限（1000）
/// - **DailyFreeCharts**: 每日免费排盘次数（3）
/// - **MaxDailyCharts**: 每日最大排盘次数（20）
/// - **AiInterpretationFee**: AI 解读费用（15 DUST，奇门遁甲更复杂）
/// - **MaxCidLen**: IPFS CID 最大长度（64字节）
///
/// ### 奇门遁甲核心功能
/// - 阴阳遁判断：根据节气自动确定
/// - 局数计算：由节气和三元决定（1-9局）
/// - 四盘排布：天盘（九星）、地盘（三奇六仪）、人盘（八门）、神盘（八神）
/// - 值符值使：当值的星和门，是奇门的核心
impl pallet_qimen::Config for Runtime {
    type Currency = Balances;
    type Randomness = SimpleRandomness;
    type MaxUserCharts = frame_support::traits::ConstU32<100>;
    type MaxPublicCharts = frame_support::traits::ConstU32<1000>;
    type DailyFreeCharts = frame_support::traits::ConstU32<3>;
    type MaxDailyCharts = frame_support::traits::ConstU32<20>;
    type AiInterpretationFee = frame_support::traits::ConstU128<{ 15 * UNIT }>;
    type TreasuryAccount = TreasuryAccount;
    type AiOracleOrigin = frame_system::EnsureRoot<AccountId>;
    type MaxCidLen = frame_support::traits::ConstU32<64>;
}

// ============================================================================
// pallet-ziwei: 紫微斗数排盘系统配置
// ============================================================================
//
/// ### 函数级中文注释：紫微斗数排盘系统配置
///
/// 配置紫微斗数 Pallet 的运行时参数：
///
/// - **Currency**: 使用 Balances pallet 进行费用支付
/// - **Randomness**: 使用 SimpleRandomness 生成随机数（用于随机起盘）
/// - **MaxUserCharts**: 每用户最多存储 100 张命盘
/// - **MaxPublicCharts**: 公开命盘列表最多 1000 张
/// - **DailyFreeCharts**: 每日免费排盘次数（3次）
/// - **MaxDailyCharts**: 每日最大排盘次数（20次）
/// - **AiInterpretationFee**: AI 解读费用（10 DUST）
/// - **MaxCidLen**: IPFS CID 最大长度（64字节）
///
/// ### 紫微斗数核心功能
/// - 命宫定位：根据农历月和时辰计算
/// - 五行局计算：根据年干和命宫纳音五行确定
/// - 十四主星安星：紫微星系6星 + 天府星系8星
/// - 六吉六煞安星：辅星和煞星的位置
/// - 四化飞星：生年四化（化禄、化权、化科、化忌）
/// - 大运推算：起运年龄和顺逆行方向
impl pallet_ziwei::Config for Runtime {
    type Currency = Balances;
    type Randomness = SimpleRandomness;
    type MaxUserCharts = frame_support::traits::ConstU32<100>;
    type MaxPublicCharts = frame_support::traits::ConstU32<1000>;
    type DailyFreeCharts = frame_support::traits::ConstU32<3>;
    type MaxDailyCharts = frame_support::traits::ConstU32<20>;
    type AiInterpretationFee = frame_support::traits::ConstU128<{ 10 * UNIT }>;
    type TreasuryAccount = TreasuryAccount;
    type AiOracleOrigin = frame_system::EnsureRoot<AccountId>;
    type MaxCidLen = frame_support::traits::ConstU32<64>;
}

// ============================================================================
// 🆕 2025-12-01 pallet-liuyao 配置（六爻排盘系统）
// ============================================================================
/// # pallet-liuyao 配置
///
/// 六爻排盘是中国传统周易占卜术的核心技法之一，本模块实现了完整的
/// 纳甲六爻排盘算法。
///
/// ## 配置参数
///
/// - **MaxUserGuas**: 每用户最大卦象数量（100个）
/// - **MaxPublicGuas**: 公开卦象列表最大长度（1000个）
/// - **DailyFreeGuas**: 每日免费起卦次数（3次）
/// - **MaxDailyGuas**: 每日最大起卦次数（20次）
/// - **AiInterpretationFee**: AI 解读费用（10 DUST）
/// - **MaxCidLen**: IPFS CID 最大长度（64字节）
///
/// ## 六爻核心功能
///
/// - **起卦方式**: 铜钱起卦、数字起卦、时间起卦、随机起卦、手动指定
/// - **纳甲装卦**: 八卦配天干地支（乾纳甲壬，坤纳乙癸...）
/// - **世应计算**: 寻世诀（天同二世天变五，地同四世地变初...）
/// - **卦宫归属**: 认宫诀（一二三六外卦宫，四五游魂内变更...）
/// - **六亲配置**: 兄弟、父母、官鬼、妻财、子孙
/// - **六神排布**: 青龙、朱雀、勾陈、螣蛇、白虎、玄武
/// - **旬空计算**: 六十甲子旬空
/// - **伏神查找**: 缺失六亲从本宫纯卦寻伏
/// - **变卦生成**: 动爻变化形成变卦
impl pallet_liuyao::Config for Runtime {
    type Randomness = SimpleRandomness;
    type MaxUserGuas = frame_support::traits::ConstU32<100>;
    type MaxPublicGuas = frame_support::traits::ConstU32<1000>;
    type DailyFreeGuas = frame_support::traits::ConstU32<3>;
    type MaxDailyGuas = frame_support::traits::ConstU32<20>;
    type MaxCidLen = frame_support::traits::ConstU32<64>;
}

// ============================================================================
// 🆕 2025-12-01 pallet-daliuren 配置（大六壬排盘系统）
// ============================================================================
/// # pallet-daliuren 配置
///
/// 大六壬是中国古代三式之一（太乙、奇门、六壬），以天人合一、阴阳五行为理论基础，
/// 通过起课、定三传来预测吉凶。
///
/// ## 配置参数
///
/// - **MaxCidLen**: IPFS CID 最大长度（64字节）
/// - **MaxDailyDivinations**: 每日最大起课次数（100次）
/// - **DivinationFee**: 起课费用（1 DUST）
/// - **AiInterpretationFee**: AI 解读费用（5 DUST）
///
/// ## 大六壬核心功能
///
/// - **起课方式**: 时间起课、随机起课、手动指定
/// - **天盘计算**: 月将加占时，天盘顺时针旋转
/// - **四课起法**: 干阳神、干阴神、支阳神、支阴神
/// - **九种课式**: 贼克、比用、涉害、遥克、昂星、别责、八专、伏吟、返吟
/// - **三传推导**: 初传、中传、末传
/// - **天将排布**: 十二天将（贵人为首，顺逆排布）
/// - **AI解读**: 支持请求和存储 AI 对式盘的解读结果
impl pallet_daliuren::Config for Runtime {
    type Currency = Balances;
    type Randomness = SimpleRandomness;
    type MaxCidLen = frame_support::traits::ConstU32<64>;
    type MaxDailyDivinations = frame_support::traits::ConstU32<100>;
    type DivinationFee = frame_support::traits::ConstU128<{ 1 * UNIT }>;
    type AiInterpretationFee = frame_support::traits::ConstU128<{ 5 * UNIT }>;
    type AiSubmitter = frame_system::EnsureSigned<AccountId>;
    type WeightInfo = ();
}

// ============================================================================
// 🆕 2025-12-01 小六壬排盘系统 (pallet-xiaoliuren)
// ============================================================================

/// 函数级中文注释：小六壬排盘 Pallet 配置
///
/// 小六壬又称"诸葛亮马前课"或"掐指速算"，是中国古代流传的一种简易占卜术。
/// 通过六宫（大安、留连、速喜、赤口、小吉、空亡）来预测吉凶。
///
/// ## 配置参数
///
/// - **MaxUserPans**: 每用户最大存储课盘数（1000）
/// - **MaxPublicPans**: 公开课盘列表最大长度（10000）
/// - **MaxCidLen**: IPFS CID 最大长度（64字节）
/// - **DailyFreeDivinations**: 每日免费起课次数（3次）
/// - **MaxDailyDivinations**: 每日最大起课次数（100次）
/// - **AiInterpretationFee**: AI 解读费用（5 DUST）
///
/// ## 六宫含义
///
/// - **大安**：属木，临青龙，吉祥安康
/// - **留连**：属水，临玄武，延迟纠缠
/// - **速喜**：属火，临朱雀，快速喜庆
/// - **赤口**：属金，临白虎，口舌是非
/// - **小吉**：属木，临六合，和合吉利
/// - **空亡**：属土，临勾陈，无果忧虑
///
/// ## 起课方式
///
/// - **时间起课**: 按农历月日时起课（传统方法）
/// - **数字起课**: 活数起课法，三个数字计算三宫
/// - **随机起课**: 使用链上随机数生成
/// - **手动指定**: 直接指定三宫结果
impl pallet_xiaoliuren::Config for Runtime {
    type Currency = Balances;
    type Randomness = SimpleRandomness;
    type MaxUserPans = frame_support::traits::ConstU32<1000>;
    type MaxPublicPans = frame_support::traits::ConstU32<10000>;
    type MaxCidLen = frame_support::traits::ConstU32<64>;
    type DailyFreeDivinations = frame_support::traits::ConstU32<3>;
    type MaxDailyDivinations = frame_support::traits::ConstU32<100>;
    type AiInterpretationFee = frame_support::traits::ConstU128<{ 5 * UNIT }>;
    type TreasuryAccount = TreasuryAccount;
    type AiOracleOrigin = frame_system::EnsureSigned<AccountId>;
}

