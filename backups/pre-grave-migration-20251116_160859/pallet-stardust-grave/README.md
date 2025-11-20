# Pallet Stardust Grave

## 模块概述

墓地管理系统，提供完整的墓位生命周期管理功能，是Stardust纪念平台的核心模块之一。该模块支持墓位创建、安葬管理、准入控制、成员权限、关注系统、内容管理等核心功能。

## 核心功能

### 1. 墓位生命周期管理

#### 1.1 墓位创建
- **收费机制**: 支持一次性创建费用，由`CreateFee`常量配置
- **园区归属**: 墓位可以隶属于特定陵园(`park_id`)
- **所有权**: 明确的墓主(`owner`)机制
- **唯一标识**: 自动生成10位数字Slug便于访问

```rust
pub fn create_grave(
    origin: OriginFor<T>,
    park_id: Option<u64>,
    name: BoundedVec<u8, T::MaxCidLen>,
) -> DispatchResult
```

#### 1.2 墓位状态管理
- **激活/停用**: 控制墓位的可访问性
- **可见性控制**: 公开(`is_public`)或私有访问
- **转让机制**: 支持墓位所有权转让
- **园区管理**: 支持园区间墓位迁移

### 2. 安葬与起掘系统

#### 2.1 安葬流程
- **逝者安葬**: 将逝者记录绑定到墓位特定槽位(`slot`)
- **安葬记录**: 记录安葬时间、备注CID等元数据
- **主逝者索引**: 自动维护墓位的主逝者指向，便于快速查询
- **回调机制**: 支持`OnInterment`钩子进行业务联动

```rust
pub fn inter(
    origin: OriginFor<T>,
    grave_id: u64,
    deceased_id: u64,
    slot: u16,
    note_cid: Option<BoundedVec<u8, T::MaxCidLen>>,
) -> DispatchResult
```

#### 2.2 起掘机制
- **逝者移除**: 从墓位移除特定逝者
- **主逝者维护**: 移除主逝者时自动选择新的主逝者
- **状态清理**: 自动清理相关索引和记录

### 3. 准入策略管理（Phase 1.5新增）

解决P0问题：防止逝者强行挤入私人墓位。

#### 3.1 策略类型
- **OwnerOnly（默认）**: 仅墓主可以迁入自己创建的逝者
- **Public**: 任何人都可以将逝者迁入该墓位
- **Whitelist**: 仅白名单中的账户可以迁入逝者

```rust
pub enum GraveAdmissionPolicy {
    OwnerOnly,   // 仅墓主控制（默认）
    Public,      // 公开墓位
    Whitelist,   // 白名单模式
}
```

#### 3.2 白名单管理
- **添加白名单**: `add_to_admission_whitelist`
- **移除白名单**: `remove_from_admission_whitelist`
- **权限检查**: 与`pallet-deceased`的`transfer_deceased`集成

### 4. 成员与权限管理

#### 4.1 加入策略
- **Open模式**: 自动成为成员，可直接留言/供奉
- **Whitelist模式**: 需要申请并获得墓主批准

#### 4.2 管理员系统
- **管理员列表**: 最多`MaxAdminsPerGrave`个管理员（不含墓主）
- **权限继承**: 管理员可执行部分墓主操作
- **统一授权**: 提供给其他模块（如`pallet-deceased`）的权限查询接口

### 5. 关注系统

#### 5.1 关注机制
- **关注墓位**: 用户可以关注感兴趣的墓位
- **取关功能**: 支持取消关注
- **冷却机制**: 防止频繁关注/取关操作，由`FollowCooldownBlocks`控制

#### 5.2 押金系统
- **关注押金**: 可选的关注押金机制，由`FollowDeposit`配置
- **自动释放**: 取关时自动释放押金
- **防刷保护**: 防止恶意刷关注行为

#### 5.3 黑名单管理
- **拉黑机制**: 墓主可以拉黑特定用户
- **关注限制**: 被拉黑用户无法关注该墓位

### 6. 内容管理系统

#### 6.1 封面管理
- **公共封面目录**: 全局封面选项，由治理管理
- **自定义封面**: 墓主可设置自定义封面CID
- **治理控制**: 支持治理起源修改封面内容

#### 6.2 音频系统
- **背景音乐**: 墓位可设置背景音频CID
- **公共音频目录**: 全局音频选项库
- **私有音频候选**: 墓主维护的私有音频选项
- **播放列表**: 支持多音频按序播放

#### 6.3 IPFS集成
- **自动Pin**: 集成`pallet-stardust-ipfs`自动固定音频CID
- **存储费用**: 自动计算并支付IPFS存储费用
- **失败容错**: Pin失败时记录警告但不阻断操作

### 7. 首页轮播管理

#### 7.1 轮播图管理
- **全局轮播**: 治理可管理首页轮播图
- **内容结构**: 支持图片CID、标题、链接等元数据
- **容量控制**: 最多`MaxCarouselItems`个轮播项

### 8. 投诉与审核系统

#### 8.1 投诉机制
- **投诉提交**: 用户可对墓位内容提交投诉
- **投诉记录**: 记录投诉者、投诉内容CID、时间等
- **容量限制**: 每墓位最多`MaxComplaintsPerGrave`个投诉

#### 8.2 审核状态
- **限制状态**: 可将墓位设为受限状态
- **移除标记**: 可将墓位标记为已移除
- **原因代码**: 记录限制/移除的具体原因

## 数据结构

### 核心结构

```rust
// 墓位信息
pub struct Grave<T: Config> {
    pub park_id: Option<u64>,                    // 所属园区ID
    pub owner: T::AccountId,                     // 墓主账户
    pub admin_group: Option<u64>,                // 管理组ID（预留）
    pub name: BoundedVec<u8, T::MaxCidLen>,      // 名称CID
    pub deceased_tokens: BoundedVec<BoundedVec<u8, T::MaxCidLen>, ConstU32<6>>, // 逝者令牌列表
    pub is_public: bool,                         // 是否公开
    pub active: bool,                            // 是否激活
}

// 安葬记录
pub struct IntermentRecord<T: Config> {
    pub deceased_id: u64,                        // 逝者ID
    pub slot: u16,                               // 墓位槽位号
    pub time: BlockNumberFor<T>,                 // 安葬时间
    pub note_cid: Option<BoundedVec<u8, T::MaxCidLen>>, // 安葬备注CID
}

// 投诉记录
pub struct Complaint<T: Config> {
    pub who: T::AccountId,                       // 投诉者
    pub cid: BoundedVec<u8, T::MaxCidLen>,       // 投诉内容CID
    pub time: BlockNumberFor<T>,                 // 投诉时间
}

// 墓位元数据
pub struct GraveMeta {
    pub categories: u32,                         // 分类位图
    pub religion: u8,                           // 宗教代码
}

// 审核状态
pub struct Moderation {
    pub restricted: bool,                        // 是否受限
    pub removed: bool,                           // 是否移除
    pub reason_code: u8,                         // 原因代码
}
```

### 存储项

```rust
// 核心存储
NextGraveId<T>: u64                             // 下一个墓位ID
Graves<T>: u64 => Option<Grave<T>>              // 墓位信息映射
GravesByPark<T>: u64 => BoundedVec<u64>         // 园区墓位索引
Interments<T>: u64 => BoundedVec<IntermentRecord<T>> // 安葬记录
PrimaryDeceasedOf<T>: u64 => Option<u64>        // 主逝者索引

// 准入控制
AdmissionPolicyOf<T>: u64 => GraveAdmissionPolicy // 准入策略
AdmissionWhitelist<T>: (u64, AccountId) => ()   // 准入白名单

// 权限管理
GraveAdmins<T>: u64 => BoundedVec<AccountId>     // 管理员列表
Members<T>: (u64, AccountId) => Option<()>       // 成员集合
JoinRequests<T>: (u64, AccountId) => Option<()>  // 加入申请

// 关注系统
Followers<T>: u64 => BoundedVec<AccountId>       // 关注者列表
FollowedGraves<T>: AccountId => BoundedVec<u64>  // 用户关注的墓位
LastFollowAction<T>: (u64, AccountId) => BlockNumber // 最后关注操作时间
BlockedFollowers<T>: (u64, AccountId) => ()     // 拉黑的关注者

// 内容管理
CoverOf<T>: u64 => Option<BoundedVec<u8>>        // 墓位封面CID
AudioOf<T>: u64 => Option<BoundedVec<u8>>        // 背景音频CID
CoverOptions<T>: BoundedVec<BoundedVec<u8>>      // 公共封面目录
AudioOptions<T>: BoundedVec<BoundedVec<u8>>      // 公共音频目录
PrivateAudioOptionsOf<T>: u64 => BoundedVec<BoundedVec<u8>> // 私有音频候选
AudioPlaylistOf<T>: u64 => BoundedVec<BoundedVec<u8>> // 音频播放列表

// 轮播管理
CarouselItems<T>: BoundedVec<CarouselItem<T>>    // 首页轮播图

// 审核与投诉
ComplaintsByGrave<T>: u64 => BoundedVec<Complaint<T>> // 投诉记录
ModerationOf<T>: u64 => Moderation              // 审核状态
GraveMetaOf<T>: u64 => GraveMeta                // 墓位元数据

// 索引与查询
SlugOf<T>: u64 => Option<BoundedVec<u8>>         // 人类可读ID
GraveBySlug<T>: BoundedVec<u8> => Option<u64>   // Slug反向索引
NameIndex<T>: [u8; 32] => BoundedVec<u64>       // 名称哈希索引
```

## 主要调用方法

### 墓位管理类

```rust
// 创建墓位
create_grave(park_id: Option<u64>, name: BoundedVec<u8, T::MaxCidLen>)

// 设置墓位所属园区
set_park(id: u64, park_id: Option<u64>)

// 转让墓位所有权
transfer_ownership(id: u64, new_owner: T::AccountId)

// 激活/停用墓位
activate_grave(id: u64)
deactivate_grave(id: u64)

// 设置墓位可见性
set_visibility(id: u64, is_public: bool)
```

### 安葬管理类

```rust
// 安葬逝者到墓位
inter(grave_id: u64, deceased_id: u64, slot: u16, note_cid: Option<BoundedVec<u8, T::MaxCidLen>>)

// 从墓位起掘逝者
exhume(grave_id: u64, deceased_id: u64)

// 设置主逝者
set_primary_deceased(grave_id: u64, deceased_id: u64)
```

### 准入策略类

```rust
// 设置准入策略
set_admission_policy(grave_id: u64, policy: GraveAdmissionPolicy)

// 添加到准入白名单
add_to_admission_whitelist(grave_id: u64, account: T::AccountId)

// 从准入白名单移除
remove_from_admission_whitelist(grave_id: u64, account: T::AccountId)
```

### 成员管理类

```rust
// 设置加入策略
set_join_policy(grave_id: u64, policy: u8)

// 申请加入墓位
apply_to_join(grave_id: u64)

// 批准加入申请
approve_join_request(grave_id: u64, applicant: T::AccountId)

// 拒绝加入申请
reject_join_request(grave_id: u64, applicant: T::AccountId)

// 移除成员
remove_member(grave_id: u64, member: T::AccountId)

// 添加管理员
add_admin(grave_id: u64, admin: T::AccountId)

// 移除管理员
remove_admin(grave_id: u64, admin: T::AccountId)
```

### 关注系统类

```rust
// 关注墓位
follow(grave_id: u64)

// 取消关注墓位
unfollow(grave_id: u64)

// 拉黑关注者
block_follower(grave_id: u64, follower: T::AccountId)

// 解除拉黑
unblock_follower(grave_id: u64, follower: T::AccountId)
```

### 内容管理类

```rust
// 设置墓位封面
set_cover(grave_id: u64, cid: BoundedVec<u8, T::MaxCidLen>)

// 设置背景音频
set_audio(grave_id: u64, cid: BoundedVec<u8, T::MaxCidLen>)

// 设置音频播放列表
set_audio_playlist(grave_id: u64, playlist: BoundedVec<BoundedVec<u8, T::MaxCidLen>, T::MaxAudioPlaylistLen>)

// 添加私有音频候选
add_private_audio_option(grave_id: u64, cid: BoundedVec<u8, T::MaxCidLen>)

// 移除私有音频候选
remove_private_audio_option(grave_id: u64, cid: BoundedVec<u8, T::MaxCidLen>)
```

### 治理调用类

```rust
// 添加公共封面选项（仅治理）
add_cover_option(cid: BoundedVec<u8, T::MaxCidLen>)

// 移除公共封面选项（仅治理）
remove_cover_option(cid: BoundedVec<u8, T::MaxCidLen>)

// 添加公共音频选项（仅治理）
add_audio_option(cid: BoundedVec<u8, T::MaxCidLen>)

// 移除公共音频选项（仅治理）
remove_audio_option(cid: BoundedVec<u8, T::MaxCidLen>)

// 设置轮播图（仅治理）
set_carousel(items: BoundedVec<CarouselItem<T>, T::MaxCarouselItems>)

// 通过治理设置封面
set_cover_via_governance(grave_id: u64, cid: BoundedVec<u8, T::MaxCidLen>)

// 通过治理设置音频
set_audio_via_governance(grave_id: u64, cid: BoundedVec<u8, T::MaxCidLen>)
```

### 审核管理类

```rust
// 提交投诉
submit_complaint(grave_id: u64, cid: BoundedVec<u8, T::MaxCidLen>)

// 设置墓位限制状态
set_restricted(grave_id: u64, restricted: bool, reason_code: u8)

// 设置墓位移除状态
set_removed(grave_id: u64, reason_code: u8)

// 更新墓位元数据
update_meta(grave_id: u64, categories: u32, religion: u8)
```

## 事件定义

```rust
pub enum Event<T: Config> {
    // 墓位生命周期事件
    GraveCreated { id: u64, park_id: Option<u64>, owner: T::AccountId },
    GraveUpdated { id: u64 },
    GraveTransferred { id: u64, new_owner: T::AccountId },
    GraveActivated { id: u64 },
    GraveDeactivated { id: u64 },
    GraveSetPark { id: u64, park_id: Option<u64> },

    // 安葬相关事件
    Interred { id: u64, deceased_id: u64 },
    Exhumed { id: u64, deceased_id: u64 },
    PrimaryDeceasedSet { id: u64, deceased_id: u64 },

    // 准入策略事件
    AdmissionPolicySet { grave_id: u64, policy: u8 },
    AdmissionWhitelistAdded { grave_id: u64, account: T::AccountId },
    AdmissionWhitelistRemoved { grave_id: u64, account: T::AccountId },

    // 成员管理事件
    JoinPolicySet { id: u64, policy: u8 },
    JoinRequested { id: u64, who: T::AccountId },
    JoinApproved { id: u64, who: T::AccountId },
    JoinRejected { id: u64, who: T::AccountId },
    MemberRemoved { id: u64, member: T::AccountId },
    AdminAdded { id: u64, admin: T::AccountId },
    AdminRemoved { id: u64, admin: T::AccountId },

    // 关注系统事件
    Followed { grave_id: u64, follower: T::AccountId },
    Unfollowed { grave_id: u64, follower: T::AccountId },
    FollowerBlocked { grave_id: u64, follower: T::AccountId },
    FollowerUnblocked { grave_id: u64, follower: T::AccountId },

    // 内容管理事件
    CoverSet { id: u64, cid: BoundedVec<u8, T::MaxCidLen> },
    AudioSet { id: u64, cid: BoundedVec<u8, T::MaxCidLen> },
    AudioPlaylistSet { id: u64 },
    PrivateAudioOptionAdded { id: u64, cid: BoundedVec<u8, T::MaxCidLen> },
    PrivateAudioOptionRemoved { id: u64, cid: BoundedVec<u8, T::MaxCidLen> },

    // 治理事件
    CoverOptionAdded { cid: BoundedVec<u8, T::MaxCidLen> },
    CoverOptionRemoved { cid: BoundedVec<u8, T::MaxCidLen> },
    AudioOptionAdded { cid: BoundedVec<u8, T::MaxCidLen> },
    AudioOptionRemoved { cid: BoundedVec<u8, T::MaxCidLen> },
    CarouselSet,

    // 审核与投诉事件
    ComplainSubmitted { id: u64, who: T::AccountId },
    Restricted { id: u64, on: bool, reason_code: u8 },
    Removed { id: u64, reason_code: u8 },
    MetaUpdated { id: u64 },

    // 索引管理事件
    SlugAssigned { id: u64, slug: BoundedVec<u8, T::SlugLen> },
    NameHashSet { id: u64, name_hash: [u8; 32] },
    NameHashCleared { id: u64, name_hash: [u8; 32] },
}
```

## 错误定义

```rust
pub enum Error<T> {
    // 基础错误
    NotFound,                    // 墓位不存在
    NotAdmin,                    // 无管理权限
    NotOwner,                    // 非墓位所有者
    InActive,                    // 墓位未激活

    // 容量限制错误
    CapacityExceeded,           // 超出容量限制
    DeceasedLimitReached,       // 逝者数量已达上限
    AdminLimitReached,          // 管理员数量已达上限
    FollowerLimitReached,       // 关注者数量已达上限

    // 状态错误
    AlreadyActive,              // 已经激活
    AlreadyInactive,            // 已经停用
    AlreadyMember,              // 已是成员
    NotMember,                  // 不是成员
    AlreadyAdmin,               // 已是管理员

    // 关注系统错误
    AlreadyFollowing,           // 已关注
    NotFollowing,               // 未关注
    FollowCooldown,             // 关注冷却中
    FollowerBlocked,            // 被拉黑

    // 准入控制错误
    AdmissionDenied,            // 准入被拒绝
    NotInWhitelist,             // 不在白名单中

    // 内容相关错误
    CidNotFound,                // CID不存在
    InvalidCid,                 // 无效CID
    AudioNotFound,              // 音频不存在
    CoverNotFound,              // 封面不存在

    // 系统错误
    FeePaymentFailed,           // 费用支付失败
    InsufficientBalance,        // 余额不足
    StorageError,               // 存储错误
    IpfsPinFailed,             // IPFS固定失败

    // 业务逻辑错误
    CannotTransferToSelf,       // 不能转给自己
    SlugGenerationFailed,       // Slug生成失败
    InvalidSlug,                // 无效Slug
    SlugAlreadyExists,          // Slug已存在
}
```

## 配置参数

```rust
pub trait Config: frame_system::Config {
    // 基础配置
    type WeightInfo: WeightInfo;                 // 权重信息
    type Currency: ReservableCurrency<Self::AccountId>; // 货币接口
    type Balance: Parameter + Member + AtLeast32BitUnsigned + Default + Copy + MaxEncodedLen;

    // 容量限制
    type MaxCidLen: Get<u32>;                    // CID最大长度
    type MaxPerPark: Get<u32>;                   // 每园区最大墓位数
    type MaxIntermentsPerGrave: Get<u32>;        // 每墓位最大安葬数
    type MaxAdminsPerGrave: Get<u32>;            // 每墓位最大管理员数
    type MaxComplaintsPerGrave: Get<u32>;        // 每墓位最大投诉数
    type MaxFollowers: Get<u32>;                 // 最大关注者数
    type SlugLen: Get<u32>;                      // Slug长度（固定10位）
    type MaxIdsPerName: Get<u32>;                // 每名称最大ID数

    // 内容管理配置
    type MaxCoverOptions: Get<u32>;              // 最大封面选项数
    type MaxAudioOptions: Get<u32>;              // 最大音频选项数
    type MaxPrivateAudioOptions: Get<u32>;       // 最大私有音频选项数
    type MaxAudioPlaylistLen: Get<u32>;          // 最大播放列表长度
    type MaxCarouselItems: Get<u32>;             // 最大轮播项数
    type MaxTitleLen: Get<u32>;                  // 标题最大长度
    type MaxLinkLen: Get<u32>;                   // 链接最大长度

    // 费用与押金
    type CreateFee: Get<BalanceOf<Self>>;        // 创建费用
    type FollowDeposit: Get<BalanceOf<Self>>;    // 关注押金
    type FeeCollector: Get<Self::AccountId>;     // 费用收集账户

    // 时间配置
    type FollowCooldownBlocks: Get<u32>;         // 关注冷却区块数

    // 集成接口
    type OnInterment: OnIntermentCommitted;      // 安葬回调
    type ParkAdmin: ParkAdminOrigin<Self::RuntimeOrigin>; // 园区管理权限
    type GovernanceOrigin: EnsureOrigin<Self::RuntimeOrigin>; // 治理起源
    type DeceasedTokenProvider: DeceasedTokenAccess<Self::MaxCidLen>; // 逝者令牌提供者

    // IPFS集成
    type IpfsPinner: IpfsPinner<Self::AccountId, Self::Balance>; // IPFS固定服务
    type DefaultStoragePrice: Get<Self::Balance>; // 默认存储单价
}
```

## 使用示例

### 创建墓位

```rust
// 创建属于园区1的墓位
let name_cid = b"QmExampleNameCid".to_vec().try_into().unwrap();
Pallet::<T>::create_grave(
    RuntimeOrigin::signed(alice),
    Some(1),  // park_id
    name_cid,
)?;
```

### 安葬逝者

```rust
// 将逝者1安葬到墓位1的槽位0
let note_cid = b"QmExampleNoteCid".to_vec().try_into().unwrap();
Pallet::<T>::inter(
    RuntimeOrigin::signed(alice),
    1,        // grave_id
    1,        // deceased_id
    0,        // slot
    Some(note_cid),
)?;
```

### 设置准入策略

```rust
// 设置为白名单模式
Pallet::<T>::set_admission_policy(
    RuntimeOrigin::signed(alice),
    1,        // grave_id
    GraveAdmissionPolicy::Whitelist,
)?;

// 添加账户到白名单
Pallet::<T>::add_to_admission_whitelist(
    RuntimeOrigin::signed(alice),
    1,        // grave_id
    bob,      // account
)?;
```

### 关注墓位

```rust
// 用户关注墓位
Pallet::<T>::follow(
    RuntimeOrigin::signed(bob),
    1,        // grave_id
)?;

// 取消关注
Pallet::<T>::unfollow(
    RuntimeOrigin::signed(bob),
    1,        // grave_id
)?;
```

## 集成说明

### 1. 与 pallet-deceased 集成
- 提供准入策略检查接口
- 支持逝者迁移权限控制
- 维护逝者-墓位绑定关系

### 2. 与 pallet-stardust-ipfs 集成
- 自动固定音频CID
- 计算和支付存储费用
- 支持失败容错处理

### 3. 与 pallet-stardust-park 集成
- 园区权限验证
- 墓位归属管理
- 园区索引维护

## 最佳实践

### 1. 权限管理
- 明确区分墓主、管理员、成员权限
- 合理配置准入策略保护墓位
- 定期审查管理员列表

### 2. 内容管理
- 使用公共目录共享常用资源
- 合理配置私有音频数量
- 及时清理无效CID

### 3. 费用优化
- 根据业务需求配置创建费用
- 合理设置关注押金防刷
- 监控IPFS存储费用

### 4. 性能优化
- 利用索引快速查询
- 避免大量无效关注操作
- 定期清理过期投诉记录

## 注意事项

1. **存储版本**: 当前版本为10，升级时需要迁移脚本
2. **CID长度**: 所有CID受`MaxCidLen`限制，需要合理配置
3. **容量控制**: 各种列表都有容量限制，防止状态膨胀
4. **权限检查**: 关键操作都有权限验证，避免越权访问
5. **错误处理**: 完善的错误类型，便于前端处理
6. **事件监听**: 丰富的事件便于业务联动和监控

## 路线图

### Phase 1.5 已完成
- ✅ 准入策略系统
- ✅ 白名单管理
- ✅ P0问题修复

### 未来规划
- 🔄 NFT集成支持
- 🔄 多媒体类型扩展
- 🔄 高级权限模型
- 🔄 跨链墓位同步