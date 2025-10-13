# TypeScript类型定义使用说明

## 📁 文件结构

```
src/types/
├── index.ts        # 统一导出入口
├── ipfs.ts         # IPFS自动Pin相关类型
└── README.md       # 本文档
```

## 📦 类型模块

### ipfs.ts

IPFS自动Pin功能相关的TypeScript类型定义，包括：

#### 1. Pin状态相关类型
- `PinStatus`: Pin状态枚举（pending/active/failed/unknown）
- `PinRecord`: Pin记录详情
- `CidType`: CID类型枚举（用于分类显示）
- `TypedPinRecord`: 带类型标识的Pin记录

#### 2. 三重扣款机制相关类型
- `ChargeSource`: 扣费来源枚举（pool/subject/caller）
- `TripleChargeInfo`: 三重扣款信息
- `ChargeResult`: 扣费结果

#### 3. 存储费用统计相关类型
- `StorageFeeStats`: 存储费用统计
- `ChargeFeeRecord`: 单次扣费记录

#### 4. 池账户相关类型
- `StoragePoolType`: 存储池类型枚举
- `StoragePoolAccount`: 存储池账户信息
- `OperatorEscrowAccount`: 运营者托管账户信息

#### 5. 存储路由相关类型
- `StorageRouteEntry`: 存储路由条目
- `StorageRouteTable`: 存储路由表

#### 6. API响应类型
- `PinStatusResponse`: Pin状态查询响应
- `TripleChargeInfoResponse`: 三重扣款信息查询响应
- `StorageFeeStatsResponse`: 存储费用统计查询响应
- `StoragePoolAccountsResponse`: 存储池账户查询响应

#### 7. 常量定义
- `CHAIN_CONSTANTS`: 链上常量（UNIT, 配额, 价格等）
- `POOL_ADDRESSES`: 池账户地址
- `CID_TYPE_NAMES`: CID类型显示名称映射
- `CHARGE_SOURCE_NAMES`: 扣费来源显示名称映射
- `PIN_STATUS_NAMES`: Pin状态显示名称映射

## 🚀 使用示例

### 示例1：导入类型

```typescript
import { 
  PinStatus, 
  PinRecord, 
  TripleChargeInfo,
  CHAIN_CONSTANTS 
} from '@/types';

// 或者只导入IPFS相关类型
import { PinStatus, PinRecord } from '@/types/ipfs';
```

### 示例2：使用Pin状态类型

```typescript
import { PinRecord, PinStatus, PIN_STATUS_NAMES } from '@/types';

function displayPinStatus(record: PinRecord): string {
  return `${PIN_STATUS_NAMES[record.status]} - ${record.currentReplicas}/${record.targetReplicas} 副本`;
}

const myPin: PinRecord = {
  cid: '0x1234...',
  status: PinStatus.Active,
  currentReplicas: 3,
  targetReplicas: 3,
  deceasedId: 100,
  createdAt: 12345,
};

console.log(displayPinStatus(myPin)); 
// 输出: "已Pin - 3/3 副本"
```

### 示例3：使用三重扣款信息

```typescript
import { TripleChargeInfo, ChargeSource, CHARGE_SOURCE_NAMES } from '@/types';

function predictChargeSource(info: TripleChargeInfo): string {
  if (info.poolQuotaRemaining > info.estimatedCost) {
    return CHARGE_SOURCE_NAMES[ChargeSource.IpfsPool];
  } else if (info.subjectFundingBalance >= info.estimatedCost) {
    return CHARGE_SOURCE_NAMES[ChargeSource.SubjectFunding];
  } else {
    return CHARGE_SOURCE_NAMES[ChargeSource.Caller];
  }
}
```

### 示例4：使用常量

```typescript
import { CHAIN_CONSTANTS, POOL_ADDRESSES } from '@/types';

// 格式化金额
const amount = 1_500_000_000_000n;
const formattedAmount = Number(amount) / Number(CHAIN_CONSTANTS.UNIT);
console.log(`${formattedAmount} MEMO`); // 输出: "1.5 MEMO"

// 获取池地址
const ipfsPoolAddress = POOL_ADDRESSES.IPFS_POOL;
console.log(ipfsPoolAddress); 
// 输出: "5EYCAe5jLbHcAAMKvLFSXgCTbPrLgBJusvPwfKcaKzuf5X5e"
```

### 示例5：在React组件中使用

```tsx
import React from 'react';
import { PinRecord, PIN_STATUS_NAMES, CID_TYPE_NAMES } from '@/types';
import { Badge } from 'antd';

interface PinStatusBadgeProps {
  record: PinRecord;
}

export const PinStatusBadge: React.FC<PinStatusBadgeProps> = ({ record }) => {
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
        text={PIN_STATUS_NAMES[record.status]}
      />
      <span> - {record.currentReplicas}/{record.targetReplicas} 副本</span>
    </div>
  );
};
```

### 示例6：在API服务中使用

```typescript
import { ApiPromise } from '@polkadot/api';
import { 
  PinStatusResponse, 
  PinRecord, 
  PinStatus 
} from '@/types';

export class IpfsService {
  constructor(private api: ApiPromise) {}

  async getPinStatus(cid: string): Promise<PinStatusResponse> {
    try {
      // 查询链上PendingPins
      const pending = await this.api.query.memoIpfs.pendingPins(cid);
      
      if (pending.isSome) {
        const data = pending.unwrap();
        const record: PinRecord = {
          cid,
          status: PinStatus.Pending,
          currentReplicas: 0,
          targetReplicas: data.replicas.toNumber(),
          deceasedId: data.deceased_id.toNumber(),
          createdAt: data.created_at.toNumber(),
        };
        
        return { success: true, data: record };
      }

      // 查询链上ActivePins
      const active = await this.api.query.memoIpfs.activePins(cid);
      
      if (active.isSome) {
        const data = active.unwrap();
        const record: PinRecord = {
          cid,
          status: PinStatus.Active,
          currentReplicas: data.current_replicas.toNumber(),
          targetReplicas: data.target_replicas.toNumber(),
          deceasedId: data.deceased_id.toNumber(),
          createdAt: data.created_at.toNumber(),
        };
        
        return { success: true, data: record };
      }

      return { 
        success: false, 
        error: 'Pin记录未找到' 
      };
    } catch (error) {
      return { 
        success: false, 
        error: `查询失败: ${error}` 
      };
    }
  }
}
```

## 📝 类型命名规范

### 枚举类型
- 使用PascalCase
- 枚举值使用PascalCase
- 示例：`PinStatus.Pending`

### 接口类型
- 使用PascalCase
- 属性名使用camelCase
- 示例：`PinRecord.currentReplicas`

### 常量
- 使用UPPER_SNAKE_CASE
- 示例：`CHAIN_CONSTANTS.UNIT`

### 对象常量
- 对象名使用UPPER_SNAKE_CASE
- 键使用UPPER_SNAKE_CASE或camelCase
- 示例：`POOL_ADDRESSES.IPFS_POOL`

## 🔄 类型更新

当链端类型发生变化时，需要同步更新这些TypeScript类型：

1. 查看链端变更（例如新增字段、修改枚举）
2. 更新对应的TypeScript类型定义
3. 更新相关的常量（如果有）
4. 更新本README的示例（如果需要）
5. 通知前端开发者更新相关代码

## ⚙️ 配置建议

### tsconfig.json

确保tsconfig.json包含以下配置：

```json
{
  "compilerOptions": {
    "paths": {
      "@/types": ["./src/types"],
      "@/types/*": ["./src/types/*"]
    }
  }
}
```

### ESLint

建议添加以下规则：

```json
{
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }]
  }
}
```

## 📚 参考资料

- [链端IpfsPinner trait定义](../../../pallets/memo-ipfs/src/lib.rs#L66-L116)
- [三重扣款机制设计](../../../docs/三重扣款机制实施报告.md)
- [IpfsPinner集成最终实施报告](../../../docs/IpfsPinner集成最终实施报告.md)

## ❓ 常见问题

### Q: 为什么使用bigint而不是number？
A: MEMO代币的精度是10^12，JavaScript的number类型无法精确表示这么大的整数，必须使用bigint。

### Q: POOL_ADDRESSES中的地址会变吗？
A: 这些地址是通过PalletId派生的，理论上是固定的。但如果链升级修改了PalletId，地址会变化，需要同步更新。

### Q: 如何添加新的CID类型？
A: 
1. 在`CidType`枚举中添加新值
2. 在`CID_TYPE_NAMES`中添加对应的显示名称
3. 更新相关的UI组件

### Q: 类型定义文件可以直接在运行时使用吗？
A: 不可以。TypeScript类型在编译后会被擦除。如果需要运行时使用，应该使用常量（如`CHAIN_CONSTANTS`）或者使用类型守卫（type guards）。

## 🎯 最佳实践

1. **始终使用类型导入**：避免使用`any`类型
2. **使用常量**：使用预定义的常量而不是硬编码
3. **类型守卫**：在处理链上数据时使用类型守卫确保类型安全
4. **错误处理**：所有API响应都包含`success`和`error`字段，务必检查
5. **BigInt运算**：注意BigInt的运算规则，不能直接与number混合运算

## 📞 联系方式

如有问题或建议，请联系前端开发团队。

---

**文档版本**：v1.0  
**最后更新**：2025-10-12  
**维护者**：前端团队

