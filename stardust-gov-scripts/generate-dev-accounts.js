#!/usr/bin/env node

/**
 * 生成标准开发账户
 */

const { Keyring } = require('@polkadot/api');
const { mnemonicGenerate } = require('@polkadot/util-crypto');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

async function main() {
  await cryptoWaitReady();
  
  console.log('🔑 Substrate 标准开发账户\n');
  console.log('='.repeat(80));
  
  const keyring = new Keyring({ type: 'sr25519' });
  
  // 方法1: 使用标准的开发助记词
  console.log('\n📋 方法1: 标准开发助记词（推荐）\n');
  
  const devMnemonic = 'bottom drive obey lake curtain smoke basket hold race lonely fit walk';
  
  // Alice
  const alice = keyring.addFromUri(`${devMnemonic}//Alice`, { name: 'Alice' });
  console.log('👤 Alice:');
  console.log(`   助记词: ${devMnemonic}//Alice`);
  console.log(`   地址:   ${alice.address}`);
  console.log(`   期望:   5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY`);
  console.log(`   匹配:   ${alice.address === '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' ? '✅' : '❌'}`);
  
  // Bob
  const bob = keyring.addFromUri(`${devMnemonic}//Bob`, { name: 'Bob' });
  console.log('\n👤 Bob:');
  console.log(`   助记词: ${devMnemonic}//Bob`);
  console.log(`   地址:   ${bob.address}`);
  console.log(`   期望:   5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty`);
  console.log(`   匹配:   ${bob.address === '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty' ? '✅' : '❌'}`);
  
  // Charlie
  const charlie = keyring.addFromUri(`${devMnemonic}//Charlie`, { name: 'Charlie' });
  console.log('\n👤 Charlie:');
  console.log(`   助记词: ${devMnemonic}//Charlie`);
  console.log(`   地址:   ${charlie.address}`);
  
  // 方法2: 不使用派生路径
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 方法2: 不使用派生路径\n');
  
  const base = keyring.addFromMnemonic(devMnemonic);
  console.log('👤 基础账户（无派生路径）:');
  console.log(`   助记词: ${devMnemonic}`);
  console.log(`   地址:   ${base.address}`);
  
  // 方法3: 使用完整 URI 格式
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 方法3: 完整 URI 格式（Polkadot.js 默认）\n');
  
  // Alice 使用完整格式
  const aliceFull = keyring.addFromUri('//Alice', { name: 'Alice default' });
  console.log('👤 Alice (完整格式):');
  console.log(`   URI:    //Alice`);
  console.log(`   地址:   ${aliceFull.address}`);
  console.log(`   期望:   5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY`);
  console.log(`   匹配:   ${aliceFull.address === '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' ? '✅' : '❌'}`);
  
  // 方法4: 检查当前脚本使用的助记词
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 方法4: 检查脚本当前使用的助记词\n');
  
  const currentMnemonic = 'bottom drive obey lake curtain smoke basket hold race lonely fit walk';
  const current = keyring.addFromMnemonic(currentMnemonic);
  console.log('👤 当前脚本账户:');
  console.log(`   助记词: ${currentMnemonic}`);
  console.log(`   地址:   ${current.address}`);
  console.log(`   实际:   5DfhGyQdFobKM8NsWvEeAKk5EQQgYe9AydgJ7rMB6E1EqRzV`);
  console.log(`   匹配:   ${current.address === '5DfhGyQdFobKM8NsWvEeAKk5EQQgYe9AydgJ7rMB6E1EqRzV' ? '✅' : '❌'}`);
  
  // 推荐方案
  console.log('\n' + '='.repeat(80));
  console.log('\n💡 推荐方案:\n');
  console.log('使用 URI 格式: //Alice');
  console.log('这是 Substrate 开发环境的标准方式');
  console.log('\n修改脚本:');
  console.log('```javascript');
  console.log('const ADMIN_CONFIG = {');
  console.log('  uri: \'//Alice\',  // 使用 URI 格式');
  console.log('  expectedAddress: \'5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY\',');
  console.log('};');
  console.log('');
  console.log('// 创建账户');
  console.log('const adminPair = keyring.addFromUri(ADMIN_CONFIG.uri);');
  console.log('```');
  
  console.log('\n' + '='.repeat(80));
}

main().catch(console.error);

