# Stardust DApp 前端（本地钱包模式）

本前端已切换为"本地钱包模式"，不依赖浏览器扩展。用户在"创建钱包"页生成助记词并设置密码，前端使用 PBKDF2 + AES-GCM 将助记词加密存储于浏览器 `localStorage`，后续在"登录"页输入密码解密并使用本地 sr25519 密钥进行签名与上链。

## 🏛️ 治理功能说明（重要更新）

**专业治理功能已迁移到 Web 治理平台**

### 📱 DAPP（移动端优先）
- **定位**：大众参与，日常管理
- **功能**：
  - ✅ 创建墓地和逝者
  - ✅ 供奉、留言、扫墓
  - ✅ 查看墓地详情
  - ✅ 提交申诉（简化版）
  - ✅ OTC交易和做市商申请

### 🖥️ Web 治理平台（桌面端优先）
- **地址**：https://governance.stardust.com（开发：http://localhost:3000）
- **定位**：专业治理，批量操作
- **功能**：
  - ✅ 内容治理（申诉审批、批量处理）
  - ✅ 委员会管理（Council/Technical/Content）
  - ✅ 做市商审批（详细审查、IPFS直达）
  - ✅ 仲裁管理（争议案件、裁决执行）
  - ✅ 墓地/陵园强制治理
  - ✅ 轨道系统和公投管理
  - ✅ 数据分析和导出

### 🔗 如何访问治理平台？

**在DAPP中**：
1. 首页 → 点击"🏛️ 专业治理"卡片
2. 个人中心 → 点击"治理与管理"卡片
3. 我的治理（`#/gov/me`）→ 点击快捷入口

**直接访问**：
- 生产环境：https://governance.stardust.com
- 开发环境：http://localhost:3000

## 当前模式

⚡ **全局链上直连模式**：所有数据直接从链节点查询，暂时不使用 Subsquid 索引器。

**影响的功能**（暂时禁用）：
- ❌ Dashboard 页面的历史趋势图
- ❌ 墓位排行榜（TopGravesPage）
- ❌ 供奉时间线（OfferingsTimeline）
- ❌ 按地址查询供奉历史（OfferingsByWho）

**正常工作的功能**：
- ✅ 委员会提案和投票
- ✅ 做市商申请和审批
- ✅ 创建墓地/逝者
- ✅ 供奉操作
- ✅ OTC 交易
- ✅ 所有链上写入和实时查询

## 快速导航

### 核心功能（移动端）
- **创建墓地**: `#/grave/create` - 创建新墓地
- **我的墓地**: `#/grave/my` - 管理我的墓地
- **墓地详情**: `#/grave/detail?gid=123` - 查看墓地详情
- **创建逝者**: `#/deceased/create` - 添加逝者信息
- **提交申诉**: `#/gov/appeal` - 快速申诉入口（移动端）

### 做市商功能
- **申请页面**: `#/otc/mm-apply` - [使用指南](./docs/MARKET_MAKER_APPLICATION_GUIDE.md)
- **审核页面**: ⚠️ **已迁移到Web平台** - https://governance.stardust.com/applications

### 治理功能（已迁移）
- **委员会提案**: ⚠️ **已迁移到Web平台** - https://governance.stardust.com/proposals
- **内容治理**: ⚠️ **已迁移到Web平台** - https://governance.stardust.com/content-governance
- **仲裁管理**: ⚠️ **已迁移到Web平台** - https://governance.stardust.com/arbitration
- **墓地治理**: ⚠️ **已迁移到Web平台** - https://governance.stardust.com/grave-governance

## 快速开始

1. 启动链节点（本地测试网，默认 9944）：
```bash
cargo run -p stardust-node --release -- --dev --tmp --rpc-port 9944 --rpc-cors=all
```

2. 启动前端：
```bash
cd stardust-dapp
VITE_WS=ws://127.0.0.1:9944 npm run dev -- --host 127.0.0.1
```

3. 浏览器访问 `http://127.0.0.1:5173`：
   - 创建钱包：生成助记词、设置密码，页面会显示派生地址；
   - 登录钱包：输入密码解锁，之后页面上的“直发/代付”功能将使用本地签名；
   - 导出/导入：在“创建/登录”页均可一键导出 JSON 备份或从 JSON 导入。

## 安全注意事项

- 助记词仅保存在浏览器本地（localStorage 中为加密密文）。请务必导出 JSON 进行离线备份，并妥善保存密码。
- 密码使用 PBKDF2(SHA-256, 210k 次) 导出密钥，再以 AES-GCM(256) 加密助记词；但浏览器环境依然存在泄露风险，请勿在不可信设备上使用。
- 生产环境建议使用硬件钱包或浏览器扩展进行签名，前端本地签名仅适合开发/测试或低风险场景。
- 清空浏览器缓存/localStorage 将导致本地 keystore 丢失；请先导出 JSON 备份。

## 配置

通过环境变量配置链节点与后台：
```bash
VITE_WS=ws://127.0.0.1:9944
VITE_BACKEND=http://127.0.0.1:8787
VITE_FORWARD_API=http://127.0.0.1:8787/forward
VITE_ALLOW_DEV_SESSION=1
```

## 开发说明

- 签名与发送：统一通过 `signAndSendLocalFromKeystore(section, method, args)` 完成；旧调用 `signAndSend` 已重定向到本地签名。
- 会话握手：开发环境使用本地签名与后端交互；可通过 `VITE_ALLOW_DEV_SESSION=1` 启用开发回退会话。
- 数据查询：高变动/易膨胀查询建议下沉到 Subsquid（详见 `stardust-squid`）。

### 墓位背景音乐（Grave Audio）

- 播放：`GraveAudioPlayer` 读取 `memoGrave.audioCidOf(graveId)`，并尝试读取 `memoGrave.audioPlaylistOf(graveId)`；若播放列表存在，则优先使用列表并提供“上一首/下一首”。
- 设置：`GraveAudioPicker` 页面 `#/grave/audio`
  - 公共目录：读取 `memoGrave.audioOptions()`，墓主可从目录使用 `setAudioFromOption(id, index)`，非墓主会自动发起治理提案（`setAudioViaGovernance`）。
  - 私有候选：仅墓主可维护 `addPrivateAudioOption/removePrivateAudioOption`，并可用 `setAudioFromPrivateOption` 设为背景音乐。
  - 播放列表：编辑顺序后调用 `setAudioPlaylist(id, items)` 覆盖写入。
  - 网关播放：`https://<gateway>/ipfs/<cid>`；默认 `VITE_IPFS_GATEWAY=https://ipfs.io`。
  - 移动端：播放器底部悬浮控制条，显式点击播放；音量本地记忆 key：`mp.grave.audio.vol.<graveId>`。

> 只读示例（使用 polkadot.js API）：
```ts
// 读取公共目录
const opts = await api.query.memoGrave.audioOptions();
const list: string[] = (opts.toJSON() as any[]).map(u8 => new TextDecoder().decode(new Uint8Array(u8)));

// 读取某墓位选中 CID（Option<Bytes>）
const v = await api.query.memoGrave.audioCidOf(graveId);
const cid = v.isSome ? new TextDecoder().decode(v.unwrap().toU8a()) : '';

// 读取某墓位播放列表
const pl = await api.query.memoGrave.audioPlaylistOf(graveId);
const playlist: string[] = (pl.toJSON() as any[]).map(u8 => new TextDecoder().decode(new Uint8Array(u8)));
```

### 与 pallet-evidence 集成（V1/V2 并存）

- 默认走 V2：

```ts
// 按命名空间与主体提交承诺哈希（建议：对 明文CID + salt + ver + ns/subject 取 blake2b256）
await signAndSendLocalFromKeystore('evidence', 'commitHash', [nsBytes, subjectId, commitHash, memoBytes]);

// 链接已存在的证据（需命名空间一致）
await signAndSendLocalFromKeystore('evidence', 'linkByNs', [nsBytes, subjectId, evidenceId]);
```

- 特殊场景使用 V1（公开 CID）：

```ts
await signAndSendLocalFromKeystore('evidence', 'commit', [domain, targetId, imgs, vids, docs, memoBytes]);
await signAndSendLocalFromKeystore('evidence', 'link', [domain, targetId, evidenceId]);
```

错误码处理建议：
- `NotAuthorized`：提示无权限或账户角色不匹配；
- `InvalidCidFormat`/`DuplicateCid`/`TooMany*`：标注到对应输入控件；
- `CommitAlreadyExists`：提示“该证据已登记”；
- `NamespaceMismatch`：提示“命名空间不一致，请检查选择的空间/主体”。

## 申诉治理（无扩展/无链上私钥亦可）

本 DApp 已从 OpenGov 公投迁移为“内容委员会(2/3) + 申诉治理”流程。用户与第三方可通过“提交申诉”发起内容治理请求，由内容委员会审批、公示并强制执行对应 `gov_*` 接口。

流程：
1. 提交申诉：前往 `#/gov/appeal`，填写 `domain/action/target/reason_cid/evidence_cid` 并提交（链上冻结 `AppealDeposit`）。
2. 审批与公示：内容委员会（2/3 阈值）审批；`approve` 后进入公示期（`NoticeDefaultBlocks`）；`reject/withdraw` 将按 `RejectedSlashBps/WithdrawSlashBps` 比例罚没押金至国库。
3. 到期执行：公示期满由 `execute_approved` 路由到各内容 Pallet 的 `gov_*` 接口执行，并记录证据事件（CID 全局不加密）。
4. 模板与指引：`#/gov/templates` 提供常用动作模板（含 domain/action 与 target 填写提示）。

提示：在“申诉提交”页会显示链上治理常量（押金、公示期、罚没比例、限频窗口）。

## 设置逝者主图（前端使用说明与示例）

主图功能已迁移至媒体/逝者域的治理接口，支持两种路径：本地直发与申诉治理。

### 1) 本地直发（用户签名）

前置条件：已为该逝者添加了照片媒体，并拿到对应 `mediaId`（kind=Photo，且 `deceased_id` 一致）。

示例：
```ts
// 设置主图（媒体域）
await signAndSendLocalFromKeystore(
  'deceasedMedia',
  'setPrimaryImageFor',
  [deceasedId, mediaId]
);

// 清空主图（媒体域）
await signAndSendLocalFromKeystore(
  'deceasedMedia',
  'clearPrimaryImageFor',
  [deceasedId]
);
```

事件订阅：
- `deceasedMedia.PrimaryImageChanged(deceasedId, Option<mediaId>)`

前端展示建议：
- 优先读主图；若无主图则回退为该逝者最新照片；再无则使用占位图。

### 2) 申诉治理（内容委员会阈值执行）

适用于平台统一治理审核的场景。通过“提交申诉”发起对应强制接口：

- 清空主图：在 `#/gov/appeal` 提交 `domain=2, action=2, target=deceasedId`（路由到 `deceased.gov_set_main_image(id, None, evidence_cid)`）。
- 设置主图：在 `#/gov/appeal` 提交 `domain=2, action=3, target=deceasedId`（路由到 `deceased.gov_set_main_image(id, Some(cid), evidence_cid)`，当前前端以占位方式提交 CID）。

注意：
- 隐藏/删除该媒体时，链上会自动清空主图并发 `PrimaryImageChanged(deceasedId, None)`，前端应回退展示。
- 仅 Photo 可设为主图；如不满足约束，链上会报错。

## 桥（报价保护）前端使用说明

自 runtime v0.2 起，新增 `pallet-pricing` + `pallet-memo-bridge.lock_memo_with_protection`，支持：
- 读取链上价格（明文）供界面展示；
- 用户锁定时携带 `min_eth_out` 做滑点保护；
- 事件中记录价格快照，便于审计与追溯。

### 读取价格（展示/校验陈旧）

```ts
// 推荐在 hooks 中每 N 秒读取一次
const price = await api.query.pricing.price();
const params = await api.query.pricing.params();

// 结构示例：
// price: { priceNum, priceDen, lastUpdated }
// params: { staleSeconds, maxJumpBps, paused }

function isStale(nowSec: number) {
  return nowSec - Number(price.lastUpdated.toString()) > Number(params.staleSeconds.toString());
}

// 预计可得 ETH（向下取整）
function quoteEthOut(netAmount: bigint) {
  const num = BigInt(price.priceNum.toString());
  const den = BigInt(price.priceDen.toString());
  if (den === 0n) return 0n;
  return (netAmount * num) / den;
}
```

### 锁定（携带最小可得 ETH 保护）

```ts
// amount: MEMO 原生单位（u128）；ethAddressBytes：ETH 地址字节
// minEthOut: 由前端根据净额与链上价格估算后，给出用户可接受的最小值
await signAndSendLocalFromKeystore(
  'memoBridge',
  'lockMemoWithProtection',
  [amount, ethAddressBytes, minEthOut]
);

// 事件：memoBridge.MemoLockedWithQuote { priceNum, priceDen, quoteEthOut }
```

提示：
- `ethAddressBytes` 可用 `ethers.utils.getAddress` 校验后，`ethers.utils.arrayify(address)` 转字节；
- 若价格陈旧或暂停，建议禁用按钮并提示“价格已过期/功能暂停”；
- `minEthOut` 建议支持用户可调滑点，默认按估算值的 98%～99%。
