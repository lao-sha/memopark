#!/usr/bin/env node

/**
 * 检查委员会成员和账户权限
 */

import { ApiPromise, WsProvider } from '@polkadot/api';

const WS_URL = 'ws://127.0.0.1:9944';

async function main() {
  console.log('🔍 检查委员会状态...\n');

  // 连接到链
  const provider = new WsProvider(WS_URL);
  const api = await ApiPromise.create({ provider });
  await api.isReady;
  console.log('✅ 已连接到链\n');

  // 获取委员会成员
  const members = await api.query.council.members();
  console.log(`📊 当前委员会成员数: ${members.length}\n`);

  if (members.length === 0) {
    console.log('⚠️  委员会没有成员！请运行 init-council.mjs 初始化');
    await api.disconnect();
    return;
  }

  console.log('👥 委员会成员列表:');
  members.forEach((member, index) => {
    console.log(`  ${index + 1}. ${member.toString()}`);
  });

  console.log('\n📝 如何使用这些账户:');
  console.log('1. 在 Polkadot.js Extension 中导入这些账户的私钥');
  console.log('2. 或者使用 sudo 重新设置委员会成员为你的账户');
  console.log('3. 或者使用标准开发账户 (Alice, Bob, Charlie)\n');

  // 获取提案列表
  const proposalHashes = await api.query.council.proposals();
  console.log(`📋 当前提案数: ${proposalHashes.length}`);
  if (proposalHashes.length > 0) {
    console.log('\n提案列表:');
    for (const hash of proposalHashes) {
      const proposalOpt = await api.query.council.proposalOf(hash);
      const voting = await api.query.council.voting(hash);
      
      if (proposalOpt.isSome && voting.isSome) {
        const votingInfo = voting.unwrap().toJSON();
        console.log(`  - 哈希: ${hash.toHex().slice(0, 20)}...`);
        console.log(`    索引: ${votingInfo.index}`);
        console.log(`    赞成: ${votingInfo.ayes.length}, 反对: ${votingInfo.nays.length}`);
        console.log(`    阈值: ${votingInfo.threshold}`);
      }
    }
  }

  await api.disconnect();
}

main()
  .then(() => {
    console.log('\n✅ 检查完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 检查失败:', error);
    process.exit(1);
  });

