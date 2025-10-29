// This file is part of Substrate.

// Copyright (C) Parity Technologies (UK) Ltd.
// SPDX-License-Identifier: Apache-2.0

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use crate::configs::BurnAccount;
use crate::Runtime;
use crate::{AccountId, BalancesConfig, RuntimeGenesisConfig, SudoConfig, UNIT};
use alloc::{vec, vec::Vec};
use frame_support::build_struct_json_patch;
use serde_json::Value;
use sp_consensus_aura::sr25519::AuthorityId as AuraId;
use sp_consensus_grandpa::AuthorityId as GrandpaId;
use sp_core::crypto::Ss58Codec;
use sp_core::Get;
use sp_genesis_builder::{self, PresetId};
use sp_keyring::Sr25519Keyring;

// Returns the genesis config presets populated with given parameters.
/// 函数级中文注释：构建创世配置，设置 DUST 总发行量 1000 亿（按 12 位精度）。
/// - 将全部初始发行分配给 sudo（root）账户；
/// - 如需多账号分配，可在 balances 向量中拆分，保证总和一致。
fn testnet_genesis(
    initial_authorities: Vec<(AuraId, GrandpaId)>,
    _endowed_accounts: Vec<AccountId>,
    root: AccountId,
) -> Value {
    let total_issuance: u128 = 100_000_000_000u128.saturating_mul(UNIT);
    let _burn_account = BurnAccount::get();
    let _ed: u128 = crate::EXISTENTIAL_DEPOSIT;

    // 函数级中文注释：将给定的 SS58 地址解析为 AccountId，供创世委员会成员列表使用。
    fn parse_account(s: &str) -> AccountId {
        sp_core::crypto::AccountId32::from_ss58check(s)
            .map(|a| a.into())
            .expect("invalid SS58 address in genesis committee members")
    }
    let committee_members: Vec<AccountId> = vec![
        parse_account("5CrDBEVDgXUwctSuV8EvQEBo2m187PcxoY36V7H7PGErHUW4"),
        parse_account("5CSepuULuCiDSBjeRqr9ZburDSdTwTk5ro9BgV5u1SbHiQh9"),
        parse_account("5CotZ9gD2mLLBQ6sqL2b8gRS1Vxo6HfmRcQ2iu3T825DFgSq"),
    ];

    build_struct_json_patch!(RuntimeGenesisConfig {
        balances: BalancesConfig {
            // 函数级中文注释：将全部初始发行量分配给指定地址（用户提供的 SS58），不再拆分给 root/burn。
            balances: vec![(
                parse_account("5CrDBEVDgXUwctSuV8EvQEBo2m187PcxoY36V7H7PGErHUW4"),
                total_issuance
            ),],
        },
        aura: pallet_aura::GenesisConfig {
            authorities: initial_authorities
                .iter()
                .map(|x| (x.0.clone()))
                .collect::<Vec<_>>(),
        },
        grandpa: pallet_grandpa::GenesisConfig {
            authorities: initial_authorities
                .iter()
                .map(|x| (x.1.clone(), 1))
                .collect::<Vec<_>>(),
        },
        // 函数级中文注释：初始化各委员会（Instance1/2/3）成员为指定三地址；Prime 留空。
        council: pallet_collective::GenesisConfig::<Runtime, pallet_collective::Instance1> {
            members: committee_members.clone(),
            phantom: Default::default(),
        },
        technical_committee: pallet_collective::GenesisConfig::<
            Runtime,
            pallet_collective::Instance2,
        > {
            members: committee_members.clone(),
            phantom: Default::default(),
        },
        content_committee: pallet_collective::GenesisConfig::<
            Runtime,
            pallet_collective::Instance3,
        > {
            members: committee_members.clone(),
            phantom: Default::default(),
        },
        sudo: SudoConfig { key: Some(root) },
    })
}

/// Return the development genesis config.
pub fn development_config_genesis() -> Value {
    testnet_genesis(
        vec![(
            sp_keyring::Sr25519Keyring::Alice.public().into(),
            sp_keyring::Ed25519Keyring::Alice.public().into(),
        )],
        vec![
            Sr25519Keyring::Alice.to_account_id(),
            Sr25519Keyring::Bob.to_account_id(),
            Sr25519Keyring::AliceStash.to_account_id(),
            Sr25519Keyring::BobStash.to_account_id(),
        ],
        sp_keyring::Sr25519Keyring::Alice.to_account_id(),
    )
}

/// Return the local genesis config preset.
pub fn local_config_genesis() -> Value {
    testnet_genesis(
        vec![
            (
                sp_keyring::Sr25519Keyring::Alice.public().into(),
                sp_keyring::Ed25519Keyring::Alice.public().into(),
            ),
            (
                sp_keyring::Sr25519Keyring::Bob.public().into(),
                sp_keyring::Ed25519Keyring::Bob.public().into(),
            ),
        ],
        Sr25519Keyring::iter()
            .filter(|v| v != &Sr25519Keyring::One && v != &Sr25519Keyring::Two)
            .map(|v| v.to_account_id())
            .collect::<Vec<_>>(),
        Sr25519Keyring::Alice.to_account_id(),
    )
}

/// Provides the JSON representation of predefined genesis config for given `id`.
pub fn get_preset(id: &PresetId) -> Option<Vec<u8>> {
    let patch = match id.as_ref() {
        sp_genesis_builder::DEV_RUNTIME_PRESET => development_config_genesis(),
        sp_genesis_builder::LOCAL_TESTNET_RUNTIME_PRESET => local_config_genesis(),
        _ => return None,
    };
    Some(
        serde_json::to_string(&patch)
            .expect("serialization to json is expected to work. qed.")
            .into_bytes(),
    )
}

/// List of supported presets.
pub fn preset_names() -> Vec<PresetId> {
    vec![
        PresetId::from(sp_genesis_builder::DEV_RUNTIME_PRESET),
        PresetId::from(sp_genesis_builder::LOCAL_TESTNET_RUNTIME_PRESET),
    ]
}
