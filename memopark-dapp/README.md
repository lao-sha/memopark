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
