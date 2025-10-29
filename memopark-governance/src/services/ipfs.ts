/**
 * IPFS服务
 * 
 * 用于上传和下载IPFS内容
 * 
 * @module ipfs
 * @author Memopark Team
 * @date 2025-10-23
 */

/**
 * 从IPFS获取内容
 * 
 * @param cid - IPFS CID
 * @returns 内容数据
 */
export async function fetchFromIPFS(cid: string): Promise<any> {
  // IPFS网关列表
  const gateways = [
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
  ];
  
  // 尝试多个网关
  for (const gateway of gateways) {
    try {
      const response = await fetch(`${gateway}${cid}`, {
        timeout: 10000, // 10秒超时
      } as any);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        // 根据内容类型解析
        if (contentType?.includes('application/json')) {
          return await response.json();
        } else {
          return await response.text();
        }
      }
    } catch (error) {
      console.error(`从网关 ${gateway} 下载失败:`, error);
      // 继续尝试下一个网关
    }
  }
  
  throw new Error('从所有IPFS网关下载内容失败');
}

/**
 * 上传内容到IPFS
 * 
 * @param content - 要上传的内容
 * @returns IPFS CID
 */
export async function uploadToIPFS(content: any): Promise<string> {
  // 实际实现中应该调用IPFS服务
  // 这里是示例代码
  
  try {
    // 方式1：使用Pinata API
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VITE_PINATA_JWT || ''}`,
      },
      body: JSON.stringify({
        pinataContent: content,
        pinataMetadata: {
          name: `evidence-${Date.now()}.json`,
        },
      }),
    });
    
    if (!response.ok) {
      throw new Error('上传到Pinata失败');
    }
    
    const result = await response.json();
    return result.IpfsHash;
    
  } catch (error) {
    console.error('上传到IPFS失败:', error);
    
    // 方式2：使用本地IPFS节点
    try {
      const response = await fetch('http://localhost:5001/api/v0/add', {
        method: 'POST',
        body: JSON.stringify(content),
      });
      
      const result = await response.json();
      return result.Hash;
      
    } catch (localError) {
      console.error('使用本地IPFS节点失败:', localError);
      throw new Error('上传到IPFS失败，请配置IPFS服务');
    }
  }
}

