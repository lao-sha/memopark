# pallet-fee-guard（仅手续费账户保护）

该 Pallet 提供“只用于扣手续费、永远不可主动转出资金”的账户保护能力，基于官方 `pallet-balances` 的锁机制实现，与官方 Pallet 完全兼容，低耦合、安全可控。

## 工作原理
- 为账户设置一个永久余额锁（LockIdentifier = `FEEGUARD`）。
- 锁定拒绝的取款原因：拒绝全部，仅放行 `TRANSACTION_PAYMENT`（较之前更严格，防止非常规原因绕过）。
- 保留 `TransactionPayment` 扣费能力（交易手续费可扣）。
- 仅治理（AdminOrigin）可以标记/解除，避免普通用户绕过。

## 接口（Extrinsics）
- `mark_fee_only(origin, who: AccountId)`
  - 权限：AdminOrigin（如 Root 或 内容治理签名账户）。
  - 行为：为 `who` 账户设置永久锁，存证到 `FeeOnlyAccounts`。幂等，重复标记直接返回 Ok。
  - 事件：`MarkedFeeOnly(who, amount_locked)`。
- `unmark_fee_only(origin, who: AccountId)`
  - 权限：AdminOrigin。
  - 行为：移除 `who` 上的锁与存证。幂等，未标记时直接返回 Ok。
  - 事件：`UnmarkedFeeOnly(who)`。

## 存储
- `FeeOnlyAccounts: AccountId -> ()`：仅手续费账户标记集合。

## 只读查询
- `is_fee_only(who) -> bool`：检查账户是否处于仅手续费保护。
- `list_fee_only(limit) -> Vec<AccountId>`：分页导出当前被标记账户（按迭代顺序，建议多次调用分页）。

## 事件
- `MarkedFeeOnly(AccountId, Balance)`：账户已启用仅手续费保护。
- `UnmarkedFeeOnly(AccountId)`：账户已解除仅手续费保护。

## 集成步骤（Runtime）
1) 依赖（`runtime/Cargo.toml`）：
```
pallet-fee-guard = { path = "../pallets/fee-guard", default-features = false }
```
`std` 特性追加：
```
"pallet-fee-guard/std",
```
2) 配置（`runtime/src/configs/mod.rs`）：
```rust
impl pallet_fee_guard::pallet::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type Currency = Balances;
    type AdminOrigin = frame_support::traits::EitherOfDiverse<
        frame_system::EnsureRoot<AccountId>,
        EnsureContentSigner,
    >;
}
```
3) 注册（`runtime/src/lib.rs`）：
```rust
#[runtime::pallet_index(33)]
pub type FeeGuard = pallet_fee_guard;
```

## 使用建议（与官方 Pallet 组合）
- 配合 `pallet-proxy` 纯代理：主账号签名、纯代理代付；给纯代理账户启用 FeeGuard，形成“可扣费不可转出”。
- 配合 `pallet-utility::as_derivative`：以派生地址执行调用；为派生地址启用 FeeGuard，手续费隔离。
- 若需要多人共管，可在对象创建时直接使用 `pallet-multisig` 多签地址作为业务 owner（不与 FeeGuard 冲突）。
- 配合 `pallet-forwarder`（代付）：将 Forwarder 的赞助者账户启用 FeeGuard，可有效降低因调用逃逸而导致的资金被转出风险。

## 安全注意事项
- FeeGuard 仅保留手续费扣除。任何 `balances.transfer*`、`reserve`、`tip` 等操作都会因锁被拒绝；对于未来新增的 `WithdrawReasons`，亦默认拒绝。
- 解锁仅限治理调用 `unmark_fee_only`；请谨慎授予 `AdminOrigin`。
- 不改变所有权与余额数据结构；运行时升级后行为可治理调整。
- 多资产手续费与跨链：本 Pallet 仅限制本链余额支出路径；若启用 Asset Tx Payment 或 XCM v5 `PayFees`，请确保费用资产与策略一致，必要时仅对本地代付账户启用 FeeGuard，跨链费用由 XCM 配置侧控制。

## 运维与风控建议
- 系统关键账户（如国库/平台账户）建议不要启用 FeeGuard（可在运行时策略中加入受保护账户白名单/黑名单）。
- 批量启用/解除建议走治理批量提案，幂等操作便于重试与回滚。
- 大规模巡检可使用 `list_fee_only(limit)` 分页导出并落盘备查。

## 前端提示文案（建议）
- “建议为派生费账户开启‘仅手续费保护（FeeGuard）’：该账户将仅用于扣除手续费，无法主动转出资金（不可转账/保留/打赏）。该设置仅可由治理解除。”
