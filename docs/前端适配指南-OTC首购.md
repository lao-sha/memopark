# 前端适配指南：OTC首购功能（去首购池版）

**适配日期**: 2025-11-03  
**链端状态**: ✅ 已完成  
**前端状态**: ⏳ 待实施  
**预计工期**: 2-3天

---

## 📋 概述

链端OTC首购功能已全部实现，本指南提供前端适配的详细说明。

### 核心变更
- 固定USD价值：$10.00
- 动态DUST数量：根据实时汇率计算
- 做市商自由余额：不使用首购资金池
- 配额限制：每个做市商最多5个首购订单
- 订单超时：1小时未支付自动取消

---

## 🎯 任务清单

### 任务1：优化首购页面 ⏳

**文件**: `stardust-dapp/src/features/first-purchase/FirstPurchasePage.tsx`

**核心变更**:
```typescript
// ❌ 旧方案：固定DUST数量
const FIXED_DUST_AMOUNT = 1000;

// ✅ 新方案：固定USD价值，动态DUST
const FIXED_USD_VALUE = 10.00;
const dustAmount = calculateDustFromUsd(usdValue, dustToUsdRate);
```

**需要实现的功能**:

#### 1.1 显示固定USD价值
```tsx
<div className="fixed-usd-value">
  <Typography.Title level={3}>
    首购金额：$10.00 USD
  </Typography.Title>
  <Typography.Text type="secondary">
    根据实时汇率计算DUST数量
  </Typography.Text>
</div>
```

#### 1.2 实时显示DUST/USD汇率
```typescript
// 从链上查询汇率（通过 pallet-pricing）
const [dustToUsdRate, setDustToUsdRate] = useState<number | null>(null);
const [rateUpdateTime, setRateUpdateTime] = useState<Date>(new Date());

useEffect(() => {
  const fetchRate = async () => {
    const api = await getApi();
    // TODO: 实际实现需调用 pallet-pricing 的查询接口
    // 临时使用测试值
    setDustToUsdRate(0.01); // 1 DUST = 0.01 USD
    setRateUpdateTime(new Date());
  };
  
  fetchRate();
  const interval = setInterval(fetchRate, 60000); // 每分钟更新
  return () => clearInterval(interval);
}, []);
```

#### 1.3 动态显示计算的DUST数量
```typescript
const calculateDustAmount = (usdValue: number, rate: number): string => {
  if (!rate || rate === 0) return '计算中...';
  
  const dust = usdValue / rate;
  
  // 应用安全边界
  const MIN_DUST = 100;
  const MAX_DUST = 10000;
  const finalDust = Math.max(MIN_DUST, Math.min(MAX_DUST, dust));
  
  return formatDUST(finalDust);
};

// 在UI中显示
<div className="dynamic-dust-amount">
  <Statistic
    title="您将获得"
    value={calculateDustAmount(10, dustToUsdRate)}
    suffix="DUST"
  />
  <Typography.Text type="secondary">
    汇率：1 DUST = ${dustToUsdRate?.toFixed(4)} USD
    <br />
    更新时间：{rateUpdateTime.toLocaleTimeString()}
  </Typography.Text>
</div>
```

#### 1.4 调用新的 create_first_purchase API
```typescript
const handleCreateOrder = async (makerId: number) => {
  try {
    const api = await getApi();
    const account = await getCurrentAccount();
    
    // 生成承诺哈希
    const paymentCommit = generateCommitHash(paymentInfo);
    const contactCommit = generateCommitHash(contactInfo);
    
    // 调用新的 extrinsic
    const tx = api.tx.trading.createFirstPurchase(
      makerId,
      paymentCommit,
      contactCommit
    );
    
    await tx.signAndSend(account, ({ status, events }) => {
      if (status.isInBlock) {
        // 监听 FirstPurchaseOrderCreated 事件
        events.forEach(({ event }) => {
          if (api.events.trading.FirstPurchaseOrderCreated.is(event)) {
            const [orderId, buyer, maker, usdValue, dustAmount] = event.data;
            message.success(`首购订单创建成功！订单ID: ${orderId.toString()}`);
            message.info(`锁定汇率：1 DUST = $${(usdValue.toNumber() / 1000000 / dustAmount.toNumber() * 1e18).toFixed(4)} USD`);
            navigate(`/orders/${orderId.toString()}`);
          }
        });
      }
    });
  } catch (error) {
    // 错误处理
    if (error.message.includes('AlreadyFirstPurchased')) {
      message.error('您已完成首购，无法再次购买');
    } else if (error.message.includes('FirstPurchaseQuotaExhausted')) {
      message.error('该做市商首购配额已满，请选择其他做市商');
    } else if (error.message.includes('MakerInsufficientBalance')) {
      message.error('做市商余额不足，请选择其他做市商');
    } else if (error.message.includes('PricingUnavailable')) {
      message.error('价格数据暂时不可用，请稍后重试');
    } else {
      message.error(`创建订单失败：${error.message}`);
    }
  }
};
```

---

### 任务2：添加订单倒计时组件 ⏳

**文件**: `stardust-dapp/src/components/orders/OrderCountdown.tsx` (新建)

**组件实现**:
```tsx
import React, { useState, useEffect } from 'react';
import { Statistic, Alert, Typography } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';

interface OrderCountdownProps {
  expireAt: number; // Unix时间戳（毫秒）
  onExpire?: () => void;
}

export const OrderCountdown: React.FC<OrderCountdownProps> = ({ expireAt, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const remaining = expireAt - now;
      
      if (remaining <= 0) {
        setIsExpired(true);
        setTimeLeft(0);
        onExpire?.();
      } else {
        setTimeLeft(remaining);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expireAt, onExpire]);
  
  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const isUrgent = timeLeft < 5 * 60 * 1000; // 少于5分钟
  
  if (isExpired) {
    return (
      <Alert
        message="订单已过期"
        description="该订单未在1小时内支付，已自动取消并退款给做市商"
        type="error"
        showIcon
      />
    );
  }
  
  return (
    <div style={{ marginBottom: 16 }}>
      <Statistic
        title={
          <span>
            <ClockCircleOutlined style={{ marginRight: 8 }} />
            订单剩余时间
          </span>
        }
        value={formatTime(timeLeft)}
        valueStyle={{ 
          color: isUrgent ? '#cf1322' : '#3f8600',
          fontSize: '2em',
        }}
      />
      {isUrgent && (
        <Alert
          message="⚠️ 订单即将过期"
          description="请尽快完成支付，否则订单将自动取消"
          type="warning"
          showIcon
          style={{ marginTop: 8 }}
        />
      )}
      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
        过期时间：{new Date(expireAt).toLocaleString()}
      </Typography.Text>
    </div>
  );
};
```

**使用方式**:
```tsx
// 在订单详情页中使用
import { OrderCountdown } from '@/components/orders/OrderCountdown';

const OrderDetailPage: React.FC = () => {
  const { order } = useOrder(orderId);
  
  const handleExpire = () => {
    message.warning('订单已过期，即将跳转到订单列表');
    setTimeout(() => navigate('/orders'), 2000);
  };
  
  return (
    <div>
      {order.state === 'Created' && (
        <OrderCountdown 
          expireAt={order.expireAt} 
          onExpire={handleExpire}
        />
      )}
      {/* ... 其他订单详情 */}
    </div>
  );
};
```

---

### 任务3：优化做市商页面 ⏳

**文件**: `stardust-dapp/src/features/maker/MakerDashboard.tsx`

**核心变更**:

#### 3.1 查询首购配额状态
```typescript
const [firstPurchaseQuota, setFirstPurchaseQuota] = useState<{
  current: number;
  max: number;
  orders: number[];
}>({
  current: 0,
  max: 5,
  orders: [],
});

useEffect(() => {
  const fetchQuota = async () => {
    const api = await getApi();
    const makerId = await getMakerId();
    
    // 查询当前配额使用情况
    const count = await api.query.trading.makerFirstPurchaseCount(makerId);
    const orders = await api.query.trading.makerFirstPurchaseOrders(makerId);
    
    setFirstPurchaseQuota({
      current: count.toNumber(),
      max: 5, // 从配置获取
      orders: orders.toArray().map(id => id.toNumber()),
    });
  };
  
  fetchQuota();
  const interval = setInterval(fetchQuota, 30000); // 30秒刷新
  return () => clearInterval(interval);
}, []);
```

#### 3.2 显示首购配额状态
```tsx
<Card title="首购订单配额" style={{ marginBottom: 16 }}>
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
    <Progress
      type="circle"
      percent={(firstPurchaseQuota.current / firstPurchaseQuota.max) * 100}
      format={() => `${firstPurchaseQuota.current}/${firstPurchaseQuota.max}`}
      status={firstPurchaseQuota.current >= firstPurchaseQuota.max ? 'exception' : 'active'}
    />
    <div style={{ marginLeft: 24, flex: 1 }}>
      <Typography.Text strong style={{ fontSize: '1.2em' }}>
        当前配额：{firstPurchaseQuota.current}/{firstPurchaseQuota.max}
      </Typography.Text>
      <br />
      <Typography.Text type="secondary">
        {firstPurchaseQuota.current >= firstPurchaseQuota.max
          ? '⚠️ 配额已满，无法接收更多首购订单'
          : `✅ 还可接收 ${firstPurchaseQuota.max - firstPurchaseQuota.current} 个首购订单`}
      </Typography.Text>
    </div>
  </div>
  
  {/* 首购订单列表 */}
  <Divider>首购订单列表</Divider>
  <List
    dataSource={firstPurchaseQuota.orders}
    renderItem={orderId => (
      <List.Item
        actions={[
          <Button type="link" onClick={() => navigate(`/orders/${orderId}`)}>
            查看详情
          </Button>
        ]}
      >
        <List.Item.Meta
          avatar={<Badge status="processing" />}
          title={`订单 #${orderId}`}
          description={`首购订单 - 预计释放配额时间待查询`}
        />
      </List.Item>
    )}
  />
</Card>
```

#### 3.3 显示自由余额
```tsx
<Card title="资金状况" style={{ marginBottom: 16 }}>
  <Row gutter={16}>
    <Col span={8}>
      <Statistic
        title="保证金"
        value={formatDUST(makerDeposit)}
        suffix="DUST"
        prefix={<LockOutlined />}
      />
    </Col>
    <Col span={8}>
      <Statistic
        title="自由余额"
        value={formatDUST(freeBalance)}
        suffix="DUST"
        prefix={<WalletOutlined />}
      />
      <Typography.Text type="secondary" style={{ fontSize: '0.9em' }}>
        用于接收首购订单
      </Typography.Text>
    </Col>
    <Col span={8}>
      <Statistic
        title="预计可接首购"
        value={Math.floor(freeBalance / (10 / 0.01))} // 基于当前汇率估算
        suffix="单"
        prefix={<ShoppingOutlined />}
      />
    </Col>
  </Row>
</Card>
```

---

## 🔧 API参考

### 查询接口

#### 1. 查询首购配额
```typescript
// 查询做市商当前首购订单数
const count = await api.query.trading.makerFirstPurchaseCount(makerId);
// 返回: u32

// 查询做市商首购订单列表
const orders = await api.query.trading.makerFirstPurchaseOrders(makerId);
// 返回: BoundedVec<u64, 5>

// 查询买家是否已首购
const hasFirstPurchased = await api.query.trading.hasFirstPurchased(accountId);
// 返回: bool
```

#### 2. 查询订单信息
```typescript
// 查询订单详情
const order = await api.query.trading.orders(orderId);
// 返回: Option<Order>

// 订单结构
interface Order {
  // ... 现有字段
  is_first_purchase: boolean; // 🆕 是否为首购订单
}
```

### 交易接口

#### 创建首购订单
```typescript
const tx = api.tx.trading.createFirstPurchase(
  maker_id: u64,
  payment_commit: [u8; 32],
  contact_commit: [u8; 32]
);
```

### 事件监听

```typescript
// 监听首购订单创建事件
api.query.system.events((events) => {
  events.forEach(({ event }) => {
    if (api.events.trading.FirstPurchaseOrderCreated.is(event)) {
      const [orderId, buyer, makerId, usdValue, dustAmount] = event.data;
      console.log('首购订单创建:', {
        orderId: orderId.toString(),
        buyer: buyer.toString(),
        makerId: makerId.toNumber(),
        usdValue: usdValue.toNumber() / 1000000, // 转换为USD
        dustAmount: dustAmount.toString(),
      });
    }
  });
});

// 监听订单过期事件
if (api.events.trading.OrderExpired.is(event)) {
  const [orderId] = event.data;
  console.log('订单已过期:', orderId.toString());
}
```

---

## 🧪 测试清单

### 前端测试
- [ ] 首购页面显示固定USD价值
- [ ] 汇率实时更新（每分钟）
- [ ] DUST数量动态计算正确
- [ ] 安全边界显示（100-10,000 DUST）
- [ ] 创建订单成功
- [ ] 错误处理（已首购、配额满、余额不足、价格不可用）
- [ ] 倒计时组件显示正确
- [ ] 倒计时到期后自动跳转
- [ ] 做市商配额显示正确
- [ ] 首购订单列表显示正确

### 集成测试
- [ ] 端到端：创建首购订单 → 支付 → DUST释放 → 配额释放
- [ ] 端到端：创建首购订单 → 超时 → 自动取消 → 退款

---

## 📝 注意事项

### 1. 汇率获取
**当前状态**: Runtime使用临时测试值（1 DUST = 0.01 USD）  
**TODO**: 实际集成pallet-pricing后，前端需同步更新查询方式

### 2. 精度处理
- USD价值精度：10^6（1_000_000 = 1 USD）
- DUST精度：10^18
- 汇率精度：10^6

### 3. 边界保护
- 前端应显示边界提示："实际DUST数量在100-10,000范围内"
- 后端已实现边界保护，前端无需额外处理

### 4. 错误信息国际化
建议为所有错误消息添加中英文版本：
```typescript
const ERROR_MESSAGES = {
  AlreadyFirstPurchased: {
    zh: '您已完成首购，无法再次购买',
    en: 'You have already made your first purchase',
  },
  FirstPurchaseQuotaExhausted: {
    zh: '该做市商首购配额已满',
    en: 'This market maker has reached the first purchase quota',
  },
  // ...
};
```

---

## 🚀 实施步骤建议

1. **Day 1**: 实施任务1（首购页面优化）
   - 上午：实现USD/DUST动态计算
   - 下午：调整UI布局，接入API

2. **Day 2**: 实施任务2（倒计时组件）
   - 上午：开发倒计时组件
   - 下午：集成到订单详情页，测试

3. **Day 3**: 实施任务3（做市商页面）
   - 上午：实现配额查询和显示
   - 下午：完善UI，端到端测试

---

**祝开发顺利！如有疑问，请参考《OTC首购需求实施完成报告.md》**

