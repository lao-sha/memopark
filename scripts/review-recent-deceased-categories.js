#!/usr/bin/env node

/**
 * 函数级详细中文注释：逝者分类交互式审核脚本
 *
 * 功能：
 * - Root账户查询最近10天创建的逝者
 * - 人工审核每个逝者的信息
 * - 交互式选择并更新分类
 * - 记录审核日志
 *
 * 使用方法：
 * node scripts/review-recent-deceased-categories.js [days]
 *
 * 示例：
 * node scripts/review-recent-deceased-categories.js        # 默认最近10天
 * node scripts/review-recent-deceased-categories.js 7      # 最近7天
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// 创建readline接口用于交互式输入
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 分类映射（完整枚举）
const CATEGORY_MAP = {
  0: { name: 'Ordinary', label: '普通民众', description: '默认分类，普通逝者' },
  1: { name: 'HistoricalFigure', label: '历史人物', description: '对历史有重大影响的人物' },
  2: { name: 'Martyr', label: '革命烈士', description: '为革命事业牺牲的英雄' },
  3: { name: 'Hero', label: '英雄模范', description: '各行业的杰出代表和模范人物' },
  4: { name: 'PublicFigure', label: '公众人物', description: '社会知名人士、明星、学者等' },
  5: { name: 'ReligiousFigure', label: '宗教人物', description: '宗教领袖或重要宗教人物' },
  6: { name: 'EventHall', label: '事件馆', description: '重大历史事件纪念' }
};

// 性别映射
const GENDER_MAP = {
  Male: '男',
  Female: '女',
  Other: '其他',
  Unspecified: '未指定'
};

// 审核日志路径
const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, `category-review-${new Date().toISOString().split('T')[0]}.json`);

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * 函数级中文注释：提示用户输入（Promise封装）
 */
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

/**
 * 函数级中文注释：格式化显示逝者信息
 */
function displayDeceasedInfo(deceased, deceasedId, currentCategory) {
  console.log('\n' + '='.repeat(80));
  console.log(`📋 逝者ID: ${deceasedId}`);
  console.log('─'.repeat(80));
  console.log(`姓名: ${deceased.fullName || '未填写'}`);
  console.log(`性别: ${GENDER_MAP[deceased.gender?.toString()] || '未知'}`);

  // 处理生日和忌日
  if (deceased.birthDate) {
    const birthDate = new Date(deceased.birthDate.toNumber());
    console.log(`生日: ${birthDate.toLocaleDateString('zh-CN')}`);
  }
  if (deceased.deathDate) {
    const deathDate = new Date(deceased.deathDate.toNumber());
    console.log(`忌日: ${deathDate.toLocaleDateString('zh-CN')}`);
  }

  console.log(`生平简介: ${deceased.bio || '未填写'}`);
  console.log(`当前分类: ${CATEGORY_MAP[currentCategory].label} (${CATEGORY_MAP[currentCategory].name})`);
  console.log(`所有者: ${deceased.owner.toString()}`);
  console.log(`创建者: ${deceased.creator.toString()}`);
  console.log('='.repeat(80));
}

/**
 * 函数级中文注释：显示分类选择菜单
 */
function displayCategoryMenu() {
  console.log('\n📝 可选分类：');
  Object.entries(CATEGORY_MAP).forEach(([code, info]) => {
    console.log(`  [${code}] ${info.label} (${info.name}) - ${info.description}`);
  });
  console.log(`  [s] 跳过此逝者`);
  console.log(`  [q] 退出审核`);
}

/**
 * 函数级中文注释：解析用户输入的分类代码
 */
function parseCategoryInput(input) {
  const trimmed = input.trim().toLowerCase();

  if (trimmed === 's') return 'skip';
  if (trimmed === 'q') return 'quit';

  const code = parseInt(trimmed);
  if (isNaN(code) || code < 0 || code > 6) {
    return null;
  }

  return code;
}

/**
 * 函数级中文注释：确认分类变更
 */
async function confirmCategoryChange(deceasedId, oldCategory, newCategory) {
  console.log(`\n⚠️  确认变更：`);
  console.log(`   逝者ID: ${deceasedId}`);
  console.log(`   旧分类: ${CATEGORY_MAP[oldCategory].label}`);
  console.log(`   新分类: ${CATEGORY_MAP[newCategory].label}`);

  const answer = await question('是否确认？(y/n): ');
  return answer.trim().toLowerCase() === 'y';
}

/**
 * 函数级中文注释：使用sudo权限强制更新分类
 */
async function updateCategoryAsSudo(api, sudoKeyring, deceasedId, newCategoryCode, reason) {
  console.log(`\n🔧 正在使用sudo权限更新分类...`);

  try {
    // 构建内部调用：deceased.forceSetCategory(deceased_id, category_code, reason_cid)
    const call = api.tx.deceased.forceSetCategory(
      deceasedId,
      newCategoryCode,
      reason || '' // reason CID（可选）
    );

    // 使用sudo包装调用
    const sudoCall = api.tx.sudo.sudo(call);

    // 签名并发送交易
    return new Promise((resolve, reject) => {
      sudoCall.signAndSend(sudoKeyring, ({ status, events, dispatchError }) => {
        if (status.isInBlock) {
          console.log(`✅ 交易已打包到区块: ${status.asInBlock.toHex()}`);
        }

        if (status.isFinalized) {
          console.log(`✅ 交易已最终确认: ${status.asFinalized.toHex()}`);

          // 检查是否有错误
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              const { docs, name, section } = decoded;
              console.error(`❌ 错误: ${section}.${name}: ${docs.join(' ')}`);
              reject(new Error(`${section}.${name}`));
            } else {
              console.error(`❌ 错误: ${dispatchError.toString()}`);
              reject(new Error(dispatchError.toString()));
            }
          } else {
            console.log(`✅ 分类更新成功！`);
            resolve({ success: true, blockHash: status.asFinalized.toHex() });
          }
        }
      });
    });
  } catch (error) {
    console.error(`❌ 更新分类失败:`, error.message);
    throw error;
  }
}

/**
 * 函数级中文注释：保存审核日志
 */
function saveReviewLog(log) {
  let logs = [];

  // 读取现有日志
  if (fs.existsSync(LOG_FILE)) {
    try {
      const content = fs.readFileSync(LOG_FILE, 'utf8');
      logs = JSON.parse(content);
    } catch (error) {
      console.warn(`⚠️  无法读取现有日志文件: ${error.message}`);
    }
  }

  // 添加新日志
  logs.push({
    ...log,
    timestamp: new Date().toISOString()
  });

  // 写入文件
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
  console.log(`📄 审核日志已保存到: ${LOG_FILE}`);
}

/**
 * 函数级中文注释：查询最近N天创建的逝者
 */
async function getRecentDeceased(api, days) {
  console.log(`\n🔍 正在查询最近 ${days} 天创建的逝者...`);

  // 获取当前区块号
  const currentBlock = await api.query.system.number();
  const currentBlockNum = currentBlock.toNumber();

  // 计算时间范围（6秒出块，1天 = 14400个区块）
  const blocksPerDay = 14400;
  const startBlock = Math.max(0, currentBlockNum - (days * blocksPerDay));

  console.log(`📊 区块范围: ${startBlock} -> ${currentBlockNum} (当前)`);
  console.log(`   (约 ${((currentBlockNum - startBlock) / blocksPerDay).toFixed(1)} 天)`);

  // 查询DeceasedByCreationTime索引
  const recentDeceased = [];

  // 遍历区块范围查询索引
  for (let block = startBlock; block <= currentBlockNum; block += 100) {
    const deceasedIds = await api.query.deceased.deceasedByCreationTime(block);

    if (deceasedIds && deceasedIds.length > 0) {
      deceasedIds.forEach(id => {
        recentDeceased.push(id.toNumber());
      });
    }
  }

  console.log(`✅ 找到 ${recentDeceased.length} 个最近创建的逝者`);
  return recentDeceased;
}

/**
 * 函数级中文注释：主函数 - 交互式审核流程
 */
async function main() {
  console.log('🚀 逝者分类交互式审核系统');
  console.log('='.repeat(80));

  // 解析命令行参数
  const days = parseInt(process.argv[2]) || 10;
  console.log(`📅 审核范围: 最近 ${days} 天`);

  // 连接到链
  console.log('\n🔗 正在连接到 Substrate 节点...');
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });

  console.log(`✅ 已连接到链: ${(await api.rpc.system.chain()).toString()}`);
  console.log(`   运行时版本: ${api.runtimeVersion.specVersion.toNumber()}`);

  // 初始化 Keyring（使用 sr25519）
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');

  console.log(`👤 使用账户: Alice (${alice.address})`);
  console.log(`   (确保此账户拥有 sudo 权限)`);

  // 查询最近创建的逝者
  const recentDeceasedIds = await getRecentDeceased(api, days);

  if (recentDeceasedIds.length === 0) {
    console.log('\n✅ 没有需要审核的逝者。');
    process.exit(0);
  }

  // 统计信息
  const stats = {
    total: recentDeceasedIds.length,
    reviewed: 0,
    updated: 0,
    skipped: 0,
    failed: 0
  };

  console.log(`\n📊 开始审核 ${stats.total} 个逝者...`);
  console.log('─'.repeat(80));

  // 逐个审核
  for (let i = 0; i < recentDeceasedIds.length; i++) {
    const deceasedId = recentDeceasedIds[i];

    console.log(`\n[${i + 1}/${stats.total}]`);

    // 查询逝者详细信息
    const deceased = await api.query.deceased.deceasedOf(deceasedId);

    if (deceased.isNone) {
      console.log(`⚠️  逝者 ${deceasedId} 不存在，跳过。`);
      stats.skipped++;
      continue;
    }

    // 查询当前分类
    const currentCategory = (await api.query.deceased.categoryOf(deceasedId)).toNumber();

    // 显示逝者信息
    displayDeceasedInfo(deceased.unwrap(), deceasedId, currentCategory);

    // 显示分类选择菜单
    displayCategoryMenu();

    // 获取用户输入
    let userChoice = null;
    while (userChoice === null) {
      const input = await question('\n请选择新分类 (输入编号/s/q): ');
      userChoice = parseCategoryInput(input);

      if (userChoice === null) {
        console.log('❌ 无效输入，请重新输入。');
      }
    }

    // 处理用户选择
    if (userChoice === 'quit') {
      console.log('\n👋 退出审核。');
      break;
    }

    if (userChoice === 'skip') {
      console.log('⏭️  跳过此逝者。');
      stats.skipped++;
      stats.reviewed++;
      continue;
    }

    // 检查是否与当前分类相同
    if (userChoice === currentCategory) {
      console.log('ℹ️  分类未变更，跳过。');
      stats.skipped++;
      stats.reviewed++;
      continue;
    }

    // 确认变更
    const confirmed = await confirmCategoryChange(deceasedId, currentCategory, userChoice);

    if (!confirmed) {
      console.log('❌ 已取消变更。');
      stats.skipped++;
      stats.reviewed++;
      continue;
    }

    // 询问变更理由（可选）
    const reason = await question('变更理由 (可选，直接回车跳过): ');

    // 执行分类更新
    try {
      const result = await updateCategoryAsSudo(
        api,
        alice,
        deceasedId,
        userChoice,
        reason.trim() || undefined
      );

      stats.updated++;
      stats.reviewed++;

      // 保存审核日志
      saveReviewLog({
        deceasedId,
        fullName: deceased.unwrap().fullName.toString(),
        oldCategory: currentCategory,
        newCategory: userChoice,
        reason: reason.trim() || null,
        blockHash: result.blockHash,
        reviewer: alice.address
      });

    } catch (error) {
      console.error(`❌ 更新失败: ${error.message}`);
      stats.failed++;
      stats.reviewed++;

      const continueReview = await question('是否继续审核？(y/n): ');
      if (continueReview.trim().toLowerCase() !== 'y') {
        break;
      }
    }
  }

  // 显示审核统计
  console.log('\n' + '='.repeat(80));
  console.log('📊 审核统计：');
  console.log(`   总数: ${stats.total}`);
  console.log(`   已审核: ${stats.reviewed}`);
  console.log(`   已更新: ${stats.updated}`);
  console.log(`   已跳过: ${stats.skipped}`);
  console.log(`   失败: ${stats.failed}`);
  console.log('='.repeat(80));
  console.log(`✅ 审核完成！日志已保存到: ${LOG_FILE}`);

  rl.close();
  process.exit(0);
}

// 错误处理
process.on('unhandledRejection', (error) => {
  console.error('❌ 未处理的Promise拒绝:', error);
  rl.close();
  process.exit(1);
});

// 运行主函数
main().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  rl.close();
  process.exit(1);
});
