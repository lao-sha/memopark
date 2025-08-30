# pallet-memo-ipfs

存储业务与 Offchain Worker（OCW）骨架：

- 用户通过 `request_pin` 一次性付费，金额通过 Endowment 接口打到基金会。
- OCW 调用 ipfs-cluster API 完成 `POST /pins` 与健康检查（本示例仅演示 POST）。
- OCW 使用节点 keystore 的 `KeyTypeId = b"ipfs"` 专用密钥签名上报 `mark_pinned/mark_pin_failed`。

安全与隐私：

- 链上仅存 `cid_hash`，不存明文 CID；OCW 可从本地密文/审计密钥解密得到 CID 后再发 HTTP。
- 集群端点与令牌存于 offchain 本地存储：`/memo/ipfs/cluster_endpoint`、`/memo/ipfs/token`。
