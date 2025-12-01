# Stardust 委员会治理 CLI 工具

交互式命令行工具，用于管理 Stardust 区块链上的委员会治理流程。

## 功能特性

✅ **账户管理**
- 支持3个预配置的委员会成员账户
- 自动验证账户地址
- 显示账户余额

✅ **委员会管理**
- 主委员会 (Council)
- 技术委员会 (Technical Committee)  
- 内容委员会 (Content Committee)
- 自动检测账户所属的委员会

✅ **提案治理**
- 发起提案
- 投票表决
- 执行提案
- 实时查看提案状态

✅ **做市商审核** (主委员会专属)
- 查看所有做市商申请
- 审批做市商申请
- 跟踪审核状态

✅ **批量转账**
- 自动生成随机金额
- 批量转账到多个地址
- 实时显示转账进度
- 余额检查和手续费预估

✅ **创建挂单** (做市商专用)
- 交互式输入挂单参数
- 详细的参数说明和验证
- 做市商身份自动检查
- 完整的交易信息展示

✅ **创建祭祀品** (管理员专用)
- 批量创建 50 个随机参数的祭祀品
- 支持 9 大分类（鲜花、香烛、食品等）
- 自动生成合理的价格和库存
- 详细的创建进度和结果统计

## 环境要求

- Node.js >= 16.0.0
- 运行中的 Stardust 节点（默认: ws://127.0.0.1:9944）

## 安装

```bash
# 安装依赖
npm install

# 或使用 yarn
yarn install
```

## 使用方法

### 治理脚本 (governance-cli.js)

```bash
# 方式 1: 直接运行
node governance-cli.js

# 方式 2: 使用 npm script
npm start

# 方式 3: 使用快捷命令
npm run gov
```

### 批量转账脚本 (batch-transfer.js)

```bash
# 方式 1: 直接运行
node batch-transfer.js

# 方式 2: 使用 npm script
npm run batch-transfer

# 方式 3: 使用快捷命令
npm run transfer
```

### 创建挂单脚本 (create-listing.js)

```bash
# 方式 1: 直接运行
node create-listing.js

# 方式 2: 使用 npm script
npm run create-listing

# 方式 3: 使用快捷命令
npm run listing
```

### 创建祭祀品脚本 (create-offerings.js)

```bash
# 方式 1: 直接运行
node create-offerings.js

# 方式 2: 使用 npm script
npm run create-offerings

# 方式 3: 使用快捷命令
npm run offerings
```

详细使用说明请查看：[创建祭祀品使用说明.md](./创建祭祀品使用说明.md)

### 八字排盘脚本 (bazi-cli.js)

```bash
# 方式 1: 直接运行（交互式）
node bazi-cli.js

# 方式 2: 指定参数
node bazi-cli.js --datetime "1993-07-28 13:25" --tz +08:00 --name "张三"

# 方式 3: npm 脚本
npm run bazi -- --datetime "2000-01-01 08:15" --tz +09:00
```

更多说明与示例请查看：[八字排盘使用说明.md](./八字排盘使用说明.md)

### 2. 操作流程

#### 治理脚本操作流程

**步骤 1: 选择账户**
- 使用 ↑ ↓ 方向键选择要使用的账户
- 按 Enter 确认选择

**步骤 2: 查看委员会成员身份**
- 系统会自动检测并显示您所属的委员会
- 显示账户余额

**步骤 3: 选择委员会**
- 选择要进入的委员会
- 查看该委员会的待办事项

**步骤 4: 处理提案**

*主委员会 - 做市商审核:*
- 查看所有做市商申请
- 选择待处理的申请
- 发起提案/投票/执行

*其他委员会 - 提案管理:*
- 查看委员会提案列表
- 选择要处理的提案
- 进行投票或执行

#### 批量转账脚本操作流程

**自动执行流程：**

1. **账户验证** - 自动加载发送账户并验证地址
2. **连接节点** - 连接到区块链节点
3. **余额检查** - 检查发送账户余额是否充足
4. **生成金额** - 为每个接收地址生成随机金额（>10,000,000 最小单位）
5. **预估费用** - 计算总转账金额和手续费
6. **批量转账** - 依次向每个地址转账
7. **结果汇总** - 显示成功/失败统计和详细结果

**配置说明：**

发送账户和接收地址在脚本中预配置：
- 发送账户：`5CrDBEVDgXUwctSuV8EvQEBo2m187PcxoY36V7H7PGErHUW4`
- 接收地址：4个预设地址
- 金额范围：1,000,000,000 DUST 到 10,000,000,000 DUST（随机，即10亿到100亿）

如需修改，请编辑 `batch-transfer.js` 中的配置项。

#### 创建挂单脚本操作流程

**交互式输入流程：**

1. **选择账户** - 上下键选择做市商账户
2. **身份验证** - 验证地址和做市商身份
3. **余额检查** - 检查账户余额是否充足
4. **输入参数** - 逐个输入12个挂单参数，每个都有详细说明
5. **参数汇总** - 显示所有参数供确认
6. **构建交易** - 构建 createListing 交易
7. **提交执行** - 提交交易并显示结果

**做市商账户：**
- 做市商 1: `5C7RjMrgfCJYyscR5Du1BLP99vFGgRDXjAt3ronftJZe39Qo`
- 做市商 2: `5CRubhWmwNmJ3z2Ffqs3nf71XQGHBkfKSc1edNvuHZErqvdL`

详细说明请参考 `创建挂单使用说明.md`

## 账户配置

脚本内置了3个测试账户：

### 成员 1
- **助记词**: `satoshi sure behave certain impulse ski slight track century kitchen clutch story`
- **地址**: `5CrDBEVDgXUwctSuV8EvQEBo2m187PcxoY36V7H7PGErHUW4`
- **角色**: Council 主力账户

### 成员 2
- **助记词**: `scancel claw pretty almost under pepper volume cabbage warm brave name bullet`
- **地址**: `5CSepuULuCiDSBjeRqr9ZburDSdTwTk5ro9BgV5u1SbHiQh9`
- **角色**: Council 成员

### 成员 3
- **助记词**: `report trend decline harbor hobby holiday hope recycle century end holiday display`
- **地址**: `5CotZ9gD2mLLBQ6sqL2b8gRS1Vxo6HfmRcQ2iu3T825DFgSq`
- **角色**: Council/委员会成员

## 环境变量

### STARDUST_WS
指定链节点的 WebSocket 地址

```bash
# 使用自定义节点地址
STARDUST_WS=ws://192.168.1.100:9944 node governance-cli.js
```

## 快捷键

- **↑ / ↓**: 上下选择
- **Enter**: 确认选择
- **Esc**: 返回上一层
- **Ctrl+C**: 退出脚本

## 提案流程

### 发起提案 (Propose)
1. 选择要审批的做市商或创建新提案
2. 系统显示提案详细信息
3. 确认后发起提案
4. 等待其他成员投票

### 投票 (Vote)
1. 选择待投票的提案
2. 查看提案详情
3. 选择赞成或反对
4. 提交投票

### 执行提案 (Execute)
1. 提案达到阈值后，任何成员可执行
2. 选择可执行的提案
3. 确认执行
4. 提案生效

## 注意事项

⚠️ **重要提示**:
- 此脚本必须在交互式终端中运行
- 确保节点正在运行并可访问
- 投票和执行需要足够的账户余额支付手续费
- 提案一旦发起无法撤回，请谨慎操作

## 故障排除

### 连接失败
```
❌ 错误: WebSocket connection failed
```
**解决方案**: 检查节点是否运行，确认 WebSocket 地址是否正确

### 地址验证失败
```
❌ 地址验证失败
```
**解决方案**: 确认助记词正确，检查密钥派生路径

### 余额不足
```
❌ 账户余额不足
```
**解决方案**: 为账户充值足够的代币

### 不属于任何委员会
```
⚠️ 当前账户不属于任何已知委员会
```
**解决方案**: 使用有委员会成员权限的账户，或在链上添加成员

## 技术架构

- **框架**: @polkadot/api
- **密码学**: @polkadot/util-crypto  
- **交互**: 原生 readline + keypress 事件
- **签名方案**: SR25519

## 开发

### 项目结构
```
stardust-gov-scripts/
├── governance-cli.js           # 治理管理主程序
├── batch-transfer.js           # 批量转账脚本
├── create-listing.js           # 做市商创建挂单脚本
├── 测试创建挂单.js              # 测试脚本
├── 第二个成员投票.js            # 投票测试
├── package.json                # 依赖配置
├── README.md                   # 主文档
├── 批量转账使用说明.md          # 转账详解
├── 创建挂单使用说明.md          # 挂单详解
└── 快速开始.md                 # 快速上手
```

### 扩展委员会
在 `governance-cli.js` 中修改 `COMMITTEE_DEFINITIONS`:

```javascript
const COMMITTEE_DEFINITIONS = [
  {
    key: 'yourCommittee',
    label: '你的委员会名称',
    section: 'yourCommitteeModule',
  },
  // ...
];
```

## 许可证

MIT License

## 支持

如有问题或建议，请联系 Stardust 开发团队。
