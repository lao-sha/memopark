# pallet-fee-guard (已归档)

## 归档时间
2025-10-24

## 归档原因

1. **主要使用场景不存在** - 项目中没有 `pallet-forwarder`（手续费代付功能）
2. **功能重复** - 官方 `pallet-proxy` 的纯代理（Pure Proxy）已经提供相同功能
3. **过度设计** - 对于当前项目规模和需求，设计过于复杂
4. **降低维护成本** - 减少自研 pallet 维护负担

## 功能说明

原设计用途：保护被标记的账户免于手续费代付（与 `pallet-forwarder` 配合使用）。

核心功能：
- 标记账户（mark/unmark）
- 检查账户是否被保护
- 管理员权限控制（Root | 委员会 2/3）
- 白名单策略（DenyTreasuryAndPlatform）

## 实际情况

- ❌ 项目中无 `pallet-forwarder`，主要使用场景缺失
- ✅ 官方 `pallet-proxy` 已提供纯代理功能，更加成熟可靠
- ❌ 功能重复，增加不必要的系统复杂度

## 替代方案

使用官方 `pallet-proxy` 的纯代理功能：

```javascript
// 创建纯代理账户
await api.tx.proxy.createPure(
  'Any',        // proxyType: 代理类型
  0,            // delay: 延迟块数
  0             // index: 账户索引
).signAndSend(creator);

// 获取派生的纯代理地址
const pureProxyAddress = api.tx.proxy.getPureProxyAddress(
  creator.address,
  'Any',
  0,
  0
);

// 通过纯代理执行交易
await api.tx.proxy.proxy(
  pureProxyAddress,
  null,
  api.tx.balances.transfer(recipient, amount)
).signAndSend(creator);
```

### 纯代理账户的特性

1. **无私钥**: 纯代理地址由创建者地址派生，无独立私钥
2. **资产隔离**: 仅能执行授权的特定操作，不能随意转移资产
3. **权限可撤销**: 创建者可以随时删除代理关系
4. **官方维护**: 由 Parity 官方维护，稳定可靠
5. **标准化**: 兼容 Polkadot/Kusama 生态标准

## 如需恢复

如果未来真的需要手续费保护功能（可能性 < 1%）：

```bash
# 从归档恢复
cp -r archived-pallets/fee-guard pallets/

# 添加到工作区
# 编辑 Cargo.toml，取消注释 "pallets/fee-guard"

# Runtime 集成
# 1. runtime/Cargo.toml 添加依赖
pallet-fee-guard = { path = "../pallets/fee-guard", default-features = false }

# 2. runtime/src/lib.rs 注册 pallet
#[runtime::pallet_index(33)]
pub type FeeGuard = pallet_fee_guard;

# 3. runtime/src/configs/mod.rs 配置 Config trait
impl pallet_fee_guard::pallet::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type AdminOrigin = EitherOfDiverse<
        EnsureRoot<AccountId>,
        pallet_collective::EnsureProportionAtLeast<AccountId, CouncilCollective, 2, 3>
    >;
    type AllowMarking = DenyTreasuryAndPlatform;
    type WeightInfo = ();
}

# 4. 前端重新集成（如需要）
```

恢复成本：中（约 1-2 小时）

## 相关文档

- **移除可行性分析**: 见之前的对话记录
- **移除完成报告**: `docs/pallet-fee-guard移除完成报告.md`
- **官方 pallet-proxy 文档**: https://docs.substrate.io/reference/frame-pallets/#proxy

## 移除决策

**决策依据**:
- 符合项目规则 2（低耦合）
- 符合项目规则 5（优先使用官方 pallet）
- 符合项目规则 8（移除冗余源代码）

**批准时间**: 2025-10-24

---

**归档说明**: 该 pallet 已从 runtime 完全移除，仅保留源码作为技术参考。  
如需类似功能，建议使用官方 `pallet-proxy` 的纯代理功能。

