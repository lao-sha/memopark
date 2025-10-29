# Storage Treasury功能说明

## 📦 组件清单

### 1. StorageTreasuryDashboard
原有的存储费用账户Dashboard

**功能**：
- 显示三个存储池账户的余额（IPFS/Arweave/节点维护）
- 显示累计收集、累计分配统计
- 显示路由表配置
- 显示最近的分配历史
- 显示下次自动分配时间

**路由**：`#/storage-treasury`

---

### 2. IpfsFeeDashboard（新增）
IPFS费用监控Dashboard

**功能**：
- 显示IPFS池配额使用情况
- 显示三重扣款统计（从池/专户/调用者扣款的次数和金额）
- 显示配额重置倒计时
- 显示运营者托管账户余额
- 显示最近的扣费记录

**路由**：`#/ipfs-fee-monitor`

---

## 🎯 使用指南

### 访问StorageTreasuryDashboard

1. 启动前端应用
2. 访问 `http://localhost:5173/#/storage-treasury`
3. 查看存储池账户余额和分配历史

### 访问IpfsFeeDashboard

1. 启动前端应用
2. 访问 `http://localhost:5173/#/ipfs-fee-monitor`
3. 查看IPFS费用监控和三重扣款统计

---

## 🔧 路由配置

需要在 `src/routes.tsx` 中添加新路由：

```tsx
import IpfsFeeDashboard from './features/storage-treasury/IpfsFeeDashboard';

// 在routes数组中添加
{
  path: '/ipfs-fee-monitor',
  element: <IpfsFeeDashboard />,
}
```

---

## 📊 数据来源

### StorageTreasuryDashboard

**链上数据查询**：
- `api.query.system.account(poolAddress)` - 查询池账户余额
- `api.query.storageTreasury.storageRouteTable()` - 查询路由表
- `api.query.storageTreasury.distributionHistory()` - 查询分配历史
- `api.query.storageTreasury.totalCollected()` - 查询累计收集
- `api.query.storageTreasury.totalDistributed()` - 查询累计分配

### IpfsFeeDashboard

**链上数据查询**：
- `api.query.system.account(IPFS_POOL_ADDRESS)` - IPFS池余额
- `api.query.memoIpfs.publicFeeQuotaUsage()` - 配额使用情况
- `api.query.system.account(OPERATOR_ESCROW_ADDRESS)` - 运营者托管余额

**链上事件监听**：
- `memoIpfs.ChargedFromIpfsPool` - 从IPFS池扣款
- `memoIpfs.ChargedFromSubjectFunding` - 从逝者专户扣款
- `memoIpfs.ChargedFromCaller` - 从调用者扣款

**统计数据**：
- 需要监听上述事件并统计本月的扣费次数和金额
- 可以使用本地存储或后端数据库存储统计数据

---

## ⚠️ 重要说明

### 当前状态：使用模拟数据

**IpfsFeeDashboard当前使用模拟数据**，原因：
- pallet-stardust-ipfs尚未启用到runtime
- 链上查询API和事件暂不可用
- 底层useStoragePoolAccounts Hook使用模拟数据

**模拟数据包括**：
- IPFS池余额和配额
- 运营者托管余额
- 三重扣款统计
- 最近扣费记录

### 升级到实际数据

等pallet-stardust-ipfs启用后：

1. **升级底层Hooks**：
   - useStoragePoolAccounts - 查询实际池账户余额和配额

2. **实现事件监听**：
```tsx
// 监听扣费事件
api.query.system.events((events) => {
  events.forEach((record) => {
    const { event } = record;
    if (event.section === 'memoIpfs') {
      if (event.method === 'ChargedFromIpfsPool') {
        const [deceased_id, amount] = event.data;
        // 统计从池扣款
      } else if (event.method === 'ChargedFromSubjectFunding') {
        const [deceased_id, amount] = event.data;
        // 统计从专户扣款
      } else if (event.method === 'ChargedFromCaller') {
        const [caller, amount] = event.data;
        // 统计从调用者扣款
      }
    }
  });
});
```

3. **实现统计数据存储**：
   - 使用localStorage存储月度统计
   - 或使用后端API存储统计数据
   - 每月重置统计（根据配额重置周期）

---

## 🎨 UI设计特点

### StorageTreasuryDashboard
- 三列卡片布局，显示三个池账户
- 表格显示路由表和分配历史
- 使用蓝色/绿色/橙色区分不同池账户

### IpfsFeeDashboard
- 4列卡片总览（池余额/配额剩余/重置倒计时/运营者托管）
- 2列详情卡片（配额使用/三重扣款统计）
- 表格显示最近扣费记录
- 配额超过80%显示警告

---

## 📱 响应式设计

两个Dashboard都支持响应式布局：
- 桌面端（≥1200px）：4列布局
- 平板端（768px-1199px）：2列布局
- 移动端（<768px）：1列布局

---

## 🔄 自动刷新

### StorageTreasuryDashboard
- 手动刷新按钮
- 可选启用自动轮询（默认关闭）

### IpfsFeeDashboard
- 自动轮询池账户余额（30秒间隔）
- 实时监听扣费事件（需要MemoIpfs启用）

---

## 📝 迁移清单

等pallet-stardust-ipfs启用后：

- [ ] 升级useStoragePoolAccounts Hook
- [ ] 实现事件监听逻辑
- [ ] 实现统计数据存储
- [ ] 实现月度统计重置
- [ ] 测试实际链上数据显示
- [ ] 更新本README移除"模拟数据"说明

---

## ❓ 常见问题

**Q: 为什么需要两个Dashboard？**
A: StorageTreasuryDashboard关注整体存储费用分配，IpfsFeeDashboard专注IPFS费用监控和三重扣款统计，功能侧重不同。

**Q: 可以合并成一个Dashboard吗？**
A: 可以，但会导致页面过于复杂。建议保持分离，便于维护和使用。

**Q: 统计数据存储在哪里？**
A: 建议使用localStorage存储月度统计，或者使用后端API。链上只存储原始事件，统计由前端或后端计算。

**Q: 配额重置如何触发？**
A: 配额重置由链上自动触发（每个QuotaResetPeriod周期），前端只需查询当前配额使用情况。

---

**文档版本**：v1.0  
**最后更新**：2025-10-12  
**状态**：✅ IpfsFeeDashboard已完成，使用模拟数据

