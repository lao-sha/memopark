# Owner 删除关注者功能补充说明

## ✅ 新增功能

为了增强隐私保护和管理能力，我们为 **pallet-deceased** 添加了 **owner 删除关注者**的功能。

---

## 📋 功能概述

### 权限说明
- **逝者的 owner** 可以强制移除任何关注者
- 使用 `is_admin()` 检查权限（与其他管理接口一致）

### 使用场景
1. **隐私保护**：不希望某些人关注逝者
2. **骚扰防护**：移除恶意关注者
3. **权限管理**：主动管理关注者列表

### 与用户取消关注的区别

| 特性 | 用户取消关注 | Owner 删除关注者 |
|------|-------------|-----------------|
| **调用者** | 关注者自己 | 逝者的 owner |
| **接口** | `unfollow_deceased()` | `remove_follower()` |
| **权限检查** | 检查是否已关注 | 检查是否为 owner |
| **使用场景** | 用户主动取消 | 管理员强制移除 |
| **事件** | `DeceasedUnfollowed` | `FollowerRemoved` |

---

## 🔧 技术实现

### 新增事件

**文件位置**: `pallets/deceased/src/lib.rs:585-591`

```rust
/// 函数级中文注释：owner 移除关注者
/// - deceased_id: 逝者ID
/// - who: 被移除的关注者账户
FollowerRemoved {
    deceased_id: T::DeceasedId,
    who: T::AccountId,
},
```

### 新增接口

**文件位置**: `pallets/deceased/src/lib.rs:3066-3137`

```rust
/// 函数级详细中文注释：owner 移除关注者
#[pallet::call_index(72)]
#[pallet::weight(T::WeightInfo::update())]
pub fn remove_follower(
    origin: OriginFor<T>,
    deceased_id: T::DeceasedId,
    follower: T::AccountId,
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // 检查逝者存在
    let _deceased = DeceasedOf::<T>::get(deceased_id)
        .ok_or(Error::<T>::DeceasedNotFound)?;

    // 检查调用者是否为 owner
    ensure!(
        Self::is_admin(deceased_id, &who),
        Error::<T>::NotAuthorized
    );

    // 检查被移除者是否已关注
    ensure!(
        IsDeceasedFollower::<T>::contains_key(deceased_id, &follower),
        Error::<T>::NotFollowing
    );

    // 从关注列表移除
    DeceasedFollowers::<T>::mutate(deceased_id, |list| {
        if let Some(pos) = list.iter().position(|x| x == &follower) {
            list.swap_remove(pos);
        }
    });

    // 移除快速查询标记
    IsDeceasedFollower::<T>::remove(deceased_id, &follower);

    // 发送事件
    Self::deposit_event(Event::FollowerRemoved {
        deceased_id,
        who: follower,
    });

    Ok(())
}
```

### 接口参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `origin` | OriginFor<T> | 调用者（必须是 owner） |
| `deceased_id` | T::DeceasedId | 逝者ID |
| `follower` | T::AccountId | 要移除的关注者账户 |

### 错误类型

| 错误 | 说明 |
|------|------|
| `DeceasedNotFound` | 逝者不存在 |
| `NotAuthorized` | 调用者不是 owner |
| `NotFollowing` | 该用户未关注此逝者 |

---

## 💻 使用示例

### Polkadot-JS API

```javascript
// 1. 查询关注者列表
const followers = await api.query.deceased.deceasedFollowers(deceasedId);
console.log('当前关注者:', followers.toJSON());

// 2. 检查某人是否关注
const isFollowing = await api.query.deceased.isDeceasedFollower(
    deceasedId,
    unwantedFollower
);
console.log('是否关注:', isFollowing.isSome);

// 3. owner 移除关注者
await api.tx.deceased
    .removeFollower(deceasedId, unwantedFollower)
    .signAndSend(ownerAccount, ({ status, events }) => {
        if (status.isInBlock) {
            console.log('关注者已移除');

            // 监听事件
            events.forEach(({ event }) => {
                if (event.section === 'deceased' && event.method === 'FollowerRemoved') {
                    const [deceasedId, who] = event.data;
                    console.log(`已移除关注者: ${who}`);
                }
            });
        }
    });

// 4. 验证移除结果
const stillFollowing = await api.query.deceased.isDeceasedFollower(
    deceasedId,
    unwantedFollower
);
console.log('移除后是否还关注:', stillFollowing.isSome); // false
```

### 前端组件示例

```typescript
// src/components/deceased/FollowerManagement.tsx

import { Button, List, Modal, message } from 'antd';
import { useApi, useAccount } from '@/hooks';

interface FollowerManagementProps {
    deceasedId: number;
    isOwner: boolean;
}

export const FollowerManagement: React.FC<FollowerManagementProps> = ({
    deceasedId,
    isOwner
}) => {
    const { api } = useApi();
    const { account } = useAccount();
    const [followers, setFollowers] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadFollowers();
    }, [deceasedId]);

    const loadFollowers = async () => {
        if (!api) return;
        const result = await api.query.deceased.deceasedFollowers(deceasedId);
        setFollowers(result.toJSON() as string[]);
    };

    const handleRemoveFollower = async (followerAddress: string) => {
        if (!api || !account) return;

        Modal.confirm({
            title: '确认移除',
            content: `确定要移除关注者 ${followerAddress} 吗？`,
            onOk: async () => {
                setLoading(true);
                try {
                    await api.tx.deceased
                        .removeFollower(deceasedId, followerAddress)
                        .signAndSend(account.address, ({ status }) => {
                            if (status.isInBlock) {
                                message.success('关注者已移除');
                                loadFollowers(); // 重新加载列表
                                setLoading(false);
                            }
                        });
                } catch (error) {
                    console.error('移除失败:', error);
                    message.error('移除失败');
                    setLoading(false);
                }
            },
        });
    };

    if (!isOwner) {
        return <div>关注者数量: {followers.length}</div>;
    }

    return (
        <div>
            <h3>关注者管理 ({followers.length})</h3>
            <List
                dataSource={followers}
                renderItem={(follower) => (
                    <List.Item
                        actions={[
                            <Button
                                danger
                                size="small"
                                loading={loading}
                                onClick={() => handleRemoveFollower(follower)}
                            >
                                移除
                            </Button>,
                        ]}
                    >
                        {follower}
                    </List.Item>
                )}
            />
        </div>
    );
};
```

---

## 🔄 业务流程

### Owner 移除关注者流程

```
Owner 查看关注者列表
    ↓
发现不希望的关注者
    ↓
点击 "移除" 按钮
    ↓
前端调用 deceased.removeFollower(deceased_id, follower)
    ↓
链上检查:
  - 逝者是否存在？
  - 调用者是否为 owner？
  - 被移除者是否已关注？
    ↓
从 DeceasedFollowers 列表移除
    ↓
删除 IsDeceasedFollower 标记
    ↓
发送 FollowerRemoved 事件
    ↓
前端监听事件
    ↓
更新 UI，显示 "已移除"
    ↓
被移除者查看时发现无法再看到该逝者的私密内容
```

---

## 🎯 权限设计

### 权限矩阵

| 操作 | 用户自己 | 逝者 Owner | 其他人 |
|------|---------|-----------|--------|
| 关注逝者 | ✅ | ✅ | ✅ |
| 取消关注 | ✅ | ❌ | ❌ |
| 移除关注者 | ❌ | ✅ | ❌ |

### 设计原则

1. **用户自由**：任何人都可以关注公开的逝者，也可以自由取消关注
2. **Owner 权威**：Owner 有权管理关注者列表，保护隐私
3. **单向操作**：Owner 可以移除关注者，但不能强制用户关注

---

## ⚠️ 注意事项

### 1. 权限验证
- 使用 `is_admin()` 检查权限，确保只有 owner 可以操作
- 与 `kick_friend()` 等管理接口权限一致

### 2. 状态同步
- 移除关注者时，同时清理 `DeceasedFollowers` 和 `IsDeceasedFollower`
- 确保存储状态一致性

### 3. 事件通知
- 发送 `FollowerRemoved` 事件，前端可监听并更新 UI
- 被移除者可能需要前端轮询或订阅事件来感知变化

### 4. 与亲友团的独立性
- **关注** 和 **亲友团** 是两个独立的系统
- 移除关注者**不影响**亲友团成员身份
- 如需同时移除，需要分别调用 `remove_follower()` 和 `kick_friend()`

---

## 📊 完整功能对比

| 功能 | 接口 | 调用者 | 权限要求 | 事件 |
|------|------|--------|----------|------|
| 关注逝者 | `follow_deceased()` | 任何人 | 逝者公开 | `DeceasedFollowed` |
| 取消关注 | `unfollow_deceased()` | 关注者自己 | 已关注 | `DeceasedUnfollowed` |
| **移除关注者** | **`remove_follower()`** | **Owner** | **是 owner** | **`FollowerRemoved`** |
| 加入亲友团 | `apply_friend()` | 任何人 | 根据策略 | `FriendJoined` |
| 退出亲友团 | `leave_friend_group()` | 成员自己 | 是成员 | `FriendLeft` |
| 删除亲友 | `kick_friend()` | Owner | 是 owner | `FriendRemoved` |

---

## ✅ 编译结果

### pallet-deceased
```
✅ Finished `dev` profile [unoptimized + debuginfo] target(s) in 4.08s
```

### stardust-runtime
```
✅ Finished `dev` profile [unoptimized + debuginfo] target(s) in 40.40s
```

**所有编译测试通过！无错误！**

---

## 🚀 总结

我们成功添加了 **owner 删除关注者**的功能，现在逝者的 owner 可以：

✅ **查看关注者列表**：了解谁在关注
✅ **移除不希望的关注者**：保护隐私
✅ **防止骚扰**：主动管理关注者
✅ **独立于亲友团**：关注和亲友团分开管理

这个功能与现有的关注系统完美集成，提供了更强的隐私保护和管理能力！🎉
