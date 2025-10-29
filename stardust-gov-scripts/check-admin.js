#!/usr/bin/env node

/**
 * 检查管理员权限
 */

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

const ADMIN_CONFIG = {
  mnemonic: 'gown lounge wolf cake hard sport napkin lock buddy interest session inside',
  expectedAddress: '5C7RjMrgfCJYyscR5Du1BLP99vFGgRDXjAt3ronftJZe39Qo',
};

async function main() {
  console.log('🔍 检查管理员权限...\n');
  
  await cryptoWaitReady();
  
  const keyring = new Keyring({ type: 'sr25519' });
  const adminPair = keyring.addFromMnemonic(ADMIN_CONFIG.mnemonic);
  
  console.log('📋 账户信息:');
  console.log(`   地址: ${adminPair.address}`);
  console.log(`   期望: ${ADMIN_CONFIG.expectedAddress}`);
  console.log(`   匹配: ${adminPair.address === ADMIN_CONFIG.expectedAddress ? '✅' : '❌'}\n`);
  
  const api = await ApiPromise.create({ 
    provider: new WsProvider('ws://127.0.0.1:9944') 
  });
  
  console.log('🔑 检查权限...\n');
  
  // 1. 检查 Sudo 权限
  console.log('1️⃣ Sudo 权限:');
  try {
    const sudoKey = await api.query.sudo.key();
    const sudoAddress = sudoKey.toString();
    console.log(`   Sudo 账户: ${sudoAddress}`);
    console.log(`   当前账户: ${adminPair.address}`);
    console.log(`   是否匹配: ${sudoAddress === adminPair.address ? '✅ 是' : '❌ 否'}`);
  } catch (e) {
    console.log('   ⚠️  Sudo pallet 不可用');
  }
  
  // 2. 检查余额
  console.log('\n2️⃣ 账户余额:');
  const { data: balanceData } = await api.query.system.account(adminPair.address);
  const decimals = api.registry.chainDecimals?.[0] ?? 12;
  const symbol = api.registry.chainTokens?.[0] ?? 'MEMO';
  const free = balanceData.free.toBigInt();
  const reserved = balanceData.reserved.toBigInt();
  const frozen = balanceData.frozen?.toBigInt() || 0n;
  
  console.log(`   可用: ${formatBalance(free, decimals)} ${symbol}`);
  console.log(`   保留: ${formatBalance(reserved, decimals)} ${symbol}`);
  if (frozen > 0n) {
    console.log(`   冻结: ${formatBalance(frozen, decimals)} ${symbol}`);
  }
  
  // 3. 测试创建权限
  console.log('\n3️⃣ 测试创建权限:');
  
  // 尝试使用 sudo 包装
  if (api.tx.sudo && api.tx.sudo.sudo) {
    console.log('   ℹ️  检测到 Sudo pallet，可以使用 sudo 权限');
    console.log('   💡 建议: 使用 sudo.sudo 包装 createOffering 调用');
  }
  
  // 检查是否有直接的 AdminOrigin
  console.log('\n4️⃣ 可用的创建方式:');
  console.log('   方式1: 直接调用 createOffering（需要 AdminOrigin）');
  console.log('   方式2: 使用 sudo.sudo 包装调用（需要 Sudo 权限）');
  
  await api.disconnect();
  
  console.log('\n💡 解决方案:');
  console.log('   如果当前账户是 Sudo 账户，修改脚本使用:');
  console.log('   api.tx.sudo.sudo(');
  console.log('     api.tx.memorialOfferings.createOffering(...)');
  console.log('   )');
  console.log('\n   或使用具有 AdminOrigin 权限的账户');
}

function formatBalance(value, decimals) {
  const base = 10n ** BigInt(decimals);
  const integer = value / base;
  const fraction = value % base;
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 6);
  return `${integer}.${fractionStr}`;
}

main().catch(error => {
  console.error('❌ 错误:', error.message);
  process.exit(1);
});

