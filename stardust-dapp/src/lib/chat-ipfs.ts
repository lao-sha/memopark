/**
 * 聊天功能 IPFS 工具函数
 * 
 * 功能：
 * - 上传加密消息内容到 IPFS
 * - 从 IPFS 下载加密消息内容
 * - 支持文件、图片、语音等多媒体内容
 */

import { create as ipfsHttpClient } from 'ipfs-http-client';
import type { IPFSHTTPClient } from 'ipfs-http-client';
import type { IpfsUploadResult, MessageContent } from '../types/chat';

/**
 * IPFS 客户端配置
 */
const IPFS_CONFIG = {
  // 使用 Infura IPFS 网关（可配置为自建节点）
  url: 'https://ipfs.infura.io:5001/api/v0',
  // 备选：使用本地节点
  // url: 'http://localhost:5001',
};

/**
 * IPFS 网关配置（用于下载）
 */
const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

/**
 * 获取 IPFS 客户端实例
 */
let ipfsClient: IPFSHTTPClient | null = null;

function getIpfsClient(): IPFSHTTPClient {
  if (!ipfsClient) {
    ipfsClient = ipfsHttpClient(IPFS_CONFIG);
  }
  return ipfsClient;
}

/**
 * 上传加密消息到 IPFS
 * 
 * @param encryptedContent - 加密后的消息内容（JSON字符串）
 * @returns IPFS CID
 */
export async function uploadMessageToIpfs(
  encryptedContent: string
): Promise<IpfsUploadResult> {
  try {
    const client = getIpfsClient();
    
    // 将加密内容转换为 Uint8Array
    const content = new TextEncoder().encode(encryptedContent);
    
    // 上传到 IPFS
    const result = await client.add(content, {
      pin: true, // 自动 pin
      progress: (bytes) => {
        console.log(`IPFS 上传进度: ${bytes} bytes`);
      },
    });
    
    return {
      cid: result.path,
      size: result.size,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('IPFS 上传失败:', error);
    throw new Error(`IPFS 上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 从 IPFS 下载加密消息
 * 
 * @param cid - IPFS CID
 * @returns 加密的消息内容（JSON字符串）
 */
export async function downloadMessageFromIpfs(cid: string): Promise<string> {
  try {
    const client = getIpfsClient();
    
    // 从 IPFS 下载
    const chunks: Uint8Array[] = [];
    for await (const chunk of client.cat(cid)) {
      chunks.push(chunk);
    }
    
    // 合并所有 chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    
    // 转换为字符串
    const content = new TextDecoder().decode(merged);
    
    return content;
  } catch (error) {
    console.error('IPFS 下载失败:', error);
    throw new Error(`IPFS 下载失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 上传文件到 IPFS
 * 
 * @param file - 文件对象
 * @returns IPFS CID
 */
export async function uploadFileToIpfs(file: File): Promise<IpfsUploadResult> {
  try {
    const client = getIpfsClient();
    
    // 读取文件内容
    const buffer = await file.arrayBuffer();
    const content = new Uint8Array(buffer);
    
    // 上传到 IPFS
    const result = await client.add(content, {
      pin: true,
      progress: (bytes) => {
        console.log(`文件上传进度: ${bytes} / ${file.size} bytes`);
      },
    });
    
    return {
      cid: result.path,
      size: result.size,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('文件上传失败:', error);
    throw new Error(`文件上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 获取 IPFS 文件 URL
 * 
 * @param cid - IPFS CID
 * @returns IPFS 网关 URL
 */
export function getIpfsUrl(cid: string): string {
  return `${IPFS_GATEWAY}${cid}`;
}

/**
 * 检查 IPFS 客户端是否可用
 */
export async function checkIpfsAvailability(): Promise<boolean> {
  try {
    const client = getIpfsClient();
    await client.id();
    return true;
  } catch (error) {
    console.error('IPFS 客户端不可用:', error);
    return false;
  }
}

/**
 * Pin 指定的 CID（确保内容持久化）
 * 
 * @param cid - IPFS CID
 */
export async function pinContent(cid: string): Promise<void> {
  try {
    const client = getIpfsClient();
    await client.pin.add(cid);
    console.log(`已 Pin: ${cid}`);
  } catch (error) {
    console.error('Pin 失败:', error);
    throw new Error(`Pin 失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

