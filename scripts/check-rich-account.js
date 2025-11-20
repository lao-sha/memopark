const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

async function main() {
  await cryptoWaitReady();
  
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  
  // 创世配置中有余额的账户
  const richAddress = '5CrDBEVDgXUwctSuV8EvQEBo2m187PcxoY36V7H7PGErHUW4';
  
  const { data: { free, reserved, frozen } } = await api.query.system.account(richAddress);
  
  console.log('💰 创世账户余额信息:');
  console.log(`   地址: ${richAddress}`);
  console.log(`   可用余额: ${free.toHuman()}`);
  console.log(`   实际可用: ${(free.toBigInt() - frozen.toBigInt()).toString()}`);
  
  // 检查 Alice
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  const aliceInfo = await api.query.system.account(alice.address);
  
  console.log('\n💰 Alice 账户余额:');
  console.log(`   地址: ${alice.address}`);
  console.log(`   可用余额: ${aliceInfo.data.free.toHuman()}`);
  
  await api.disconnect();
}

main().catch(console.error);
