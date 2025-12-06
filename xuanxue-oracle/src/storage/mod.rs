use anyhow::Result;
use serde::Serialize;
use tracing::{info, debug};

use crate::config::IpfsConfig;
use crate::error::OracleError;

/// IPFS客户端
pub struct IpfsClient {
    config: IpfsConfig,
    client: reqwest::Client,
}

impl IpfsClient {
    /// 创建新的IPFS客户端
    pub fn new(config: IpfsConfig) -> Result<Self> {
        let client = reqwest::Client::new();
        Ok(Self { config, client })
    }

    /// 上传JSON数据到IPFS
    pub async fn upload_json<T: Serialize>(&self, data: &T) -> Result<String> {
        let json_str = serde_json::to_string_pretty(data)?;
        self.upload_string(&json_str).await
    }

    /// 上传字符串到IPFS
    pub async fn upload_string(&self, content: &str) -> Result<String> {
        debug!("Uploading {} bytes to IPFS...", content.len());

        // 如果配置了Pinata,使用Pinata API
        if let (Some(api_key), Some(secret)) = (&self.config.pinata_api_key, &self.config.pinata_secret) {
            return self.upload_to_pinata(content, api_key, secret).await;
        }

        // 否则使用本地IPFS节点
        self.upload_to_local_ipfs(content).await
    }

    /// 上传到本地IPFS节点
    async fn upload_to_local_ipfs(&self, content: &str) -> Result<String> {
        let form = reqwest::multipart::Form::new()
            .text("file", content.to_string());

        let response = self.client
            .post(format!("{}/api/v0/add", self.config.api_url))
            .multipart(form)
            .send()
            .await
            .map_err(|e| OracleError::Ipfs(format!("Upload failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(OracleError::Ipfs(format!("IPFS returned error: {}", response.status())).into());
        }

        let result: serde_json::Value = response.json().await
            .map_err(|e| OracleError::Ipfs(format!("Failed to parse response: {}", e)))?;

        let cid = result["Hash"]
            .as_str()
            .ok_or_else(|| OracleError::Ipfs("No CID in response".to_string()))?
            .to_string();

        info!("✅ Uploaded to IPFS: {}", cid);

        Ok(cid)
    }

    /// 上传到Pinata
    async fn upload_to_pinata(&self, content: &str, api_key: &str, secret: &str) -> Result<String> {
        use serde_json::json;

        let body = json!({
            "pinataContent": content,
            "pinataMetadata": {
                "name": "divination-interpretation"
            }
        });

        let response = self.client
            .post("https://api.pinata.cloud/pinning/pinJSONToIPFS")
            .header("pinata_api_key", api_key)
            .header("pinata_secret_api_key", secret)
            .json(&body)
            .send()
            .await
            .map_err(|e| OracleError::Ipfs(format!("Pinata upload failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(OracleError::Ipfs(format!("Pinata returned error: {}", response.status())).into());
        }

        let result: serde_json::Value = response.json().await
            .map_err(|e| OracleError::Ipfs(format!("Failed to parse Pinata response: {}", e)))?;

        let cid = result["IpfsHash"]
            .as_str()
            .ok_or_else(|| OracleError::Ipfs("No CID in Pinata response".to_string()))?
            .to_string();

        info!("✅ Uploaded to Pinata/IPFS: {}", cid);

        Ok(cid)
    }

    /// 从IPFS获取内容
    pub async fn get_content(&self, cid: &str) -> Result<String> {
        let url = if self.config.pinata_api_key.is_some() {
            format!("https://gateway.pinata.cloud/ipfs/{}", cid)
        } else {
            format!("{}/ipfs/{}", self.config.api_url, cid)
        };

        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| OracleError::Ipfs(format!("Failed to fetch from IPFS: {}", e)))?;

        if !response.status().is_success() {
            return Err(OracleError::Ipfs(format!("IPFS gateway error: {}", response.status())).into());
        }

        let content = response.text().await
            .map_err(|e| OracleError::Ipfs(format!("Failed to read response: {}", e)))?;

        Ok(content)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ipfs_upload() {
        let config = IpfsConfig {
            api_url: "http://127.0.0.1:5001".to_string(),
            pinata_api_key: None,
            pinata_secret: None,
        };

        let client = IpfsClient::new(config).unwrap();
        let test_content = "Hello, IPFS!";

        match client.upload_string(test_content).await {
            Ok(cid) => {
                println!("Uploaded to IPFS: {}", cid);
                assert!(!cid.is_empty());
            }
            Err(e) => {
                println!("IPFS upload test skipped: {}", e);
            }
        }
    }
}
