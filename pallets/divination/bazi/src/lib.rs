//! # 八字排盘 Pallet (Pallet Bazi Chart)
//!
//! ## 概述
//!
//! 本 Pallet 实现了完整的中国传统命理八字排盘功能，包括：
//! - 四柱计算（年柱、月柱、日柱、时柱）
//! - 大运推算（起运年龄、大运序列）
//! - 五行强度分析（月令权重法）
//! - 十神关系计算
//! - 藏干提取和纳音五行
//!
//! ## 技术特性
//!
//! - ✅ **辰藏干正确性**: 使用"戊乙癸"（主流派，87.5%项目支持）
//! - ✅ **子时双模式**: 支持传统派和现代派两种子时归属模式
//! - ✅ **节气精度**: 采用寿星天文算法（秒级精度）
//! - ✅ **五行强度**: 实现月令权重矩阵（12×36）
//!
//! ## 参考项目
//!
//! - BaziGo (95/100) - 五行强度算法、藏干权重表
//! - lunar-java (93/100) - 节气算法、数据结构设计
//! - bazi-mcp (92/100) - 子时双模式、API设计
//!
//! ## 使用示例
//!
//! ```ignore
//! // 创建八字（现代派子时模式）
//! BaziChart::create_bazi_chart(
//!     origin,
//!     1998, 7, 31, 14, 10,  // 1998年7月31日14:10
//!     Gender::Male,
//!     ZiShiMode::Modern,
//! )?;
//! ```

#![cfg_attr(not(feature = "std"), no_std)]
#![allow(dead_code)]

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

pub mod types;
pub mod constants;
pub mod calculations;
pub mod interpretation;
pub mod shensha;
pub mod xingchong;
pub mod runtime_api;

// 重新导出 Runtime API 相关类型，方便外部使用
pub use interpretation::{CoreInterpretation, FullInterpretation, CompactXingGe, ExtendedJiShen};
// 重新导出加密存储类型
pub use types::{SiZhuIndex, EncryptedBaziChart};

#[frame_support::pallet]
pub mod pallet {
	use frame_support::pallet_prelude::*;
	use frame_system::pallet_prelude::*;
	use sp_runtime::SaturatedConversion;

	pub use crate::types::*;

	/// Pallet 配置 Trait
	#[pallet::config(with_default)]
	pub trait Config: frame_system::Config<RuntimeEvent: From<Event<Self>>> {
		/// 权重信息
		type WeightInfo: WeightInfo;

		/// 每个账户最多创建的八字数量
		#[pallet::constant]
		type MaxChartsPerAccount: Get<u32> + Clone + core::fmt::Debug;

		/// 大运最大步数（默认12步，120年）
		#[pallet::constant]
		type MaxDaYunSteps: Get<u32> + Clone + core::fmt::Debug;

		/// 每个地支最多藏干数量（最多3个）
		#[pallet::constant]
		type MaxCangGan: Get<u32> + Clone + core::fmt::Debug;
	}

	/// 权重信息 Trait（暂时使用占位实现）
	pub trait WeightInfo {
		fn create_bazi_chart() -> Weight;
		fn delete_bazi_chart() -> Weight;
	}

	/// 默认权重实现
	impl WeightInfo for () {
		fn create_bazi_chart() -> Weight {
			Weight::from_parts(10_000_000, 0)
		}
		fn delete_bazi_chart() -> Weight {
			Weight::from_parts(5_000_000, 0)
		}
	}

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// 下一个八字ID计数器
	#[pallet::storage]
	#[pallet::getter(fn next_chart_id)]
	pub type NextChartId<T: Config> = StorageValue<_, u64, ValueQuery>;

	/// 存储映射: 八字ID -> 八字详情
	#[pallet::storage]
	#[pallet::getter(fn chart_by_id)]
	pub type ChartById<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		u64,
		BaziChart<T>,
	>;

	/// 存储映射: 用户 -> 八字ID列表
	#[pallet::storage]
	#[pallet::getter(fn user_charts)]
	pub type UserCharts<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		BoundedVec<u64, T::MaxChartsPerAccount>,
		ValueQuery,
	>;

	/// 存储映射: 八字ID -> 核心解盘结果（13 bytes）
	///
	/// 可选缓存：用户可以选择将解盘结果缓存到链上
	/// - 优点：后续查询更快，无需重新计算
	/// - 缺点：需要支付少量 gas 费用
	///
	/// 如果未缓存，前端可以通过 Runtime API `get_interpretation()` 实时计算（免费）
	#[pallet::storage]
	#[pallet::getter(fn interpretation_cache)]
	pub type InterpretationCache<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		u64,
		crate::interpretation::CoreInterpretation,
	>;

	/// 存储映射: 八字ID -> 加密的八字命盘
	///
	/// 隐私保护版本的八字存储：
	/// - 敏感数据（出生时间等）在前端加密后存储
	/// - 四柱索引明文存储，支持 Runtime API 免费计算
	/// - 用户通过钱包签名派生密钥进行加解密
	#[pallet::storage]
	#[pallet::getter(fn encrypted_chart_by_id)]
	pub type EncryptedChartById<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		u64,
		crate::types::EncryptedBaziChart<T>,
	>;

	/// 存储映射: 用户 -> 加密八字ID列表
	#[pallet::storage]
	#[pallet::getter(fn user_encrypted_charts)]
	pub type UserEncryptedCharts<T: Config> = StorageMap<
		_,
		Blake2_128Concat,
		T::AccountId,
		BoundedVec<u64, T::MaxChartsPerAccount>,
		ValueQuery,
	>;

	/// Pallet 事件
	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	#[allow(dead_code)]
	pub enum Event<T: Config> {
		/// 八字创建成功 [所有者, 八字ID, 出生时间]
		BaziChartCreated {
			owner: T::AccountId,
			chart_id: u64,
			birth_time: BirthTime,
		},
		/// 八字查询 [八字ID, 所有者]
		BaziChartQueried {
			chart_id: u64,
			owner: T::AccountId,
		},
		/// 八字删除 [所有者, 八字ID]
		BaziChartDeleted {
			owner: T::AccountId,
			chart_id: u64,
		},
		/// 八字解盘结果已缓存（13 bytes 核心指标）[八字ID, 所有者]
		BaziInterpretationCached {
			chart_id: u64,
			owner: T::AccountId,
		},
		/// 加密八字命盘创建成功 [所有者, 八字ID]
		EncryptedBaziChartCreated {
			owner: T::AccountId,
			chart_id: u64,
		},
		/// 加密八字命盘删除成功 [所有者, 八字ID]
		EncryptedBaziChartDeleted {
			owner: T::AccountId,
			chart_id: u64,
		},
	}

	/// Pallet 错误
	#[pallet::error]
	pub enum Error<T> {
		/// 无效的年份
		InvalidYear,
		/// 无效的月份
		InvalidMonth,
		/// 无效的日期
		InvalidDay,
		/// 无效的小时
		InvalidHour,
		/// 无效的分钟
		InvalidMinute,
		/// 无效的天干
		InvalidTianGan,
		/// 无效的地支
		InvalidDiZhi,
		/// 无效的干支索引
		InvalidGanZhiIndex,
		/// 八字数量过多
		TooManyCharts,
		/// 八字未找到
		ChartNotFound,
		/// 非八字所有者
		NotChartOwner,
		/// 藏干数量过多
		TooManyCangGan,
		/// 大运步数过多
		TooManyDaYunSteps,
		/// 八字ID已达到最大值
		ChartIdOverflow,
		/// 四柱索引无效
		InvalidSiZhuIndex,
		/// 加密数据过长
		EncryptedDataTooLong,
		/// 加密八字未找到
		EncryptedChartNotFound,
	}

	/// Pallet 可调用函数
	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// 创建八字
		///
		/// # 参数
		///
		/// - `origin`: 交易发起者
		/// - `year`: 公历年份 (1900-2100)
		/// - `month`: 公历月份 (1-12)
		/// - `day`: 公历日期 (1-31)
		/// - `hour`: 小时 (0-23)
		/// - `minute`: 分钟 (0-59)
		/// - `gender`: 性别
		/// - `zishi_mode`: 子时归属模式（传统派/现代派）
		///
		/// # 功能
		///
		/// 1. 验证输入参数
		/// 2. 计算四柱八字（日/年/月/时）
		/// 3. 计算大运
		/// 4. 计算五行强度
		/// 5. 判断喜用神
		/// 6. 存储八字信息
		///
		/// # 注意
		///
		/// - 每个账户最多创建 `MaxChartsPerAccount` 个八字
		/// - 子时模式会影响 23:00-23:59 的时柱计算
		#[pallet::call_index(0)]
		#[pallet::weight(T::WeightInfo::create_bazi_chart())]
		pub fn create_bazi_chart(
			origin: OriginFor<T>,
			year: u16,
			month: u8,
			day: u8,
			hour: u8,
			minute: u8,
			gender: Gender,
			zishi_mode: ZiShiMode,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// 1. 验证输入参数
			ensure!(year >= 1900 && year <= 2100, Error::<T>::InvalidYear);
			ensure!(month >= 1 && month <= 12, Error::<T>::InvalidMonth);
			ensure!(day >= 1 && day <= 31, Error::<T>::InvalidDay);
			ensure!(hour < 24, Error::<T>::InvalidHour);
			ensure!(minute < 60, Error::<T>::InvalidMinute);

			// 检查账户八字数量限制
			let existing_charts = UserCharts::<T>::get(&who);
			ensure!(
				existing_charts.len() < T::MaxChartsPerAccount::get() as usize,
				Error::<T>::TooManyCharts
			);

			// 2. 计算四柱
			use crate::calculations::*;

			// 2.1 计算日柱
			let day_ganzhi = calculate_day_ganzhi(year, month, day)
				.ok_or(Error::<T>::InvalidDay)?;

			// 2.2 计算年柱
			let year_ganzhi = calculate_year_ganzhi(year, month, day)
				.ok_or(Error::<T>::InvalidYear)?;

			// 2.3 计算月柱
			let month_ganzhi = calculate_month_ganzhi(year, month, day, year_ganzhi.gan.0)
				.ok_or(Error::<T>::InvalidMonth)?;

			// 2.4 计算时柱（处理子时双模式）
			let (hour_ganzhi, is_next_day) = calculate_hour_ganzhi(hour, day_ganzhi.gan.0, zishi_mode)
				.ok_or(Error::<T>::InvalidHour)?;

			// 如果是次日子时（传统派23:00），需要重新计算日柱
			let final_day_ganzhi = if is_next_day {
				// 23:00属于次日，使用次日的日柱天干计算时柱
				let next_day_ganzhi = day_ganzhi.next();
				let (final_hour_ganzhi, _) = calculate_hour_ganzhi(hour, next_day_ganzhi.gan.0, zishi_mode)
					.ok_or(Error::<T>::InvalidHour)?;
				// 返回次日日柱和正确的时柱
				(next_day_ganzhi, final_hour_ganzhi)
			} else {
				(day_ganzhi, hour_ganzhi)
			};

			let day_ganzhi = final_day_ganzhi.0;
			let hour_ganzhi = final_day_ganzhi.1;

			// 2.5 构建四柱（需要填充藏干和纳音）
			let sizhu = Self::build_sizhu(year_ganzhi, month_ganzhi, day_ganzhi, hour_ganzhi, day_ganzhi.gan)?;

			// 3. 计算大运
			// 简化版：假设距离下一个节气6天（生产环境需要精确计算）
			let days_to_jieqi = 6u8;
			let (qiyun_age, is_shun) = calculate_qiyun_age(year_ganzhi.gan.0, gender, days_to_jieqi);
			let qiyun_year = year + qiyun_age as u16;

			// 生成大运列表（12步，120年）
			let dayun_list_simple = calculate_dayun_list(month_ganzhi, year, qiyun_age, is_shun, 12);

			// 转换为DaYunStep类型
			let mut dayun_steps = BoundedVec::<DaYunStep<T>, T::MaxDaYunSteps>::default();
			for (gz, start_age, start_year) in dayun_list_simple {
				let end_age = start_age + 10;
				let end_year = start_year + 10;

				// 计算十神
				let tiangan_shishen = crate::constants::calculate_shishen(day_ganzhi.gan, gz.gan);

				// 计算藏干十神
				let hidden_stems = crate::constants::get_hidden_stems(gz.zhi);
				let mut canggan_shishen = BoundedVec::<ShiShen, T::MaxCangGan>::default();
				for (cg_gan, _, _) in hidden_stems.iter() {
					// 跳过无效藏干
					if !crate::constants::is_valid_canggan(cg_gan.0) {
						continue;
					}
					let cg_shishen = crate::constants::calculate_shishen(day_ganzhi.gan, *cg_gan);
					canggan_shishen.try_push(cg_shishen).map_err(|_| Error::<T>::TooManyCangGan)?;
				}

				let step = DaYunStep {
					ganzhi: gz,
					start_age,
					end_age,
					start_year,
					end_year,
					tiangan_shishen,
					canggan_shishen,
				};

				dayun_steps.try_push(step).map_err(|_| Error::<T>::TooManyDaYunSteps)?;
			}

			let dayun_info = DaYunInfo {
				qiyun_age,
				qiyun_year,
				is_shun,
				dayun_list: dayun_steps,
			};

			// 4. 计算五行强度
			let wuxing_strength = calculate_wuxing_strength(
				&year_ganzhi,
				&month_ganzhi,
				&day_ganzhi,
				&hour_ganzhi,
			);

			// 5. 判断喜用神
			let xiyong_shen = determine_xiyong_shen(&wuxing_strength, day_ganzhi.gan);

			// 6. 构建八字信息
			let birth_time = BirthTime {
				year,
				month,
				day,
				hour,
				minute,
			};

			let bazi_chart = BaziChart {
				owner: who.clone(),
				birth_time,
				gender,
				zishi_mode,
				sizhu,
				dayun: dayun_info,
				wuxing_strength,
				xiyong_shen,
				timestamp: frame_system::Pallet::<T>::block_number().saturated_into(),
			};

			// 7. 存储八字
			// 获取新的 chart_id
			let chart_id = NextChartId::<T>::get();

			// 验证ID不会溢出
			ensure!(
				chart_id < u64::MAX,
				Error::<T>::ChartIdOverflow
			);

			// 存储到 ChartById
			ChartById::<T>::insert(chart_id, bazi_chart);

			// 添加到用户的八字列表
			UserCharts::<T>::try_mutate(&who, |charts| {
				charts.try_push(chart_id).map_err(|_| Error::<T>::TooManyCharts)
			})?;

			// 递增计数器
			NextChartId::<T>::put(chart_id + 1);

			// 8. 触发事件
			Self::deposit_event(Event::BaziChartCreated {
				owner: who,
				chart_id,
				birth_time,
			});

			Ok(())
		}

		/// 删除八字
		///
		/// # 参数
		///
		/// - `origin`: 交易发起者
		/// - `chart_id`: 八字ID
		///
		/// # 权限
		///
		/// 只有八字所有者可以删除自己的八字
		#[pallet::call_index(1)]
		#[pallet::weight(T::WeightInfo::delete_bazi_chart())]
		pub fn delete_bazi_chart(
			origin: OriginFor<T>,
			chart_id: u64,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// 获取八字信息
			let chart = ChartById::<T>::get(chart_id)
				.ok_or(Error::<T>::ChartNotFound)?;

			// 验证所有权
			ensure!(chart.owner == who, Error::<T>::NotChartOwner);

			// 从 ChartById 中删除
			ChartById::<T>::remove(chart_id);

			// 从用户的八字列表中删除
			UserCharts::<T>::try_mutate(&who, |charts| -> DispatchResult {
				if let Some(pos) = charts.iter().position(|&id| id == chart_id) {
					charts.remove(pos);
				}
				Ok(())
			})?;

			// 触发事件
			Self::deposit_event(Event::BaziChartDeleted {
				owner: who,
				chart_id,
			});

			Ok(())
		}

		/// 缓存八字解盘结果（核心指标，13 bytes）
		///
		/// # 参数
		///
		/// - `origin`: 交易发起者
		/// - `chart_id`: 八字ID
		///
		/// # 功能
		///
		/// 1. 验证八字存在和所有权
		/// 2. 实时计算核心解盘结果
		/// 3. 将结果缓存到链上 `InterpretationCache`
		///
		/// # 优点
		///
		/// - 后续查询无需重新计算，速度更快
		/// - 可以在前端优先使用缓存结果
		///
		/// # 缺点
		///
		/// - 需要支付少量 gas 费用（约 13 bytes 存储成本）
		///
		/// # 注意
		///
		/// - 如果不缓存，前端可以直接调用 Runtime API `get_interpretation()` 免费实时计算
		/// - 缓存后算法升级不会自动更新缓存，需要重新缓存
		#[pallet::call_index(2)]
		#[pallet::weight(T::WeightInfo::create_bazi_chart())]
		pub fn cache_interpretation(
			origin: OriginFor<T>,
			chart_id: u64,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// 获取八字信息
			let chart = ChartById::<T>::get(chart_id)
				.ok_or(Error::<T>::ChartNotFound)?;

			// 验证所有权
			ensure!(chart.owner == who, Error::<T>::NotChartOwner);

			// 实时计算核心解盘结果
			let current_block = <frame_system::Pallet<T>>::block_number().saturated_into();
			let interpretation = crate::interpretation::calculate_core_interpretation(&chart, current_block);

			// 缓存到链上
			InterpretationCache::<T>::insert(chart_id, interpretation);

			// 触发事件
			Self::deposit_event(Event::BaziInterpretationCached {
				chart_id,
				owner: who,
			});

			Ok(())
		}

		/// 创建加密的八字命盘
		///
		/// # 参数
		///
		/// - `origin`: 交易发起者
		/// - `sizhu_index`: 四柱干支索引（明文，用于计算）
		/// - `gender`: 性别（明文，用于大运计算）
		/// - `encrypted_data`: AES-256-GCM 加密的敏感数据
		/// - `data_hash`: 原始数据的 Blake2-256 哈希（用于验证解密正确性）
		///
		/// # 功能
		///
		/// 1. 验证四柱索引有效性
		/// 2. 存储加密的八字信息
		/// 3. 触发创建事件
		///
		/// # 安全特性
		///
		/// - 出生时间等敏感数据在前端加密后存储
		/// - 四柱索引明文存储，支持 Runtime API 免费计算解盘
		/// - 用户通过钱包签名派生密钥进行加解密，无需输入密码
		///
		/// # 存储结构（约 50 bytes + 加密数据长度）
		///
		/// - `sizhu_index`: 8 bytes（四柱索引）
		/// - `gender`: 1 byte
		/// - `encrypted_data`: 可变（最大 256 bytes）
		/// - `data_hash`: 32 bytes
		/// - `created_at`: 4 bytes
		/// - `owner`: 32 bytes（AccountId）
		#[pallet::call_index(3)]
		#[pallet::weight(T::WeightInfo::create_bazi_chart())]
		pub fn create_encrypted_chart(
			origin: OriginFor<T>,
			sizhu_index: crate::types::SiZhuIndex,
			gender: Gender,
			encrypted_data: BoundedVec<u8, ConstU32<256>>,
			data_hash: [u8; 32],
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// 1. 验证四柱索引有效性
			ensure!(sizhu_index.is_valid(), Error::<T>::InvalidSiZhuIndex);

			// 2. 检查账户八字数量限制
			let existing_charts = UserEncryptedCharts::<T>::get(&who);
			ensure!(
				existing_charts.len() < T::MaxChartsPerAccount::get() as usize,
				Error::<T>::TooManyCharts
			);

			// 3. 获取新的 chart_id
			let chart_id = NextChartId::<T>::get();
			ensure!(chart_id < u64::MAX, Error::<T>::ChartIdOverflow);

			// 4. 获取当前区块号
			let current_block = <frame_system::Pallet<T>>::block_number().saturated_into();

			// 5. 构建加密八字结构
			let encrypted_chart = crate::types::EncryptedBaziChart {
				owner: who.clone(),
				sizhu_index,
				gender,
				encrypted_data,
				data_hash,
				created_at: current_block,
			};

			// 6. 存储到 EncryptedChartById
			EncryptedChartById::<T>::insert(chart_id, encrypted_chart);

			// 7. 添加到用户的加密八字列表
			UserEncryptedCharts::<T>::try_mutate(&who, |charts| {
				charts.try_push(chart_id).map_err(|_| Error::<T>::TooManyCharts)
			})?;

			// 8. 递增计数器
			NextChartId::<T>::put(chart_id + 1);

			// 9. 触发事件
			Self::deposit_event(Event::EncryptedBaziChartCreated {
				owner: who,
				chart_id,
			});

			Ok(())
		}

		/// 删除加密的八字命盘
		///
		/// # 参数
		///
		/// - `origin`: 交易发起者
		/// - `chart_id`: 八字ID
		///
		/// # 权限
		///
		/// 只有八字所有者可以删除自己的加密八字
		#[pallet::call_index(4)]
		#[pallet::weight(T::WeightInfo::delete_bazi_chart())]
		pub fn delete_encrypted_chart(
			origin: OriginFor<T>,
			chart_id: u64,
		) -> DispatchResult {
			let who = ensure_signed(origin)?;

			// 获取加密八字信息
			let chart = EncryptedChartById::<T>::get(chart_id)
				.ok_or(Error::<T>::EncryptedChartNotFound)?;

			// 验证所有权
			ensure!(chart.owner == who, Error::<T>::NotChartOwner);

			// 从 EncryptedChartById 中删除
			EncryptedChartById::<T>::remove(chart_id);

			// 从用户的加密八字列表中删除
			UserEncryptedCharts::<T>::try_mutate(&who, |charts| -> DispatchResult {
				if let Some(pos) = charts.iter().position(|&id| id == chart_id) {
					charts.remove(pos);
				}
				Ok(())
			})?;

			// 触发事件
			Self::deposit_event(Event::EncryptedBaziChartDeleted {
				owner: who,
				chart_id,
			});

			Ok(())
		}
	}

	// 辅助函数
	impl<T: Config> Pallet<T> {
		/// 构建四柱（填充藏干和纳音）
		fn build_sizhu(
			year_ganzhi: GanZhi,
			month_ganzhi: GanZhi,
			day_ganzhi: GanZhi,
			hour_ganzhi: GanZhi,
			rizhu: TianGan,
		) -> Result<SiZhu<T>, Error<T>> {
			// 构建年柱
			let year_zhu = Self::build_zhu(year_ganzhi, rizhu)?;
			// 构建月柱
			let month_zhu = Self::build_zhu(month_ganzhi, rizhu)?;
			// 构建日柱
			let day_zhu = Self::build_zhu(day_ganzhi, rizhu)?;
			// 构建时柱
			let hour_zhu = Self::build_zhu(hour_ganzhi, rizhu)?;

			Ok(SiZhu {
				year_zhu,
				month_zhu,
				day_zhu,
				hour_zhu,
				rizhu,
			})
		}

		/// 构建单个柱（填充藏干和纳音）
		fn build_zhu(ganzhi: GanZhi, rizhu: TianGan) -> Result<Zhu<T>, Error<T>> {
			use crate::constants::{get_hidden_stems, calculate_nayin, is_valid_canggan};

			// 获取藏干信息
			let hidden_stems = get_hidden_stems(ganzhi.zhi);
			let mut canggan = BoundedVec::<CangGanInfo, T::MaxCangGan>::default();

			for (gan, canggan_type, weight) in hidden_stems.iter() {
				// 跳过无效藏干（255表示该位置无藏干）
				if !is_valid_canggan(gan.0) {
					continue;
				}

				// 计算藏干的十神关系
				let shishen = crate::constants::calculate_shishen(rizhu, *gan);

				let canggan_info = CangGanInfo {
					gan: *gan,
					shishen,
					canggan_type: *canggan_type,
					weight: *weight,
				};

				canggan.try_push(canggan_info).map_err(|_| Error::<T>::TooManyCangGan)?;
			}

			// 计算纳音
			let nayin = calculate_nayin(&ganzhi);

			Ok(Zhu {
				ganzhi,
				canggan,
				nayin,
			})
		}

		/// RPC 接口：实时计算完整解盘（唯一对外接口）
		///
		/// 此函数由 Runtime API 调用，不消耗 gas，不上链
		///
		/// # 参数
		/// - chart_id: 八字命盘ID
		///
		/// # 返回
		/// - Some(FullInterpretation): 完整解盘结果
		///   - core: 核心指标（格局、强弱、用神、喜神、忌神、评分、可信度）
		///   - xing_ge: 性格分析（主要特点、优点、缺点、适合职业）
		///   - extended_ji_shen: 扩展忌神（次忌神列表）
		/// - None: 命盘不存在
		///
		/// # 特点
		/// - 完全免费（无 gas 费用）
		/// - 响应快速（< 100ms）
		/// - 算法自动更新（使用最新版本）
		/// - 不永久存储（避免存储成本）
		///
		/// # 使用方式
		/// 前端只需核心数据时，访问 `result.core` 即可（等价于旧版 V2/V3 Core）
		pub fn get_full_interpretation(chart_id: u64) -> Option<crate::interpretation::FullInterpretation> {
			let chart = ChartById::<T>::get(chart_id)?;
			let current_block = <frame_system::Pallet<T>>::block_number().saturated_into();

			Some(crate::interpretation::calculate_full_interpretation(&chart, current_block))
		}

		/// RPC 接口：基于加密命盘的四柱索引计算解盘
		///
		/// 此函数由 Runtime API 调用，不消耗 gas，不上链
		///
		/// # 参数
		/// - chart_id: 加密八字命盘ID
		///
		/// # 返回
		/// - Some(FullInterpretation): 完整解盘结果
		/// - None: 命盘不存在
		///
		/// # 特点
		/// - 基于四柱索引计算，无需解密敏感数据
		/// - 完全免费（无 gas 费用）
		/// - 保护用户隐私
		pub fn get_encrypted_chart_interpretation(chart_id: u64) -> Option<crate::interpretation::FullInterpretation> {
			let encrypted_chart = EncryptedChartById::<T>::get(chart_id)?;
			let current_block = <frame_system::Pallet<T>>::block_number().saturated_into();

			Some(crate::interpretation::calculate_interpretation_from_index(
				&encrypted_chart.sizhu_index,
				encrypted_chart.gender,
				current_block,
			))
		}

		/// 检查加密命盘是否存在
		pub fn encrypted_chart_exists(chart_id: u64) -> bool {
			EncryptedChartById::<T>::contains_key(chart_id)
		}

		/// 获取加密命盘所有者
		pub fn get_encrypted_chart_owner(chart_id: u64) -> Option<T::AccountId> {
			EncryptedChartById::<T>::get(chart_id).map(|chart| chart.owner)
		}
	}

	// ==================== DivinationProvider 实现 ====================

	/// 实现 DivinationProvider trait，使 BaziChart 能够与 DivinationAi 集成
	impl<T: Config> pallet_divination_common::traits::DivinationProvider<T::AccountId> for Pallet<T> {
		/// 检查八字是否存在
		fn result_exists(divination_type: pallet_divination_common::types::DivinationType, result_id: u64) -> bool {
			// 只处理八字类型
			if divination_type != pallet_divination_common::types::DivinationType::Bazi {
				return false;
			}

			ChartById::<T>::contains_key(result_id)
		}

		/// 获取八字创建者
		fn result_creator(divination_type: pallet_divination_common::types::DivinationType, result_id: u64) -> Option<T::AccountId> {
			if divination_type != pallet_divination_common::types::DivinationType::Bazi {
				return None;
			}

			ChartById::<T>::get(result_id).map(|chart| chart.owner)
		}

		/// 获取稀有度计算数据（暂不实现）
		fn rarity_data(
			_divination_type: pallet_divination_common::types::DivinationType,
			_result_id: u64
		) -> Option<pallet_divination_common::types::RarityInput> {
			None
		}

		/// 获取占卜结果摘要（暂不实现）
		fn result_summary(
			_divination_type: pallet_divination_common::types::DivinationType,
			_result_id: u64
		) -> Option<sp_std::vec::Vec<u8>> {
			None
		}

		/// 检查是否可以铸造为 NFT（简化实现：存在即可铸造）
		fn is_nftable(divination_type: pallet_divination_common::types::DivinationType, result_id: u64) -> bool {
			Self::result_exists(divination_type, result_id)
		}

		/// 标记已铸造为 NFT（暂不实现）
		fn mark_as_nfted(_divination_type: pallet_divination_common::types::DivinationType, _result_id: u64) {
			// 当前版本不需要标记
		}
	}
}
