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

// External crates imports
use alloc::vec::Vec;
use frame_support::{
    genesis_builder_helper::{build_state, get_preset},
    weights::Weight,
};
use pallet_grandpa::AuthorityId as GrandpaId;
use sp_api::impl_runtime_apis;
use sp_consensus_aura::sr25519::AuthorityId as AuraId;
use sp_core::{crypto::KeyTypeId, OpaqueMetadata};
use sp_runtime::{
    traits::{Block as BlockT, NumberFor},
    transaction_validity::{TransactionSource, TransactionValidity},
    ApplyExtrinsicResult,
};
use sp_version::RuntimeVersion;
use pallet_chat_permission::FriendshipChecker;

// Local module imports
use super::{
    AccountId, Aura, Balance, Block, Executive, Grandpa, InherentDataExt, Nonce, Runtime,
    RuntimeCall, RuntimeGenesisConfig, SessionKeys, System, TransactionPayment, VERSION,
    ChatPermission,
};

impl_runtime_apis! {
    impl sp_api::Core<Block> for Runtime {
        fn version() -> RuntimeVersion {
            VERSION
        }

        fn execute_block(block: Block) {
            Executive::execute_block(block);
        }

        fn initialize_block(header: &<Block as BlockT>::Header) -> sp_runtime::ExtrinsicInclusionMode {
            Executive::initialize_block(header)
        }
    }

    impl sp_api::Metadata<Block> for Runtime {
        fn metadata() -> OpaqueMetadata {
            OpaqueMetadata::new(Runtime::metadata().into())
        }

        fn metadata_at_version(version: u32) -> Option<OpaqueMetadata> {
            Runtime::metadata_at_version(version)
        }

        fn metadata_versions() -> Vec<u32> {
            Runtime::metadata_versions()
        }
    }

    impl frame_support::view_functions::runtime_api::RuntimeViewFunction<Block> for Runtime {
        fn execute_view_function(id: frame_support::view_functions::ViewFunctionId, input: Vec<u8>) -> Result<Vec<u8>, frame_support::view_functions::ViewFunctionDispatchError> {
            Runtime::execute_view_function(id, input)
        }
    }

    impl sp_block_builder::BlockBuilder<Block> for Runtime {
        fn apply_extrinsic(extrinsic: <Block as BlockT>::Extrinsic) -> ApplyExtrinsicResult {
            Executive::apply_extrinsic(extrinsic)
        }

        fn finalize_block() -> <Block as BlockT>::Header {
            Executive::finalize_block()
        }

        fn inherent_extrinsics(data: sp_inherents::InherentData) -> Vec<<Block as BlockT>::Extrinsic> {
            data.create_extrinsics()
        }

        fn check_inherents(
            block: Block,
            data: sp_inherents::InherentData,
        ) -> sp_inherents::CheckInherentsResult {
            data.check_extrinsics(&block)
        }
    }

    impl sp_transaction_pool::runtime_api::TaggedTransactionQueue<Block> for Runtime {
        fn validate_transaction(
            source: TransactionSource,
            tx: <Block as BlockT>::Extrinsic,
            block_hash: <Block as BlockT>::Hash,
        ) -> TransactionValidity {
            Executive::validate_transaction(source, tx, block_hash)
        }
    }

    impl sp_offchain::OffchainWorkerApi<Block> for Runtime {
        fn offchain_worker(header: &<Block as BlockT>::Header) {
            Executive::offchain_worker(header)
        }
    }

    impl sp_consensus_aura::AuraApi<Block, AuraId> for Runtime {
        fn slot_duration() -> sp_consensus_aura::SlotDuration {
            sp_consensus_aura::SlotDuration::from_millis(Aura::slot_duration())
        }

        fn authorities() -> Vec<AuraId> {
            pallet_aura::Authorities::<Runtime>::get().into_inner()
        }
    }

    impl sp_session::SessionKeys<Block> for Runtime {
        fn generate_session_keys(seed: Option<Vec<u8>>) -> Vec<u8> {
            SessionKeys::generate(seed)
        }

        fn decode_session_keys(
            encoded: Vec<u8>,
        ) -> Option<Vec<(Vec<u8>, KeyTypeId)>> {
            SessionKeys::decode_into_raw_public_keys(&encoded)
        }
    }

    impl sp_consensus_grandpa::GrandpaApi<Block> for Runtime {
        fn grandpa_authorities() -> sp_consensus_grandpa::AuthorityList {
            Grandpa::grandpa_authorities()
        }

        fn current_set_id() -> sp_consensus_grandpa::SetId {
            Grandpa::current_set_id()
        }

        fn submit_report_equivocation_unsigned_extrinsic(
            _equivocation_proof: sp_consensus_grandpa::EquivocationProof<
                <Block as BlockT>::Hash,
                NumberFor<Block>,
            >,
            _key_owner_proof: sp_consensus_grandpa::OpaqueKeyOwnershipProof,
        ) -> Option<()> {
            None
        }

        fn generate_key_ownership_proof(
            _set_id: sp_consensus_grandpa::SetId,
            _authority_id: GrandpaId,
        ) -> Option<sp_consensus_grandpa::OpaqueKeyOwnershipProof> {
            // NOTE: this is the only implementation possible since we've
            // defined our key owner proof type as a bottom type (i.e. a type
            // with no values).
            None
        }
    }

    impl frame_system_rpc_runtime_api::AccountNonceApi<Block, AccountId, Nonce> for Runtime {
        fn account_nonce(account: AccountId) -> Nonce {
            System::account_nonce(account)
        }
    }

    impl pallet_transaction_payment_rpc_runtime_api::TransactionPaymentApi<Block, Balance> for Runtime {
        fn query_info(
            uxt: <Block as BlockT>::Extrinsic,
            len: u32,
        ) -> pallet_transaction_payment_rpc_runtime_api::RuntimeDispatchInfo<Balance> {
            TransactionPayment::query_info(uxt, len)
        }
        fn query_fee_details(
            uxt: <Block as BlockT>::Extrinsic,
            len: u32,
        ) -> pallet_transaction_payment::FeeDetails<Balance> {
            TransactionPayment::query_fee_details(uxt, len)
        }
        fn query_weight_to_fee(weight: Weight) -> Balance {
            TransactionPayment::weight_to_fee(weight)
        }
        fn query_length_to_fee(length: u32) -> Balance {
            TransactionPayment::length_to_fee(length)
        }
    }

    impl pallet_transaction_payment_rpc_runtime_api::TransactionPaymentCallApi<Block, Balance, RuntimeCall>
        for Runtime
    {
        fn query_call_info(
            call: RuntimeCall,
            len: u32,
        ) -> pallet_transaction_payment::RuntimeDispatchInfo<Balance> {
            TransactionPayment::query_call_info(call, len)
        }
        fn query_call_fee_details(
            call: RuntimeCall,
            len: u32,
        ) -> pallet_transaction_payment::FeeDetails<Balance> {
            TransactionPayment::query_call_fee_details(call, len)
        }
        fn query_weight_to_fee(weight: Weight) -> Balance {
            TransactionPayment::weight_to_fee(weight)
        }
        fn query_length_to_fee(length: u32) -> Balance {
            TransactionPayment::length_to_fee(length)
        }
    }

    #[cfg(feature = "runtime-benchmarks")]
    impl frame_benchmarking::Benchmark<Block> for Runtime {
        fn benchmark_metadata(extra: bool) -> (
            Vec<frame_benchmarking::BenchmarkList>,
            Vec<frame_support::traits::StorageInfo>,
        ) {
            use frame_benchmarking::{baseline, BenchmarkList};
            use frame_support::traits::StorageInfoTrait;
            use frame_system_benchmarking::Pallet as SystemBench;
            use frame_system_benchmarking::extensions::Pallet as SystemExtensionsBench;
            use baseline::Pallet as BaselineBench;
            use super::*;

            let mut list = Vec::<BenchmarkList>::new();
            list_benchmarks!(list, extra);

            let storage_info = AllPalletsWithSystem::storage_info();

            (list, storage_info)
        }

        #[allow(non_local_definitions)]
        fn dispatch_benchmark(
            config: frame_benchmarking::BenchmarkConfig
        ) -> Result<Vec<frame_benchmarking::BenchmarkBatch>, alloc::string::String> {
            use frame_benchmarking::{baseline, BenchmarkBatch};
            use sp_storage::TrackedStorageKey;
            use frame_system_benchmarking::Pallet as SystemBench;
            use frame_system_benchmarking::extensions::Pallet as SystemExtensionsBench;
            use baseline::Pallet as BaselineBench;
            use super::*;

            impl frame_system_benchmarking::Config for Runtime {}
            impl baseline::Config for Runtime {}

            use frame_support::traits::WhitelistedStorageKeys;
            let whitelist: Vec<TrackedStorageKey> = AllPalletsWithSystem::whitelisted_storage_keys();

            let mut batches = Vec::<BenchmarkBatch>::new();
            let params = (&config, &whitelist);
            add_benchmarks!(params, batches);

            Ok(batches)
        }
    }

    #[cfg(feature = "try-runtime")]
    impl frame_try_runtime::TryRuntime<Block> for Runtime {
        fn on_runtime_upgrade(checks: frame_try_runtime::UpgradeCheckSelect) -> (Weight, Weight) {
            // NOTE: intentional unwrap: we don't want to propagate the error backwards, and want to
            // have a backtrace here. If any of the pre/post migration checks fail, we shall stop
            // right here and right now.
            let weight = Executive::try_runtime_upgrade(checks).unwrap();
            (weight, super::configs::RuntimeBlockWeights::get().max_block)
        }

        fn execute_block(
            block: Block,
            state_root_check: bool,
            signature_check: bool,
            select: frame_try_runtime::TryStateSelect
        ) -> Weight {
            // NOTE: intentional unwrap: we don't want to propagate the error backwards, and want to
            // have a backtrace here.
            Executive::try_execute_block(block, state_root_check, signature_check, select).expect("execute-block failed")
        }
    }

    impl sp_genesis_builder::GenesisBuilder<Block> for Runtime {
        fn build_state(config: Vec<u8>) -> sp_genesis_builder::Result {
            build_state::<RuntimeGenesisConfig>(config)
        }

        fn get_preset(id: &Option<sp_genesis_builder::PresetId>) -> Option<Vec<u8>> {
            get_preset::<RuntimeGenesisConfig>(id, crate::genesis_config_presets::get_preset)
        }

        fn preset_names() -> Vec<sp_genesis_builder::PresetId> {
            crate::genesis_config_presets::preset_names()
        }
    }

    // ========= 🆕 2025-11-28 Chat Permission Runtime API =========
    /// 函数级详细中文注释：聊天权限系统 Runtime API 实现
    ///
    /// ### 功能说明
    /// - 提供前端查询聊天权限的接口
    /// - 支持权限检查、场景授权查询、好友关系查询、隐私设置摘要
    ///
    /// ### 接口列表
    /// - `check_chat_permission`: 检查两用户之间的聊天权限
    /// - `get_active_scenes`: 获取两用户间所有场景授权
    /// - `is_friend`: 检查是否是好友
    /// - `get_privacy_settings_summary`: 获取用户隐私设置摘要
    impl pallet_chat_permission::runtime_api::ChatPermissionApi<Block, AccountId> for Runtime {
        /// 函数级中文注释：检查聊天权限
        ///
        /// ### 权限判断优先级
        /// 1. 黑名单检查（最高优先级拒绝）
        /// 2. 好友关系检查
        /// 3. 场景授权检查
        /// 4. 隐私设置检查
        ///
        /// ### 参数
        /// - `sender`: 消息发送者
        /// - `receiver`: 消息接收者
        ///
        /// ### 返回
        /// - `PermissionResult`: 权限检查结果（允许/拒绝及原因）
        fn check_chat_permission(
            sender: AccountId,
            receiver: AccountId,
        ) -> pallet_chat_permission::PermissionResult {
            ChatPermission::check_permission(&sender, &receiver)
        }

        /// 函数级中文注释：获取两用户间所有场景授权
        ///
        /// ### 功能
        /// 返回两个用户之间所有的场景授权信息，包括：
        /// - 场景类型（MarketMaker/Order/Memorial/Group/Custom）
        /// - 场景ID
        /// - 是否已过期
        /// - 过期时间
        /// - 元数据（如订单号、纪念馆名等）
        ///
        /// ### 参数
        /// - `user1`: 第一个用户
        /// - `user2`: 第二个用户
        ///
        /// ### 返回
        /// - `Vec<SceneAuthorizationInfo>`: 场景授权信息列表
        fn get_active_scenes(
            user1: AccountId,
            user2: AccountId,
        ) -> Vec<pallet_chat_permission::SceneAuthorizationInfo> {
            ChatPermission::get_active_scenes(&user1, &user2)
        }

        /// 函数级中文注释：检查是否是好友
        ///
        /// ### 功能
        /// 检查两个用户之间是否存在好友关系。
        /// 好友关系是双向的，互加好友后生效。
        ///
        /// ### 参数
        /// - `user1`: 第一个用户
        /// - `user2`: 第二个用户
        ///
        /// ### 返回
        /// - `bool`: 如果是好友返回 true
        fn is_friend(user1: AccountId, user2: AccountId) -> bool {
            pallet_chat_permission::Pallet::<Runtime>::is_friend(&user1, &user2)
        }

        /// 函数级中文注释：获取用户隐私设置摘要
        ///
        /// ### 功能
        /// 返回用户的隐私设置概要信息，包括：
        /// - 权限级别（Open/FriendsOnly/Whitelist/Closed）
        /// - 黑名单数量
        /// - 白名单数量
        /// - 拒绝的场景类型列表
        ///
        /// ### 参数
        /// - `user`: 要查询的用户
        ///
        /// ### 返回
        /// - `PrivacySettingsSummary`: 隐私设置摘要
        fn get_privacy_settings_summary(user: AccountId) -> pallet_chat_permission::PrivacySettingsSummary {
            ChatPermission::get_privacy_summary(&user)
        }
    }

    // ========= 🆕 2025-12-10 Bazi Chart Runtime API (V4 合并版) =========
    /// 函数级详细中文注释：八字解盘系统 Runtime API 实现
    ///
    /// ### 功能说明
    /// - 提供前端免费查询八字解盘的唯一接口
    /// - 返回完整解盘数据（核心指标 + 性格分析 + 扩展忌神）
    ///
    /// ### 接口列表
    /// - `get_interpretation`: 获取完整解盘（唯一接口）
    /// - `chart_exists`: 检查命盘是否存在
    /// - `get_chart_owner`: 获取命盘创建者
    ///
    /// ### 优势
    /// - 完全免费（无 Gas 费用）
    /// - 响应快速（< 100ms）
    /// - 算法自动更新（使用最新版本）
    /// - 单一接口，前端按需使用 `.core` 或 `.xing_ge`
    ///
    /// ### 版本说明
    /// V4 合并了 V2/V3 的所有功能：
    /// - V2 SimplifiedInterpretation → 已合并到 FullInterpretation.core
    /// - V3 CoreInterpretation → 已合并到 FullInterpretation.core
    /// - V3 FullInterpretation → 现为唯一返回类型
    impl pallet_bazi_chart::runtime_api::BaziChartApi<Block, AccountId> for Runtime {
        /// 获取完整解盘（唯一接口）
        ///
        /// 返回数据结构：
        /// - core: 核心指标（格局、强弱、用神、喜神、忌神、评分、可信度）
        /// - xing_ge: 性格分析（主要特点、优点、缺点、适合职业）
        /// - extended_ji_shen: 扩展忌神（次忌神列表）
        ///
        /// 前端只需核心数据时，访问 `result.core` 即可
        fn get_interpretation(chart_id: u64) -> Option<pallet_bazi_chart::FullInterpretation> {
            pallet_bazi_chart::Pallet::<Runtime>::get_full_interpretation(chart_id)
        }

        /// 检查命盘是否存在
        fn chart_exists(chart_id: u64) -> bool {
            pallet_bazi_chart::ChartById::<Runtime>::contains_key(chart_id)
        }

        /// 获取命盘创建者
        fn get_chart_owner(chart_id: u64) -> Option<AccountId> {
            pallet_bazi_chart::ChartById::<Runtime>::get(chart_id).map(|chart| chart.owner)
        }

        /// 获取加密命盘的完整解盘
        ///
        /// 基于加密命盘的四柱索引计算解盘，无需解密敏感数据。
        fn get_encrypted_chart_interpretation(chart_id: u64) -> Option<pallet_bazi_chart::FullInterpretation> {
            pallet_bazi_chart::Pallet::<Runtime>::get_encrypted_chart_interpretation(chart_id)
        }

        /// 检查加密命盘是否存在
        fn encrypted_chart_exists(chart_id: u64) -> bool {
            pallet_bazi_chart::Pallet::<Runtime>::encrypted_chart_exists(chart_id)
        }

        /// 获取加密命盘创建者
        fn get_encrypted_chart_owner(chart_id: u64) -> Option<AccountId> {
            pallet_bazi_chart::Pallet::<Runtime>::get_encrypted_chart_owner(chart_id)
        }
    }

    // ========= 🆕 2025-12-12 Qimen (奇门遁甲) Runtime API =========
    /// 函数级详细中文注释：奇门遁甲解卦系统 Runtime API 实现
    ///
    /// ### 功能说明
    /// - 提供前端免费查询奇门遁甲解卦的接口
    /// - 支持核心解卦、完整解卦、单宫详解、用神分析、应期推算五种接口
    ///
    /// ### 接口列表
    /// - `get_core_interpretation`: 获取核心解卦（~16 bytes）
    /// - `get_full_interpretation`: 获取完整解卦（含九宫、用神、应期、格局）
    /// - `get_palace_interpretation`: 获取单宫详细解读
    /// - `get_yong_shen_analysis`: 获取用神分析
    /// - `get_ying_qi_analysis`: 获取应期推算
    ///
    /// ### 数据结构
    /// - 核心解卦：格局、用神宫、值符值使、吉凶、旺衰、特殊格局、可信度
    /// - 完整解卦：核心 + 九宫详解 + 用神分析 + 应期推算 + 格局详解
    /// - 单宫解读：星门神、五行、旺衰、吉凶、特殊状态
    /// - 用神分析：主次用神、旺衰、得力状态、吉凶
    /// - 应期推算：应期数、应期单位、吉利时间、不利时间
    ///
    /// ### 优势
    /// - 完全免费（无 Gas 费用）
    /// - 实时计算（使用最新算法）
    /// - 分层接口（按需选择数据量）
    /// - 轻量化存储（核心仅 16 bytes）
    impl pallet_qimen::runtime_api::QimenInterpretationApi<Block> for Runtime {
        /// 获取核心解卦结果
        ///
        /// 返回最关键的解卦指标，约 16 bytes：
        /// - 格局类型（正格/伏吟/反吟/三遁/特殊遁）
        /// - 用神宫位（1-9）
        /// - 值符值使（当值的星和门）
        /// - 日干时干落宫
        /// - 综合吉凶（大吉到大凶七级）
        /// - 吉凶评分（0-100）
        /// - 旺衰状态（旺相休囚死）
        /// - 特殊格局标记（位标志）
        /// - 可信度（0-100）
        /// - 时间戳和算法版本
        ///
        /// 参数:
        /// - `chart_id`: 奇门遁甲排盘 ID
        fn get_core_interpretation(
            chart_id: u64,
        ) -> Option<pallet_qimen::interpretation::QimenCoreInterpretation> {
            pallet_qimen::Pallet::<Runtime>::api_get_core_interpretation(chart_id)
        }

        /// 获取完整解卦结果
        ///
        /// 返回包含所有分析的完整解卦：
        /// - core: 核心指标（必有）
        /// - palaces: 九宫详细解读（可选）
        /// - yong_shen: 用神分析（可选）
        /// - ying_qi: 应期推算（可选）
        /// - ge_ju_detail: 格局详解（可选）
        ///
        /// 参数:
        /// - `chart_id`: 奇门遁甲排盘 ID
        /// - `question_type`: 问事类型（0-11）
        fn get_full_interpretation(
            chart_id: u64,
            question_type: pallet_qimen::types::QuestionType,
        ) -> Option<pallet_qimen::interpretation::QimenFullInterpretation> {
            pallet_qimen::Pallet::<Runtime>::api_get_full_interpretation(chart_id, question_type)
        }

        /// 获取单宫详细解读
        ///
        /// 返回指定宫位的详细分析：
        /// - 天盘干、地盘干
        /// - 九星、八门、八神
        /// - 宫位五行、天盘五行、地盘五行
        /// - 星门关系（星生门/门生星/星克门/门克星/比和）
        /// - 宫位旺衰
        /// - 特殊状态（伏吟/反吟/旬空/马星）
        /// - 宫位吉凶和评分
        ///
        /// 参数:
        /// - `chart_id`: 奇门遁甲排盘 ID
        /// - `palace_num`: 宫位数字（1-9）
        fn get_palace_interpretation(
            chart_id: u64,
            palace_num: u8,
        ) -> Option<pallet_qimen::interpretation::PalaceInterpretation> {
            pallet_qimen::Pallet::<Runtime>::api_get_palace_interpretation(chart_id, palace_num)
        }

        /// 获取用神分析
        ///
        /// 根据问事类型分析用神状态：
        /// - 主用神和次用神类型、宫位
        /// - 用神旺衰状态
        /// - 用神得力情况（大得力/得力/平/失力/大失力）
        /// - 用神吉凶和评分
        ///
        /// 参数:
        /// - `chart_id`: 奇门遁甲排盘 ID
        /// - `question_type`: 问事类型（0-11）
        fn get_yong_shen_analysis(
            chart_id: u64,
            question_type: pallet_qimen::types::QuestionType,
        ) -> Option<pallet_qimen::interpretation::YongShenAnalysis> {
            pallet_qimen::Pallet::<Runtime>::api_get_yong_shen_analysis(chart_id, question_type)
        }

        /// 获取应期推算
        ///
        /// 预测事情应验的时间：
        /// - 主应期数（基于用神宫位）
        /// - 次应期数（基于值符值使）
        /// - 应期单位（时辰/日/旬/月/季/年）
        /// - 应期范围描述
        /// - 吉利时间列表
        /// - 不利时间列表
        ///
        /// 参数:
        /// - `chart_id`: 奇门遁甲排盘 ID
        fn get_ying_qi_analysis(
            chart_id: u64,
        ) -> Option<pallet_qimen::interpretation::YingQiAnalysis> {
            pallet_qimen::Pallet::<Runtime>::api_get_ying_qi_analysis(chart_id)
        }
    }

    // ========= 🆕 2025-12-12 XiaoLiuRen (小六壬) Runtime API =========
    /// 函数级详细中文注释：小六壬解卦系统 Runtime API 实现
    ///
    /// ### 功能说明
    /// - 提供前端免费查询小六壬解卦的接口
    /// - 支持单个查询和批量查询两种模式
    ///
    /// ### 接口列表
    /// - `get_interpretation`: 获取单个课盘的解卦结果（~13 bytes）
    /// - `get_interpretations_batch`: 批量获取多个课盘的解卦结果
    ///
    /// ### 数据结构
    /// - 核心解卦：吉凶等级、综合评分、五行关系、体用关系、八卦、特殊格局、建议类型、应期
    ///
    /// ### 优势
    /// - 完全免费（无 Gas 费用）
    /// - 实时计算（使用最新算法）
    /// - 极致轻量（仅 13 bytes）
    /// - 懒加载缓存（首次计算后缓存）
    impl pallet_xiaoliuren::runtime_api::XiaoLiuRenInterpretationApi<Block> for Runtime {
        /// 获取课盘的解卦结果
        ///
        /// 返回核心解卦数据，约 13 bytes：
        /// - 吉凶等级（大吉/吉/小吉/平/小凶/凶/大凶）
        /// - 综合评分（0-100）
        /// - 五行关系（相生/比和/泄气/相克/被克）
        /// - 体用关系（用生体/体克用/比肩/比助/体生用/用克体）
        /// - 八卦索引（乾坤震巽坎离艮兑）
        /// - 特殊格局（纯宫/全吉/全凶/五行成环/阴阳和合/特殊时辰）
        /// - 建议类型（进取/稳步/守成/观望/退守/静待/寻求/化解）
        /// - 流派（道家/民间）
        /// - 应期类型（即刻/当日/数日/延迟/难以/需化解）
        ///
        /// 参数:
        /// - `pan_id`: 课盘 ID
        ///
        /// 返回:
        /// - `Option<XiaoLiuRenInterpretation>`: 解卦核心数据，如果课盘不存在则返回 None
        fn get_interpretation(
            pan_id: u64,
        ) -> Option<pallet_xiaoliuren::interpretation::XiaoLiuRenInterpretation> {
            pallet_xiaoliuren::Pallet::<Runtime>::get_or_create_interpretation(pan_id)
        }

        /// 批量获取解卦结果
        ///
        /// 一次性获取多个课盘的解卦结果，适用于列表展示场景。
        /// 每个课盘独立计算，不存在的课盘返回 None。
        ///
        /// 参数:
        /// - `pan_ids`: 课盘 ID 列表
        ///
        /// 返回:
        /// - `Vec<Option<XiaoLiuRenInterpretation>>`: 解卦结果列表，每个元素对应一个课盘 ID
        fn get_interpretations_batch(
            pan_ids: Vec<u64>,
        ) -> Vec<Option<pallet_xiaoliuren::interpretation::XiaoLiuRenInterpretation>> {
            pallet_xiaoliuren::Pallet::<Runtime>::get_interpretations_batch(pan_ids)
        }
    }

    // ========= 🆕 2025-12-12 LiuYao (六爻) Runtime API =========
    /// 函数级详细中文注释：六爻解卦系统 Runtime API 实现
    ///
    /// ### 功能说明
    /// - 提供前端免费查询六爻解卦的接口
    /// - 支持核心解卦、完整解卦、解卦文本三种返回格式
    ///
    /// ### 接口列表
    /// - `get_core_interpretation`: 获取核心解卦（~20 bytes）
    /// - `get_full_interpretation`: 获取完整解卦（~165 bytes）
    /// - `get_interpretation_texts`: 获取解卦文本索引列表
    /// - `gua_exists`: 检查卦象是否存在
    /// - `get_gua_owner`: 获取卦象创建者
    ///
    /// ### 数据结构
    /// - 核心解卦：吉凶、用神状态、世应状态、动爻、应期、评分
    /// - 完整解卦：核心 + 卦象分析 + 六亲分析 + 各爻分析 + 神煞汇总
    ///
    /// ### 优势
    /// - 完全免费（无 Gas 费用）
    /// - 实时计算（使用最新算法）
    /// - 分层接口（按需选择数据量）
    impl pallet_liuyao::runtime_api::LiuYaoApi<Block, AccountId> for Runtime {
        /// 获取核心解卦结果
        ///
        /// 返回最关键的解卦指标，约 20 bytes：
        /// - 吉凶等级（大吉/吉/小吉/平/小凶/凶/大凶）
        /// - 用神六亲和状态
        /// - 世应状态
        /// - 动爻数量和位图
        /// - 旬空/月破/日冲位图
        /// - 应期类型
        /// - 综合评分和可信度
        ///
        /// 参数:
        /// - `gua_id`: 六爻卦象 ID
        /// - `shi_xiang`: 占问事项类型（0-9）
        fn get_core_interpretation(
            gua_id: u64,
            shi_xiang: u8,
        ) -> Option<pallet_liuyao::interpretation::LiuYaoCoreInterpretation> {
            pallet_liuyao::Pallet::<Runtime>::get_core_interpretation(gua_id, shi_xiang)
        }

        /// 获取完整解卦结果
        ///
        /// 返回包含所有分析的完整解卦，约 165 bytes：
        /// - core: 核心指标
        /// - gua_xiang: 卦象分析（本卦/变卦/互卦/卦宫/世应/六冲六合）
        /// - liu_qin: 六亲分析（五个六亲的出现次数、爻位、伏神）
        /// - shen_sha: 神煞汇总（吉神/凶煞数量和列表）
        /// - yao_0..yao_5: 各爻分析（旺衰/逢空/月破/日冲/动爻变化）
        ///
        /// 参数:
        /// - `gua_id`: 六爻卦象 ID
        /// - `shi_xiang`: 占问事项类型（0-9）
        fn get_full_interpretation(
            gua_id: u64,
            shi_xiang: u8,
        ) -> Option<pallet_liuyao::interpretation::LiuYaoFullInterpretation> {
            pallet_liuyao::Pallet::<Runtime>::get_full_interpretation(gua_id, shi_xiang)
        }

        /// 获取解卦文本索引列表
        ///
        /// 返回适用于当前卦象的解卦文本类型列表，前端根据索引显示对应文本：
        /// - 吉凶总断（0-6）
        /// - 用神状态（7-16）
        /// - 世应关系（17-22）
        /// - 动爻断语（23-28）
        /// - 特殊状态（29-34）
        /// - 应期断语（35-40）
        ///
        /// 参数:
        /// - `gua_id`: 六爻卦象 ID
        /// - `shi_xiang`: 占问事项类型（0-9）
        fn get_interpretation_texts(
            gua_id: u64,
            shi_xiang: u8,
        ) -> Option<Vec<pallet_liuyao::interpretation::JieGuaTextType>> {
            pallet_liuyao::Pallet::<Runtime>::get_interpretation_texts(gua_id, shi_xiang)
        }

        /// 检查卦象是否存在
        fn gua_exists(gua_id: u64) -> bool {
            pallet_liuyao::Guas::<Runtime>::contains_key(gua_id)
        }

        /// 获取卦象创建者
        fn get_gua_owner(gua_id: u64) -> Option<AccountId> {
            pallet_liuyao::Guas::<Runtime>::get(gua_id).map(|gua| gua.creator)
        }
    }

    // ========= 🆕 2025-12-13 Tarot (塔罗牌) Runtime API =========
    /// 函数级详细中文注释：塔罗牌解卦系统 Runtime API 实现
    ///
    /// ### 功能说明
    /// - 提供前端免费查询塔罗牌解卦的接口
    /// - 支持核心解卦、完整解卦、解卦文本、AI提示词生成等
    ///
    /// ### 接口列表
    /// - `get_core_interpretation`: 获取核心解卦（~30 bytes）
    /// - `get_full_interpretation`: 获取完整解卦（~175 bytes）
    /// - `get_interpretation_texts`: 获取解读文本索引列表
    /// - `generate_ai_prompt_context`: 生成AI解读提示词上下文
    /// - `reading_exists`: 检查占卜记录是否存在
    /// - `get_reading_owner`: 获取占卜记录创建者
    /// - `batch_get_core_interpretations`: 批量获取核心解卦
    /// - `analyze_card_in_spread`: 分析单张牌在特定牌阵位置的含义
    /// - `analyze_card_relationship`: 分析两张牌之间的关系
    /// - `get_spread_energy`: 获取牌阵能量分析
    /// - `get_timeline_analysis`: 获取时间线分析
    ///
    /// ### 数据结构
    /// - 核心解卦：总体能量、主导元素、吉凶倾向、能量指数、综合评分
    /// - 完整解卦：核心 + 牌阵能量分析 + 各牌分析 + 牌间关系 + 时间线
    impl pallet_tarot::runtime_api::TarotApi<Block, AccountId> for Runtime {
        /// 获取核心解卦结果
        fn get_core_interpretation(
            reading_id: u64,
        ) -> Option<pallet_tarot::interpretation::TarotCoreInterpretation> {
            pallet_tarot::Pallet::<Runtime>::api_get_core_interpretation(reading_id)
        }

        /// 获取完整解卦结果
        fn get_full_interpretation(
            reading_id: u64,
        ) -> Option<pallet_tarot::interpretation::TarotFullInterpretation<frame_support::traits::ConstU32<12>>> {
            pallet_tarot::Pallet::<Runtime>::api_get_full_interpretation(reading_id)
        }

        /// 获取解读文本索引列表
        fn get_interpretation_texts(
            reading_id: u64,
        ) -> Option<Vec<pallet_tarot::interpretation::InterpretationTextType>> {
            pallet_tarot::Pallet::<Runtime>::api_get_interpretation_texts(reading_id)
        }

        /// 生成AI解读提示词上下文
        fn generate_ai_prompt_context(
            reading_id: u64,
        ) -> Option<Vec<u8>> {
            pallet_tarot::Pallet::<Runtime>::api_generate_ai_prompt_context(reading_id)
        }

        /// 检查占卜记录是否存在
        fn reading_exists(reading_id: u64) -> bool {
            pallet_tarot::Pallet::<Runtime>::api_reading_exists(reading_id)
        }

        /// 获取占卜记录创建者
        fn get_reading_owner(reading_id: u64) -> Option<AccountId> {
            pallet_tarot::Pallet::<Runtime>::api_get_reading_owner(reading_id)
        }

        /// 批量获取核心解卦结果
        fn batch_get_core_interpretations(
            reading_ids: Vec<u64>,
        ) -> Vec<(u64, Option<pallet_tarot::interpretation::TarotCoreInterpretation>)> {
            pallet_tarot::Pallet::<Runtime>::api_batch_get_core_interpretations(reading_ids)
        }

        /// 分析单张牌在特定牌阵位置的含义
        fn analyze_card_in_spread(
            card_id: u8,
            is_reversed: bool,
            spread_type: u8,
            position: u8,
        ) -> Option<pallet_tarot::interpretation::CardInterpretation> {
            pallet_tarot::Pallet::<Runtime>::api_analyze_card_in_spread(card_id, is_reversed, spread_type, position)
        }

        /// 分析两张牌之间的关系
        fn analyze_card_relationship(
            card1_id: u8,
            card2_id: u8,
        ) -> Option<pallet_tarot::interpretation::CardRelationship> {
            pallet_tarot::Pallet::<Runtime>::api_analyze_card_relationship(card1_id, card2_id)
        }

        /// 获取牌阵能量分析
        fn get_spread_energy(
            reading_id: u64,
        ) -> Option<pallet_tarot::interpretation::SpreadEnergyAnalysis> {
            pallet_tarot::Pallet::<Runtime>::api_get_spread_energy(reading_id)
        }

        /// 获取时间线分析
        fn get_timeline_analysis(
            reading_id: u64,
        ) -> Option<pallet_tarot::interpretation::TimelineAnalysis> {
            pallet_tarot::Pallet::<Runtime>::api_get_timeline_analysis(reading_id)
        }
    }
}
