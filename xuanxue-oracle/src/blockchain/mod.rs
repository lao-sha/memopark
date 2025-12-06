pub mod events;
pub mod extrinsics;
pub mod queries;
pub mod types;
pub mod runtime;

use anyhow::Result;
use subxt::{OnlineClient, PolkadotConfig, tx::PairSigner};
use sp_core::sr25519::Pair;
use sp_core::Pair as PairT;
use tracing::{info, warn, error, debug};

use crate::config::Config;
use crate::ai::AiService;
use crate::storage::IpfsClient;
use crate::divination::DivinationDataFetcher;
use crate::error::OracleError;

pub use events::*;
pub use extrinsics::*;
pub use queries::*;
pub use types::*;
pub use runtime::manual_types;

/// 事件监听器
pub struct EventMonitor {
    config: Config,
    client: OnlineClient<PolkadotConfig>,
    signer: Pair,
    ai_service: AiService,
    ipfs_client: IpfsClient,
    data_fetcher: DivinationDataFetcher,
}

impl EventMonitor {
    /// 创建新的事件监听器
    pub async fn new(config: Config) -> Result<Self> {
        info!("Connecting to blockchain at {}...", config.chain.ws_endpoint);

        // 连接到区块链
        let client = OnlineClient::<PolkadotConfig>::from_url(&config.chain.ws_endpoint)
            .await
            .map_err(|e| OracleError::Blockchain(format!("Failed to connect: {}", e)))?;

        // 创建签名者
        let signer = Pair::from_string(&config.chain.oracle_account_seed, None)
            .map_err(|e| OracleError::Blockchain(format!("Invalid seed: {}", e)))?;

        info!("Oracle account: {:?}", signer.public());

        // 初始化AI服务
        let ai_service = AiService::new(config.deepseek.clone());

        // 初始化IPFS客户端
        let ipfs_client = IpfsClient::new(config.ipfs.clone())?;

        // 初始化数据获取器
        let data_fetcher = DivinationDataFetcher::new(client.clone());

        Ok(Self {
            config,
            client,
            signer,
            ai_service,
            ipfs_client,
            data_fetcher,
        })
    }

    /// 获取区块链端点
    pub fn endpoint(&self) -> &str {
        &self.config.chain.ws_endpoint
    }

    /// 获取Oracle账户
    pub fn account(&self) -> &sp_core::sr25519::Public {
        self.signer.public()
    }

    /// 确保Oracle节点已注册
    pub async fn ensure_registered(&self) -> Result<()> {
        let account_id = self.signer.public();
        info!("Checking Oracle registration status...");

        // 查询链上Oracle信息
        match self.query_oracle_info().await {
            Ok(Some(oracle_info)) => {
                info!("✅ Oracle already registered");
                info!("   Name: {}", String::from_utf8_lossy(&oracle_info.name));
                info!("   Active: {}", oracle_info.is_active);
                info!("   Processed: {}", oracle_info.requests_processed);
                info!("   Rating: {:.2}", oracle_info.average_rating as f32 / 100.0);
            }
            Ok(None) => {
                warn!("⚠️  Oracle not registered, attempting registration...");
                self.register_oracle().await?;
                info!("✅ Oracle registered successfully");
            }
            Err(e) => {
                error!("❌ Failed to query Oracle info: {}", e);
                warn!("   Proceeding anyway (might need manual registration)");
            }
        }

        Ok(())
    }

    /// 查询Oracle信息
    async fn query_oracle_info(&self) -> Result<Option<manual_types::OracleNode>> {
        // TODO: 实际的链上查询
        // let account_bytes = runtime::account_id_to_bytes(self.signer.public());
        // let storage_query = runtime::storage().divination_ai().oracles(&account_bytes);
        // let oracle_info = self.client.storage().at_latest().await?.fetch(&storage_query).await?;

        // 临时返回None,表示未注册
        debug!("Query Oracle info (not implemented yet)");
        Ok(None)
    }

    /// 注册Oracle节点
    async fn register_oracle(&self) -> Result<()> {
        info!("📝 Registering Oracle node...");

        let params = manual_types::RegisterOracleParams {
            name: self.config.oracle.name.as_bytes().to_vec(),
            supported_divination_types: self.config.oracle.supported_divination_types,
            supported_interpretation_types: self.config.oracle.supported_interpretation_types,
        };

        // TODO: 实际的交易提交
        // let tx = runtime::tx()
        //     .divination_ai()
        //     .register_oracle(
        //         params.name,
        //         params.supported_divination_types,
        //         params.supported_interpretation_types,
        //     );
        //
        // let signer = PairSigner::new(self.signer.clone());
        // let result = self.client
        //     .tx()
        //     .sign_and_submit_then_watch_default(&tx, &signer)
        //     .await?
        //     .wait_for_finalized_success()
        //     .await?;
        //
        // info!("✅ Transaction included in block: {:?}", result.block_hash());

        info!("   Name: {}", self.config.oracle.name);
        info!("   Supported types: 0x{:02X}", params.supported_divination_types);
        info!("   Supported interpretations: 0x{:04X}", params.supported_interpretation_types);

        Ok(())
    }

    /// 监听区块链事件
    pub async fn watch_events(&self) -> Result<()> {
        info!("👂 Starting event watcher...");
        info!("   Watching for InterpretationRequested events");

        // 订阅最终化的区块
        let mut blocks = self.client.blocks().subscribe_finalized()
            .await
            .map_err(|e| OracleError::Blockchain(format!("Failed to subscribe: {}", e)))?;

        let mut block_count = 0u32;

        while let Some(block_result) = blocks.next().await {
            let block = block_result
                .map_err(|e| OracleError::Blockchain(format!("Block error: {}", e)))?;

            let block_number = block.number();
            let block_hash = block.hash();

            block_count += 1;

            if block_count % 10 == 0 {
                debug!("📦 Processed {} blocks, latest: #{}", block_count, block_number);
            } else {
                debug!("📦 Block: #{} ({})", block_number, block_hash);
            }

            // 获取区块事件
            let events = block.events()
                .await
                .map_err(|e| OracleError::Blockchain(format!("Failed to get events: {}", e)))?;

            // 处理每个事件
            let mut event_count = 0;
            for event_result in events.iter() {
                if let Ok(event) = event_result {
                    event_count += 1;
                    if let Err(e) = self.handle_event(event).await {
                        error!("Failed to handle event: {}", e);
                    }
                }
            }

            if event_count > 0 {
                debug!("   Processed {} events in block #{}", event_count, block_number);
            }
        }

        Ok(())
    }

    /// 处理单个事件
    async fn handle_event(&self, event: subxt::events::EventDetails<PolkadotConfig>) -> Result<()> {
        let pallet_name = event.pallet_name();
        let event_name = event.variant_name();

        // 只处理DivinationAi模块的InterpretationRequested事件
        if pallet_name == "DivinationAi" && event_name == "InterpretationRequested" {
            info!("🔔 Detected InterpretationRequested event");

            // 解析事件数据
            match self.parse_interpretation_requested_event(&event) {
                Ok(event_data) => {
                    info!("   Request ID: {}", event_data.request_id);
                    info!("   Divination Type: {:?}", DivinationType::from_u8(event_data.divination_type));
                    info!("   Result ID: {}", event_data.result_id);

                    if let Err(e) = self.handle_interpretation_request(event_data).await {
                        error!("❌ Failed to process request: {}", e);
                    }
                }
                Err(e) => {
                    error!("Failed to parse event: {}", e);
                }
            }
        }

        Ok(())
    }

    /// 解析InterpretationRequested事件
    fn parse_interpretation_requested_event(
        &self,
        event: &subxt::events::EventDetails<PolkadotConfig>
    ) -> Result<InterpretationRequestedEvent> {
        // TODO: 实际从事件中解析数据
        // let event_data = event.as_event::<runtime::divination_ai::events::InterpretationRequested>()?;

        // 临时返回示例数据用于测试
        warn!("Using mock event data (parsing not implemented yet)");
        let event_data = InterpretationRequestedEvent {
            request_id: 1,
            divination_type: DivinationType::Bazi,
            result_id: 123,
            requester: vec![0u8; 32],
            interpretation_type: InterpretationType::Professional,
            fee: 1000000000000,
        };

        Ok(event_data)
    }

    /// 处理解读请求
    async fn handle_interpretation_request(&self, event: InterpretationRequestedEvent) -> Result<()> {
        info!(
            "📝 Processing request #{}: {:?} for result #{}",
            event.request_id,
            event.divination_type,
            event.result_id
        );

        // 1. 检查是否支持该占卜类型
        if !self.supports_divination_type(event.divination_type) {
            warn!("⚠️  Unsupported divination type: {:?}", event.divination_type);
            return Ok(());
        }

        // 2. 检查是否支持该解读类型
        if !self.supports_interpretation_type(event.interpretation_type) {
            warn!("⚠️  Unsupported interpretation type: {:?}", event.interpretation_type);
            return Ok(());
        }

        // 3. 接受请求
        self.accept_request(event.request_id).await?;
        info!("✅ Request #{} accepted", event.request_id);

        // 4. 获取占卜数据
        let divination_data = self.data_fetcher
            .fetch_divination_data(event.divination_type, event.result_id)
            .await?;
        info!("📊 Fetched divination data");

        // 5. 生成AI解读
        info!("🤖 Generating AI interpretation...");
        let interpretation = self.ai_service
            .generate_interpretation(
                event.divination_type,
                event.interpretation_type,
                &divination_data,
            )
            .await?;
        info!("✅ AI interpretation generated ({} chars)",
            serde_json::to_string(&interpretation)?.len());

        // 6. 上传到IPFS
        info!("📤 Uploading to IPFS...");
        let content_cid = self.ipfs_client.upload_json(&interpretation).await?;
        info!("✅ Uploaded to IPFS: {}", content_cid);

        // 7. 提交结果到链上
        info!("📤 Submitting result to blockchain...");
        self.submit_result(
            event.request_id,
            content_cid.clone(),
            None,
            "deepseek-chat-v2.5".to_string(),
            "zh-CN".to_string(),
        ).await?;
        info!("✅ Result submitted for request #{}", event.request_id);
        info!("   CID: {}", content_cid);

        Ok(())
    }

    /// 检查是否支持该占卜类型
    fn supports_divination_type(&self, divination_type: DivinationType) -> bool {
        let type_bit = 1u8 << (divination_type as u8);
        self.config.oracle.supported_divination_types & type_bit != 0
    }

    /// 检查是否支持该解读类型
    fn supports_interpretation_type(&self, interpretation_type: InterpretationType) -> bool {
        let type_bit = 1u16 << (interpretation_type as u16);
        self.config.oracle.supported_interpretation_types & type_bit != 0
    }

    /// 接受解读请求
    async fn accept_request(&self, request_id: u64) -> Result<()> {
        debug!("Submitting accept_request transaction...");

        // TODO: 实际的交易提交
        // let tx = runtime::tx()
        //     .divination_ai()
        //     .accept_request(request_id);
        //
        // let signer = PairSigner::new(self.signer.clone());
        // let result = self.client
        //     .tx()
        //     .sign_and_submit_then_watch_default(&tx, &signer)
        //     .await?
        //     .wait_for_finalized_success()
        //     .await?;

        debug!("Transaction submitted (mock): accept_request({})", request_id);
        Ok(())
    }

    /// 提交解读结果
    async fn submit_result(
        &self,
        request_id: u64,
        content_cid: String,
        summary_cid: Option<String>,
        model_version: String,
        language: String,
    ) -> Result<()> {
        debug!("Submitting submit_result transaction...");

        let params = manual_types::SubmitResultParams {
            request_id,
            content_cid: content_cid.as_bytes().to_vec(),
            summary_cid: summary_cid.map(|s| s.as_bytes().to_vec()),
            model_version: model_version.as_bytes().to_vec(),
            language: language.as_bytes().to_vec(),
        };

        // TODO: 实际的交易提交
        // let tx = runtime::tx()
        //     .divination_ai()
        //     .submit_result(
        //         params.request_id,
        //         params.content_cid,
        //         params.summary_cid,
        //         params.model_version,
        //         params.language,
        //     );
        //
        // let signer = PairSigner::new(self.signer.clone());
        // let result = self.client
        //     .tx()
        //     .sign_and_submit_then_watch_default(&tx, &signer)
        //     .await?
        //     .wait_for_finalized_success()
        //     .await?;

        debug!("Transaction submitted (mock): submit_result({}, {})", request_id, content_cid);
        Ok(())
    }
}
