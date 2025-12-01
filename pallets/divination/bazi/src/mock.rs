//! # 测试模拟环境
//!
//! 为单元测试提供模拟的运行时环境

use crate as pallet_bazi_chart;
use frame_support::{
	derive_impl,
	traits::ConstU32,
};
use sp_runtime::BuildStorage;

type Block = frame_system::mocking::MockBlock<Test>;

// 配置测试运行时
frame_support::construct_runtime!(
	pub enum Test
	{
		System: frame_system,
		BaziChart: pallet_bazi_chart,
	}
);

#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
impl frame_system::Config for Test {
	type Block = Block;
	type AccountData = ();
}

impl pallet_bazi_chart::Config for Test {
	type WeightInfo = ();
	type MaxChartsPerAccount = ConstU32<10>;
	type MaxDaYunSteps = ConstU32<12>;
	type MaxCangGan = ConstU32<3>;
}

// 构建测试用的存储
pub fn new_test_ext() -> sp_io::TestExternalities {
	let t = frame_system::GenesisConfig::<Test>::default().build_storage().unwrap();
	let mut ext = sp_io::TestExternalities::new(t);
	ext.execute_with(|| System::set_block_number(1));
	ext
}
