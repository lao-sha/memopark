# Pallet Stardust Pet

## 模块概述

宠物纪念管理系统，为 Stardust 纪念平台提供宠物档案创建、管理和墓位关联功能。作为特殊的 deceased（逝者）类型，宠物模块采用极简设计理念，既保持独立性又与墓位系统深度集成。该模块为未来的宠物养成游戏、社交互动和经济系统预留了丰富的扩展接口。

### 版本历史
- **v0.1.0 (Phase 1)**: 基础功能实现，包括宠物创建、墓位关联、权限管理

### 设计理念
- **极简优先**: 从最小功能集开始，避免过度设计
- **低耦合架构**: 通过 `GraveInspector` trait 实现与墓位系统的松耦合
- **可扩展性**: 为游戏化、社交化、经济化功能预留接口
- **独立性**: 宠物可独立存在，也可附着到墓位

### 与其他模块的关系
- **pallet-stardust-grave**: 通过 `GraveInspector` trait 集成，实现宠物与墓位的关联
- **pallet-deceased**: 宠物作为特殊的逝者类型，共享纪念平台的展示逻辑
- **pallet-stardust-ipfs**: (未来集成) 用于存储宠物照片、视频等媒体内容
- **pallet-memo-offerings**: (未来集成) 支持为宠物供奉祭品

## 核心功能

### 1. 宠物档案管理

#### 1.1 宠物创建
- **字段设计**: 极简字段集（名称、物种、令牌、所有者、创建时间）
- **UTF-8编码**: 支持全球各种语言的宠物名称
- **物种系统**: 开放式物种定义，由前端词表管理
- **令牌机制**: 自定义令牌用于唯一标识和索引

```rust
pub fn create_pet(
    origin: OriginFor<T>,
    name: Vec<u8>,         // 宠物名称（UTF-8）
    species: Vec<u8>,      // 物种（如 "dog"/"cat"/"bird"）
    token: Vec<u8>,        // 自定义令牌
) -> DispatchResult
```

**设计要点**:
- 自动分配唯一宠物ID（从 `NextPetId` 递增）
- 调用者自动成为宠物所有者
- 记录创建时间便于统计和排序
- 无创建费用，降低用户门槛

#### 1.2 物种体系
支持但不限于以下物种类型（前端词表可扩展）:

| 物种代码 | 中文名称 | 英文名称 | 图标建议 |
|---------|---------|---------|---------|
| `dog` | 狗 | Dog | 🐕 |
| `cat` | 猫 | Cat | 🐈 |
| `bird` | 鸟 | Bird | 🦜 |
| `fish` | 鱼 | Fish | 🐠 |
| `rabbit` | 兔子 | Rabbit | 🐇 |
| `hamster` | 仓鼠 | Hamster | 🐹 |
| `turtle` | 乌龟 | Turtle | 🐢 |
| `horse` | 马 | Horse | 🐴 |
| `other` | 其他 | Other | 🐾 |

#### 1.3 令牌生成建议
宠物令牌由用户自定义，建议格式：

**格式**: `PET-{物种代码}-{序号}`

**示例**:
- `PET-DOG-001` (第1只狗)
- `PET-CAT-Lucky` (名为Lucky的猫)
- `PET-BIRD-2024` (2024年创建的鸟)

**设计变更考虑（未来可能）**:
- ⏳ 自动生成令牌（类似 deceased 的确定性算法）
- ⏳ 物种 + 名称 + 主人地址哈希
- ⏳ 全局唯一性保证

### 2. 墓位关联系统

#### 2.1 附着功能
将宠物附着到墓位，实现宠物与家庭墓地的绑定。

```rust
pub fn attach_to_grave(
    origin: OriginFor<T>,
    pet_id: u64,           // 宠物ID
    grave_id: u64,         // 墓位ID
) -> DispatchResult
```

**权限检查**:
1. **宠物所有权**: 调用者必须是宠物的 owner
2. **墓位存在性**: 通过 `GraveProvider::grave_exists()` 检查
3. **墓位管理权限**: 通过 `GraveProvider::can_attach()` 检查

**业务规则**:
- 一个宠物同时只能附着到一个墓位
- 一个墓位可以包含多个宠物（无数量限制）
- 附着操作可重复执行（覆盖旧的关联）

**使用场景**:
- 家庭宠物墓地：将多只宠物附着到家族墓位
- 宠物公墓：管理员可接受多个用户的宠物
- 纪念展示：在墓位页面展示所有相关宠物

#### 2.2 解绑功能
从墓位解除宠物关联，恢复宠物的独立状态。

```rust
pub fn detach_from_grave(
    origin: OriginFor<T>,
    pet_id: u64,           // 宠物ID
) -> DispatchResult
```

**权限检查**:
- 仅需宠物所有权验证
- 无需墓位权限（宠物 owner 拥有完全控制权）

**业务规则**:
- 解绑后宠物仍然存在，只是不再关联墓位
- 可随时重新附着到其他墓位
- 墓位删除不影响宠物独立性

### 3. 权限管理系统

#### 3.1 宠物所有权
- **唯一所有者**: 每个宠物只有一个 owner
- **完全控制权**: owner 可执行所有宠物相关操作
- **不可转让**: 当前版本不支持所有权转移（未来可扩展）

#### 3.2 墓位权限集成
通过 `GraveInspector` trait 与墓位系统集成：

```rust
pub trait GraveInspector<AccountId, GraveId> {
    /// 检查墓位是否存在
    fn grave_exists(grave_id: GraveId) -> bool;

    /// 检查账户是否有权在该墓位附着宠物
    fn can_attach(who: &AccountId, grave_id: GraveId) -> bool;
}
```

**Runtime 实现示例**:
```rust
impl GraveInspector<AccountId, u64> for Runtime {
    fn grave_exists(grave_id: u64) -> bool {
        pallet_stardust_grave::Graves::<Runtime>::contains_key(grave_id)
    }

    fn can_attach(who: &AccountId, grave_id: u64) -> bool {
        if let Some(grave) = pallet_stardust_grave::Graves::<Runtime>::get(grave_id) {
            // 墓主或管理员可以附着宠物
            grave.owner == *who ||
            pallet_stardust_grave::GraveAdmins::<Runtime>::get(grave_id)
                .map(|admins| admins.contains(who))
                .unwrap_or(false)
        } else {
            false
        }
    }
}
```

**权限矩阵**:

| 操作 | 宠物Owner | 墓位Owner | 墓位Admin | 其他用户 |
|-----|----------|----------|----------|---------|
| create_pet | ✅ | ✅ | ✅ | ✅ |
| attach_to_grave | ✅ (且有墓位权限) | - | - | ❌ |
| detach_from_grave | ✅ | ❌ | ❌ | ❌ |

### 4. 查询接口

#### 4.1 链上查询
```rust
// 获取宠物详情
PetOf::<T>::get(pet_id) -> Option<Pet<T>>

// 获取宠物所在墓位
PetInGrave::<T>::get(pet_id) -> Option<u64>

// 获取下一个宠物ID
NextPetId::<T>::get() -> u64
```

#### 4.2 前端查询需求
以下查询建议通过 Subsquid 实现：

- **按墓位查询宠物列表**: `pets_by_grave(grave_id) -> Vec<Pet>`
- **按所有者查询宠物列表**: `pets_by_owner(owner) -> Vec<Pet>`
- **按物种查询宠物列表**: `pets_by_species(species) -> Vec<Pet>`
- **全局宠物统计**: `pet_count_by_species() -> Map<Species, Count>`

## 数据结构

### 核心结构

```rust
/// 宠物档案
pub struct Pet<T: Config> {
    /// 宠物名称（UTF-8编码）
    pub name: BoundedVec<u8, T::StringLimit>,

    /// 宠物所有者账户
    pub owner: T::AccountId,

    /// 物种代码（如 "dog"/"cat"/"bird"）
    pub species: BoundedVec<u8, T::StringLimit>,

    /// 宠物唯一令牌（用户自定义）
    pub token: BoundedVec<u8, T::StringLimit>,

    /// 创建时间（区块号）
    pub created: BlockNumberFor<T>,
}
```

### 物种代码规范
```rust
// 常见物种代码（前端词表）
pub const SPECIES_DOG: &[u8] = b"dog";
pub const SPECIES_CAT: &[u8] = b"cat";
pub const SPECIES_BIRD: &[u8] = b"bird";
pub const SPECIES_FISH: &[u8] = b"fish";
pub const SPECIES_RABBIT: &[u8] = b"rabbit";
pub const SPECIES_HAMSTER: &[u8] = b"hamster";
pub const SPECIES_TURTLE: &[u8] = b"turtle";
pub const SPECIES_HORSE: &[u8] = b"horse";
pub const SPECIES_OTHER: &[u8] = b"other";
```

### 存储项

```rust
/// 下一个可用的宠物ID（从0开始递增）
#[pallet::storage]
pub type NextPetId<T: Config> = StorageValue<_, u64, ValueQuery>;

/// 宠物档案主存储：pet_id => Pet
#[pallet::storage]
pub type PetOf<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,           // pet_id
    Pet<T>,        // 宠物档案
    OptionQuery
>;

/// 宠物-墓位关联：pet_id => grave_id
#[pallet::storage]
pub type PetInGrave<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,           // pet_id
    u64,           // grave_id
    OptionQuery
>;
```

**存储设计说明**:
- **NextPetId**: ValueQuery 保证默认值为0，无需初始化
- **PetOf**: 宠物ID到档案的映射，OptionQuery 支持检查存在性
- **PetInGrave**: 仅在宠物附着时写入，解绑时删除，节省存储空间

## 主要调用方法

### 宠物档案类

```rust
/// 创建宠物档案
///
/// # 参数
/// - `origin`: 签名来源，调用者将成为宠物所有者
/// - `name`: 宠物名称（UTF-8编码）
/// - `species`: 物种代码（建议使用标准词表）
/// - `token`: 自定义令牌（用于唯一标识）
///
/// # 返回
/// - `Ok(())`: 创建成功，触发 PetCreated 事件
/// - `Err(BadInput)`: 参数超出长度限制
///
/// # 示例
/// ```rust
/// // 创建一只名为"Lucky"的狗
/// Pet::create_pet(
///     Origin::signed(alice),
///     b"Lucky".to_vec(),
///     b"dog".to_vec(),
///     b"PET-DOG-001".to_vec(),
/// )?;
/// ```
#[pallet::call_index(0)]
#[pallet::weight(10_000)]
pub fn create_pet(
    origin: OriginFor<T>,
    name: Vec<u8>,
    species: Vec<u8>,
    token: Vec<u8>,
) -> DispatchResult
```

### 墓位关联类

```rust
/// 将宠物附着到墓位
///
/// # 权限要求
/// 1. 调用者必须是宠物所有者
/// 2. 墓位必须存在
/// 3. 调用者必须有墓位管理权限（墓主或管理员）
///
/// # 参数
/// - `origin`: 签名来源
/// - `pet_id`: 宠物ID
/// - `grave_id`: 目标墓位ID
///
/// # 返回
/// - `Ok(())`: 附着成功，触发 PetAttached 事件
/// - `Err(NotFound)`: 宠物不存在
/// - `Err(NotOwner)`: 非宠物所有者
/// - `Err(GraveNotFound)`: 墓位不存在
/// - `Err(NotAllowed)`: 无墓位管理权限
///
/// # 示例
/// ```rust
/// // 将宠物1附着到墓位5
/// Pet::attach_to_grave(
///     Origin::signed(alice),
///     1,  // pet_id
///     5,  // grave_id
/// )?;
/// ```
#[pallet::call_index(1)]
#[pallet::weight(10_000)]
pub fn attach_to_grave(
    origin: OriginFor<T>,
    pet_id: u64,
    grave_id: u64,
) -> DispatchResult
```

```rust
/// 从墓位解绑宠物
///
/// # 权限要求
/// 仅需宠物所有权验证
///
/// # 参数
/// - `origin`: 签名来源
/// - `pet_id`: 宠物ID
///
/// # 返回
/// - `Ok(())`: 解绑成功，触发 PetDetached 事件
/// - `Err(NotFound)`: 宠物不存在
/// - `Err(NotOwner)`: 非宠物所有者
///
/// # 示例
/// ```rust
/// // 解绑宠物1
/// Pet::detach_from_grave(
///     Origin::signed(alice),
///     1,  // pet_id
/// )?;
/// ```
#[pallet::call_index(2)]
#[pallet::weight(10_000)]
pub fn detach_from_grave(
    origin: OriginFor<T>,
    pet_id: u64,
) -> DispatchResult
```

## 事件定义

```rust
#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    /// 宠物已创建
    ///
    /// # 参数
    /// - `u64`: 宠物ID
    /// - `T::AccountId`: 宠物所有者
    PetCreated(u64, T::AccountId),

    /// 宠物已附着到墓位
    ///
    /// # 参数
    /// - `u64`: 宠物ID
    /// - `u64`: 墓位ID
    PetAttached(u64, u64),

    /// 宠物已从墓位解绑
    ///
    /// # 参数
    /// - `u64`: 宠物ID
    PetDetached(u64),
}
```

**事件监听建议**:
```typescript
// 监听宠物创建事件
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;
    if (api.events.pet.PetCreated.is(event)) {
      const [petId, owner] = event.data;
      console.log(`New pet created: ID=${petId}, Owner=${owner}`);
    }
  });
});
```

## 错误定义

```rust
#[pallet::error]
pub enum Error<T> {
    /// 输入参数不合法
    ///
    /// 通常原因：
    /// - 名称超出 StringLimit 限制
    /// - 物种代码超出 StringLimit 限制
    /// - 令牌超出 StringLimit 限制
    BadInput,

    /// 宠物不存在
    ///
    /// 检查点：
    /// - 宠物ID是否正确
    /// - 宠物是否已被删除（未来功能）
    NotFound,

    /// 不是宠物所有者
    ///
    /// 权限不足，仅宠物 owner 可执行此操作
    NotOwner,

    /// 墓位不存在
    ///
    /// 通过 GraveProvider::grave_exists() 检查失败
    GraveNotFound,

    /// 不允许附着
    ///
    /// 通过 GraveProvider::can_attach() 检查失败
    /// 通常原因：
    /// - 不是墓位所有者
    /// - 不是墓位管理员
    /// - 墓位访问受限
    NotAllowed,
}
```

**错误处理示例**:
```rust
// Rust 调用
match Pet::create_pet(origin, name, species, token) {
    Ok(()) => println!("Pet created successfully"),
    Err(e) => match e {
        Error::<T>::BadInput => eprintln!("Input too long, check StringLimit"),
        _ => eprintln!("Unknown error: {:?}", e),
    }
}
```

## 配置参数

```rust
#[pallet::config]
pub trait Config: frame_system::Config {
    /// 运行时事件类型
    ///
    /// 必须实现事件到运行时事件的转换
    #[allow(deprecated)]
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

    /// 字符串长度限制
    ///
    /// 应用于：
    /// - 宠物名称 (name)
    /// - 物种代码 (species)
    /// - 令牌 (token)
    ///
    /// 建议值：128 (支持长名称和Unicode字符)
    #[pallet::constant]
    type StringLimit: Get<u32>;

    /// 墓位检查与权限接口
    ///
    /// 由 Runtime 实现，连接到 pallet-stardust-grave
    /// 提供墓位存在性检查和附着权限检查
    type GraveProvider: GraveInspector<Self::AccountId, u64>;
}
```

**Runtime 配置示例**:
```rust
impl pallet_stardust_pet::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type StringLimit = ConstU32<128>;
    type GraveProvider = GraveAccessProvider;
}

// GraveProvider 实现
pub struct GraveAccessProvider;
impl pallet_stardust_pet::GraveInspector<AccountId, u64> for GraveAccessProvider {
    fn grave_exists(grave_id: u64) -> bool {
        pallet_stardust_grave::Graves::<Runtime>::contains_key(grave_id)
    }

    fn can_attach(who: &AccountId, grave_id: u64) -> bool {
        pallet_stardust_grave::Pallet::<Runtime>::is_admin_or_owner(who, grave_id)
    }
}
```

## 使用示例

### Rust 示例

#### 基础操作
```rust
use frame_support::dispatch::DispatchResult;
use sp_runtime::DispatchError;

// 1. 创建宠物
fn create_my_dog() -> DispatchResult {
    let origin = RuntimeOrigin::signed(alice_account());
    let name = b"Lucky".to_vec();
    let species = b"dog".to_vec();
    let token = b"PET-DOG-001".to_vec();

    Pallet::<Runtime>::create_pet(origin, name, species, token)?;

    // 获取新创建的宠物ID（NextPetId - 1）
    let pet_id = NextPetId::<Runtime>::get() - 1;
    log::info!("Created pet with ID: {}", pet_id);

    Ok(())
}

// 2. 附着到墓位
fn attach_pet_to_family_grave(pet_id: u64, grave_id: u64) -> DispatchResult {
    let origin = RuntimeOrigin::signed(alice_account());

    // 检查宠物是否存在
    let pet = PetOf::<Runtime>::get(pet_id)
        .ok_or(Error::<Runtime>::NotFound)?;

    // 检查所有权
    ensure!(pet.owner == alice_account(), Error::<Runtime>::NotOwner);

    // 附着到墓位
    Pallet::<Runtime>::attach_to_grave(origin, pet_id, grave_id)?;

    log::info!("Pet {} attached to grave {}", pet_id, grave_id);
    Ok(())
}

// 3. 解绑宠物
fn detach_pet(pet_id: u64) -> DispatchResult {
    let origin = RuntimeOrigin::signed(alice_account());

    Pallet::<Runtime>::detach_from_grave(origin, pet_id)?;

    log::info!("Pet {} detached from grave", pet_id);
    Ok(())
}

// 4. 查询宠物信息
fn query_pet_info(pet_id: u64) -> Result<(), &'static str> {
    // 获取宠物档案
    let pet = PetOf::<Runtime>::get(pet_id)
        .ok_or("Pet not found")?;

    log::info!("Pet name: {:?}", String::from_utf8_lossy(&pet.name));
    log::info!("Pet species: {:?}", String::from_utf8_lossy(&pet.species));
    log::info!("Pet owner: {:?}", pet.owner);
    log::info!("Pet created at block: {:?}", pet.created);

    // 检查是否附着到墓位
    if let Some(grave_id) = PetInGrave::<Runtime>::get(pet_id) {
        log::info!("Pet is attached to grave: {}", grave_id);
    } else {
        log::info!("Pet is not attached to any grave");
    }

    Ok(())
}
```

#### 批量操作
```rust
// 为一个家庭创建多只宠物并附着到家族墓位
fn create_family_pets(grave_id: u64) -> DispatchResult {
    let origin = RuntimeOrigin::signed(alice_account());

    // 宠物列表
    let pets = vec![
        (b"Lucky".to_vec(), b"dog".to_vec(), b"PET-DOG-001".to_vec()),
        (b"Whiskers".to_vec(), b"cat".to_vec(), b"PET-CAT-001".to_vec()),
        (b"Goldie".to_vec(), b"fish".to_vec(), b"PET-FISH-001".to_vec()),
    ];

    for (name, species, token) in pets {
        // 创建宠物
        Pallet::<Runtime>::create_pet(
            origin.clone(),
            name.clone(),
            species.clone(),
            token.clone(),
        )?;

        // 获取新创建的宠物ID
        let pet_id = NextPetId::<Runtime>::get() - 1;

        // 附着到墓位
        Pallet::<Runtime>::attach_to_grave(origin.clone(), pet_id, grave_id)?;

        log::info!("Created and attached pet: {:?}", String::from_utf8_lossy(&name));
    }

    Ok(())
}
```

### TypeScript 前端示例

#### 基础操作
```typescript
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';

// 初始化 API
async function initApi() {
  const provider = new WsProvider('ws://localhost:9944');
  const api = await ApiPromise.create({ provider });
  return api;
}

// 1. 创建宠物
async function createPet(
  api: ApiPromise,
  signer: any,
  name: string,
  species: string,
  token: string
) {
  try {
    // 构造交易
    const tx = api.tx.pet.createPet(name, species, token);

    // 签名并发送
    const unsub = await tx.signAndSend(signer, ({ events = [], status }) => {
      if (status.isInBlock) {
        console.log(`Transaction included in block ${status.asInBlock}`);

        // 解析事件
        events.forEach(({ event }) => {
          if (api.events.pet.PetCreated.is(event)) {
            const [petId, owner] = event.data;
            console.log(`Pet created: ID=${petId}, Owner=${owner}`);
          }
        });

        unsub();
      }
    });
  } catch (error) {
    console.error('Failed to create pet:', error);
    throw error;
  }
}

// 2. 附着宠物到墓位
async function attachPetToGrave(
  api: ApiPromise,
  signer: any,
  petId: number,
  graveId: number
) {
  try {
    const tx = api.tx.pet.attachToGrave(petId, graveId);

    await tx.signAndSend(signer, ({ events = [], status }) => {
      if (status.isInBlock) {
        events.forEach(({ event }) => {
          if (api.events.pet.PetAttached.is(event)) {
            const [pId, gId] = event.data;
            console.log(`Pet ${pId} attached to grave ${gId}`);
          }

          // 检查错误
          if (api.events.system.ExtrinsicFailed.is(event)) {
            const [dispatchError] = event.data;
            console.error('Attach failed:', dispatchError.toString());
          }
        });
      }
    });
  } catch (error) {
    console.error('Failed to attach pet:', error);
    throw error;
  }
}

// 3. 解绑宠物
async function detachPet(api: ApiPromise, signer: any, petId: number) {
  try {
    const tx = api.tx.pet.detachFromGrave(petId);

    await tx.signAndSend(signer, ({ events = [], status }) => {
      if (status.isInBlock) {
        events.forEach(({ event }) => {
          if (api.events.pet.PetDetached.is(event)) {
            const [pId] = event.data;
            console.log(`Pet ${pId} detached from grave`);
          }
        });
      }
    });
  } catch (error) {
    console.error('Failed to detach pet:', error);
    throw error;
  }
}

// 4. 查询宠物信息
async function queryPetInfo(api: ApiPromise, petId: number) {
  try {
    // 查询宠物档案
    const petOption = await api.query.pet.petOf(petId);

    if (petOption.isNone) {
      console.log('Pet not found');
      return null;
    }

    const pet = petOption.unwrap();
    const petInfo = {
      name: pet.name.toUtf8(),
      owner: pet.owner.toString(),
      species: pet.species.toUtf8(),
      token: pet.token.toUtf8(),
      created: pet.created.toNumber(),
    };

    // 查询墓位关联
    const graveIdOption = await api.query.pet.petInGrave(petId);
    if (graveIdOption.isSome) {
      petInfo.graveId = graveIdOption.unwrap().toNumber();
    }

    console.log('Pet info:', petInfo);
    return petInfo;
  } catch (error) {
    console.error('Failed to query pet:', error);
    throw error;
  }
}

// 5. 查询所有宠物（需要遍历）
async function queryAllPets(api: ApiPromise) {
  try {
    const nextPetId = await api.query.pet.nextPetId();
    const totalPets = nextPetId.toNumber();

    const pets = [];
    for (let i = 0; i < totalPets; i++) {
      const petInfo = await queryPetInfo(api, i);
      if (petInfo) {
        pets.push({ id: i, ...petInfo });
      }
    }

    console.log(`Found ${pets.length} pets`);
    return pets;
  } catch (error) {
    console.error('Failed to query all pets:', error);
    throw error;
  }
}
```

#### React 组件示例
```typescript
import React, { useState, useEffect } from 'react';
import { ApiPromise } from '@polkadot/api';
import { Button, Input, Select, Card, message } from 'antd';

interface PetInfo {
  id: number;
  name: string;
  species: string;
  token: string;
  owner: string;
  graveId?: number;
  created: number;
}

export const PetManagement: React.FC<{ api: ApiPromise; account: any }> = ({
  api,
  account,
}) => {
  const [pets, setPets] = useState<PetInfo[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载宠物列表
  useEffect(() => {
    loadPets();
  }, [api]);

  const loadPets = async () => {
    setLoading(true);
    try {
      const nextPetId = await api.query.pet.nextPetId();
      const total = nextPetId.toNumber();

      const loadedPets = [];
      for (let i = 0; i < total; i++) {
        const petOption = await api.query.pet.petOf(i);
        if (petOption.isSome) {
          const pet = petOption.unwrap();
          const graveIdOption = await api.query.pet.petInGrave(i);

          loadedPets.push({
            id: i,
            name: pet.name.toUtf8(),
            species: pet.species.toUtf8(),
            token: pet.token.toUtf8(),
            owner: pet.owner.toString(),
            graveId: graveIdOption.isSome ? graveIdOption.unwrap().toNumber() : undefined,
            created: pet.created.toNumber(),
          });
        }
      }

      setPets(loadedPets);
      message.success(`加载了 ${loadedPets.length} 只宠物`);
    } catch (error) {
      console.error('Failed to load pets:', error);
      message.error('加载宠物失败');
    } finally {
      setLoading(false);
    }
  };

  // 创建宠物
  const handleCreatePet = async (name: string, species: string, token: string) => {
    try {
      const tx = api.tx.pet.createPet(name, species, token);
      await tx.signAndSend(account, ({ status, events }) => {
        if (status.isInBlock) {
          message.success('宠物创建成功');
          loadPets(); // 重新加载列表
        }
      });
    } catch (error) {
      console.error('Failed to create pet:', error);
      message.error('创建宠物失败');
    }
  };

  // 附着到墓位
  const handleAttach = async (petId: number, graveId: number) => {
    try {
      const tx = api.tx.pet.attachToGrave(petId, graveId);
      await tx.signAndSend(account, ({ status }) => {
        if (status.isInBlock) {
          message.success('宠物已附着到墓位');
          loadPets();
        }
      });
    } catch (error) {
      console.error('Failed to attach pet:', error);
      message.error('附着失败');
    }
  };

  // 解绑
  const handleDetach = async (petId: number) => {
    try {
      const tx = api.tx.pet.detachFromGrave(petId);
      await tx.signAndSend(account, ({ status }) => {
        if (status.isInBlock) {
          message.success('宠物已解绑');
          loadPets();
        }
      });
    } catch (error) {
      console.error('Failed to detach pet:', error);
      message.error('解绑失败');
    }
  };

  return (
    <div>
      <h2>宠物管理</h2>
      <Button onClick={loadPets} loading={loading}>
        刷新列表
      </Button>

      {/* 宠物列表 */}
      <div style={{ marginTop: 20 }}>
        {pets.map((pet) => (
          <Card key={pet.id} style={{ marginBottom: 10 }}>
            <p><strong>ID:</strong> {pet.id}</p>
            <p><strong>名称:</strong> {pet.name}</p>
            <p><strong>物种:</strong> {pet.species}</p>
            <p><strong>令牌:</strong> {pet.token}</p>
            <p><strong>所有者:</strong> {pet.owner}</p>
            {pet.graveId && <p><strong>墓位:</strong> {pet.graveId}</p>}

            {pet.owner === account.address && (
              <div>
                {pet.graveId ? (
                  <Button onClick={() => handleDetach(pet.id)}>解绑</Button>
                ) : (
                  <Button onClick={() => handleAttach(pet.id, 1)}>附着到墓位1</Button>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
```

## 集成说明

### 与 pallet-stardust-grave 集成

#### 集成方式
通过 `GraveInspector` trait 实现松耦合集成，避免直接依赖。

**优势**:
- **低耦合**: pallet-stardust-pet 不直接依赖 pallet-stardust-grave
- **可测试**: 测试时可提供 mock 实现
- **灵活性**: Runtime 可自定义权限逻辑

#### Runtime 配置
```rust
// runtime/src/lib.rs

// 1. 定义 GraveProvider 实现
pub struct GraveAccessProvider;

impl pallet_stardust_pet::GraveInspector<AccountId, u64> for GraveAccessProvider {
    fn grave_exists(grave_id: u64) -> bool {
        // 检查墓位是否存在
        pallet_stardust_grave::Graves::<Runtime>::contains_key(grave_id)
    }

    fn can_attach(who: &AccountId, grave_id: u64) -> bool {
        // 检查权限：墓主或管理员
        if let Some(grave) = pallet_stardust_grave::Graves::<Runtime>::get(grave_id) {
            if grave.owner == *who {
                return true;
            }

            if let Some(admins) = pallet_stardust_grave::GraveAdmins::<Runtime>::get(grave_id) {
                return admins.contains(who);
            }
        }

        false
    }
}

// 2. 配置 pallet-stardust-pet
impl pallet_stardust_pet::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type StringLimit = ConstU32<128>;
    type GraveProvider = GraveAccessProvider;
}
```

#### 权限扩展示例
```rust
// 支持更复杂的权限逻辑
impl pallet_stardust_pet::GraveInspector<AccountId, u64> for GraveAccessProvider {
    fn can_attach(who: &AccountId, grave_id: u64) -> bool {
        if let Some(grave) = pallet_stardust_grave::Graves::<Runtime>::get(grave_id) {
            // 1. 墓主
            if grave.owner == *who {
                return true;
            }

            // 2. 管理员
            if let Some(admins) = pallet_stardust_grave::GraveAdmins::<Runtime>::get(grave_id) {
                if admins.contains(who) {
                    return true;
                }
            }

            // 3. 检查准入策略（如果墓位是Public）
            if let Some(policy) = pallet_stardust_grave::AdmissionPolicyOf::<Runtime>::get(grave_id) {
                if policy == pallet_stardust_grave::GraveAdmissionPolicy::Public {
                    return true;
                }
            }

            // 4. 检查白名单
            if pallet_stardust_grave::AdmissionWhitelist::<Runtime>::contains_key((grave_id, who)) {
                return true;
            }
        }

        false
    }
}
```

### 与 pallet-deceased 关系

#### 设计对比

| 特性 | pallet-deceased | pallet-stardust-pet |
|-----|----------------|-------------------|
| 对象类型 | 人类逝者 | 宠物 |
| 字段复杂度 | 高（姓名、性别、生卒日期等） | 低（名称、物种、令牌） |
| 令牌生成 | 确定性算法（性别+日期+姓名） | 用户自定义 |
| 分类系统 | 7种分类（普通、历史人物、烈士等） | 物种系统（dog/cat/bird等） |
| 关系管理 | 支持（父子、夫妻等） | 不支持 |
| 迁移功能 | 支持（transfer_deceased） | 不支持（仅附着/解绑） |
| 准入控制 | 集成墓位准入策略 | 通过 GraveProvider 检查 |
| 媒体管理 | 集成 Text/Media 模块 | 无（未来可扩展） |

#### 共同点
- 都可以关联到墓位
- 都有所有权概念
- 都支持在纪念页面展示
- 都可以接受供奉（未来集成）

#### 前端展示建议
```typescript
// 统一的纪念对象接口
interface MemorialSubject {
  type: 'human' | 'pet';
  id: number;
  name: string;
  graveId?: number;
  // ... 其他字段
}

// 在墓位页面同时展示人类和宠物
async function loadGraveSubjects(api: ApiPromise, graveId: number) {
  const subjects: MemorialSubject[] = [];

  // 加载人类逝者
  const deceased = await loadDeceasedByGrave(api, graveId);
  subjects.push(...deceased.map(d => ({ type: 'human', ...d })));

  // 加载宠物
  const pets = await loadPetsByGrave(api, graveId);
  subjects.push(...pets.map(p => ({ type: 'pet', ...p })));

  return subjects;
}
```

### 与 pallet-stardust-ipfs 集成（未来）

#### 集成目标
- 为宠物上传照片、视频
- 自动 Pin 媒体 CID
- 计算和支付存储费用

#### 预留接口设计
```rust
// 未来扩展：为宠物设置主图
pub fn set_pet_image(
    origin: OriginFor<T>,
    pet_id: u64,
    image_cid: BoundedVec<u8, ConstU32<64>>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    let mut pet = PetOf::<T>::get(pet_id).ok_or(Error::<T>::NotFound)?;
    ensure!(pet.owner == who, Error::<T>::NotOwner);

    // 自动 Pin IPFS
    T::IpfsPinner::pin_content(
        &who,
        &image_cid,
        T::DefaultStoragePrice::get(),
    )?;

    // 更新宠物主图
    pet.main_image_cid = Some(image_cid.clone());
    PetOf::<T>::insert(pet_id, pet);

    Self::deposit_event(Event::PetImageSet(pet_id, image_cid));
    Ok(())
}
```

### 与 pallet-memo-offerings 集成（未来）

#### 集成目标
- 支持为宠物供奉祭品
- 统计宠物收到的供奉
- 展示宠物纪念馆

#### 预留接口设计
```rust
// 未来扩展：为宠物供奉
pub fn offer_to_pet(
    origin: OriginFor<T>,
    pet_id: u64,
    offering_type: u64,
    amount: Balance,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    let pet = PetOf::<T>::get(pet_id).ok_or(Error::<T>::NotFound)?;

    // 调用 offerings pallet
    pallet_memo_offerings::Pallet::<T>::offer(
        origin,
        OfferingTarget::Pet(pet_id),
        offering_type,
        amount,
    )?;

    Self::deposit_event(Event::PetOffered(pet_id, who, amount));
    Ok(())
}
```

## 最佳实践

### 1. 宠物创建

#### 命名规范
```rust
// ✅ 好的实践
let name = "Lucky";           // 简短、有意义
let species = "dog";          // 使用标准词表
let token = "PET-DOG-001";    // 清晰的令牌格式

// ❌ 不推荐
let name = "这是一只非常非常非常长的宠物名称...";  // 太长
let species = "狗狗";          // 不使用标准代码
let token = "abc123xyz";      // 无意义令牌
```

#### 物种标准化
```typescript
// 定义物种词表
const SPECIES_CODES = {
  dog: { zh: '狗', icon: '🐕' },
  cat: { zh: '猫', icon: '🐈' },
  bird: { zh: '鸟', icon: '🦜' },
  fish: { zh: '鱼', icon: '🐠' },
  rabbit: { zh: '兔子', icon: '🐇' },
  hamster: { zh: '仓鼠', icon: '🐹' },
  turtle: { zh: '乌龟', icon: '🐢' },
  horse: { zh: '马', icon: '🐴' },
  other: { zh: '其他', icon: '🐾' },
};

// 前端选择器
function SpeciesSelector({ onChange }) {
  return (
    <Select onChange={onChange}>
      {Object.entries(SPECIES_CODES).map(([code, { zh, icon }]) => (
        <Option key={code} value={code}>
          {icon} {zh}
        </Option>
      ))}
    </Select>
  );
}
```

#### 令牌生成策略
```typescript
// 自动生成令牌
function generatePetToken(species: string, name: string, timestamp: number): string {
  // 方式1: 物种-名称-时间戳
  return `PET-${species.toUpperCase()}-${name}-${timestamp}`;

  // 方式2: 物种-序号
  const count = await getPetCountBySpecies(species);
  return `PET-${species.toUpperCase()}-${String(count + 1).padStart(3, '0')}`;

  // 方式3: 哈希
  const hash = blake2AsHex(`${species}${name}${timestamp}`).slice(0, 10);
  return `PET-${hash}`;
}
```

### 2. 墓位关联管理

#### 批量附着
```rust
// 为家族墓位添加多只宠物
fn batch_attach_pets(
    origin: OriginFor<T>,
    pet_ids: Vec<u64>,
    grave_id: u64,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 预先检查墓位权限
    ensure!(
        T::GraveProvider::grave_exists(grave_id),
        Error::<T>::GraveNotFound
    );
    ensure!(
        T::GraveProvider::can_attach(&who, grave_id),
        Error::<T>::NotAllowed
    );

    // 批量附着
    for pet_id in pet_ids {
        let pet = PetOf::<T>::get(pet_id).ok_or(Error::<T>::NotFound)?;
        ensure!(pet.owner == who, Error::<T>::NotOwner);

        PetInGrave::<T>::insert(pet_id, grave_id);
        Self::deposit_event(Event::PetAttached(pet_id, grave_id));
    }

    Ok(())
}
```

#### 前端批量操作
```typescript
// 批量附着界面
async function batchAttachPets(
  api: ApiPromise,
  signer: any,
  petIds: number[],
  graveId: number
) {
  // 方式1: 使用 Batch 调用（推荐）
  const calls = petIds.map(petId =>
    api.tx.pet.attachToGrave(petId, graveId)
  );

  const batchTx = api.tx.utility.batch(calls);
  await batchTx.signAndSend(signer, ({ status }) => {
    if (status.isInBlock) {
      console.log('Batch attach completed');
    }
  });

  // 方式2: 逐个调用（备选）
  for (const petId of petIds) {
    await new Promise((resolve) => {
      api.tx.pet.attachToGrave(petId, graveId)
        .signAndSend(signer, ({ status }) => {
          if (status.isInBlock) {
            resolve(null);
          }
        });
    });
  }
}
```

#### 权限检查优化
```typescript
// 检查是否有权附着宠物
async function canAttachPet(
  api: ApiPromise,
  account: string,
  petId: number,
  graveId: number
): Promise<{ canAttach: boolean; reason?: string }> {
  // 1. 检查宠物所有权
  const petOption = await api.query.pet.petOf(petId);
  if (petOption.isNone) {
    return { canAttach: false, reason: '宠物不存在' };
  }

  const pet = petOption.unwrap();
  if (pet.owner.toString() !== account) {
    return { canAttach: false, reason: '不是宠物所有者' };
  }

  // 2. 检查墓位存在
  const graveOption = await api.query.grave.graves(graveId);
  if (graveOption.isNone) {
    return { canAttach: false, reason: '墓位不存在' };
  }

  // 3. 检查墓位权限
  const grave = graveOption.unwrap();
  if (grave.owner.toString() === account) {
    return { canAttach: true };
  }

  const adminsOption = await api.query.grave.graveAdmins(graveId);
  if (adminsOption.isSome) {
    const admins = adminsOption.unwrap();
    if (admins.some(admin => admin.toString() === account)) {
      return { canAttach: true };
    }
  }

  return { canAttach: false, reason: '无墓位管理权限' };
}
```

### 3. 查询优化

#### 使用 Subsquid 索引
```typescript
// Subsquid GraphQL schema
type Pet @entity {
  id: ID!
  petId: Int! @index
  name: String!
  species: String! @index
  token: String! @unique
  owner: String! @index
  graveId: Int @index
  created: Int!
}

// GraphQL 查询
query PetsByGrave($graveId: Int!) {
  pets(where: { graveId_eq: $graveId }) {
    id
    petId
    name
    species
    owner
    created
  }
}

query PetsByOwner($owner: String!) {
  pets(where: { owner_eq: $owner }) {
    id
    petId
    name
    species
    graveId
  }
}

query PetsBySpecies($species: String!) {
  pets(where: { species_eq: $species }) {
    id
    petId
    name
    owner
    graveId
  }
}
```

#### 前端缓存策略
```typescript
import { useQuery } from '@tanstack/react-query';

// 查询宠物详情（带缓存）
function usePetInfo(petId: number) {
  return useQuery({
    queryKey: ['pet', petId],
    queryFn: async () => {
      const api = await getApi();
      const petOption = await api.query.pet.petOf(petId);
      if (petOption.isNone) {
        return null;
      }

      const pet = petOption.unwrap();
      const graveIdOption = await api.query.pet.petInGrave(petId);

      return {
        id: petId,
        name: pet.name.toUtf8(),
        species: pet.species.toUtf8(),
        token: pet.token.toUtf8(),
        owner: pet.owner.toString(),
        graveId: graveIdOption.isSome ? graveIdOption.unwrap().toNumber() : undefined,
        created: pet.created.toNumber(),
      };
    },
    staleTime: 5 * 60 * 1000, // 5分钟
    cacheTime: 10 * 60 * 1000, // 10分钟
  });
}

// 查询墓位内的所有宠物（使用 Subsquid）
function usePetsByGrave(graveId: number) {
  return useQuery({
    queryKey: ['pets', 'byGrave', graveId],
    queryFn: async () => {
      const response = await fetch(SUBSQUID_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              pets(where: { graveId_eq: ${graveId} }) {
                petId
                name
                species
                owner
              }
            }
          `,
        }),
      });

      const { data } = await response.json();
      return data.pets;
    },
    staleTime: 2 * 60 * 1000,
  });
}
```

### 4. 错误处理

#### Rust 错误处理
```rust
// 完善的错误处理
fn create_pet_with_validation(
    origin: OriginFor<T>,
    name: Vec<u8>,
    species: Vec<u8>,
    token: Vec<u8>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 验证名称长度
    ensure!(!name.is_empty(), Error::<T>::BadInput);
    ensure!(name.len() <= T::StringLimit::get() as usize, Error::<T>::BadInput);

    // 验证物种代码
    let valid_species = [b"dog", b"cat", b"bird", b"fish", b"rabbit", b"hamster"];
    ensure!(
        valid_species.contains(&species.as_slice()),
        Error::<T>::BadInput
    );

    // 验证令牌唯一性（如果需要）
    // ensure!(!TokenExists::<T>::contains_key(&token), Error::<T>::TokenExists);

    // 创建宠物
    Pallet::<T>::create_pet(origin, name, species, token)
}
```

#### TypeScript 错误处理
```typescript
// 错误处理封装
async function createPetSafe(
  api: ApiPromise,
  signer: any,
  name: string,
  species: string,
  token: string
): Promise<{ success: boolean; petId?: number; error?: string }> {
  try {
    // 前端验证
    if (!name || name.length === 0) {
      return { success: false, error: '宠物名称不能为空' };
    }

    if (name.length > 128) {
      return { success: false, error: '宠物名称过长' };
    }

    const validSpecies = ['dog', 'cat', 'bird', 'fish', 'rabbit', 'hamster'];
    if (!validSpecies.includes(species)) {
      return { success: false, error: '无效的物种代码' };
    }

    // 发送交易
    return new Promise((resolve) => {
      let petId: number | undefined;

      api.tx.pet.createPet(name, species, token)
        .signAndSend(signer, ({ events = [], status, dispatchError }) => {
          if (status.isInBlock) {
            // 检查错误
            if (dispatchError) {
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                resolve({
                  success: false,
                  error: `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`,
                });
              } else {
                resolve({
                  success: false,
                  error: dispatchError.toString(),
                });
              }
              return;
            }

            // 解析事件获取 petId
            events.forEach(({ event }) => {
              if (api.events.pet.PetCreated.is(event)) {
                petId = event.data[0].toNumber();
              }
            });

            resolve({ success: true, petId });
          }
        });
    });
  } catch (error) {
    console.error('Create pet error:', error);
    return { success: false, error: String(error) };
  }
}

// 使用示例
const result = await createPetSafe(api, signer, 'Lucky', 'dog', 'PET-DOG-001');
if (result.success) {
  console.log(`Pet created with ID: ${result.petId}`);
} else {
  console.error(`Failed to create pet: ${result.error}`);
}
```

### 5. 性能优化

#### 批量查询优化
```typescript
// 使用 MultiQuery 批量查询
async function batchQueryPets(api: ApiPromise, petIds: number[]) {
  const queries = petIds.map(id =>
    [api.query.pet.petOf, [id]]
  );

  const results = await api.queryMulti(queries);

  return results.map((result, index) => {
    if (result.isNone) {
      return null;
    }

    const pet = result.unwrap();
    return {
      id: petIds[index],
      name: pet.name.toUtf8(),
      species: pet.species.toUtf8(),
      owner: pet.owner.toString(),
    };
  }).filter(Boolean);
}
```

#### 事件订阅优化
```typescript
// 高效的事件监听
function subscribeToMyPets(
  api: ApiPromise,
  myAddress: string,
  callback: (event: any) => void
) {
  return api.query.system.events((events) => {
    events.forEach((record) => {
      const { event } = record;

      // 仅处理相关事件
      if (api.events.pet.PetCreated.is(event)) {
        const [petId, owner] = event.data;
        if (owner.toString() === myAddress) {
          callback({ type: 'created', petId, owner });
        }
      } else if (api.events.pet.PetAttached.is(event)) {
        const [petId, graveId] = event.data;
        // 检查是否是我的宠物（需要额外查询）
        api.query.pet.petOf(petId).then((petOption) => {
          if (petOption.isSome && petOption.unwrap().owner.toString() === myAddress) {
            callback({ type: 'attached', petId, graveId });
          }
        });
      }
    });
  });
}
```

## 注意事项

### 1. 存储限制
- **StringLimit**: 所有字符串字段（名称、物种、令牌）受此限制
- **建议值**: 128字节（支持长名称和Unicode字符）
- **超限处理**: 前端应预先验证，避免链上失败

### 2. 权限控制
- **宠物所有权**: 创建者自动成为所有者，当前不支持转移
- **墓位权限**: 附着操作需要双重权限（宠物owner + 墓位管理权限）
- **解绑权限**: 仅宠物owner可解绑，墓位owner无权强制解绑

### 3. 关联关系
- **一对一**: 一个宠物同时只能附着到一个墓位
- **一对多**: 一个墓位可以包含多个宠物
- **软关联**: 墓位删除不影响宠物独立性

### 4. 令牌管理
- **唯一性**: 由用户自行保证，链上未强制校验
- **建议**: 使用有意义的令牌格式便于管理
- **未来**: 可能引入确定性生成算法

### 5. 扩展性考虑
- **游戏化**: 当前代码为游戏化功能预留了扩展空间
- **媒体管理**: 未来可集成 IPFS 存储宠物照片、视频
- **社交功能**: 预留宠物排行榜、展示墙等功能接口
- **经济系统**: 预留宠物交易、道具购买等接口

### 6. 前端展示
- **物种图标**: 由前端词表提供，保持一致性
- **合并展示**: 可与 deceased 合并展示在墓位页面
- **独立展示**: 支持宠物专属页面和列表
- **响应式设计**: 移动端优先，适配不同屏幕尺寸

### 7. 测试建议
- **单元测试**: 测试基础创建、附着、解绑功能
- **集成测试**: 测试与墓位系统的集成
- **权限测试**: 测试各种权限场景
- **边界测试**: 测试字符串长度限制、无效输入等

### 8. 迁移考虑
- **存储版本**: 当前无版本控制，未来升级需要迁移脚本
- **数据导出**: 建议通过 Subsquid 备份数据
- **向后兼容**: 扩展功能时保持向后兼容

## 路线图

### Phase 1: 基础功能（已完成）
- ✅ 宠物档案创建
- ✅ 墓位关联（附着/解绑）
- ✅ 基本权限管理
- ✅ 事件系统

### Phase 2: 媒体管理（规划中）
- ⏳ 宠物主图设置
- ⏳ IPFS 自动固定
- ⏳ 相册管理
- ⏳ 视频管理

### Phase 3: 游戏化（规划中）
- ⏳ 等级系统
- ⏳ 经验值
- ⏳ 属性系统（力量、智力、敏捷等）
- ⏳ 技能系统
- ⏳ 宠物互动（喂养、训练、玩耍）

### Phase 4: 社交化（规划中）
- ⏳ 宠物展示墙
- ⏳ 排行榜系统
- ⏳ 宠物社区
- ⏳ 宠物评论点赞

### Phase 5: 经济化（规划中）
- ⏳ 宠物所有权转移
- ⏳ 宠物市场
- ⏳ 道具系统
- ⏳ 宠物繁殖（NFT）

### Phase 6: 供奉集成（规划中）
- ⏳ 为宠物供奉祭品
- ⏳ 供奉统计
- ⏳ 宠物纪念馆

## 参考资料

### 类似项目
1. **Axie Infinity**: 宠物养成 + 战斗系统
2. **CryptoKitties**: 宠物收集 + 繁殖系统
3. **Pokémon**: 宠物收集 + 养成系统

### 技术参考
- [Substrate Documentation](https://docs.substrate.io/)
- [Polkadot-JS API](https://polkadot.js.org/docs/)
- [FRAME Pallets](https://docs.substrate.io/reference/frame-pallets/)

### 相关模块文档
- [pallet-stardust-grave README](../stardust-grave/README.md)
- [pallet-deceased README](../deceased/README.md)
- [pallet-stardust-ipfs README](../stardust-ipfs/README.md)

## 常见问题 (FAQ)

### Q1: 宠物和 deceased 有什么区别？
A: 宠物是特殊的 deceased 类型，字段更简单，侧重展示和纪念。Deceased 面向人类，字段复杂，包含生卒日期、性别、关系等信息。

### Q2: 一个墓位可以有多少只宠物？
A: 没有数量限制，一个墓位可以包含任意数量的宠物。

### Q3: 宠物可以转让给其他人吗？
A: 当前版本不支持，未来版本会添加所有权转移功能。

### Q4: 如何为宠物上传照片？
A: 当前版本不支持媒体管理，Phase 2 会集成 IPFS 支持照片上传。

### Q5: 宠物令牌必须唯一吗？
A: 不是强制要求，但建议使用唯一令牌便于管理和索引。

### Q6: 可以为宠物供奉祭品吗？
A: 当前版本不支持，Phase 6 会集成供奉功能。

### Q7: 如何查询某个墓位的所有宠物？
A: 需要遍历所有宠物或使用 Subsquid 索引查询，建议使用后者提高性能。

### Q8: 墓位删除后宠物会怎样？
A: 宠物不受影响，只是解除了与墓位的关联，可以重新附着到其他墓位。

### Q9: 宠物可以同时附着到多个墓位吗？
A: 不可以，一个宠物同时只能附着到一个墓位。

### Q10: 如何实现宠物养成游戏？
A: 当前是占位模块，Phase 3-5 会逐步添加游戏化、社交化、经济化功能。

## 开发者指南

### 本地开发

#### 1. 编译 Pallet
```bash
# 进入项目根目录
cd /path/to/stardust

# 编译 pet pallet
cargo build -p pallet-stardust-pet

# 运行测试
cargo test -p pallet-stardust-pet

# 检查代码
cargo check -p pallet-stardust-pet
```

#### 2. 启动开发链
```bash
# 编译完整节点
cargo build --release

# 启动开发链
./target/release/solochain-template-node --dev --tmp

# 查看日志
RUST_LOG=runtime=debug ./target/release/solochain-template-node --dev
```

#### 3. 测试前端集成
```bash
# 进入前端目录
cd stardust-dapp

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

### 添加新功能

#### 示例：添加宠物主图功能
```rust
// 1. 扩展 Pet 结构
pub struct Pet<T: Config> {
    pub name: BoundedVec<u8, T::StringLimit>,
    pub owner: T::AccountId,
    pub species: BoundedVec<u8, T::StringLimit>,
    pub token: BoundedVec<u8, T::StringLimit>,
    pub created: BlockNumberFor<T>,

    // 新增字段
    pub main_image_cid: Option<BoundedVec<u8, ConstU32<64>>>,
}

// 2. 添加调用方法
#[pallet::call_index(3)]
#[pallet::weight(10_000)]
pub fn set_pet_image(
    origin: OriginFor<T>,
    pet_id: u64,
    image_cid: BoundedVec<u8, ConstU32<64>>,
) -> DispatchResult {
    let who = ensure_signed(origin)?;
    let mut pet = PetOf::<T>::get(pet_id).ok_or(Error::<T>::NotFound)?;
    ensure!(pet.owner == who, Error::<T>::NotOwner);

    pet.main_image_cid = Some(image_cid.clone());
    PetOf::<T>::insert(pet_id, pet);

    Self::deposit_event(Event::PetImageSet(pet_id, image_cid));
    Ok(())
}

// 3. 添加事件
PetImageSet(u64, BoundedVec<u8, ConstU32<64>>),

// 4. 更新存储版本
#[pallet::storage_version(STORAGE_VERSION + 1)]

// 5. 编写迁移脚本
pub mod migrations {
    use super::*;

    pub fn migrate_to_v1<T: Config>() -> Weight {
        // 为所有现有宠物添加 main_image_cid 字段（默认 None）
        // ...
    }
}
```

### 贡献指南

#### 代码规范
- 遵循 Rust 官方代码风格
- 使用详细的中文注释
- 编写单元测试
- 更新 README.md

#### 提交流程
1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/pet-image`)
3. 提交代码 (`git commit -m 'Add pet image feature'`)
4. 推送分支 (`git push origin feature/pet-image`)
5. 创建 Pull Request

#### 测试要求
- 单元测试覆盖率 > 80%
- 通过所有 CI 检查
- 手动测试前端集成

## 许可证

Unlicense

---

**最后更新**: 2025-11-11
**维护者**: Stardust Team
**版本**: v0.1.0
