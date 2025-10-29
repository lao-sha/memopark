#!/usr/bin/env node

/**
 * 测试脚本：验证治理脚本对 DepositLocked 状态的检查功能
 * 
 * 使用方法:
 *   node test-status-check.js
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');

const DEFAULT_WS_ENDPOINT = process.env.MEMOPARK_WS || 'ws://127.0.0.1:9944';

function checkApplicationCompleteness(app) {
  const issues = [];
  
  if (!app.publicCid || app.publicCid.length === 0) {
    issues.push('缺少公开资料 CID');
  }
  
  if (!app.privateCid || app.privateCid.length === 0) {
    issues.push('缺少私密资料 CID');
  }
  
  if (!app.feeBps || app.feeBps === 0) {
    issues.push('未设置费率 (fee_bps)');
  }
  
  if (!app.minAmount || BigInt(app.minAmount) === 0n) {
    issues.push('未设置最小下单额 (min_amount)');
  }
  
  if (!app.epayGateway || app.epayGateway.length === 0) {
    issues.push('缺少 epay 网关地址');
  }
  
  if (!app.epayPort || app.epayPort === 0) {
    issues.push('未设置 epay 端口');
  }
  
  if (!app.epayPid || app.epayPid.length === 0) {
    issues.push('缺少 epay 商户ID (PID)');
  }
  
  if (!app.epayKey || app.epayKey.length === 0) {
    issues.push('缺少 epay 商户密钥');
  }
  
  if (!app.firstPurchasePool || BigInt(app.firstPurchasePool) === 0n) {
    issues.push('未设置首购资金池');
  }
  
  return issues;
}

async function main() {
  console.log('🔌 连接节点:', DEFAULT_WS_ENDPOINT);
  const api = await ApiPromise.create({ provider: new WsProvider(DEFAULT_WS_ENDPOINT) });
  
  const chain = await api.rpc.system.chain();
  console.log('✅ 已连接:', chain.toHuman());
  
  console.log('\n📊 查询所有做市商申请...\n');
  
  const entries = await api.query.marketMaker.applications.entries();
  
  if (entries.length === 0) {
    console.log('⚠️  暂无做市商申请');
    await api.disconnect();
    return;
  }
  
  entries.forEach(([key, value]) => {
    const mmId = key.args[0].toNumber();
    const data = value.toJSON();
    
    console.log('═══════════════════════════════════════');
    console.log(`做市商申请 #${mmId}`);
    console.log('───────────────────────────────────────');
    console.log(`状态: ${data.status}`);
    console.log(`申请人: ${data.owner}`);
    console.log(`押金: ${data.deposit}`);
    
    // 检查完整性
    const issues = checkApplicationCompleteness(data);
    const isComplete = issues.length === 0;
    
    console.log(`\n资料完整性: ${isComplete ? '✅ 完整' : '❌ 不完整'}`);
    
    if (!isComplete) {
      console.log('\n缺失项:');
      issues.forEach(issue => {
        console.log(`  ❌ ${issue}`);
      });
    }
    
    // 判断阶段
    let stage = 'unknown';
    let recommendation = '';
    
    if (data.status === 'DepositLocked') {
      if (isComplete) {
        stage = 'incomplete_ready';
        recommendation = '⚠️  状态异常：资料已完整但状态仍为 DepositLocked\n' +
                        '💡 建议申请人重新调用 update_info() 或 submit_info()';
      } else {
        stage = 'incomplete';
        recommendation = '❌ 无法发起提案：申请资料不完整\n' +
                        '💡 建议申请人补充缺失字段后调用 update_info() 或 submit_info()';
      }
    } else if (data.status === 'PendingReview') {
      stage = 'propose';
      recommendation = '✅ 可以发起审批提案';
    } else if (data.status === 'Active') {
      stage = 'idle';
      recommendation = '✅ 已批准，无需操作';
    } else if (data.status === 'Rejected') {
      stage = 'idle';
      recommendation = '❌ 已被拒绝';
    }
    
    console.log(`\n当前阶段: ${stage}`);
    console.log(`\n${recommendation}`);
    
    console.log('\n字段详情:');
    console.log(`  public_cid: ${data.publicCid?.length > 0 ? '✅ 已设置' : '❌ 未设置'}`);
    console.log(`  private_cid: ${data.privateCid?.length > 0 ? '✅ 已设置' : '❌ 未设置'}`);
    console.log(`  fee_bps: ${data.feeBps > 0 ? `✅ ${data.feeBps}` : '❌ 未设置'}`);
    console.log(`  min_amount: ${BigInt(data.minAmount || 0) > 0n ? `✅ ${data.minAmount}` : '❌ 未设置'}`);
    console.log(`  epay_gateway: ${data.epayGateway?.length > 0 ? '✅ 已设置' : '❌ 未设置'}`);
    console.log(`  epay_port: ${data.epayPort > 0 ? `✅ ${data.epayPort}` : '❌ 未设置'}`);
    console.log(`  epay_pid: ${data.epayPid?.length > 0 ? '✅ 已设置' : '❌ 未设置'}`);
    console.log(`  epay_key: ${data.epayKey?.length > 0 ? '✅ 已设置' : '❌ 未设置'}`);
    console.log(`  first_purchase_pool: ${BigInt(data.firstPurchasePool || 0) > 0n ? `✅ ${data.firstPurchasePool}` : '❌ 未设置'}`);
    console.log('═══════════════════════════════════════\n');
  });
  
  await api.disconnect();
  console.log('✅ 测试完成');
}

main().catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});

