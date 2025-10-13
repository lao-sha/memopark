#!/usr/bin/env node

/**
 * 存储费用监控 Dashboard 测试脚本
 * 
 * 功能：
 * - 验证三个存储池账户地址的正确性
 * - 查询池账户余额
 * - 查询路由表配置
 * - 查询累计统计数据
 */

import { ApiPromise, WsProvider } from '@polkadot/api';
import { encodeAddress } from '@polkadot/util-crypto';

// ============ 配置 ============

const WS_URL = 'ws://127.0.0.1:9944';

// 三个存储池的 PalletId
const POOL_PALLETS = [
  { name: 'IPFS 运营者池', palletId: 'py/ipfs+', percentage: 50 },
  { name: 'Arweave 运营者池', palletId: 'py/arwve', percentage: 30 },
  { name: '节点运维激励池', palletId: 'py/nodes', percentage: 20 },
];

// ============ 工具函数 ============

/**
 * PalletId 转 AccountId (32 字节)
 */
function palletIdToAccountId(palletId) {
  const modPrefix = new TextEncoder().encode('modl');
  const palletBytes = new TextEncoder().encode(palletId);
  const accountId = new Uint8Array(32);
  accountId.set(modPrefix, 0);
  accountId.set(palletBytes, 5);
  return accountId;
}

/**
 * 格式化余额（Planck -> MEMO）
 */
function formatBalance(balance) {
  const value = BigInt(balance.toString());
  const decimals = 18n;
  const divisor = 10n ** decimals;
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  const fractionalStr = fractionalPart.toString().padStart(Number(decimals), '0');
  const displayFractional = fractionalStr.slice(0, 4);
  return `${integerPart.toLocaleString()}.${displayFractional}`;
}

/**
 * Permill 转百分比
 */
function permillToPercent(permill) {
  return (permill / 10000).toFixed(2);
}

// ============ 主函数 ============

async function main() {
  console.log('🔗 连接到区块链...\n');
  const provider = new WsProvider(WS_URL);
  const api = await ApiPromise.create({ provider });

  await api.isReady;
  console.log('✅ 已连接到区块链\n');

  // ====================================
  // 1. 验证存储池地址
  // ====================================
  console.log('━'.repeat(80));
  console.log('📍 存储池账户地址验证');
  console.log('━'.repeat(80));
  
  for (const pool of POOL_PALLETS) {
    const accountId = palletIdToAccountId(pool.palletId);
    const ss58Address = encodeAddress(accountId, 42); // 42 = Substrate 默认前缀
    
    console.log(`\n${pool.name}:`);
    console.log(`  PalletId:  ${pool.palletId}`);
    console.log(`  地址:      ${ss58Address}`);
    console.log(`  分配比例:  ${pool.percentage}%`);
  }

  // ====================================
  // 2. 查询池账户余额
  // ====================================
  console.log('\n\n' + '━'.repeat(80));
  console.log('💰 存储池账户余额查询');
  console.log('━'.repeat(80));

  let totalBalance = 0n;
  
  for (const pool of POOL_PALLETS) {
    const accountId = palletIdToAccountId(pool.palletId);
    const account = await api.query.system.account(accountId);
    const accountData = account.toJSON();
    
    const free = BigInt(accountData.data.free);
    const reserved = BigInt(accountData.data.reserved);
    const total = free + reserved;
    totalBalance += total;

    console.log(`\n${pool.name}:`);
    console.log(`  可用余额:  ${formatBalance(free)} MEMO`);
    console.log(`  保留余额:  ${formatBalance(reserved)} MEMO`);
    console.log(`  总余额:    ${formatBalance(total)} MEMO`);
  }

  console.log(`\n总计: ${formatBalance(totalBalance)} MEMO`);

  // ====================================
  // 3. 查询路由表配置
  // ====================================
  console.log('\n\n' + '━'.repeat(80));
  console.log('🗺️  路由表配置');
  console.log('━'.repeat(80));

  const routes = await api.query.storageTreasury.storageRouteTable();
  const routesData = routes.toJSON();

  if (!routesData || routesData.length === 0) {
    console.log('\n⚠️  路由表未配置');
    console.log('💡 提示: 运行以下命令配置路由表:');
    console.log('   node scripts/setup-storage-routes.js');
  } else {
    console.log('\n');
    console.table(
      routesData.map((route) => {
        const kindMap = {
          0: 'IPFS 池',
          1: 'Arweave 池',
          3: '节点池',
        };
        return {
          类型: kindMap[route.kind] || `未知 (${route.kind})`,
          目标账户: `${route.account.slice(0, 10)}...${route.account.slice(-8)}`,
          分配比例: `${permillToPercent(route.share)}%`,
        };
      })
    );
  }

  // ====================================
  // 4. 查询累计统计数据
  // ====================================
  console.log('━'.repeat(80));
  console.log('📊 累计统计数据');
  console.log('━'.repeat(80));

  const totalCollected = await api.query.storageTreasury.totalCollected();
  const totalDistributed = await api.query.storageTreasury.totalDistributed();
  const lastDistributionBlock = await api.query.storageTreasury.lastDistributionBlock();
  const header = await api.rpc.chain.getHeader();
  const currentBlock = header.number.toNumber();

  console.log(`\n累计收集:      ${formatBalance(totalCollected)} MEMO`);
  console.log(`累计分配:      ${formatBalance(totalDistributed)} MEMO`);

  const collected = BigInt(totalCollected.toString());
  const distributed = BigInt(totalDistributed.toString());
  const distributionRate =
    collected > 0n ? Number((distributed * 10000n) / collected) / 100 : 0;
  console.log(`分配率:        ${distributionRate.toFixed(2)}%`);

  const lastBlock = Number(lastDistributionBlock.toString());
  console.log(`\n最后分配区块:  #${lastBlock.toLocaleString()}`);
  console.log(`当前区块:      #${currentBlock.toLocaleString()}`);

  // 计算下次分配时间
  const distributionPeriod = 100800; // 7 天
  const blocksRemaining =
    lastBlock === 0
      ? distributionPeriod
      : distributionPeriod - ((currentBlock - lastBlock) % distributionPeriod);

  const secondsRemaining = blocksRemaining * 6;
  const hoursRemaining = Math.floor(secondsRemaining / 3600);
  const minutesRemaining = Math.floor((secondsRemaining % 3600) / 60);

  console.log(`下次分配:      约 ${blocksRemaining.toLocaleString()} 区块`);
  console.log(`               ≈ ${hoursRemaining} 小时 ${minutesRemaining} 分钟`);

  // ====================================
  // 5. 健康检查
  // ====================================
  console.log('\n' + '━'.repeat(80));
  console.log('🩺 健康检查');
  console.log('━'.repeat(80));

  const checks = [];

  // 检查1: 路由表是否配置
  checks.push({
    项目: '路由表配置',
    状态: routesData && routesData.length > 0 ? '✅ 已配置' : '❌ 未配置',
  });

  // 检查2: 是否有收集记录
  checks.push({
    项目: '累计收集',
    状态: collected > 0n ? '✅ 有收集记录' : '⚠️  暂无收集',
  });

  // 检查3: 分配率是否健康
  let distributionStatus;
  if (collected === 0n) {
    distributionStatus = 'ℹ️  暂无数据';
  } else if (distributionRate >= 90) {
    distributionStatus = '✅ 健康 (>90%)';
  } else if (distributionRate >= 70) {
    distributionStatus = '⚠️  正常 (70-90%)';
  } else {
    distributionStatus = '🔴 异常 (<70%)';
  }
  checks.push({
    项目: '分配率',
    状态: distributionStatus,
  });

  // 检查4: 池账户余额
  checks.push({
    项目: '池账户余额',
    状态: totalBalance > 0n ? '✅ 有余额' : 'ℹ️  余额为 0',
  });

  console.log('\n');
  console.table(checks);

  // ====================================
  // 总结
  // ====================================
  console.log('━'.repeat(80));
  console.log('✨ 测试完成');
  console.log('━'.repeat(80));
  console.log('\n📱 访问 Dashboard:');
  console.log('   http://localhost:5173/#/storage-treasury\n');

  await api.disconnect();
  process.exit(0);
}

// ============ 执行 ============

main().catch((error) => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});

