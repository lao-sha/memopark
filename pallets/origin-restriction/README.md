# Pallet Origin Restriction

## 概述

`pallet-origin-restriction` 是 Stardust 区块链的权限限制管理模块，实现了按起源（origin）限制调用的"软策略"机制。该pallet采用最小实现方式，默认放行全部调用，同时提供治理开关为后续细粒度权限策略预留入口。

## 设计理念

### 核心原则

1. **向后兼容性**: 默认放行全部调用（`allow_all=true`），避免引入破坏性变更
2. **渐进式策略**: 提供治理开关为后续细粒度权限控制预留扩展空间
3. **最小实现**: 专注于核心功能，避免过度设计

### 应用场景

- **系统维护期**: 临时限制特定功能调用
- **紧急响应**: 快速关闭可能存在风险的功能模块
- **治理决策**: 通过社区投票控制功能开关
- **渐进发布**: 新功能的分阶段开放

## 技术架构

### 配置参数

```rust
pub trait Config: frame_system::Config {
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    /// 治理起源（建议使用 Root 或内容治理权限）
    type AdminOrigin: EnsureOrigin<Self::RuntimeOrigin>;
}
```

#### 参数说明

- **RuntimeEvent**: 标准的运行时事件类型绑定
- **AdminOrigin**: 权限管理的治理起源，建议配置为：
  - `Root` - 超级管理员权限
  - 自定义治理委员会权限
  - 多签账户权限

### 存储结构

#### GlobalAllow

```rust
pub type GlobalAllow<T: Config> = StorageValue<_, bool, ValueQuery, DefaultAllow<T>>;
```

**存储类型**: 单值存储（StorageValue）
**数据类型**: bool
**默认值**: true（放行全部）
**访问方式**: `global_allow()` getter

| 值 | 含义 | 行为 |
|---|-----|-----|
| `true` | 全局放行 | 所有调用均被允许 |
| `false` | 全局限制 | 预留状态（当前仍放行，待细化） |

## 功能接口

### 外部调用 (Extrinsics)

#### set_global_allow

**函数签名**:
```rust
pub fn set_global_allow(origin: OriginFor<T>, allow: bool) -> DispatchResult
```

**功能**: 设置全局权限放行开关

**参数**:
- `origin`: 调用起源，必须满足 `AdminOrigin` 权限要求
- `allow`: 布尔值，true为放行，false为限制

**权重**: 10,000

**返回**: DispatchResult

**事件**: 成功时触发 `PolicyUpdated(bool)` 事件

**使用示例**:
```rust
// 开启全局限制
pallet_origin_restriction::set_global_allow(Origin::root(), false)?;

// 恢复全局放行
pallet_origin_restriction::set_global_allow(Origin::root(), true)?;
```

### 查询接口

#### global_allow()

```rust
pub fn global_allow() -> bool
```

**功能**: 查询当前全局权限策略状态
**返回**: 当前的 GlobalAllow 存储值

## 事件系统

### Event 枚举

```rust
pub enum Event<T: Config> {
    /// 权限策略已更新 [新的策略状态]
    PolicyUpdated(bool),
}
```

#### PolicyUpdated

**触发时机**: 成功调用 `set_global_allow` 后
**参数**: `bool` - 更新后的策略状态
**用途**:
- 前端实时同步权限状态
- 审计权限变更历史
- 触发下游系统的策略调整

## 错误处理

```rust
pub enum Error<T> {}
```

当前版本不定义自定义错误，依赖框架内置错误：
- 权限不足时返回 `BadOrigin` 错误
- 参数错误时返回框架标准错误

## 集成指南

### Runtime 配置

```rust
impl pallet_origin_restriction::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type AdminOrigin = EnsureRoot<AccountId>; // 或自定义治理
}

// 添加到 Runtime construct_runtime!
construct_runtime!(
    pub struct Runtime {
        // ...其他pallets
        OriginRestriction: pallet_origin_restriction,
    }
);
```

### 依赖项配置

在 `Cargo.toml` 中添加：

```toml
[dependencies]
pallet-origin-restriction = { path = "../pallets/origin-restriction", default-features = false }

[features]
std = [
    # ...其他依赖
    "pallet-origin-restriction/std",
]
```

## 使用场景

### 场景 1: 系统维护期

```rust
// 维护开始前关闭权限
let _ = OriginRestriction::set_global_allow(Origin::root(), false);

// 维护完成后恢复权限
let _ = OriginRestriction::set_global_allow(Origin::root(), true);
```

### 场景 2: 紧急响应

```rust
// 发现安全问题时立即限制
if security_incident_detected {
    let _ = OriginRestriction::set_global_allow(Origin::root(), false);
    // 通知管理员处理
}
```

### 场景 3: 治理决策

```rust
// 通过治理投票决定功能开关
if governance_proposal_passed {
    let _ = OriginRestriction::set_global_allow(
        Origin::signed(governance_account),
        proposal_allow_state
    );
}
```

## 前端集成

### 状态查询

```typescript
// 查询当前权限状态
const globalAllow = await api.query.originRestriction.globalAllow();

// 监听权限变更事件
api.query.system.events((events) => {
  events.forEach(({ event }) => {
    if (api.events.originRestriction.PolicyUpdated.is(event)) {
      const newPolicy = event.data[0].toHuman();
      console.log('权限策略更新:', newPolicy);
    }
  });
});
```

### 权限管理界面

```typescript
// 管理员权限切换
const toggleGlobalAllow = async (allow: boolean) => {
  const tx = api.tx.originRestriction.setGlobalAllow(allow);
  await tx.signAndSend(adminAccount, { nonce: -1 });
};
```

## 测试指南

### 单元测试

```bash
# 运行pallet测试
cargo test -p pallet-origin-restriction

# 运行特定测试
cargo test -p pallet-origin-restriction test_set_global_allow
```

### 集成测试

```rust
#[test]
fn test_permission_flow() {
    new_test_ext().execute_with(|| {
        // 默认应该允许
        assert_eq!(OriginRestriction::global_allow(), true);

        // 设置限制
        assert_ok!(OriginRestriction::set_global_allow(Origin::root(), false));
        assert_eq!(OriginRestriction::global_allow(), false);

        // 恢复允许
        assert_ok!(OriginRestriction::set_global_allow(Origin::root(), true));
        assert_eq!(OriginRestriction::global_allow(), true);
    });
}
```

## 性能特征

### 计算复杂度

| 操作 | 时间复杂度 | 空间复杂度 | 权重 |
|-----|----------|----------|-----|
| `set_global_allow` | O(1) | O(1) | 10,000 |
| `global_allow` 查询 | O(1) | O(1) | 读取操作 |

### 存储开销

- **GlobalAllow**: 1 byte (bool类型)
- **总存储**: < 100 bytes

### Gas 消耗

- 设置权限策略: ~10,000 权重单位
- 查询权限状态: 免费（只读操作）

## 安全考虑

### 权限控制

1. **AdminOrigin 配置**: 必须严格配置管理员权限
2. **权限审计**: 记录所有权限变更事件
3. **紧急响应**: 确保在紧急情况下能快速调用

### 风险评估

| 风险 | 等级 | 缓解措施 |
|-----|-----|---------|
| 权限滥用 | 中 | 配置多签或治理委员会 |
| 权限丢失 | 高 | 设置多个备用管理员 |
| 错误配置 | 低 | 提供测试和文档 |

### 最佳实践

1. **多重签名**: 对于生产环境，建议使用多签账户作为 AdminOrigin
2. **权限分离**: 考虑将不同类型的限制权限分配给不同的治理层级
3. **监控告警**: 对权限变更事件设置监控和告警机制

## 版本历史

### v1.0.0 (当前版本)
- 实现基础的全局权限开关功能
- 提供 `set_global_allow` 外部调用
- 实现 `PolicyUpdated` 事件
- 完整的单元测试和文档

### 未来规划

#### v1.1.0 (计划中)
- 细粒度权限控制（按pallet/函数分别限制）
- 时间窗口权限（临时权限设置）
- 权限白名单机制

#### v1.2.0 (计划中)
- 动态权限策略（基于条件的智能权限）
- 权限委托机制
- 权限继承和层级管理

## 参考资料

- [Substrate权限系统文档](https://docs.substrate.io/reference/how-to-guides/basics/use-custom-origins/)
- [FRAME Origin 设计](https://docs.substrate.io/learn/runtime-development/origins/)
- [权限管理最佳实践](https://docs.substrate.io/learn/runtime-development/origins/#custom-origins)

## 贡献指南

欢迎提交问题报告和改进建议：

1. 在提交代码前请确保通过所有测试
2. 添加新功能时请同时更新文档和测试
3. 遵循项目的代码风格和注释规范
4. 重要变更请先创建RFC进行讨论

---

*文档版本: v1.0.0*
*最后更新: 2024-11-12*
*维护者: Stardust开发团队*