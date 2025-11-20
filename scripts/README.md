# Stardust 供奉品初始化脚本

> **数据来源**: 云上思念网站 (https://m.yssn.cn)  
> **提取日期**: 2025-11-08  
> **供奉品总数**: 541 个  
> **分类数量**: 11 个

---

## 📦 文件清单

### 数据文件

| 文件 | 说明 | 大小 |
|------|------|------|
| `offerings-data.json` | 原始供奉品数据（按类别组织） | ~50KB |
| `offerings-with-images.json` | 完整供奉品数据（含图片URL） | ~80KB |
| `image-map.json` | 供奉品名称 → 图片文件名映射 | ~10KB |
| `ipfs-cid-map.json` | 图片文件名 → IPFS CID 映射 | ~15KB |
| `offering-cid-map.json` | 供奉品名称 → IPFS CID 映射 | ~15KB |
| `offerings-page.png` | 页面截图 | ~1MB |

### 脚本文件

| 文件 | 说明 | 依赖 |
|------|------|------|
| `init-sacrifices.js` | 链端祭祀品初始化脚本 | @polkadot/api |
| `download-offerings-images.js` | 图片下载脚本 | Node.js 内置 |
| `upload-images-to-ipfs.js` | IPFS 上传脚本 | ipfs-http-client |

---

## 🚀 快速开始

### 1. 下载图片

```bash
# 下载所有供奉品图片到 images/ 文件夹
node download-offerings-images.js
```

**输出**: `images/` 文件夹（541 个图片文件）

### 2. 上传到 IPFS（可选）

```bash
# 确保 IPFS 运行
ipfs daemon &

# 上传图片并生成 CID 映射
node upload-images-to-ipfs.js
```

**输出**: `ipfs-cid-map.json`, `offering-cid-map.json`

### 3. 初始化链端数据

```bash
# 确保链已启动
./target/release/node-template --dev &

# 运行初始化脚本
node init-sacrifices.js
```

**输出**: 链上创建 500+ 个祭祀品记录

---

## 📊 数据统计

### 供奉品分类

| 类别 | 代码 | 供品数 | 价格范围 |
|------|------|--------|---------|
| 套餐 | `taocan` | ~6 | 5-16元 |
| 香烛 | `xiangzhu` | ~80 | 0-8元 |
| 花果 | `huaguo` | ~120 | 0-10元 |
| 酒菜 | `jiucai` | ~100 | 2-10元 |
| 家居汽车 | `jiajuqiche` | ~40 | 3-12元 |
| 别墅佣人 | `bieshuyongren` | ~10 | 2-12元 |
| 服饰名表 | `fushimingbiao` | ~60 | 2-6元 |
| 数码乐器 | `shumayueqi` | ~30 | 3-5元 |
| 节日 | `jieri` | ~50 | 2-16元 |
| 玩具宠物 | `wanjuchongwu` | ~30 | 2-6元 |
| 运动 | `yundong` | ~15 | 3元 |

### 价格分布

- **免费**: 3 个（蜡烛、鲜花）
- **2-3元**: ~250 个（主力价位）
- **4-5元**: ~150 个
- **6-8元**: ~100 个
- **9-16元**: ~40 个（高端套餐）

---

## 🔧 脚本详解

### `download-offerings-images.js`

**功能**: 下载所有供奉品图片

**特性**:
- ✅ 并发控制（5个并发）
- ✅ 自动跳过已下载文件
- ✅ 错误处理和统计
- ✅ 生成图片映射文件

**使用方法**:
```bash
node download-offerings-images.js
```

**输出**:
- `images/` 目录: 所有图片文件
- `image-map.json`: 名称 → 文件名映射

---

### `upload-images-to-ipfs.js`

**功能**: 上传图片到 IPFS

**前置条件**:
- IPFS 节点运行中
- `images/` 目录存在
- `image-map.json` 存在

**特性**:
- ✅ 自动 Pin 文件
- ✅ 生成双重映射（文件名→CID，名称→CID）
- ✅ 错误处理和统计

**使用方法**:
```bash
# 启动 IPFS
ipfs daemon &

# 上传图片
node upload-images-to-ipfs.js
```

**输出**:
- `ipfs-cid-map.json`: 文件名 → CID
- `offering-cid-map.json`: 供奉品名称 → CID

---

### `init-sacrifices.js`

**功能**: 在链端创建祭祀品记录

**前置条件**:
- 链运行中（`ws://127.0.0.1:9944`）
- 管理员账户（默认 Alice）有足够余额
- Memorial pallet 已部署

**定价策略**:
```javascript
if (price === 0) {
  // 免费供品
  fixedPrice = 0;
} else if (price >= 10) {
  // 高价供品 -> VIP专属 + 按周计费
  isVipExclusive = true;
  unitPricePerWeek = price * 1 DUST;
} else {
  // 普通供品 -> 固定价格
  fixedPrice = price * 1 DUST;
}
```

**场景和类目映射**:
```javascript
Scene: Memorial (纪念馆) = 3

Category 映射:
  xiangzhu (香烛) -> Candle (1)
  huaguo (花果) -> Flower (0)
  jiucai (酒菜) -> Food (2)
  wanjuchongwu (玩具宠物) -> Toy (3)
  其他 -> Other (4)
```

**使用方法**:
```bash
# 启动链
./target/release/node-template --dev &

# 初始化
node init-sacrifices.js
```

**输出**:
- 链上祭祀品记录
- 详细统计报告

---

## 📖 相关文档

- [供奉品初始化指南](/home/xiaodong/文档/stardust/docs/供奉品初始化指南.md) - 完整使用教程
- [Memorial Pallet README](/home/xiaodong/文档/stardust/pallets/memorial/README.md) - Pallet 接口文档
- [前端供奉品配置](/home/xiaodong/文档/stardust/stardust-dapp/src/config/offerings-config.ts) - 前端配置文件

---

## ⚙️ 配置选项

### 下载脚本配置

```javascript
// download-offerings-images.js

const concurrency = 5;        // 并发下载数
const imagesDir = './images'; // 图片保存目录
```

### IPFS 上传配置

```javascript
// upload-images-to-ipfs.js

const ipfs = create({
  host: 'localhost',   // IPFS 节点地址
  port: 5001,          // API 端口
  protocol: 'http'     // 协议
});
```

### 链端初始化配置

```javascript
// init-sacrifices.js

const WS_URL = 'ws://127.0.0.1:9944';  // 链地址
const ADMIN = '//Alice';                // 管理员助记词
const SCENE = 3;                        // 场景（Memorial）
```

---

## 🐛 故障排除

### 图片下载失败

**问题**: 部分图片下载失败

**解决**:
```bash
# 重新运行脚本（会跳过已下载的文件）
node download-offerings-images.js
```

### IPFS 上传慢

**问题**: 上传速度很慢

**解决**:
1. 检查 IPFS 节点状态: `ipfs stats bw`
2. 增加连接数: `ipfs config Swarm.ConnMgr --json`
3. 使用 IPFS 集群

### 链端初始化失败

**问题**: 交易失败

**检查清单**:
- [ ] 链节点运行正常
- [ ] 管理员账户余额充足
- [ ] Memorial pallet 已部署
- [ ] 交易参数正确

**查看详细错误**:
```javascript
// 脚本会输出详细错误信息
// 格式: [Pallet].[Function]: [Error Description]
```

---

## 📝 开发笔记

### 数据提取过程

1. **浏览器提取** (2025-11-08)
   - 访问云上思念网站
   - 滚动加载所有供奉品
   - 执行 JavaScript 提取数据
   - 总耗时: ~5分钟

2. **数据清洗**
   - 去重（根据名称+图片URL）
   - 价格标准化
   - 分类归属
   - 生成索引

3. **图片处理**
   - URL 验证
   - 并发下载
   - 文件名标准化
   - IPFS 上传

### 链端设计考虑

1. **定价策略**
   - 免费供品：吸引用户尝试
   - 普通供品：固定价格，简单直接
   - 高价供品：按周计费，VIP专属

2. **场景设计**
   - 统一使用 Memorial 场景
   - 为未来扩展预留接口（Grave, Pet, Park）

3. **类目映射**
   - 简化 11 个类别到 5 个链端类别
   - 保持前端分类灵活性

---

## 🔮 未来计划

- [ ] 支持批量更新祭祀品
- [ ] 添加供奉品推荐算法
- [ ] 实现供奉品评论功能
- [ ] 添加供奉品统计分析
- [ ] 支持自定义供奉品

---

## 📄 许可证

本项目数据来源于云上思念网站，仅供 Stardust 项目内部使用。

---

**最后更新**: 2025-11-08  
**维护者**: Stardust Team

