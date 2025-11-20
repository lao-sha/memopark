# 前端备份文件归档

## 归档日期
2025-11-03

## 归档原因
清理前端开发过程中产生的冗余备份文件。

## 归档内容

### Stardust Governance 备份

| 文件 | 路径 | 说明 |
|------|------|------|
| `signer.ts.backup` | `src/services/wallet/` | 钱包签名服务备份 |
| `index.tsx.backup` | `src/contexts/Wallet/` | 钱包上下文备份 |

## 恢复说明

如需恢复备份：

```bash
# 恢复钱包相关文件
cp archived-pallets/frontend-backups-2025-11-03/signer.ts.backup \
   stardust-governance/src/services/wallet/signer.ts

cp archived-pallets/frontend-backups-2025-11-03/index.tsx.backup \
   stardust-governance/src/contexts/Wallet/index.tsx
```

## 备注

⚠️ **注意**: 这些备份文件可能与当前代码不兼容，恢复前请仔细检查。

---

**归档人**: AI Assistant  
**归档日期**: 2025-11-03

