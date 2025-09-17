# Memopark DApp 前端（本地钱包模式）

本前端已切换为“本地钱包模式”，不依赖浏览器扩展。用户在“创建钱包”页生成助记词并设置密码，前端使用 PBKDF2 + AES-GCM 将助记词加密存储于浏览器 `localStorage`，后续在“登录”页输入密码解密并使用本地 sr25519 密钥进行签名与上链。

## 快速开始

1. 启动链节点（本地测试网，默认 9944）：
```bash
cargo run -p memopark-node --release -- --dev --tmp --rpc-port 9944 --rpc-cors=all
```

2. 启动前端：
```bash
cd memopark-dapp
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
- 数据查询：高变动/易膨胀查询建议下沉到 Subsquid（详见 `memopark-squid`）。

## 无私钥治理代付（内容提交）指引

本 DApp 支持“无扩展、无链上私钥”的内容提交流程，依赖运行时 `forwarder` + OpenGov：

1. 前端上传文件至 IPFS，得到 CID/URI（不把大对象上链）。
2. 前端将待执行的链上调用参数（例如 `DeceasedMedia.gov_add_media_for(owner, ...)` 或 `DeceasedText.gov_set_article_for(owner, ...)`）发送至后端。
3. 后端：
   - 使用命名空间 `content_` 调用代付接口，代付 `preimage.note_preimage` 与 `referenda.submit`；
   - 提交到 Content 轨道，引用上一步的预映像；
4. 前端订阅公投与执行事件，显示进度：Submitted → Deciding → Approved → Enacted → Executed。
5. 执行成功后，记录以 `owner` 身份落账；成熟到期后 `owner` 在“我的提交”中领取押金。

接口约束与映射请参考后端 runtime 两个内容 Pallet README：
- `pallets/deceased-media/README.md`
- `pallets/deceased-text/README.md`

## 设置逝者主图（前端使用说明与示例）

主图功能已迁移至媒体域（`pallet-deceased-media`），统一由媒体模块管理与治理。支持两种路径：本地直发与无私钥治理代付。

### 1) 本地直发（用户签名）

前置条件：已为该逝者添加了照片媒体，并拿到对应 `mediaId`（kind=Photo，且 `deceased_id` 一致）。

示例：
```ts
// 设置主图
await signAndSendLocalFromKeystore(
  'deceasedMedia',
  'setPrimaryImageFor',
  [deceasedId, mediaId]
);

// 清空主图
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

### 2) 无私钥治理代付（通过 Content 轨道公投执行）

适用于平台代付与统一治理审核的场景。后端代付 `preimage.notePreimage + referenda.submit`，成功后由调度执行 `deceasedMedia.govSetPrimaryImageFor`。

示例（伪代码）：
```ts
// 1) 组装真实调用（由后端或前端构造，再交给后端代付）
const call = api.tx.deceasedMedia.govSetPrimaryImageFor(deceasedId, mediaId);

// 2) 后端代付（命名空间 content_）：
//  - preimage.notePreimage(call)
//  - referenda.submit({ track: Content, proposal_origin: EnsureContentSigner, proposal: preimageHash })
await fetch(`${import.meta.env.VITE_FORWARD_API}`, {
  method: 'POST',
  body: JSON.stringify({ ns: 'content_', action: 'submit_primary_image', deceasedId, mediaId }),
});

// 3) 前端订阅公投与执行事件，显示进度
```

注意：
- 隐藏/删除该媒体时，链上会自动清空主图并发 `PrimaryImageChanged(deceasedId, None)`，前端应回退展示。
- 仅 Photo 可设为主图；如不满足约束，链上会报错。
