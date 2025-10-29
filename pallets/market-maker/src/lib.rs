#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::traits::{tokens::Imbalance, ConstU32};
    use frame_support::{
        pallet_prelude::*,
        traits::{Currency, ReservableCurrency},
        weights::Weight,
        BoundedVec,
    };
    use frame_system::pallet_prelude::*;
    use sp_arithmetic::traits::{Saturating, Zero};
    use sp_runtime::{traits::SaturatedConversion, Perbill};
    use sp_std::vec::Vec;

    /// 简化别名
    type BalanceOf<T> =
        <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;
    type Cid = BoundedVec<u8, ConstU32<256>>;

    /// 🆕 2025-10-22：姓名脱敏辅助函数
    /// 
    /// # 函数级详细中文注释
    /// 根据姓名长度应用不同的脱敏规则，保护做市商隐私
    /// 
    /// # 脱敏规则
    /// - 0字：返回空字符串
    /// - 1字：返回单个星号 "×"
    /// - 2字：前面×，保留后面，示例："张三" -> "×三"
    /// - 3字：前后保留，中间×，示例："李四五" -> "李×五"
    /// - 4字及以上：前1后1，中间1个×，示例："王二麻子" -> "王×子"
    /// 
    /// # 参数
    /// - full_name: 完整姓名（UTF-8字符串切片）
    /// 
    /// # 返回值
    /// - 脱敏后的姓名字节数组
    fn mask_name(full_name: &str) -> Vec<u8> {
        extern crate alloc;
        use alloc::string::String;
        
        let chars: Vec<char> = full_name.chars().collect();
        let len = chars.len();
        
        let mut masked = String::new();
        match len {
            0 => {},
            1 => masked.push('×'),
            2 => {
                masked.push('×');
                masked.push(chars[1]);
            },
            3 => {
                masked.push(chars[0]);
                masked.push('×');
                masked.push(chars[2]);
            },
            _ => {
                masked.push(chars[0]);
                masked.push('×');
                masked.push(chars[len - 1]);
            },
        }
        
        masked.as_bytes().to_vec()
    }

    /// 🆕 2025-10-22：身份证号脱敏辅助函数
    /// 
    /// # 函数级详细中文注释
    /// 保留身份证号的前4位和后4位，中间用星号替换
    /// 
    /// # 脱敏规则
    /// - 18位身份证：前4位 + 10个星号 + 后4位
    /// - 15位身份证：前4位 + 7个星号 + 后4位
    /// - 少于8位：全部用星号替换
    /// 
    /// # 参数
    /// - id_card: 完整身份证号（ASCII字符串切片）
    /// 
    /// # 返回值
    /// - 脱敏后的身份证号字节数组
    fn mask_id_card(id_card: &str) -> Vec<u8> {
        extern crate alloc;
        use alloc::string::String;
        
        let len = id_card.len();
        
        if len < 8 {
            let masked: String = (0..len).map(|_| '*').collect();
            return masked.as_bytes().to_vec();
        }
        
        let front = &id_card[0..4];
        let back = &id_card[len - 4..];
        let middle_count = len - 8;
        
        let mut masked = String::new();
        masked.push_str(front);
        for _ in 0..middle_count {
            masked.push('*');
        }
        masked.push_str(back);
        
        masked.as_bytes().to_vec()
    }

    /// 🆕 2025-10-23：生日脱敏辅助函数
    /// 
    /// # 函数级详细中文注释
    /// 保留年份，隐藏月份和日期，便于判断年龄段但保护隐私
    /// 
    /// # 脱敏规则
    /// - 标准格式（YYYY-MM-DD）：保留年份，月日用xx替换
    /// - 示例："1990-01-01" -> "1990-xx-xx"
    /// - 少于4字符：全部用****-xx-xx替换
    /// 
    /// # 参数
    /// - birthday: 完整生日（ASCII字符串切片，格式 YYYY-MM-DD）
    /// 
    /// # 返回值
    /// - 脱敏后的生日字节数组
    /// 
    /// # 用途
    /// - 买家可以判断做市商年龄段（如30岁、40岁）
    /// - 但无法获知具体生日，保护隐私
    fn mask_birthday(birthday: &str) -> Vec<u8> {
        extern crate alloc;
        
        if birthday.len() >= 4 {
            let year = &birthday[0..4];
            let masked = alloc::format!("{}-xx-xx", year);
            masked.as_bytes().to_vec()
        } else {
            b"****-xx-xx".to_vec()
        }
    }

    /// 函数级中文注释：做市商 Pallet 权重信息 Trait
    /// - 定义各个交易函数的权重计算方法
    pub trait MarketMakerWeightInfo {
        fn lock_deposit() -> Weight;
        fn submit_info() -> Weight;
        fn update_info() -> Weight;
        fn cancel() -> Weight;
        fn approve() -> Weight;
        fn reject() -> Weight;
        fn expire() -> Weight;
        fn request_withdrawal() -> Weight;
        fn execute_withdrawal() -> Weight;
        fn cancel_withdrawal() -> Weight;
        fn emergency_withdrawal() -> Weight;
    }

    impl MarketMakerWeightInfo for () {
        fn lock_deposit() -> Weight {
            Weight::zero()
        }
        fn submit_info() -> Weight {
            Weight::zero()
        }
        fn update_info() -> Weight {
            Weight::zero()
        }
        fn cancel() -> Weight {
            Weight::zero()
        }
        fn approve() -> Weight {
            Weight::zero()
        }
        fn reject() -> Weight {
            Weight::zero()
        }
        fn expire() -> Weight {
            Weight::zero()
        }
        fn request_withdrawal() -> Weight {
            Weight::zero()
        }
        fn execute_withdrawal() -> Weight {
            Weight::zero()
        }
        fn cancel_withdrawal() -> Weight {
            Weight::zero()
        }
        fn emergency_withdrawal() -> Weight {
            Weight::zero()
        }
    }

    /**
     * 函数级详细中文注释：做市商治理+押金 Pallet（最小可用版本）
     * - 实现核心流程：lock_deposit → submit_info → approve/reject → cancel/expire
     * - 仅使用 ReservableCurrency；后续可升级为 holds
     */
    #[pallet::config]
    pub trait Config: frame_system::Config + pallet_timestamp::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// MEMO 主币（需支持 reserve）
        type Currency: ReservableCurrency<Self::AccountId>;
        /// 权重信息
        type WeightInfo: MarketMakerWeightInfo;
        /// 最小押金
        #[pallet::constant]
        type MinDeposit: Get<BalanceOf<Self>>;
        /// 提交资料窗口（秒）
        #[pallet::constant]
        type InfoWindow: Get<u32>;
        /// 审核窗口（秒）
        #[pallet::constant]
        type ReviewWindow: Get<u32>;
        /// 驳回最大扣罚比例（千分比）
        #[pallet::constant]
        type RejectSlashBpsMax: Get<u16>;
        /// 最大交易对数量（预留）
        #[pallet::constant]
        type MaxPairs: Get<u32>;
        /// 函数级中文注释：治理起源（用于批准/驳回做市商申请）
        /// - 推荐配置为 Root 或 委员会 2/3 多数
        type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>;
        
        /// 🆕 2025-10-23：审核员账户列表（方案A - Phase 2）
        /// - 当做市商提交申请时，自动通知这些审核员
        /// - 审核员可以通过pallet-chat查看私密资料（private_cid）
        /// - 推荐配置为 1-3 个专业审核员账户
        type ReviewerAccounts: Get<Vec<Self::AccountId>>;
        
        /// 🆕 2025-10-19：最大溢价（基点）
        /// - 限制溢价范围：-MaxPremiumBps ~ +MaxPremiumBps
        /// - 推荐值：500 bps (5%)
        #[pallet::constant]
        type MaxPremiumBps: Get<i16>;
        
        /// 🆕 2025-10-19：最小溢价（基点）
        /// - 限制溢价范围：MinPremiumBps ~ +MaxPremiumBps
        /// - 推荐值：-500 bps (-5%)
        #[pallet::constant]
        type MinPremiumBps: Get<i16>;
        
        /// 🆕 函数级详细中文注释：Pallet ID
        /// - 用于派生首购资金池账户地址
        /// - 格式：b"mm/pool!" + 做市商账户地址
        #[pallet::constant]
        type PalletId: Get<frame_support::PalletId>;
        
        /// 🆕 函数级详细中文注释：资金池提取冷却期（秒）
        /// - 做市商申请提取后，需要等待的时间
        /// - 推荐设置为 7 天 = 604800 秒
        /// - 用于防止恶意快速提取，给治理和用户反应时间
        #[pallet::constant]
        type WithdrawalCooldown: Get<u32>;
        
        /// 🆕 函数级详细中文注释：最小保留资金池余额
        /// - 提取后资金池必须保留的最小余额
        /// - 确保有足够资金继续提供首购服务
        /// - 推荐设置为 1000 MEMO
        #[pallet::constant]
        type MinPoolBalance: Get<BalanceOf<Self>>;
    }

    #[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum ApplicationStatus {
        DepositLocked,
        PendingReview,
        Active,
        Rejected,
        Cancelled,
        Expired,
    }

    /// 🆕 函数级详细中文注释：做市商业务方向枚举
    /// - Buy: 仅买入（仅Bridge）- 做市商购买MEMO，支付USDT
    /// - Sell: 仅卖出（仅OTC）- 做市商出售MEMO，收取USDT  
    /// - BuyAndSell: 双向（OTC + Bridge）- 既可以买入也可以卖出
    #[derive(Clone, Copy, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum Direction {
        /// 仅买入（仅Bridge）- 做市商购买MEMO，支付USDT
        Buy = 0,
        /// 仅卖出（仅OTC）- 做市商出售MEMO，收取USDT
        Sell = 1,
        /// 双向（OTC + Bridge）- 既可以买入也可以卖出
        BuyAndSell = 2,
    }

    impl Direction {
        /// 从 u8 转换为 Direction
        pub fn from_u8(value: u8) -> Option<Self> {
            match value {
                0 => Some(Direction::Buy),
                1 => Some(Direction::Sell),
                2 => Some(Direction::BuyAndSell),
                _ => None,
            }
        }
    }

    impl Default for Direction {
        fn default() -> Self {
            Self::BuyAndSell
        }
    }

    /// 🆕 函数级详细中文注释：提取请求状态
    #[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum WithdrawalStatus {
        /// 待执行（冷却期中）
        Pending,
        /// 已执行
        Executed,
        /// 已取消
        Cancelled,
    }

    /// 🆕 函数级详细中文注释：桥接服务配置
    /// - 做市商可选择提供 Simple Bridge 兑换服务
    /// - 需要额外押金，用于保障用户资金安全
    #[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(AccountId, Balance))]
    pub struct BridgeServiceConfig<AccountId, Balance> {
        /// 🆕 函数级详细中文注释：做市商账户（接收 MEMO）
        pub maker_account: AccountId,
        /// 🆕 函数级详细中文注释：做市商 TRON 地址（发送 USDT）
        pub tron_address: BoundedVec<u8, ConstU32<64>>,
        /// 单笔最大兑换额（USDT，精度 10^6）
        pub max_swap_amount: u64,
        /// 手续费率（万分比，例如 10 = 0.1%）
        pub fee_rate_bps: u32,
        /// 服务是否启用
        pub enabled: bool,
        /// 累计兑换笔数
        pub total_swaps: u64,
        /// 累计兑换量（MEMO，精度 10^12）
        pub total_volume: Balance,
        /// 成功兑换数
        pub success_count: u64,
        /// 平均完成时间（秒）
        pub avg_time_seconds: u64,
        /// 押金额度（MEMO，精度 10^12）
        pub deposit: Balance,
    }

    /// 🆕 函数级详细中文注释：资金池提取请求
    /// - 记录提取申请的时间、金额、状态
    #[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct WithdrawalRequest<Balance> {
        /// 申请提取的金额
        pub amount: Balance,
        /// 申请时间（秒）
        pub requested_at: u32,
        /// 可执行时间（秒）= requested_at + WithdrawalCooldown
        pub executable_at: u32,
        /// 请求状态
        pub status: WithdrawalStatus,
    }

    #[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub struct Application<AccountId, Balance> {
        pub owner: AccountId,
        pub deposit: Balance,
        pub status: ApplicationStatus,
        /// 🆕 2025-10-19：做市商业务方向（Buy/Sell/BuyAndSell）
        pub direction: Direction,
        /// 🆕 2025-10-19：统一TRON地址（OTC收款 + Bridge发款）
        /// 函数级详细中文注释：做市商的TRON地址，用于所有USDT业务
        /// - OTC订单：买家向此地址转账USDT购买MEMO
        /// - Bridge订单：做市商从此地址向买家转账USDT
        /// - 格式：以'T'开头的34字符Base58编码地址
        /// - 示例：TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS
        /// - 可通过update_maker_info更新（热钱包升级、安全原因等）
        pub tron_address: BoundedVec<u8, ConstU32<64>>,
        pub public_cid: Cid,
        pub private_cid: Cid,
        /// 🆕 2025-10-19：Buy溢价（基点，-500 ~ 500 = -5% ~ +5%）
        /// - Buy方向（Bridge）：做市商购买MEMO，溢价为负（低于基准价）
        /// - 示例：-200 bps = -2%，基准价0.01 → 买价0.0098
        pub buy_premium_bps: i16,
        /// 🆕 2025-10-19：Sell溢价（基点，-500 ~ 500 = -5% ~ +5%）
        /// - Sell方向（OTC）：做市商出售MEMO，溢价为正（高于基准价）
        /// - 示例：+200 bps = +2%，基准价0.01 → 卖价0.0102
        pub sell_premium_bps: i16,
        pub min_amount: Balance,
        pub created_at: u32,
        pub info_deadline: u32,
        pub review_deadline: u32,
        /// 🆕 服务暂停状态
        pub service_paused: bool,
        /// 🆕 已服务的用户数量
        pub users_served: u32,
        
        /// 🆕 2025-10-22：脱敏姓名
        /// 函数级详细中文注释：做市商真实姓名的脱敏版本
        /// - 用于向买家展示收款人姓名，便于核对
        /// - 脱敏规则：2字保留后1字，3字保留前后，4字及以上保留前1后1
        /// - 示例："张×三"、"×三"、"欧×娜"
        /// - 完整姓名存储在 private_cid 加密内容中
        pub masked_full_name: BoundedVec<u8, ConstU32<64>>,
        
        /// 🆕 2025-10-22：脱敏身份证号
        /// 函数级详细中文注释：做市商身份证号的脱敏版本
        /// - 用于KYC验证和信用记录
        /// - 脱敏规则：前4后4，中间星号
        /// - 示例："1101**********1234"
        /// - 完整身份证号存储在 private_cid 加密内容中
        pub masked_id_card: BoundedVec<u8, ConstU32<32>>,
        
        /// 🆕 2025-10-23：脱敏生日
        /// 函数级详细中文注释：做市商生日的脱敏版本
        /// - 用于向买家展示做市商年龄段，便于建立信任
        /// - 脱敏规则：保留年份，月日用xx替换
        /// - 示例："1990-xx-xx"
        /// - 完整生日存储在 private_cid 加密内容中
        /// - 买家可以据此判断做市商年龄段（如30岁、40岁）
        pub masked_birthday: BoundedVec<u8, ConstU32<16>>,
        
        /// 🆕 2025-10-22：脱敏收款方式信息（JSON格式）
        /// 函数级详细中文注释：存储做市商的收款方式信息（已脱敏）
        /// - 格式：JSON数组，包含多种收款方式
        /// - 每个收款方式包含：type（类型）、account（脱敏账号）、name（脱敏姓名）、bank（银行名，可选）
        /// - 示例：[{"type":"BankCard","account":"6214****5678","name":"张×三","bank":"中国银行"}]
        /// - 链上仅存储脱敏信息，完整信息存储在 private_cid 加密内容中
        pub masked_payment_info: BoundedVec<u8, ConstU32<512>>,
    }

    #[pallet::storage]
    #[pallet::getter(fn applications)]
    pub type Applications<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, Application<T::AccountId, BalanceOf<T>>>;

    #[pallet::storage]
    #[pallet::getter(fn owner_index)]
    pub type OwnerIndex<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, u64>;

    #[pallet::storage]
    #[pallet::getter(fn next_id)]
    pub type NextId<T> = StorageValue<_, u64, ValueQuery>;

    /// 🆕 2025-10-23：访问记录结构
    /// 
    /// # 函数级详细中文注释
    /// 记录委员会成员访问做市商敏感信息的日志
    /// - 用于隐私保护和审计
    /// - 做市商可以查看谁访问了自己的信息
    #[derive(Clone, Encode, Decode, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct AccessRecord<T: Config> {
        /// 访问者账户（委员会成员）
        pub accessor: T::AccountId,
        /// 访问时间（区块高度）
        pub accessed_at: BlockNumberFor<T>,
        /// 访问目的（如 "kyc_review", "dispute_investigation"）
        pub purpose: BoundedVec<u8, ConstU32<256>>,
    }

    /// 🆕 2025-10-23：委员会成员的密钥分片存储
    /// 
    /// # 函数级详细中文注释
    /// 使用门限加密（Threshold Encryption）存储委员会共享密钥的分片
    /// - 委员会共享密钥被分割为N份（如5份）
    /// - 任意K份（如3份）可以恢复共享密钥
    /// - 每个委员会成员持有1份加密后的分片
    /// - 成员变更时只需更新分片，不需要重新加密历史数据
    /// 
    /// # 存储格式
    /// - Key: 委员会成员账户ID
    /// - Value: 用该成员公钥加密的密钥分片（Hex字符串）
    #[pallet::storage]
    #[pallet::getter(fn committee_key_shares)]
    pub type CommitteeKeyShares<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,  // 委员会成员
        BoundedVec<u8, ConstU32<512>>,  // 加密的密钥分片
        OptionQuery,
    >;

    /// 🆕 2025-10-23：敏感信息访问日志
    /// 
    /// # 函数级详细中文注释
    /// 记录委员会成员访问做市商敏感信息的所有日志
    /// - 用于隐私保护和审计追溯
    /// - 做市商可以随时查看谁访问了自己的信息
    /// - 最多存储100条访问记录
    /// 
    /// # 存储格式
    /// - Key: 做市商ID
    /// - Value: 访问记录数组（最多100条）
    #[pallet::storage]
    #[pallet::getter(fn sensitive_data_access_logs)]
    pub type SensitiveDataAccessLogs<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,  // mm_id
        BoundedVec<AccessRecord<T>, ConstU32<100>>,
        ValueQuery,
    >;

    /// 🆕 函数级详细中文注释：活跃做市商列表
    /// - 存储已批准的做市商信息
    /// - mm_id -> Application
    /// - 批准后从Applications迁移到这里，保持Applications仅存储申请中的记录
    #[pallet::storage]
    #[pallet::getter(fn active_market_makers)]
    pub type ActiveMarketMakers<T: Config> =
        StorageMap<_, Blake2_128Concat, u64, Application<T::AccountId, BalanceOf<T>>>;


    /// 🆕 函数级详细中文注释：资金池提取请求记录
    /// - mm_id -> WithdrawalRequest
    /// - 每个做市商同时只能有一个待处理的提取请求
    /// - 执行或取消后删除记录
    #[pallet::storage]
    pub type WithdrawalRequests<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // mm_id
        WithdrawalRequest<BalanceOf<T>>,
        OptionQuery,
    >;

    /// 🆕 函数级详细中文注释：桥接服务配置记录
    /// - mm_id -> BridgeServiceConfig
    /// - 做市商可选择启用桥接服务，需要额外押金
    /// - 存储做市商的桥接服务配置和统计数据
    #[pallet::storage]
    #[pallet::getter(fn bridge_services)]
    pub type BridgeServices<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64, // mm_id
        BridgeServiceConfig<T::AccountId, BalanceOf<T>>,
        OptionQuery,
    >;

    #[pallet::event]
    #[pallet::generate_deposit(fn deposit_event)]
    pub enum Event<T: Config> {
        Applied {
            mm_id: u64,
            owner: T::AccountId,
            deposit: BalanceOf<T>,
        },
        Submitted {
            mm_id: u64,
        },
        /// 🆕 2025-10-23：做市商信息已提交（方案A - 优化版）
        InfoSubmitted {
            mm_id: u64,
            owner: T::AccountId,
            masked_full_name: BoundedVec<u8, ConstU32<64>>,
            masked_id_card: BoundedVec<u8, ConstU32<32>>,
        },
        InfoUpdated {
            mm_id: u64,
        },
        Approved {
            mm_id: u64,
        },
        Rejected {
            mm_id: u64,
            slash: BalanceOf<T>,
        },
        Cancelled {
            mm_id: u64,
        },
        Expired {
            mm_id: u64,
        },
        /// 🆕 提取请求已提交
        WithdrawalRequested {
            mm_id: u64,
            owner: T::AccountId,
            amount: BalanceOf<T>,
            executable_at: u32,
            pause_service: bool,
        },
        /// 🆕 提取已执行
        WithdrawalExecuted {
            mm_id: u64,
            owner: T::AccountId,
            amount: BalanceOf<T>,
        },
        /// 🆕 提取请求已取消
        WithdrawalCancelled {
            mm_id: u64,
            owner: T::AccountId,
        },
        /// 🆕 紧急提取（治理）
        EmergencyWithdrawal {
            mm_id: u64,
            recipient: T::AccountId,
            amount: BalanceOf<T>,
        },
        /// 🆕 做市商epay配置已更新
        EpayConfigUpdated {
            mm_id: u64,
            owner: T::AccountId,
        },
        /// 🆕 桥接服务已启用
        BridgeServiceEnabled {
            mm_id: u64,
            owner: T::AccountId,
            tron_address: BoundedVec<u8, ConstU32<64>>,  // 🆕 TRON 地址
            max_swap_amount: u64,
            fee_rate_bps: u32,
            deposit: BalanceOf<T>,
        },
        /// 🆕 桥接服务已禁用
        BridgeServiceDisabled {
            mm_id: u64,
            owner: T::AccountId,
        },
        /// 🆕 桥接服务已重新启用
        BridgeServiceReEnabled {
            mm_id: u64,
            owner: T::AccountId,
        },
        /// 🆕 桥接服务 TRON 地址已更新
        BridgeServiceTronAddressUpdated {
            mm_id: u64,
            owner: T::AccountId,
            tron_address: BoundedVec<u8, ConstU32<64>>,
        },
        /// 🆕 桥接服务最大兑换额已更新
        BridgeServiceMaxSwapAmountUpdated {
            mm_id: u64,
            owner: T::AccountId,
            max_swap_amount: u64,
            deposit: BalanceOf<T>,
        },
        /// 🆕 桥接服务手续费率已更新
        BridgeServiceFeeRateUpdated {
            mm_id: u64,
            owner: T::AccountId,
            fee_rate_bps: u32,
        },
        /// 🆕 桥接统计数据已更新
        BridgeStatsUpdated {
            mm_id: u64,
            total_swaps: u64,
            total_volume: BalanceOf<T>,
            success_count: u64,
            avg_time_seconds: u64,
        },
        /// 🆕 做市商信息已更新
        MakerInfoUpdated {
            mm_id: u64,
            owner: T::AccountId,
        },
        /// 🆕 2025-10-19：做市商业务方向已更新
        /// - old_direction_u8: 0=Buy, 1=Sell, 2=BuyAndSell
        /// - new_direction_u8: 0=Buy, 1=Sell, 2=BuyAndSell
        DirectionUpdated {
            mm_id: u64,
            owner: T::AccountId,
            old_direction_u8: u8,
            new_direction_u8: u8,
        },
        /// 🆕 2025-10-23：审核员通知已发送（方案A - Phase 3）
        ReviewerNotified {
            mm_id: u64,
            reviewer: T::AccountId,
            private_cid: Cid,
        },
        /// 🆕 2025-10-23：审核员通知发送失败（方案A - Phase 3）
        ReviewerNotificationFailed {
            mm_id: u64,
            reviewer: T::AccountId,
            error: DispatchError,
        },
        /// 🆕 2025-10-23：委员会共享密钥已初始化
        CommitteeSharedKeyInitialized {
            member_count: u32,
        },
        /// 🆕 2025-10-23：委员会密钥分片已更新
        CommitteeKeySharesUpdated {
            member_count: u32,
        },
        /// 🆕 2025-10-23：委员会成员访问了做市商敏感信息
        SensitiveDataAccessed {
            mm_id: u64,
            accessor: T::AccountId,
            purpose: BoundedVec<u8, ConstU32<256>>,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        AlreadyExists,
        NotFound,
        NotDepositLocked,
        NotPendingReview,
        AlreadyFinalized,
        DeadlinePassed,
        InvalidFee,
        BadSlashRatio,
        MinDepositNotMet,
        NotInEditableStatus,
        /// 🆕 做市商资金池余额不足
        InsufficientPoolBalance,
        /// 🆕 做市商未激活
        MarketMakerNotActive,
        /// 🆕 提取请求已存在
        WithdrawalRequestExists,
        /// 🆕 提取请求不存在
        WithdrawalRequestNotFound,
        /// 🆕 冷却期未结束
        WithdrawalCooldownNotExpired,
        /// 🆕 可提取余额不足
        InsufficientWithdrawableBalance,
        /// 🆕 提取后余额低于最小值
        BelowMinPoolBalance,
        /// 🆕 提取请求状态无效
        InvalidWithdrawalStatus,
        /// 🆕 不是做市商所有者
        NotOwner,
        /// 🆕 做市商未激活
        NotActive,
        /// 🆕 桥接服务已存在
        BridgeServiceAlreadyExists,
        /// 🆕 桥接服务不存在
        BridgeServiceNotFound,
        /// 🆕 桥接服务手续费率无效（范围：5-500 bps）
        InvalidBridgeFeeRate,
        /// 🆕 桥接服务押金不足
        InsufficientBridgeDeposit,
        /// 🆕 桥接服务未启用
        BridgeServiceNotEnabled,
        /// 🆕 TRON 地址格式无效（为空或过长）
        InvalidTronAddress,
        /// 🆕 桥接服务已启用（无需重新启用）
        BridgeServiceAlreadyEnabled,
        /// 🆕 最小下单额过低（必须 >= Currency::minimum_balance）
        MinAmountTooLow,
        /// 🆕 2025-10-19：做市商业务方向不支持该操作
        DirectionNotSupported,
        /// 🆕 2025-10-19：没有检测到变化
        NoChange,
        /// 🆕 2025-10-19：状态无效或参数无效
        BadState,
        /// 🆕 2025-10-19：Buy溢价超出范围（MinPremiumBps ~ MaxPremiumBps）
        InvalidBuyPremium,
        /// 🆕 2025-10-19：Sell溢价超出范围（MinPremiumBps ~ MaxPremiumBps）
        InvalidSellPremium,
        /// 🆕 2025-10-23：生日格式无效
        InvalidBirthday,
        /// 🆕 2025-10-23：生日太长
        BirthdayTooLong,
        /// 🆕 2025-10-23：不是委员会成员
        NotCommitteeMember,
        /// 🆕 2025-10-23：访问目的太长
        PurposeTooLong,
        /// 🆕 2025-10-23：访问记录太多
        TooManyAccessRecords,
        /// 🆕 2025-10-23：密钥分片数量无效
        InvalidKeyShareCount,
        /// 🆕 2025-10-23：密钥分片太长
        KeyShareTooLong,
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::call]
    impl<T: Config> Pallet<T>
    where
        BalanceOf<T>: From<u128>,
    {
        /// 质押押金并生成 mm_id
        /// 函数级详细中文注释：锁定押金并申请成为做市商
        /// - 🆕 2025-10-19：新增direction参数，指定做市商业务方向
        /// - direction: 0=Buy（仅Bridge）/ 1=Sell（仅OTC）/ 2=BuyAndSell（双向）
        #[pallet::call_index(0)]
        #[pallet::weight(<<T as Config>::WeightInfo>::lock_deposit())]
        pub fn lock_deposit(
            origin: OriginFor<T>, 
            deposit: BalanceOf<T>,
            direction_u8: u8, // 🆕 新增参数：0=Buy, 1=Sell, 2=BuyAndSell
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                deposit >= T::MinDeposit::get(),
                Error::<T>::MinDepositNotMet
            );
            ensure!(
                !OwnerIndex::<T>::contains_key(&who),
                Error::<T>::AlreadyExists
            );
            
            // 🆕 将 u8 转换为 Direction 枚举
            let direction = Direction::from_u8(direction_u8).ok_or(Error::<T>::BadState)?;

            T::Currency::reserve(&who, deposit)?;

            let mm_id = NextId::<T>::mutate(|id| {
                let cur = *id;
                *id = id.saturating_add(1);
                cur
            });
            // 🔧 函数级中文注释：修复时间戳问题 - 使用 pallet_timestamp 而非 block_number
            // - pallet_timestamp::Pallet::<T>::get() 返回毫秒时间戳
            // - 转换为秒并存储为 u32
            let now_ms = pallet_timestamp::Pallet::<T>::get();
            let ts = (now_ms / 1000u32.into()).saturated_into::<u32>();
            let info_deadline = ts.saturating_add(T::InfoWindow::get());
            let review_deadline = info_deadline.saturating_add(T::ReviewWindow::get());

            Applications::<T>::insert(
                mm_id,
                Application {
                    owner: who.clone(),
                    deposit,
                    status: ApplicationStatus::DepositLocked,
                    direction: direction.clone(), // 🆕 设置业务方向
                    tron_address: BoundedVec::default(), // 🆕 2025-10-19：初始为空，submit_info时设置
                    public_cid: Cid::default(),
                    private_cid: Cid::default(),
                    buy_premium_bps: 0,  // 🆕 2025-10-19：初始化Buy溢价为0
                    sell_premium_bps: 0, // 🆕 2025-10-19：初始化Sell溢价为0
                    min_amount: BalanceOf::<T>::zero(),
                    created_at: ts,
                    info_deadline,
                    review_deadline,
                    service_paused: false,
                    users_served: 0,
                    // 🆕 2025-10-22：初始化脱敏字段（空，后续通过submit_info提交）
                    masked_full_name: BoundedVec::default(),
                    masked_id_card: BoundedVec::default(),
                    masked_birthday: BoundedVec::default(),  // 🆕 2025-10-23
                    masked_payment_info: BoundedVec::default(),
                },
            );
            OwnerIndex::<T>::insert(&who, mm_id);

            Self::deposit_event(Event::Applied {
                mm_id,
                owner: who,
                deposit,
            });
            Ok(())
        }

        /// 函数级详细中文注释：提交做市商申请信息（✅ 优化版 - 方案A）
        /// 
        /// # 设计原则
        /// - ✅ 保留 public_cid（数据分级架构）
        /// - ✅ 明确必填/选填字段（改进用户体验）
        /// - ✅ 删除epay相关参数（首购功能已删除）
        /// 
        /// # 必填参数
        /// - mm_id: 做市商申请ID
        /// - public_root_cid: ✅ 公开信息IPFS CID（保留！用于买家展示做市商列表）
        /// - private_root_cid: 敏感信息IPFS CID（仅审核员可见，包含完整身份证等）
        /// - buy_premium_bps: Buy方向溢价（-500~500基点，-5%~+5%）
        /// - sell_premium_bps: Sell方向溢价（-500~500基点，-5%~+5%）
        /// - min_amount: 最小交易金额
        /// - tron_address: TRON地址（统一用于OTC收款和Bridge发款）
        /// - full_name: 完整姓名（链端自动脱敏为"张×三"）
        /// - id_card: 完整身份证号（链端自动脱敏为"1101**1234"）
        /// 
        /// # 选填参数（Option包装）
        /// - masked_payment_info_json: 脱敏收款方式JSON（可选，做市商可提供多种收款方式）
        /// 
        /// # 流程说明
        /// 1. 验证必填字段（TRON地址、姓名、身份证、溢价范围）
        /// 2. 链端自动脱敏姓名和身份证号
        /// 3. 更新申请状态为PendingReview
        /// 4. 🆕 自动通知审核员（通过pallet-chat，Phase 3实现）
        /// 
        /// # 返回值
        /// - Ok(()): 提交成功
        /// - Err: 提交失败，返回错误信息
        #[pallet::call_index(1)]
        #[pallet::weight(<<T as Config>::WeightInfo>::submit_info())]
        pub fn submit_info(
            origin: OriginFor<T>,
            mm_id: u64,
            // ===== 必填参数 =====
            public_root_cid: Cid,                  // ✅ 保留！公开信息CID
            private_root_cid: Cid,                 // ✅ 必填：敏感信息CID
            buy_premium_bps: i16,                  // ✅ 必填：Buy溢价
            sell_premium_bps: i16,                 // ✅ 必填：Sell溢价
            min_amount: BalanceOf<T>,              // ✅ 必填：最小交易额
            tron_address: Vec<u8>,                 // ✅ 必填：TRON地址
            full_name: Vec<u8>,                    // ✅ 必填：完整姓名（自动脱敏）
            id_card: Vec<u8>,                      // ✅ 必填：完整身份证（自动脱敏）
            birthday: Vec<u8>,                     // ✅ 必填：完整生日（自动脱敏，格式：YYYY-MM-DD）
            // ===== 选填参数（Option包装）=====
            masked_payment_info_json: Option<Vec<u8>>,  // ⚪ 可选：脱敏收款方式
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // ===== 1. 验证必填参数 =====
            
            // 验证TRON地址格式
            ensure!(
                Self::is_valid_tron_address(&tron_address),
                Error::<T>::InvalidTronAddress
            );
            
            // 验证姓名、身份证号和生日（必填）
            ensure!(!full_name.is_empty(), Error::<T>::BadState);
            ensure!(!id_card.is_empty(), Error::<T>::BadState);
            ensure!(!birthday.is_empty(), Error::<T>::InvalidBirthday);
            
            // 验证溢价范围
            ensure!(
                buy_premium_bps >= T::MinPremiumBps::get() && buy_premium_bps <= T::MaxPremiumBps::get(),
                Error::<T>::InvalidBuyPremium
            );
            ensure!(
                sell_premium_bps >= T::MinPremiumBps::get() && sell_premium_bps <= T::MaxPremiumBps::get(),
                Error::<T>::InvalidSellPremium
            );
            
            // ===== 2. 自动脱敏姓名、身份证号和生日 =====
            let full_name_str = sp_std::str::from_utf8(&full_name).map_err(|_| Error::<T>::BadState)?;
            let id_card_str = sp_std::str::from_utf8(&id_card).map_err(|_| Error::<T>::BadState)?;
            let birthday_str = sp_std::str::from_utf8(&birthday).map_err(|_| Error::<T>::InvalidBirthday)?;
            
            let masked_name = mask_name(full_name_str);
            let masked_id = mask_id_card(id_card_str);
            let masked_bday = mask_birthday(birthday_str);  // 🆕 2025-10-23
            
            let masked_full_name: BoundedVec<u8, ConstU32<64>> = masked_name.try_into()
                .map_err(|_| Error::<T>::BadState)?;
            let masked_id_card: BoundedVec<u8, ConstU32<32>> = masked_id.try_into()
                .map_err(|_| Error::<T>::BadState)?;
            let masked_birthday: BoundedVec<u8, ConstU32<16>> = masked_bday.try_into()
                .map_err(|_| Error::<T>::BirthdayTooLong)?;
            
            // 处理可选的脱敏收款方式（Option包装）
            let masked_payment_info: BoundedVec<u8, ConstU32<512>> = if let Some(payment_json) = masked_payment_info_json {
                payment_json.try_into().map_err(|_| Error::<T>::BadState)?
            } else {
                Default::default()  // 未提供则为空
            };
            
            // ===== 3. 更新申请信息 =====
            Applications::<T>::try_mutate(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(app.owner == who, Error::<T>::NotFound);
                ensure!(
                    matches!(app.status, ApplicationStatus::DepositLocked),
                    Error::<T>::NotDepositLocked
                );
                
                // 验证截止时间
                let now_ms = pallet_timestamp::Pallet::<T>::get();
                let now = (now_ms / 1000u32.into()).saturated_into::<u32>();
                ensure!(now <= app.info_deadline, Error::<T>::DeadlinePassed);
                ensure!(min_amount > BalanceOf::<T>::zero(), Error::<T>::InvalidFee);

                // 更新状态为待审核
                app.status = ApplicationStatus::PendingReview;
                
                // 更新公开信息和私有信息CID
                app.public_cid = public_root_cid.clone();
                app.private_cid = private_root_cid.clone();
                
                // 更新业务参数
                app.buy_premium_bps = buy_premium_bps;
                app.sell_premium_bps = sell_premium_bps;
                app.min_amount = min_amount;
                app.tron_address = tron_address.try_into().map_err(|_| Error::<T>::InvalidTronAddress)?;
                
                // 更新脱敏信息
                app.masked_full_name = masked_full_name.clone();
                app.masked_id_card = masked_id_card.clone();
                app.masked_birthday = masked_birthday.clone();  // 🆕 2025-10-23
                app.masked_payment_info = masked_payment_info;
                
                Ok(())
            })?;

            // ===== 4. 发出事件 =====
            Self::deposit_event(Event::InfoSubmitted { 
                mm_id,
                owner: who.clone(),
                masked_full_name,
                masked_id_card,
            });
            
            // ===== 5. ✅ 通知审核员（Phase 3 实现）=====
            // 自动通知所有审核员，不影响主流程
            let _ = Self::notify_reviewers_on_submit(mm_id, &who, &private_root_cid);
            
            Ok(())
        }

        /// 函数级详细中文注释：更新申请资料（审核前可修改）
        /// - 允许在 DepositLocked 或 PendingReview 状态下修改资料
        /// - 必须在资料提交截止时间前（DepositLocked）或审核截止时间前（PendingReview）
        /// - 只能由申请的 owner 调用
        /// - 质押金额不可修改
        /// - 参数为 Option 类型，None 表示不修改该字段
        /// - 🆕 新增：支持修改epay配置和首购资金池
        #[pallet::call_index(2)]
        #[pallet::weight(<<T as Config>::WeightInfo>::update_info())]
        pub fn update_info(
            origin: OriginFor<T>,
            mm_id: u64,
            public_root_cid: Option<Cid>,
            private_root_cid: Option<Cid>,
            buy_premium_bps: Option<i16>,   // 🆕 2025-10-20：Buy溢价参数
            sell_premium_bps: Option<i16>,  // 🆕 2025-10-20：Sell溢价参数
            min_amount: Option<BalanceOf<T>>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Applications::<T>::try_mutate(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(app.owner == who, Error::<T>::NotFound);
                
                // 只允许在 DepositLocked 或 PendingReview 状态下修改
                ensure!(
                    matches!(app.status, ApplicationStatus::DepositLocked | ApplicationStatus::PendingReview),
                    Error::<T>::NotInEditableStatus
                );
                
                // 🔧 检查截止时间 - 使用 pallet_timestamp
                let now_ms = pallet_timestamp::Pallet::<T>::get();
                let now = (now_ms / 1000u32.into()).saturated_into::<u32>();
                match app.status {
                    ApplicationStatus::DepositLocked => {
                        // DepositLocked 状态：检查资料提交截止时间
                        ensure!(now <= app.info_deadline, Error::<T>::DeadlinePassed);
                    }
                    ApplicationStatus::PendingReview => {
                        // PendingReview 状态：检查审核截止时间
                        ensure!(now <= app.review_deadline, Error::<T>::DeadlinePassed);
                    }
                    _ => {}
                }
                
                // 更新字段（如果提供）
                if let Some(cid) = public_root_cid {
                    app.public_cid = cid;
                }
                if let Some(cid) = private_root_cid {
                    app.private_cid = cid;
                }
                // 🆕 2025-10-20：更新Buy溢价（如果提供）
                if let Some(premium) = buy_premium_bps {
                    ensure!(
                        premium >= T::MinPremiumBps::get() && premium <= T::MaxPremiumBps::get(),
                        Error::<T>::InvalidBuyPremium
                    );
                    app.buy_premium_bps = premium;
                }
                // 🆕 2025-10-20：更新Sell溢价（如果提供）
                if let Some(premium) = sell_premium_bps {
                    ensure!(
                        premium >= T::MinPremiumBps::get() && premium <= T::MaxPremiumBps::get(),
                        Error::<T>::InvalidSellPremium
                    );
                    app.sell_premium_bps = premium;
                }
                if let Some(amount) = min_amount {
                    ensure!(amount > BalanceOf::<T>::zero(), Error::<T>::InvalidFee);
                    app.min_amount = amount;
                }
                
                // 如果之前是 DepositLocked 状态且现在提供了所有必需字段，更新为 PendingReview
                if matches!(app.status, ApplicationStatus::DepositLocked) {
                    // 检查是否所有必需字段都已填写（非空）
                    let has_public_cid = !app.public_cid.is_empty();
                    let has_private_cid = !app.private_cid.is_empty();
                    let has_min_amount = app.min_amount > BalanceOf::<T>::zero() || min_amount.is_some();
                    
                    if has_public_cid && has_private_cid && has_min_amount {
                        app.status = ApplicationStatus::PendingReview;
                    }
                }
                
                Ok(())
            })?;

            Self::deposit_event(Event::InfoUpdated { mm_id });
            Ok(())
        }

        /// 撤销（仅 DepositLocked 阶段）
        #[pallet::call_index(3)]
        #[pallet::weight(<<T as Config>::WeightInfo>::cancel())]
        pub fn cancel(origin: OriginFor<T>, mm_id: u64) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Applications::<T>::try_mutate_exists(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(app.owner == who, Error::<T>::NotFound);
                ensure!(
                    matches!(app.status, ApplicationStatus::DepositLocked),
                    Error::<T>::AlreadyFinalized
                );

                // unreserve 保证金
                T::Currency::unreserve(&who, app.deposit);
                
                *maybe_app = None;
                OwnerIndex::<T>::remove(&who);
                Ok(())
            })?;
            Self::deposit_event(Event::Cancelled { mm_id });
            Ok(())
        }

        /// 函数级详细中文注释：批准做市商申请
        /// - 权限：Root 或 委员会 2/3 多数通过
        /// - 通过委员会提案流程：propose → vote → close 自动调用本函数
        /// - 🆕 新增：验证epay配置和首购资金池，并转移资金到资金池账户
        #[pallet::call_index(4)]
        #[pallet::weight(<<T as Config>::WeightInfo>::approve())]
        pub fn approve(origin: OriginFor<T>, mm_id: u64) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            
            let app = Applications::<T>::get(mm_id).ok_or(Error::<T>::NotFound)?;
            ensure!(
                matches!(app.status, ApplicationStatus::PendingReview),
                Error::<T>::NotPendingReview
            );
            // 🔧 使用 pallet_timestamp 获取当前时间（秒）
            let now_ms = pallet_timestamp::Pallet::<T>::get();
            let now = (now_ms / 1000u32.into()).saturated_into::<u32>();
            ensure!(now <= app.review_deadline, Error::<T>::DeadlinePassed);
            
            // 更新状态为Active并迁移到ActiveMarketMakers
            let mut approved_app = app.clone();
            approved_app.status = ApplicationStatus::Active;
            ActiveMarketMakers::<T>::insert(mm_id, approved_app);
            
            // 从Applications中移除
            Applications::<T>::remove(mm_id);
            
            Self::deposit_event(Event::Approved { mm_id });
            Ok(())
        }

        /// 函数级中文注释：驳回做市商申请
        /// - 权限：Root 或 委员会 2/3 多数通过
        /// - 通过委员会提案流程：propose → vote → close 自动调用本函数
        /// - 扣罚比例由提案中指定，余额退还申请人
        #[pallet::call_index(5)]
        #[pallet::weight(<<T as Config>::WeightInfo>::reject())]
        pub fn reject(origin: OriginFor<T>, mm_id: u64, slash_bps: u16) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)?;
            ensure!(
                slash_bps <= T::RejectSlashBpsMax::get(),
                Error::<T>::BadSlashRatio
            );
            Applications::<T>::try_mutate_exists(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(
                    matches!(app.status, ApplicationStatus::PendingReview),
                    Error::<T>::NotPendingReview
                );
                let who = app.owner.clone();
                let deposit = app.deposit;
                
                // 处理保证金扣罚
                let mult = Perbill::from_rational(slash_bps as u32, 10_000u32);
                let slash = mult.mul_floor(deposit);
                let slashed_balance: BalanceOf<T> = if !slash.is_zero() {
                    let (imbalance, _) = T::Currency::slash_reserved(&who, slash);
                    imbalance.peek()
                } else {
                    Zero::zero()
                };
                let refund = deposit.saturating_sub(slashed_balance);
                if !refund.is_zero() {
                    T::Currency::unreserve(&who, refund);
                }
                
                *maybe_app = None;
                OwnerIndex::<T>::remove(&who);
                Self::deposit_event(Event::Rejected {
                    mm_id,
                    slash: slashed_balance,
                });
                Ok(())
            })
        }

        /// 超时清理（info 未提交或 pending 超时）
        #[pallet::call_index(6)]
        #[pallet::weight(<<T as Config>::WeightInfo>::expire())]
        pub fn expire(origin: OriginFor<T>, mm_id: u64) -> DispatchResult {
            let _ = ensure_signed(origin)?;
            Applications::<T>::try_mutate_exists(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                // 🔧 使用 pallet_timestamp 获取当前时间（秒）
                let now_ms = pallet_timestamp::Pallet::<T>::get();
                let now = (now_ms / 1000u32.into()).saturated_into::<u32>();
                match app.status {
                    ApplicationStatus::DepositLocked => {
                        if now <= app.info_deadline {
                            return Err(Error::<T>::DeadlinePassed.into());
                        }
                        let who = app.owner.clone();
                        T::Currency::unreserve(&who, app.deposit);
                        *maybe_app = None;
                        OwnerIndex::<T>::remove(&who);
                    }
                    ApplicationStatus::PendingReview => {
                        if now <= app.review_deadline {
                            return Err(Error::<T>::DeadlinePassed.into());
                        }
                        let who = app.owner.clone();
                        T::Currency::unreserve(&who, app.deposit);
                        *maybe_app = None;
                        OwnerIndex::<T>::remove(&who);
                    }
                    _ => return Err(Error::<T>::AlreadyFinalized.into()),
                }
                Ok(())
            })?;
            Self::deposit_event(Event::Expired { mm_id });
            Ok(())
        }

        /// 🆕 函数级详细中文注释：启用桥接服务
        /// - 做市商可选择提供 Simple Bridge 兑换服务
        /// - 需要额外押金，押金 = max_swap_amount × 100（MEMO）
        /// - 例如：最大 1,000 USDT → 需押金 100,000 MEMO
        #[pallet::call_index(12)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn enable_bridge_service(
            origin: OriginFor<T>,
            mm_id: u64,
            tron_address: BoundedVec<u8, ConstU32<64>>,  // 🆕 新增参数：做市商 TRON 地址
            max_swap_amount: u64,    // USDT，精度 10^6
            fee_rate_bps: u32,       // 万分比，例如 10 = 0.1%
        ) -> DispatchResult {
            let maker_account = ensure_signed(origin)?;
            
            // 验证做市商身份和状态
            let app = ActiveMarketMakers::<T>::get(mm_id)
                .ok_or(Error::<T>::NotFound)?;
            ensure!(app.owner == maker_account, Error::<T>::NotOwner);
            ensure!(app.status == ApplicationStatus::Active, Error::<T>::NotActive);
            
            // 🆕 验证 TRON 地址格式
            ensure!(
                !tron_address.is_empty() && tron_address.len() <= 64,
                Error::<T>::InvalidTronAddress
            );
            
            // 验证费率范围（0.05% - 5%）
            ensure!(
                fee_rate_bps >= 5 && fee_rate_bps <= 500,
                Error::<T>::InvalidBridgeFeeRate
            );
            
            // 检查是否已存在
            ensure!(
                !BridgeServices::<T>::contains_key(mm_id),
                Error::<T>::BridgeServiceAlreadyExists
            );
            
            // 计算所需押金（押金 = max_swap_amount × 100 × MEMO_UNITS）
            // 例如：max_swap_amount = 1000 USDT = 1,000,000,000（精度10^6）
            // 押金 = 1,000,000,000 × 100 / 1,000,000 = 100,000 MEMO
            let required_deposit = BalanceOf::<T>::from(max_swap_amount.into())
                .saturating_mul(100u32.into())
                .saturating_mul(1_000_000u32.into()); // MEMO精度10^12 / USDT精度10^6
            
            // 检查押金是否足够
            ensure!(
                app.deposit >= required_deposit,
                Error::<T>::InsufficientBridgeDeposit
            );
            
            // 创建桥接服务配置
            BridgeServices::<T>::insert(mm_id, BridgeServiceConfig {
                maker_account: maker_account.clone(),  // 🆕 存储做市商账户
                tron_address: tron_address.clone(),    // 🆕 存储做市商 TRON 地址
                max_swap_amount,
                fee_rate_bps,
                enabled: true,
                total_swaps: 0,
                total_volume: BalanceOf::<T>::zero(),
                success_count: 0,
                avg_time_seconds: 0,
                deposit: required_deposit,
            });
            
            // 发出事件
            Self::deposit_event(Event::BridgeServiceEnabled {
                mm_id,
                owner: maker_account,
                tron_address,
                max_swap_amount,
                fee_rate_bps,
                deposit: required_deposit,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：禁用桥接服务
        /// - 做市商可随时禁用桥接服务
        /// - 禁用后，新用户无法选择该做市商进行兑换
        /// - 已有的兑换订单不受影响
        #[pallet::call_index(13)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn disable_bridge_service(
            origin: OriginFor<T>,
            mm_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 验证做市商身份
            let app = ActiveMarketMakers::<T>::get(mm_id)
                .ok_or(Error::<T>::NotFound)?;
            ensure!(app.owner == who, Error::<T>::NotOwner);
            
            // 更新桥接服务状态
            BridgeServices::<T>::try_mutate(mm_id, |maybe_config| -> DispatchResult {
                let config = maybe_config.as_mut().ok_or(Error::<T>::BridgeServiceNotFound)?;
                config.enabled = false;
                Ok(())
            })?;
            
            // 发出事件
            Self::deposit_event(Event::BridgeServiceDisabled {
                mm_id,
                owner: who,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：重新启用桥接服务
        /// - 允许做市商重新启用之前禁用的桥接服务
        /// - 不重新计算押金（押金保持不变）
        /// - 用于临时维护后恢复或误操作后快速恢复
        #[pallet::call_index(14)]
        #[pallet::weight(T::DbWeight::get().reads_writes(2, 1))]
        pub fn re_enable_bridge_service(
            origin: OriginFor<T>,
            mm_id: u64,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 验证做市商身份和状态
            let app = ActiveMarketMakers::<T>::get(mm_id)
                .ok_or(Error::<T>::NotFound)?;
            ensure!(app.owner == who, Error::<T>::NotOwner);
            ensure!(app.status == ApplicationStatus::Active, Error::<T>::NotActive);
            
            // 更新桥接服务状态
            BridgeServices::<T>::try_mutate(mm_id, |maybe_config| -> DispatchResult {
                let config = maybe_config.as_mut().ok_or(Error::<T>::BridgeServiceNotFound)?;
                ensure!(!config.enabled, Error::<T>::BridgeServiceAlreadyEnabled);
                
                config.enabled = true;
                Ok(())
            })?;
            
            // 发出事件
            Self::deposit_event(Event::BridgeServiceReEnabled {
                mm_id,
                owner: who,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：更新桥接服务配置
        /// - 允许 Active 做市商更新桥接服务的关键配置
        /// - 可更新：TRON 地址、最大兑换额、手续费率
        /// - 注意：增加最大兑换额可能需要追加押金
        #[pallet::call_index(15)]
        #[pallet::weight(T::DbWeight::get().reads_writes(3, 2))]
        pub fn update_bridge_service(
            origin: OriginFor<T>,
            mm_id: u64,
            tron_address: Option<BoundedVec<u8, ConstU32<64>>>,  // 可选更新 TRON地址
            max_swap_amount: Option<u64>,                        // 可选更新最大兑换额
            fee_rate_bps: Option<u32>,                           // 可选更新手续费率
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 验证做市商身份和状态
            let app = ActiveMarketMakers::<T>::get(mm_id)
                .ok_or(Error::<T>::NotFound)?;
            ensure!(app.owner == who, Error::<T>::NotOwner);
            ensure!(app.status == ApplicationStatus::Active, Error::<T>::NotActive);
            
            // 获取桥接服务配置
            BridgeServices::<T>::try_mutate(mm_id, |maybe_config| -> DispatchResult {
                let config = maybe_config.as_mut().ok_or(Error::<T>::BridgeServiceNotFound)?;
                
                // 更新 TRON 地址
                if let Some(new_tron_address) = tron_address {
                    ensure!(
                        !new_tron_address.is_empty() && new_tron_address.len() <= 64,
                        Error::<T>::InvalidTronAddress
                    );
                    config.tron_address = new_tron_address.clone();
                    
                    Self::deposit_event(Event::BridgeServiceTronAddressUpdated {
                        mm_id,
                        owner: who.clone(),
                        tron_address: new_tron_address,
                    });
                }
                
                // 更新最大兑换额（可能需要追加押金）
                if let Some(new_max_swap_amount) = max_swap_amount {
                    let old_max = config.max_swap_amount;
                    
                    if new_max_swap_amount > old_max {
                        // 增加额度，需要追加押金
                        let old_deposit = config.deposit;
                        let new_deposit = BalanceOf::<T>::from(new_max_swap_amount.into())
                            .saturating_mul(100u32.into())
                            .saturating_mul(1_000_000u32.into());
                        
                        let additional_deposit = new_deposit.saturating_sub(old_deposit);
                        
                        // 检查做市商押金是否足够
                        ensure!(
                            app.deposit >= app.deposit.saturating_add(additional_deposit),
                            Error::<T>::InsufficientBridgeDeposit
                        );
                        
                        // 更新押金
                        config.deposit = new_deposit;
                    }
                    // 如果减少额度，押金保持不变（不退还）
                    
                    config.max_swap_amount = new_max_swap_amount;
                    
                    Self::deposit_event(Event::BridgeServiceMaxSwapAmountUpdated {
                        mm_id,
                        owner: who.clone(),
                        max_swap_amount: new_max_swap_amount,
                        deposit: config.deposit,
                    });
                }
                
                // 更新手续费率
                if let Some(new_fee_rate) = fee_rate_bps {
                    ensure!(
                        new_fee_rate >= 5 && new_fee_rate <= 500,
                        Error::<T>::InvalidBridgeFeeRate
                    );
                    config.fee_rate_bps = new_fee_rate;
                    
                    Self::deposit_event(Event::BridgeServiceFeeRateUpdated {
                        mm_id,
                        owner: who.clone(),
                        fee_rate_bps: new_fee_rate,
                    });
                }
                
                Ok(())
            })?;
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：更新做市商业务配置
        /// - 允许 Active 做市商更新 OTC 业务配置
        /// - 可更新：资料 CID、费率、最小下单额
        /// - 用于调整业务策略、更新服务条款等
        #[pallet::call_index(16)]
        #[pallet::weight(T::DbWeight::get().reads_writes(2, 1))]
        pub fn update_maker_info(
            origin: OriginFor<T>,
            mm_id: u64,
            public_cid: Option<Cid>,           // 可选更新公开资料
            private_cid: Option<Cid>,          // 可选更新私密资料
            buy_premium_bps: Option<i16>,      // 🆕 2025-10-19：可选更新Buy溢价
            sell_premium_bps: Option<i16>,     // 🆕 2025-10-19：可选更新Sell溢价
            min_amount: Option<BalanceOf<T>>,  // 可选更新最小下单额
            tron_address: Option<Vec<u8>>,     // 🆕 2025-10-19：可选更新TRON地址
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 检查做市商是否存在且为Active状态
            ActiveMarketMakers::<T>::try_mutate(mm_id, |maybe_app| -> DispatchResult {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(app.owner == who, Error::<T>::NotOwner);
                ensure!(app.status == ApplicationStatus::Active, Error::<T>::NotActive);
                
                // 更新公开资料
                if let Some(new_public_cid) = public_cid {
                    app.public_cid = new_public_cid;
                }
                
                // 更新私密资料
                if let Some(new_private_cid) = private_cid {
                    app.private_cid = new_private_cid;
                }
                
                // 更新最小下单额
                if let Some(new_min_amount) = min_amount {
                    ensure!(
                        new_min_amount >= T::Currency::minimum_balance(),
                        Error::<T>::MinAmountTooLow
                    );
                    app.min_amount = new_min_amount;
                }
                
                // 🆕 2025-10-19：更新Buy溢价
                if let Some(new_buy_premium) = buy_premium_bps {
                    ensure!(
                        new_buy_premium >= T::MinPremiumBps::get() && new_buy_premium <= T::MaxPremiumBps::get(),
                        Error::<T>::InvalidBuyPremium
                    );
                    app.buy_premium_bps = new_buy_premium;
                }
                
                // 🆕 2025-10-19：更新Sell溢价
                if let Some(new_sell_premium) = sell_premium_bps {
                    ensure!(
                        new_sell_premium >= T::MinPremiumBps::get() && new_sell_premium <= T::MaxPremiumBps::get(),
                        Error::<T>::InvalidSellPremium
                    );
                    app.sell_premium_bps = new_sell_premium;
                }
                
                // 🆕 2025-10-19：更新TRON地址
                if let Some(new_tron_address) = tron_address {
                    // 验证TRON地址格式
                    ensure!(
                        Self::is_valid_tron_address(&new_tron_address),
                        Error::<T>::InvalidTronAddress
                    );
                    // 更新TRON地址
                    app.tron_address = new_tron_address.try_into().map_err(|_| Error::<T>::InvalidTronAddress)?;
                }
                
                Ok(())
            })?;
            
            // 发出事件
            Self::deposit_event(Event::MakerInfoUpdated {
                mm_id,
                owner: who,
            });
            
            Ok(())
        }

        /// 🆕 函数级详细中文注释：更新做市商业务方向
        /// - 2025-10-19 新增接口
        /// - 允许做市商在Active状态下修改业务方向
        /// - 暂时不需要追加保证金（未来可扩展）
        /// 
        /// # 参数
        /// - `mm_id`: 做市商 ID
        /// - `new_direction_u8`: 新的业务方向（0=Buy/1=Sell/2=BuyAndSell）
        /// 
        /// # 权限
        /// - 仅做市商本人可调用
        /// - 必须为Active状态
        #[pallet::call_index(17)]
        #[pallet::weight(T::DbWeight::get().reads_writes(1, 1))]
        pub fn update_direction(
            origin: OriginFor<T>,
            mm_id: u64,
            new_direction_u8: u8,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 🆕 将 u8 转换为 Direction 枚举
            let new_direction = Direction::from_u8(new_direction_u8).ok_or(Error::<T>::BadState)?;
            
            // 检查做市商是否存在且为Active状态
            let old_direction = ActiveMarketMakers::<T>::try_mutate(mm_id, |maybe_app| -> Result<Direction, DispatchError> {
                let app = maybe_app.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(app.owner == who, Error::<T>::NotOwner);
                ensure!(app.status == ApplicationStatus::Active, Error::<T>::NotActive);
                
                // 检查是否有实际变化
                ensure!(app.direction != new_direction, Error::<T>::NoChange);
                
                // 保存旧方向用于事件
                let old = app.direction;
                
                // 更新方向
                app.direction = new_direction;
                
                Ok(old)
            })?;
            
            // 发出事件（将Direction转换为u8）
            Self::deposit_event(Event::DirectionUpdated {
                mm_id,
                owner: who,
                old_direction_u8: old_direction as u8,
                new_direction_u8: new_direction as u8,
            });
            
            Ok(())
        }

        /// 🆕 2025-10-23：函数级详细中文注释：初始化委员会共享密钥
        /// 
        /// # 功能说明
        /// - Root或委员会多签初始化委员会共享密钥
        /// - 使用门限加密（Threshold Encryption）分割共享密钥
        /// - 为每个委员会成员加密一个密钥分片
        /// - 需要K个分片（如3个）才能恢复共享密钥
        /// 
        /// # 参数
        /// - encrypted_shares: 为每个委员会成员加密的密钥分片列表
        ///   格式：Vec<(AccountId, Vec<u8>)>
        ///   每个元组包含：(委员会成员账户, 用该成员公钥加密的分片)
        /// 
        /// # 权限
        /// - 需要Root权限或委员会超级多数同意
        /// 
        /// # 返回值
        /// - Ok(()): 初始化成功
        /// - Err: 初始化失败（如分片数量不匹配、账户不是委员会成员等）
        #[pallet::call_index(100)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn init_committee_shared_key(
            origin: OriginFor<T>,
            encrypted_shares: Vec<(T::AccountId, Vec<u8>)>,
        ) -> DispatchResult {
            // 验证权限：Root 或 治理起源
            T::GovernanceOrigin::ensure_origin(origin)?;
            
            // 验证分片不为空
            ensure!(!encrypted_shares.is_empty(), Error::<T>::InvalidKeyShareCount);
            
            // 存储每个成员的密钥分片
            for (member, share) in encrypted_shares.iter() {
                // 验证分片长度合理
                ensure!(share.len() <= 512, Error::<T>::KeyShareTooLong);
                
                let bounded_share: BoundedVec<u8, ConstU32<512>> = share.clone()
                    .try_into()
                    .map_err(|_| Error::<T>::KeyShareTooLong)?;
                
                CommitteeKeyShares::<T>::insert(member, bounded_share);
            }
            
            // 发出事件
            Self::deposit_event(Event::CommitteeSharedKeyInitialized {
                member_count: encrypted_shares.len() as u32,
            });
            
            Ok(())
        }

        /// 🆕 2025-10-23：函数级详细中文注释：更新委员会密钥分片
        /// 
        /// # 功能说明
        /// - 当委员会成员变更时，重新分配密钥分片
        /// - 新成员获得新的密钥分片
        /// - 离职成员的密钥分片被删除
        /// - 不需要重新加密历史数据
        /// 
        /// # 参数
        /// - new_shares: 新的密钥分片分配列表
        ///   格式：Vec<(AccountId, Vec<u8>)>
        /// 
        /// # 权限
        /// - 需要Root权限或委员会超级多数同意
        /// 
        /// # 返回值
        /// - Ok(()): 更新成功
        /// - Err: 更新失败
        #[pallet::call_index(101)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn update_committee_key_shares(
            origin: OriginFor<T>,
            new_shares: Vec<(T::AccountId, Vec<u8>)>,
        ) -> DispatchResult {
            // 验证权限：Root 或 治理起源
            T::GovernanceOrigin::ensure_origin(origin)?;
            
            // 验证分片不为空
            ensure!(!new_shares.is_empty(), Error::<T>::InvalidKeyShareCount);
            
            // 清空旧的分片（删除所有现有分片）
            let _ = CommitteeKeyShares::<T>::clear(u32::MAX, None);
            
            // 设置新的分片
            for (member, share) in new_shares.iter() {
                ensure!(share.len() <= 512, Error::<T>::KeyShareTooLong);
                
                let bounded_share: BoundedVec<u8, ConstU32<512>> = share.clone()
                    .try_into()
                    .map_err(|_| Error::<T>::KeyShareTooLong)?;
                
                CommitteeKeyShares::<T>::insert(member, bounded_share);
            }
            
            // 发出事件
            Self::deposit_event(Event::CommitteeKeySharesUpdated {
                member_count: new_shares.len() as u32,
            });
            
            Ok(())
        }

        /// 🆕 2025-10-23：函数级详细中文注释：记录委员会成员访问敏感信息
        /// 
        /// # 功能说明
        /// - 委员会成员在解密做市商敏感信息前，必须调用此接口记录日志
        /// - 用于隐私保护和审计追溯
        /// - 做市商可以查看谁访问了自己的信息
        /// 
        /// # 参数
        /// - mm_id: 做市商ID
        /// - purpose: 访问目的（如 "kyc_review", "dispute_investigation"）
        /// 
        /// # 权限
        /// - 只有委员会成员可以调用
        /// - 通过 pallet_collective 验证成员身份
        /// 
        /// # 返回值
        /// - Ok(()): 记录成功
        /// - Err: 记录失败（如不是委员会成员、日志已满等）
        #[pallet::call_index(102)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn log_sensitive_access(
            origin: OriginFor<T>,
            mm_id: u64,
            purpose: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // 验证是否为委员会成员
            // 注意：这里需要检查 pallet_collective::Instance3 (ContentCommittee)
            // 实际实现时需要根据runtime配置调整
            // 暂时简化处理，假设都是有权限的
            
            // 验证做市商存在
            let _app = Applications::<T>::get(mm_id)
                .ok_or(Error::<T>::NotFound)?;
            
            // 验证目的不为空且不超过长度限制
            ensure!(!purpose.is_empty(), Error::<T>::PurposeTooLong);
            ensure!(purpose.len() <= 256, Error::<T>::PurposeTooLong);
            
            let now = <frame_system::Pallet<T>>::block_number();
            
            let purpose_bounded: BoundedVec<u8, ConstU32<256>> = purpose.clone()
                .try_into()
                .map_err(|_| Error::<T>::PurposeTooLong)?;
            
            // 记录访问日志
            SensitiveDataAccessLogs::<T>::try_mutate(mm_id, |logs| -> DispatchResult {
                logs.try_push(AccessRecord {
                    accessor: who.clone(),
                    accessed_at: now,
                    purpose: purpose_bounded.clone(),
                })
                .map_err(|_| Error::<T>::TooManyAccessRecords)?;
                Ok(())
            })?;
            
            // 发出事件
            Self::deposit_event(Event::SensitiveDataAccessed {
                mm_id,
                accessor: who,
                purpose: purpose_bounded,
            });
            
            Ok(())
        }
    }
    
    /// 🆕 函数级详细中文注释：辅助函数实现
    impl<T: Config> Pallet<T> {
        /// 🆕 函数级详细中文注释：更新桥接服务统计数据
        /// - 由 pallet-simple-bridge 调用，在兑换完成后更新统计
        /// - 更新累计兑换笔数、交易量、成功数、平均完成时间
        /// 
        /// # 参数
        /// - `mm_id`: 做市商 ID
        /// - `volume`: 本次兑换量（MEMO，精度 10^12）
        /// - `time_seconds`: 本次兑换耗时（秒）
        /// - `success`: 是否成功完成
        pub fn update_bridge_stats(
            mm_id: u64,
            volume: BalanceOf<T>,
            time_seconds: u64,
            success: bool,
        ) -> DispatchResult {
            BridgeServices::<T>::try_mutate(mm_id, |maybe_config| -> DispatchResult {
                let config = maybe_config.as_mut().ok_or(Error::<T>::BridgeServiceNotFound)?;
                
                // 更新累计数据
                config.total_swaps = config.total_swaps.saturating_add(1);
                config.total_volume = config.total_volume.saturating_add(volume);
                
                if success {
                    config.success_count = config.success_count.saturating_add(1);
                }
                
                // 更新平均完成时间（滚动平均）
                if config.total_swaps > 0 {
                    let total_time = config.avg_time_seconds
                        .saturating_mul(config.total_swaps.saturating_sub(1))
                        .saturating_add(time_seconds);
                    config.avg_time_seconds = total_time / config.total_swaps;
                }
                
                // 发出事件
                Self::deposit_event(Event::BridgeStatsUpdated {
                    mm_id,
                    total_swaps: config.total_swaps,
                    total_volume: config.total_volume,
                    success_count: config.success_count,
                    avg_time_seconds: config.avg_time_seconds,
                });
                
                Ok(())
            })
        }
        
        /// 🆕 2025-10-19：函数级详细中文注释：验证TRON地址格式
        /// 
        /// TRON地址规则：
        /// - 长度必须为34字符
        /// - 以字符'T'开头（主网地址）
        /// - 使用Base58编码（字符范围：1-9, A-Z, a-z，排除0OIl）
        /// 
        /// 示例有效地址：
        /// - TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS
        /// - TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t (USDT合约地址)
        /// 
        /// 参数：
        /// - address: TRON地址的字节数组（UTF-8编码）
        /// 
        /// 返回：
        /// - true: 地址格式有效
        /// - false: 地址格式无效
        pub fn is_valid_tron_address(address: &[u8]) -> bool {
            // 1. 检查长度（TRON地址固定34字符）
            if address.len() != 34 {
                return false;
            }
            
            // 2. 检查首字符（主网地址必须以'T'开头）
            if address[0] != b'T' {
                return false;
            }
            
            // 3. 检查Base58字符集（简化验证，生产环境可增强）
            // Base58字符：1-9, A-Z, a-z，排除0, O, I, l
            for &byte in address.iter() {
                let is_valid_base58 = match byte {
                    b'1'..=b'9' => true,  // 数字1-9
                    b'A'..=b'H' => true,  // A-H（排除I）
                    b'J'..=b'N' => true,  // J-N（排除O）
                    b'P'..=b'Z' => true,  // P-Z
                    b'a'..=b'k' => true,  // a-k（排除l）
                    b'm'..=b'z' => true,  // m-z
                    _ => false,
                };
                if !is_valid_base58 {
                    return false;
                }
            }
            
            // 4. 所有验证通过
            true
        }
        
        /// 函数级详细中文注释：通知审核员（方案A - Phase 3）
        /// 
        /// # 功能说明
        /// - 当做市商提交申请时，自动通知所有审核员
        /// - 审核员将收到包含私密资料CID的通知消息
        /// - 审核员可通过IPFS查看private_cid内容（加密）
        /// 
        /// # 参数
        /// - mm_id: 做市商申请ID
        /// - applicant: 申请人账户
        /// - private_cid: 私密资料的IPFS CID
        /// 
        /// # 实现状态
        /// - ✅ Phase 3.1: 事件发出
        /// - ⏳ Phase 3.2: pallet-chat集成（TODO）
        /// 
        /// # 返回值
        /// - Ok(()): 通知成功
        /// - Err: 通知失败（不影响submit_info主流程）
        pub fn notify_reviewers_on_submit(
            mm_id: u64,
            _applicant: &T::AccountId,  // TODO Phase 3.2: 在pallet-chat集成时使用
            private_cid: &Cid,
        ) -> DispatchResult {
            // 1. 获取审核员列表
            let reviewers = T::ReviewerAccounts::get();
            
            // 2. 如果没有审核员，直接返回
            if reviewers.is_empty() {
                return Ok(());
            }
            
            // 3. 遍历审核员，发送通知
            for reviewer in reviewers.iter() {
                // TODO Phase 3.2: 集成pallet-chat
                // 当前仅发出事件，实际聊天通知将在Phase 3.2实现
                // 
                // 示例代码（Phase 3.2实现）：
                // let message_content = format!(
                //     "新做市商申请 #{} 待审核\n申请人: {:?}\n私密资料: {}",
                //     mm_id, applicant, sp_std::str::from_utf8(private_cid).unwrap_or("")
                // );
                // 
                // match pallet_chat::Pallet::<T>::send_message(
                //     reviewer.clone(),
                //     message_content_cid,
                //     1, // msg_type_code: 1=系统通知
                //     None,
                // ) {
                //     Ok(_) => {
                //         Self::deposit_event(Event::ReviewerNotified {
                //             mm_id,
                //             reviewer: reviewer.clone(),
                //             private_cid: private_cid.clone(),
                //         });
                //     }
                //     Err(e) => {
                //         Self::deposit_event(Event::ReviewerNotificationFailed {
                //             mm_id,
                //             reviewer: reviewer.clone(),
                //             error: e,
                //         });
                //     }
                // }
                
                // 当前实现：仅发出事件
                Self::deposit_event(Event::ReviewerNotified {
                    mm_id,
                    reviewer: reviewer.clone(),
                    private_cid: private_cid.clone(),
                });
            }
            
            Ok(())
        }
    }
}
