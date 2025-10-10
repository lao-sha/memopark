#!/usr/bin/env node
/**
 * 函数级详细中文注释：计算 dead 黑洞地址
 * 
 * 功能：计算后4位为 0x0000dead 的地址的 SS58 编码
 */

const { encodeAddress } = require('@polkadot/keyring');

// 生成 0x000...0dead 地址
const bytes = new Uint8Array(32);
// 前28字节默认为0
// 后4字节设为 0x0000dead
bytes[28] = 0x00;
bytes[29] = 0x00;
bytes[30] = 0xde;
bytes[31] = 0xad;

console.log('🔥 Dead 黑洞地址计算\n');

// 十六进制表示
const hexString = '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
console.log('十六进制地址:');
console.log(hexString);
console.log();

// SS58 编码（不同网络）
console.log('SS58 地址编码:');
console.log('Format 0 (Polkadot):', encodeAddress(bytes, 0));
console.log('Format 2 (Kusama):  ', encodeAddress(bytes, 2));
console.log('Format 42 (Generic):', encodeAddress(bytes, 42));
console.log();

// 与全0地址对比
const zeroBytes = new Uint8Array(32);
console.log('对比 - 全0地址:');
console.log('Format 42:', encodeAddress(zeroBytes, 42));
console.log();

// 验证后4字节
console.log('后4字节验证:');
console.log('bytes[28]:', '0x' + bytes[28].toString(16).padStart(2, '0'));
console.log('bytes[29]:', '0x' + bytes[29].toString(16).padStart(2, '0'));
console.log('bytes[30]:', '0x' + bytes[30].toString(16).padStart(2, '0'), '(de)');
console.log('bytes[31]:', '0x' + bytes[31].toString(16).padStart(2, '0'), '(ad)');
console.log();

// "dead" 的含义
console.log('💀 语义解释:');
console.log('dead = 0xdead = 57005 (十进制)');
console.log('在加密货币社区，"dead" 表示已销毁/死亡/不可用');

