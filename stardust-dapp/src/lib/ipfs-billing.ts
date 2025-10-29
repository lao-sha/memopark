import { getApi, signAndSendLocalFromKeystore } from './polkadot-safe'

/**
 * 函数级详细中文注释：将明文 CID 转为链上使用的 cid_hash（占位实现）
 * - 说明：链上仅存 hash，避免明文 CID 上链；生产环境请使用与 OCW/后端一致的哈希策略
 */
export function toCidHashHex(cidPlain: string): string {
  const enc = new TextEncoder().encode(String(cidPlain||''))
  const hex = Array.from(enc).map(b=>b.toString(16).padStart(2,'0')).join('')
  return '0x' + hex.slice(0, 64)
}

/**
 * 函数级详细中文注释：提交逝者内容的 Pin 请求，进入统一计费生命周期
 * - 使用链上 memo_ipfs 的 requestPinForDeceased(subject_id, cid_hash, size_bytes, replicas, price)
 * - 自动动态解析 section 名称（memoIpfs/memo_ipfs/ipfs）
 * - 注意：price 为一次性入金（进入基金会），周期扣费与资金账户由链上自动处理
 */
export async function submitPinForDeceased(subjectId: number, cidPlain: string, sizeBytes: number, replicas: number, price: string): Promise<string> {
  const api = await getApi()
  const txRoot: any = api.tx as any
  const section = ['memoIpfs','memo_ipfs','ipfs', ...Object.keys(txRoot)].find(s => txRoot[s]?.requestPinForDeceased) || 'memoIpfs'
  const cidHash = toCidHashHex(cidPlain)
  const txHash = await signAndSendLocalFromKeystore(section, 'requestPinForDeceased', [subjectId, cidHash, sizeBytes, replicas, price])
  return txHash
}
