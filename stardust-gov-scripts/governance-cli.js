#!/usr/bin/env node

// Interactive governance CLI for Memopark committees.

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');
const readline = require('readline');

readline.emitKeypressEvents(process.stdin);

const DEFAULT_WS_ENDPOINT = process.env.MEMOPARK_WS || 'ws://127.0.0.1:9944';

const MNEMONIC_CHOICES = [
  {
    id: 'member-1',
    label: '🗳️ 成员 5CrDBEVDgXUwctSuV8EvQEBo2m187PcxoY36V7H7PGErHUW4 ',
    mnemonic: 'satoshi sure behave certain impulse ski slight track century kitchen clutch story',
    expectedAddress: '5CrDBEVDgXUwctSuV8EvQEBo2m187PcxoY36V7H7PGErHUW4',
  },
  {
    id: 'member-2',
    label: '🗳️ 成员 5CSepuULuCiDSBjeRqr9ZburDSdTwTk5ro9BgV5u1SbHiQh9 ',
    mnemonic: 'scancel claw pretty almost under pepper volume cabbage warm brave name bullet',
    expectedAddress: '5CSepuULuCiDSBjeRqr9ZburDSdTwTk5ro9BgV5u1SbHiQh9',
  },
  {
    id: 'member-3',
    label: '🗳️ 成员 5CotZ9gD2mLLBQ6sqL2b8gRS1Vxo6HfmRcQ2iu3T825DFgSq ',
    mnemonic: 'report trend decline harbor hobby holiday hope recycle century end holiday display',
    expectedAddress: '5CotZ9gD2mLLBQ6sqL2b8gRS1Vxo6HfmRcQ2iu3T825DFgSq',
  },
];

const COMMITTEE_DEFINITIONS = [
  {
    key: 'council',
    label: '主委员会 (Council)',
    section: 'council',
  },
  {
    key: 'technicalCommittee',
    label: '技术委员会 (Technical Committee)',
    section: 'technicalCommittee',
  },
  {
    key: 'contentCommittee',
    label: '内容委员会 (Content Committee)',
    section: 'contentCommittee',
  },
];

const STAGE_LABEL = {
  propose: '发起提案',
  vote: '投票',
  execute: '执行提案',
  idle: '等待其他成员',
  incomplete: '⚠️ 资料不完整',
  incomplete_ready: '⚠️ 需要更新状态',
};

const DEFAULT_WEIGHT_BOUND = {
  refTime: 2_000_000_000n,
  proofSize: 128_000n,
};

function ensureInteractiveTTY() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('❌ 需要在交互式终端中运行此脚本');
    process.exit(1);
  }
}

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

function computeTwoThirdsThreshold(memberCount) {
  if (!memberCount) return 1;
  return Math.max(1, Math.ceil((memberCount * 2) / 3));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function promptConfirm(message = '按 Enter 确认，Esc 取消') {
  ensureInteractiveTTY();
  console.log(`\n${message}`);

  return new Promise(resolve => {
    const cleanup = () => {
      process.stdout.write('\u001b[?25h');
      process.stdin.setRawMode(false);
      process.stdin.removeListener('keypress', onKeypress);
    };

    const onKeypress = (_, key) => {
      if (!key) return;
      if (key.name === 'return') {
        cleanup();
        resolve(true);
      } else if (key.name === 'escape') {
        cleanup();
        resolve(false);
      } else if (key.ctrl && key.name === 'c') {
        cleanup();
        console.log('\n👋 已取消');
        process.exit(0);
      }
    };

    process.stdout.write('\u001b[?25l');
    process.stdin.setRawMode(true);
    process.stdin.on('keypress', onKeypress);
  });
}

async function submitExtrinsic(api, tx, signer, label) {
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
        console.log(`   ✅ 包含区块: ${status.asInBlock.toHex()}`);
      }

      if (dispatchError) {
        if (dispatchError.isModule) {
          const meta = api.registry.findMetaError(dispatchError.asModule);
          const errorMessage = `${meta.section}.${meta.name}: ${meta.docs.join(' ')}`;
          console.error(`   ❌ 调用失败: ${errorMessage}`);
          reject(new Error(errorMessage));
        } else {
          console.error('   ❌ 调用失败:', dispatchError.toString());
          reject(new Error(dispatchError.toString()));
        }
        return;
      }

      if (status.isFinalized) {
        console.log(`   🎉 最终确认: ${status.asFinalized.toHex()}`);
        resolve({ events });
      }
    }).catch(err => {
      console.error('   ❌ 发送失败:', err.message);
      reject(err);
    });
  });
}

async function selectAccount(keyring) {
  console.log('📍 选择要使用的委员会私钥 (↑ ↓ 选择, Enter 确认, Esc 取消)');
  const choice = await promptSelect('请选择登录账户', [...MNEMONIC_CHOICES, { id: 'exit', label: '返回并退出' }], {
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

async function loadCommitteeMembership(api, address) {
  const result = [];

  for (const def of COMMITTEE_DEFINITIONS) {
    const section = api.query[def.section];
    if (!section || typeof section.members !== 'function') {
      continue;
    }

    try {
      const membersCodec = await section.members();
      const raw = membersCodec.toJSON();
      const members = Array.isArray(raw) ? raw.map(m => m.toString()) : [];
      const isMember = members.includes(address);
      result.push({
        ...def,
        members,
        memberCount: members.length,
        isMember,
      });
    } catch (error) {
      console.error(`⚠️  无法读取 ${def.label} 成员列表:`, error.message);
    }
  }

  return result.filter(item => item.isMember);
}

function describeApplication(app) {
  return {
    owner: app.owner,
    status: app.status,
    deposit: app.deposit,
    reviewDeadline: app.reviewDeadline,
    firstPurchasePool: app.firstPurchasePool,
    epayGateway: app.epayGateway,
    epayPort: app.epayPort,
    epayPid: app.epayPid,
    publicCid: app.publicCid,
    privateCid: app.privateCid,
    feeBps: app.feeBps,
    minAmount: app.minAmount,
    epayKey: app.epayKey,
  };
}

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

async function loadCouncilGovernance(api, accountAddress, membershipInfo, decimals, symbol) {
  const entries = await api.query.marketMaker.applications.entries();
  const overview = [];
  const actionable = [];

  for (const [key, value] of entries) {
    const mmId = key.args[0].toNumber();
    const data = value.toJSON();
    const app = describeApplication(data);
    const innerCall = api.tx.marketMaker.approve(mmId);
    const proposalHash = innerCall.method.hash.toHex();
    const proposalOpt = await api.query.council.proposalOf(proposalHash);
    const votingOpt = await api.query.council.voting(proposalHash);

    let hasProposal = false;
    let voting = null;
    let hasVoted = false;
    let proposalIndex = null;
    let lengthBound = innerCall.encodedLength;

    if (proposalOpt.isSome) {
      hasProposal = true;
      const proposal = proposalOpt.unwrap();
      lengthBound = proposal.encodedLength;
    }

    if (votingOpt.isSome) {
      voting = votingOpt.unwrap().toJSON();
      proposalIndex = voting.index;
      hasVoted = voting.ayes.includes(accountAddress) || voting.nays.includes(accountAddress);
    }

    // 检查申请完整性
    const completenessIssues = checkApplicationCompleteness(data);
    const isComplete = completenessIssues.length === 0;

    const summary = {
      mmId,
      ...app,
      proposalHash,
      hasProposal,
      voting,
      hasVoted,
      proposalIndex,
      depositFormatted: formatBalance(data.deposit || '0', decimals, symbol),
      stage: 'idle',
      isComplete,
      completenessIssues,
    };

    let stage = 'propose';

    // 🔧 修复：增加对 DepositLocked 状态的详细检查
    if (app.status === 'DepositLocked') {
      if (isComplete) {
        // 资料已完整但状态还是 DepositLocked，可能是 update_info 后状态没自动转换
        // 这种情况下，提示需要再次调用 update_info 以触发状态转换
        stage = 'incomplete_ready';
      } else {
        // 资料不完整
        stage = 'incomplete';
      }
    } else if (app.status !== 'PendingReview') {
      stage = 'idle';
    } else if (!hasProposal) {
      stage = 'propose';
    } else if (voting && Array.isArray(voting.ayes) && voting.ayes.length >= voting.threshold) {
      stage = 'execute';
    } else if (hasVoted) {
      stage = 'idle';
    } else {
      stage = 'vote';
    }

    summary.stage = stage;
    overview.push(summary);

    const actionableStage =
      stage === 'propose' ||
      (stage === 'vote' && voting) ||
      (stage === 'execute' && voting) ||
      stage === 'incomplete' ||
      stage === 'incomplete_ready';

    if (actionableStage) {
      actionable.push({
        type: 'marketMaker',
        id: `marketMaker-${mmId}-${stage}`,
        stage,
        mmId,
        application: summary,
        proposalHash,
        proposalIndex,
        voting,
        hasVoted,
        lengthBound,
        threshold: computeTwoThirdsThreshold(membershipInfo.memberCount),
      });
    }
  }

  return { overview, tasks: actionable };
}

async function loadCollectiveGovernance(api, committeeKey, accountAddress) {
  const def = COMMITTEE_DEFINITIONS.find(item => item.key === committeeKey);
  if (!def) {
    return { proposals: [], tasks: [] };
  }

  const section = api.query[def.section];
  if (!section || typeof section.proposals !== 'function') {
    return { proposals: [], tasks: [] };
  }

  const hashes = await section.proposals();
  const proposals = [];
  const tasks = [];

  for (const hash of hashes) {
    const hex = hash.toHex();
    const proposalOpt = await section.proposalOf(hash);
    const votingOpt = await section.voting(hash);

    if (!proposalOpt.isSome || !votingOpt.isSome) {
      continue;
    }

    const proposal = proposalOpt.unwrap();
    const voting = votingOpt.unwrap().toJSON();
    const meta = api.registry.findMetaCall(proposal.callIndex);
    const hasVoted = voting.ayes.includes(accountAddress) || voting.nays.includes(accountAddress);

    let stage = 'vote';
    if (voting.ayes.length >= voting.threshold) {
      stage = 'execute';
    } else if (hasVoted) {
      stage = 'idle';
    }

    const info = {
      hash: hex,
      proposal,
      voting,
      meta,
      hasVoted,
      stage,
      lengthBound: proposal.encodedLength,
    };

    proposals.push(info);

    if (stage === 'vote' || stage === 'execute') {
      tasks.push({
        type: 'collective',
        id: `${committeeKey}-${hex}-${stage}`,
        stage,
        committeeKey,
        proposalHash: hex,
        proposalIndex: voting.index,
        voting,
        hasVoted,
        meta,
        proposal,
        lengthBound: proposal.encodedLength,
      });
    }
  }

  return { proposals, tasks };
}

function printCouncilOverview(overview) {
  console.log('\n📊 做市商申请总览');
  if (overview.length === 0) {
    console.log('   暂无申请记录');
    return;
  }

  overview.forEach(item => {
    const stageLabel = STAGE_LABEL[item.stage] || item.stage;
    console.log(` - #${item.mmId} 状态: ${item.status} | 阶段: ${stageLabel}`);
    console.log(`     拥有者: ${item.owner}`);
    console.log(`     押金: ${item.depositFormatted} | 提案: ${item.hasProposal ? '已存在' : '未创建'}`);
    
    // 🆕 显示资料完整性
    if (item.stage === 'incomplete' || item.stage === 'incomplete_ready') {
      console.log(`     ⚠️  资料完整性: ${item.isComplete ? '完整' : '不完整'}`);
      if (!item.isComplete && item.completenessIssues.length > 0) {
        console.log(`     缺失项: ${item.completenessIssues.join(', ')}`);
      }
    }
    
    if (item.voting) {
      console.log(`     投票: ${item.voting.ayes.length} 赞成 / ${item.voting.nays.length} 反对 (阈值 ${item.voting.threshold})`);
      console.log(`     已投票: ${item.hasVoted ? '是' : '否'}`);
    }
  });
}

function printCollectiveOverview(committeeLabel, proposals) {
  console.log(`\n📋 ${committeeLabel} 当前提案`);
  if (proposals.length === 0) {
    console.log('   暂无提案');
    return;
  }

  proposals.forEach(item => {
    const stageLabel = STAGE_LABEL[item.stage] || item.stage;
    console.log(` - 提案 ${item.hash} → ${item.meta.section}.${item.meta.method} (${stageLabel})`);
    console.log(`     投票: ${item.voting.ayes.length} 赞成 / ${item.voting.nays.length} 反对 (阈值 ${item.voting.threshold})`);
    console.log(`     已投票: ${item.hasVoted ? '是' : '否'}`);
  });
}

function formatTaskOption(task) {
  if (task.type === 'marketMaker') {
    const votingInfo = task.voting
      ? `投票 ${task.voting.ayes.length}/${task.voting.threshold}`
      : '暂无投票';
    return `${STAGE_LABEL[task.stage]} ｜ 做市商 #${task.mmId} ｜ ${votingInfo}`;
  }

  if (task.type === 'collective') {
    const meta = task.meta;
    const votingInfo = task.voting
      ? `投票 ${task.voting.ayes.length}/${task.voting.threshold}`
      : '暂无投票';
    return `${STAGE_LABEL[task.stage]} ｜ ${meta.section}.${meta.method} ｜ ${votingInfo}`;
  }

  return task.id;
}

function showMarketMakerDetails(task, decimals, symbol) {
  const app = task.application;
  console.log('\n==============================');
  console.log(`做市商申请 #${task.mmId}`);
  console.log('------------------------------');
  console.log(`状态          : ${app.status}`);
  console.log(`申请人        : ${app.owner}`);
  console.log(`押金          : ${app.depositFormatted}`);
  console.log(`提案哈希      : ${task.proposalHash}`);
  console.log(`提案阶段      : ${STAGE_LABEL[task.stage]}`);
  
  // 🆕 显示资料完整性详情
  if (task.stage === 'incomplete' || task.stage === 'incomplete_ready') {
    console.log('------------------------------');
    console.log(`资料完整性    : ${app.isComplete ? '✅ 完整' : '❌ 不完整'}`);
    if (!app.isComplete && app.completenessIssues && app.completenessIssues.length > 0) {
      console.log('缺失项:');
      app.completenessIssues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    }
    
    if (task.stage === 'incomplete_ready') {
      console.log('');
      console.log('💡 提示: 资料已完整，但状态仍为 DepositLocked');
      console.log('   建议申请人调用 update_info() 触发状态转换');
      console.log('   或者直接调用 submit_info() 重新提交');
    }
  }
  
  if (task.voting) {
    console.log(`投票计数      : 赞成 ${task.voting.ayes.length} / 阈值 ${task.voting.threshold}`);
    console.log(`是否已投票    : ${task.hasVoted ? '是' : '否'}`);
    console.log(`提案索引      : ${task.proposalIndex}`);
  }
  console.log('==============================');
}

function showCollectiveDetails(task) {
  const meta = task.meta;
  const voting = task.voting;
  console.log('\n==============================');
  console.log(`${meta.section}.${meta.method} 提案`);
  console.log('------------------------------');
  console.log(`提案哈希      : ${task.proposalHash}`);
  console.log(`提案阶段      : ${STAGE_LABEL[task.stage]}`);
  console.log(`投票计数      : 赞成 ${voting.ayes.length} / 反对 ${voting.nays.length} / 阈值 ${voting.threshold}`);
  console.log(`提案索引      : ${task.proposalIndex}`);
  console.log('参数列表      :');
  const argsHuman = task.proposal.toHuman();
  if (argsHuman && argsHuman.args) {
    Object.entries(argsHuman.args).forEach(([key, value]) => {
      console.log(`  - ${key}: ${JSON.stringify(value)}`);
    });
  } else {
    const argNames = meta.args.map(arg => arg.name.toString());
    task.proposal.args.forEach((arg, idx) => {
      console.log(`  - ${argNames[idx] || idx}: ${arg.toHuman()}`);
    });
  }
  console.log('==============================');
}

async function performTask(api, signer, task, committeeInfo) {
  if (task.type === 'marketMaker') {
    // 🆕 处理资料不完整的情况
    if (task.stage === 'incomplete') {
      console.log('\n❌ 无法发起提案：申请资料不完整');
      console.log('\n缺失项:');
      task.application.completenessIssues.forEach(issue => {
        console.log(`  ❌ ${issue}`);
      });
      console.log('\n💡 操作建议:');
      console.log('   1. 通知申请人补充完整资料');
      console.log('   2. 申请人需要调用 marketMaker.update_info() 或 submit_info()');
      console.log('   3. 必须提供以下所有字段:');
      console.log('      - public_cid (公开资料CID)');
      console.log('      - private_cid (私密资料CID)');
      console.log('      - fee_bps (费率)');
      console.log('      - min_amount (最小下单额)');
      console.log('      - epay_gateway (epay网关地址)');
      console.log('      - epay_port (epay端口)');
      console.log('      - epay_pid (epay商户ID)');
      console.log('      - epay_key (epay商户密钥)');
      console.log('      - first_purchase_pool (首购资金池)');
      console.log('\n   申请人账户: ' + task.application.owner);
      await promptConfirm('按 Enter 返回');
      return;
    }

    if (task.stage === 'incomplete_ready') {
      console.log('\n⚠️  状态异常：资料已完整但状态仍为 DepositLocked');
      console.log('\n💡 可能原因:');
      console.log('   - 申请人调用了 update_info()，但状态转换逻辑未触发');
      console.log('   - 或者某些字段在链上验证时未通过');
      console.log('\n💡 解决方案:');
      console.log('   1. 通知申请人重新调用 update_info() (传递任一字段触发状态检查)');
      console.log('   2. 或者调用 submit_info() 重新提交完整资料');
      console.log('   3. 成功后状态应自动转为 PendingReview，届时可发起提案');
      console.log('\n   申请人账户: ' + task.application.owner);
      await promptConfirm('按 Enter 返回');
      return;
    }

    if (task.stage === 'propose') {
      const innerCall = api.tx.marketMaker.approve(task.mmId);
      const threshold = task.threshold;
      const lengthBound = innerCall.encodedLength;
      console.log(`\n🎯 即将发起提案：审批做市商 #${task.mmId}`);
      console.log(`   阈值: ${threshold}`);
      const confirmed = await promptConfirm();
      if (!confirmed) {
        console.log('↩️  已取消发起提案');
        return;
      }
      const tx = api.tx.council.propose(threshold, innerCall, lengthBound);
      const { events } = await submitExtrinsic(api, tx, signer, 'Council 提案');
      const proposedEvent = events.find(({ event }) => event.section === 'council' && event.method === 'Proposed');
      if (proposedEvent) {
        const [, index, hash] = proposedEvent.event.data;
        console.log(`📌 新提案索引: ${index.toString()} 哈希: ${hash.toHex()}`);
      }
      return;
    }

    if (task.stage === 'vote') {
      const decision = await promptSelect('请选择投票意向', [
        { id: 'aye', label: '赞成 (Aye)' },
        { id: 'nay', label: '反对 (Nay)' },
        { id: 'cancel', label: '返回上一层' },
      ], {
        instructions: '↑ ↓ 切换，Enter 确认',
        formatOption: option => option.label,
      });

      if (!decision || decision.id === 'cancel') {
        console.log('↩️  已取消投票');
        return;
      }

      const approve = decision.id === 'aye';
      console.log(`\n🗳️  即将${approve ? '投赞成票' : '投反对票'} 给提案 ${task.proposalHash}`);
      const confirmed = await promptConfirm();
      if (!confirmed) {
        console.log('↩️  已取消投票');
        return;
      }

      const tx = api.tx.council.vote(task.proposalHash, task.proposalIndex, approve);
      await submitExtrinsic(api, tx, signer, `Council 投票 (${approve ? '赞成' : '反对'})`);
      return;
    }

    if (task.stage === 'execute') {
      console.log(`\n🚀 即将执行提案 ${task.proposalHash}`);
      const confirmed = await promptConfirm();
      if (!confirmed) {
        console.log('↩️  已取消执行');
        return;
      }

      const tx = api.tx.council.close(
        task.proposalHash,
        task.proposalIndex,
        DEFAULT_WEIGHT_BOUND,
        task.lengthBound
      );
      await submitExtrinsic(api, tx, signer, 'Council 执行提案');
      return;
    }
  }

  if (task.type === 'collective') {
    const def = COMMITTEE_DEFINITIONS.find(item => item.key === task.committeeKey);
    if (!def) {
      console.log('⚠️  未知的委员会类型');
      return;
    }

    if (task.stage === 'vote') {
      const decision = await promptSelect('请选择投票意向', [
        { id: 'aye', label: '赞成 (Aye)' },
        { id: 'nay', label: '反对 (Nay)' },
        { id: 'cancel', label: '返回上一层' },
      ], {
        instructions: '↑ ↓ 切换，Enter 确认',
        formatOption: option => option.label,
      });

      if (!decision || decision.id === 'cancel') {
        console.log('↩️  已取消投票');
        return;
      }

      const approve = decision.id === 'aye';
      console.log(`\n🗳️  即将${approve ? '投赞成票' : '投反对票'} 给提案 ${task.proposalHash}`);
      const confirmed = await promptConfirm();
      if (!confirmed) {
        console.log('↩️  已取消投票');
        return;
      }

      const tx = api.tx[def.section].vote(task.proposalHash, task.proposalIndex, approve);
      await submitExtrinsic(api, tx, signer, `${def.label} 投票 (${approve ? '赞成' : '反对'})`);
      return;
    }

    if (task.stage === 'execute') {
      console.log(`\n🚀 即将执行提案 ${task.proposalHash}`);
      const confirmed = await promptConfirm();
      if (!confirmed) {
        console.log('↩️  已取消执行');
        return;
      }

      const tx = api.tx[def.section].close(
        task.proposalHash,
        task.proposalIndex,
        DEFAULT_WEIGHT_BOUND,
        task.lengthBound
      );
      await submitExtrinsic(api, tx, signer, `${def.label} 执行提案`);
      return;
    }
  }

  console.log('⚠️  暂不支持的任务类型或阶段');
}

async function handleCommittee(api, signer, info, decimals, symbol) {
  if (info.key === 'council') {
    while (true) {
      const { overview, tasks } = await loadCouncilGovernance(api, signer.address, info, decimals, symbol);
      printCouncilOverview(overview);
      if (tasks.length === 0) {
        console.log('✅ 当前没有待处理的事项，按 Esc 或选择返回退出。');
      }

      const choices = tasks.map(task => ({ task }));
      choices.push({ id: 'back', label: '返回上一层' });

      const selection = await promptSelect('\n请选择要处理的项目', choices, {
        instructions: '↑ ↓ 切换，Enter 确认，Esc 返回',
        formatOption: (option, idx) => {
          if (option.id === 'back') return '返回上一层';
          return formatTaskOption(option.task);
        },
      });

      if (!selection || selection.id === 'back') {
        console.log('↩️  返回委员会选择');
        return;
      }

      const task = selection.task;
      showMarketMakerDetails(task, decimals, symbol);

      try {
        await performTask(api, signer, task, info);
      } catch (error) {
        console.error('❌ 操作失败:', error.message);
      }

      await sleep(400);
    }
  } else {
    while (true) {
      const { proposals, tasks } = await loadCollectiveGovernance(api, info.key, signer.address);
      printCollectiveOverview(info.label, proposals);
      if (tasks.length === 0) {
        console.log('✅ 当前没有待处理的事项，按 Esc 或选择返回退出。');
      }

      const choices = tasks.map(task => ({ task }));
      choices.push({ id: 'back', label: '返回上一层' });

      const selection = await promptSelect('\n请选择要处理的提案', choices, {
        instructions: '↑ ↓ 切换，Enter 确认，Esc 返回',
        formatOption: option => {
          if (option.id === 'back') return '返回上一层';
          return formatTaskOption(option.task);
        },
      });

      if (!selection || selection.id === 'back') {
        console.log('↩️  返回委员会选择');
        return;
      }

      const task = selection.task;
      showCollectiveDetails(task);

      try {
        await performTask(api, signer, task, info);
      } catch (error) {
        console.error('❌ 操作失败:', error.message);
      }

      await sleep(400);
    }
  }
}

async function main() {
  ensureInteractiveTTY();
  await cryptoWaitReady();

  const keyring = new Keyring({ type: 'sr25519' });
  const selected = await selectAccount(keyring);

  console.log(`\n🔌 正在连接节点: ${DEFAULT_WS_ENDPOINT}`);
  const api = await ApiPromise.create({ provider: new WsProvider(DEFAULT_WS_ENDPOINT) });

  const chain = await api.rpc.system.chain();
  const nodeName = await api.rpc.system.name();
  const nodeVersion = await api.rpc.system.version();
  const decimals = api.registry.chainDecimals?.[0] ?? 12;
  const symbol = api.registry.chainTokens?.[0] ?? 'MEMO';

  console.log(`✅ 已连接 ${chain.toHuman()} • ${nodeName.toHuman()} v${nodeVersion.toHuman()}`);

  const { data: balanceData } = await api.query.system.account(selected.pair.address);
  console.log(`💰 当前余额: ${formatBalance(balanceData.free, decimals, symbol)}`);

  const committees = await loadCommitteeMembership(api, selected.pair.address);
  if (committees.length === 0) {
    console.log('⚠️  当前账户不属于任何已知委员会');
    await api.disconnect();
    process.exit(0);
  }

  console.log('\n👥 可进入的委员会:');
  committees.forEach(info => {
    console.log(` - ${info.label} (成员数 ${info.memberCount})`);
  });

  while (true) {
    const menuOptions = committees.map(info => ({ info }));
    menuOptions.push({ id: 'exit', label: '退出脚本' });

    const selection = await promptSelect('\n选择要参与的委员会', menuOptions, {
      instructions: '↑ ↓ 切换，Enter 确认，Esc 退出',
      formatOption: option => {
        if (option.id === 'exit') return '退出脚本';
        return `${option.info.label} (成员数 ${option.info.memberCount})`;
      },
    });

    if (!selection || selection.id === 'exit') {
      console.log('👋 已退出脚本');
      break;
    }

    const info = selection.info;
    console.log(`\n==============================`);
    console.log(`进入 ${info.label}`);
    console.log('==============================');

    try {
      await handleCommittee(api, selected.pair, info, decimals, symbol);
    } catch (error) {
      console.error('❌ 委员会操作失败:', error.message);
    }
  }

  await api.disconnect();
  process.exit(0);
}

main().catch(error => {
  console.error('❌ 未处理的错误:', error);
  process.exit(1);
});
