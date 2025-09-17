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
- 治理操作由 `GovernanceOrigin` 执行（Root/内容治理签名账户）。

## 前端调用建议
- 仅存 CID/标题/摘要，正文放 IPFS；
- 文章与生平在详情页渲染时异步取回 IPFS 内容；留言采用分页加载。

## 无私钥 + 有押金（代付治理）流程（与 forwarder + OpenGov 配合）
1. 前端写入 IPFS，得到 CID。
2. 后端组装真实调用：`DeceasedText.gov_set_article_for(owner, deceased_id, cid, ...)`。
3. 生成预映像：`Preimage.note_preimage(call)`。
4. 提交公投：`Referenda.submit { proposal_origin=EnsureContentSigner, proposal_hash=..., track=Content }`。
5. 公投通过后由调度执行，链上以 `owner` 账户完成押金保留与记录落账。
6. 到期后 `owner` 调用 `claim_text_deposit` 或生平/悼词对应领取接口退押金。

> 注意：通过运行时的 forwarder 命名空间 `content_` 放行 `preimage/submit`，实现“无扩展、无链上私钥”的代付体验。
