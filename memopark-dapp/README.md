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
