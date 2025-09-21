/**
 * 函数级详细中文注释：上传文件到本地 IPFS 节点（HTTP API）并返回 CID
 * - 依赖本机已安装并运行的 IPFS（go-ipfs/kubo），且已开启 CORS 允许本域访问
 * - 默认 API 地址：http://127.0.0.1:5001/api/v0/add
 * - 使用 FormData 方式提交，附带 pin=true、cid-version=1（base32 CIDv1）
 */
export async function uploadToIpfs(file: File, options?: { apiUrl?: string; pin?: boolean; cidVersion?: number }): Promise<string> {
  const api = options?.apiUrl || ((): string => {
    try { const v = (import.meta as any)?.env?.VITE_IPFS_API; if (v) return String(v) } catch {}
    return 'http://127.0.0.1:5001/api/v0/add'
  })()
  const pin = options?.pin ?? true
  const cidVersion = options?.cidVersion ?? 1
  const url = `${api}?pin=${pin ? 'true' : 'false'}&cid-version=${cidVersion}&raw-leaves=true`
  const fd = new FormData()
  fd.append('file', file, file.name)
  try {
    const resp = await fetch(url, { method: 'POST', body: fd })
    if (!resp.ok) {
      const txt = await resp.text().catch(()=> '')
      throw new Error(`IPFS 上传失败：${resp.status} ${txt}`)
    }
    // go-ipfs 返回 NDJSON，每行一个对象，最后一行为文件 CID
    const text = await resp.text()
    const lines = text.trim().split(/\r?\n/).filter(Boolean)
    let cid = ''
    for (const ln of lines) {
      try { const obj = JSON.parse(ln); if (obj.Hash) cid = obj.Hash } catch {}
    }
    if (!cid) throw new Error('IPFS 未返回 CID')
    return cid
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/Failed to fetch|CORS|NetworkError/i.test(msg)) {
      throw new Error(
        '无法连接本地 IPFS API（可能是 CORS 未配置或 IPFS 未启动）。\n'
        + '请执行以下命令并重启 IPFS：\n'
        + 'ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin "[\"http://localhost:5173\",\"http://127.0.0.1:5173\"]"\n'
        + 'ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods "[\"PUT\",\"POST\",\"GET\"]"\n'
        + 'ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers "[\"Authorization\"]"\n'
        + '然后运行：ipfs daemon\n'
        + '（或在 .env 配置 VITE_IPFS_API 指向可用的 IPFS API）'
      )
    }
    throw e
  }
}


