# Pallet Stardust Park

## 模块概述

陵园管理系统，提供陵园的登记、管理和权限控制功能。陵园是墓位的上级组织单位。

## 主要功能

### 1. 陵园登记
- 创建陵园记录
- 记录国家地区信息
- 存储加密元数据CID
- 自动建立国家索引

### 2. 元数据管理
- 更新地区代码
- 更新元数据CID
- 激活/停用陵园

### 3. 权限管理
- 所有者管理
- 管理员组设置
- 所有权转让
- 权限校验接口

### 4. 治理接口
- 治理更新陵园
- 治理设置管理员
- 治理转让所有权
- 治理设置封面
- 证据记录机制

### 5. 国家索引
- 按ISO-3166-1 alpha-2编码
- 每国家最多MaxParksPerCountry个陵园
- 支持快速查询

## 核心接口

### 用户接口

#### `create_park()`
创建陵园

**参数：**
- `country_iso2`: 国家编码（ISO-3166-1 alpha-2，如"CN"）
- `region_code`: 地区代码（如"110000"表示北京）
- `metadata_cid`: 元数据CID（加密）

**权限：** 任何签名账户

**返回：** 新陵园ID

**索引：** 自动添加到ParksByCountry[country_iso2]

#### `update_park()`
更新陵园

**参数：**
- `id`: 陵园ID
- `region_code`: 新地区代码（可选）
- `metadata_cid`: 新元数据CID（可选）
- `active`: 新激活状态（可选）

**权限：** 所有者或管理员

**说明：** 不允许修改国家编码（需要先停用后重建）

#### `set_park_admin()`
设置/清空管理员组

**参数：**
- `id`: 陵园ID
- `admin_group`: 管理员组ID（可选，None表示清空）

**权限：** 所有者或当前管理员

#### `transfer_park()`
转让陵园所有权

**参数：**
- `id`: 陵园ID
- `new_owner`: 新所有者账户

**权限：** 仅当前所有者

### 治理接口

#### `gov_update_park()`
治理更新陵园

**参数：**
- `id`: 陵园ID
- `region_code`: 新地区代码（可选）
- `metadata_cid`: 新元数据CID（可选）
- `active`: 新激活状态（可选）
- `evidence_cid`: 证据CID（明文）

**权限：** GovernanceOrigin

**事件：** GovEvidenceNoted(1, id, cid)

#### `gov_set_park_admin()`
治理设置管理员

**参数：**
- `id`: 陵园ID
- `admin_group`: 管理员组ID（可选）
- `evidence_cid`: 证据CID

**权限：** GovernanceOrigin

#### `gov_transfer_park()`
治理转让所有权

**参数：**
- `id`: 陵园ID
- `new_owner`: 新所有者
- `evidence_cid`: 证据CID

**权限：** GovernanceOrigin

#### `gov_set_park_cover()`
治理设置陵园封面

**参数：**
- `id`: 陵园ID
- `cover_cid`: 封面CID（可选，None表示清空）
- `evidence_cid`: 证据CID

**权限：** GovernanceOrigin

**说明：** 封面不存储，仅通过事件记录

## 只读接口

### `park_of(id) -> Option<Park>`
获取陵园详情

### `parks_by_country(country) -> Vec<u64>`
获取指定国家的所有陵园ID列表

### `next_park_id() -> u64`
获取下一个陵园ID

## ParkAdminOrigin接口

### 接口定义
```rust
pub trait ParkAdminOrigin<Origin> {
    fn ensure(park_id: u64, origin: Origin) -> DispatchResult;
}
```

### 用途
- 供pallet-stardust-grave等模块调用
- 验证操作者是否具备陵园管理员权限
- 通过Runtime适配到官方治理pallet（collective/multisig）

### 实现示例
```rust
impl ParkAdminOrigin<RuntimeOrigin> for Runtime {
    fn ensure(park_id: u64, origin: RuntimeOrigin) -> DispatchResult {
        // 检查是否为陵园所有者
        let who = ensure_signed(origin.clone())?;
        let park = Parks::<Runtime>::get(park_id).ok_or(Error::NotFound)?;
        if park.owner == who {
            return Ok(());
        }
        
        // 检查是否为管理员组成员
        if let Some(group_id) = park.admin_group {
            // 调用collective检查成员资格
            Collective::ensure_member(group_id, origin)?;
        }
        
        Err(Error::NotAdmin.into())
    }
}
```

## 数据结构

### Park
```rust
pub struct Park<T: Config> {
    pub owner: T::AccountId,          // 所有者
    pub admin_group: Option<u64>,     // 管理员组ID
    pub country_iso2: [u8; 2],        // 国家编码（如[67, 78]="CN"）
    pub region_code: BoundedVec<u8, T::MaxRegionLen>, // 地区代码
    pub metadata_cid: BoundedVec<u8, T::MaxCidLen>,   // 元数据CID（加密）
    pub active: bool,                 // 是否激活
}
```

### 国家编码
使用ISO-3166-1 alpha-2标准：
- `[67, 78]` = "CN" (中国)
- `[85, 83]` = "US" (美国)
- `[74, 80]` = "JP" (日本)
- `[71, 66]` = "GB" (英国)
- 等等

## 事件

### ParkCreated { id, owner, country }
陵园已创建

### ParkUpdated { id }
陵园已更新

### AdminSet { id, admin_group }
管理员已设置/清空

### ParkTransferred { id, new_owner }
所有权已转让

### ParkActivated { id } / ParkDeactivated { id }
陵园已激活/停用（通过update_park）

### GovEvidenceNoted(scope, key, cid)
治理证据已记录

**scope含义：**
- 1: Update/SetAdmin/Transfer/Activate等操作

### GovParkCoverSet(id, is_set)
治理设置陵园封面（事件化存证）

## 错误

### NotOwner
不是所有者

### NotAdmin
不是管理员

### NotFound
陵园不存在

### BadCountry
国家编码无效（不能为[0, 0]）

### TooMany
国家的陵园数量已达上限

## 配置参数

### 必需参数
- `RuntimeEvent`: 事件类型
- `MaxRegionLen`: 地区代码最大长度
- `MaxCidLen`: CID最大长度
- `MaxParksPerCountry`: 每国家最多陵园数
- `ParkAdmin`: 陵园管理员权限校验器
- `GovernanceOrigin`: 治理起源

## 使用示例

### 创建陵园
```rust
let country = [67u8, 78u8];  // "CN"
let region = b"110000".to_vec().try_into().unwrap();  // 北京
let metadata = b"Qm...".to_vec().try_into().unwrap();

Park::create_park(
    Origin::signed(alice),
    country,
    region,
    metadata,
)?;
```

### 设置管理员
```rust
Park::set_park_admin(
    Origin::signed(alice),
    park_id,
    Some(collective_id),  // 指向collective实例
)?;
```

### 转让所有权
```rust
Park::transfer_park(
    Origin::signed(alice),
    park_id,
    bob,
)?;
```

### 治理更新（带证据）
```rust
Park::gov_update_park(
    Origin::root(),
    park_id,
    Some(new_region),
    Some(new_metadata),
    Some(false),  // 停用
    evidence_cid,
)?;
```

## Runtime集成示例

### 基本配置

```rust
impl pallet_stardust_park::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type MaxRegionLen = ConstU32<32>;
    type MaxCidLen = ConstU32<128>;
    type MaxParksPerCountry = ConstU32<1000>;
    type ParkAdmin = ParkAdminImpl;
    type GovernanceOrigin = EnsureRoot<AccountId>;
}

// 构建运行时
construct_runtime!(
    pub struct Runtime {
        // ...其他pallets
        StardustPark: pallet_stardust_park,
    }
);
```

### ParkAdminOrigin实现

```rust
// 简单实现：仅所有者权限
pub struct ParkAdminImpl;

impl pallet_stardust_park::ParkAdminOrigin<RuntimeOrigin> for ParkAdminImpl {
    fn ensure(park_id: u64, origin: RuntimeOrigin) -> DispatchResult {
        let who = ensure_signed(origin)?;
        let park = StardustPark::park_of(park_id).ok_or("ParkNotFound")?;

        // 检查是否为陵园所有者
        ensure!(park.owner == who, "NotOwner");

        Ok(())
    }
}

// 高级实现：支持管理员组
impl pallet_stardust_park::ParkAdminOrigin<RuntimeOrigin> for ParkAdminImpl {
    fn ensure(park_id: u64, origin: RuntimeOrigin) -> DispatchResult {
        let who = ensure_signed(origin.clone())?;
        let park = StardustPark::park_of(park_id).ok_or("ParkNotFound")?;

        // 检查是否为陵园所有者
        if park.owner == who {
            return Ok(());
        }

        // 检查是否为管理员组成员
        if let Some(admin_group) = park.admin_group {
            // 调用collective检查成员资格
            Council::ensure_member(&admin_group, origin)?;
            return Ok(());
        }

        Err("NotAdmin".into())
    }
}
```

### 与其他Pallet集成

```rust
// 在stardust-grave pallet中验证陵园权限
impl pallet_stardust_grave::Config for Runtime {
    // ...其他配置
    type ParkAdmin = StardustPark;  // 使用StardustPark的权限验证
}

// StardustPark实现grave pallet需要的trait
impl pallet_stardust_grave::ParkPermissionCheck<RuntimeOrigin> for StardustPark {
    fn ensure_park_admin(park_id: u64, origin: RuntimeOrigin) -> DispatchResult {
        Self::ParkAdmin::ensure(park_id, origin)
    }

    fn park_exists(park_id: u64) -> bool {
        Self::park_of(park_id).is_some()
    }
}
## 前端集成指南

### 陵园查询

```typescript
// 获取指定陵园详情
const park = await api.query.stardustPark.parks(parkId);

// 获取下一个陵园ID
const nextId = await api.query.stardustPark.nextParkId();

// 按国家查询陵园列表
const parksInChina = await api.query.stardustPark.parksByCountry([67, 78]); // "CN"
const parksInUS = await api.query.stardustPark.parksByCountry([85, 83]);    // "US"
```

### 陵园管理界面

```typescript
interface ParkManagementProps {
  parkId: number;
  userAccount: string;
}

const ParkManagement: React.FC<ParkManagementProps> = ({ parkId, userAccount }) => {
  const [park, setPark] = useState<Park | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadParkDetails();
  }, [parkId]);

  const loadParkDetails = async () => {
    const parkData = await api.query.stardustPark.parks(parkId);
    setPark(parkData.unwrap());

    // 检查权限
    setIsOwner(parkData.owner.toString() === userAccount);

    // 检查管理员权限（需要后端验证）
    if (parkData.admin_group) {
      const adminCheck = await checkAdminPermission(parkId, userAccount);
      setIsAdmin(adminCheck);
    }
  };

  const updatePark = async (updates: ParkUpdates) => {
    const tx = api.tx.stardustPark.updatePark(
      parkId,
      updates.regionCode || null,
      updates.metadataCid || null,
      updates.active !== undefined ? updates.active : null
    );

    await tx.signAndSend(userAccount);
  };

  const transferOwnership = async (newOwner: string) => {
    if (!isOwner) {
      throw new Error('Only owner can transfer ownership');
    }

    const tx = api.tx.stardustPark.transferPark(parkId, newOwner);
    await tx.signAndSend(userAccount);
  };

  const setAdmin = async (adminGroupId: number | null) => {
    const tx = api.tx.stardustPark.setParkAdmin(parkId, adminGroupId);
    await tx.signAndSend(userAccount);
  };

  return (
    <div className="park-management">
      {park && (
        <>
          <ParkInfo park={park} />
          {(isOwner || isAdmin) && (
            <ParkControls
              park={park}
              isOwner={isOwner}
              onUpdate={updatePark}
              onTransfer={transferOwnership}
              onSetAdmin={setAdmin}
            />
          )}
        </>
      )}
    </div>
  );
};
```

### 国家/地区选择器

```typescript
const CountrySelector: React.FC<{
  onSelect: (country: [number, number], region: string) => void;
}> = ({ onSelect }) => {
  // ISO-3166-1 alpha-2 编码映射
  const countries = [
    { code: [67, 78], name: '中国', iso: 'CN' },
    { code: [85, 83], name: '美国', iso: 'US' },
    { code: [74, 80], name: '日本', iso: 'JP' },
    { code: [71, 66], name: '英国', iso: 'GB' },
  ];

  // 中国地区代码示例
  const chinaRegions = {
    '110000': '北京市',
    '120000': '天津市',
    '310000': '上海市',
    '440000': '广东省',
    '110100': '北京市东城区',
    '110200': '北京市西城区',
  };

  return (
    <div className="country-selector">
      <Select
        placeholder="选择国家"
        onChange={(countryCode) => setSelectedCountry(countryCode)}
      >
        {countries.map(country => (
          <Option key={country.iso} value={country.code}>
            {country.name} ({country.iso})
          </Option>
        ))}
      </Select>

      {selectedCountry && (
        <Select
          placeholder="选择地区"
          onChange={(regionCode) => onSelect(selectedCountry, regionCode)}
        >
          {Object.entries(getRegionsForCountry(selectedCountry)).map(([code, name]) => (
            <Option key={code} value={code}>
              {name}
            </Option>
          ))}
        </Select>
      )}
    </div>
  );
};
```

### 陵园创建流程

```typescript
const CreateParkForm: React.FC = () => {
  const [formData, setFormData] = useState({
    country: null as [number, number] | null,
    regionCode: '',
    metadataCid: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证表单
    if (!formData.country || !formData.regionCode || !formData.metadataCid) {
      throw new Error('请填写完整信息');
    }

    // 创建陵园
    const tx = api.tx.stardustPark.createPark(
      formData.country,
      Array.from(new TextEncoder().encode(formData.regionCode)),
      Array.from(new TextEncoder().encode(formData.metadataCid))
    );

    const result = await tx.signAndSend(userAccount, ({ status, events }) => {
      if (status.isInBlock) {
        // 查找ParkCreated事件获取新陵园ID
        events.forEach(({ event }) => {
          if (api.events.stardustPark.ParkCreated.is(event)) {
            const [parkId, owner, country] = event.data;
            console.log(`陵园创建成功，ID: ${parkId.toString()}`);
            // 跳转到陵园管理页面
            navigate(`/park/${parkId.toString()}`);
          }
        });
      }
    });
  };

  return (
    <Form onSubmit={handleSubmit} className="create-park-form">
      <CountrySelector
        onSelect={(country, region) => {
          setFormData({ ...formData, country, regionCode: region });
        }}
      />

      <FormItem label="元数据CID">
        <Input
          value={formData.metadataCid}
          onChange={(e) => setFormData({ ...formData, metadataCid: e.target.value })}
          placeholder="Qm..."
        />
      </FormItem>

      <Button type="submit" loading={submitting}>
        创建陵园
      </Button>
    </Form>
  );
};
```

### 事件监听

```typescript
// 监听陵园相关事件
const useParkEvents = (parkId?: number) => {
  const [events, setEvents] = useState<ParkEvent[]>([]);

  useEffect(() => {
    const unsubscribe = api.query.system.events((events) => {
      const parkEvents = events
        .map(({ event }) => event)
        .filter(event =>
          api.events.stardustPark.ParkCreated.is(event) ||
          api.events.stardustPark.ParkUpdated.is(event) ||
          api.events.stardustPark.ParkTransferred.is(event) ||
          api.events.stardustPark.AdminSet.is(event)
        )
        .filter(event => !parkId || event.data[0].eq(parkId)) // 过滤特定陵园
        .map(event => ({
          type: event.section + '.' + event.method,
          data: event.data.toHuman(),
          timestamp: new Date(),
        }));

      setEvents(prev => [...parkEvents, ...prev].slice(0, 100)); // 保留最新100条
    });

    return () => unsubscribe.then(unsub => unsub());
  }, [parkId]);

  return events;
};
```

### 权限检查工具

```typescript
// 检查用户对陵园的权限
const checkParkPermission = async (
  parkId: number,
  userAccount: string
): Promise<{
  isOwner: boolean;
  isAdmin: boolean;
  canManage: boolean;
}> => {
  const park = await api.query.stardustPark.parks(parkId);

  if (!park.isSome) {
    throw new Error('陵园不存在');
  }

  const parkData = park.unwrap();
  const isOwner = parkData.owner.toString() === userAccount;

  // 检查管理员权限需要后端支持
  let isAdmin = false;
  if (parkData.admin_group.isSome && !isOwner) {
    // 这里需要调用后端API或链上查询检查管理员资格
    isAdmin = await checkAdminGroupMembership(
      parkData.admin_group.unwrap().toNumber(),
      userAccount
    );
  }

  return {
    isOwner,
    isAdmin,
    canManage: isOwner || isAdmin,
  };
};
```

## 最佳实践
- 使用标准ISO-3166-1 alpha-2国家编码
- 地区代码遵循本国标准（如中国使用6位行政区划代码）
- metadata_cid必须加密，不存明文

### 2. 管理员管理
- admin_group指向collective或multisig实例
- 通过ParkAdminOrigin接口校验权限
- 谨慎授权管理员

### 3. 权限设计
- 所有者拥有最高权限
- 管理员次之
- 支持多签管理（通过collective）

### 4. 治理操作
- 治理操作必须提供证据CID
- 证据CID明文存储（可公开审计）
- 通过事件记录所有治理动作

## 安全考虑

### 1. 权限控制
- 所有者权限不可被管理员覆盖
- 仅所有者可转让所有权
- 管理员权限由ParkAdmin接口校验

### 2. 数据保护
- metadata_cid加密存储
- 不存储明文陵园信息
- 仅存储链下指针

### 3. 容量限制
- 每国家陵园数量有上限（防止滥用）
- 地区代码长度限制
- CID长度限制

### 4. 治理透明
- 所有治理操作记录证据
- 通过事件公开审计
- 证据CID可追溯

## 依赖

### Runtime依赖
- `frame-system`
- `frame-support`

### Trait依赖
- `ParkAdminOrigin`: 管理员权限校验（Runtime实现）
- `GovernanceOrigin`: 治理起源

### 可选集成
- `pallet-collective`: 管理员组投票
- `pallet-multisig`: 多签管理

## 存储

### NextParkId
存储下一个可用的陵园ID（ValueQuery）

### Parks
主存储：park_id → Park（OptionQuery）

### ParksByCountry
国家索引：country_iso2 → Vec\<park_id\>（ValueQuery）

**索引维护：**
- create_park时自动添加
- 不支持移除（陵园不可删除，仅可停用）

## 扩展性

### 1. 封面系统
- 当前仅事件化存证
- 未来可扩展为存储字段
- 支持公共封面目录

### 2. 评分系统
- 预留扩展空间
- 可添加评分、评论功能

### 3. 统计信息
- 预留扩展空间
- 可添加墓位数量、访问量等统计

## 测试

### 单元测试
```bash
cargo test -p pallet-stardust-park
```

## 注意事项

### 1. 国家编码
- 必须使用标准ISO-3166-1 alpha-2
- 不允许使用[0, 0]
- 一旦设置不可修改（需要重建）

### 2. 管理员组
- admin_group指向外部collective/multisig
- 由Runtime实现ParkAdminOrigin接口
- 管理员权限由外部pallet控制

### 3. 治理权限
- 治理可绕过所有者权限
- 治理操作必须提供证据
- 建议通过collective提案执行

### 4. 封面功能
- 当前仅事件化（不占用存储）
- 前端/索引层监听事件获取封面
- 未来可扩展为存储字段
