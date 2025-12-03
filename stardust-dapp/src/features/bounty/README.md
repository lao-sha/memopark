# 悬赏问答功能模块

## 📖 功能概述

悬赏问答系统是基于占卜结果的专业解读问答平台，用户可以：
- 基于已有占卜结果发起悬赏
- 专业大师提交解读回答
- 社区投票选择最佳解读
- 自动分配多层奖励

## 🎯 核心设计原则

### 1. 悬赏必须基于占卜结果
- 不是普通的Q&A，而是针对占卜结果（卦象、命盘）的专业解读
- 每个悬赏必须关联一个有效的占卜结果ID
- 只有占卜结果的创建者才能发起悬赏

### 2. 多人奖励分配机制
采用 60/15/5/15/5 分配方案：
- **第一名**: 60% 悬赏金额
- **第二名**: 15% 悬赏金额
- **第三名**: 5% 悬赏金额
- **平台手续费**: 15%
- **参与奖池**: 5% (平分给其他参与者)

## 📁 文件结构

```
features/bounty/
├── components/                    # 子组件
│   ├── CreateBountyModal.tsx     # 悬赏创建弹窗
│   └── SubmitAnswerModal.tsx     # 回答提交弹窗
├── BountyListPage.tsx            # 悬赏列表页面
├── BountyListPage.css            # 列表页面样式
├── BountyDetailPage.tsx          # 悬赏详情页面
├── BountyDetailPage.css          # 详情页面样式
├── index.ts                       # 组件导出
└── README.md                      # 本文档
```

## 🔌 API服务

### BountyService (`src/services/bountyService.ts`)

提供与区块链的交互接口：

```typescript
// 创建悬赏
await service.createBounty(
  account,
  divinationType,
  resultId,
  questionText,
  bountyAmount,
  deadlineBlocks
);

// 提交回答
await service.submitBountyAnswer(account, bountyId, answerText);

// 投票
await service.voteBountyAnswer(account, bountyId, answerId);

// 采纳答案
await service.adoptBountyAnswers(account, bountyId, firstId, secondId, thirdId);

// 结算奖励
await service.settleBounty(account, bountyId);
```

## 📊 类型定义

### 核心类型 (`src/types/divination.ts`)

#### BountyQuestion
```typescript
interface BountyQuestion {
  id: number;
  creator: string;
  divinationType: DivinationType;
  resultId: number;                // 关联的占卜结果ID
  questionCid: string;
  bountyAmount: bigint;
  deadline: number;
  status: BountyStatus;
  answerCount: number;
  // ...
}
```

#### BountyAnswer
```typescript
interface BountyAnswer {
  id: number;
  bountyId: number;
  answerer: string;
  contentCid: string;
  status: BountyAnswerStatus;
  votes: number;
  rewardAmount: bigint;
  // ...
}
```

#### BountyStatus
```typescript
enum BountyStatus {
  Open = 0,        // 开放中
  Closed = 1,      // 已关闭
  Adopted = 2,     // 已采纳
  Settled = 3,     // 已结算
  Cancelled = 4,   // 已取消
  Expired = 5,     // 已过期
}
```

## 🎨 组件使用

### CreateBountyModal - 创建悬赏弹窗

```tsx
import { CreateBountyModal } from '@/features/bounty';

<CreateBountyModal
  visible={modalVisible}
  divinationType={DivinationType.Meihua}
  resultId={123}
  userAccount="5GrwvaEF..."
  onCancel={() => setModalVisible(false)}
  onSuccess={(bountyId) => {
    console.log('悬赏创建成功:', bountyId);
  }}
/>
```

### SubmitAnswerModal - 提交回答弹窗

```tsx
import { SubmitAnswerModal } from '@/features/bounty';

<SubmitAnswerModal
  visible={modalVisible}
  bounty={bountyData}
  userAccount="5GrwvaEF..."
  currentBlock={1000000}
  onCancel={() => setModalVisible(false)}
  onSuccess={(answerId) => {
    console.log('回答提交成功:', answerId);
  }}
/>
```

### BountyListPage - 悬赏列表页面

```tsx
import { BountyListPage } from '@/features/bounty';

<BountyListPage />
```

### BountyDetailPage - 悬赏详情页面

```tsx
import { BountyDetailPage } from '@/features/bounty';

<BountyDetailPage bountyId={123} />
```

## 🔄 业务流程

### 1. 创建悬赏流程
```
用户起卦 → 获得占卜结果 → 发起悬赏 → 设置悬赏金额和条件 → 资金托管到平台
```

### 2. 回答提交流程
```
大师查看悬赏 → 提交专业解读 → 内容上传到IPFS → 链上记录 → 等待采纳
```

### 3. 投票流程（可选）
```
社区成员 → 查看回答 → 投票支持 → 链上记录 → 影响采纳决策
```

### 4. 采纳和结算流程
```
创建者关闭悬赏 → 选择前三名答案 → 触发结算 → 自动分配奖励 → 完成
```

## ⚙️ 配置参数

### 默认奖励分配
```typescript
const DEFAULT_REWARD_DISTRIBUTION = {
  firstPlace: 6000,       // 60%
  secondPlace: 1500,      // 15%
  thirdPlace: 500,        // 5%
  platformFee: 1500,      // 15%
  participationPool: 500, // 5%
};
```

### 最小悬赏金额
```typescript
const MIN_BOUNTY_AMOUNT = 100; // 100 DUST
```

### 默认回答数限制
```typescript
const DEFAULT_MIN_ANSWERS = 1;
const DEFAULT_MAX_ANSWERS = 10;
```

## 🔗 集成说明

### 1. 路由配置
在 `src/routes.tsx` 中添加：

```tsx
import { BountyListPage, BountyDetailPage } from '@/features/bounty';

{
  path: '/bounty',
  element: <BountyListPage />,
},
{
  path: '/bounty/:id',
  element: <BountyDetailPage />,
}
```

### 2. 占卜结果页面集成
在占卜结果详情页添加"发起悬赏"按钮：

```tsx
import { CreateBountyModal } from '@/features/bounty';

const [bountyModalVisible, setBountyModalVisible] = useState(false);

<Button
  type="primary"
  icon={<GiftOutlined />}
  onClick={() => setBountyModalVisible(true)}
>
  发起悬赏
</Button>

<CreateBountyModal
  visible={bountyModalVisible}
  divinationType={result.divinationType}
  resultId={result.id}
  userAccount={currentAccount}
  onCancel={() => setBountyModalVisible(false)}
  onSuccess={(bountyId) => {
    setBountyModalVisible(false);
    // 跳转到悬赏详情页
    navigate(`/bounty/${bountyId}`);
  }}
/>
```

## 🚀 待完善功能

### 高优先级
- [ ] 完善IPFS上传/下载逻辑
- [ ] 集成Polkadot钱包签名
- [ ] 实现事件监听和状态更新
- [ ] 添加悬赏搜索和筛选

### 中优先级
- [ ] 支持更多占卜类型（八字、紫薇等）
- [ ] 添加提供者认证标识展示
- [ ] 实现社区投票权重计算
- [ ] 添加悬赏推荐算法

### 低优先级
- [ ] 悬赏历史记录
- [ ] 用户悬赏统计
- [ ] 大师收益排行榜
- [ ] 悬赏分享功能

## 📝 开发注意事项

1. **数据加载**: 所有内容CID都需要从IPFS加载实际内容
2. **权限控制**: 确保只有创建者可以采纳答案和结算
3. **时间处理**: 区块时间转换（6秒/块）需要准确
4. **金额显示**: 统一使用 `formatBountyAmount()` 格式化
5. **状态流转**: 严格遵守状态机，防止非法状态转换

## 🔒 安全考虑

1. **所有权验证**: 只有占卜结果创建者可以发起悬赏
2. **防重复**: 用户不能重复回答或投票
3. **时间检查**: 过期悬赏不接受新回答
4. **资金安全**: 悬赏金额托管在链上，结算自动执行

## 📞 联系方式

如有问题或建议，请联系开发团队。

---

**版本**: v1.0
**最后更新**: 2025-12-02
**维护者**: Stardust开发团队
