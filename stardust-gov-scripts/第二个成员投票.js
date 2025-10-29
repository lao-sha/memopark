/**
 * 使用第二个 Council 成员投票
 */
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

async function main() {
  await cryptoWaitReady();
  
  const provider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider });
  
  console.log('🗳️ 第二个 Council 成员投票流程\n');
  
  // 第三个 Council 成员的助记词 (有大量余额的账户)
  const mnemonic = 'satoshi sure behave certain impulse ski slight track century kitchen clutch story';
  
  if (mnemonic === 'YOUR_MNEMONIC_HERE') {
    console.log('❌ 请先填写助记词！');
    console.log('');
    console.log('编辑此脚本，将 YOUR_MNEMONIC_HERE 替换为实际的助记词');
    await api.disconnect();
    return;
  }
  
  const keyring = new Keyring({ type: 'sr25519' });
  const account = keyring.addFromMnemonic(mnemonic);
  
  console.log('👤 账户地址:', account.address);
  console.log('');
  
  // 验证地址
  const expectedAddress = '5CrDBEVDgXUwctSuV8EvQEBo2m187PcxoY36V7H7PGErHUW4';
  if (account.address !== expectedAddress) {
    console.log('❌ 地址不匹配！');
    console.log('   期望:', expectedAddress);
    console.log('   实际:', account.address);
    await api.disconnect();
    return;
  }
  
  console.log('✅ 地址验证通过！');
  console.log('');
  
  // 1. 检查余额
  const accountInfo = await api.query.system.account(account.address);
  const free = accountInfo.data.free.toString();
  const freeMemo = Number(free) / 1e12;
  console.log('💰 可用余额:', freeMemo.toFixed(2), 'MEMO');
  
  if (freeMemo < 1) {
    console.log('❌ 余额不足！');
    await api.disconnect();
    return;
  }
  console.log('');
  
  // 2. 检查投票状态
  const proposalHash = '0xef84447df8d3daeeba96c757ec5fa9739835068fa7c4d348c8f735e659d359e9';
  const votingOpt = await api.query.council.voting(proposalHash);
  
  if (!votingOpt.isSome) {
    console.log('❌ 提案不存在！');
    await api.disconnect();
    return;
  }
  
  const voting = votingOpt.unwrap().toJSON();
  console.log('🗳️ 当前投票状态:');
  console.log('   提案索引:', voting.index);
  console.log('   阈值:', voting.threshold);
  console.log('   赞成票:', voting.ayes.length);
  console.log('   反对票:', voting.nays.length);
  
  const hasVoted = voting.ayes.includes(account.address) || voting.nays.includes(account.address);
  console.log('   已投票:', hasVoted ? '是' : '否');
  console.log('');
  
  if (hasVoted) {
    console.log('✅ 该成员已投票，无需重复投票');
    console.log('');
    
    // 检查是否可以执行
    if (voting.ayes.length >= voting.threshold) {
      console.log('🎉 提案已达到阈值，可以执行！');
      console.log('');
      console.log('执行命令:');
      console.log('   api.tx.council.close(proposalHash, index, weight, lengthBound)');
    }
    
    await api.disconnect();
    return;
  }
  
  // 3. 投票
  console.log('📝 正在投赞成票...');
  const voteTx = api.tx.council.vote(proposalHash, voting.index, true);
  
  return new Promise((resolve, reject) => {
    voteTx.signAndSend(account, ({ status, events, dispatchError }) => {
      console.log('   交易状态:', status.type);
      
      if (status.isInBlock) {
        console.log('   ✅ 已打包到区块:', status.asInBlock.toHex().slice(0, 10) + '...');
      }
      
      if (status.isFinalized) {
        console.log('   🎊 已最终确认:', status.asFinalized.toHex().slice(0, 10) + '...');
        console.log('');
        
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            console.log('   ❌ 调用失败:', `${decoded.section}.${decoded.name}: ${decoded.docs}`);
            reject(new Error(`${decoded.section}.${decoded.name}`));
          } else {
            console.log('   ❌ 调用失败:', dispatchError.toString());
            reject(new Error(dispatchError.toString()));
          }
        } else {
          console.log('   ✅ 投票成功！');
          console.log('');
          
          // 查询最新状态
          api.query.council.voting(proposalHash).then(updatedVotingOpt => {
            const updatedVoting = updatedVotingOpt.unwrap().toJSON();
            console.log('📊 最新投票状态:');
            console.log('   赞成票:', updatedVoting.ayes.length, '/', updatedVoting.threshold);
            console.log('   反对票:', updatedVoting.nays.length);
            console.log('');
            
            if (updatedVoting.ayes.length >= updatedVoting.threshold) {
              console.log('🎉 提案已达到阈值！可以执行提案了');
            } else {
              console.log('⏳ 还需', updatedVoting.threshold - updatedVoting.ayes.length, '票才能执行');
            }
            
            api.disconnect();
            resolve();
          });
        }
      }
    });
  });
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});

