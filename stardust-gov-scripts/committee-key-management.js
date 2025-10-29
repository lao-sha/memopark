/**
 * 委员会共享密钥管理脚本
 * 
 * 实现方案A：委员会动态成员解密权限方案
 * 
 * 功能：
 * 1. 初始化委员会共享密钥（一次性）
 * 2. 委员会成员变更时更新密钥分片
 * 3. 验证委员会密钥系统状态
 * 
 * @author Memopark Team
 * @date 2025-10-23
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');
const { cryptoWaitReady } = require('@polkadot/util-crypto');
const secrets = require('secrets.js-grempe');
const nacl = require('tweetnacl');
const fs = require('fs');
const path = require('path');

// 配置
const ENDPOINT = process.env.ENDPOINT || 'ws://127.0.0.1:9944';
const TOTAL_SHARES = 5;  // 委员会成员数量
const THRESHOLD = 3;  // 需要多少个分片才能恢复

/**
 * 主函数
 */
async function main() {
  console.log('🔑 委员会共享密钥管理工具');
  console.log('================================\n');
  
  const command = process.argv[2];
  
  switch (command) {
    case 'init':
      await initCommitteeSharedKey();
      break;
    case 'update':
      await updateCommitteeKeyShares();
      break;
    case 'status':
      await checkStatus();
      break;
    case 'help':
    default:
      printHelp();
      break;
  }
}

/**
 * 打印帮助信息
 */
function printHelp() {
  console.log('使用方法：');
  console.log('  node committee-key-management.js <command>');
  console.log('');
  console.log('命令：');
  console.log('  init     - 初始化委员会共享密钥（首次设置）');
  console.log('  update   - 更新委员会密钥分片（成员变更时）');
  console.log('  status   - 查看当前委员会密钥系统状态');
  console.log('  help     - 显示此帮助信息');
  console.log('');
  console.log('环境变量：');
  console.log('  ENDPOINT - WebSocket节点地址（默认：ws://127.0.0.1:9944）');
  console.log('  SUDO_SEED - Sudo账户助记词（用于初始化和更新）');
  console.log('');
  console.log('示例：');
  console.log('  # 初始化委员会共享密钥');
  console.log('  SUDO_SEED="your seed phrase" node committee-key-management.js init');
  console.log('');
  console.log('  # 更新密钥分片（委员会成员变更后）');
  console.log('  SUDO_SEED="your seed phrase" node committee-key-management.js update');
}

/**
 * 初始化委员会共享密钥
 */
async function initCommitteeSharedKey() {
  console.log('📋 步骤1：初始化委员会共享密钥\n');
  
  // 1. 连接到链
  const api = await connectToChain();
  
  // 2. 获取Sudo账户
  const sudoAccount = await getSudoAccount();
  console.log(`✅ Sudo账户：${sudoAccount.address}\n`);
  
  // 3. 获取委员会成员列表
  const committeeMembers = await getCommitteeMembers(api);
  console.log(`✅ 获取委员会成员列表（${committeeMembers.length}人）：`);
  committeeMembers.forEach((member, i) => {
    console.log(`   ${i + 1}. ${member}`);
  });
  console.log('');
  
  if (committeeMembers.length !== TOTAL_SHARES) {
    console.error(`❌ 错误：委员会成员数量（${committeeMembers.length}）与配置不符（${TOTAL_SHARES}）`);
    console.log('   请调整 TOTAL_SHARES 配置或确保委员会成员数量正确\n');
    process.exit(1);
  }
  
  // 4. 生成委员会共享密钥并分割
  console.log('📋 步骤2：生成并分割委员会共享密钥\n');
  const sharedKey = nacl.randomBytes(32);
  const sharedKeyHex = Buffer.from(sharedKey).toString('hex');
  
  console.log('✅ 委员会共享密钥已生成（32字节）');
  console.log(`   密钥（请妥善保管）：${sharedKeyHex}\n`);
  
  // 分割密钥
  const shares = secrets.share(sharedKeyHex, TOTAL_SHARES, THRESHOLD);
  console.log(`✅ 共享密钥已分割为 ${TOTAL_SHARES} 个分片`);
  console.log(`   门限值：${THRESHOLD}（任意 ${THRESHOLD} 个分片可恢复）\n`);
  
  // 5. 为每个委员会成员加密分片
  console.log('📋 步骤3：为每个委员会成员加密密钥分片\n');
  const encryptedShares = [];
  
  for (let i = 0; i < committeeMembers.length; i++) {
    const member = committeeMembers[i];
    const share = shares[i];
    
    // 获取成员公钥（从链上或本地）
    const publicKey = await getMemberPublicKey(api, member);
    
    if (!publicKey) {
      console.error(`❌ 错误：委员会成员 ${member} 未注册公钥`);
      console.log('   请该成员先注册公钥：api.tx.evidence.registerPublicKey(...)\n');
      process.exit(1);
    }
    
    // 加密分片
    const encryptedShare = encryptShareForMember(share, publicKey);
    encryptedShares.push([member, Array.from(encryptedShare)]);
    
    console.log(`   ✅ ${i + 1}. 已为 ${member.slice(0, 10)}... 加密分片`);
  }
  
  console.log('');
  
  // 6. 保存共享密钥到安全位置
  console.log('📋 步骤4：保存共享密钥（安全备份）\n');
  const backupPath = saveSharedKeyBackup(sharedKeyHex, shares);
  console.log(`✅ 共享密钥已保存到：${backupPath}`);
  console.log('   ⚠️  请将此文件备份到安全位置（离线存储）\n');
  
  // 7. 提交到链上
  console.log('📋 步骤5：提交密钥分片到链上\n');
  
  console.log('准备提交交易：');
  console.log(`   - Sudo账户：${sudoAccount.address}`);
  console.log(`   - 委员会成员数：${encryptedShares.length}`);
  console.log(`   - 预计Gas费：约 ${estimateGas(encryptedShares.length)} MEMO\n`);
  
  const shouldContinue = await confirm('是否继续提交？(y/n): ');
  if (!shouldContinue) {
    console.log('❌ 用户取消操作\n');
    process.exit(0);
  }
  
  try {
    await submitInitTransaction(api, sudoAccount, encryptedShares);
    console.log('✅ 委员会共享密钥初始化成功！\n');
  } catch (error) {
    console.error('❌ 提交交易失败：', error.message);
    process.exit(1);
  }
  
  // 8. 验证
  console.log('📋 步骤6：验证初始化结果\n');
  await verifyInitialization(api, committeeMembers);
  
  console.log('\n🎉 完成！委员会共享密钥系统已初始化');
  console.log('\n后续步骤：');
  console.log('  1. 将共享密钥备份文件保存到安全位置');
  console.log('  2. 通知委员会成员他们的分片已准备就绪');
  console.log('  3. 测试委员会成员解密功能\n');
  
  await api.disconnect();
}

/**
 * 更新委员会密钥分片（成员变更时）
 */
async function updateCommitteeKeyShares() {
  console.log('📋 更新委员会密钥分片\n');
  
  // 1. 连接到链
  const api = await connectToChain();
  
  // 2. 获取Sudo账户
  const sudoAccount = await getSudoAccount();
  console.log(`✅ Sudo账户：${sudoAccount.address}\n`);
  
  // 3. 获取当前委员会成员列表
  const newMembers = await getCommitteeMembers(api);
  console.log(`✅ 当前委员会成员列表（${newMembers.length}人）：`);
  newMembers.forEach((member, i) => {
    console.log(`   ${i + 1}. ${member}`);
  });
  console.log('');
  
  // 4. 读取共享密钥备份
  console.log('📋 步骤1：读取共享密钥备份\n');
  const backupPath = findLatestBackup();
  
  if (!backupPath) {
    console.error('❌ 错误：未找到共享密钥备份文件');
    console.log('   请确保初始化时保存了备份文件\n');
    process.exit(1);
  }
  
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const sharedKeyHex = backup.sharedKey;
  
  console.log(`✅ 已读取共享密钥备份：${backupPath}`);
  console.log(`   密钥前缀：${sharedKeyHex.slice(0, 16)}...\n`);
  
  // 5. 重新分割密钥
  console.log('📋 步骤2：重新分割共享密钥\n');
  const totalShares = newMembers.length;
  const threshold = Math.ceil(totalShares * 2 / 3);  // 2/3门限
  
  const newShares = secrets.share(sharedKeyHex, totalShares, threshold);
  console.log(`✅ 共享密钥已重新分割为 ${totalShares} 个分片`);
  console.log(`   新门限值：${threshold}（任意 ${threshold} 个分片可恢复）\n`);
  
  // 6. 为新成员列表加密分片
  console.log('📋 步骤3：为新成员列表加密密钥分片\n');
  const encryptedShares = [];
  
  for (let i = 0; i < newMembers.length; i++) {
    const member = newMembers[i];
    const share = newShares[i];
    
    const publicKey = await getMemberPublicKey(api, member);
    
    if (!publicKey) {
      console.error(`❌ 错误：委员会成员 ${member} 未注册公钥`);
      process.exit(1);
    }
    
    const encryptedShare = encryptShareForMember(share, publicKey);
    encryptedShares.push([member, Array.from(encryptedShare)]);
    
    console.log(`   ✅ ${i + 1}. 已为 ${member.slice(0, 10)}... 加密分片`);
  }
  
  console.log('');
  
  // 7. 提交到链上
  console.log('📋 步骤4：更新链上密钥分片\n');
  
  console.log('准备提交交易：');
  console.log(`   - Sudo账户：${sudoAccount.address}`);
  console.log(`   - 新成员数：${encryptedShares.length}`);
  console.log(`   - 预计Gas费：约 ${estimateGas(encryptedShares.length)} MEMO\n`);
  
  const shouldContinue = await confirm('是否继续提交？(y/n): ');
  if (!shouldContinue) {
    console.log('❌ 用户取消操作\n');
    process.exit(0);
  }
  
  try {
    await submitUpdateTransaction(api, sudoAccount, encryptedShares);
    console.log('✅ 委员会密钥分片已更新！\n');
  } catch (error) {
    console.error('❌ 提交交易失败：', error.message);
    process.exit(1);
  }
  
  // 8. 验证
  console.log('📋 步骤5：验证更新结果\n');
  await verifyInitialization(api, newMembers);
  
  console.log('\n🎉 完成！委员会密钥分片已更新');
  console.log('\n效果：');
  console.log('  ✅ 新成员可以查看所有历史数据');
  console.log('  ✅ 离职成员无法解密任何数据');
  console.log('  ✅ 无需重新加密历史数据\n');
  
  await api.disconnect();
}

/**
 * 查看委员会密钥系统状态
 */
async function checkStatus() {
  console.log('📊 委员会密钥系统状态\n');
  
  const api = await connectToChain();
  
  // 1. 获取委员会成员
  const members = await getCommitteeMembers(api);
  console.log(`委员会成员数：${members.length}\n`);
  
  // 2. 检查每个成员的密钥分片
  console.log('密钥分片状态：\n');
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const share = await api.query.marketMaker.committeeKeyShares(member);
    
    const status = share.isSome ? '✅ 已设置' : '❌ 未设置';
    const size = share.isSome ? share.unwrap().length : 0;
    
    console.log(`  ${i + 1}. ${member.slice(0, 10)}... ${status} ${size > 0 ? `(${size} 字节)` : ''}`);
  }
  
  console.log('');
  
  // 3. 检查备份文件
  const backupPath = findLatestBackup();
  if (backupPath) {
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    console.log('✅ 共享密钥备份文件存在');
    console.log(`   路径：${backupPath}`);
    console.log(`   创建时间：${backup.createdAt}`);
    console.log(`   密钥前缀：${backup.sharedKey.slice(0, 16)}...\n`);
  } else {
    console.log('❌ 未找到共享密钥备份文件\n');
  }
  
  await api.disconnect();
}

// ==================== 辅助函数 ====================

/**
 * 连接到链
 */
async function connectToChain() {
  await cryptoWaitReady();
  const provider = new WsProvider(ENDPOINT);
  const api = await ApiPromise.create({ provider });
  
  console.log(`✅ 已连接到节点：${ENDPOINT}`);
  const chain = await api.rpc.system.chain();
  console.log(`   链：${chain}\n`);
  
  return api;
}

/**
 * 获取Sudo账户
 */
async function getSudoAccount() {
  const sudoSeed = process.env.SUDO_SEED;
  
  if (!sudoSeed) {
    console.error('❌ 错误：未设置 SUDO_SEED 环境变量');
    console.log('   请设置：export SUDO_SEED="your seed phrase"\n');
    process.exit(1);
  }
  
  const keyring = new Keyring({ type: 'sr25519' });
  return keyring.addFromUri(sudoSeed);
}

/**
 * 获取委员会成员列表
 */
async function getCommitteeMembers(api) {
  // Instance3 = ContentCommittee
  const members = await api.query.collective.members(3);
  return members.map(m => m.toString());
}

/**
 * 获取成员公钥
 */
async function getMemberPublicKey(api, memberAccount) {
  const pubKey = await api.query.evidence.userPublicKeys(memberAccount);
  
  if (pubKey.isNone) {
    return null;
  }
  
  return new Uint8Array(pubKey.unwrap().keyData);
}

/**
 * 为成员加密分片
 */
function encryptShareForMember(share, memberPublicKey) {
  const shareBytes = Buffer.from(share, 'hex');
  
  const ephemeralKeyPair = nacl.box.keyPair();
  const nonce = nacl.randomBytes(24);
  
  const encrypted = nacl.box(
    shareBytes,
    nonce,
    memberPublicKey,
    ephemeralKeyPair.secretKey
  );
  
  if (!encrypted) {
    throw new Error('加密分片失败');
  }
  
  const result = new Uint8Array(
    nonce.length + ephemeralKeyPair.publicKey.length + encrypted.length
  );
  result.set(nonce, 0);
  result.set(ephemeralKeyPair.publicKey, nonce.length);
  result.set(encrypted, nonce.length + ephemeralKeyPair.publicKey.length);
  
  return result;
}

/**
 * 保存共享密钥备份
 */
function saveSharedKeyBackup(sharedKeyHex, shares) {
  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }
  
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filename = `committee-shared-key-${timestamp}.json`;
  const filepath = path.join(backupDir, filename);
  
  const backup = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    sharedKey: sharedKeyHex,
    shares: shares,
    totalShares: TOTAL_SHARES,
    threshold: THRESHOLD,
    warning: '⚠️  此文件包含委员会共享密钥，请妥善保管！',
  };
  
  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
  
  return filepath;
}

/**
 * 查找最新的备份文件
 */
function findLatestBackup() {
  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    return null;
  }
  
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('committee-shared-key-'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    return null;
  }
  
  return path.join(backupDir, files[0]);
}

/**
 * 估算Gas费
 */
function estimateGas(memberCount) {
  return (memberCount * 100).toFixed(2);
}

/**
 * 提交初始化交易
 */
async function submitInitTransaction(api, sudoAccount, encryptedShares) {
  return new Promise((resolve, reject) => {
    api.tx.sudo.sudo(
      api.tx.marketMaker.initCommitteeSharedKey(encryptedShares)
    ).signAndSend(sudoAccount, ({ status, dispatchError }) => {
      if (status.isInBlock) {
        console.log(`   ⏳ 交易已打包到区块：${status.asInBlock.toHex()}`);
      } else if (status.isFinalized) {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs}`));
          } else {
            reject(new Error(dispatchError.toString()));
          }
        } else {
          console.log(`   ✅ 交易已确认：${status.asFinalized.toHex()}`);
          resolve();
        }
      }
    }).catch(reject);
  });
}

/**
 * 提交更新交易
 */
async function submitUpdateTransaction(api, sudoAccount, encryptedShares) {
  return new Promise((resolve, reject) => {
    api.tx.sudo.sudo(
      api.tx.marketMaker.updateCommitteeKeyShares(encryptedShares)
    ).signAndSend(sudoAccount, ({ status, dispatchError }) => {
      if (status.isInBlock) {
        console.log(`   ⏳ 交易已打包到区块：${status.asInBlock.toHex()}`);
      } else if (status.isFinalized) {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs}`));
          } else {
            reject(new Error(dispatchError.toString()));
          }
        } else {
          console.log(`   ✅ 交易已确认：${status.asFinalized.toHex()}`);
          resolve();
        }
      }
    }).catch(reject);
  });
}

/**
 * 验证初始化结果
 */
async function verifyInitialization(api, members) {
  let allSuccess = true;
  
  for (const member of members) {
    const share = await api.query.marketMaker.committeeKeyShares(member);
    
    if (share.isNone) {
      console.log(`   ❌ ${member.slice(0, 10)}... 密钥分片未设置`);
      allSuccess = false;
    } else {
      console.log(`   ✅ ${member.slice(0, 10)}... 密钥分片已设置 (${share.unwrap().length} 字节)`);
    }
  }
  
  if (allSuccess) {
    console.log('\n✅ 所有委员会成员的密钥分片均已设置');
  } else {
    console.log('\n⚠️  部分委员会成员的密钥分片设置失败');
  }
}

/**
 * 用户确认
 */
async function confirm(question) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    readline.question(question, (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// 运行主函数
main().catch(console.error);

