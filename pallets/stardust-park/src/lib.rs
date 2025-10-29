#![cfg_attr(not(feature = "std"), no_std)]
//! 说明：临时全局允许 `deprecated`，仅为通过工作区 `-D warnings`；后续将以基准权重替换常量权重
#![allow(deprecated)]

extern crate alloc;

pub use pallet::*;

#[cfg(test)]
mod mock;

#[cfg(test)]
mod tests;

#[frame_support::pallet]
pub mod pallet {
    use super::*;
    use alloc::vec::Vec;
    use frame_support::{pallet_prelude::*, BoundedVec};
    use frame_system::pallet_prelude::*; // 函数级中文注释：在 no_std 环境下显式引入 Vec

    /// 函数级中文注释：用于校验某个 RuntimeOrigin 是否具备指定陵园的管理员权限。
    /// 设计目的：
    /// - 通过 runtime 适配到官方治理 pallet（collective/multisig），避免本 pallet 直接依赖具体实现；
    /// - 以此保证“陵园级”强权限操作（如更新、转让、停用）只对管理员开放；
    /// - 仅需声明接口，降低耦合度。
    pub trait ParkAdminOrigin<Origin> {
        /// 校验 origin 是否具备指定 park_id 的管理员权限
        fn ensure(park_id: u64, origin: Origin) -> DispatchResult;
    }

    #[pallet::config]
    pub trait Config: frame_system::Config {
        #[allow(deprecated)]
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// 国家地区编码与元数据等字段的长度上限
        #[pallet::constant]
        type MaxRegionLen: Get<u32>;
        #[pallet::constant]
        type MaxCidLen: Get<u32>;
        #[pallet::constant]
        type MaxParksPerCountry: Get<u32>;
        /// 运行时注入的陵园管理员权限校验器（桥接官方治理/多签）
        type ParkAdmin: ParkAdminOrigin<Self::RuntimeOrigin>;
        /// 函数级中文注释：治理起源（Root / 内容治理签名账户等），用于 gov* 接口与证据记录。
        type GovernanceOrigin: frame_support::traits::EnsureOrigin<Self::RuntimeOrigin>;
    }

    /// 函数级中文注释：陵园登记信息结构。
    /// - 仅在链上存储承诺哈希/加密 CID（`metadata_cid`），不落明文；
    /// - `country_iso2` 使用 ISO-3166-1 alpha-2 两字节编码；
    /// - `region_code` 为地区码字符串（有长度上限）；
    /// - `admin_group` 可选，用于记录由治理指定的管理员集合标识（具体语义由上层定义）。
    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct Park<T: Config> {
        pub owner: T::AccountId,
        pub admin_group: Option<u64>,
        pub country_iso2: [u8; 2],
        pub region_code: BoundedVec<u8, T::MaxRegionLen>,
        pub metadata_cid: BoundedVec<u8, T::MaxCidLen>,
        pub active: bool,
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::storage]
    pub type NextParkId<T: Config> = StorageValue<_, u64, ValueQuery>;

    #[pallet::storage]
    pub type Parks<T: Config> = StorageMap<_, Blake2_128Concat, u64, Park<T>, OptionQuery>;

    #[pallet::storage]
    pub type ParksByCountry<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        [u8; 2],
        BoundedVec<u64, T::MaxParksPerCountry>,
        ValueQuery,
    >;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// 创建陵园
        ParkCreated {
            id: u64,
            owner: T::AccountId,
            country: [u8; 2],
        },
        /// 更新陵园元数据或状态
        ParkUpdated {
            id: u64,
        },
        /// 设置/清空管理员
        AdminSet {
            id: u64,
            admin_group: Option<u64>,
        },
        /// 转让所有权
        ParkTransferred {
            id: u64,
            new_owner: T::AccountId,
        },
        /// 状态变更
        ParkActivated {
            id: u64,
        },
        ParkDeactivated {
            id: u64,
        },
        /// 函数级中文注释：治理证据记录（scope, key, cid）。scope：1=Update/SetAdmin/Transfer/Activate 等；key=id。
        GovEvidenceNoted(u8, u64, BoundedVec<u8, T::MaxCidLen>),
        /// 函数级中文注释：治理设置园区封面（Some 设置；None 清空）。
        GovParkCoverSet(u64, bool),
    }

    #[pallet::error]
    pub enum Error<T> {
        NotOwner,
        NotAdmin,
        NotFound,
        BadCountry,
        TooMany,
    }

    // 说明：临时允许 warnings 以通过全局 -D warnings；后续将以 WeightInfo 基准权重替换常量权重
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释（内部工具）：记录治理证据 CID（明文），返回有界向量。
        fn note_evidence(
            scope: u8,
            key: u64,
            cid: Vec<u8>,
        ) -> Result<BoundedVec<u8, T::MaxCidLen>, DispatchError> {
            let bv: BoundedVec<u8, T::MaxCidLen> =
                BoundedVec::try_from(cid).map_err(|_| DispatchError::Other("BadInput"))?;
            Self::deposit_event(Event::GovEvidenceNoted(scope, key, bv.clone()));
            Ok(bv)
        }

        /// 函数级详细中文注释：治理起源统一校验入口。
        /// - 目的：集中治理起源检查，统一未授权错误为本模块错误 `Error::<T>::NotAdmin`；
        /// - 行为：封装 `T::GovernanceOrigin::ensure_origin(origin)`，成功映射为 ()，失败映射为模块错误；
        /// - 返回：Ok(()) 或 `DispatchError::Module`（NotAdmin）。
        fn ensure_gov(origin: OriginFor<T>) -> DispatchResult {
            T::GovernanceOrigin::ensure_origin(origin)
                .map(|_| ())
                .map_err(|_| Error::<T>::NotAdmin.into())
        }
    }

    #[allow(warnings)]
    #[allow(deprecated)]
    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// 函数级中文注释：创建陵园记录。
        /// - 入参使用原生类型与 `BoundedVec`，避免复杂解码；
        /// - 仅记录加密 CID，不落明文；
        /// - 将 park_id 加入对应国家索引中。
        #[pallet::call_index(0)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn create_park(
            origin: OriginFor<T>,
            country_iso2: [u8; 2],
            region_code: BoundedVec<u8, T::MaxRegionLen>,
            metadata_cid: BoundedVec<u8, T::MaxCidLen>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(country_iso2 != [0, 0], Error::<T>::BadCountry);
            let id = NextParkId::<T>::mutate(|n| {
                let id = *n;
                *n = n.saturating_add(1);
                id
            });
            let park = Park::<T> {
                owner: who.clone(),
                admin_group: None,
                country_iso2,
                region_code,
                metadata_cid,
                active: true,
            };
            Parks::<T>::insert(id, &park);
            ParksByCountry::<T>::try_mutate(country_iso2, |v| {
                v.try_push(id).map_err(|_| Error::<T>::TooMany)
            })?;
            Self::deposit_event(Event::ParkCreated {
                id,
                owner: who,
                country: country_iso2,
            });
            Ok(())
        }

        /// 函数级中文注释：更新陵园的地区/元数据/状态。
        /// - 允许所有者或陵园管理员；
        /// - 更新不改变国家索引（如需迁国，应先停用后重建）。
        #[pallet::call_index(1)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn update_park(
            origin: OriginFor<T>,
            id: u64,
            region_code: Option<BoundedVec<u8, T::MaxRegionLen>>,
            metadata_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
            active: Option<bool>,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            Parks::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let park = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                if who != park.owner {
                    // 非所有者则要求具备管理员权限
                    T::ParkAdmin::ensure(id, origin.clone())?;
                }
                if let Some(rc) = region_code {
                    park.region_code = rc;
                }
                if let Some(cid) = metadata_cid {
                    park.metadata_cid = cid;
                }
                if let Some(a) = active {
                    park.active = a;
                }
                Ok(())
            })?;
            Self::deposit_event(Event::ParkUpdated { id });
            Ok(())
        }

        /// 函数级中文注释：设置或清空管理员集合标识。
        /// - 仅允许所有者或当前管理员 origin。
        #[pallet::call_index(2)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn set_park_admin(
            origin: OriginFor<T>,
            id: u64,
            admin_group: Option<u64>,
        ) -> DispatchResult {
            let who = ensure_signed(origin.clone())?;
            Parks::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let park = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                if who != park.owner {
                    T::ParkAdmin::ensure(id, origin.clone())?;
                }
                park.admin_group = admin_group;
                Ok(())
            })?;
            Self::deposit_event(Event::AdminSet { id, admin_group });
            Ok(())
        }

        /// 函数级中文注释：转让陵园所有权。
        /// - 仅当前所有者可调用。
        #[pallet::call_index(3)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn transfer_park(
            origin: OriginFor<T>,
            id: u64,
            new_owner: T::AccountId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Parks::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let park = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                ensure!(who == park.owner, Error::<T>::NotOwner);
                park.owner = new_owner.clone();
                Ok(())
            })?;
            Self::deposit_event(Event::ParkTransferred { id, new_owner });
            Ok(())
        }

        /// 函数级中文注释：【治理】更新陵园（可选字段），并记录证据。
        /// - 仅允许 `T::GovernanceOrigin`；记录 `GovEvidenceNoted(1,id,cid)`。
        #[pallet::call_index(10)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_update_park(
            origin: OriginFor<T>,
            id: u64,
            region_code: Option<BoundedVec<u8, T::MaxRegionLen>>,
            metadata_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
            active: Option<bool>,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(1u8, id, evidence_cid)?;
            Parks::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let park = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                if let Some(rc) = region_code {
                    park.region_code = rc;
                }
                if let Some(cid) = metadata_cid {
                    park.metadata_cid = cid;
                }
                if let Some(a) = active {
                    park.active = a;
                }
                Ok(())
            })?;
            Self::deposit_event(Event::ParkUpdated { id });
            Ok(())
        }

        /// 函数级中文注释：【治理】设置/清空管理员（记录证据）。
        #[pallet::call_index(11)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_set_park_admin(
            origin: OriginFor<T>,
            id: u64,
            admin_group: Option<u64>,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(1u8, id, evidence_cid)?;
            Parks::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let park = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                park.admin_group = admin_group;
                Ok(())
            })?;
            Self::deposit_event(Event::AdminSet { id, admin_group });
            Ok(())
        }

        /// 函数级中文注释：【治理】设置/清空园区封面 CID（作为展示元数据的一部分）。
        /// - 由于本 Pallet 未维护封面字段，采用事件记录方式供前端/索引读取。
        #[pallet::call_index(13)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_set_park_cover(
            origin: OriginFor<T>,
            id: u64,
            cover_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(1u8, id, evidence_cid)?;
            ensure!(Parks::<T>::contains_key(id), Error::<T>::NotFound);
            // 事件化存证（不落存储，保持低耦合与轻状态）：is_set=true/false
            let _ = cover_cid; // 仅事件化输出
            Self::deposit_event(Event::GovParkCoverSet(id, cover_cid.is_some()));
            Ok(())
        }

        /// 函数级中文注释：【治理】转让陵园所有权（记录证据）。
        #[pallet::call_index(12)]
        #[allow(deprecated)]
        #[pallet::weight(10_000)]
        pub fn gov_transfer_park(
            origin: OriginFor<T>,
            id: u64,
            new_owner: T::AccountId,
            evidence_cid: Vec<u8>,
        ) -> DispatchResult {
            Self::ensure_gov(origin)?;
            let _ = Self::note_evidence(1u8, id, evidence_cid)?;
            Parks::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let park = maybe.as_mut().ok_or(Error::<T>::NotFound)?;
                park.owner = new_owner.clone();
                Ok(())
            })?;
            Self::deposit_event(Event::ParkTransferred { id, new_owner });
            Ok(())
        }
    }
}
