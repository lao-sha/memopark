import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';

async function main() {
  const provider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider });
  
  // 从命令行获取接收地址
  const recipientAddress = process.argv[2];
  
  if (!recipientAddress) {
    console.error('使用方法: node fund_account.mjs <接收地址>');
    console.error('例如: node fund_account.mjs 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
    process.exit(1);
  }
  
  // 使用 Alice 账户（开发链预置账户）
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  
  console.log('从 Alice 转账 1000 DUST 到:', recipientAddress);
  
  // 转账 1000 DUST (1000 * 10^12)
  const amount = 1000n * 1_000_000_000_000n;
  
  const transfer = api.tx.balances.transferKeepAlive(recipientAddress, amount);
  
  const hash = await transfer.signAndSend(alice);
  console.log('✅ 转账成功！交易哈希:', hash.toHex());
  
  await api.disconnect();
  process.exit(0);
}

main().catch(e => {
  console.error('错误:', e);
  process.exit(1);
});
