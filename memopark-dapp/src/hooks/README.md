# React Hooks使用说明

## 📦 Hooks清单

### 1. usePinStatus
查询指定CID的Pin状态

**功能**：
- 查询CID的pin状态（pending/active/failed）
- 显示副本数（current/target）
- 支持轮询自动刷新
- 手动刷新功能

**使用示例**：
```tsx
const { record, loading, error, refresh } = usePinStatus({
  cid: '0x1234...',
  enablePolling: true,
  pollingInterval: 10000, // 10秒
});
```

---

### 2. useTripleChargeCheck
检查三重扣款机制的余额和配额

**功能**：
- 查询IpfsPool余额和配额
- 查询SubjectFunding余额
- 查询Caller余额
- 预测扣费来源
- 计算配额重置时间

**使用示例**：
```tsx
const { info, loading, predictSource } = useTripleChargeCheck({
  deceasedId: 100,
  caller: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  estimatedCost: 3n * CHAIN_CONSTANTS.DEFAULT_STORAGE_PRICE,
});
```

---

### 3. useStoragePoolAccounts
查询存储池账户余额和配额信息

**功能**：
- 查询IPFS/Arweave/NodeMaintenance池余额
- 查询IPFS池配额使用情况
- 查询运营者托管账户
- 支持轮询自动刷新

**使用示例**：
```tsx
const { ipfsPool, arweavePool, operatorEscrow, loading, refresh } = useStoragePoolAccounts({
  enablePolling: true,
  pollingInterval: 30000, // 30秒
});
```

---

## 🚨 重要说明

### 当前状态：模拟数据模式

所有Hooks当前都使用**模拟数据**，原因：
- pallet-memo-ipfs尚未启用到runtime
- 链上查询API暂不可用
- 为了不阻塞前端开发，先使用模拟数据

### 模拟数据特点

✅ **数据结构完全一致**
- 模拟数据的类型与实际链上数据完全相同
- 前端组件无需修改即可适配

✅ **业务逻辑可验证**
- 可以测试UI交互
- 可以测试数据展示
- 可以测试错误处理

⚠️ **数据不是真实的**
- 余额、配额、状态都是固定值
- 不会随链上状态变化
- 无法进行实际交易测试

### 升级到实际数据

等pallet-memo-ipfs启用后，只需修改Hooks中的数据获取函数：

**示例：usePinStatus**
```typescript
// 当前（模拟数据）
async function fetchPinStatusFromChain(cid: string): Promise<PinStatusResponse> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return {
    success: true,
    data: { /* 模拟数据 */ },
  };
}

// 升级后（实际数据）
async function fetchPinStatusFromChain(cid: string): Promise<PinStatusResponse> {
  const api = await getPolkadotApi();
  const pending = await api.query.memoIpfs.pendingPins(cid);
  // ... 实际查询逻辑
}
```

**需要修改的位置**：
1. `fetchPinStatusFromChain()` - usePinStatus.ts
2. `fetchTripleChargeInfoFromChain()` - useTripleChargeCheck.ts
3. `fetchPoolAccountsFromChain()` - useStoragePoolAccounts.ts

**预计工作量**：2-3小时（需要实际API连接）

---

## 📖 详细使用指南

### usePinStatus详细示例

```tsx
import React from 'react';
import { Badge, Spin, Alert, Button } from 'antd';
import { usePinStatus } from '@/hooks';
import { PIN_STATUS_NAMES } from '@/types';

export const CidPinStatus: React.FC<{ cid: string }> = ({ cid }) => {
  const { record, loading, error, refresh, isPolling } = usePinStatus({
    cid,
    enablePolling: true,
    pollingInterval: 10000,
  });

  if (loading && !record) return <Spin size="small" />;
  if (error) return <Alert message={error} type="error" showIcon />;
  if (!record) return <span>未Pin</span>;

  const statusColor = {
    pending: 'processing',
    active: 'success',
    failed: 'error',
    unknown: 'default',
  }[record.status];

  return (
    <div>
      <Badge 
        status={statusColor as any}
        text={`${PIN_STATUS_NAMES[record.status]} - ${record.currentReplicas}/${record.targetReplicas} 副本`}
      />
      <Button size="small" onClick={refresh} loading={loading}>
        刷新
      </Button>
      {isPolling && <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>
        (每10秒自动刷新)
      </span>}
    </div>
  );
};
```

### useTripleChargeCheck详细示例

```tsx
import React from 'react';
import { Card, Statistic, Progress, Tag } from 'antd';
import { useTripleChargeCheck } from '@/hooks';
import { CHARGE_SOURCE_NAMES, CHAIN_CONSTANTS } from '@/types';

export const ChargePreview: React.FC<{
  deceasedId: number;
  caller: string;
}> = ({ deceasedId, caller }) => {
  const estimatedCost = 3n * CHAIN_CONSTANTS.DEFAULT_STORAGE_PRICE;
  
  const { info, loading, predictSource } = useTripleChargeCheck({
    deceasedId,
    caller,
    estimatedCost,
  });

  if (loading || !info) return <Spin />;

  const source = predictSource();
  const quotaPercent = Number(info.poolQuotaUsed * 100n / info.poolQuotaTotal);

  return (
    <Card title="扣费预览" size="small">
      <Statistic 
        title="预估费用来源"
        value={CHARGE_SOURCE_NAMES[source.source]}
        valueStyle={{ color: source.source === 'ipfs_pool' ? '#3f8600' : '#cf1322' }}
      />
      
      <div style={{ marginTop: 16 }}>
        <div>IPFS池配额使用：</div>
        <Progress 
          percent={quotaPercent}
          format={() => `${info.poolQuotaUsed / CHAIN_CONSTANTS.UNIT} / ${info.poolQuotaTotal / CHAIN_CONSTANTS.UNIT} MEMO`}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <Tag>池余额: {Number(info.poolBalance / CHAIN_CONSTANTS.UNIT)} MEMO</Tag>
        <Tag>专户余额: {Number(info.subjectFundingBalance / CHAIN_CONSTANTS.UNIT)} MEMO</Tag>
        <Tag>您的余额: {Number(info.callerBalance / CHAIN_CONSTANTS.UNIT)} MEMO</Tag>
      </div>
    </Card>
  );
};
```

### useStoragePoolAccounts详细示例

```tsx
import React from 'react';
import { Card, Row, Col, Statistic, Progress } from 'antd';
import { useStoragePoolAccounts } from '@/hooks';
import { CHAIN_CONSTANTS } from '@/types';

export const PoolAccountsDashboard: React.FC = () => {
  const { ipfsPool, arweavePool, nodeMaintenancePool, operatorEscrow, loading, refresh } = 
    useStoragePoolAccounts({ enablePolling: true });

  if (loading) return <Spin />;

  return (
    <Row gutter={[16, 16]}>
      <Col span={6}>
        <Card title="IPFS存储池" size="small">
          <Statistic 
            title="余额"
            value={Number((ipfsPool?.balance || 0n) / CHAIN_CONSTANTS.UNIT)}
            suffix="MEMO"
          />
          {ipfsPool?.quotaTotal && (
            <div style={{ marginTop: 16 }}>
              <div>月度配额使用：</div>
              <Progress 
                percent={Number((ipfsPool.quotaUsed || 0n) * 100n / ipfsPool.quotaTotal)}
                format={() => `${Number((ipfsPool.quotaUsed || 0n) / CHAIN_CONSTANTS.UNIT)} / ${Number(ipfsPool.quotaTotal / CHAIN_CONSTANTS.UNIT)} MEMO`}
              />
            </div>
          )}
        </Card>
      </Col>

      <Col span={6}>
        <Card title="Arweave存储池" size="small">
          <Statistic 
            title="余额"
            value={Number((arweavePool?.balance || 0n) / CHAIN_CONSTANTS.UNIT)}
            suffix="MEMO"
          />
        </Card>
      </Col>

      <Col span={6}>
        <Card title="节点维护池" size="small">
          <Statistic 
            title="余额"
            value={Number((nodeMaintenancePool?.balance || 0n) / CHAIN_CONSTANTS.UNIT)}
            suffix="MEMO"
          />
        </Card>
      </Col>

      <Col span={6}>
        <Card title="运营者托管" size="small">
          <Statistic 
            title="当前余额"
            value={Number((operatorEscrow?.balance || 0n) / CHAIN_CONSTANTS.UNIT)}
            suffix="MEMO"
          />
          <Statistic 
            title="累计收款"
            value={Number((operatorEscrow?.totalReceived || 0n) / CHAIN_CONSTANTS.UNIT)}
            suffix="MEMO"
            style={{ marginTop: 16 }}
          />
        </Card>
      </Col>
    </Row>
  );
};
```

---

## 🔧 开发建议

### 1. 使用TypeScript
所有Hooks都有完整的类型定义，充分利用IDE的类型提示

### 2. 错误处理
始终检查`error`状态并向用户展示友好的错误信息

### 3. 加载状态
使用`loading`状态显示加载指示器，提升用户体验

### 4. 轮询慎用
轮询会增加服务器负担，只在必要时启用，并设置合理的间隔（≥10秒）

### 5. 手动刷新
提供`refresh`按钮，让用户可以主动刷新数据

---

## 📝 迁移清单

等pallet-memo-ipfs启用后，按以下清单迁移到实际数据：

- [ ] 实现Polkadot.js API连接（`getPolkadotApi()`）
- [ ] 修改`usePinStatus`的数据获取函数
- [ ] 修改`useTripleChargeCheck`的数据获取函数
- [ ] 修改`useStoragePoolAccounts`的数据获取函数
- [ ] 测试实际链上查询
- [ ] 更新本README移除"模拟数据"说明

---

## ❓ 常见问题

**Q: 为什么使用模拟数据？**
A: 因为pallet-memo-ipfs尚未启用，链上查询API暂不可用。使用模拟数据可以不阻塞前端开发。

**Q: 模拟数据会影响实际使用吗？**
A: 不会。模拟数据的类型结构与实际数据完全一致，迁移时只需替换数据获取函数。

**Q: 什么时候可以使用实际数据？**
A: 等pallet-memo-ipfs启用到runtime后，约需2-3小时实现实际API连接。

**Q: 如何判断是否在使用模拟数据？**
A: 查看各Hook文件中的数据获取函数，如果有"模拟延迟"和"模拟返回数据"注释，说明在使用模拟数据。

---

**文档版本**：v1.0  
**最后更新**：2025-10-12  
**状态**：⚠️ 当前使用模拟数据，等待pallet-memo-ipfs启用

