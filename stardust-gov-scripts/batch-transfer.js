#!/usr/bin/env node

/**
 * 批量创建账户并随机转账脚本
 * 功能：
 * 1. 创建100个新账户，记录助记词和地址
 * 2. 从指定账户向这100个地址随机转账 20,000,000-50,000,000 MEMO
 */

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady, mnemonicGenerate } = require('@polkadot/util-crypto');
const fs = require('fs');
const path = require('path');

// 配置项
const DEFAULT_WS_ENDPOINT = process.env.MEMOPARK_WS || 'ws://127.0.0.1:9944';

// 发送账户配置（改为使用开发链内置的 Alice Root 账户）
const SENDER_CONFIG = {
  suri: '//Alice',
  expectedAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
};

// 批量转账配置
const BATCH_CONFIG = {
  accountCount: 100,                      // 创建账户数量（已改为100）
  minAmount: 20_000_000n,                 // 最小转账金额（20,000,000 MEMO）
  maxAmount: 50_000_000n,                 // 最大转账金额（50,000,000 MEMO）
  accountsFile: 'generated-accounts-100.json', // 账户信息保存文件
  resultsFile: 'transfer-results-100.json',   // 转账结果保存文件
  batchSize: 25,                          // 每批处理数量（调整为25）
  delayBetweenBatches: 3000,              // 批次间延迟（毫秒）
  delayBetweenTxs: 500,                   // 交易间延迟（毫秒）
  maxRetries: 3,                          // 失败后最大重试次数
  retryDelay: 2000,                       // 重试延迟（毫秒）
};

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
 * 函数级详细中文注释：生成随机金额（在指定范围内）
 * 
 * @param {bigint} minAmount 最小金额
 * @param {bigint} maxAmount 最大金额
 * @param {number} decimals 代币精度
 * @returns {bigint} 随机金额（最小单位）
 */
function generateRandomAmount(minAmount, maxAmount, decimals) {
  const min = minAmount * (10n ** BigInt(decimals));
  const max = maxAmount * (10n ** BigInt(decimals));
  const range = max - min;
  
  // 安全的随机数生成（避免精度损失）
  // 将 range 分成高位和低位处理
  const rangeStr = range.toString();
  const randomValue = Math.random();
  
  // 使用字符串乘法避免精度问题
  const randomStr = (BigInt(Math.floor(parseFloat(rangeStr) * randomValue))).toString();
  const randomBigInt = min + BigInt(randomStr);
  
  return randomBigInt;
}

/**
 * 函数级详细中文注释：生成新账户
 * 
 * @param {number} count 账户数量
 * @returns {Array<{mnemonic: string, address: string, index: number}>} 账户列表
 */
async function generateAccounts(count) {
  console.log(`\n🔑 开始生成 ${count} 个账户...`);
  console.log('='.repeat(60));
  
  const keyring = new Keyring({ type: 'sr25519' });
  const accounts = [];
  
  for (let i = 0; i < count; i++) {
    // 生成助记词
    const mnemonic = mnemonicGenerate();
    
    // 从助记词创建密钥对
    const pair = keyring.addFromMnemonic(mnemonic);
    
    accounts.push({
      index: i + 1,
      mnemonic,
      address: pair.address,
    });
    
    // 每25个账户显示进度
    if ((i + 1) % 25 === 0 || i === count - 1) {
      console.log(`   ✅ 已生成 ${i + 1}/${count} 个账户`);
    }
  }
  
  console.log(`✅ 账户生成完成！共 ${accounts.length} 个`);
  return accounts;
}

/**
 * 函数级详细中文注释：保存账户信息到文件
 * 
 * @param {Array} accounts 账户列表
 * @param {string} filename 文件名
 */
function saveAccountsToFile(accounts, filename) {
  console.log(`\n💾 保存账户信息到文件: ${filename}`);
  
  const data = {
    timestamp: new Date().toISOString(),
    count: accounts.length,
    accounts: accounts.map(acc => ({
      index: acc.index,
      address: acc.address,
      mnemonic: acc.mnemonic,
    })),
  };
  
  const filePath = path.join(__dirname, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  
  console.log(`✅ 账户信息已保存`);
  console.log(`   文件路径: ${filePath}`);
  console.log(`   账户数量: ${accounts.length}`);
}

/**
 * 函数级详细中文注释：加载已保存的账户信息
 * 
 * @param {string} filename 文件名
 * @returns {Array|null} 账户列表或null
 */
function loadAccountsFromFile(filename) {
  const filePath = path.join(__dirname, filename);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  console.log(`\n📂 从文件加载账户信息: ${filename}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    console.log(`✅ 账户信息已加载`);
    console.log(`   创建时间: ${data.timestamp}`);
    console.log(`   账户数量: ${data.count}`);
    
    return data.accounts;
  } catch (error) {
    console.error(`❌ 加载账户信息失败: ${error.message}`);
    return null;
  }
}

/**
 * 函数级详细中文注释：提交转账交易
 */
async function submitTransfer(api, tx, signer, recipient, amount, decimals, symbol, index, total) {
  console.log(`\n⚙️  [${index}/${total}] 转账: ${recipient.slice(0, 10)}...${recipient.slice(-8)}`);
  console.log(`   金额: ${formatBalance(amount, decimals, symbol)}`);
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('交易超时（60秒）'));
    }, 60000);

    tx.signAndSend(signer, async result => {
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
          console.error(`   ❌ 转账失败: ${errorMessage}`);
          reject(new Error(errorMessage));
        } else {
          console.error('   ❌ 转账失败:', dispatchError.toString());
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isFinalized) {
        clearTimeout(timeout);
        console.log(`   🎉 最终确认: ${status.asFinalized.toHex().slice(0, 10)}...`);
        
        // 查找转账事件
        const transferEvent = events.find(({ event }) => 
          event.section === 'balances' && event.method === 'Transfer'
        );
        
        if (transferEvent) {
          console.log('   ✅ 转账成功！');
        }
        
        resolve({ events, blockHash: status.asFinalized.toHex() });
      }
    }).catch(err => {
      clearTimeout(timeout);
      console.error('   ❌ 发送失败:', err.message);
      reject(err);
    });
  });
}

/**
 * 函数级详细中文注释：带重试机制的转账（增强版）
 */
async function transferWithRetry(api, signer, recipient, amount, decimals, symbol, index, total, maxRetries = BATCH_CONFIG.maxRetries) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`   🔄 重试 ${attempt - 1}/${maxRetries - 1}...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_CONFIG.retryDelay));
      }
      
      const tx = api.tx.balances.transferKeepAlive(recipient, amount);
      const result = await submitTransfer(
        api, tx, signer, recipient, amount, 
        decimals, symbol, index, total
      );
      
      return { success: true, result };
      
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        console.error(`   ⚠️  尝试 ${attempt} 失败，准备重试: ${error.message}`);
      }
    }
  }
  
  // 所有重试都失败
  console.error(`   ❌ 经过 ${maxRetries} 次尝试后仍然失败`);
  return { success: false, error: lastError };
}

/**
 * 函数级详细中文注释：显示当前进度统计
 */
function showProgress(successCount, failCount, totalCount) {
  const processedCount = successCount + failCount;
  const successRate = ((successCount / processedCount) * 100).toFixed(2);
  
  console.log('\n📊 当前进度统计:');
  console.log(`   已处理: ${processedCount}/${totalCount} (${((processedCount / totalCount) * 100).toFixed(2)}%)`);
  console.log(`   ✅ 成功: ${successCount} 笔`);
  console.log(`   ❌ 失败: ${failCount} 笔`);
  console.log(`   📈 成功率: ${successRate}%`);
}

/**
 * 函数级详细中文注释：保存转账结果到文件
 */
function saveResults(results, filename) {
  console.log(`\n💾 保存转账结果到文件: ${filename}`);
  
  const data = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    },
    results,
  };
  
  const filePath = path.join(__dirname, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  
  console.log(`✅ 转账结果已保存`);
  console.log(`   文件路径: ${filePath}`);
}

/**
 * 函数级详细中文注释：主函数
 */
async function main() {
  console.log('🚀 批量创建账户并随机转账脚本启动\n');
  console.log('='.repeat(60));
  console.log('配置信息:');
  console.log(`   账户数量: ${BATCH_CONFIG.accountCount}`);
  console.log(`   转账范围: ${BATCH_CONFIG.minAmount.toString()}-${BATCH_CONFIG.maxAmount.toString()} MEMO`);
  console.log(`   批次大小: ${BATCH_CONFIG.batchSize}`);
  console.log(`   发送地址: ${SENDER_CONFIG.expectedAddress}`);
  console.log('='.repeat(60));
  
  try {
    // 1. 等待加密库准备就绪
    await cryptoWaitReady();
    console.log('\n✅ 加密库准备完成');

    // 2. 创建发送账户密钥对（使用 Alice Root）
    const keyring = new Keyring({ type: 'sr25519' });
    const senderPair = keyring.addFromUri(SENDER_CONFIG.suri);
    
    // 3. 验证地址
    if (senderPair.address !== SENDER_CONFIG.expectedAddress) {
      console.error('❌ 地址验证失败');
      console.error(`   期望: ${SENDER_CONFIG.expectedAddress}`);
      console.error(`   实际: ${senderPair.address}`);
      process.exit(1);
    }
    console.log('✅ 发送账户地址验证通过');
    console.log(`   地址: ${senderPair.address}`);

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

    // 6. 检查发送账户余额
    console.log('\n💰 检查账户余额...');
    const { data: balanceData } = await api.query.system.account(senderPair.address);
    const freeBalance = balanceData.free;
    console.log(`   可用余额: ${formatBalance(freeBalance, decimals, symbol)}`);
    
    // 7. 生成或加载账户
    let accounts = loadAccountsFromFile(BATCH_CONFIG.accountsFile);
    
    if (!accounts || accounts.length !== BATCH_CONFIG.accountCount) {
      accounts = await generateAccounts(BATCH_CONFIG.accountCount);
      saveAccountsToFile(accounts, BATCH_CONFIG.accountsFile);
    } else {
      console.log(`\n✅ 使用已保存的 ${accounts.length} 个账户`);
    }
    
    // 8. 生成转账列表
    console.log('\n📋 生成转账列表...');
    console.log('='.repeat(60));
    
    const transfers = [];
    let totalAmount = 0n;
    
    accounts.forEach((account, index) => {
      const amount = generateRandomAmount(
        BATCH_CONFIG.minAmount, 
        BATCH_CONFIG.maxAmount, 
        decimals
      );
      totalAmount += amount;
      
      transfers.push({ 
        index: index + 1,
        recipient: account.address, 
        amount 
      });
    });
    
    console.log(`总转账金额: ${formatBalance(totalAmount, decimals, symbol)}`);
    console.log(`总笔数: ${transfers.length}`);
    console.log(`平均金额: ${formatBalance(totalAmount / BigInt(transfers.length), decimals, symbol)}`);
    
    // 9. 预估手续费（跳过，直接估算固定值）
    // 注意：由于链端 TransactionPaymentApi 有问题，跳过 paymentInfo 调用
    console.log('⚠️  跳过手续费预估（使用固定值估算）');
    
    // 使用固定手续费估算：每笔 0.01 DUST
    const estimatedSingleFee = 10_000_000_000n; // 0.01 DUST (精度12)
    const estimatedFees = estimatedSingleFee * BigInt(transfers.length);
    console.log(`预估总手续费: ${formatBalance(estimatedFees, decimals, symbol)} (按 0.01 ${symbol}/笔 估算)`);
    console.log(`单笔手续费: ${formatBalance(estimatedSingleFee, decimals, symbol)} (估算值)`);
    
    const totalRequired = totalAmount + estimatedFees;
    console.log(`需要总额: ${formatBalance(totalRequired, decimals, symbol)}`);
    
    // 10. 余额检查
    if (freeBalance.toBigInt() < totalRequired) {
      console.error('\n❌ 余额不足！');
      console.error(`   可用: ${formatBalance(freeBalance, decimals, symbol)}`);
      console.error(`   需要: ${formatBalance(totalRequired, decimals, symbol)}`);
      console.error(`   差额: ${formatBalance(totalRequired - freeBalance.toBigInt(), decimals, symbol)}`);
      await api.disconnect();
      process.exit(1);
    }
    
    console.log('✅ 余额充足');
    
    // 11. 确认提示
    console.log('\n⚠️  准备开始批量转账');
    console.log('   按 Ctrl+C 取消，或等待 5 秒自动开始...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 12. 开始批量转账
    console.log('\n🎯 开始批量转账...');
    console.log('='.repeat(60));
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    // 分批处理
    const batches = [];
    for (let i = 0; i < transfers.length; i += BATCH_CONFIG.batchSize) {
      batches.push(transfers.slice(i, i + BATCH_CONFIG.batchSize));
    }
    
    console.log(`   分为 ${batches.length} 个批次，每批 ${BATCH_CONFIG.batchSize} 笔`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n📦 处理批次 ${batchIndex + 1}/${batches.length} (${batch.length} 笔)`);
      console.log('-'.repeat(60));
      
      for (let i = 0; i < batch.length; i++) {
        const { recipient, amount, index } = batch[i];
        const globalIndex = batchIndex * BATCH_CONFIG.batchSize + i + 1;
        
        // 使用带重试机制的转账函数
        const transferResult = await transferWithRetry(
          api, senderPair, recipient, amount, 
          decimals, symbol, globalIndex, transfers.length
        );
        
        if (transferResult.success) {
          results.push({
            index,
            recipient,
            amount: amount.toString(),
            amountFormatted: formatBalance(amount, decimals, symbol),
            success: true,
            blockHash: transferResult.result.blockHash,
            timestamp: new Date().toISOString(),
          });
          
          successCount++;
        } else {
          console.error(`   ❌ 转账失败: ${transferResult.error.message}`);
          
          results.push({
            index,
            recipient,
            amount: amount.toString(),
            amountFormatted: formatBalance(amount, decimals, symbol),
            success: false,
            error: transferResult.error.message,
            timestamp: new Date().toISOString(),
          });
          
          failCount++;
        }
        
        // 交易间延迟
        if (i < batch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, BATCH_CONFIG.delayBetweenTxs));
        }
      }
      
      // 每个批次后显示进度统计
      showProgress(successCount, failCount, transfers.length);
      
      // 每个批次后保存中间结果
      saveResults(results, BATCH_CONFIG.resultsFile);
      
      // 每个批次后检查余额（防止余额不足）
      if (batchIndex < batches.length - 1) {
        const { data: currentBalanceData } = await api.query.system.account(senderPair.address);
        const currentBalance = currentBalanceData.free.toBigInt();
        
        // 计算剩余批次需要的金额
        const remainingTransfers = transfers.slice((batchIndex + 1) * BATCH_CONFIG.batchSize);
        const remainingAmount = remainingTransfers.reduce((sum, t) => sum + t.amount, 0n);
        const estimatedRemainingFees = estimatedSingleFee * BigInt(remainingTransfers.length);
        const totalRemaining = remainingAmount + estimatedRemainingFees;
        
        if (currentBalance < totalRemaining) {
          console.error('\n⚠️  警告: 余额可能不足以完成剩余转账');
          console.error(`   当前余额: ${formatBalance(currentBalance, decimals, symbol)}`);
          console.error(`   预估需要: ${formatBalance(totalRemaining, decimals, symbol)}`);
          console.error('   是否继续？按 Ctrl+C 取消，或等待 10 秒继续...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
        console.log(`\n⏳ 等待 ${BATCH_CONFIG.delayBetweenBatches / 1000} 秒后处理下一批次...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_CONFIG.delayBetweenBatches));
      }
    }
    
    // 13. 显示最终结果
    console.log('\n' + '='.repeat(60));
    console.log('📊 批量转账完成');
    console.log('='.repeat(60));
    console.log(`✅ 成功: ${successCount} 笔`);
    console.log(`❌ 失败: ${failCount} 笔`);
    console.log(`📝 总计: ${transfers.length} 笔`);
    console.log(`📈 成功率: ${((successCount / transfers.length) * 100).toFixed(2)}%`);
    
    // 14. 显示最终余额
    console.log('\n💰 最终余额查询...');
    const { data: finalBalanceData } = await api.query.system.account(senderPair.address);
    const finalBalance = finalBalanceData.free;
    const spent = freeBalance.toBigInt() - finalBalance.toBigInt();
    
    console.log(`   初始余额: ${formatBalance(freeBalance, decimals, symbol)}`);
    console.log(`   最终余额: ${formatBalance(finalBalance, decimals, symbol)}`);
    console.log(`   实际花费: ${formatBalance(spent, decimals, symbol)}`);
    
    // 15. 保存最终结果
    saveResults(results, BATCH_CONFIG.resultsFile);
    
    // 16. 断开连接
    await api.disconnect();
    console.log('\n👋 脚本执行完成');
    console.log(`\n📁 生成的文件:`);
    console.log(`   账户信息: ${path.join(__dirname, BATCH_CONFIG.accountsFile)}`);
    console.log(`   转账结果: ${path.join(__dirname, BATCH_CONFIG.resultsFile)}`);
    
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
