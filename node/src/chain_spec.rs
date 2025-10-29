use sc_service::ChainType;
use solochain_template_runtime::WASM_BINARY;

/// Specialized `ChainSpec`. This is a specialization of the general Substrate ChainSpec type.
pub type ChainSpec = sc_service::GenericChainSpec;

pub fn development_chain_spec() -> Result<ChainSpec, String> {
    Ok(ChainSpec::builder(
        WASM_BINARY.ok_or_else(|| "Development wasm not available".to_string())?,
        None,
    )
    .with_name("Development")
    .with_id("dev")
    .with_chain_type(ChainType::Development)
    .with_genesis_config_preset_name(sp_genesis_builder::DEV_RUNTIME_PRESET)
    .with_properties(default_properties())
    .build())
}

pub fn local_chain_spec() -> Result<ChainSpec, String> {
    Ok(ChainSpec::builder(
        WASM_BINARY.ok_or_else(|| "Development wasm not available".to_string())?,
        None,
    )
    .with_name("STARDUST")
    .with_id("stardust-dev")
    .with_chain_type(ChainType::Local)
    .with_genesis_config_preset_name(sp_genesis_builder::LOCAL_TESTNET_RUNTIME_PRESET)
    .with_properties(default_properties())
    .build())
}

/// 函数级中文注释：返回链属性（tokenSymbol/tokenDecimals/ss58Format）。
/// - tokenSymbol 设为 DUST；
/// - tokenDecimals 与 runtime 的 UNIT(=10^12) 对齐为 12；
/// - ss58Format 先用 42（通用 Substrate），主网可自定义。
fn default_properties() -> sc_service::Properties {
    let mut p = sc_service::Properties::new();
    p.insert("tokenSymbol".into(), "DUST".into());
    p.insert("tokenDecimals".into(), 12.into());
    p.insert("ss58Format".into(), 42.into());
    p
}
