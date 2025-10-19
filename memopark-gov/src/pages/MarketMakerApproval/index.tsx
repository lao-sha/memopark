/**
 * 做市商审批页面
 * 函数级中文注释：Council 成员审批做市商申请
 * - 查看待审批的做市商申请列表
 * - 发起批准提案
 * - 投票（赞成/反对）
 * - 执行提案
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  message,
  Modal,
  Alert,
  Progress,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useApi } from '@/contexts/ApiContext';
import { useWalletStore, loadLocalAccounts, switchAccount, getSignerWithPassword, queryBalance, formatBalance } from '@/hooks/useWallet';
import { setCurrentAddress } from '@/lib/keystore';
import type { MarketMakerApplication, ProposalVoting } from '@/types';
import type { LocalKeystore } from '@/lib/keystore';
import { incrementalUpdateManager } from '@/lib/incrementalUpdateManager';
import { PageSkeleton, TableSkeleton } from '@/components/LoadingSkeleton';
import { ComponentErrorBoundary } from '@/components/ErrorBoundary';
import {
  useRealtimeCouncilMembers,
  useRealtimeDashboard
} from '@/hooks/useRealtimeData';
import { InlineProgress } from '@/components/OperationProgress';
import { analyzeError, formatErrorMessage, logError } from '@/lib/errorHandler';

/**
 * 函数级中文注释：做市商审批页面组件
 */
const MarketMakerApproval: React.FC = () => {
  const { api, isConnected } = useApi();
  const { accounts, currentAccount, balance, setAccounts, setCurrentAccount, setBalance } = useWalletStore();
  
  const [applications, setApplications] = useState<MarketMakerApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCouncilMember, setIsCouncilMember] = useState(false);
  const [councilMembers, setCouncilMembers] = useState<string[]>([]);

  // 使用实时数据钩子
  const councilMembersRealtime = useRealtimeCouncilMembers();
  const dashboardRealtime = useRealtimeDashboard();

  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());
  const [initialLoading, setInitialLoading] = useState<boolean>(true);

  /**
   * 函数级中文注释：加载本地账户
   * - 从 localStorage 恢复上次选择的账户
   * - 如果没有，则使用第一个账户
   */
  const loadAccounts = () => {
    const accs = loadLocalAccounts();
    setAccounts(accs);
    
    if (accs.length > 0) {
      // 从 localStorage 读取上次选择的账户地址（使用 keystore 模块的函数）
      const savedAddress = localStorage.getItem('mg.current'); // 修正：使用 'mg.' 前缀
      
      if (savedAddress) {
        // 找到对应的账户
        const savedAccount = accs.find(acc => acc.address === savedAddress);
        if (savedAccount) {
          console.log('✅ 恢复上次选择的账户:', savedAddress.slice(0, 8));
          setCurrentAccount(savedAccount);
          return;
        }
      }
      
      // 如果没有保存的账户或找不到，使用第一个
      console.log('⚠️  使用第一个账户');
      setCurrentAccount(accs[0]);
      setCurrentAddress(accs[0].address);
    }
  };

  /**
   * 函数级中文注释：切换账户
   */
  const handleSwitchAccount = (account: LocalKeystore) => {
    switchAccount(account.address);
    setCurrentAccount(account);
    message.success(`已切换到账户: ${account.name || account.address.slice(0, 8)}`);
  };

  /**
   * 函数级中文注释：弹出密码输入框
   * - 使用浏览器原生 prompt 确保可靠性
   * - 避免 Modal 渲染问题
   */
  const promptPassword = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      // 使用浏览器原生 prompt，100% 可靠
      const password = window.prompt('🔐 请输入密码来签名交易:');
      
      if (password && password.trim().length > 0) {
        resolve(password.trim());
      } else {
        message.warning('密码不能为空');
        reject(new Error('密码不能为空'));
      }
    });
  };

  /**
   * 函数级中文注释：查询账户余额
   */
  const fetchBalance = async () => {
    if (!api || !currentAccount) return;
    try {
      const bal = await queryBalance(api, currentAccount.address);
      setBalance(bal);
    } catch (err) {
      console.error('查询余额失败:', err);
    }
  };

  /**
   * 函数级中文注释：查询 Council 成员（配合实时数据钩子）
   */
  const fetchCouncilMembers = async () => {
    if (!api) return;
    try {
      const membersOpt: any = await api.query.council.members();
      const members = membersOpt.toJSON() as string[];

      // 更新状态和实时数据钩子
      setCouncilMembers(members);
      councilMembersRealtime.data = members;

      if (currentAccount) {
        const isMember = members.includes(currentAccount.address);
        setIsCouncilMember(isMember);
      }
    } catch (err) {
      console.error('查询 Council 成员失败:', err);
    }
  };

  /**
   * 函数级中文注释：强制刷新缓存数据
   * - 只清理必要的缓存（proposals 和 voting 相关）
   * - 保留其他缓存（如账户信息等）
   * - 重新加载最新链上数据
   */
  const forceRefreshData = async () => {
    console.log('🔄 强制刷新做市商数据...');

    try {
      // 函数级中文注释：只清理与做市商申请和提案相关的缓存
      // 不清理账户、余额等缓存，提高刷新效率
      localStorage.removeItem('mg.proposals');
      localStorage.removeItem('mg.proposalCache');
      localStorage.removeItem('mg.votingCache');
      console.log('✅ 已清理提案相关缓存');
    } catch (err) {
      console.warn('⚠️  清理缓存失败:', err);
    }

    // 清理组件状态（只清理申请列表，保留其他状态）
    setApplications([]);

    // 重新加载申请数据（强制全量刷新）
    await fetchApplications(true);

    message.success('做市商数据刷新完成');
    setLastRefreshTime(Date.now());
  };

  /**
   * 函数级中文注释：获取做市商申请数据（支持增量更新）
   */
  const fetchApplicationsData = async (): Promise<MarketMakerApplication[]> => {
    console.log('📊 开始获取做市商申请数据...');
    
    // 防御性检查，链未连接或接口不可用时直接返回空
    if (!api) {
      console.warn('⚠️  API 未初始化');
      return [];
    }
    
    if (!isConnected) {
      console.warn('⚠️  API 未连接');
      return [];
    }
    
    if (!(api as any)?.query?.marketMaker?.applications) {
      console.warn('⚠️  marketMaker.applications 接口不存在');
      return [];
    }

    console.log('✅ API 检查通过，开始查询链上数据...');

    let entries: any[] = [];
    try {
      entries = await api.query.marketMaker.applications.entries();
      console.log(`✅ 查询到 ${entries.length} 个做市商申请`);
    } catch (e: any) {
      console.error('❌ 加载 applications 失败:', e?.message || e);
      console.error('   错误详情:', e);
      return [];
    }

    const apps: MarketMakerApplication[] = [];
    console.log(`🔄 开始处理 ${entries.length} 个申请...`);

    for (const [key, value] of entries) {
      const mmId = key.args[0].toNumber();
      const app = value.toJSON() as any;
      
      console.log(`   [${mmId}] 处理申请: owner=${app.owner?.slice(0, 10)}..., status=${app.status}`);

      // 构建批准提案的内部调用
      const innerCall = api.tx.marketMaker.approve(mmId);
      const proposalHash = innerCall.method.hash.toHex();

      // 查询提案是否存在
      // 批量查询：先收集 proposalHash，后面统一查询，以减少链上请求数量
      let proposalOpt: any = null;
      try {
        proposalOpt = await api.query.council.proposalOf(proposalHash);
      } catch (e: any) {
        console.warn('读取 proposalOf 失败:', e?.message || e);
      }

      let proposalInfo = {};

      if (proposalOpt && proposalOpt.isSome) {
        // 提案存在，查询投票信息
        let votingOpt: any = null;
        try {
          votingOpt = await api.query.council.voting(proposalHash);
        } catch (e: any) {
          console.warn('读取 voting 失败:', e?.message || e);
        }

        if (votingOpt && votingOpt.isSome) {
          const voting = votingOpt.unwrap().toJSON() as ProposalVoting;

          const hasVoted = currentAccount
            ? voting.ayes.includes(currentAccount.address) || voting.nays.includes(currentAccount.address)
            : false;

          const canExecute = voting.ayes.length >= voting.threshold;

          proposalInfo = {
            proposalHash,
            proposalIndex: voting.index,
            threshold: voting.threshold,
            ayesCount: voting.ayes.length,
            naysCount: voting.nays.length,
            hasVoted,
            canExecute,
          };
        }
      }

      apps.push({
        mmId,
        owner: app.owner,
        deposit: app.deposit,
        firstPurchasePool: app.firstPurchasePool,
        status: app.status,
        appliedAt: app.appliedAt,
        infoDeadline: app.infoDeadline,
        reviewDeadline: app.reviewDeadline,
        businessCid: app.businessCid,
        contactCid: app.contactCid,
        ...proposalInfo,
      });
    }

    console.log(`✅ 处理完成，共 ${apps.length} 个申请`);

    // 回退逻辑：若 Applications 为空，则尝试读取 ActiveMarketMakers 以展示已激活的做市商
    if (apps.length === 0 && (api as any)?.query?.marketMaker?.activeMarketMakers) {
      console.log('⚠️  Applications 为空，尝试查询 ActiveMarketMakers...');
      try {
        const activeEntries: any = await api.query.marketMaker.activeMarketMakers.entries();
        console.log(`   查询到 ${activeEntries.length} 个活跃做市商`);
        
        for (const [akey, aval] of activeEntries) {
          const mmId = akey.args[0].toNumber();
          const am = aval.toJSON() as any;
          
          console.log(`   [${mmId}] 活跃做市商: owner=${am.owner?.slice(0, 10)}..., status=${am.status}`);

          // 与 Applications 同结构，直接映射
          apps.push({
            mmId,
            owner: am.owner,
            deposit: am.deposit,
            firstPurchasePool: am.firstPurchasePool,
            status: am.status,
            appliedAt: am.appliedAt,
            infoDeadline: am.infoDeadline,
            reviewDeadline: am.reviewDeadline,
            businessCid: am.businessCid,
            contactCid: am.contactCid,
            // 激活后通常无进行中的提案，下面字段留空/由后续链上检查填充
          });
        }
        
        if (apps.length === 0) {
          console.warn('⚠️  暂无做市商申请或激活记录');
        } else {
          console.log(`✅ 从 ActiveMarketMakers 加载了 ${apps.length} 个记录`);
        }
      } catch (e: any) {
        console.error('❌ 加载 activeMarketMakers 失败:', e?.message || e);
        console.error('   错误详情:', e);
      }
    }

    console.log(`📊 最终返回 ${apps.length} 个做市商数据`);
    return apps;
  };

  /**
   * 函数级中文注释：加载做市商申请列表（支持增量更新）
   */
  const fetchApplications = async (forceFullRefresh: boolean = false) => {
    if (!api) return;

    setLoading(true);
    try {
      let apps: MarketMakerApplication[];

      if (forceFullRefresh) {
        // 强制全量刷新
        console.log('🔄 强制全量刷新申请数据...');
        apps = await fetchApplicationsData();
        setApplications(apps);
        console.log('✅ 全量刷新完成，加载到', apps.length, '个申请');
      } else {
        // 增量更新检查
        const updateResult = await incrementalUpdateManager.checkForUpdates(
          'proposals',
          fetchApplicationsData
        );

        if (updateResult.hasChanges) {
          console.log('🔄 发现提案数据变化，更新界面...');
          // 重新获取完整数据并更新界面
          apps = await fetchApplicationsData();
          setApplications(apps);
          console.log('✅ 增量更新完成，加载到', apps.length, '个申请');
        } else {
          console.log('✅ 提案数据无变化，保持当前状态');
          // 不更新界面，但更新刷新时间
          setLastRefreshTime(Date.now());
          return;
        }
      }

      setLastRefreshTime(Date.now());

      // 初次加载完成后，隐藏骨架屏
      if (initialLoading) {
        setInitialLoading(false);
      }

      // 统一轮询：由 useRealtimeData 管理；此处移除递归 setTimeout，避免堆积

    } catch (err: any) {
      console.error('❌ 加载申请失败:', err);
      message.error(`加载失败: ${err.message}`);

      // 失败时回退到全量刷新
      console.log('🔄 回退到全量刷新...');
      try {
        const apps = await fetchApplicationsData();
        setApplications(apps);
        setLastRefreshTime(Date.now());
      } catch (retryErr) {
        console.error('❌ 全量刷新也失败:', retryErr);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * 函数级中文注释：发起批准提案
   */
  const handlePropose = async (mmId: number, retryCount: number = 0) => {
    if (!api || !currentAccount) {
      message.error('请先连接钱包');
      return;
    }

    const maxRetries = 2;
    const retryDelay = 1000; // 1秒
    
    if (!isCouncilMember) {
      message.error('只有 Council 成员可以发起提案');
      return;
    }
    
    // 函数级中文注释：检查账户余额，避免 wasm unreachable 错误
    try {
      const accountInfo: any = await api.query.system.account(currentAccount.address);
      const balance = BigInt(accountInfo.data.free.toString());
      const minRequired = 1n * 10n**12n;  // 至少 1 MEMO
      
      if (balance < minRequired) {
        const balanceMemo = Number(balance) / 1e12;
        message.error(`账户余额不足！当前余额: ${balanceMemo.toFixed(4)} MEMO，发起提案需要至少 1 MEMO 支付交易费用`);
        console.error('❌ 余额不足，无法发起提案');
        return;
      }
      
      console.log(`✅ 余额检查通过: ${Number(balance) / 1e12} MEMO`);
    } catch (err: any) {
      console.error('❌ 余额查询失败:', err);
      message.warning('无法查询余额，发起提案可能失败');
    }
    
    try {
      // 函数级中文注释：检查做市商状态，避免重复提案
      console.log('🔍 检查做市商状态...');
      const mmInfo: any = await api.query.marketMaker.applications(mmId);
      if (!mmInfo || mmInfo.isNone) {
        message.error('做市商申请不存在');
        console.error('❌ 做市商申请不存在, mmId:', mmId);
        return;
      }
      
      const application = mmInfo.unwrap().toJSON();
      console.log('✅ 做市商状态:', application.status);
      
      if (application.status !== 'PendingReview') {
        // 函数级中文注释：根据不同状态给出友好的提示信息
        let tipMessage = '';
        switch (application.status) {
          case 'DepositLocked':
            tipMessage = '做市商状态为"押金已锁定"，需要先提交资料才能进入审核流程';
            break;
          case 'Active':
            tipMessage = '做市商已激活，无需重复审批';
            break;
          case 'Rejected':
            tipMessage = '做市商申请已被拒绝';
            break;
          case 'Cancelled':
            tipMessage = '做市商申请已取消';
            break;
          default:
            tipMessage = `做市商状态为 ${application.status}，无法发起审批`;
        }
        message.warning(tipMessage);
        console.warn(`⚠️ 做市商状态不是 PendingReview: ${application.status}`);
        return;
      }
      
      // 函数级中文注释：检查提案是否已存在
      console.log('🔍 检查提案是否已存在...');
      const innerCall = api.tx.marketMaker.approve(mmId);
      const proposalHash = innerCall.method.hash.toHex();
      console.log(`   提案哈希: ${proposalHash}`);
      
      const proposalOpt: any = await api.query.council.proposalOf(proposalHash);
      
      if (proposalOpt && proposalOpt.isSome) {
        message.warning('该批准提案已存在，请前往投票或执行');
        console.warn('⚠️ 提案已存在:', proposalHash);
        // 刷新数据以显示最新状态
        fetchApplications(true);
        return;
      }
      
      console.log('✅ 提案不存在，可以发起');
      
    } catch (err: any) {
      console.error('❌ 提案检查失败:', err);
      message.error(`检查失败: ${err.message}`);
      setActionLoading(null);
      return;
    }
    
    setActionLoading(mmId);
    
    try {
      // 请求密码
      console.log('🔐 请求密码...');
      const password = await promptPassword();
      console.log('✅ 密码已获取');
      
      console.log('🔑 创建密钥对...');
      const pair = await getSignerWithPassword(currentAccount.address, password);
      console.log('✅ 密钥对已创建');
      
      // 重新构建内部调用（之前已用于检查）
      console.log('🔨 构建内部调用 (approve)...');
      const innerCall = api.tx.marketMaker.approve(mmId);
      const lengthBound = innerCall.encodedLength;
      console.log('✅ 内部调用已构建');
      console.log(`   📋 内部调用方法: ${innerCall.method.section}.${innerCall.method.method}`);
      console.log(`   📋 参数: mmId=${mmId}`);
      console.log(`   📋 编码长度 (lengthBound): ${lengthBound}`);
      console.log(`   📋 调用哈希: ${innerCall.method.hash.toHex()}`);
      
      // 计算投票阈值（2/3多数）
      const memberCount = councilMembers.length;
      const threshold = Math.max(1, Math.min(memberCount, Math.ceil(memberCount * 2 / 3)));
      
      console.log('\n📊 Council 参数:');
      console.log(`   成员数: ${memberCount}`);
      console.log(`   投票阈值: ${threshold}/${memberCount} (${Math.ceil(threshold/memberCount*100)}%)`);
      console.log(`   threshold 类型: ${typeof threshold}`);
      console.log(`   lengthBound 类型: ${typeof lengthBound}`);
      
      // 发起提案
      console.log('\n🔨 构建 propose 交易...');
      const proposeTx = api.tx.council.propose(threshold, innerCall, lengthBound);
      console.log('✅ 交易已构建');
      console.log(`   📋 交易方法: ${proposeTx.method.section}.${proposeTx.method.method}`);
      console.log(`   📋 参数数量: ${proposeTx.method.args.length}`);
      console.log(`   📋 交易编码长度: ${proposeTx.encodedLength}`);
      console.log(`   📋 交易哈希: ${proposeTx.hash.toHex()}`);
      
      console.log('📝 开始签名发送...');
      console.log('   密钥对地址:', pair.address);
      console.log('   密钥对类型:', pair.type);
      
      await new Promise((resolve, reject) => {
        // 设置超时检测
        const timeout = setTimeout(() => {
          console.error('   ⏱️  签名发送超时（30秒）');
          reject(new Error('签名发送超时'));
        }, 30000);
        
        proposeTx.signAndSend(pair, ({ status, dispatchError, events }: any) => {
          console.log('   📡 交易状态:', status.type);
          
          if (dispatchError) {
            clearTimeout(timeout);
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              console.error('   ❌ 提案失败:', `${decoded.section}.${decoded.name}`);
              message.error(`提案失败: ${decoded.section}.${decoded.name}`);
            } else {
              console.error('   ❌ 提案失败:', dispatchError.toString());
              message.error(`提案失败: ${dispatchError.toString()}`);
            }
            reject(new Error(dispatchError.toString()));
            return;
          }
          
          if (status.isInBlock) {
            console.log('   ✅ 提案已打包:', status.asInBlock.toHex());
            
            events.forEach(({ event }: any) => {
              if (event.section === 'council' && event.method === 'Proposed') {
                clearTimeout(timeout);
                message.success('✅ 提案创建成功！');
                resolve(true);
              }
            });
          }
        }).catch((err: any) => {
          clearTimeout(timeout);
          console.error('   ❌ signAndSend 错误:', err);
          reject(err);
        });
      });
      
      // 刷新列表
      await fetchApplications();
      
    } catch (err: any) {
      console.error('❌ 发起提案失败:', err);

      // 检查是否可以重试
      const canRetry = retryCount < maxRetries &&
        (err.message?.includes('超时') ||
         err.message?.includes('网络') ||
         err.message?.includes('连接'));

      if (canRetry) {
        console.log(`🔄 第 ${retryCount + 1} 次重试...`);
        setTimeout(() => {
          handlePropose(mmId, retryCount + 1);
        }, retryDelay);
        return;
      }

      // 使用错误处理工具提供更好的用户体验
      const errorInfo = analyzeError(err);
      const formattedError = formatErrorMessage(errorInfo);

      // 记录错误日志
      logError(err, {
        operation: 'propose',
        mmId,
        retryCount
      });

      // 显示用户友好的错误信息
      message.error(formattedError.description);
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * 函数级中文注释：投票
   */
  const handleVote = async (app: MarketMakerApplication, approve: boolean, retryCount: number = 0) => {
    const maxRetries = 2;
    const retryDelay = 1000; // 1秒

    if (!api || !currentAccount) {
      message.error('请先连接钱包');
      return;
    }

    if (!isCouncilMember) {
      message.error('只有 Council 成员可以投票');
      return;
    }

    if (!app.proposalHash || app.proposalIndex === undefined) {
      message.error('提案不存在');
      return;
    }

    if (app.hasVoted) {
      message.warning('您已经投过票了');
      return;
    }

    setActionLoading(app.mmId);

    try {
      // 步骤1: 验证权限
      console.log('🔐 请求密码...');
      // 步骤推进逻辑已简化

      // 函数级中文注释：检查账户余额，避免 wasm unreachable 错误
      // 余额不足时会导致链端验证阶段 panic
      const accountInfo: any = await api.query.system.account(currentAccount.address);
      const balance = BigInt(accountInfo.data.free.toString());
      const minRequired = 1n * 10n**12n;  // 至少 1 MEMO

      if (balance < minRequired) {
        const balanceMemo = Number(balance) / 1e12;
        message.error(`账户余额不足！当前余额: ${balanceMemo.toFixed(4)} MEMO，投票需要至少 1 MEMO 支付交易费用`);
        console.error('❌ 余额不足，无法投票');
        // 余额不足处理
        return;
      }

      console.log(`✅ 余额检查通过: ${Number(balance) / 1e12} MEMO`);

      // 请求密码
      const password = await promptPassword();
      console.log('✅ 密码已获取');

      console.log('🔑 创建密钥对...');
      const pair = await getSignerWithPassword(currentAccount.address, password);
      console.log('✅ 密钥对已创建');

      console.log('🗳️  投票:', { mmId: app.mmId, approve, proposalHash: app.proposalHash, proposalIndex: app.proposalIndex });

      // 函数级中文注释：为避免本地缓存的 proposalIndex 过期导致验证阶段 panic
      // 1) 动态查询链上最新的 voting.index
      // 2) 再次确认当前账户是否已投票（以链上最新状态为准）
      // 3) 使用最新 index 构造投票交易
      let latestIndex = app.proposalIndex;
      try {
        const votingOpt: any = await api.query.council.voting(app.proposalHash);
        if (votingOpt.isSome) {
          const votingCodec: any = votingOpt.unwrap();
          // index 读取
          latestIndex = votingCodec.index.toNumber();
          // 已投票检查
          const votingJson: any = votingCodec.toJSON();
          const alreadyVoted = !!(votingJson?.ayes?.includes(currentAccount.address) || votingJson?.nays?.includes(currentAccount.address));
          if (alreadyVoted) {
            message.warning('您已在链上投过票（以最新状态为准）');
            // 已投票处理
            setActionLoading(null);
            return;
          }
        } else {
          message.error('提案投票记录不存在或已关闭');
          // 提案不存在处理
          setActionLoading(null);
          return;
        }
      } catch (e) {
        console.error('读取最新投票状态失败:', e);
        message.error('读取最新投票状态失败');
        // 状态查询失败处理
        setActionLoading(null);
        return;
      }

      console.log('🔨 构建交易...');
      const voteTx = api.tx.council.vote(app.proposalHash, latestIndex, approve);
      console.log('✅ 交易已构建');

      console.log('📝 开始签名发送...');
      console.log('   密钥对地址:', pair.address);
      console.log('   密钥对类型:', pair.type);

      await new Promise((resolve, reject) => {
        // 设置超时检测
        const timeout = setTimeout(() => {
          console.error('   ⏱️  签名发送超时（30秒）');
          // 超时处理
          reject(new Error('签名发送超时'));
        }, 30000);

        voteTx.signAndSend(pair, ({ status, dispatchError, events }: any) => {
          console.log('   📡 交易状态:', status.type);

          if (dispatchError) {
            clearTimeout(timeout);
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              console.error('   ❌ 投票失败:', `${decoded.section}.${decoded.name}`);
              // 记录错误但不设置进度状态
              message.error(`投票失败: ${decoded.section}.${decoded.name}`);
            } else {
              console.error('   ❌ 投票失败:', dispatchError.toString());
              // 记录错误但不设置进度状态
              message.error(`投票失败: ${dispatchError.toString()}`);
            }
            reject(new Error(dispatchError.toString()));
            return;
          }

          if (status.isInBlock) {
            console.log('   ✅ 投票已打包:', status.asInBlock.toHex());

            events.forEach(({ event }: any) => {
              if (event.section === 'council' && event.method === 'Voted') {
                clearTimeout(timeout);
                message.success(`✅ ${approve ? '赞成' : '反对'}票已提交！`);
                resolve(true);
              }
            });
          }
        }).catch((err: any) => {
          clearTimeout(timeout);
          console.error('   ❌ signAndSend 错误:', err);
          // 记录错误但不设置进度状态
          reject(err);
        });
      });

      // 刷新列表
      await fetchApplications();

    } catch (err: any) {
      console.error('❌ 投票失败:', err);

      // 检查是否可以重试
      const canRetry = retryCount < maxRetries &&
        (err.message?.includes('超时') ||
         err.message?.includes('网络') ||
         err.message?.includes('连接'));

      if (canRetry) {
        console.log(`🔄 第 ${retryCount + 1} 次重试投票...`);
        setTimeout(() => {
          handleVote(app, approve, retryCount + 1);
        }, retryDelay);
        return;
      }

      // 使用错误处理工具提供更好的用户体验
      const errorInfo = analyzeError(err);
      const formattedError = formatErrorMessage(errorInfo);

      // 记录错误日志
      logError(err, {
        operation: 'vote',
        proposalHash: app.proposalHash,
        approve,
        retryCount
      });

      // 显示用户友好的错误信息
      message.error(formattedError.description);
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * 函数级中文注释：执行提案
   */
  const handleExecute = async (app: MarketMakerApplication, retryCount: number = 0) => {
    const maxRetries = 2;
    const retryDelay = 1000; // 1秒
    if (!api || !currentAccount) {
      message.error('请先连接钱包');
      return;
    }
    
    if (!isCouncilMember) {
      message.error('只有 Council 成员可以执行提案');
      return;
    }
    
    if (!app.proposalHash || app.proposalIndex === undefined) {
      message.error('提案不存在');
      return;
    }
    
    if (!app.canExecute) {
      message.error('提案尚未达到执行阈值');
      return;
    }
    
    // 函数级中文注释：检查账户余额，避免 wasm unreachable 错误
    try {
      const accountInfo: any = await api.query.system.account(currentAccount.address);
      const balance = BigInt(accountInfo.data.free.toString());
      const minRequired = 1n * 10n**12n;  // 至少 1 MEMO
      
      if (balance < minRequired) {
        const balanceMemo = Number(balance) / 1e12;
        message.error(`账户余额不足！当前余额: ${balanceMemo.toFixed(4)} MEMO，执行提案需要至少 1 MEMO 支付交易费用`);
        console.error('❌ 余额不足，无法执行提案');
        return;
      }
      
      console.log(`✅ 余额检查通过: ${Number(balance) / 1e12} MEMO`);
    } catch (err: any) {
      console.error('❌ 余额查询失败:', err);
      message.warning('无法查询余额，执行提案可能失败');
    }
    
    setActionLoading(app.mmId);
    
    try {
      // 请求密码
      console.log('🔐 请求密码...');
      const password = await promptPassword();
      console.log('✅ 密码已获取');
      
      console.log('🔑 创建密钥对...');
      const pair = await getSignerWithPassword(currentAccount.address, password);
      console.log('✅ 密钥对已创建');
      
      // 重新构建内部调用以获取 lengthBound 与动态权重
      const innerCall = api.tx.marketMaker.approve(app.mmId);
      const lengthBound = innerCall.encodedLength;
      
      console.log('⚡ 执行提案:', { mmId: app.mmId, proposalHash: app.proposalHash, proposalIndex: app.proposalIndex });
      
      // 函数级中文注释：为避免本地缓存的 proposalIndex 过期导致验证阶段 panic
      // 1) 动态查询链上最新的 voting.index
      // 2) 检查提案是否仍然存在于 proposals 列表
      // 3) 检查是否已达到执行阈值（以链上最新状态为准）
      let latestIndex = app.proposalIndex;
      try {
        // 检查提案是否仍在 proposals 列表中
        const currentProposals: any = await api.query.council.proposals();
        console.log('🔍 当前提案列表:');
        console.log(`   总数: ${currentProposals.length}`);
        currentProposals.forEach((hash: any, i: number) => {
          console.log(`   [${i}] ${hash.toHex()}`);
        });
        console.log(`   目标提案: ${app.proposalHash}`);
        
        const proposalExists = currentProposals.some((hash: any) => hash.toHex() === app.proposalHash);
        console.log(`   ✅ 提案是否在列表中: ${proposalExists}`);
        
        if (!proposalExists) {
          message.error('❌ 提案不在待处理列表中，可能已被执行或关闭');
          console.error('❌ 提案不存在于 council.proposals() 列表中');
          setActionLoading(null);
          // 强制刷新数据
          fetchApplications(true);
          return;
        }
        
        console.log('✅ 提案验证通过，继续执行...');
        
        const votingOpt: any = await api.query.council.voting(app.proposalHash);
        if (votingOpt.isSome) {
          const votingCodec: any = votingOpt.unwrap();
          latestIndex = votingCodec.index.toNumber();
          const votingJson: any = votingCodec.toJSON();
          const canExecuteNow = (votingJson?.ayes?.length || 0) >= (votingJson?.threshold || Number.MAX_SAFE_INTEGER);
          if (!canExecuteNow) {
            message.error('提案尚未达到执行阈值（以最新状态为准）');
            setActionLoading(null);
            return;
          }
        } else {
          message.error('提案投票记录不存在或已关闭');
          setActionLoading(null);
          return;
        }
      } catch (e) {
        console.error('读取最新投票状态失败:', e);
        message.error('读取最新投票状态失败');
        setActionLoading(null);
        return;
      }
      
      // 函数级中文注释：使用 council.close 执行提案（与链端成功脚本保持一致）
      // - close 方法用于关闭并执行已投票通过的提案
      // - execute 方法仅用于单个成员直接执行无需投票的提案
      // - 权重参数：refTime=2000000000 (2秒), proofSize=128000 (128KB)
      console.log('🔨 构建交易...');
      // 函数级中文注释：使用与测试脚本完全一致的 BigInt 字面量格式
      // 注意：必须使用字面量 (2000000000n)，而不是构造函数 BigInt(2000000000)
      // 因为链端在解码时期望特定的编码格式
      const proposalWeightBound = {
        refTime: 2000000000n,  // BigInt 字面量（与测试脚本完全一致）
        proofSize: 128000n     // BigInt 字面量（与测试脚本完全一致）
      };
      // 函数级中文注释：不要使用 (api as any) 类型转换
      // 直接使用 api 对象可以保留完整的类型信息和编码逻辑
      const closeTx = api.tx.council.close(
        app.proposalHash,
        latestIndex,
        proposalWeightBound,
        lengthBound
      );
      console.log('✅ 交易已构建');
      console.log('   📋 交易方法:', `${closeTx.method.section}.${closeTx.method.method}`);
      console.log('   📋 参数数量:', closeTx.method.args.length);
      console.log('   📋 proposalHash:', app.proposalHash);
      console.log('   📋 index:', latestIndex);
      console.log('   📋 weightBound (类型):', typeof proposalWeightBound.refTime);
      console.log('   📋 weightBound.refTime:', proposalWeightBound.refTime);
      console.log('   📋 weightBound.proofSize:', proposalWeightBound.proofSize);
      console.log('   📋 lengthBound:', lengthBound);
      
      // 打印实际传递给 close 的参数
      console.log('   📋 close 参数详情:');
      console.log('      - proposalHash:', app.proposalHash);
      console.log('      - index:', latestIndex);
      console.log('      - weightBound:', JSON.stringify({
        refTime: proposalWeightBound.refTime.toString(),
        proofSize: proposalWeightBound.proofSize.toString()
      }));
      console.log('      - lengthBound:', lengthBound);
      
      console.log('📝 开始签名发送...');
      console.log('   密钥对地址:', pair.address);
      console.log('   密钥对类型:', pair.type);
      
      await new Promise((resolve, reject) => {
        // 设置超时检测
        const timeout = setTimeout(() => {
          console.error('   ⏱️  签名发送超时（30秒）');
          reject(new Error('签名发送超时'));
        }, 30000);
        
        closeTx.signAndSend(pair, ({ status, dispatchError, events }: any) => {
          console.log('   📡 交易状态:', status.type);
          
          if (dispatchError) {
            clearTimeout(timeout);
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              console.error('   ❌ 执行失败:', `${decoded.section}.${decoded.name}`);
              message.error(`执行失败: ${decoded.section}.${decoded.name}`);
            } else {
              console.error('   ❌ 执行失败:', dispatchError.toString());
              message.error(`执行失败: ${dispatchError.toString()}`);
            }
            reject(new Error(dispatchError.toString()));
            return;
          }
          
          if (status.isInBlock) {
            console.log('   ✅ 提案关闭已打包:', status.asInBlock.toHex());
            
            let closed = false;
            let executed = false;
            let approved = false;
            
            events.forEach(({ event }: any) => {
              console.log(`   📌 事件: ${event.section}.${event.method}`);
              
              if (event.section === 'council' && event.method === 'Closed') {
                closed = true;
              }
              if (event.section === 'council' && (event.method === 'Executed' || event.method === 'MemberExecuted')) {
                executed = true;
              }
              if (event.section === 'marketMaker' && event.method === 'Approved') {
                approved = true;
              }
            });
            
            if (closed && executed && approved) {
              clearTimeout(timeout);
              message.success('🎉 提案执行成功！做市商已批准');
              resolve(true);
            } else if (closed && executed) {
              clearTimeout(timeout);
              message.warning('⚠️  提案已执行，但未检测到批准事件');
              resolve(true);
            } else if (closed) {
              clearTimeout(timeout);
              message.info('提案已关闭');
              resolve(true);
            }
          }
        }).catch((err: any) => {
          clearTimeout(timeout);
          console.error('   ❌ signAndSend 错误:', err);
          reject(err);
        });
      });
      
      // 刷新列表
      await fetchApplications();
      
    } catch (err: any) {
      console.error('❌ 执行提案失败:', err);

      // 检查是否可以重试
      const canRetry = retryCount < maxRetries &&
        (err.message?.includes('超时') ||
         err.message?.includes('网络') ||
         err.message?.includes('连接'));

      if (canRetry) {
        console.log(`🔄 第 ${retryCount + 1} 次重试执行...`);
        setTimeout(() => {
          handleExecute(app, retryCount + 1);
        }, retryDelay);
        return;
      }

      // 使用错误处理工具提供更好的用户体验
      const errorInfo = analyzeError(err);
      const formattedError = formatErrorMessage(errorInfo);

      // 记录错误日志
      logError(err, {
        operation: 'execute',
        proposalHash: app.proposalHash,
        retryCount
      });

      // 显示用户友好的错误信息
      message.error(formattedError.description);
    } finally {
      setActionLoading(null);
    }
  };

  // 初始化
  useEffect(() => {
    loadAccounts();

    // 页面加载时清理可能存在的缓存
    try {
      localStorage.removeItem('mg.proposalCache');
      localStorage.removeItem('mg.votingCache');
      console.log('✅ 页面加载时清理缓存');
    } catch (err) {
      console.warn('⚠️  页面加载时清理缓存失败:', err);
    }
  }, []);

  useEffect(() => {
    if (isConnected && api) {
      fetchCouncilMembers();

      // 初次加载完成后隐藏骨架屏
      const timer = setTimeout(() => {
        setInitialLoading(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isConnected, api, currentAccount]);

  useEffect(() => {
    if (isConnected && api) {
      fetchApplications();
    }
  }, [isConnected, api]);

  useEffect(() => {
    if (currentAccount && api) {
      fetchBalance();
    }
  }, [currentAccount, api]);

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'mmId',
      key: 'mmId',
      width: 60,
    },
    {
      title: '所有者',
      dataIndex: 'owner',
      key: 'owner',
      width: 200,
      render: (owner: string) => (
        <span title={owner}>{owner.slice(0, 8)}...{owner.slice(-6)}</span>
      ),
    },
    {
      title: '押金',
      dataIndex: 'deposit',
      key: 'deposit',
      width: 160,
      render: (deposit: any) => {
        // 函数级中文注释：兼容不同类型的余额数据（string, number, bigint）
        const depositStr = typeof deposit === 'string' ? deposit : (typeof deposit === 'bigint' ? deposit.toString() : String(deposit || '0'));
        return `${formatBalance(depositStr)} MEMO`;
      },
    },
    {
      title: '首购资金池',
      dataIndex: 'firstPurchasePool',
      key: 'firstPurchasePool',
      width: 180,
      render: (pool: any) => {
        // 函数级中文注释：兼容不同类型的余额数据（string, number, bigint）
        const poolStr = typeof pool === 'string' ? pool : (typeof pool === 'bigint' ? pool.toString() : String(pool || '0'));
        return `${formatBalance(poolStr)} MEMO`;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          WaitingInfo: 'orange',
          PendingReview: 'blue',
          Approved: 'green',
          Rejected: 'red',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: '投票进度',
      key: 'voting',
      render: (_: any, record: MarketMakerApplication) => {
        if (!record.proposalHash) {
          return <Tag color="default">未发起提案</Tag>;
        }
        
        const percent = record.threshold ? (record.ayesCount! / record.threshold) * 100 : 0;
        
        return (
          <div style={{ width: 120 }}>
            <Progress
              percent={Math.min(percent, 100)}
              size="small"
              status={record.canExecute ? 'success' : 'active'}
              format={() => `${record.ayesCount}/${record.threshold}`}
            />
            {record.hasVoted && <Tag color="blue" style={{ marginTop: 4 }}>已投票</Tag>}
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: MarketMakerApplication) => {
        const isProcessing = actionLoading === record.mmId;
        
        if (record.status === 'Approved') {
          return <Tag color="success">已批准</Tag>;
        }
        
        if (record.status === 'Rejected') {
          return <Tag color="error">已驳回</Tag>;
        }
        
        if (!isCouncilMember) {
          return <Tag color="default">需要 Council 权限</Tag>;
        }
        
        if (!record.proposalHash) {
          // 未发起提案
          return (
            <Button
              type="primary"
              size="small"
              icon={<ThunderboltOutlined />}
              loading={isProcessing}
              onClick={() => handlePropose(record.mmId)}
            >
              发起提案
            </Button>
          );
        }
        
        if (record.canExecute) {
          // 达到阈值后仅允许执行，禁止继续投票，避免链端校验 panic
          return (
            <Space>
              <Tag color="green">已达阈值</Tag>
              <Button
                type="primary"
                size="small"
                icon={<ThunderboltOutlined />}
                loading={isProcessing}
                onClick={() => handleExecute(record)}
              >
                执行
              </Button>
            </Space>
          );
        }
        
        if (record.hasVoted) {
          return <Tag color="blue">已投票 ({record.ayesCount}/{record.threshold})</Tag>;
        }
        
        // 可以投票
        return (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                loading={isProcessing}
                onClick={() => handleVote(record, true)}
              >
                赞成
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseOutlined />}
                loading={isProcessing}
                onClick={() => handleVote(record, false)}
              >
                反对
              </Button>
            </Space>
            {isProcessing && (
              <div style={{ width: '200px' }}>
                <InlineProgress
                  steps={['验证', '检查', '构建', '签名', '确认']}
                  currentStep={0}
                  status="normal"
                  compact={true}
                />
              </div>
            )}
          </Space>
        );
      },
    },
  ];

  // 初次加载时显示骨架屏
  if (initialLoading) {
    return <PageSkeleton />;
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Statistic
              title="链端状态"
              value={isConnected ? '已连接' : '未连接'}
              valueStyle={{ color: isConnected ? '#3f8600' : '#cf1322' }}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="Council 成员数"
              value={councilMembers.length}
              prefix={<UserOutlined />}
              valueStyle={{
                color: councilMembersRealtime.isStale ? '#faad14' : undefined
              }}
              suffix={councilMembersRealtime.loading ? '...' : undefined}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="待审批申请"
              value={applications.filter(a => a.status === 'PendingReview').length}
              valueStyle={{
                color: dashboardRealtime.hasAnyError ? '#ff4d4f' : undefined
              }}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="账户余额"
              value={balance}
              suffix="MEMO"
            />
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                上次刷新: {new Date(lastRefreshTime).toLocaleTimeString()}
              </div>
              <div style={{ fontSize: '11px', color: '#999' }}>
                {Math.floor((Date.now() - lastRefreshTime) / 1000)}秒前
              </div>
              <div style={{ fontSize: '10px', color: '#1890ff', marginTop: '4px' }}>
                📡 实时同步中
                {councilMembersRealtime.loading && ' 🔄'}
                {dashboardRealtime.hasAnyError && ' ⚠️'}
              </div>
            </div>
          </Col>
        </Row>

        {/* 函数级中文注释：刷新按钮区域 - 无论是否有钱包都可以刷新数据 */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button icon={<ReloadOutlined />} onClick={() => fetchApplications(false)}>
            刷新
          </Button>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={() => forceRefreshData()}
            title="强制刷新缓存数据"
          >
            强制刷新
          </Button>
        </div>

        {!currentAccount ? (
          <Alert
            message="请先创建或导入钱包"
            description="访问钱包管理页面创建或导入钱包"
            type="warning"
            showIcon
            action={
              <Button type="primary" onClick={() => window.location.href = '/#/wallet'}>
                前往钱包管理
              </Button>
            }
            style={{ marginBottom: 24 }}
          />
        ) : (
          <Alert
            message={`当前账户: ${currentAccount.name || '未命名'} (${currentAccount.address.slice(0, 8)}...${currentAccount.address.slice(-6)})`}
            description={
              isCouncilMember ? 
              '✅ 您是 Council 成员，可以发起提案和投票' : 
              '⚠️  您不是 Council 成员，只能查看'
            }
            type={isCouncilMember ? 'success' : 'warning'}
            showIcon
            action={
              accounts.length > 1 ? (
                <Button
                  onClick={() => {
                    Modal.info({
                      title: '切换账户',
                      content: (
                        <div>
                          {accounts.map((acc) => (
                            <div key={acc.address} style={{ marginBottom: 8 }}>
                              <Button
                                block
                                type={acc.address === currentAccount.address ? 'primary' : 'default'}
                                onClick={() => {
                                  handleSwitchAccount(acc);
                                  Modal.destroyAll();
                                }}
                              >
                                {acc.name || '未命名'} - {acc.address.slice(0, 8)}...{acc.address.slice(-6)}
                              </Button>
                            </div>
                          ))}
                        </div>
                      ),
                    });
                  }}
                >
                  切换账户
                </Button>
              ) : undefined
            }
            style={{ marginBottom: 24 }}
          />
        )}

        {loading ? (
          <TableSkeleton columns={6} rows={8} showHeader={true} />
        ) : (
          <ComponentErrorBoundary name="DataTable">
            <Table
              columns={columns}
              dataSource={applications}
              rowKey="mmId"
              pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
              scroll={{ y: 480, x: 'max-content' }}
            />
          </ComponentErrorBoundary>
        )}
      </Card>
    </div>
  );
};

export default MarketMakerApproval;

