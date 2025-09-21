# MemoPark DAO 治理系统设计

> 目标：支持“记忆公园”生态的去中心化提案、投票、执行与透明追踪，兼顾可扩展性、可组合性与安全审计友好。

## 1. 概览架构

分层：
1. 治理交互层（DApp 前端 / API Adapter）
2. 协议协调层（Governor / Timelock / Registry）
3. 资产与记忆层（NFT/纪念资产合约、Treasury、Funding Vault）
4. 数据 & 索引层（子图 The Graph / off-chain cache / 存证层）
5. 执行层（多签执行 / 自动执行机器人 / 任务调度）

## 2. 角色模型
- 游客 Visitor：浏览，读取提案与数据。
- 贡献者 Contributor：可提交提案（需满足门槛条件）。
- 投票者 Voter：持有治理代币或锁仓 veToken 或持 NFT 权重。
- 观察者 Watcher：订阅事件、做分析（不改变状态）。
- 执行人 Executor：Timelock + 多签组合。
- 审计 / 安全角色：监控可疑操作。

## 3. 治理代币与权重策略
可选权重来源（可组合）：
1. ERC20 基础治理代币 (GOV)
2. veGOV：锁仓换取衰减/线性释放的投票权，抑制短期投机
3. 纪念 NFT：特定系列给予附加权重 (如每枚 0.2 票 或 稀有度加权)
4. 贡献积分 (非转移) Reputation：例如通过提交被通过的提案累积

最终权重计算：
```
weight(address) = f( balanceGOV, veGOVPower, NFTBonus, reputation )
例：totalWeight = a*GOV + b*veGOV + c*NFT + d*Rep
```
参数可由治理自身提案调整。

## 4. 合约模块划分
| 模块 | 主要职责 | 关键点 |
|------|----------|--------|
| GovernanceToken (ERC20) | 基础投票资产 | 可增发/封顶策略配置 |
| VoteEscrow (ve) | 锁仓换投票权 | 锁期、线性衰减、提前退出惩罚 |
| Reputation | 积分记录 | 不可转移，事件触发累积 |
| NFTRegistry | 纪念 NFT 权重表 | 支持系列、稀有度映射 |
| GovernorCore | 创建/生命周期管理提案 | 跟随 OpenZeppelin Governor 接口便于审计 |
| ProposalValidation | 门槛、速率限制 | 防 spam；动态阈值 |
| VotingPowerAggregator | 聚合多来源权重 | 可插拔策略模式 |
| TimelockController | 延时执行 | 最小 / 最大延时防闪电治理 |
| ExecutionRouter | 提案动作批处理 | 防重复执行、结果事件 |
| Treasury / Vault | 资金管理 | 仅 Timelock 调用；多签应急暂停 |
| ParameterStore | 治理参数 | 提案成功后 Timelock 更新 |
| EventLog / Proof | 关键事件 Merkle 化 | 方便外部索引与轻节点验证 |

## 5. 提案生命周期
状态机：Draft -> Active Voting -> Succeeded/Defeated -> Queued (Timelock) -> Executed / Expired -> Archived

时序：
1. Draft：前端本地或 off-chain 暂存（可选 IPFS）
2. Create：满足门槛 -> GovernorCore 记录 (proposalId = hash(targets, calldatas, description))
3. VotingDelay：等待区块数（防止闪电借贷快速操控）
4. Active：投票期间 (startBlock~endBlock)
5. 终结判断：quorum 达成 & forVotes > againstVotes * 阈值
6. Succeeded -> Timelock queue
7. Delay 结束 -> execute() -> 调用 ExecutionRouter -> 目标合约
8. 执行失败：标记 Failed；可发起 fix proposal
9. Expire：Queue 超期未执行
10. Archived：长历史冷存、事件索引

## 6. 投票类型支持
- 单选 (For/Against/Abstain)
- 多选 (Ranked Choice / Approval)
- 参数设定 (Range Voting)
- 资金分配 (Quadratic / Weighted Split)

策略接口：`IVoteStrategy` -> `tally(bytes calldata ballotData) returns (Result)`

## 7. 核心数据结构（示意）
```solidity
struct ProposalCore {
  uint256 id;
  address proposer;
  uint64 createBlock;
  uint64 voteStart;
  uint64 voteEnd;
  uint64 queueTime;
  uint64 executeTime;
  ProposalState state;
  bytes32 actionsHash; // keccak(targets, values, calldatas)
  uint256 quorumSnapshot;
  string ipfsCID; // 描述/文档
}

struct VoteReceipt {
  bool hasVoted;
  uint96 weight;
  uint8 support; // 0=against 1=for 2=abstain
  bytes extra; // 扩展投票数据
}
```
Snapshot：在 `voteStart` 前抓取 aggregator totalSupply/weights，防止中途转移操控。

## 8. 防护与安全措施
| 风险 | 缓解 |
|------|------|
| 闪电贷操控 | votingDelay + snapshot + 仅锁仓/ve 计权 |
| 提案 spam | 动态创建费用 (可退还) + reputation 门槛 |
| 恶意执行 | Timelock + 多签紧急暂停 + allowlist 目标合约 |
| 重入 / 升级风险 | 使用 OZ 库；ExecutionRouter 串行处理 |
| 参数被极端改写 | 分层参数：关键参数需更高 quorum 或双层投票 |
| NFT 权重刷分 | 声明合格系列白名单 + 稀有度一次性登记 |
| 长尾资金遗失 | 金库只接受受控模块调用；定期审计 |

Bug Bounty / Formal Verification：针对 GovernorCore、VotingPowerAggregator、Timelock、Treasury。

## 9. 可扩展与升级方案
- 使用 Proxy (UUPS 或 Transparent) 仅对策略/聚合层允许升级；核心提案历史不可变。
- 将策略（投票计票 / 权重公式）拆为独立合约：`StrategyRegistry`。
- 引入模块版本号：提案可引用具体版本，升级后旧提案仍按旧策略计算。

## 10. 前端信息映射
| UI 区块 (wireframe) | 数据来源 | 说明 |
|--------------------|----------|------|
| Header 指标 | Aggregator 视图合约 / Subgraph | 聚合查询（缓存） |
| 最新提案列表 | Subgraph (Proposal entity) | 按 createBlock desc |
| 提案行状态 | GovernorCore.state(proposalId) | 前端映射标签颜色 |
| 即将截止 | 筛选 voteEnd - now < 阈值 | 后端/子图过滤 |
| NFT / 权重弹窗 | Aggregator + NFTRegistry | 展示组成明细 |
| 创建提案向导 | Governor + StrategyRegistry | 选择投票类型、目标动作 |

## 11. 索引与分析
使用 The Graph：
- Entities: Proposal, Vote, Execution, ParameterChange, ReputationEvent
- 派生字段：通过率、平均参与率、加权投票集中度(HHI)
缓存层：Redis/SQLite（可选）做热门提案加速。

## 12. 开发阶段迭代路线
阶段 0：PoC — 单一 ERC20 + 简单 For/Against，Timelock + 基础前端
阶段 1：加入 ve 锁仓 + Subgraph + 指标面板
阶段 2：多策略投票 + NFT 权重 + Reputation
阶段 3：参数分层安全 + 资金分配提案 + 自动执行 bot
阶段 4：数据分析仪表盘 & 跨链治理扩展 (Layer2 / Rollup)

## 13. Gas / 性能优化点
- Weight 聚合在 off-chain 预计算 + on-chain 校验随机抽样
- 提案 actionsHash 代替重复存储 targets/values/calldatas 冗余（或只存数组）
- 使用事件驱动 + Subgraph 聚合避免 on-chain view 大循环
- 避免遍历 NFT：采用 snapshotTokenId => ownerWeight off-chain 生成 Merkle root，上链验证（可选）

## 14. 关键参数建议 (初始)
| 参数 | 建议初值 | 说明 |
|------|---------|------|
| votingDelay | 7200 块 (~1 天) | 防闪电操控 |
| votingPeriod | 43200 块 (~6 天) | 社区参与窗口 |
| timelockDelay | 17280 块 (~2 天) | 审查期 |
| proposalThreshold | 0.5% total effective weight | 动态评估 |
| quorum | 8% total effective weight | 可调 |
| executionGrace | 172800 块 (~20 天) | 超期失效 |

## 15. 测试策略
- 单元：权重聚合、提案创建、投票状态、Timelock 队列/执行
- 属性测试：不同权重组合单调性、锁仓过期衰减一致性
- 模糊：对 execute 目标合约随机顺序/失败场景
- 模拟：大量小权重地址 vs 集中大户投票攻击面

## 16. 运维与监控
事件监听：提案创建、状态变化、执行失败、Timelock 即将到期
告警：大额权重突增、短期 ve 锁仓异常增量
快照：每日权重总量、活跃地址数

## 17. 跨链与未来
- Layer2 镜像：跨链消息桥（如 Optimism / Arbitrum）→ 主链执行只保留最终状态
- 可采用 checkpoint 签名方案（多签聚合签名）减少链上投票成本

## 18. 最小可行合约集合 (MVP)
1. GovernanceToken (ERC20Votes)
2. Governor (基于 OZ Governor + TimelockController)
3. Treasury (受 Timelock 管控)
4. Subgraph (索引提案/投票)
5. 前端：提案列表 + 详情 + 创建 + 投票

> 后续逐步引入 ve、NFT 权重、Reputation 与多策略投票。

## 19. 安全审计清单 (片段)
- Reentrancy (execute 时) → Checks-Effects-Interactions + OpenZeppelin ReentrancyGuard
- AccessControl：Timelock 是否唯一拥有 Treasury 权限
- Proposal 注入：描述字符串不要在合约中解析执行
- 升级权限：Proxy Admin 纳入多签 + timelock
- 时间参数：防止设置 0 delay 等危险值（ParameterStore 校验）

## 20. 快速开始 (开发顺序示例)
1. 初始化 Hardhat/Foundry 环境
2. 部署 ERC20Votes + Timelock + Governor
3. 写基础测试：创建提案 -> 投票 -> 队列 -> 执行
4. 加 Subgraph schema & mappings
5. 前端接 Governor & Subgraph
6. 迭代增加权重聚合器与 ve 模块

---
若需要，我可以继续：
- 生成初始合约骨架
- 提供 Subgraph schema
- 输出前端组件接口契约
告诉我下一步。
