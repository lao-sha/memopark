use thiserror::Error;

#[derive(Error, Debug)]
pub enum OracleError {
    #[error("Blockchain error: {0}")]
    Blockchain(String),

    #[error("AI API error: {0}")]
    AiApi(String),

    #[error("IPFS error: {0}")]
    Ipfs(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Divination data not found: type={0}, id={1}")]
    DivinationNotFound(String, u64),

    #[error("Unsupported divination type: {0}")]
    UnsupportedDivinationType(String),

    #[error("Prompt generation error: {0}")]
    PromptGeneration(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Other error: {0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, OracleError>;
