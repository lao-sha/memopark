#!/usr/bin/env node

/**
 * 批量转账测试脚本（小规模）
 * 用途：快速验证功能，仅创建5个账户并转账
 */

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady, mnemonicGenerate } = require('@polkadot/util-crypto');

const DEFAULT_WS_ENDPOINT = process.env.MEMOPARK_WS || 'ws://127.0.0.1:9944';

const SENDER_CONFIG = {
  mnemonic: 'satoshi sure behave certain impulse ski slight track century kitchen clutch story',
  expectedAddress: '5CrDBEVDgXUwctSuV8EvQEBo2m187PcxoY36V7H7PGErHUW4',
};

const TEST_CONFIG = {
  accountCount: 5,           // 仅创建5个账户用于测试
  minAmount: 1n,             // 测试最小金额 1 MEMO
  maxAmount: 10n,            // 测试最大金额 10 MEMO
};

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

function generateRandomAmount(minAmount, maxAmount, decimals) {
  const min = minAmount * (10n ** BigInt(decimals));
  const max = maxAmount * (10n ** BigInt(decimals));
  const range = max - min;
  const randomValue = Math.random();
  const randomBigInt = min + BigInt(Math.floor(Number(range) * randomValue));
  return randomBigInt;
}

async function main() {
  console.log('🧪 批量转账测试脚本（小规模）\n');
  console.log('='.repeat(60));
  console.log('测试配置:');
  console.log(`   账户数量: ${TEST_CONFIG.accountCount}`);
  console.log(`   转账范围: ${TEST_CONFIG.minAmount.toString()}-${TEST_CONFIG.maxAmount.toString()} MEMO`);
  console.log('='.repeat(60));
  
  try {
    // 1. 准备工作
    await cryptoWaitReady();
    console.log('\n✅ 加密库准备完成');

    const keyring = new Keyring({ type: 'sr25519' });
    const senderPair = keyring.addFromMnemonic(SENDER_CONFIG.mnemonic);
    
    if (senderPair.address !== SENDER_CONFIG.expectedAddress) {
      console.error('❌ 地址验证失败');
      process.exit(1);
    }
    console.log('✅ 发送账户验证通过');

    // 2. 连接节点
    console.log(`\n🔌 连接节点: ${DEFAULT_WS_ENDPOINT}`);
    const api = await ApiPromise.create({ 
      provider: new WsProvider(DEFAULT_WS_ENDPOINT) 
    });

    const [chain] = await Promise.all([api.rpc.system.chain()]);
    const decimals = api.registry.chainDecimals?.[0] ?? 12;
    const symbol = api.registry.chainTokens?.[0] ?? 'MEMO';
    
    console.log(`✅ 已连接 ${chain.toHuman()}`);

    // 3. 检查余额
    const { data: balanceData } = await api.query.system.account(senderPair.address);
    const freeBalance = balanceData.free;
    console.log(`\n💰 发送账户余额: ${formatBalance(freeBalance, decimals, symbol)}`);
    
    // 4. 生成测试账户
    console.log(`\n🔑 生成 ${TEST_CONFIG.accountCount} 个测试账户...`);
    const accounts = [];
    
    for (let i = 0; i < TEST_CONFIG.accountCount; i++) {
      const mnemonic = mnemonicGenerate();
      const pair = keyring.addFromMnemonic(mnemonic);
      accounts.push({
        index: i + 1,
        mnemonic,
        address: pair.address,
      });
      console.log(`   ${i + 1}. ${pair.address}`);
      console.log(`      助记词: ${mnemonic.substring(0, 30)}...`);
    }
    
    console.log(`✅ 测试账户生成完成`);
    
    // 5. 生成转账列表
    console.log(`\n📋 生成转账列表...`);
    const transfers = [];
    let totalAmount = 0n;
    
    accounts.forEach((account, index) => {
      const amount = generateRandomAmount(
        TEST_CONFIG.minAmount, 
        TEST_CONFIG.maxAmount, 
        decimals
      );
      totalAmount += amount;
      
      transfers.push({ 
        index: index + 1,
        recipient: account.address, 
        amount 
      });
      
      console.log(`   ${index + 1}. ${formatBalance(amount, decimals, symbol)} → ${account.address.substring(0, 10)}...`);
    });
    
    console.log(`\n总金额: ${formatBalance(totalAmount, decimals, symbol)}`);
    
    // 6. 预估手续费
    const testTx = api.tx.balances.transferKeepAlive(accounts[0].address, transfers[0].amount);
    const { partialFee } = await testTx.paymentInfo(senderPair);
    const estimatedFees = partialFee.toBigInt() * BigInt(transfers.length);
    console.log(`预估手续费: ${formatBalance(estimatedFees, decimals, symbol)}`);
    
    const totalRequired = totalAmount + estimatedFees;
    console.log(`需要总额: ${formatBalance(totalRequired, decimals, symbol)}`);
    
    // 7. 余额检查
    if (freeBalance.toBigInt() < totalRequired) {
      console.error('\n❌ 余额不足！');
      console.error(`   可用: ${formatBalance(freeBalance, decimals, symbol)}`);
      console.error(`   需要: ${formatBalance(totalRequired, decimals, symbol)}`);
      await api.disconnect();
      process.exit(1);
    }
    
    console.log('✅ 余额充足');
    
    // 8. 开始转账
    console.log('\n🎯 开始转账...');
    console.log('='.repeat(60));
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < transfers.length; i++) {
      const { recipient, amount, index } = transfers[i];
      
      console.log(`\n[${i + 1}/${transfers.length}] 转账到 ${recipient.substring(0, 10)}...`);
      console.log(`   金额: ${formatBalance(amount, decimals, symbol)}`);
      
      try {
        const tx = api.tx.balances.transferKeepAlive(recipient, amount);
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('超时')), 30000);
          
          tx.signAndSend(senderPair, result => {
            if (result.status.isFinalized) {
              clearTimeout(timeout);
              console.log(`   ✅ 成功！区块: ${result.status.asFinalized.toHex().substring(0, 10)}...`);
              resolve();
            } else if (result.dispatchError) {
              clearTimeout(timeout);
              reject(new Error('转账失败'));
            }
          }).catch(err => {
            clearTimeout(timeout);
            reject(err);
          });
        });
        
        successCount++;
        
        // 短暂延迟
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`   ❌ 失败: ${error.message}`);
        failCount++;
      }
    }
    
    // 9. 显示结果
    console.log('\n' + '='.repeat(60));
    console.log('📊 测试完成');
    console.log('='.repeat(60));
    console.log(`✅ 成功: ${successCount} 笔`);
    console.log(`❌ 失败: ${failCount} 笔`);
    console.log(`📝 总计: ${transfers.length} 笔`);
    
    // 10. 查询接收账户余额
    console.log('\n💰 查询接收账户余额...');
    for (let i = 0; i < accounts.length; i++) {
      const { data } = await api.query.system.account(accounts[i].address);
      const balance = data.free;
      console.log(`   ${i + 1}. ${accounts[i].address.substring(0, 10)}... : ${formatBalance(balance, decimals, symbol)}`);
    }
    
    // 11. 最终余额
    const { data: finalBalanceData } = await api.query.system.account(senderPair.address);
    const finalBalance = finalBalanceData.free;
    const spent = freeBalance.toBigInt() - finalBalance.toBigInt();
    
    console.log(`\n💰 发送账户最终余额`);
    console.log(`   初始: ${formatBalance(freeBalance, decimals, symbol)}`);
    console.log(`   最终: ${formatBalance(finalBalance, decimals, symbol)}`);
    console.log(`   花费: ${formatBalance(spent, decimals, symbol)}`);
    
    await api.disconnect();
    console.log('\n👋 测试完成');
    
    if (failCount > 0) {
      console.log('\n⚠️  有失败的转账，请检查日志');
      process.exit(1);
    } else {
      console.log('\n✅ 所有转账成功！');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ 未捕获的错误:', error);
  process.exit(1);
});

