# Subxt类型生成和集成指南

## 概述

本文档说明如何使用`subxt`从Stardust测试网生成类型安全的Rust代码,并集成到Oracle节点项目中。

## 什么是Subxt?

[subxt](https://github.com/paritytech/subxt) 是Parity开发的Rust库,用于与Substrate节点交互。它能从链上元数据自动生成类型安全的Rust代码。

### 优势
- ✅ **类型安全**: 编译时检查,避免运行时错误
- ✅ **自动生成**: 无需手写类型定义
- ✅ **版本同步**: 与链上runtime版本完全匹配
- ✅ **IDE支持**: 完整的代码补全和类型提示

## 前提条件

1. **Stardust测试网节点运行中**:
```bash
# 检查节点是否可访问
curl -H "Content-Type: application/json" \
     -d '{"id":1, "jsonrpc":"2.0", "method": "system_health"}' \
     http://localhost:9944

# 预期输出
{"jsonrpc":"2.0","result":{"isSyncing":false,"peers":0,"shouldHavePeers":false},"id":1}
```

2. **安装subxt-cli** (自动化脚本会处理):
```bash
cargo install subxt-cli
```

## 生成步骤

### 方式1: 使用自动化脚本 (推荐)

```bash
# 使用默认端点 ws://127.0.0.1:9944
./generate-types.sh

# 使用自定义端点
CHAIN_WS_ENDPOINT=ws://192.168.1.100:9944 ./generate-types.sh
```

**脚本做了什么**:
1. 检查并安装`subxt-cli`
2. 从链上下载元数据到`metadata.scale`
3. 从元数据生成Rust代码到`src/blockchain/runtime.rs`
4. 更新`src/blockchain/mod.rs`添加模块声明
5. 显示统计信息

**预期输出**:
```
🔍 Subxt Metadata Generator
================================

🌐 Connecting to: ws://127.0.0.1:9944
📥 Fetching metadata...
✅ Metadata downloaded: metadata.scale
-rw-r--r-- 1 user user 245K Dec  6 10:00 metadata.scale

🔨 Generating Rust code...
✅ Code generated: src/blockchain/runtime.rs
   Generated 8523 lines of code

🎉 Success! Generated files:
   - metadata.scale (metadata)
   - src/blockchain/runtime.rs (Rust types)

Next steps:
   1. Review the generated code
   2. Update your code to use the new types
   3. Run: cargo check
```

### 方式2: 手动执行

```bash
# 1. 下载元数据
subxt metadata --url ws://localhost:9944 > metadata.scale

# 2. 生成Rust代码
subxt codegen --file metadata.scale > src/blockchain/runtime.rs

# 3. 检查生成的代码
wc -l src/blockchain/runtime.rs
grep -n "pub mod divination_ai" src/blockchain/runtime.rs

# 4. 编译验证
cargo check
```

## 生成的代码结构

```rust
// src/blockchain/runtime.rs (自动生成)

#[subxt::subxt(runtime_metadata_path = "metadata.scale")]
pub mod runtime {
    // 所有pallet的类型定义

    pub mod divination_ai {
        pub mod calls {
            pub struct RequestInterpretation { ... }
            pub struct AcceptRequest { ... }
            pub struct SubmitResult { ... }
            pub struct RegisterOracle { ... }
        }

        pub mod events {
            pub struct InterpretationRequested {
                pub request_id: u64,
                pub divination_type: u8,
                pub result_id: u64,
                pub requester: AccountId32,
                pub interpretation_type: u8,
                pub fee: u128,
            }
            pub struct RequestAccepted { ... }
            pub struct ResultSubmitted { ... }
        }

        pub mod storage {
            pub fn interpretation_requests(id: u64) -> ... { ... }
            pub fn oracles(account: AccountId32) -> ... { ... }
            pub fn results(request_id: u64) -> ... { ... }
        }
    }

    // 其他pallet...
}
```

## 集成到代码

### 步骤1: 替换手动类型定义

**当前代码** (src/blockchain/mod.rs):
```rust
use crate::blockchain::runtime::manual_types;

// 使用手动定义的类型
async fn parse_event(&self, event: &EventDetails) -> Result<manual_types::InterpretationRequestedEvent> {
    // TODO: 手动解析
    warn!("Using mock event data");
    Ok(manual_types::InterpretationRequestedEvent { ... })
}
```

**更新后**:
```rust
use crate::blockchain::runtime;

// 使用生成的类型
async fn parse_event(&self, event: &EventDetails) -> Result<()> {
    // 使用subxt的类型安全API
    if let Some(ev) = event.as_event::<runtime::divination_ai::events::InterpretationRequested>()? {
        info!("Request ID: {}", ev.request_id);
        self.handle_interpretation_request(ev).await?;
    }
    Ok(())
}
```

### 步骤2: 实现交易提交

**当前代码** (包含TODO):
```rust
async fn register_oracle(&self) -> Result<()> {
    // TODO: 实际的交易提交
    // let tx = runtime::tx()...
    Ok(())
}
```

**更新后**:
```rust
use subxt::tx::PairSigner;

async fn register_oracle(&self) -> Result<()> {
    info!("📝 Registering Oracle node...");

    let tx = runtime::tx()
        .divination_ai()
        .register_oracle(
            self.config.oracle.name.as_bytes().to_vec(),
            self.config.oracle.supported_divination_types,
            self.config.oracle.supported_interpretation_types,
        );

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
    Ok(())
}
```

### 步骤3: 实现存储查询

**当前代码**:
```rust
async fn query_oracle_info(&self) -> Result<Option<manual_types::OracleNode>> {
    // TODO: 实际的链上查询
    debug!("Query Oracle info (not implemented yet)");
    Ok(None)
}
```

**更新后**:
```rust
async fn query_oracle_info(&self) -> Result<Option<runtime::divination_ai::storage::types::OracleNode>> {
    let account_id = AccountId32::from(self.signer.public().0);

    let storage_query = runtime::storage()
        .divination_ai()
        .oracles(account_id);

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
```

### 步骤4: 更新事件处理

**当前代码**:
```rust
async fn handle_event(&self, event: EventDetails) -> Result<()> {
    let pallet_name = event.pallet_name();
    let event_name = event.variant_name();

    if pallet_name == "DivinationAi" && event_name == "InterpretationRequested" {
        // 手动解析...
    }
    Ok(())
}
```

**更新后**:
```rust
async fn handle_event(&self, event: EventDetails) -> Result<()> {
    // 使用类型安全的事件解析
    use runtime::divination_ai::events;

    if let Some(ev) = event.as_event::<events::InterpretationRequested>()? {
        info!("🔔 InterpretationRequested: request_id={}", ev.request_id);
        self.handle_interpretation_request(ev).await?;
    } else if let Some(ev) = event.as_event::<events::RequestAccepted>()? {
        debug!("Request {} accepted by oracle", ev.request_id);
    } else if let Some(ev) = event.as_event::<events::ResultSubmitted>()? {
        info!("Result submitted for request {}", ev.request_id);
    }

    Ok(())
}
```

## 完整集成示例

```rust
// src/blockchain/mod.rs (更新后的完整版本)

use subxt::{OnlineClient, PolkadotConfig, tx::PairSigner};
use sp_core::{sr25519::Pair, Pair as PairT};

use crate::blockchain::runtime;
use crate::config::Config;

pub struct EventMonitor {
    config: Config,
    client: OnlineClient<PolkadotConfig>,
    signer: Pair,
    ai_service: AiService,
    ipfs_client: IpfsClient,
}

impl EventMonitor {
    /// 处理解读请求
    async fn handle_interpretation_request(
        &self,
        event: runtime::divination_ai::events::InterpretationRequested
    ) -> Result<()> {
        info!("📝 Processing request #{}", event.request_id);

        // 1. 接受请求
        let accept_tx = runtime::tx()
            .divination_ai()
            .accept_request(event.request_id);

        let signer = PairSigner::new(self.signer.clone());
        self.client.tx()
            .sign_and_submit_then_watch_default(&accept_tx, &signer)
            .await?
            .wait_for_finalized_success()
            .await?;

        info!("✅ Request accepted");

        // 2. 获取占卜数据
        let storage_query = runtime::storage()
            .bazi_chart()
            .charts(event.result_id);

        let chart = self.client.storage()
            .at_latest().await?
            .fetch(&storage_query).await?
            .ok_or_else(|| anyhow!("Chart not found"))?;

        // 3. 生成AI解读
        let interpretation = self.ai_service
            .generate_interpretation(
                DivinationType::from_u8(event.divination_type)?,
                InterpretationType::from_u8(event.interpretation_type)?,
                &serde_json::to_value(chart)?
            )
            .await?;

        // 4. 上传IPFS
        let content_cid = self.ipfs_client.upload_json(&interpretation).await?;
        info!("📤 Uploaded to IPFS: {}", content_cid);

        // 5. 提交结果
        let submit_tx = runtime::tx()
            .divination_ai()
            .submit_result(
                event.request_id,
                content_cid.as_bytes().to_vec(),
                None,
                "deepseek-chat-v2.5".as_bytes().to_vec(),
                "zh-CN".as_bytes().to_vec(),
            );

        self.client.tx()
            .sign_and_submit_then_watch_default(&submit_tx, &signer)
            .await?
            .wait_for_finalized_success()
            .await?;

        info!("✅ Result submitted");
        Ok(())
    }

    /// 监听事件
    pub async fn watch_events(&self) -> Result<()> {
        let mut blocks = self.client.blocks().subscribe_finalized().await?;

        while let Some(block) = blocks.next().await {
            let block = block?;
            let events = block.events().await?;

            for event in events.iter() {
                if let Ok(event) = event {
                    self.handle_event(event).await?;
                }
            }
        }

        Ok(())
    }
}
```

## 重新生成类型

当链上runtime更新时(例如添加了新的pallet或修改了类型),需要重新生成:

```bash
# 1. 备份当前文件
cp metadata.scale metadata.scale.backup
cp src/blockchain/runtime.rs src/blockchain/runtime.rs.backup

# 2. 重新生成
./generate-types.sh

# 3. 检查差异
diff metadata.scale.backup metadata.scale
diff src/blockchain/runtime.rs.backup src/blockchain/runtime.rs

# 4. 重新编译和测试
cargo check
cargo test
```

## 常见问题

### Q: 生成失败 "Failed to fetch metadata"

**原因**: 无法连接到区块链节点

**解决**:
```bash
# 检查节点是否运行
curl http://localhost:9944

# 检查端口是否正确
CHAIN_WS_ENDPOINT=ws://localhost:9945 ./generate-types.sh

# 检查防火墙
sudo ufw allow 9944
```

### Q: 编译错误 "cannot find type `runtime` in module `blockchain`"

**原因**: 没有运行生成脚本,或生成的文件未被正确导入

**解决**:
```bash
# 1. 确认文件存在
ls -lh src/blockchain/runtime.rs

# 2. 确认mod.rs包含声明
grep "pub mod runtime" src/blockchain/mod.rs

# 3. 如果没有,手动添加
echo "pub mod runtime;" >> src/blockchain/mod.rs

# 4. 重新编译
cargo clean && cargo check
```

### Q: 运行时类型不匹配

**原因**: 生成的类型版本与链上runtime版本不一致

**解决**:
```bash
# 1. 检查runtime版本
curl -H "Content-Type: application/json" \
     -d '{"id":1, "jsonrpc":"2.0", "method": "state_getRuntimeVersion"}' \
     http://localhost:9944

# 2. 重新生成
./generate-types.sh

# 3. 重新编译
cargo clean && cargo build --release
```

### Q: 生成的代码太大 (>10MB)

**原因**: Substrate元数据包含所有pallet的完整类型信息

**优化**:
```bash
# 使用 derive-for-all-types=false 减小生成代码
subxt codegen \
  --file metadata.scale \
  --derive-for-all-types=false \
  > src/blockchain/runtime.rs
```

但这可能导致某些类型无法使用,建议保持默认设置。

## 最佳实践

1. **版本控制**: 不要提交`metadata.scale`和生成的`runtime.rs`到git
```bash
# .gitignore
metadata.scale
metadata.scale.backup
src/blockchain/runtime.rs.backup
```

2. **CI/CD集成**: 在构建流程中自动生成
```yaml
# .github/workflows/build.yml
- name: Generate types
  run: |
    ./generate-types.sh
    cargo check
```

3. **文档化**: 在README中说明如何生成类型

4. **测试**: 编写测试确保类型生成正确
```rust
#[tokio::test]
async fn test_can_connect_and_query() {
    let client = OnlineClient::<PolkadotConfig>::from_url("ws://localhost:9944")
        .await
        .unwrap();

    let query = runtime::storage().divination_ai().oracles(...);
    let result = client.storage().at_latest().await.unwrap()
        .fetch(&query).await;

    assert!(result.is_ok());
}
```

## 参考资源

- [Subxt官方文档](https://docs.rs/subxt/latest/subxt/)
- [Subxt示例](https://github.com/paritytech/subxt/tree/master/examples)
- [Substrate元数据规范](https://docs.substrate.io/reference/scale-codec/)
- [Polkadot SDK文档](https://paritytech.github.io/polkadot-sdk/master/polkadot_sdk_docs/index.html)

## 下一步

完成类型生成后:
1. ✅ 更新所有TODO标记的代码
2. ✅ 运行完整的测试套件
3. ✅ 进行端到端测试
4. ✅ 部署到生产环境
