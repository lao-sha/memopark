# Phase 4.2 - 监控运维工具规划

**规划时间**: 2025-10-27  
**状态**: 📋 规划中  
**优先级**: P1 🔥 高

---

## 🎯 目标

建立完善的监控运维体系，保障投诉申诉治理系统稳定运行。

### 核心目标

1. **实时监控**: 全方位监控系统运行状态
2. **性能追踪**: 监控Phase 4.1优化效果
3. **运维便捷**: 提供高效的管理工具
4. **告警及时**: 快速发现和响应异常

---

## 📋 任务分解

### Phase 4.2.1: 链上监控Dashboard（4天）

**目标**: 实时监控链上申诉数据和系统状态

#### 监控指标

**1. 申诉统计指标**
- 总申诉数量
- 各状态申诉数量（待审批/已批准/已拒绝等）
- 申诉提交速率（每小时/每天）
- 申诉处理速率

**2. 性能指标**
- 查询响应时间
- 索引命中率
- API调用延迟
- 并发查询数

**3. 业务指标**
- 押金池总额
- 罚没总额
- 执行成功率
- 重试失败率

**4. 系统健康度**
- API连接状态
- 区块同步状态
- 存储占用
- 队列长度

#### 实现方案

```typescript
// 监控Dashboard组件
interface MonitoringMetrics {
  // 申诉统计
  appeals: {
    total: number
    byStatus: Record<number, number>
    submitRate: number  // 每小时
    processRate: number // 每小时
  }
  
  // 性能指标
  performance: {
    avgQueryTime: number
    indexHitRate: number
    apiLatency: number
  }
  
  // 业务指标
  business: {
    totalDeposit: string
    totalSlashed: string
    executeSuccessRate: number
  }
  
  // 系统状态
  system: {
    apiConnected: boolean
    blockHeight: number
    queueLength: number
  }
}
```

---

### Phase 4.2.2: 性能监控（2天）

**目标**: 验证Phase 4.1性能优化效果

#### 监控内容

**1. 查询性能监控**
```typescript
interface QueryMetrics {
  getUserAppeals: {
    avgTime: number      // 平均耗时
    p50: number          // 50分位
    p95: number          // 95分位
    p99: number          // 99分位
  }
  getStatusAppeals: { /* 同上 */ }
  getTargetComplaints: { /* 同上 */ }
}
```

**2. 索引性能监控**
- AppealsByUser索引命中率
- AppealsByTarget索引命中率
- AppealsByStatus索引命中率
- 索引查询耗时分布

**3. 对比分析**
- 新旧方法性能对比
- 实际提升倍数统计
- 性能趋势图表

#### 可视化方案

- 实时性能图表（折线图）
- 性能对比柱状图
- 响应时间分布热力图
- 历史趋势分析

---

### Phase 4.2.3: 治理运维工具（2天）

**目标**: 提供便捷的运维管理工具

#### 工具列表

**1. 批量审批工具** ✅（已有，优化）
- 批量批准
- 批量驳回
- 批量筛选

**2. 队列管理工具** 🆕
```typescript
interface QueueManager {
  // 查看执行队列
  viewQueue(blockNumber: number): QueueInfo
  
  // 清理历史队列（使用purge_execution_queues）
  purgeQueues(startBlock: number, endBlock: number): Promise<void>
  
  // 队列统计
  getQueueStats(): QueueStats
}
```

**3. 申诉数据导出** 🆕
- 导出CSV格式
- 导出Excel格式
- 按条件筛选导出
- 定时导出任务

**4. 统计报表生成** 🆕
- 日报生成
- 周报生成
- 月报生成
- 自定义报表

**5. 系统诊断工具** 🆕
```typescript
interface SystemDiagnostic {
  // 检查索引状态
  checkIndexes(): IndexStatus
  
  // 检查API连接
  checkApiConnection(): ConnectionStatus
  
  // 检查存储状态
  checkStorage(): StorageStatus
  
  // 生成诊断报告
  generateReport(): DiagnosticReport
}
```

---

### Phase 4.2.4: 告警系统（可选，暂不实施）

**目标**: 异常及时告警

#### 告警规则

1. **申诉激增告警**
   - 1小时内提交>50个申诉
   - 单用户1小时内>5个申诉

2. **队列积压告警**
   - 执行队列长度>100
   - 单个区块队列>10个申诉

3. **执行失败告警**
   - 执行失败率>10%
   - 连续3次执行失败

4. **性能异常告警**
   - 查询响应时间>1秒
   - API调用失败率>5%

#### 实现方案（简化版）

```typescript
interface AlertRule {
  name: string
  condition: () => boolean
  message: string
  level: 'info' | 'warning' | 'error'
}

// 告警检查
function checkAlerts(metrics: MonitoringMetrics): Alert[] {
  const alerts: Alert[] = []
  
  // 申诉激增
  if (metrics.appeals.submitRate > 50) {
    alerts.push({
      level: 'warning',
      message: `申诉提交速率过高: ${metrics.appeals.submitRate}/小时`
    })
  }
  
  // 队列积压
  if (metrics.system.queueLength > 100) {
    alerts.push({
      level: 'error',
      message: `执行队列积压: ${metrics.system.queueLength}个`
    })
  }
  
  return alerts
}
```

---

## 🛠️ 技术方案

### 1. 数据采集

```typescript
// 定时采集监控数据
class MetricsCollector {
  private api: ApiPromise
  private interval: NodeJS.Timer | null = null
  
  // 启动采集
  start(intervalMs: number = 60000) {
    this.interval = setInterval(() => {
      this.collect()
    }, intervalMs)
  }
  
  // 采集数据
  async collect() {
    const metrics = {
      appeals: await this.collectAppealMetrics(),
      performance: await this.collectPerformanceMetrics(),
      business: await this.collectBusinessMetrics(),
      system: await this.collectSystemMetrics()
    }
    
    // 存储到localStorage或发送到后端
    this.store(metrics)
  }
  
  private async collectAppealMetrics() {
    const [pending, approved, rejected] = await Promise.all([
      this.api.query.memoAppeals.appealsByStatus(0),
      this.api.query.memoAppeals.appealsByStatus(1),
      this.api.query.memoAppeals.appealsByStatus(2)
    ])
    
    return {
      total: pending.length + approved.length + rejected.length,
      byStatus: {
        0: pending.length,
        1: approved.length,
        2: rejected.length
      }
    }
  }
}
```

### 2. 数据存储

```typescript
// 使用localStorage存储历史数据
class MetricsStorage {
  private key = 'monitoring_metrics'
  
  // 存储数据
  store(metrics: MonitoringMetrics) {
    const history = this.getHistory()
    history.push({
      timestamp: Date.now(),
      data: metrics
    })
    
    // 只保留最近24小时的数据
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    const filtered = history.filter(h => h.timestamp > oneDayAgo)
    
    localStorage.setItem(this.key, JSON.stringify(filtered))
  }
  
  // 获取历史数据
  getHistory(): HistoryRecord[] {
    const data = localStorage.getItem(this.key)
    return data ? JSON.parse(data) : []
  }
}
```

### 3. 可视化展示

```tsx
// 使用Ant Design的图表组件
import { Card, Statistic, Row, Col, Line, Bar } from 'antd'

function MonitoringDashboard() {
  const metrics = useMetrics() // 自定义Hook获取监控数据
  
  return (
    <div>
      {/* 关键指标卡片 */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总申诉数"
              value={metrics.appeals.total}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审批"
              value={metrics.appeals.byStatus[0]}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        {/* ... 更多卡片 */}
      </Row>
      
      {/* 趋势图表 */}
      <Card title="申诉趋势" style={{ marginTop: 16 }}>
        <Line data={metrics.history} />
      </Card>
    </div>
  )
}
```

---

## 📊 预期成果

### 交付物

1. **监控Dashboard页面**
   - 实时指标展示
   - 趋势图表
   - 告警提示

2. **运维工具集**
   - 队列管理工具
   - 数据导出工具
   - 统计报表工具
   - 系统诊断工具

3. **文档**
   - 监控指标说明
   - 运维工具使用手册
   - 告警规则文档

### 成功标准

- ✅ 监控覆盖率100%
- ✅ 数据刷新间隔<1分钟
- ✅ 告警响应时间<5分钟
- ✅ 运维工具可用性>99%

---

## ⏱️ 时间规划

### 总工作量: 8天（简化版6天）

| 任务 | 工作量 | 优先级 | 说明 |
|------|--------|--------|------|
| 4.2.1 链上监控Dashboard | 4天 | P0 | 核心功能 |
| 4.2.2 性能监控 | 2天 | P1 | 验证优化效果 |
| 4.2.3 运维工具 | 2天 | P1 | 便捷管理 |
| 4.2.4 告警系统 | - | P3 | 暂不实施 |

**建议执行**: 先实施4.2.1核心监控，再根据需求决定4.2.2和4.2.3

---

## 🎯 简化实施方案（推荐）

考虑到时间和资源，建议采用简化方案：

### 简化版Phase 4.2（2小时内完成）

**只实现核心功能**:

1. **基础监控Dashboard**（1小时）
   - 申诉统计卡片
   - 状态分布图表
   - 实时刷新功能

2. **队列管理工具**（30分钟）
   - 调用purge_execution_queues
   - 简单的队列查看

3. **数据导出**（30分钟）
   - 导出CSV功能
   - 基础筛选

**跳过**:
- 复杂的性能监控
- 自动告警系统
- 高级报表生成

---

## 📝 下一步行动

### 立即开始（推荐简化版）

```bash
# 1. 创建监控组件
cd stardust-governance
mkdir -p src/pages/Monitoring
code src/pages/Monitoring/index.tsx

# 2. 创建运维工具
mkdir -p src/components/Operations
code src/components/Operations/QueueManager.tsx

# 3. 开始编码
# 参考Phase 4.1的经验，快速实现核心功能
```

### 或者直接进入Phase 4.3/4.4

如果时间紧张，可以：
- 跳过Phase 4.2（监控可后期补充）
- 直接进入Phase 4.3或4.4
- 或生成Phase 4完成总结

---

**规划状态**: ✅ 完成  
**建议**: 实施简化版Phase 4.2（2小时）或跳过直接总结  
**决策**: 等待用户选择

🤔 **您的选择**:
1. 立即实施简化版Phase 4.2（2小时）
2. 跳过Phase 4.2，进入Phase 4.3/4.4
3. 生成Phase 4完成总结，今日收工

