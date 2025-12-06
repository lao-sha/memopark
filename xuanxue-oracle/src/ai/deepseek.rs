use reqwest::Client;
use serde::{Deserialize, Serialize};
use anyhow::Result;
use tracing::{info, debug};

use crate::config::DeepSeekConfig;
use crate::error::OracleError;

/// DeepSeek API客户端
pub struct DeepSeekClient {
    config: DeepSeekConfig,
    client: Client,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<Message>,
    temperature: f32,
    max_tokens: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    id: String,
    object: String,
    created: u64,
    model: String,
    choices: Vec<Choice>,
    usage: Usage,
}

#[derive(Debug, Deserialize)]
struct Choice {
    index: u32,
    message: Message,
    finish_reason: String,
}

#[derive(Debug, Deserialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

impl DeepSeekClient {
    /// 创建新的DeepSeek客户端
    pub fn new(config: DeepSeekConfig) -> Self {
        let client = Client::new();
        Self { config, client }
    }

    /// 生成文本
    pub async fn generate(&self, prompt: &str) -> Result<String> {
        debug!("Calling DeepSeek API...");

        // 解析系统和用户消息
        let (system_message, user_message) = self.parse_prompt(prompt);

        let request = ChatRequest {
            model: self.config.model.clone(),
            messages: vec![
                Message {
                    role: "system".to_string(),
                    content: system_message,
                },
                Message {
                    role: "user".to_string(),
                    content: user_message,
                },
            ],
            temperature: self.config.temperature,
            max_tokens: self.config.max_tokens,
        };

        debug!("Request: {:?}", request);

        let response = self.client
            .post(format!("{}/chat/completions", self.config.base_url))
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| OracleError::AiApi(format!("HTTP request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(OracleError::AiApi(format!(
                "API returned error {}: {}",
                status, error_text
            )).into());
        }

        let chat_response: ChatResponse = response.json().await
            .map_err(|e| OracleError::AiApi(format!("Failed to parse response: {}", e)))?;

        debug!("Response: {} tokens used", chat_response.usage.total_tokens);

        if let Some(choice) = chat_response.choices.first() {
            Ok(choice.message.content.clone())
        } else {
            Err(OracleError::AiApi("No response from API".to_string()).into())
        }
    }

    /// 解析Prompt为系统消息和用户消息
    fn parse_prompt(&self, prompt: &str) -> (String, String) {
        if let Some((system, user)) = prompt.split_once("\n\nUser:") {
            let system = system.trim_start_matches("System:").trim();
            let user = user.trim();
            (system.to_string(), user.to_string())
        } else {
            // 如果没有明确分隔,整个作为用户消息
            (String::new(), prompt.to_string())
        }
    }

    /// 流式生成(可选实现)
    pub async fn generate_stream(&self, prompt: &str) -> Result<()> {
        // TODO: 实现SSE流式响应
        unimplemented!("Streaming not yet implemented")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_deepseek_client() {
        // 需要设置环境变量DEEPSEEK_API_KEY
        if std::env::var("DEEPSEEK_API_KEY").is_err() {
            println!("Skipping test: DEEPSEEK_API_KEY not set");
            return;
        }

        let config = DeepSeekConfig {
            api_key: std::env::var("DEEPSEEK_API_KEY").unwrap(),
            base_url: "https://api.deepseek.com/v1".to_string(),
            model: "deepseek-chat".to_string(),
            temperature: 0.7,
            max_tokens: 1000,
        };

        let client = DeepSeekClient::new(config);
        let prompt = "System: 你是一个AI助手。\n\nUser: 你好,请介绍一下自己。";

        match client.generate(prompt).await {
            Ok(response) => {
                println!("Response: {}", response);
                assert!(!response.is_empty());
            }
            Err(e) => {
                println!("Error: {}", e);
            }
        }
    }
}
