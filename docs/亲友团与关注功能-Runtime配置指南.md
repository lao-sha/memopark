# 亲友团与关注功能 - Runtime 配置指南

## 一、代码实现总结

### 1.1 已完成的 Pallet 代码修改

✅ **pallet-deceased (逝者关注功能)**:
- 新增存储：`DeceasedFollowers`, `IsDeceasedFollower`
- 新增事件：`DeceasedFollowed`, `DeceasedUnfollowed`, `AutoJoinedFriend`
- 新增错误：`AlreadyFollowing`, `NotFollowing`
- 新增接口：`follow_deceased()`, `unfollow_deceased()`
- 文件路径：`pallets/deceased/src/lib.rs`

✅ **pallet-stardust-grave (纪念馆关注功能)**:
- 重新启用：`follow()`, `unfollow()`
- 保留存储：`FollowersOf`, `IsFollower`, `LastFollowAction`
- 功能增强：支持押金配置、冷却时间、容量限制
- 文件路径：`pallets/stardust-grave/src/lib.rs`

### 1.2 待实现的功能

⚠️ **供奉自动加入亲友团逻辑**:
- 需要在 Runtime 中实现 `OnOfferingCommitted` trait
- 监听供奉事件，自动调用 deceased pallet 的逻辑
- 详见下方"Runtime 配置步骤"

## 二、Runtime 配置步骤

### 2.1 更新 pallet-deceased 配置

在 `runtime/src/configs/mod.rs` 或相应配置文件中，为 `pallet_deceased` 添加 `MaxFollowers` 参数：

```rust
// runtime/src/configs/deceased.rs 或 runtime/src/configs/mod.rs

impl pallet_deceased::Config for Runtime {
    // ... 现有配置 ...

    /// 函数级中文注释：每个逝者最大关注者数量
    /// - 建议值：10000（防止状态膨胀）
    /// - 可根据实际需求调整
    type MaxFollowers = ConstU32<10000>;
}
```

### 2.2 实现供奉自动加入亲友团

在 Runtime 中实现 `OnOfferingCommitted` trait，监听供奉事件并自动加入亲友团：

```rust
// runtime/src/lib.rs 或 runtime/src/configs/memorial.rs

use pallet_memorial::OnOfferingCommitted;
use pallet_deceased::{FriendsOf, FriendCount, FriendRecord, FriendRole};

/// 函数级详细中文注释：供奉提交后的回调处理
///
/// ### 功能说明
/// 当用户给逝者供奉时，自动将其加入逝者的亲友团。
///
/// ### 逻辑
/// 1. 判断供奉目标类型（domain=0 表示逝者）
/// 2. 检查用户是否已是亲友团成员
/// 3. 如果不是，自动加入为 Member 角色
/// 4. 发送 AutoJoinedFriend 事件
pub struct OfferingCallback;

impl OnOfferingCommitted<AccountId> for OfferingCallback {
    fn on_offering(
        target: (u8, u64),
        _kind_code: u8,
        who: &AccountId,
        _amount: u128,
        _duration_weeks: Option<u32>,
    ) {
        // ⭐ 仅当供奉目标是逝者时(domain=0)，才自动加入亲友团
        if target.0 == 0 {
            let deceased_id: u64 = target.1;

            // 检查是否已是亲友团成员
            if !FriendsOf::<Runtime>::contains_key(deceased_id, who) {
                // 获取当前区块号
                let now = frame_system::Pallet::<Runtime>::block_number();

                // 创建亲友记录（普通成员）
                let friend_record = FriendRecord {
                    role: FriendRole::Member,
                    since: now,
                    note: Default::default(),
                };

                // 插入到亲友团
                FriendsOf::<Runtime>::insert(deceased_id, who, friend_record);

                // 更新亲友团计数
                let count = FriendCount::<Runtime>::get(deceased_id);
                FriendCount::<Runtime>::insert(deceased_id, count.saturating_add(1));

                // 发送自动加入事件
                frame_system::Pallet::<Runtime>::deposit_event(
                    pallet_deceased::Event::<Runtime>::AutoJoinedFriend {
                        deceased_id: deceased_id.into(),
                        who: who.clone(),
                    }
                );
            }
        }
    }
}

// 将回调注入到 memorial pallet 配置中
impl pallet_memorial::Config for Runtime {
    // ... 其他配置 ...

    /// 函数级中文注释：供奉提交后的回调
    type OnOfferingCommitted = OfferingCallback;
}
```

### 2.3 验证 pallet-stardust-grave 配置

确保 `pallet_stardust_grave` 的以下配置参数已正确设置：

```rust
// runtime/src/configs/mod.rs 或 runtime/src/configs/grave.rs

impl pallet_stardust_grave::Config for Runtime {
    // ... 其他配置 ...

    /// 函数级中文注释：关注押金（建议设为0，无押金模式）
    type FollowDeposit = ConstU128<0>;

    /// 函数级中文注释：每个墓位最大关注者数量
    type MaxFollowers = ConstU32<10000>;

    /// 函数级中文注释：关注操作冷却时间（块数，约10分钟）
    type FollowCooldownBlocks = ConstU32<100>;
}
```

## 三、编译与测试

### 3.1 编译检查

```bash
# 检查所有 pallet 编译通过
cargo check --workspace

# 编译 runtime
cargo build --release
```

### 3.2 功能测试

#### 测试逝者关注功能

```javascript
// 使用 Polkadot-JS 进行测试

// 1. 关注逝者
await api.tx.deceased.followDeceased(deceasedId).signAndSend(alice);

// 2. 查询关注状态
const isFollowing = await api.query.deceased.isDeceasedFollower(deceasedId, alice.address);
console.log('是否关注:', isFollowing.isSome);

// 3. 查询关注者列表
const followers = await api.query.deceased.deceasedFollowers(deceasedId);
console.log('关注者列表:', followers.toJSON());

// 4. 取消关注
await api.tx.deceased.unfollowDeceased(deceasedId).signAndSend(alice);
```

#### 测试墓位关注功能

```javascript
// 1. 关注墓位
await api.tx.stardustGrave.follow(graveId).signAndSend(alice);

// 2. 查询关注状态
const isFollowing = await api.query.stardustGrave.isFollower(graveId, alice.address);
console.log('是否关注墓位:', isFollowing.isSome);

// 3. 取消关注
await api.tx.stardustGrave.unfollow(graveId).signAndSend(alice);
```

#### 测试供奉自动加入亲友团

```javascript
// 1. 检查当前是否为亲友团成员
const isFriend = await api.query.deceased.friendsOf(deceasedId, alice.address);
console.log('供奉前是否为亲友:', isFriend.isSome);

// 2. 进行供奉（假设 deceasedId 对应 domain=0）
const target = [0, deceasedId];  // [domain, id]
await api.tx.memorial.offer(target, kindCode, media, duration).signAndSend(alice);

// 3. 监听自动加入事件
api.query.system.events((events) => {
    events.forEach(({ event }) => {
        if (event.section === 'deceased' && event.method === 'AutoJoinedFriend') {
            const [deceasedId, who] = event.data;
            console.log(`用户 ${who} 自动加入逝者 ${deceasedId} 的亲友团`);
        }
    });
});

// 4. 再次检查是否为亲友团成员
const isFriendAfter = await api.query.deceased.friendsOf(deceasedId, alice.address);
console.log('供奉后是否为亲友:', isFriendAfter.isSome);
```

## 四、前端集成建议

### 4.1 关注按钮组件

```typescript
// src/components/FollowButton.tsx

import { useEffect, useState } from 'react';
import { Button } from 'antd';
import { useApi, useAccount } from '@/hooks';

interface FollowButtonProps {
    type: 'deceased' | 'grave';
    targetId: number;
}

export const FollowButton: React.FC<FollowButtonProps> = ({ type, targetId }) => {
    const { api } = useApi();
    const { account } = useAccount();
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        checkFollowStatus();
    }, [type, targetId, account]);

    const checkFollowStatus = async () => {
        if (!api || !account) return;

        const query = type === 'deceased'
            ? api.query.deceased.isDeceasedFollower(targetId, account.address)
            : api.query.stardustGrave.isFollower(targetId, account.address);

        const result = await query;
        setIsFollowing(result.isSome);
    };

    const handleFollow = async () => {
        if (!api || !account) return;

        setLoading(true);
        try {
            const tx = type === 'deceased'
                ? api.tx.deceased.followDeceased(targetId)
                : api.tx.stardustGrave.follow(targetId);

            await tx.signAndSend(account.address, ({ status }) => {
                if (status.isInBlock) {
                    setIsFollowing(true);
                    setLoading(false);
                }
            });
        } catch (error) {
            console.error('关注失败:', error);
            setLoading(false);
        }
    };

    const handleUnfollow = async () => {
        if (!api || !account) return;

        setLoading(true);
        try {
            const tx = type === 'deceased'
                ? api.tx.deceased.unfollowDeceased(targetId)
                : api.tx.stardustGrave.unfollow(targetId);

            await tx.signAndSend(account.address, ({ status }) => {
                if (status.isInBlock) {
                    setIsFollowing(false);
                    setLoading(false);
                }
            });
        } catch (error) {
            console.error('取消关注失败:', error);
            setLoading(false);
        }
    };

    return (
        <Button
            type={isFollowing ? 'default' : 'primary'}
            onClick={isFollowing ? handleUnfollow : handleFollow}
            loading={loading}
        >
            {isFollowing ? '已关注' : '关注'}
        </Button>
    );
};
```

### 4.2 亲友团状态显示

```typescript
// src/components/FriendStatus.tsx

import { useEffect, useState } from 'react';
import { Tag } from 'antd';
import { useApi, useAccount } from '@/hooks';

interface FriendStatusProps {
    deceasedId: number;
}

export const FriendStatus: React.FC<FriendStatusProps> = ({ deceasedId }) => {
    const { api } = useApi();
    const { account } = useAccount();
    const [isFriend, setIsFriend] = useState(false);
    const [role, setRole] = useState<'Member' | 'Core' | null>(null);

    useEffect(() => {
        checkFriendStatus();
    }, [deceasedId, account]);

    const checkFriendStatus = async () => {
        if (!api || !account) return;

        const friendRecord = await api.query.deceased.friendsOf(deceasedId, account.address);

        if (friendRecord.isSome) {
            setIsFriend(true);
            const record = friendRecord.unwrap();
            setRole(record.role.isMember ? 'Member' : 'Core');
        } else {
            setIsFriend(false);
            setRole(null);
        }
    };

    if (!isFriend) return null;

    return (
        <Tag color={role === 'Core' ? 'gold' : 'blue'}>
            {role === 'Core' ? '核心亲友' : '亲友团成员'}
        </Tag>
    );
};
```

## 五、注意事项

### 5.1 性能考虑

- **关注者上限**：建议设置 `MaxFollowers = 10000`，防止单个实体关注者过多导致状态膨胀
- **冷却时间**：建议设置 `FollowCooldownBlocks = 100`（约10分钟），防止恶意频繁操作
- **押金机制**：墓位关注可设置押金（建议为0），逝者关注无押金

### 5.2 安全考虑

- **可见性控制**：只有公开的逝者和墓位才能被关注
- **权限验证**：自动加入亲友团不需要额外权限，但需要用户实际支付供奉费用
- **防刷机制**：通过供奉费用天然防止恶意刷亲友团

### 5.3 兼容性

- **旧关注数据**：墓位的旧关注数据保留，用户可继续使用
- **接口保持**：关注接口的 call_index 保持不变（follow=20, unfollow=21）
- **事件兼容**：新增事件不影响旧事件监听

## 六、常见问题

### Q1: 供奉后没有自动加入亲友团？

**A**: 检查以下几点：
1. 供奉的 target 参数 domain 是否为 0（逝者）
2. Runtime 中是否正确实现了 `OnOfferingCommitted` trait
3. 查看链上日志，确认事件是否触发

### Q2: 关注功能报 PolicyViolation 错误？

**A**: 可能的原因：
1. 目标未公开（deceased 不可见或 grave 不公开）
2. 已经关注过（重复关注）
3. 冷却时间未到（刚取消关注）

### Q3: 如何区分亲友团和关注？

**A**:
- **亲友团**：通过 `deceased.friendsOf(deceased_id, account)` 查询
- **关注**：通过 `deceased.isDeceasedFollower(deceased_id, account)` 查询
- 两者是独立的，供奉会自动加入亲友团，但不会自动关注

## 七、总结

本次实现完成了：

✅ **逝者关注功能**（pallet-deceased）
- 纯社交功能，无押金，无前置条件
- 任何人都可以关注公开的逝者

✅ **墓位关注功能**（pallet-stardust-grave）
- 重新启用关注接口
- 支持押金配置（建议设为0）
- 可配置冷却时间和容量上限

⚠️ **供奉自动加入亲友团**（runtime 集成）
- 需要在 Runtime 中实现 `OnOfferingCommitted` trait
- 监听供奉事件，自动将用户加入亲友团
- 仅限供奉逝者（domain=0）时生效

按照本指南完成 Runtime 配置后，即可使用完整的亲友团与关注功能！
