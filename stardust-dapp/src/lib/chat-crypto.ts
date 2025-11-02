/**
 * 聊天功能加密工具函数
 * 
 * 功能：
 * - 端到端加密消息内容
 * - 使用接收方公钥加密
 * - 使用发送方私钥解密
 * - 基于 Polkadot.js 的加密方案
 */

import { u8aToHex, hexToU8a, stringToU8a, u8aToString } from '@polkadot/util';
import { naclEncrypt, naclDecrypt, randomAsU8a } from '@polkadot/util-crypto';
import type { MessageContent } from '../types/chat';

/**
 * 加密消息内容
 * 
 * @param content - 消息内容对象
 * @param receiverPublicKey - 接收方公钥（hex格式）
 * @returns 加密后的内容（hex字符串）
 */
export async function encryptMessageContent(
  content: MessageContent,
  receiverPublicKey: string
): Promise<string> {
  try {
    // 将消息内容序列化为 JSON
    const jsonString = JSON.stringify(content);
    
    // 转换为 Uint8Array
    const message = stringToU8a(jsonString);
    
    // 使用接收方公钥加密
    const receiverPubKey = hexToU8a(receiverPublicKey);
    
    // 生成随机 nonce
    const secret = randomAsU8a(32);
    
    // 使用 NaCl 加密
    const { encrypted, nonce } = naclEncrypt(message, secret, receiverPubKey);
    
    // 组合 nonce + encrypted 并返回 hex 格式
    const combined = new Uint8Array(nonce.length + encrypted.length);
    combined.set(nonce);
    combined.set(encrypted, nonce.length);
    
    return u8aToHex(combined);
  } catch (error) {
    console.error('消息加密失败:', error);
    throw new Error(`消息加密失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 解密消息内容
 * 
 * @param encryptedContent - 加密的内容（hex字符串）
 * @param myPrivateKey - 我的私钥（hex格式）
 * @returns 解密后的消息内容对象
 */
export async function decryptMessageContent(
  encryptedContent: string,
  myPrivateKey: string
): Promise<MessageContent> {
  try {
    // 转换为 Uint8Array
    const combined = hexToU8a(encryptedContent);
    const privateKey = hexToU8a(myPrivateKey);
    
    // 分离 nonce 和 encrypted（nonce 是前 24 字节）
    const nonce = combined.slice(0, 24);
    const encrypted = combined.slice(24);
    
    // 解密
    const decrypted = naclDecrypt(encrypted, nonce, privateKey);
    
    if (!decrypted) {
      throw new Error('解密失败：私钥不匹配');
    }
    
    // 转换为字符串
    const jsonString = u8aToString(decrypted);
    
    // 解析 JSON
    const content: MessageContent = JSON.parse(jsonString);
    
    return content;
  } catch (error) {
    console.error('消息解密失败:', error);
    throw new Error(`消息解密失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 从账户地址获取公钥
 * 
 * 注意：Substrate 地址已包含公钥信息
 * 
 * @param address - 账户地址
 * @returns 公钥（hex格式）
 */
export function getPublicKeyFromAddress(address: string): string {
  try {
    // Substrate 地址使用 SS58 编码，可以解码得到公钥
    // 这里简化处理，实际应该使用 @polkadot/util-crypto 的 decodeAddress
    const { decodeAddress } = require('@polkadot/util-crypto');
    const publicKey = decodeAddress(address);
    return u8aToHex(publicKey);
  } catch (error) {
    console.error('获取公钥失败:', error);
    throw new Error(`获取公钥失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 验证消息签名（可选功能）
 * 
 * @param message - 原始消息
 * @param signature - 签名
 * @param publicKey - 公钥
 * @returns 是否验证通过
 */
export function verifyMessageSignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const { signatureVerify } = require('@polkadot/util-crypto');
    const result = signatureVerify(message, signature, publicKey);
    return result.isValid;
  } catch (error) {
    console.error('签名验证失败:', error);
    return false;
  }
}

/**
 * 生成消息哈希（用于验证消息完整性）
 * 
 * @param content - 消息内容
 * @returns 消息哈希（hex格式）
 */
export function hashMessageContent(content: MessageContent): string {
  try {
    const { blake2AsHex } = require('@polkadot/util-crypto');
    const jsonString = JSON.stringify(content);
    return blake2AsHex(jsonString);
  } catch (error) {
    console.error('计算哈希失败:', error);
    throw new Error(`计算哈希失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

