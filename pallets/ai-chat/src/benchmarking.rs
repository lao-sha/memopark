//! # Benchmarking for Pallet AI Chat

#![cfg(feature = "runtime-benchmarks")]

use super::*;
use frame_benchmarking::{benchmarks, whitelisted_caller};
use frame_system::RawOrigin;

#[allow(unused)]
use crate::Pallet as AIChat;

benchmarks! {
    // TODO: 实现benchmarking
    // 参考: https://docs.substrate.io/reference/how-to-guides/weights/add-benchmarks/
}
