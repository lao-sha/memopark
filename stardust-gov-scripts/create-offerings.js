#!/usr/bin/env node

/**
 * 创建供奉品脚本
 * 功能：使用指定账户创建50个随机参数的供奉品
 */

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

// 配置项
const DEFAULT_WS_ENDPOINT = process.env.MEMOPARK_WS || 'ws://127.0.0.1:9944';

// 管理员账户配置
// 使用 Alice 账户（Sudo 权限）
const ADMIN_CONFIG = {
  uri: '//Alice',  // Substrate 标准开发账户
  expectedAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
};

// 创建配置
const CREATE_CONFIG = {
  offeringCount: 50,              // 创建供奉品数量
  startKindCode: 1,               // 起始编码
  delayBetweenCreations: 500,     // 创建间延迟（毫秒）
  defaultEnabled: true,           // 默认启用状态
};

// 供奉品名称库
const OFFERING_NAMES = [
  '鲜花祭祀', '香烛供奉', '水果贡品', '纸钱焚烧', '香炉上香',
  '清茶敬献', '美酒祭拜', '糕点供奉', '素食供品', '莲花供奉',
  '菊花祭祀', '百合献礼', '玫瑰敬献', '康乃馨祭祀', '郁金香供奉',
  '兰花敬献', '梅花祭祀', '桃花供奉', '荷花献礼', '牡丹祭拜',
  '檀香供奉', '沉香祭祀', '龙涎香献礼', '麝香敬献', '安息香供奉',
  '烛台祭祀', '油灯供奉', '长明灯献礼', '莲花灯祭祀', '天灯敬献',
  '素斋供奉', '斋饭祭祀', '糕点献礼', '茶水敬献', '清酒供奉',
  '纸扎祭品', '金元宝供奉', '银元宝祭祀', '冥币献礼', '纸房敬献',
  '经文诵读', '佛经供奉', '道经祭祀', '圣经献礼', '古兰经敬献',
  '音乐祭祀', '梵音供奉', '钟声献礼', '磬声敬献', '诵经祭拜',
];

// 媒体Schema CID库（示例IPFS CID）
const MEDIA_SCHEMA_CIDS = [
  'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
  'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB',
  'QmYCvbfNbCwFR45HiNP45rwJgvatpiW38D961L5qAhUM5Y',
  'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
  'QmZTR5bcpQD7cFgTorqxZDYaew1Wqgfbd2ud9QqGPAkK2V',
];

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
 * 函数级详细中文注释：生成随机供奉品参数
 * 
 * @param {number} kindCode 供奉品编码
 * @returns {object} 供奉品参数
 */
function generateRandomOffering(kindCode) {
  // 随机选择名称
  const name = OFFERING_NAMES[Math.floor(Math.random() * OFFERING_NAMES.length)];
  
  // 随机选择媒体Schema CID
  const mediaSchemaCid = MEDIA_SCHEMA_CIDS[Math.floor(Math.random() * MEDIA_SCHEMA_CIDS.length)];
  
  // 随机决定类型：0=Instant（70%概率）, 1=Timed（30%概率）
  const isInstant = Math.random() < 0.7;
  const kindFlag = isInstant ? 0 : 1;
  
  let minDuration = null;
  let maxDuration = null;
  let canRenew = false;
  let expireAction = 0;
  
  if (!isInstant) {
    // Timed类型的参数
    minDuration = Math.floor(Math.random() * 4) + 1; // 1-4周
    maxDuration = minDuration + Math.floor(Math.random() * 48) + 4; // 最少比min多4周，最多52周
    canRenew = Math.random() < 0.8; // 80%可续费
    expireAction = Math.floor(Math.random() * 3); // 0=NoAction, 1=AutoArchive, 2=AutoDelete
  }
  
  return {
    kindCode,
    name,
    mediaSchemaCid,
    kindFlag,
    minDuration,
    maxDuration,
    canRenew,
    expireAction,
    enabled: CREATE_CONFIG.defaultEnabled,
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
  console.log(`   Media CID: ${params.mediaSchemaCid}`);
  
  if (params.type === 'Timed') {
    console.log(`   时长范围: ${params.minDuration}-${params.maxDuration} 周`);
    console.log(`   可续费: ${params.canRenew ? '是' : '否'}`);
    console.log(`   过期动作: ${params.expireAction}`);
  }
  
  try {
    // 使用 sudo 权限调用
    const innerTx = api.tx.memorialOfferings.createOffering(
      params.kindCode,
      params.name,
      params.mediaSchemaCid,
      params.kindFlag,
      params.minDuration,
      params.maxDuration,
      params.canRenew,
      params.expireAction,
      params.enabled
    );
    
    const tx = api.tx.sudo.sudo(innerTx);
    
    // 预估手续费
    const { partialFee } = await tx.paymentInfo(signer);
    console.log(`   预估手续费: ${formatBalance(partialFee, decimals, symbol)}`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('交易超时（60秒）'));
      }, 60000);
      
      tx.signAndSend(signer, result => {
        const { status, dispatchError, events } = result;
        
        if (status.isReady) {
          console.log('   📦 状态: Ready');
        }
        
        if (status.isBroadcast) {
          console.log('   📡 已广播');
        }
        
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
          console.log(`   🎉 最终确认: ${status.asFinalized.toHex().slice(0, 10)}...`);
          
          // 查找创建事件
          const offeringEvent = events.find(({ event }) => 
            event.section === 'memorialOfferings' && event.method === 'OfferingCreated'
          );
          
          if (offeringEvent) {
            console.log('   ✅ 供奉品创建成功！');
          }
          
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
  console.log('🚀 创建供奉品脚本启动\n');
  console.log('='.repeat(60));
  console.log('配置信息:');
  console.log(`   供奉品数量: ${CREATE_CONFIG.offeringCount}`);
  console.log(`   起始编码: ${CREATE_CONFIG.startKindCode}`);
  console.log(`   管理员地址: ${ADMIN_CONFIG.expectedAddress}`);
  console.log('='.repeat(60));
  
  try {
    // 1. 等待加密库准备就绪
    await cryptoWaitReady();
    console.log('\n✅ 加密库准备完成');

    // 2. 创建管理员账户密钥对
    const keyring = new Keyring({ type: 'sr25519' });
    const adminPair = keyring.addFromUri(ADMIN_CONFIG.uri);
    
    // 3. 验证地址
    if (adminPair.address !== ADMIN_CONFIG.expectedAddress) {
      console.error('❌ 地址验证失败');
      console.error(`   期望: ${ADMIN_CONFIG.expectedAddress}`);
      console.error(`   实际: ${adminPair.address}`);
      process.exit(1);
    }
    console.log('✅ 管理员账户地址验证通过');
    console.log(`   地址: ${adminPair.address}`);

    // 4. 连接到链节点
    console.log(`\n🔌 正在连接节点: ${DEFAULT_WS_ENDPOINT}`);
    const api = await ApiPromise.create({ 
      provider: new WsProvider(DEFAULT_WS_ENDPOINT) 
    });

    // 5. 获取链信息
    const [chain, nodeName, nodeVersion] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.system.name(),
      api.rpc.system.version(),
    ]);
    
    const decimals = api.registry.chainDecimals?.[0] ?? 12;
    const symbol = api.registry.chainTokens?.[0] ?? 'MEMO';
    
    console.log(`✅ 已连接 ${chain.toHuman()} • ${nodeName.toHuman()} v${nodeVersion.toHuman()}`);
    console.log(`   代币: ${symbol} (精度: ${decimals})`);

    // 6. 检查管理员账户余额
    console.log('\n💰 检查账户余额...');
    const { data: balanceData } = await api.query.system.account(adminPair.address);
    const freeBalance = balanceData.free;
    console.log(`   可用余额: ${formatBalance(freeBalance, decimals, symbol)}`);

    // 7. 生成供奉品列表
    console.log('\n📋 生成供奉品列表...');
    console.log('='.repeat(60));
    
    const offerings = [];
    for (let i = 0; i < CREATE_CONFIG.offeringCount; i++) {
      const kindCode = CREATE_CONFIG.startKindCode + i;
      const offering = generateRandomOffering(kindCode);
      offerings.push(offering);
    }
    
    console.log(`✅ 生成 ${offerings.length} 个供奉品`);
    console.log(`   Instant类型: ${offerings.filter(o => o.type === 'Instant').length} 个`);
    console.log(`   Timed类型: ${offerings.filter(o => o.type === 'Timed').length} 个`);
    
    // 8. 预估总手续费
    const testInnerTx = api.tx.memorialOfferings.createOffering(
      offerings[0].kindCode,
      offerings[0].name,
      offerings[0].mediaSchemaCid,
      offerings[0].kindFlag,
      offerings[0].minDuration,
      offerings[0].maxDuration,
      offerings[0].canRenew,
      offerings[0].expireAction,
      offerings[0].enabled
    );
    
    const testTx = api.tx.sudo.sudo(testInnerTx);
    const { partialFee } = await testTx.paymentInfo(adminPair);
    const estimatedFees = partialFee.toBigInt() * BigInt(offerings.length);
    console.log(`\n预估总手续费: ${formatBalance(estimatedFees, decimals, symbol)}`);
    console.log(`单笔手续费: ${formatBalance(partialFee, decimals, symbol)}`);
    
    // 9. 余额检查
    if (freeBalance.toBigInt() < estimatedFees) {
      console.error('\n❌ 余额不足！');
      console.error(`   可用: ${formatBalance(freeBalance, decimals, symbol)}`);
      console.error(`   需要: ${formatBalance(estimatedFees, decimals, symbol)}`);
      await api.disconnect();
      process.exit(1);
    }
    
    console.log('✅ 余额充足');
    
    // 10. 确认提示
    console.log('\n⚠️  准备开始创建供奉品');
    console.log('   按 Ctrl+C 取消，或等待 3 秒自动开始...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 11. 开始批量创建
    console.log('\n🎯 开始创建供奉品...');
    console.log('='.repeat(60));
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    let totalFees = 0n;
    
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
        
        results.push({
          ...offering,
          success: true,
          blockHash: result.blockHash,
          fee: result.fee,
        });
        
        totalFees += BigInt(result.fee);
        successCount++;
        
        // 创建间延迟
        if (i < offerings.length - 1) {
          await new Promise(resolve => setTimeout(resolve, CREATE_CONFIG.delayBetweenCreations));
        }
        
      } catch (error) {
        console.error(`   ❌ 创建失败: ${error.message}`);
        
        results.push({
          ...offering,
          success: false,
          error: error.message,
        });
        
        failCount++;
      }
    }
    
    // 12. 显示最终结果
    console.log('\n' + '='.repeat(60));
    console.log('📊 创建完成');
    console.log('='.repeat(60));
    console.log(`✅ 成功: ${successCount} 个`);
    console.log(`❌ 失败: ${failCount} 个`);
    console.log(`📝 总计: ${offerings.length} 个`);
    console.log(`📈 成功率: ${((successCount / offerings.length) * 100).toFixed(2)}%`);
    
    // 13. 统计类型
    const successInstant = results.filter(r => r.success && r.type === 'Instant').length;
    const successTimed = results.filter(r => r.success && r.type === 'Timed').length;
    console.log(`\n📊 类型统计:`);
    console.log(`   Instant: ${successInstant} 个`);
    console.log(`   Timed: ${successTimed} 个`);
    
    // 14. 显示失败的供奉品
    if (failCount > 0) {
      console.log(`\n❌ 失败的供奉品:`);
      results.filter(r => !r.success).forEach(r => {
        console.log(`   - 编码 ${r.kindCode}: ${r.name} (${r.error})`);
      });
    }
    
    // 15. 显示最终余额
    console.log('\n💰 最终余额查询...');
    const { data: finalBalanceData } = await api.query.system.account(adminPair.address);
    const finalBalance = finalBalanceData.free;
    const spent = freeBalance.toBigInt() - finalBalance.toBigInt();
    
    console.log(`   初始余额: ${formatBalance(freeBalance, decimals, symbol)}`);
    console.log(`   最终余额: ${formatBalance(finalBalance, decimals, symbol)}`);
    console.log(`   实际花费: ${formatBalance(spent, decimals, symbol)}`);
    console.log(`   平均手续费: ${formatBalance(spent / BigInt(successCount || 1), decimals, symbol)}`);
    
    // 16. 保存结果到文件
    const fs = require('fs');
    const path = require('path');
    const resultFile = path.join(__dirname, 'create-offerings-result.json');
    
    fs.writeFileSync(resultFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: offerings.length,
        success: successCount,
        failed: failCount,
        successRate: ((successCount / offerings.length) * 100).toFixed(2) + '%',
        totalFees: totalFees.toString(),
        totalFeesFormatted: formatBalance(totalFees, decimals, symbol),
      },
      results,
    }, null, 2));
    
    console.log(`\n💾 结果已保存到: ${resultFile}`);
    
    // 17. 断开连接
    await api.disconnect();
    console.log('\n👋 脚本执行完成');
    
    process.exit(failCount > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ 发生错误:', error.message);
    console.error('\n堆栈跟踪:');
    console.error(error.stack);
    process.exit(1);
  }
}

// 执行主函数
main().catch(error => {
  console.error('❌ 未捕获的错误:', error);
  process.exit(1);
});

