// 客户端模块入口
pub mod cache;
pub mod divination;
pub mod substrate;

pub use cache::CacheClient;
pub use divination::{
    DivinationClient, DaliurenRequest, DaliurenResponse, LiuyaoRequest, LiuyaoResponse,
    QimenRequest, QimenResponse, TarotRequest, TarotResponse, XiaoliurenRequest,
    XiaoliurenResponse, ZiweiRequest, ZiweiResponse,
};
pub use substrate::{DivinationRecord, RuntimeVersionInfo, SubstrateClient};
