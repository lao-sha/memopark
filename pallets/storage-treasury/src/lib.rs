#![cfg_attr(not(feature = "std"), no_std)]
#![allow(deprecated)]

//! # pallet-storage-treasury
//! 
//! ## 模块概述
//! 
//! 去中心化存储费用专用账户管理模块，负责：
//! - 收集供奉产生的存储费用（通常为 2%）
//! - 通过路由表自动分配给 IPFS/Arweave/Filecoin 等存储服务提供商
//! - 资金统计、审计和治理控制
//! - 存储运营者激励分配
//! 
//! ## 设计原理
//! 
//! ### 完全自动化分配
//! - 采用路由表机制，委员会治理分配规则
//! - 每周自动执行资金分配，无需人工干预
//! - 移除手动支付功能，确保规则一致性
//! 
//! ### 资金流向
//! ```
//! 供奉路由 2% → StorageTreasury 托管账户
//!     ↓
//! IPFS pin 费用 → StorageTreasury 托管账户
//!     ↓
//! 【每周自动触发】OnInitialize
//!     ↓
//! 读取 StorageRouteTable（委员会治理）
//!     ↓
//! ├─ IPFS 运营者池 50%
//! ├─ Arweave 运营者池 30%
//! └─ 节点运维激励 20%
//! ```
//! 
//! ### 账户派生
//! - PalletId: `py/dstor` (Decentralized Storage)
//! - 账户地址：`DecentralizedStoragePalletId.into_account_truncating()`
//! - 无私钥控制，仅通过链上逻辑操作
//! 
//! ## 接口
//! 
//! ### 可调用接口（Extrinsics）
//! 
//! #### 治理接口（需要 GovernanceOrigin）
//! - `set_storage_route_table(routes)` - 设置存储费用分配路由表
//! - `withdraw(dest, amount)` - 提取资金到指定账户（紧急情况使用）
//! 
//! ### 查询接口（RPC）
//! - `total_collected()` - 累计收集的总金额
//! - `total_distributed()` - 累计分配的总金额
//! - `current_balance()` - 当前账户余额
//! - `route_table()` - 当前路由表配置
//! - `distribution_history(block)` - 分配历史记录
//! 
//! ## 事件
//! - `FundsReceived { from, amount }` - 收到存储费用
//! - `RouteTableUpdated { routes }` - 路由表更新
//! - `RouteDistributed { kind, to, amount }` - 单笔路由分配
//! - `AutoDistributionCompleted { total_amount }` - 自动分配完成
//! - `Withdrawn { to, amount }` - 治理提取
//! 
//! ## 错误
//! - `InsufficientBalance` - 账户余额不足
//! - `InvalidAmount` - 金额无效（为0或过大）
//! - `RouteTableTooLong` - 路由表条目过多
//! - `InvalidRouteTable` - 路由表无效（总和超过100%）
//! - `EmptyRouteTable` - 路由表为空
//! 
//! ## 路由类型
//! - 0 = IPFS 运营者池
//! - 1 = Arweave 运营者池
//! - 2 = Filecoin 运营者池
//! - 3 = 节点运维激励池
//! - 4 = 存储研发基金
//! - 5-255 = 预留（未来扩展）

extern crate alloc;
use alloc::vec::Vec;

use codec::{Decode, Encode, MaxEncodedLen};
use scale_info::TypeInfo;

use frame_support::{
    pallet_prelude::*,
    traits::{Currency, ExistenceRequirement, Get},
    PalletId,
};
use frame_system::pallet_prelude::*;
use sp_runtime::{
    traits::{AccountIdConversion, Saturating, Zero},
    Permill,
};

pub use pallet::*;

/// 函数级中文注释：余额类型别名
type BalanceOf<T> = <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

/// 函数级详细中文注释：存储路由条目结构
/// - 定义存储费用的分配规则
/// - 由委员会治理，通过 set_storage_route_table 修改
/// 
/// 字段说明：
/// - kind: 路由类型（0-255）
///   * 0 = IPFS 运营者池
///   * 1 = Arweave 运营者池
///   * 2 = Filecoin 运营者池
///   * 3 = 节点运维激励池
///   * 4 = 存储研发基金
///   * 5-255 = 预留
/// - account: 目标账户（必填）
/// - share: 分配比例（Permill，0-1,000,000 表示 0-100%）
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct StorageRouteEntry<AccountId> {
    /// 路由类型代码
    pub kind: u8,
    /// 目标账户
    pub account: AccountId,
    /// 分配比例（Permill）
    pub share: Permill,
}

/// 函数级详细中文注释：分配记录结构
/// - 记录每次自动分配的详细信息，便于审计
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
pub struct DistributionRecord<Balance, BlockNumber> {
    /// 分配时间（区块号）
    pub block: BlockNumber,
    /// 总分配金额
    pub total_amount: Balance,
    /// 分配路由数量
    pub route_count: u32,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// 运行时事件类型
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// 货币类型（用于转账）
        type Currency: Currency<Self::AccountId>;

        /// 函数级中文注释：存储费用专用 PalletId
        /// - 用于派生托管账户地址
        /// - 推荐值：`PalletId(*b"py/dstor")`
        #[pallet::constant]
        type StoragePalletId: Get<PalletId>;

        /// 函数级中文注释：治理权限
        /// - 可以修改路由表、提取资金
        /// - 推荐：Root | 技术委员会 2/3
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;

        /// 函数级详细中文注释：自动分配周期（区块数）
        /// - 每隔多少区块自动执行一次路由分配
        /// - 推荐值：100_800（约 7 天，按 6s/块计算）
        #[pallet::constant]
        type DistributionPeriod: Get<BlockNumberFor<Self>>;
    }

    /// 函数级中文注释：累计收集的总金额
    /// - 记录从供奉路由等渠道收集的所有存储费用
    #[pallet::storage]
    #[pallet::getter(fn total_collected)]
    pub type TotalCollected<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

    /// 函数级中文注释：累计分配的总金额
    /// - 记录通过路由自动分配的总额
    #[pallet::storage]
    #[pallet::getter(fn total_distributed)]
    pub type TotalDistributed<T: Config> = StorageValue<_, BalanceOf<T>, ValueQuery>;

    /// 函数级详细中文注释：存储费用路由表
    /// - 定义资金分配规则，由委员会治理
    /// - 最多支持 10 个路由条目
    /// - 所有路由的 share 总和必须 <= 100%
    #[pallet::storage]
    #[pallet::getter(fn storage_route_table)]
    pub type StorageRouteTable<T: Config> = StorageValue<
        _,
        BoundedVec<StorageRouteEntry<T::AccountId>, ConstU32<10>>,
        OptionQuery,
    >;

    /// 函数级中文注释：分配历史记录（可选，用于审计）
    /// - 存储最近的分配记录
    /// - 索引：区块号 → 分配记录
    #[pallet::storage]
    #[pallet::getter(fn distribution_history)]
    pub type DistributionHistory<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        BlockNumberFor<T>,
        DistributionRecord<BalanceOf<T>, BlockNumberFor<T>>,
        OptionQuery,
    >;

    /// 函数级中文注释：最后分配区块号
    #[pallet::storage]
    #[pallet::getter(fn last_distribution_block)]
    pub type LastDistributionBlock<T: Config> = StorageValue<_, BlockNumberFor<T>, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 函数级中文注释：收到存储费用
        /// - from: 来源账户
        /// - amount: 金额
        FundsReceived {
            from: T::AccountId,
            amount: BalanceOf<T>,
        },

        /// 函数级详细中文注释：路由表更新
        /// - route_count: 路由条目数量
        RouteTableUpdated {
            route_count: u32,
        },

        /// 函数级详细中文注释：单笔路由分配
        /// - kind: 路由类型
        /// - to: 接收方
        /// - amount: 金额
        RouteDistributed {
            kind: u8,
            to: T::AccountId,
            amount: BalanceOf<T>,
        },

        /// 函数级详细中文注释：自动分配完成
        /// - block: 分配执行的区块号
        /// - total_amount: 总分配金额
        /// - route_count: 分配的路由数量
        AutoDistributionCompleted {
            block: BlockNumberFor<T>,
            total_amount: BalanceOf<T>,
            route_count: u32,
        },

        /// 函数级中文注释：治理提取资金
        /// - to: 目标账户
        /// - amount: 提取金额
        Withdrawn {
            to: T::AccountId,
            amount: BalanceOf<T>,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// 函数级中文注释：账户余额不足
        InsufficientBalance,

        /// 函数级中文注释：金额无效（为0或超过最大值）
        InvalidAmount,

        /// 函数级中文注释：路由表条目过多（超过 10 个）
        RouteTableTooLong,

        /// 函数级详细中文注释：路由表无效
        /// - 所有路由的 share 总和超过 100%
        /// - 或存在无效的 share 值
        InvalidRouteTable,

        /// 函数级中文注释：路由表为空
        EmptyRouteTable,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级详细中文注释：设置存储费用路由表
        /// 
        /// 权限：需要 GovernanceOrigin（Root 或技术委员会 2/3）
        /// 
        /// 用途：
        /// - 配置资金自动分配规则
        /// - 调整各存储服务商的分配比例
        /// - 添加或移除分配目标
        /// 
        /// 参数：
        /// - origin: 治理权限来源
        /// - routes: 路由表配置 [(kind, account, share), ...]
        /// 
        /// 验证：
        /// - 路由表不能为空
        /// - 最多 10 个路由条目
        /// - 所有 share 总和必须 <= 100%
        /// 
        /// 示例：
        /// ```
        /// routes = [
        ///     (0, ipfs_pool,    50%), // IPFS 运营者池 50%
        ///     (1, arweave_pool, 30%), // Arweave 运营者池 30%
        ///     (3, node_pool,    20%), // 节点运维激励 20%
        /// ]
        /// ```
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn set_storage_route_table(
            origin: OriginFor<T>,
            routes: Vec<(u8, T::AccountId, Permill)>,
        ) -> DispatchResult {
            // 验证治理权限
            T::GovernanceOrigin::ensure_origin(origin)?;

            // 验证路由表不为空
            ensure!(!routes.is_empty(), Error::<T>::EmptyRouteTable);

            // 验证路由表长度
            ensure!(routes.len() <= 10, Error::<T>::RouteTableTooLong);

            // 验证总和 <= 100%
            let total_share: Permill = routes
                .iter()
                .map(|(_, _, share)| *share)
                .fold(Permill::zero(), |acc, share| acc.saturating_add(share));
            
            ensure!(total_share <= Permill::one(), Error::<T>::InvalidRouteTable);

            // 构造路由条目
            let entries: Vec<StorageRouteEntry<T::AccountId>> = routes
                .into_iter()
                .map(|(kind, account, share)| StorageRouteEntry {
                    kind,
                    account,
                    share,
                })
                .collect();

            // 转换为 BoundedVec 并存储
            let bounded_routes = BoundedVec::try_from(entries)
                .map_err(|_| Error::<T>::RouteTableTooLong)?;

            StorageRouteTable::<T>::put(bounded_routes.clone());

            // 发出事件
            Self::deposit_event(Event::RouteTableUpdated {
                route_count: bounded_routes.len() as u32,
            });

            Ok(())
        }

        /// 函数级详细中文注释：治理提取资金
        /// 
        /// 权限：需要 GovernanceOrigin（通常为 Root 或技术委员会 2/3）
        /// 
        /// 用途：
        /// - 紧急情况下提取资金
        /// - 升级或迁移时转移资金
        /// - 调整资金分配策略
        /// 
        /// 参数：
        /// - origin: 治理权限来源
        /// - dest: 目标账户
        /// - amount: 提取金额
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn withdraw(
            origin: OriginFor<T>,
            dest: T::AccountId,
            amount: BalanceOf<T>,
        ) -> DispatchResult {
            // 验证治理权限
            T::GovernanceOrigin::ensure_origin(origin)?;

            // 验证金额有效性
            ensure!(!amount.is_zero(), Error::<T>::InvalidAmount);

            // 获取托管账户
            let treasury_account = Self::account_id();

            // 执行转账
            T::Currency::transfer(
                &treasury_account,
                &dest,
                amount,
                ExistenceRequirement::KeepAlive,
            )?;

            // 发出事件
            Self::deposit_event(Event::Withdrawn {
                to: dest,
                amount,
            });

            Ok(())
        }
    }

    /// 函数级详细中文注释：Hooks - 自动执行路由分配
    /// 
    /// 执行时机：
    /// - 每隔 DistributionPeriod 区块执行一次
    /// - 默认为 100_800 区块（约 7 天）
    /// 
    /// 执行逻辑：
    /// 1. 检查是否到达分配周期
    /// 2. 读取路由表配置
    /// 3. 获取当前托管账户余额
    /// 4. 按路由表比例分配资金
    /// 5. 记录分配历史
    /// 6. 发出事件
    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        fn on_initialize(n: BlockNumberFor<T>) -> Weight {
            // 检查是否到达分配周期
            let period = T::DistributionPeriod::get();
            if !period.is_zero() && n % period == Zero::zero() {
                // 执行自动分配
                let _ = Self::execute_route_distribution(n);
            }

            // 返回权重（简化版本，实际应该通过 benchmark 计算）
            Weight::from_parts(10_000, 0)
        }
    }
}

impl<T: Config> Pallet<T> {
    /// 函数级详细中文注释：获取托管账户地址
    /// 
    /// 派生逻辑：
    /// - 从 `StoragePalletId` 派生确定性账户
    /// - 无私钥控制，仅通过链上逻辑操作
    /// 
    /// 返回：托管账户的 AccountId
    pub fn account_id() -> T::AccountId {
        T::StoragePalletId::get().into_account_truncating()
    }

    /// 函数级详细中文注释：获取当前账户余额
    /// 
    /// 返回：托管账户的可用余额
    pub fn current_balance() -> BalanceOf<T> {
        T::Currency::free_balance(&Self::account_id())
    }

    /// 函数级详细中文注释：记录资金接收（内部调用）
    /// 
    /// 用途：
    /// - 当供奉路由转入资金时调用
    /// - 更新累计收集金额
    /// - 发出资金接收事件
    /// 
    /// 参数：
    /// - from: 资金来源账户
    /// - amount: 接收金额
    /// 
    /// 注意：此函数不执行实际转账，仅记录统计数据
    pub fn record_funds_received(from: &T::AccountId, amount: BalanceOf<T>) {
        // 更新累计收集金额
        TotalCollected::<T>::mutate(|total| {
            *total = total.saturating_add(amount);
        });

        // 发出事件
        Self::deposit_event(Event::FundsReceived {
            from: from.clone(),
            amount,
        });
    }

    /// 函数级详细中文注释：执行路由分配（内部调用）
    /// 
    /// 逻辑：
    /// 1. 读取路由表，如果未配置则跳过
    /// 2. 获取当前余额，如果为0则跳过
    /// 3. 遍历所有路由条目
    /// 4. 按比例计算每个路由的分配金额
    /// 5. 执行转账
    /// 6. 更新统计数据
    /// 7. 记录分配历史
    /// 8. 发出事件
    /// 
    /// 参数：
    /// - block: 当前区块号
    /// 
    /// 返回：
    /// - Ok(()) 如果分配成功
    /// - Err(...) 如果分配失败
    fn execute_route_distribution(block: BlockNumberFor<T>) -> DispatchResult {
        // 读取路由表
        let Some(routes) = StorageRouteTable::<T>::get() else {
            // 未配置路由表，跳过
            return Ok(());
        };

        // 获取当前余额
        let balance = Self::current_balance();
        if balance.is_zero() {
            // 余额为0，跳过
            return Ok(());
        }

        let treasury_account = Self::account_id();
        let mut total_distributed = BalanceOf::<T>::zero();
        let mut route_count = 0u32;

        // 遍历路由表，执行分配
        for route in routes.iter() {
            // 计算分配金额
            let amount = route.share * balance;
            
            if amount.is_zero() {
                continue;
            }

            // 执行转账
            T::Currency::transfer(
                &treasury_account,
                &route.account,
                amount,
                ExistenceRequirement::KeepAlive,
            )?;

            // 累加总分配金额
            total_distributed = total_distributed.saturating_add(amount);
            route_count = route_count.saturating_add(1);

            // 发出单笔分配事件
            Self::deposit_event(Event::RouteDistributed {
                kind: route.kind,
                to: route.account.clone(),
                amount,
            });
        }

        // 更新累计分配金额
        TotalDistributed::<T>::mutate(|total| {
            *total = total.saturating_add(total_distributed);
        });

        // 更新最后分配区块
        LastDistributionBlock::<T>::put(block);

        // 记录分配历史
        DistributionHistory::<T>::insert(
            block,
            DistributionRecord {
                block,
                total_amount: total_distributed,
                route_count,
            },
        );

        // 发出自动分配完成事件
        Self::deposit_event(Event::AutoDistributionCompleted {
            block,
            total_amount: total_distributed,
            route_count,
        });

        Ok(())
    }
}
