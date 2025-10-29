#!/usr/bin/env node

/**
 * 做市商创建挂单交互式脚本
 * 功能：做市商账户交互式创建OTC挂单
 */

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');
const readline = require('readline');

readline.emitKeypressEvents(process.stdin);

// 配置项
const DEFAULT_WS_ENDPOINT = process.env.MEMOPARK_WS || 'ws://127.0.0.1:9944';

// 做市商账户配置
const MARKET_MAKER_ACCOUNTS = [
  {
    id: 'mm-1',
    label: '🏦 做市商 1',
    mnemonic: 'gown lounge wolf cake hard sport napkin lock buddy interest session inside',
    expectedAddress: '5C7RjMrgfCJYyscR5Du1BLP99vFGgRDXjAt3ronftJZe39Qo',
  },
  {
    id: 'mm-2',
    label: '🏦 做市商 2',
    mnemonic: 'gold brick snake six junk cart alpha asset spoon that ice stumble',
    expectedAddress: '5CRubhWmwNmJ3z2Ffqs3nf71XQGHBkfKSc1edNvuHZErqvdL',
  },
];

// 挂单参数定义
const LISTING_PARAMS = [
  {
    name: 'side',
    label: '交易方向',
    description: '0=买入(Buy), 1=卖出(Sell)',
    type: 'number',
    defaultValue: '1',
    validate: (value) => {
      const num = parseInt(value);
      return num === 0 || num === 1;
    },
    errorMsg: '请输入 0 (买入) 或 1 (卖出)',
  },
  {
    name: 'base',
    label: '基础资产ID',
    description: 'MEMO 资产 ID（通常为 0）',
    type: 'number',
    defaultValue: '0',
    validate: (value) => !isNaN(parseInt(value)) && parseInt(value) >= 0,
    errorMsg: '请输入有效的资产ID（非负整数）',
  },
  {
    name: 'quote',
    label: '计价资产ID',
    description: 'CNY 资产 ID（通常为 1）',
    type: 'number',
    defaultValue: '1',
    validate: (value) => !isNaN(parseInt(value)) && parseInt(value) >= 0,
    errorMsg: '请输入有效的资产ID（非负整数）',
  },
  {
    name: 'pricingSpreadBps',
    label: '价差（基点）',
    description: '价格波动范围，单位为基点(1基点=0.01%)，如100表示1%',
    type: 'number',
    defaultValue: '100',
    validate: (value) => !isNaN(parseInt(value)) && parseInt(value) >= 0,
    errorMsg: '请输入有效的基点值（非负整数）',
  },
  {
    name: 'minQty',
    label: '最小数量',
    description: '单笔交易最小数量（最小单位）',
    type: 'bigint',
    defaultValue: '1111000000000000',
    validate: (value) => {
      try {
        const num = BigInt(value);
        return num > 0n;
      } catch {
        return false;
      }
    },
    errorMsg: '请输入有效的数量（正整数）',
  },
  {
    name: 'maxQty',
    label: '最大数量',
    description: '单笔交易最大数量（最小单位）',
    type: 'bigint',
    defaultValue: '111111000000000000',
    validate: (value) => {
      try {
        const num = BigInt(value);
        return num > 0n;
      } catch {
        return false;
      }
    },
    errorMsg: '请输入有效的数量（正整数）',
  },
  {
    name: 'total',
    label: '总库存',
    description: '挂单总库存数量（最小单位）',
    type: 'bigint',
    defaultValue: '1111111000000000000',
    validate: (value) => {
      try {
        const num = BigInt(value);
        return num > 0n;
      } catch {
        return false;
      }
    },
    errorMsg: '请输入有效的数量（正整数）',
  },
  {
    name: 'partial',
    label: '允许部分成交',
    description: 'true=允许部分成交, false=必须全额成交',
    type: 'boolean',
    defaultValue: 'true',
    validate: (value) => value === 'true' || value === 'false',
    errorMsg: '请输入 true 或 false',
  },
  {
    name: 'expireAt',
    label: '过期时间',
    description: '挂单过期的区块高度（0表示不过期）',
    type: 'number',
    defaultValue: '22222',
    validate: (value) => !isNaN(parseInt(value)) && parseInt(value) >= 0,
    errorMsg: '请输入有效的区块高度（非负整数）',
  },
  {
    name: 'priceMin',
    label: '最低价格',
    description: '可接受的最低价格（最小单位）',
    type: 'bigint',
    defaultValue: '10000000000',
    validate: (value) => {
      try {
        const num = BigInt(value);
        return num > 0n;
      } catch {
        return false;
      }
    },
    errorMsg: '请输入有效的价格（正整数）',
  },
  {
    name: 'priceMax',
    label: '最高价格',
    description: '可接受的最高价格（最小单位）',
    type: 'bigint',
    defaultValue: '20000000000',
    validate: (value) => {
      try {
        const num = BigInt(value);
        return num > 0n;
      } catch {
        return false;
      }
    },
    errorMsg: '请输入有效的价格（正整数）',
  },
  {
    name: 'termsCommit',
    label: '条款承诺',
    description: '交易条款的哈希承诺（可选，留空则为 null）',
    type: 'optional',
    defaultValue: '',
    validate: () => true,
    errorMsg: '',
  },
];

/**
 * 确保在交互式终端中运行
 */
function ensureInteractiveTTY() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('❌ 需要在交互式终端中运行此脚本');
    process.exit(1);
  }
}

/**
 * 格式化余额显示
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
  return `${integer.toString()}.${fractionStr.slice(0, 4)} ${symbol}`;
}

/**
 * 上下键选择菜单
 */
async function promptSelect(title, options, { formatOption, emptyMessage, instructions } = {}) {
  ensureInteractiveTTY();

  if (!options || options.length === 0) {
    if (emptyMessage) {
      console.log(emptyMessage);
    }
    return null;
  }

  let index = 0;
  let linesPrinted = 0;

  const render = () => {
    if (linesPrinted > 0) {
      readline.moveCursor(process.stdout, 0, -linesPrinted);
      readline.clearScreenDown(process.stdout);
    }

    const headerLines = [title];
    if (instructions) {
      headerLines.push(`   ${instructions}`);
    }

    const optionLines = options.map((option, idx) => {
      const prefix = idx === index ? ' >' : '  ';
      const content = formatOption ? formatOption(option, idx) : option.label || String(option);
      return `${prefix} ${content}`;
    });

    const lines = headerLines.concat([''], optionLines);
    const output = lines.join('\n');
    process.stdout.write(output);
    linesPrinted = lines.length;
  };

  return new Promise(resolve => {
    const cleanup = () => {
      process.stdout.write('\u001b[?25h');
      process.stdin.setRawMode(false);
      process.stdin.removeListener('keypress', onKeypress);
      if (linesPrinted > 0) {
        readline.moveCursor(process.stdout, 0, -linesPrinted);
        readline.clearScreenDown(process.stdout);
      }
    };

    const onKeypress = (_, key) => {
      if (!key) return;
      if (key.name === 'up') {
        index = (index - 1 + options.length) % options.length;
        render();
      } else if (key.name === 'down') {
        index = (index + 1) % options.length;
        render();
      } else if (key.name === 'return') {
        cleanup();
        resolve(options[index]);
      } else if (key.name === 'escape') {
        cleanup();
        resolve(null);
      } else if (key.ctrl && key.name === 'c') {
        cleanup();
        console.log('\n👋 已取消');
        process.exit(0);
      }
    };

    process.stdout.write('\u001b[?25l');
    process.stdin.setRawMode(true);
    process.stdin.on('keypress', onKeypress);
    render();
  });
}

/**
 * 输入文本
 */
async function promptInput(message, defaultValue = '') {
  ensureInteractiveTTY();
  
  // 确保 stdin 处于非 raw 模式
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(false);
  }
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    const prompt = defaultValue ? `${message} [${defaultValue}]: ` : `${message}: `;
    rl.question(prompt, answer => {
      rl.close();
      // 短暂延迟以确保 readline 完全清理
      setTimeout(() => {
        resolve(answer.trim() || defaultValue);
      }, 50);
    });
  });
}

/**
 * 确认提示（使用 readline 实现，更稳定）
 */
async function promptConfirm(message = '按 Enter 确认，输入 n 取消') {
  ensureInteractiveTTY();
  
  // 确保 stdin 处于非 raw 模式
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(false);
  }
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    const prompt = `\n${message} [Y/n]: `;
    rl.question(prompt, answer => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      // 空输入或 'y' 表示确认，'n' 表示取消
      const confirmed = normalized === '' || normalized === 'y' || normalized === 'yes';
      setTimeout(() => {
        resolve(confirmed);
      }, 50);
    });
  });
}

/**
 * 选择做市商账户
 */
async function selectMarketMaker(keyring) {
  console.log('📍 选择做市商账户 (↑ ↓ 选择, Enter 确认, Esc 取消)');
  const choice = await promptSelect('请选择做市商账户', [...MARKET_MAKER_ACCOUNTS, { id: 'exit', label: '退出' }], {
    instructions: '↑ ↓ 切换，Enter 确认，Esc 取消',
    formatOption: opt => opt.label || String(opt),
  });

  if (!choice || choice.id === 'exit') {
    console.log('👋 已取消');
    process.exit(0);
  }

  const pair = keyring.addFromMnemonic(choice.mnemonic);
  const actual = pair.address;

  if (actual !== choice.expectedAddress) {
    console.error('❌ 地址验证失败');
    console.error(`   期望: ${choice.expectedAddress}`);
    console.error(`   实际: ${actual}`);
    process.exit(1);
  }

  console.log(`✅ 账户已加载: ${actual}`);
  return { ...choice, pair };
}

/**
 * 检查是否是做市商
 */
async function checkMarketMaker(api, address) {
  console.log('\n🔍 检查做市商身份...');
  
  try {
    // 首先检查 marketMaker 模块是否存在
    if (!api.query.marketMaker) {
      console.error('❌ 链上没有 marketMaker 模块！');
      console.error('   可用的模块列表:');
      const modules = Object.keys(api.query).slice(0, 10);
      modules.forEach(mod => console.error(`   • ${mod}`));
      if (Object.keys(api.query).length > 10) {
        console.error(`   ... 还有 ${Object.keys(api.query).length - 10} 个模块`);
      }
      console.error('\n   提示: 请检查链的运行时是否包含 marketMaker pallet');
      return null;
    }

    // 检查 activeMarketMakers 存储是否存在
    if (!api.query.marketMaker.activeMarketMakers) {
      console.error('❌ marketMaker 模块没有 activeMarketMakers 存储！');
      console.error('   可用的存储列表:');
      const storages = Object.keys(api.query.marketMaker);
      storages.forEach(storage => console.error(`   • ${storage}`));
      console.error('\n   提示: 存储名称可能不同，请检查链的元数据');
      return null;
    }

    // 使用 entries() 方法遍历所有活跃做市商
    console.log('   正在查询活跃做市商列表...');
    const entries = await api.query.marketMaker.activeMarketMakers.entries();
    console.log(`   找到 ${entries.length} 个活跃做市商记录`);

    if (entries.length === 0) {
      console.error('❌ 链上没有任何做市商记录！');
      console.error('   该账户不是做市商，请先申请成为做市商');
      return null;
    }

    let mmId = null;
    for (const [key, value] of entries) {
      if (value.isSome) {
        const info = value.unwrap();
        const owner = info.owner.toString();
        const id = key.args[0].toString();
        
        console.log(`   检查做市商 #${id}: ${owner}`);
        
        if (owner === address) {
          mmId = id;
          break;
        }
      }
    }

    if (mmId === null) {
      console.error('❌ 该账户不是做市商！');
      console.error(`   当前账户: ${address}`);
      console.error('   请先申请成为做市商');
      return null;
    }

    console.log(`✅ 做市商身份确认: mmId = ${mmId}`);
    return mmId;
  } catch (error) {
    console.error('❌ 查询做市商信息失败:', error.message);
    console.error('\n   详细错误信息:');
    console.error(`   ${error.stack}`);
    console.error('\n   可能的原因:');
    console.error('   1. 链上没有 marketMaker 模块');
    console.error('   2. 存储结构与预期不符');
    console.error('   3. 节点版本不兼容');
    console.error('   4. 链的运行时需要更新');
    return null;
  }
}

/**
 * 交互式输入挂单参数
 */
async function inputListingParams() {
  console.log('\n📝 开始输入挂单参数');
  console.log('='.repeat(60));
  
  const params = {};
  
  for (const param of LISTING_PARAMS) {
    console.log(`\n📌 ${param.label} (${param.name})`);
    console.log(`   说明: ${param.description}`);
    console.log(`   类型: ${param.type}`);
    
    let value;
    let valid = false;
    
    while (!valid) {
      value = await promptInput(`   请输入`, param.defaultValue);
      
      if (param.validate(value)) {
        valid = true;
      } else {
        console.log(`   ❌ ${param.errorMsg}`);
      }
    }
    
    // 转换值的类型
    if (param.type === 'number') {
      params[param.name] = parseInt(value);
    } else if (param.type === 'bigint') {
      params[param.name] = value; // 保持字符串，稍后在构建交易时转换
    } else if (param.type === 'boolean') {
      params[param.name] = value === 'true';
    } else if (param.type === 'optional') {
      params[param.name] = value === '' ? null : value;
    } else {
      params[param.name] = value;
    }
    
    console.log(`   ✅ 已设置: ${param.name} = ${value}`);
  }
  
  return params;
}

/**
 * 打印挂单参数
 */
function printListingParams(params, api) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 挂单参数汇总');
  console.log('='.repeat(60));
  
  LISTING_PARAMS.forEach(param => {
    const value = params[param.name];
    const displayValue = value === null ? 'null' : value.toString();
    console.log(`${param.label.padEnd(15)} : ${displayValue}`);
    console.log(`   类型: ${param.type}`);
    console.log(`   描述: ${param.description}`);
  });
  
  console.log('='.repeat(60));
}

/**
 * 提交交易
 */
async function submitTransaction(api, tx, signer, label) {
  console.log(`\n⚙️  提交交易: ${label}`);
  return new Promise((resolve, reject) => {
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
        if (dispatchError.isModule) {
          const meta = api.registry.findMetaError(dispatchError.asModule);
          const errorMessage = `${meta.section}.${meta.name}: ${meta.docs.join(' ')}`;
          console.error(`   ❌ 交易失败: ${errorMessage}`);
          reject(new Error(errorMessage));
        } else {
          console.error('   ❌ 交易失败:', dispatchError.toString());
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isFinalized) {
        console.log(`   🎉 最终确认: ${status.asFinalized.toHex().slice(0, 10)}...`);
        
        // 查找挂单创建事件
        const listingEvent = events.find(({ event }) => 
          event.section === 'otcListing' && event.method === 'ListingCreated'
        );
        
        if (listingEvent) {
          console.log('   ✅ 挂单创建成功！');
          const eventData = listingEvent.event.data;
          console.log(`   📌 挂单ID: ${eventData[0]}`);
        }
        
        resolve({ events, blockHash: status.asFinalized.toHex() });
      }
    }).catch(err => {
      console.error('   ❌ 发送失败:', err.message);
      reject(err);
    });
  });
}

/**
 * 主函数
 */
async function main() {
  ensureInteractiveTTY();
  console.log('🚀 做市商创建挂单脚本');
  console.log('='.repeat(60));

  try {
    // 1. 初始化密码学库
    await cryptoWaitReady();
    console.log('✅ 加密库准备完成');

    // 2. 选择做市商账户
    const keyring = new Keyring({ type: 'sr25519' });
    const selected = await selectMarketMaker(keyring);

    // 3. 连接节点
    console.log(`\n🔌 正在连接节点: ${DEFAULT_WS_ENDPOINT}`);
    const api = await ApiPromise.create({ provider: new WsProvider(DEFAULT_WS_ENDPOINT) });

    const chain = await api.rpc.system.chain();
    const nodeName = await api.rpc.system.name();
    const nodeVersion = await api.rpc.system.version();
    const decimals = api.registry.chainDecimals?.[0] ?? 12;
    const symbol = api.registry.chainTokens?.[0] ?? 'MEMO';

    console.log(`✅ 已连接 ${chain.toHuman()} • ${nodeName.toHuman()} v${nodeVersion.toHuman()}`);

    // 4. 检查余额
    console.log('\n💰 检查账户余额...');
    const { data: balanceData } = await api.query.system.account(selected.pair.address);
    console.log(`   可用余额: ${formatBalance(balanceData.free, decimals, symbol)}`);

    if (balanceData.free.toBigInt() === 0n) {
      console.error('❌ 账户余额为零，无法创建挂单');
      await api.disconnect();
      process.exit(1);
    }

    // 5. 检查做市商身份
    const mmId = await checkMarketMaker(api, selected.pair.address);
    if (mmId === null) {
      await api.disconnect();
      process.exit(1);
    }

    // 6. 交互式输入挂单参数
    const params = await inputListingParams();

    // 7. 打印参数汇总
    printListingParams(params, api);

    // 8. 确认创建
    const confirmed = await promptConfirm('确认创建挂单？');
    if (!confirmed) {
      console.log('↩️  已取消创建挂单');
      await api.disconnect();
      process.exit(0);
    }

    // 9. 构建交易
    console.log('\n🔨 构建交易...');
    const tx = api.tx.otcListing.createListing(
      params.side,
      params.base,
      params.quote,
      params.pricingSpreadBps,
      params.minQty,
      params.maxQty,
      params.total,
      params.partial,
      params.expireAt,
      params.priceMin,
      params.priceMax,
      params.termsCommit
    );

    console.log('✅ 交易已构建');
    console.log(`   方法: ${tx.method.section}.${tx.method.method}`);
    console.log(`   参数数量: ${tx.method.args.length}`);
    console.log(`   编码长度: ${tx.encodedLength}`);
    console.log(`   交易哈希: ${tx.hash.toHex()}`);

    // 10. 打印每个参数的详细信息
    console.log('\n📋 交易参数详细信息:');
    tx.method.args.forEach((arg, idx) => {
      const argMeta = tx.method.meta.args[idx];
      console.log(`   [${idx}] ${argMeta.name.toString()}: ${argMeta.type.toString()}`);
      console.log(`       值: ${arg.toString()}`);
    });

    // 11. 提交交易
    await submitTransaction(api, tx, selected.pair, '创建挂单');

    // 12. 完成
    console.log('\n' + '='.repeat(60));
    console.log('🎉 挂单创建完成！');
    console.log('='.repeat(60));

    await api.disconnect();
    process.exit(0);

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

