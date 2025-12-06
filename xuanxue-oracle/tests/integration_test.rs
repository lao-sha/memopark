// 集成测试 - Oracle节点完整工作流程
// tests/integration_test.rs

use xuanxue_oracle::{Config, EventMonitor};
use anyhow::Result;

#[cfg(test)]
mod integration_tests {
    use super::*;

    /// 测试1: Oracle节点初始化
    #[tokio::test]
    async fn test_oracle_initialization() -> Result<()> {
        // 加载配置
        let config = Config::load()?;

        // 创建EventMonitor
        let monitor = EventMonitor::new(config).await?;

        // 验证连接成功
        assert!(monitor.endpoint().contains("ws://"));
        assert!(monitor.account().as_ref().len() == 32);

        Ok(())
    }

    /// 测试2: 配置文件加载
    #[tokio::test]
    async fn test_config_loading() -> Result<()> {
        let config = Config::load()?;

        // 验证必需字段
        assert!(!config.chain.ws_endpoint.is_empty());
        assert!(!config.chain.oracle_account_seed.is_empty());
        assert!(!config.deepseek.api_key.is_empty());

        // 验证Oracle配置
        assert!(config.oracle.supported_divination_types > 0);
        assert!(config.oracle.supported_interpretation_types > 0);

        Ok(())
    }

    /// 测试3: DeepSeek AI服务
    #[tokio::test]
    async fn test_deepseek_service() -> Result<()> {
        let config = Config::load()?;
        let ai_service = AiService::new(config.deepseek);

        // 简单的prompt测试
        let prompt = "System: 你是一个测试助手。\n\nUser: 返回'测试成功'";
        let response = ai_service.generate(prompt).await?;

        assert!(!response.is_empty());
        println!("DeepSeek response: {}", response);

        Ok(())
    }

    /// 测试4: IPFS上传（本地）
    #[tokio::test]
    #[ignore] // 需要本地IPFS运行
    async fn test_ipfs_local_upload() -> Result<()> {
        let config = Config::load()?;
        let ipfs_client = IpfsClient::new(config.ipfs)?;

        let test_data = serde_json::json!({
            "test": true,
            "message": "This is a test"
        });

        let cid = ipfs_client.upload_json(&test_data).await?;
        assert!(cid.starts_with("Qm") || cid.starts_with("bafy"));

        println!("IPFS CID: {}", cid);

        Ok(())
    }

    /// 测试5: IPFS上传（Pinata备份）
    #[tokio::test]
    #[ignore] // 需要Pinata API密钥
    async fn test_ipfs_pinata_upload() -> Result<()> {
        let config = Config::load()?;
        let ipfs_client = IpfsClient::new(config.ipfs)?;

        let test_data = serde_json::json!({
            "test": true,
            "provider": "pinata"
        });

        let cid = ipfs_client.upload_to_pinata(&test_data).await?;
        assert!(!cid.is_empty());

        println!("Pinata CID: {}", cid);

        Ok(())
    }

    /// 测试6: Prompt模板加载
    #[tokio::test]
    async fn test_prompt_template_loading() -> Result<()> {
        let prompt_builder = PromptBuilder::new()?;

        // 测试八字基础模板
        let template = prompt_builder.load_template("prompts/bazi/basic_v2.txt")?;
        assert!(template.contains("System:"));
        assert!(template.contains("User:"));
        assert!(template.len() > 1000);

        // 测试八字专业模板
        let template = prompt_builder.load_template("prompts/bazi/professional_v2.txt")?;
        assert!(template.contains("{day_master}"));
        assert!(template.contains("{geju}"));

        // 测试梅花易数模板
        let template = prompt_builder.load_template("prompts/meihua/detailed_v2.txt")?;
        assert!(template.contains("{ti_gua}"));
        assert!(template.contains("{yong_gua}"));

        Ok(())
    }

    /// 测试7: Prompt占位符替换
    #[tokio::test]
    async fn test_prompt_placeholder_replacement() -> Result<()> {
        let prompt_builder = PromptBuilder::new()?;

        let test_data = serde_json::json!({
            "day_master": "甲木",
            "gender": "Male",
            "year_pillar": "庚午",
            "month_pillar": "丁亥",
            "day_pillar": "甲寅",
            "hour_pillar": "辛未",
            "wuxing_analysis": "木旺金弱",
            "geju": "正印格",
            "yongshen": "水木"
        });

        let prompt = prompt_builder.build_bazi_prompt(
            InterpretationType::Basic,
            &test_data
        )?;

        // 验证占位符已替换
        assert!(!prompt.contains("{day_master}"));
        assert!(prompt.contains("甲木"));
        assert!(prompt.contains("庚午"));

        Ok(())
    }

    /// 测试8: 占卜类型支持检查
    #[tokio::test]
    async fn test_divination_type_support() -> Result<()> {
        let config = Config::load()?;
        let monitor = EventMonitor::new(config).await?;

        // 假设支持八字 (bit 0)
        assert!(monitor.supports_divination_type(DivinationType::Bazi));

        Ok(())
    }

    /// 测试9: 解读类型支持检查
    #[tokio::test]
    async fn test_interpretation_type_support() -> Result<()> {
        let config = Config::load()?;
        let monitor = EventMonitor::new(config).await?;

        // 假设支持基础和专业解读
        assert!(monitor.supports_interpretation_type(InterpretationType::Basic));
        assert!(monitor.supports_interpretation_type(InterpretationType::Professional));

        Ok(())
    }

    /// 测试10: 完整解读流程（Mock）
    #[tokio::test]
    async fn test_full_interpretation_workflow_mock() -> Result<()> {
        let config = Config::load()?;
        let ai_service = AiService::new(config.deepseek.clone());
        let ipfs_client = IpfsClient::new(config.ipfs.clone())?;

        // 1. 模拟占卜数据
        let divination_data = serde_json::json!({
            "divination_type": "Bazi",
            "chart_id": 123,
            "year_pillar": "庚午",
            "month_pillar": "丁亥",
            "day_pillar": "甲寅",
            "hour_pillar": "辛未",
            "day_master": "甲木",
            "gender": "Male"
        });

        // 2. 构建Prompt
        let prompt_builder = PromptBuilder::new()?;
        let prompt = prompt_builder.build_bazi_prompt(
            InterpretationType::Basic,
            &divination_data
        )?;

        assert!(!prompt.is_empty());
        println!("Prompt length: {} chars", prompt.len());

        // 3. 生成AI解读（需要API key，可能会失败）
        #[cfg(feature = "with_api")]
        {
            let interpretation = ai_service.generate(&prompt).await?;
            assert!(!interpretation.is_empty());
            println!("Interpretation length: {} chars", interpretation.len());

            // 4. 上传到IPFS
            let result = serde_json::json!({
                "divination_type": "Bazi",
                "interpretation_type": "Basic",
                "result_id": 123,
                "content": interpretation,
                "metadata": {
                    "generated_at": chrono::Utc::now().to_rfc3339(),
                    "model": "deepseek-chat-v2.5"
                }
            });

            let cid = ipfs_client.upload_json(&result).await?;
            assert!(!cid.is_empty());
            println!("IPFS CID: {}", cid);
        }

        Ok(())
    }
}

// 单元测试 - 各个模块独立测试
#[cfg(test)]
mod unit_tests {
    use super::*;

    mod config_tests {
        use super::*;

        #[test]
        fn test_config_default_values() {
            // 测试默认值
            let config = Config {
                chain: ChainConfig {
                    ws_endpoint: "ws://localhost:9944".to_string(),
                    oracle_account_seed: "//Alice".to_string(),
                },
                deepseek: DeepSeekConfig {
                    api_key: "test_key".to_string(),
                    base_url: "https://api.deepseek.com/v1".to_string(),
                    model: "deepseek-chat-v2.5".to_string(),
                    temperature: 0.7,
                    max_tokens: 4000,
                },
                ipfs: IpfsConfig {
                    api_url: "http://localhost:5001".to_string(),
                    gateway_url: "http://localhost:8080".to_string(),
                    use_pinata: false,
                    pinata_api_key: None,
                    pinata_secret_key: None,
                },
                oracle: OracleConfig {
                    name: "Test Oracle".to_string(),
                    supported_divination_types: 0xFF,
                    supported_interpretation_types: 0x01FF,
                },
            };

            assert_eq!(config.chain.ws_endpoint, "ws://localhost:9944");
            assert_eq!(config.deepseek.model, "deepseek-chat-v2.5");
            assert!(!config.ipfs.use_pinata);
        }

        #[test]
        fn test_divination_type_flags() {
            // 测试位标志
            let bazi_flag = 1u8 << 0; // 0x01
            let meihua_flag = 1u8 << 1; // 0x02
            let liuyao_flag = 1u8 << 2; // 0x04

            let supported = bazi_flag | meihua_flag | liuyao_flag; // 0x07

            assert!(supported & bazi_flag != 0);
            assert!(supported & meihua_flag != 0);
            assert!(supported & liuyao_flag != 0);
        }
    }

    mod types_tests {
        use super::*;

        #[test]
        fn test_divination_type_conversion() {
            assert_eq!(DivinationType::from_u8(0), Some(DivinationType::Bazi));
            assert_eq!(DivinationType::from_u8(1), Some(DivinationType::Meihua));
            assert_eq!(DivinationType::from_u8(9), None);
        }

        #[test]
        fn test_interpretation_type_conversion() {
            assert_eq!(InterpretationType::from_u8(0), Some(InterpretationType::Basic));
            assert_eq!(InterpretationType::from_u8(1), Some(InterpretationType::Detailed));
            assert_eq!(InterpretationType::from_u8(15), None);
        }
    }

    mod error_tests {
        use super::*;

        #[test]
        fn test_error_types() {
            let err1 = OracleError::AiApi("Test error".to_string());
            assert!(err1.to_string().contains("Test error"));

            let err2 = OracleError::Blockchain("Connection failed".to_string());
            assert!(err2.to_string().contains("Connection failed"));

            let err3 = OracleError::Storage("IPFS error".to_string());
            assert!(err3.to_string().contains("IPFS error"));
        }
    }
}

// 性能测试
#[cfg(test)]
mod performance_tests {
    use super::*;
    use std::time::Instant;

    #[tokio::test]
    async fn test_prompt_building_performance() -> Result<()> {
        let prompt_builder = PromptBuilder::new()?;

        let test_data = serde_json::json!({
            "day_master": "甲木",
            "gender": "Male",
            "year_pillar": "庚午",
            "month_pillar": "丁亥",
            "day_pillar": "甲寅",
            "hour_pillar": "辛未"
        });

        let start = Instant::now();
        for _ in 0..100 {
            let _ = prompt_builder.build_bazi_prompt(
                InterpretationType::Basic,
                &test_data
            )?;
        }
        let duration = start.elapsed();

        let avg_time = duration.as_micros() / 100;
        println!("Average prompt building time: {}μs", avg_time);

        // 应该在1ms以内
        assert!(avg_time < 1000);

        Ok(())
    }

    #[tokio::test]
    #[ignore] // 需要实际API调用
    async fn test_ai_generation_performance() -> Result<()> {
        let config = Config::load()?;
        let ai_service = AiService::new(config.deepseek);

        let prompt = "System: 你是测试助手。\n\nUser: 说'测试'";

        let start = Instant::now();
        let _ = ai_service.generate(prompt).await?;
        let duration = start.elapsed();

        println!("AI generation time: {:?}", duration);

        // 应该在10秒以内
        assert!(duration.as_secs() < 10);

        Ok(())
    }

    #[tokio::test]
    #[ignore] // 需要IPFS运行
    async fn test_ipfs_upload_performance() -> Result<()> {
        let config = Config::load()?;
        let ipfs_client = IpfsClient::new(config.ipfs)?;

        let test_data = serde_json::json!({"test": true});

        let start = Instant::now();
        for _ in 0..10 {
            let _ = ipfs_client.upload_json(&test_data).await?;
        }
        let duration = start.elapsed();

        let avg_time = duration.as_millis() / 10;
        println!("Average IPFS upload time: {}ms", avg_time);

        // 应该在2秒以内
        assert!(avg_time < 2000);

        Ok(())
    }
}

// 端到端测试
#[cfg(test)]
mod e2e_tests {
    use super::*;

    /// E2E测试: 完整的解读请求处理
    #[tokio::test]
    #[ignore] // 需要测试网运行
    async fn test_e2e_interpretation_request() -> Result<()> {
        // 1. 初始化Oracle节点
        let config = Config::load()?;
        let monitor = EventMonitor::new(config).await?;

        // 2. 确保已注册
        monitor.ensure_registered().await?;

        // 3. 模拟接收到InterpretationRequested事件
        let event = InterpretationRequestedEvent {
            request_id: 1,
            divination_type: DivinationType::Bazi,
            result_id: 123,
            requester: vec![0u8; 32],
            interpretation_type: InterpretationType::Basic,
            fee: 1000000000000,
        };

        // 4. 处理请求
        monitor.handle_interpretation_request(event).await?;

        // 5. 验证结果已提交到链上
        // (需要查询链上状态)

        Ok(())
    }

    /// E2E测试: 多个请求并发处理
    #[tokio::test]
    #[ignore] // 需要测试网运行
    async fn test_e2e_concurrent_requests() -> Result<()> {
        let config = Config::load()?;
        let monitor = Arc::new(EventMonitor::new(config).await?);

        let mut handles = vec![];

        // 启动5个并发请求
        for i in 1..=5 {
            let monitor_clone = Arc::clone(&monitor);
            let handle = tokio::spawn(async move {
                let event = InterpretationRequestedEvent {
                    request_id: i,
                    divination_type: DivinationType::Bazi,
                    result_id: 100 + i,
                    requester: vec![0u8; 32],
                    interpretation_type: InterpretationType::Basic,
                    fee: 1000000000000,
                };

                monitor_clone.handle_interpretation_request(event).await
            });
            handles.push(handle);
        }

        // 等待所有请求完成
        for handle in handles {
            handle.await??;
        }

        Ok(())
    }
}
