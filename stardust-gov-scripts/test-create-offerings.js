#!/usr/bin/env node

/**
 * 创建供奉品测试脚本（小规模验证）
 * 功能：创建5个供奉品用于快速测试
 */

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

// 配置项
const DEFAULT_WS_ENDPOINT = process.env.MEMOPARK_WS || 'ws://127.0.0.1:9944';

// 管理员账户配置
const ADMIN_CONFIG = {
  mnemonic: 'gown lounge wolf cake hard sport napkin lock buddy interest session inside',
  expectedAddress: '5C7RjMrgfCJYyscR5Du1BLP99vFGgRDXjAt3ronftJZe39Qo',
};

// 测试配置（小规模）
const TEST_CONFIG = {
  offeringCount: 5,               // 只创建5个供奉品
  startKindCode: 1,
  delayBetweenCreations: 300,     // 300ms延迟
};

// 简化的供奉品名称（测试用）
const TEST_NAMES = [
  '测试供奉品-鲜花',
  '测试供奉品-香烛',
  '测试供奉品-水果',
  '测试供奉品-糕点',
  '测试供奉品-清茶',
];

// 测试用CID
const TEST_CID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';

/**
 * 函数级详细中文注释：格式化余额显示
 */
function formatBalance(raw, decimals, symbol) {
  const value = BigInt(raw.toString());
  const base = 10n ** BigInt(decimals);
  const integer = value / base;
  const fraction = value % base;
  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  if (fractionStr.length === 0) {
    return `${integer.toString()} ${symbol}`;
  }
  return `${integer.toString()}.${fractionStr.slice(0, 6)} ${symbol}`;
}

/**
 * 函数级详细中文注释：生成测试供奉品参数
 */
function generateTestOffering(index) {
  const kindCode = TEST_CONFIG.startKindCode + index;
  const name = TEST_NAMES[index];
  
  // 简单交替：偶数Instant，奇数Timed
  const isInstant = index % 2 === 0;
  const kindFlag = isInstant ? 0 : 1;
  
  let minDuration = null;
  let maxDuration = null;
  let canRenew = null;
  let expireAction = null;
  
  if (!isInstant) {
    minDuration = 1;
    maxDuration = 4;
    canRenew = true;
    expireAction = 0;
  }
  
  return {
    kindCode,
    name,
    mediaSchemaCid: TEST_CID,
    kindFlag,
    minDuration,
    maxDuration,
    canRenew,
    expireAction,
    type: isInstant ? 'Instant' : 'Timed',
  };
}

/**
 * 函数级详细中文注释：创建供奉品
 */
async function createOffering(api, signer, params, index, total, decimals, symbol) {
  console.log(`\n[${index}/${total}] 创建供奉品 #${params.kindCode}`);
  console.log(`   名称: ${params.name}`);
  console.log(`   类型: ${params.type}`);
  
  if (params.type === 'Timed') {
    console.log(`   时长范围: ${params.minDuration}-${params.maxDuration} 周`);
  }
  
  try {
    const tx = api.tx.memoOfferings.createOffering(
      params.kindCode,
      params.name,
      params.mediaSchemaCid,
      params.kindFlag,
      params.minDuration,
      params.maxDuration,
      params.canRenew,
      params.expireAction
    );
    
    const { partialFee } = await tx.paymentInfo(signer);
    console.log(`   预估手续费: ${formatBalance(partialFee, decimals, symbol)}`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('交易超时（30秒）'));
      }, 30000);
      
      tx.signAndSend(signer, result => {
        const { status, dispatchError } = result;
        
        if (status.isInBlock) {
          console.log(`   ✅ 包含区块: ${status.asInBlock.toHex().slice(0, 10)}...`);
        }
        
        if (dispatchError) {
          clearTimeout(timeout);
          if (dispatchError.isModule) {
            const meta = api.registry.findMetaError(dispatchError.asModule);
            const errorMessage = `${meta.section}.${meta.name}: ${meta.docs.join(' ')}`;
            console.error(`   ❌ 创建失败: ${errorMessage}`);
            reject(new Error(errorMessage));
          } else {
            console.error('   ❌ 创建失败:', dispatchError.toString());
            reject(new Error(dispatchError.toString()));
          }
          return;
        }
        
        if (status.isFinalized) {
          clearTimeout(timeout);
          console.log(`   🎉 最终确认`);
          resolve({ 
            success: true, 
            blockHash: status.asFinalized.toHex(),
            fee: partialFee.toString()
          });
        }
      }).catch(err => {
        clearTimeout(timeout);
        console.error('   ❌ 发送失败:', err.message);
        reject(err);
      });
    });
  } catch (error) {
    console.error(`   ❌ 创建失败: ${error.message}`);
    throw error;
  }
}

/**
 * 函数级详细中文注释：主函数
 */
async function main() {
  console.log('🧪 创建供奉品测试脚本\n');
  console.log('='.repeat(60));
  console.log('测试配置:');
  console.log(`   供奉品数量: ${TEST_CONFIG.offeringCount}`);
  console.log(`   起始编码: ${TEST_CONFIG.startKindCode}`);
  console.log(`   管理员地址: ${ADMIN_CONFIG.expectedAddress}`);
  console.log('='.repeat(60));
  
  try {
    await cryptoWaitReady();
    console.log('\n✅ 加密库准备完成');

    const keyring = new Keyring({ type: 'sr25519' });
    const adminPair = keyring.addFromMnemonic(ADMIN_CONFIG.mnemonic);
    
    if (adminPair.address !== ADMIN_CONFIG.expectedAddress) {
      console.error('❌ 地址验证失败');
      process.exit(1);
    }
    console.log('✅ 管理员账户地址验证通过');

    console.log(`\n🔌 正在连接节点: ${DEFAULT_WS_ENDPOINT}`);
    const api = await ApiPromise.create({ 
      provider: new WsProvider(DEFAULT_WS_ENDPOINT) 
    });

    const [chain, nodeName, nodeVersion] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.system.name(),
      api.rpc.system.version(),
    ]);
    
    const decimals = api.registry.chainDecimals?.[0] ?? 12;
    const symbol = api.registry.chainTokens?.[0] ?? 'MEMO';
    
    console.log(`✅ 已连接 ${chain.toHuman()} • ${nodeName.toHuman()} v${nodeVersion.toHuman()}`);

    console.log('\n💰 检查账户余额...');
    const { data: balanceData } = await api.query.system.account(adminPair.address);
    const freeBalance = balanceData.free;
    console.log(`   可用余额: ${formatBalance(freeBalance, decimals, symbol)}`);

    console.log('\n📋 生成测试供奉品列表...');
    const offerings = [];
    for (let i = 0; i < TEST_CONFIG.offeringCount; i++) {
      const offering = generateTestOffering(i);
      offerings.push(offering);
      console.log(`   ${i + 1}. ${offering.name} (${offering.type})`);
    }
    
    console.log('\n⚠️  准备开始创建，等待 2 秒...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n🎯 开始创建供奉品...');
    console.log('='.repeat(60));
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < offerings.length; i++) {
      const offering = offerings[i];
      
      try {
        const result = await createOffering(
          api, 
          adminPair, 
          offering, 
          i + 1, 
          offerings.length,
          decimals,
          symbol
        );
        
        results.push({ ...offering, ...result });
        successCount++;
        
        if (i < offerings.length - 1) {
          await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delayBetweenCreations));
        }
        
      } catch (error) {
        results.push({ ...offering, success: false, error: error.message });
        failCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试完成');
    console.log('='.repeat(60));
    console.log(`✅ 成功: ${successCount} 个`);
    console.log(`❌ 失败: ${failCount} 个`);
    console.log(`📈 成功率: ${((successCount / offerings.length) * 100).toFixed(2)}%`);
    
    if (failCount > 0) {
      console.log(`\n❌ 失败的供奉品:`);
      results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.name}: ${r.error}`);
      });
    }
    
    console.log('\n💰 最终余额查询...');
    const { data: finalBalanceData } = await api.query.system.account(adminPair.address);
    const finalBalance = finalBalanceData.free;
    const spent = freeBalance.toBigInt() - finalBalance.toBigInt();
    
    console.log(`   初始余额: ${formatBalance(freeBalance, decimals, symbol)}`);
    console.log(`   最终余额: ${formatBalance(finalBalance, decimals, symbol)}`);
    console.log(`   实际花费: ${formatBalance(spent, decimals, symbol)}`);
    
    await api.disconnect();
    console.log('\n👋 测试完成');
    
    process.exit(failCount > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ 发生错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ 未捕获的错误:', error);
  process.exit(1);
});

