# pallet-deceased-text（文本域：文章/留言/生平/悼词）

## 目标
- 管理与逝者相关的文本类内容：文章（Article）、留言（Message）、生平（Life）、悼词（Eulogy）。
- 上链仅保存 CID 与标题/摘要等元数据；原文走 IPFS/外部存储。
- 支持押金、成熟期与治理裁决路径。

## 接口概览（Extrinsics）
- 用户入口（签名账户）：
  - `set_article(deceased_id, cid, title?, summary?)`：设置/新增文章（押金+成熟）。
  - `add_message(deceased_id, cid, title?)`：新增留言（押金+成熟）。
  - `edit_text(id, cid?, title??, summary??)`：编辑文本（作者）。
  - `remove_text(id)`：删除文本（仅 Message，押金成熟后可退）。
  - `claim_text_deposit(id)`：领取文本押金（到期）。
  - `create_life(deceased_id, cid)`/`update_life(deceased_id, cid)`/`claim_life_deposit(deceased_id)`：生平创建/更新/押金领取。
  - `create_eulogy(deceased_id, cid)`/`update_eulogy(id, cid)`/`claim_eulogy_deposit(id)`：悼词创建/更新/押金领取。
- 治理入口（仅 `GovernanceOrigin`）：
  - `gov_remove_eulogy(id)`：治理移除悼词（押金成熟后可退）。
  - `gov_remove_text(id)`：治理强制删除文本（Message/Article）。
  - `gov_edit_text(id, cid?, title??, summary??, evidence_cid)`：治理编辑文本。
  - `gov_set_life(deceased_id, cid, evidence_cid)`：治理覆盖生平（仅已存在的 Life）。
- 无私钥治理落地（代用户最终写入）：
  - `gov_set_article_for(owner, deceased_id, cid, title?, summary?)`

## 存储
- 文本：`TextOf` + `MessagesByDeceased` + `ArticlesByDeceased`
- 生平：`LifeOf/LifePrev/LifeDeposits/LifeMaturity`
- 悼词：`EulogyOf/EulogiesByDeceased/EulogyDeposits/EulogyMaturity`
- 押金：`TextDeposits/TextMaturity`

## 押金与成熟规则
- 新增/编辑（覆盖）将保留押金（`TextDeposit`），设置成熟时间 `ComplaintPeriod`。
- 到期且无治理阻断时，作者可调用 `claim_*_deposit` 退押金。
- 生平更新：创建者免押金，非创建者更新需押金+成熟；可通过治理回滚至 `LifePrev` 并按比例分账（参见媒体域 README 类似分账策略，实际分账逻辑可在后续版本扩展）。

## 权限
- 文章、生平仅 `can_manage` 的账户可创建/更新；留言/悼词任何签名账户可发起（可按需接入成员/黑名单校验）。
- 治理操作由 `GovernanceOrigin` 执行（Root/内容委员会阈值）。

## 前端调用建议
## 强制接口与路由码表（示例）
- 文本域 `domain/action`：
  - `(3,20)` 移除悼词
  - `(3,21)` 强制删除文本
  - `(3,22)` 治理编辑文本
  - `(3,23)` 覆盖生平
- 仅存 CID/标题/摘要，正文放 IPFS；
- 文章与生平在详情页渲染时异步取回 IPFS 内容；留言采用分页加载。

## 委员会阈值 + 申诉治理流程（ContentCommittee 2/3）
1. 申诉提交：任何账户均可在前端 `#/gov/appeal` 提交申诉，填写 `domain/action/target/reason_cid/evidence_cid`；链上 `pallet_memo_content_governance::submit_appeal` 冻结 `AppealDeposit`。
2. 审批与公示：内容委员会（2/3 阈值）通过 `approve_appeal` 后进入公示期 `NoticeDefaultBlocks`；若 `reject_appeal/withdraw_appeal` 则按 `RejectedSlashBps/WithdrawSlashBps` 比例罚没入国库账户。
3. 到期执行：公示期满由 `execute_approved` 路由到本模块 `gov_*` 接口执行，例如：
   - `(3,20)` → `gov_remove_eulogy(id, evidence_cid)`
   - `(3,21)` → `gov_remove_text(id, evidence_cid)`
   - `(3,22)` → `gov_edit_text(id, ...)`
   - `(3,23)` → `gov_set_life(deceased_id, ...)`
   执行前后记录证据事件；全局要求 CID 明文（不加密）。
4. 限频控制：按 `WindowBlocks/MaxPerWindow` 控制每账户申诉频率，防滥用。
5. 模板与说明：前端 `#/gov/templates` 提供常用动作（含 domain/action 与 target 提示）；复制后到申诉页粘贴即可。
