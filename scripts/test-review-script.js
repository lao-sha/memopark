#!/usr/bin/env node

/**
 * 函数级详细中文注释：审核脚本自动化测试
 *
 * 功能：模拟审核流程，验证脚本功能
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');

// 分类映射
const CATEGORY_MAP = {
  0: { name: 'Ordinary', label: '普通民众' },
  1: { name: 'HistoricalFigure', label: '历史人物' },
  2: { name: 'Martyr', label: '革命烈士' },
  3: { name: 'Hero', label: '英雄模范' },
  4: { name: 'PublicFigure', label: '公众人物' },
  5: { name: 'ReligiousFigure', label: '宗教人物' },
  6: { name: 'EventHall', label: '事件馆' }
};

async function main() {
  console.log('🧪 审核脚本自动化测试');
  console.log('='.repeat(80));

  // 连接到链
  console.log('\n🔗 正在连接到节点...');
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });

  console.log(`✅ 已连接: ${(await api.rpc.system.chain()).toString()}`);

  // 初始化账户
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  console.log(`👤 测试账户: Alice (${alice.address})`);

  // 测试1: 查询最近创建的逝者
  console.log('\n📊 测试1: 查询创建时间索引');
  console.log('─'.repeat(80));

  const currentBlock = await api.query.system.number();
  const currentBlockNum = currentBlock.toNumber();
  console.log(`当前区块: ${currentBlockNum}`);

  // 查询最近100个区块的逝者
  const startBlock = Math.max(0, currentBlockNum - 1000);
  let recentCount = 0;

  for (let block = startBlock; block <= currentBlockNum; block += 50) {
    const deceasedIds = await api.query.deceased.deceasedByCreationTime(block);
    if (deceasedIds && deceasedIds.length > 0) {
      recentCount += deceasedIds.length;
      console.log(`  区块 ${block}: 找到 ${deceasedIds.length} 个逝者`);
    }
  }

  console.log(`✅ 最近1000个区块共找到 ${recentCount} 个逝者`);

  // 测试2: 查询所有逝者并显示分类
  console.log('\n📊 测试2: 查询逝者分类分布');
  console.log('─'.repeat(80));

  const categoryStats = {
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
  };

  // 查询前10个逝者
  console.log('查询前10个逝者的详细信息：\n');

  for (let i = 0; i < 10; i++) {
    const deceased = await api.query.deceased.deceasedOf(i);

    if (deceased.isSome) {
      const deceasedData = deceased.unwrap();
      const category = (await api.query.deceased.categoryOf(i)).toNumber();

      categoryStats[category]++;

      console.log(`[逝者 ${i}]`);
      console.log(`  姓名: ${deceasedData.fullName || '未填写'}`);
      console.log(`  分类: ${CATEGORY_MAP[category].label} (代码: ${category})`);
      console.log(`  所有者: ${deceasedData.owner.toString().substring(0, 10)}...`);
      console.log('');
    }
  }

  console.log('分类统计：');
  Object.entries(categoryStats).forEach(([code, count]) => {
    if (count > 0) {
      console.log(`  ${CATEGORY_MAP[code].label}: ${count} 个`);
    }
  });

  // 测试3: 测试分类查询功能
  console.log('\n📊 测试3: 测试按分类查询');
  console.log('─'.repeat(80));

  for (let categoryCode = 0; categoryCode <= 6; categoryCode++) {
    const categoryEnum = { [CATEGORY_MAP[categoryCode].name]: null };
    const deceasedIds = await api.query.deceased.deceasedByCategory(categoryEnum);

    if (deceasedIds && deceasedIds.length > 0) {
      console.log(`${CATEGORY_MAP[categoryCode].label}: ${deceasedIds.length} 个逝者`);
      console.log(`  ID列表: [${deceasedIds.slice(0, 5).map(id => id.toNumber()).join(', ')}${deceasedIds.length > 5 ? '...' : ''}]`);
    } else {
      console.log(`${CATEGORY_MAP[categoryCode].label}: 0 个逝者`);
    }
  }

  // 测试4: 验证sudo权限
  console.log('\n📊 测试4: 验证sudo账户');
  console.log('─'.repeat(80));

  const sudoKey = await api.query.sudo.key();
  console.log(`Sudo账户: ${sudoKey.toString()}`);

  if (sudoKey.toString() === alice.address) {
    console.log('✅ Alice账户拥有sudo权限');
  } else {
    console.log('⚠️  警告: Alice账户没有sudo权限');
  }

  // 测试5: 检查forceSetCategory函数是否存在
  console.log('\n📊 测试5: 验证链上函数');
  console.log('─'.repeat(80));

  if (api.tx.deceased.forceSetCategory) {
    console.log('✅ forceSetCategory 函数存在');
    console.log('   可以使用sudo权限强制更新分类');
  } else {
    console.log('❌ forceSetCategory 函数不存在');
    console.log('   可能需要升级runtime');
  }

  if (api.query.deceased.deceasedByCreationTime) {
    console.log('✅ deceasedByCreationTime 索引存在');
    console.log('   可以按时间查询逝者');
  } else {
    console.log('⚠️  deceasedByCreationTime 索引不存在');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ 所有测试完成！');
  console.log('\n💡 提示：');
  console.log('   - 如果有逝者数据，可以运行完整审核脚本：');
  console.log('     node scripts/review-recent-deceased-categories.js');
  console.log('   - 或使用Shell包装器：');
  console.log('     ./scripts/review-categories.sh');
  console.log('='.repeat(80));

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});
