# Phase 3 任务规划

## 📋 总览

**阶段**: Phase 3 - 完善与优化  
**目标**: 完成遗留整合任务、前端集成、性能优化  
**预计总耗时**: 20-25小时  
**开始日期**: 2025-10-28

---

## 🎯 任务列表

### 🔴 高优先级任务（必须完成）

#### 1️⃣ **Memorial Integration** - 纪念服务层整合
**优先级**: 🔴 最高  
**预计耗时**: 12-15小时  
**复杂度**: ⭐⭐⭐⭐⭐ 高

**整合内容**:
- 将 `pallet-memo-offerings`（供奉业务）整合到 `pallet-memorial`
- 将 `pallet-memo-sacrifice`（祭祀品目录）整合到 `pallet-memorial`
- 统一纪念服务层接口

**技术挑战**:
- ⚠️ 涉及复杂的依赖关系（membership、deceased、ipfs）
- ⚠️ 需要处理链上/链下数据同步
- ⚠️ 存储迁移逻辑复杂
- ⚠️ 治理权限整合

**实施策略**: 完整功能迁移
- 创建 `offerings.rs` 和 `catalog.rs` 两个子模块
- 迁移所有类型、存储、事件、错误
- 迁移所有可调用函数
- 统一 Config trait
- 更新 Runtime 配置

**技术方案**: 已完成（见 `/docs/Phase2-纪念层整合方案.md`）

**预期成果**:
- ✅ 减少2个独立pallet
- ✅ 统一纪念服务层架构
- ✅ 降低维护成本
- ✅ 优化gas成本

**风险评估**: 🟡 中等风险
- 依赖关系复杂，需要仔细处理trait接口
- IPFS自动pin逻辑需要保留
- 治理调用需要正确迁移

---

#### 2️⃣ **Trading 前端集成** - OTC交易系统UI
**优先级**: 🔴 高  
**预计耗时**: 5-6小时  
**复杂度**: ⭐⭐⭐ 中

**集成内容**:
- OTC订单管理界面
- 做市商管理界面
- SimpleBridge跨链桥界面

**UI组件**:
```
src/components/trading/
├── otc/
│   ├── CreateOrderForm.tsx      # 创建OTC订单
│   ├── OrderList.tsx             # 订单列表
│   ├── OrderDetail.tsx           # 订单详情
│   └── MyOrders.tsx              # 我的订单
├── maker/
│   ├── MakerRegistration.tsx     # 做市商注册
│   ├── MakerProfile.tsx          # 做市商资料
│   ├── MakerDashboard.tsx        # 做市商仪表板
│   └── MarketMakerList.tsx       # 做市商列表
└── bridge/
    ├── BridgeForm.tsx            # 跨链桥表单
    ├── BridgeHistory.tsx         # 桥接历史
    └── BridgeStatus.tsx          # 桥接状态
```

**服务层**:
```
src/services/
├── tradingService.ts             # 统一交易服务
├── otcService.ts                 # OTC服务
├── makerService.ts               # 做市商服务
└── bridgeService.ts              # 跨链桥服务
```

**类型定义**:
```
src/types/
└── trading.ts                    # Trading类型定义
```

**预期成果**:
- ✅ 用户可以通过UI创建和管理OTC订单
- ✅ 做市商可以注册、管理资料、提交epay配置
- ✅ 用户可以使用SimpleBridge跨链桥

---

#### 3️⃣ **Deceased 前端集成** - 逝者数据管理UI
**优先级**: 🔴 高  
**预计耗时**: 4-5小时  
**复杂度**: ⭐⭐⭐ 中

**集成内容**:
- Text模块：文章、留言、悼词管理
- Media模块：相册、视频集、媒体管理

**UI组件**:
```
src/components/deceased/
├── text/
│   ├── ArticleEditor.tsx         # 文章编辑器
│   ├── MessageBoard.tsx          # 留言板
│   ├── EulogyList.tsx            # 悼词列表
│   └── LifeStory.tsx             # 生平故事
└── media/
    ├── AlbumManager.tsx          # 相册管理
    ├── PhotoGallery.tsx          # 照片画廊
    ├── VideoCollection.tsx       # 视频集
    └── MediaUploader.tsx         # 媒体上传
```

**服务层**:
```
src/services/
├── deceasedTextService.ts        # 文本服务
└── deceasedMediaService.ts       # 媒体服务
```

**类型定义**:
```
src/types/
└── deceased.ts                   # Deceased类型定义
```

**预期成果**:
- ✅ 用户可以创建和编辑逝者的文本内容
- ✅ 用户可以上传和管理逝者的媒体内容
- ✅ 支持相册、视频集的创建和管理

---

### 🟡 中优先级任务（建议完成）

#### 4️⃣ **性能优化与基准测试**
**优先级**: 🟡 中  
**预计耗时**: 3-4小时  
**复杂度**: ⭐⭐⭐ 中

**优化内容**:
- 整合后pallet的性能基准测试
- Weight函数优化
- 存储访问优化
- 批量操作优化

**基准测试范围**:
- `pallet-trading`：所有核心函数
- `pallet-credit`：信用评分和更新函数
- `pallet-deceased`：文本和媒体创建函数
- `pallet-memorial`（待整合）：供奉和祭祀函数

**预期成果**:
- ✅ 准确的Weight计算
- ✅ 优化的gas成本
- ✅ 性能报告文档

---

#### 5️⃣ **测试覆盖补充**
**优先级**: 🟡 中  
**预计耗时**: 4-5小时  
**复杂度**: ⭐⭐⭐ 中

**测试内容**:
- 单元测试（每个pallet的核心函数）
- 集成测试（pallet间交互）
- 边界条件测试
- 错误处理测试

**测试覆盖**:
```
pallets/trading/src/tests.rs       # Trading单元测试
pallets/credit/src/tests.rs        # Credit单元测试
pallets/deceased/src/tests.rs      # Deceased单元测试
pallets/memorial/src/tests.rs      # Memorial单元测试（待创建）
tests/integration/                 # 集成测试
```

**预期成果**:
- ✅ 核心功能有完整的单元测试
- ✅ 关键交互有集成测试
- ✅ 边界条件和错误处理有测试覆盖

---

#### 6️⃣ **文档完善**
**优先级**: 🟡 中  
**预计耗时**: 2-3小时  
**复杂度**: ⭐⭐ 低

**文档内容**:
- 每个pallet的README更新
- API文档生成
- 使用示例补充
- 前端集成使用说明

**文档列表**:
```
pallets/trading/README.md          # Trading完整文档
pallets/credit/README.md           # Credit完整文档（已存在）
pallets/deceased/README.md         # Deceased完整文档
pallets/memorial/README.md         # Memorial完整文档（待创建）
stardust-dapp/docs/                # 前端集成文档汇总
```

**预期成果**:
- ✅ 每个pallet有完整的README
- ✅ 前端集成有详细的使用说明
- ✅ API文档清晰完整

---

### 🟢 可选任务（视情况而定）

#### 7️⃣ **Affiliate功能评估**
**优先级**: 🟢 低  
**预计耗时**: 2-3小时  
**复杂度**: ⭐⭐ 低

**评估内容**:
- 重新评估Affiliate功能的必要性
- 分析当前三个affiliate pallet的使用情况
- 如需整合，制定详细方案

**当前状态**:
- `pallet-affiliate-buy` - 买家推荐
- `pallet-affiliate-make` - 做市商推荐
- `pallet-affiliate-invite` - 邀请系统

**评估结果**:
- 如不需要 → 标记为废弃，移到 `archived-pallets/`
- 如需要 → 制定整合方案，可能在Phase 4实施

---

#### 8️⃣ **技术债务清理**
**优先级**: 🟢 低  
**预计耗时**: 2-3小时  
**复杂度**: ⭐⭐ 低

**清理内容**:
- 移除 `pallet-evidence` 中的临时占位符
- 清理 `#[allow(dead_code)]` 标记
- 优化TRON交易hash管理机制
- 代码格式化和lint检查

**预期成果**:
- ✅ 无临时性代码
- ✅ 无未使用的代码警告
- ✅ 代码质量提升

---

## 📅 实施计划

### Week 1（Day 1-3）
**重点**: Memorial Integration
- Day 1: 迁移 `sacrifice` 到 `catalog.rs`（5小时）
- Day 2: 迁移 `offerings` 到 `offerings.rs`（5小时）
- Day 3: 统一Config + Runtime更新 + 编译（4小时）

### Week 1（Day 4-5）
**重点**: 前端集成 - Trading
- Day 4: OTC + Maker UI组件（3小时）
- Day 4: Bridge UI组件 + 服务层（3小时）
- Day 5: 测试和优化（2小时）

### Week 2（Day 6-7）
**重点**: 前端集成 - Deceased
- Day 6: Text模块UI组件（2.5小时）
- Day 6: Media模块UI组件（2.5小时）
- Day 7: 服务层 + 测试（2小时）

### Week 2（Day 8-10）
**重点**: 优化与测试
- Day 8: 性能基准测试（3小时）
- Day 9: 单元测试和集成测试（4小时）
- Day 10: 文档完善 + 技术债务清理（3小时）

---

## 🎯 Phase 3 成功标准

### 必须达成（核心目标）
- ✅ Memorial整合完成，减少2个独立pallet
- ✅ Trading和Deceased的前端UI完成
- ✅ 所有整合pallet通过编译
- ✅ 生成完整的Phase 3完成报告

### 建议达成（质量目标）
- ✅ 核心功能有性能基准测试
- ✅ 关键功能有单元测试覆盖
- ✅ 每个pallet有完整的README

### 可选达成（加分项）
- ✅ Affiliate功能评估完成
- ✅ 技术债务清理完成
- ✅ 集成测试覆盖

---

## 📊 Phase 3 预期成果

### 代码层面
- **减少pallet数量**: 8个 → 5个（总共减少5个独立pallet）
  - Phase 2: 6个 → 3个
  - Phase 3: 8个 → 5个
- **前端集成**: 3个核心业务层（Trading、Credit、Deceased）
- **测试覆盖**: 核心功能有完整测试
- **文档完善**: 所有pallet有README

### 架构层面
- **纪念服务层统一**: offerings + sacrifice → memorial
- **前端架构完善**: 组件化设计 + 服务层抽象
- **性能优化**: Weight函数准确，gas成本优化
- **代码质量**: 无技术债务，lint检查通过

---

## ⚠️ 风险与应对

### 风险1: Memorial整合复杂度高
**应对**:
- 已有详细技术方案（`/docs/Phase2-纪念层整合方案.md`）
- 采用完整功能迁移策略，一次性解决
- 预留充足时间（12-15小时）

### 风险2: 前端集成工作量大
**应对**:
- 参考Credit模块的成功经验
- 组件化设计，提高复用性
- 遵循统一的UI风格（UI-GUIDE.md）

### 风险3: 性能和测试时间不足
**应对**:
- 将性能优化和测试标记为"中优先级"
- 可以在Phase 4继续完善
- 优先保证核心功能完成

---

## 🚀 立即开始

### 推荐启动顺序

**选项 A: Memorial整合优先（强烈推荐）**
- 原因：技术方案已完成，是遗留的最大任务
- 耗时：12-15小时
- 收益：减少2个pallet，统一纪念服务层

**选项 B: 前端集成优先**
- 原因：快速提升用户体验
- 耗时：9-11小时（Trading + Deceased）
- 收益：完整的前端UI，用户可以使用所有功能

**选项 C: 并行推进**
- 后端开发者：Memorial整合
- 前端开发者：Trading + Deceased前端集成
- 收益：最快完成Phase 3

---

## 📞 下一步行动

请选择您希望的启动方式：

**A. Memorial整合优先** - 立即开始Memorial Integration
**B. 前端集成优先** - 先完成Trading和Deceased的前端UI
**C. 自定义顺序** - 告诉我您希望的任务顺序

我建议选择 **选项 A**，因为：
1. ✅ 技术方案已经准备好（`Phase2-纪念层整合方案.md`）
2. ✅ Memorial是最后一个重要的整合任务
3. ✅ 完成后可以专心做前端集成和优化
4. ✅ 后续任务不依赖Memorial

---

*规划生成日期: 2025-10-28*  
*Stardust项目 - Phase 3 任务规划*

