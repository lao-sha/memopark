/**
 * IPFS服务
 * 重新导出lib/ipfs中的功能
 */

export { uploadToIpfs } from '../lib/ipfs';

// 兼容大写命名
export { uploadToIpfs as uploadToIPFS } from '../lib/ipfs';

/**
 * 从IPFS获取数据
 */
export async function fetchFromIPFS(cid: string): Promise<string> {
  const gateway = 'https://ipfs.io/ipfs/';
  const response = await fetch(`${gateway}${cid}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
  }
  return response.text();
}

// 导出其他可能需要的IPFS相关函数
export async function uploadJson(data: any): Promise<string> {
  const { uploadToIpfs: upload } = await import('../lib/ipfs');
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const file = new File([blob], 'data.json');
  return upload(file);
}

