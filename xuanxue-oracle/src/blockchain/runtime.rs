// 生成的Runtime类型定义 (模拟版本)
// 实际使用时需要运行 ./generate-types.sh 生成

// TODO: 生成metadata.scale文件后取消注释
// use subxt::{OnlineClient, PolkadotConfig};
//
// /// Runtime API
// #[subxt::subxt(runtime_metadata_path = "metadata.scale")]
// pub mod runtime {
//     // 这个模块会被subxt自动生成
//     // 包含所有pallet的类型定义
// }

// 手动定义的类型(在实际生成前使用)
pub mod manual_types {
    use codec::{Encode, Decode};
    use scale_info::TypeInfo;

    /// DivinationAi pallet的InterpretationRequested事件
    #[derive(Debug, Clone, Encode, Decode, TypeInfo)]
    pub struct InterpretationRequestedEvent {
        pub request_id: u64,
        pub divination_type: u8,
        pub result_id: u64,
        pub requester: [u8; 32],
        pub interpretation_type: u8,
        pub fee: u128,
    }

    /// DivinationAi pallet的ResultSubmitted事件
    #[derive(Debug, Clone, Encode, Decode, TypeInfo)]
    pub struct ResultSubmittedEvent {
        pub request_id: u64,
        pub oracle: [u8; 32],
        pub content_cid: Vec<u8>,
    }

    /// Oracle注册参数
    #[derive(Debug, Clone, Encode, Decode, TypeInfo)]
    pub struct RegisterOracleParams {
        pub name: Vec<u8>,
        pub supported_divination_types: u8,
        pub supported_interpretation_types: u16,
    }

    /// 接受请求参数
    #[derive(Debug, Clone, Encode, Decode, TypeInfo)]
    pub struct AcceptRequestParams {
        pub request_id: u64,
    }

    /// 提交结果参数
    #[derive(Debug, Clone, Encode, Decode, TypeInfo)]
    pub struct SubmitResultParams {
        pub request_id: u64,
        pub content_cid: Vec<u8>,
        pub summary_cid: Option<Vec<u8>>,
        pub model_version: Vec<u8>,
        pub language: Vec<u8>,
    }

    /// InterpretationRequest (链上存储类型)
    #[derive(Debug, Clone, Encode, Decode, TypeInfo)]
    pub struct InterpretationRequest {
        pub id: u64,
        pub divination_type: u8,
        pub result_id: u64,
        pub requester: [u8; 32],
        pub interpretation_type: u8,
        pub status: u8,
        pub fee_paid: u128,
        pub created_at: u32,
        pub processing_started_at: Option<u32>,
        pub completed_at: Option<u32>,
        pub oracle_node: Option<[u8; 32]>,
        pub context_hash: Option<[u8; 32]>,
    }

    /// OracleNode (链上存储类型)
    #[derive(Debug, Clone, Encode, Decode, TypeInfo)]
    pub struct OracleNode {
        pub account: [u8; 32],
        pub name: Vec<u8>,
        pub stake: u128,
        pub is_active: bool,
        pub registered_at: u32,
        pub requests_processed: u64,
        pub requests_succeeded: u64,
        pub average_rating: u16,
        pub last_active_at: u32,
        pub supported_divination_types: u8,
        pub supported_interpretation_types: u16,
    }
}

// 辅助函数
pub fn account_id_to_bytes(account_id: &sp_core::sr25519::Public) -> [u8; 32] {
    let bytes: &[u8; 32] = account_id.as_ref();
    *bytes
}

pub fn bytes_to_account_id(bytes: &[u8; 32]) -> sp_core::sr25519::Public {
    sp_core::sr25519::Public::from_raw(*bytes)
}
