# Deceased Pallet - 关系功能前端开发快速指南

## 🚀 快速开始

本指南帮助前端开发者快速理解和正确使用Deceased Pallet的关系功能（族谱）。

---

## 📋 核心概念

### 关系类型
| kind | 名称 | 方向性 | 说明 |
|------|------|-------|------|
| 0 | ParentOf | 有向 | A是B的父母 |
| 1 | SpouseOf | 无向 | A和B是配偶 |
| 2 | SiblingOf | 无向 | A和B是兄弟姐妹 |
| 3 | ChildOf | 有向 | A是B的子女 |

### 提案流程
```
发起提案 (propose_relation)
    ↓
等待对方批准/拒绝
    ↓
批准 (approve_relation) → 关系建立
或
拒绝 (reject_relation) → 提案删除
```

---

## ⚠️ 重要提示：参数语义

### 关键理解

在 `approve_relation` 和 `reject_relation` 中：
- **`from` 和 `to` 不是"操作方向"**
- **而是"提案的标识符"**

```typescript
// ⚠️ 参数语义
approve_relation(from, to)
// from: 提案发起方的逝者ID（对方）
// to: 提案接收方的逝者ID（我管理的逝者）
```

---

## 🎯 实战示例

### 示例1：建立配偶关系

**场景**：张三（deceased_id=100）想声明与李四（deceased_id=200）是配偶关系

#### Step 1: 张三的管理员发起提案

```typescript
import { ApiPromise } from '@polkadot/api';

async function proposeSpouseRelation(
  api: ApiPromise,
  zhangSanDeceasedId: number,
  liFourDeceasedId: number,
  zhangSanManagerAccount: any
) {
  try {
    const tx = api.tx.deceased.proposeRelation(
      zhangSanDeceasedId,  // from: 100 (张三)
      liFourDeceasedId,    // to: 200 (李四)
      1,                   // kind: SpouseOf
      null                 // note: 无备注
    );
    
    const hash = await tx.signAndSend(zhangSanManagerAccount);
    console.log('提案发起成功，交易哈希:', hash.toHex());
    
    // 监听事件
    api.query.system.events((events) => {
      events.forEach(({ event }) => {
        if (api.events.deceased.RelationProposed.is(event)) {
          const [from, to, kind] = event.data;
          console.log(`关系提案已发起: ${from} → ${to}, kind=${kind}`);
        }
      });
    });
  } catch (error) {
    console.error('提案发起失败:', error);
  }
}
```

#### Step 2: 李四的管理员批准提案

```typescript
async function approveRelation(
  api: ApiPromise,
  zhangSanDeceasedId: number,  // ⚠️ 提案发起方（对方）
  liFourDeceasedId: number,    // ⚠️ 提案接收方（我管理的逝者）
  liFourManagerAccount: any     // ⚠️ 必须是李四的管理员
) {
  try {
    const tx = api.tx.deceased.approveRelation(
      zhangSanDeceasedId,  // from: 100 (提案发起方，张三)
      liFourDeceasedId     // to: 200 (提案接收方，李四，我管理的逝者)
    );
    
    const hash = await tx.signAndSend(liFourManagerAccount);
    console.log('提案批准成功，交易哈希:', hash.toHex());
    
    // 监听事件
    api.query.system.events((events) => {
      events.forEach(({ event }) => {
        if (api.events.deceased.RelationApproved.is(event)) {
          const [from, to, kind] = event.data;
          console.log(`关系已建立: ${from} ↔ ${to}, kind=${kind}`);
        }
      });
    });
  } catch (error) {
    console.error('提案批准失败:', error);
    // 检查错误类型
    if (error.message.includes('NotProposalResponder')) {
      console.error('❌ 权限错误：只有提案接收方的管理员可以批准');
      console.error(`   你必须是逝者${liFourDeceasedId}的墓位管理员`);
    }
  }
}
```

#### ❌ 常见错误示例

```typescript
// ❌ 错误：张三的管理员误调用 approve_relation
async function wrongApproval(
  api: ApiPromise,
  zhangSanManagerAccount: any  // ❌ 张三的管理员
) {
  const tx = api.tx.deceased.approveRelation(100, 200);
  await tx.signAndSend(zhangSanManagerAccount);
  
  // 结果：交易失败
  // 错误：NotProposalResponder
  // 原因：只有李四的管理员可以批准
}
```

---

### 示例2：拒绝提案

```typescript
async function rejectRelation(
  api: ApiPromise,
  proposerDeceasedId: number,   // 提案发起方
  myDeceasedId: number,         // 我管理的逝者
  myManagerAccount: any         // 必须是我管理的逝者的管理员
) {
  try {
    const tx = api.tx.deceased.rejectRelation(
      proposerDeceasedId,  // from: 对方
      myDeceasedId         // to: 我管理的逝者
    );
    
    const hash = await tx.signAndSend(myManagerAccount);
    console.log('提案拒绝成功，交易哈希:', hash.toHex());
    
    // 监听事件
    api.query.system.events((events) => {
      events.forEach(({ event }) => {
        if (api.events.deceased.RelationRejected.is(event)) {
          const [from, to] = event.data;
          console.log(`提案已拒绝: ${from} → ${to}`);
        }
      });
    });
  } catch (error) {
    console.error('提案拒绝失败:', error);
  }
}
```

---

### 示例3：撤销已建立的关系

```typescript
async function revokeRelation(
  api: ApiPromise,
  deceasedId1: number,    // 关系的一方（参数顺序可任意）
  deceasedId2: number,    // 关系的另一方
  managerAccount: any     // 任一方的管理员都可以
) {
  try {
    const tx = api.tx.deceased.revokeRelation(
      deceasedId1,
      deceasedId2
    );
    
    const hash = await tx.signAndSend(managerAccount);
    console.log('关系撤销成功，交易哈希:', hash.toHex());
    
    // 监听事件
    api.query.system.events((events) => {
      events.forEach(({ event }) => {
        if (api.events.deceased.RelationRevoked.is(event)) {
          const [from, to] = event.data;
          console.log(`关系已撤销: ${from} - ${to}`);
        }
      });
    });
  } catch (error) {
    console.error('关系撤销失败:', error);
  }
}
```

---

## 🎨 React组件示例

### 组件：关系提案表单

```tsx
import React, { useState } from 'react';
import { Button, Form, Input, Select, message } from 'antd';
import { usePolkadotApi } from '@/hooks/usePolkadotApi';

const RelationProposalForm: React.FC<{
  myDeceasedId: number;
  onSuccess?: () => void;
}> = ({ myDeceasedId, onSuccess }) => {
  const { api, account } = usePolkadotApi();
  const [loading, setLoading] = useState(false);
  
  const relationTypes = [
    { value: 0, label: '父母 (ParentOf)' },
    { value: 1, label: '配偶 (SpouseOf)' },
    { value: 2, label: '兄弟姐妹 (SiblingOf)' },
    { value: 3, label: '子女 (ChildOf)' },
  ];
  
  const handleSubmit = async (values: any) => {
    if (!api || !account) {
      message.error('请先连接钱包');
      return;
    }
    
    setLoading(true);
    try {
      const tx = api.tx.deceased.proposeRelation(
        myDeceasedId,           // from: 我管理的逝者
        values.targetDeceasedId, // to: 对方逝者
        values.kind,             // kind: 关系类型
        values.note || null      // note: 备注
      );
      
      await tx.signAndSend(account, ({ status, events }) => {
        if (status.isInBlock) {
          events.forEach(({ event }) => {
            if (api.events.deceased.RelationProposed.is(event)) {
              message.success('关系提案已发起，等待对方批准');
              onSuccess?.();
            }
          });
        }
      });
    } catch (error: any) {
      console.error('提案发起失败:', error);
      message.error(`提案发起失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Form onFinish={handleSubmit} layout="vertical">
      <Form.Item
        name="targetDeceasedId"
        label="对方逝者ID"
        rules={[{ required: true, message: '请输入对方逝者ID' }]}
      >
        <Input type="number" placeholder="请输入对方逝者ID" />
      </Form.Item>
      
      <Form.Item
        name="kind"
        label="关系类型"
        rules={[{ required: true, message: '请选择关系类型' }]}
      >
        <Select options={relationTypes} />
      </Form.Item>
      
      <Form.Item name="note" label="备注（可选）">
        <Input.TextArea placeholder="关系备注（可选）" />
      </Form.Item>
      
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          发起提案
        </Button>
      </Form.Item>
    </Form>
  );
};

export default RelationProposalForm;
```

---

### 组件：待审批提案列表

```tsx
import React, { useEffect, useState } from 'react';
import { List, Button, Tag, message } from 'antd';
import { usePolkadotApi } from '@/hooks/usePolkadotApi';

interface PendingProposal {
  from: number;
  to: number;
  kind: number;
  requester: string;
  note: string;
  createdAt: number;
}

const PendingProposalList: React.FC<{
  myDeceasedId: number;
}> = ({ myDeceasedId }) => {
  const { api, account } = usePolkadotApi();
  const [proposals, setProposals] = useState<PendingProposal[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 查询待审批提案
  useEffect(() => {
    const fetchProposals = async () => {
      if (!api) return;
      
      // TODO: 实现查询逻辑
      // 1. 遍历 PendingRelationRequests 存储
      // 2. 过滤出 to === myDeceasedId 的提案
      // 3. 更新 proposals 状态
    };
    
    fetchProposals();
  }, [api, myDeceasedId]);
  
  const handleApprove = async (proposal: PendingProposal) => {
    if (!api || !account) {
      message.error('请先连接钱包');
      return;
    }
    
    setLoading(true);
    try {
      const tx = api.tx.deceased.approveRelation(
        proposal.from,  // ⚠️ 提案发起方
        proposal.to     // ⚠️ 提案接收方（myDeceasedId）
      );
      
      await tx.signAndSend(account, ({ status, events }) => {
        if (status.isInBlock) {
          events.forEach(({ event }) => {
            if (api.events.deceased.RelationApproved.is(event)) {
              message.success('关系已批准');
              // 刷新列表
            } else if (api.events.system.ExtrinsicFailed.is(event)) {
              // 解析错误
              const [dispatchError] = event.data;
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                if (decoded.name === 'NotProposalResponder') {
                  message.error('❌ 权限错误：只有提案接收方的管理员可以批准');
                } else {
                  message.error(`批准失败: ${decoded.name}`);
                }
              }
            }
          });
        }
      });
    } catch (error: any) {
      console.error('批准失败:', error);
      message.error(`批准失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleReject = async (proposal: PendingProposal) => {
    if (!api || !account) {
      message.error('请先连接钱包');
      return;
    }
    
    setLoading(true);
    try {
      const tx = api.tx.deceased.rejectRelation(
        proposal.from,
        proposal.to
      );
      
      await tx.signAndSend(account, ({ status }) => {
        if (status.isInBlock) {
          message.success('提案已拒绝');
          // 刷新列表
        }
      });
    } catch (error: any) {
      console.error('拒绝失败:', error);
      message.error(`拒绝失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const getRelationTypeName = (kind: number) => {
    const types = ['父母', '配偶', '兄弟姐妹', '子女'];
    return types[kind] || '未知';
  };
  
  return (
    <List
      dataSource={proposals}
      loading={loading}
      renderItem={(proposal) => (
        <List.Item
          actions={[
            <Button
              type="primary"
              onClick={() => handleApprove(proposal)}
              loading={loading}
            >
              批准
            </Button>,
            <Button
              onClick={() => handleReject(proposal)}
              loading={loading}
            >
              拒绝
            </Button>,
          ]}
        >
          <List.Item.Meta
            title={
              <>
                逝者 #{proposal.from} 提出关系声明
                <Tag color="blue">{getRelationTypeName(proposal.kind)}</Tag>
              </>
            }
            description={
              <>
                <div>备注：{proposal.note || '无'}</div>
                <div>发起人：{proposal.requester}</div>
              </>
            }
          />
        </List.Item>
      )}
    />
  );
};

export default PendingProposalList;
```

---

## 🔍 错误处理指南

### 常见错误及处理

| 错误类型 | 原因 | 前端处理建议 |
|---------|------|-------------|
| `NotProposalResponder` | 调用者不是 `to` 方管理员 | 提示："只有提案接收方的管理员可以批准/拒绝" |
| `NotAuthorized` | 调用者无权操作逝者 | 提示："你无权管理该逝者" |
| `RelationExists` | 关系已存在 | 提示："该关系已存在，无需重复建立" |
| `RelationNotFound` | 提案/关系不存在 | 提示："提案不存在或已被处理" |
| `BadRelationKind` | 关系类型冲突 | 提示："关系类型冲突（如父母关系与配偶关系互斥）" |
| `PendingApproval` | 提案待审批 | 提示："对方已向你发起提案，请先处理" |

### 错误处理示例

```typescript
function handleTransactionError(error: any, api: ApiPromise) {
  console.error('交易失败:', error);
  
  // 解析 DispatchError
  if (error.isModule) {
    const decoded = api.registry.findMetaError(error.asModule);
    const { name, docs } = decoded;
    
    switch (name) {
      case 'NotProposalResponder':
        message.error('❌ 权限错误：只有提案接收方的管理员可以批准/拒绝');
        message.info('请确认你是提案参数中 "to" 对应逝者的墓位管理员');
        break;
        
      case 'NotAuthorized':
        message.error('❌ 权限不足：你无权管理该逝者');
        break;
        
      case 'RelationExists':
        message.warning('⚠️ 该关系已存在，无需重复建立');
        break;
        
      case 'RelationNotFound':
        message.warning('⚠️ 提案不存在或已被处理');
        break;
        
      case 'BadRelationKind':
        message.error('❌ 关系类型冲突（如父母关系与配偶关系互斥）');
        break;
        
      case 'PendingApproval':
        message.warning('⚠️ 对方已向你发起提案，请先处理该提案');
        break;
        
      default:
        message.error(`交易失败: ${name} - ${docs.join(' ')}`);
    }
  } else {
    message.error(`交易失败: ${error.message}`);
  }
}
```

---

## 📚 权限矩阵速查

| 操作 | 谁可以调用 | 参数中的角色 | 常见错误 |
|------|-----------|-------------|---------|
| `propose_relation(from, to, ...)` | `from` 的墓位管理员 | 我是 `from` | `NotAuthorized` |
| `approve_relation(from, to)` | `to` 的墓位管理员 | 我是 `to`，对方是 `from` | `NotProposalResponder` |
| `reject_relation(from, to)` | `to` 的墓位管理员 | 我是 `to`，对方是 `from` | `NotProposalResponder` |
| `revoke_relation(from, to)` | `from` 或 `to` 的管理员 | 我是其中一方（参数顺序任意）| `NotAuthorized` |

---

## ✅ 检查清单

在调用关系功能前，请确认：

### propose_relation
- [ ] 我是 `from` 对应逝者的墓位管理员
- [ ] 我已确认 `from` 和 `to` 的逝者ID正确
- [ ] 我已选择正确的关系类型（kind）
- [ ] 我理解对方需要批准才能建立关系

### approve_relation / reject_relation
- [ ] 我是 `to` 对应逝者的墓位管理员（**不是 `from`**）
- [ ] 我已确认提案存在（查询 `PendingRelationRequests`）
- [ ] 我理解参数 `from` 是对方，`to` 是我管理的逝者
- [ ] 我理解 `from` 方管理员无权调用此函数

### revoke_relation
- [ ] 我是关系双方中任一方的墓位管理员
- [ ] 我已确认关系已建立（查询 `Relations`）
- [ ] 我理解参数顺序可任意（函数会自动查找）
- [ ] 我理解撤销后关系完全删除，无法恢复

---

## 🔗 相关资源

- **Pallet README**: `/home/xiaodong/文档/stardust/pallets/deceased/README.md`
- **详细分析报告**: `/home/xiaodong/文档/stardust/docs/Deceased-Pallet-P2问题详细分析-关系功能权限语义混淆.md`
- **修复完成报告**: `/home/xiaodong/文档/stardust/docs/Deceased-Pallet-P2问题修复完成报告.md`

---

*本指南最后更新于2025年10月23日*

