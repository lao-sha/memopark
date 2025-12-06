// blockchain模块的完整实现参考
// 本文件展示如何使用subxt生成的类型与链上交互
//
// 使用步骤:
// 1. 运行 ./generate-types.sh 生成 runtime.rs
// 2. 取消下面代码的注释
// 3. 替换 src/blockchain/mod.rs 中的对应部分

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

// 导入生成的runtime类型
// 注意: 这个模块在运行 ./generate-types.sh 后才会存在
pub use crate::blockchain::runtime;

// 类型别名，使用subxt生成的类型
type AccountId32 = subxt::utils::AccountId32;

/// 事件监听器 - 完整实现版本
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

    /// 确保Oracle节点已注册
    pub async fn ensure_registered(&self) -> Result<()> {
        let account_id = AccountId32::from(self.signer.public().0);
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

    /// 查询Oracle信息 - 完整实现
    async fn query_oracle_info(&self) -> Result<Option<runtime::divination_ai::storage::types::OracleNode>> {
        let account_id = AccountId32::from(self.signer.public().0);

        // 构建存储查询
        let storage_query = runtime::storage()
            .divination_ai()
            .oracles(account_id);

        // 查询链上数据
        let oracle_info = self.client
            .storage()
            .at_latest()
            .await
            .map_err(|e| OracleError::Blockchain(format!("Storage query failed: {}", e)))?
            .fetch(&storage_query)
            .await
            .map_err(|e| OracleError::Blockchain(format!("Fetch failed: {}", e)))?;

        Ok(oracle_info)
    }

    /// 注册Oracle节点 - 完整实现
    async fn register_oracle(&self) -> Result<()> {
        info!("📝 Registering Oracle node...");

        // 构建交易
        let tx = runtime::tx()
            .divination_ai()
            .register_oracle(
                self.config.oracle.name.as_bytes().to_vec(),
                self.config.oracle.supported_divination_types,
                self.config.oracle.supported_interpretation_types,
            );

        // 签名并提交
        let signer = PairSigner::new(self.signer.clone());
        let result = self.client
            .tx()
            .sign_and_submit_then_watch_default(&tx, &signer)
            .await
            .map_err(|e| OracleError::Blockchain(format!("Failed to submit tx: {}", e)))?
            .wait_for_finalized_success()
            .await
            .map_err(|e| OracleError::Blockchain(format!("Tx failed: {}", e)))?;

        info!("✅ Transaction included in block: {:?}", result.block_hash());
        info!("   Name: {}", self.config.oracle.name);
        info!("   Supported types: 0x{:02X}", self.config.oracle.supported_divination_types);
        info!("   Supported interpretations: 0x{:04X}", self.config.oracle.supported_interpretation_types);

        Ok(())
    }

    /// 监听区块链事件 - 完整实现
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
            for event_result in events.iter() {
                if let Ok(event) = event_result {
                    if let Err(e) = self.handle_event(event).await {
                        error!("Failed to handle event: {}", e);
                    }
                }
            }
        }

        Ok(())
    }

    /// 处理单个事件 - 完整实现
    async fn handle_event(&self, event: subxt::events::EventDetails<PolkadotConfig>) -> Result<()> {
        use runtime::divination_ai::events;

        // 使用类型安全的事件解析
        if let Some(ev) = event.as_event::<events::InterpretationRequested>()? {
            info!("🔔 Detected InterpretationRequested event");
            info!("   Request ID: {}", ev.request_id);
            info!("   Divination Type: {}", ev.divination_type);
            info!("   Result ID: {}", ev.result_id);

            self.handle_interpretation_request(ev).await?;
        } else if let Some(ev) = event.as_event::<events::RequestAccepted>()? {
            debug!("Request {} accepted by oracle", ev.request_id);
        } else if let Some(ev) = event.as_event::<events::ResultSubmitted>()? {
            info!("Result submitted for request {}", ev.request_id);
        }

        Ok(())
    }

    /// 处理解读请求 - 完整实现
    async fn handle_interpretation_request(
        &self,
        event: runtime::divination_ai::events::InterpretationRequested
    ) -> Result<()> {
        info!(
            "📝 Processing request #{}: type {} for result #{}",
            event.request_id,
            event.divination_type,
            event.result_id
        );

        // 1. 检查是否支持该占卜类型
        let type_bit = 1u8 << event.divination_type;
        if self.config.oracle.supported_divination_types & type_bit == 0 {
            warn!("⚠️  Unsupported divination type: {}", event.divination_type);
            return Ok(());
        }

        // 2. 检查是否支持该解读类型
        let type_bit = 1u16 << event.interpretation_type;
        if self.config.oracle.supported_interpretation_types & type_bit == 0 {
            warn!("⚠️  Unsupported interpretation type: {}", event.interpretation_type);
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

    /// 接受解读请求 - 完整实现
    async fn accept_request(&self, request_id: u64) -> Result<()> {
        debug!("Submitting accept_request transaction...");

        // 构建交易
        let tx = runtime::tx()
            .divination_ai()
            .accept_request(request_id);

        // 签名并提交
        let signer = PairSigner::new(self.signer.clone());
        let result = self.client
            .tx()
            .sign_and_submit_then_watch_default(&tx, &signer)
            .await
            .map_err(|e| OracleError::Blockchain(format!("Failed to submit tx: {}", e)))?
            .wait_for_finalized_success()
            .await
            .map_err(|e| OracleError::Blockchain(format!("Tx failed: {}", e)))?;

        debug!("Transaction finalized in block: {:?}", result.block_hash());
        Ok(())
    }

    /// 提交解读结果 - 完整实现
    async fn submit_result(
        &self,
        request_id: u64,
        content_cid: String,
        summary_cid: Option<String>,
        model_version: String,
        language: String,
    ) -> Result<()> {
        debug!("Submitting submit_result transaction...");

        // 构建交易
        let tx = runtime::tx()
            .divination_ai()
            .submit_result(
                request_id,
                content_cid.as_bytes().to_vec(),
                summary_cid.map(|s| s.as_bytes().to_vec()),
                model_version.as_bytes().to_vec(),
                language.as_bytes().to_vec(),
            );

        // 签名并提交
        let signer = PairSigner::new(self.signer.clone());
        let result = self.client
            .tx()
            .sign_and_submit_then_watch_default(&tx, &signer)
            .await
            .map_err(|e| OracleError::Blockchain(format!("Failed to submit tx: {}", e)))?
            .wait_for_finalized_success()
            .await
            .map_err(|e| OracleError::Blockchain(format!("Tx failed: {}", e)))?;

        debug!("Transaction finalized in block: {:?}", result.block_hash());
        Ok(())
    }

    /// 获取区块链端点
    pub fn endpoint(&self) -> &str {
        &self.config.chain.ws_endpoint
    }

    /// 获取Oracle账户
    pub fn account(&self) -> &sp_core::sr25519::Public {
        self.signer.public()
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
