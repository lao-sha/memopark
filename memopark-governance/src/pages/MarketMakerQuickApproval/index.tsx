/**
 * 函数级详细中文注释：做市商快速审批页面
 * - 模仿 批准做市商完整流程.js 的自动化流程
 * - 一键完成：发起提案 → 投票 → 关闭提案（如果达到阈值）
 * - 显示详细的操作日志
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  message,
  Descriptions,
  Tag,
  Space,
  Typography,
  Alert,
  Steps,
  List,
  Divider,
  Progress,
  Modal
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useWallet } from '@/contexts/Wallet';
import { useApi } from '@/contexts/Api';
import { signAndSend } from '@/services/wallet/signer';

const { Title, Text } = Typography;
const { Step } = Steps;

interface Application {
  id: number;
  owner: string;
  deposit: string;
  status: string;
  epayGateway: string;
  epayPort: number;
  epayPid: string;
  epayKey: string;
  reviewDeadline: number;
  firstPurchasePool: string;
  // 投票状态
  hasProposal?: boolean;
  proposalHash?: string;
  proposalIndex?: number;
  hasVoted?: boolean;
  votingInfo?: {
    ayes: number;
    nays: number;
    threshold: number;
  };
}

interface CouncilInfo {
  members: string[];
  threshold: number;
}

interface OperationLog {
  step: number;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  detail?: string;
  timestamp: Date;
}

/**
 * 做市商快速审批页面
 * 一键式自动化审批流程
 */
const MarketMakerQuickApproval: React.FC = () => {
  const { api } = useApi();
  const { activeAccount } = useWallet();
  
  // 数据状态
  const [applications, setApplications] = useState<Application[]>([]);
  const [councilInfo, setCouncilInfo] = useState<CouncilInfo | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 操作状态
  const [currentStep, setCurrentStep] = useState(0);
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMmId, setSelectedMmId] = useState<number | null>(null);
  
  // 进度
  const [progress, setProgress] = useState(0);

  /**
   * 添加操作日志
   */
  const addLog = (step: number, status: OperationLog['status'], message: string, detail?: string) => {
    const log: OperationLog = {
      step,
      status,
      message,
      detail,
      timestamp: new Date()
    };
    setOperationLogs(prev => [...prev, log]);
    console.log(`[步骤${step}] ${status.toUpperCase()}: ${message}`, detail || '');
  };

  /**
   * 加载待审批的做市商申请
   * 同时加载提案状态和投票信息
   */
  const loadApplications = async () => {
    if (!api || !activeAccount) return;

    setLoading(true);
    try {
      const entries = await api.query.marketMaker.applications.entries();
      const apps = await Promise.all(
        entries
          .map(async ([key, value]: any) => {
            const id = key.args[0].toNumber();
            const app = value.toJSON() as any;
            
            // 基本信息
            const baseApp: Application = {
              id,
              owner: app.owner,
              deposit: app.deposit,
              status: app.status,
              epayGateway: app.epayGateway || '',
              epayPort: app.epayPort || 0,
              epayPid: app.epayPid || '',
              epayKey: app.epayKey || '',
              reviewDeadline: app.reviewDeadline || 0,
              firstPurchasePool: app.firstPurchasePool || '0',
            };

            // 只处理待审批的申请
            if (app.status !== 'PendingReview') {
              return baseApp;
            }

            // 检查是否有提案
            try {
              const innerCall = api.tx.marketMaker.approve(id);
              const proposalHash = innerCall.method.hash.toHex();
              const proposalOpt: any = await api.query.council.proposalOf(proposalHash);

              if (proposalOpt.isSome) {
                // 有提案，获取投票信息
                const votingOpt: any = await api.query.council.voting(proposalHash);
                if (votingOpt.isSome) {
                  const voting = votingOpt.unwrap().toJSON() as any;
                  const hasVoted = voting.ayes.includes(activeAccount) || voting.nays.includes(activeAccount);

                  return {
                    ...baseApp,
                    hasProposal: true,
                    proposalHash,
                    proposalIndex: voting.index,
                    hasVoted,
                    votingInfo: {
                      ayes: voting.ayes.length,
                      nays: voting.nays.length,
                      threshold: voting.threshold,
                    },
                  };
                }
              }
            } catch (error) {
              console.error(`检查申请 #${id} 的提案状态失败:`, error);
            }

            return baseApp;
          })
      );

      const pendingApps = apps.filter((app: Application) => app.status === 'PendingReview');
      setApplications(pendingApps);
      addLog(0, 'success', `加载到 ${pendingApps.length} 个待审批申请`);
    } catch (error) {
      console.error('加载申请失败:', error);
      message.error('加载申请失败');
      addLog(0, 'error', '加载申请失败', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载 Council 信息
   */
  const loadCouncilInfo = async () => {
    if (!api) return;

    try {
      const membersOpt = await api.query.council.members();
      const members = (membersOpt.toJSON() as any[]).map((m: any) => m.toString());
      const threshold = Math.max(1, Math.min(members.length, Math.ceil(members.length * 2 / 3)));

      setCouncilInfo({ members, threshold });
      addLog(0, 'success', `Council 成员数: ${members.length}，投票阈值: ${threshold}`);
    } catch (error) {
      console.error('加载 Council 信息失败:', error);
      addLog(0, 'error', '加载 Council 信息失败', (error as Error).message);
    }
  };

  useEffect(() => {
    if (api && activeAccount) {
      loadApplications();
      loadCouncilInfo();
    }
  }, [api, activeAccount]);

  /**
   * 一键批准流程
   * 步骤：
   * 1. 校验账户是否为 Council 成员
   * 2. 发起批准提案
   * 3. 投票
   * 4. 检查是否达到阈值
   * 5. 如果达到阈值，关闭并执行提案
   */
  const handleQuickApprove = async (mmId: number) => {
    if (!api || !activeAccount || !councilInfo) {
      message.error('请先连接钱包');
      return;
    }

    setSelectedMmId(mmId);
    setIsProcessing(true);
    setCurrentStep(0);
    setOperationLogs([]);
    setProgress(0);

    try {
      // ========== 步骤 1：校验成员资格 ==========
      setCurrentStep(1);
      setProgress(10);
      addLog(1, 'running', '正在校验 Council 成员资格...');

      const isMember = councilInfo.members.includes(activeAccount);
      if (!isMember) {
        throw new Error('您不是 Council 成员，无权执行此操作');
      }

      addLog(1, 'success', '✅ 确认是 Council 成员', `地址: ${activeAccount.slice(0, 10)}...${activeAccount.slice(-10)}`);
      setProgress(20);

      // ========== 步骤 2：发起批准提案 ==========
      setCurrentStep(2);
      addLog(2, 'running', '正在发起批准提案...');

      const innerCall = api.tx.marketMaker.approve(mmId);
      const lengthBound = innerCall.encodedLength;
      const threshold = councilInfo.threshold;

      addLog(2, 'running', `提案参数: mmId=${mmId}, threshold=${threshold}/${councilInfo.members.length}, lengthBound=${lengthBound}`);

      const proposeTx = api.tx.council.propose(threshold, innerCall, lengthBound);
      const proposalHash = innerCall.method.hash.toHex();

      addLog(2, 'running', `提案哈希: ${proposalHash.slice(0, 20)}...`);

      // 检查提案是否已存在
      const existingProposal: any = await api.query.council.proposalOf(proposalHash);
      
      let proposalIndex: number | null = null;

      if (existingProposal.isSome) {
        addLog(2, 'success', '⚠️ 提案已存在，跳过创建步骤');
        
        const votingOpt: any = await api.query.council.voting(proposalHash);
        if (votingOpt.isSome) {
          proposalIndex = votingOpt.unwrap().toJSON().index;
          addLog(2, 'success', `提案索引: ${proposalIndex}`);
        }
      } else {
        // 发起提案
        await signAndSend(activeAccount, proposeTx, {
          onSuccess: (blockHash) => {
            addLog(2, 'success', `✅ 提案已提交`, `区块: ${blockHash.slice(0, 10)}...`);
          },
          onError: (error) => {
            throw error;
          }
        });

        // 获取提案索引
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待区块确认
        const votingOpt: any = await api.query.council.voting(proposalHash);
        if (votingOpt.isSome) {
          proposalIndex = votingOpt.unwrap().toJSON().index;
          addLog(2, 'success', `提案索引: ${proposalIndex}`);
        }
      }

      if (proposalIndex === null) {
        throw new Error('无法获取提案索引');
      }

      setProgress(50);

      // ========== 步骤 3：投票 ==========
      setCurrentStep(3);
      addLog(3, 'running', '正在投赞成票...');

      // 检查是否已投票
      const votingOpt: any = await api.query.council.voting(proposalHash);
      if (!votingOpt.isSome) {
        throw new Error('提案投票信息不存在');
      }

      const voting = votingOpt.unwrap().toJSON() as any;
      
      // 🔍 详细日志：投票状态检查
      console.group('🔍 [投票状态检查]');
      console.log('当前账户:', activeAccount);
      console.log('赞成票列表:', voting.ayes);
      console.log('反对票列表:', voting.nays);
      console.log('赞成票包含当前账户?', voting.ayes.includes(activeAccount));
      console.log('反对票包含当前账户?', voting.nays.includes(activeAccount));
      console.groupEnd();
      
      const hasVoted = voting.ayes.includes(activeAccount) || voting.nays.includes(activeAccount);
      
      addLog(3, 'running', `投票检查: 赞成${voting.ayes.length}票, 反对${voting.nays.length}票, 当前账户已投票=${hasVoted}`);

      if (hasVoted) {
        addLog(3, 'success', '⚠️ 该成员已投票，跳过投票步骤');
      } else {
        const voteTx = api.tx.council.vote(proposalHash, proposalIndex, true);

        await signAndSend(activeAccount, voteTx, {
          onSuccess: (blockHash) => {
            addLog(3, 'success', `✅ 投票成功`, `区块: ${blockHash.slice(0, 10)}...`);
          },
          onError: (error) => {
            throw error;
          }
        });
      }

      setProgress(70);

      // ========== 步骤 4：检查是否达到阈值 ==========
      setCurrentStep(4);
      addLog(4, 'running', '正在检查提案状态...');

      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待区块确认
      const updatedVotingOpt: any = await api.query.council.voting(proposalHash);
      const updatedVoting = updatedVotingOpt.unwrap().toJSON() as any;

      addLog(4, 'success', `最新投票: ${updatedVoting.ayes.length} 赞成, ${updatedVoting.nays.length} 反对 (阈值: ${updatedVoting.threshold})`);

      if (updatedVoting.ayes.length >= updatedVoting.threshold) {
        addLog(4, 'success', '🎉 提案已达到阈值！');
        setProgress(80);

        // ========== 步骤 5：关闭并执行提案 ==========
        setCurrentStep(5);
        addLog(5, 'running', '正在关闭并执行提案...');

        const closeTx = api.tx.council.close(
          proposalHash,
          proposalIndex,
          { refTime: 2000000000n, proofSize: 128000n },
          lengthBound
        );

        await signAndSend(activeAccount, closeTx, {
          onSuccess: (blockHash) => {
            addLog(5, 'success', `✅ 提案已执行`, `区块: ${blockHash.slice(0, 10)}...`);
            addLog(5, 'success', '🎊 完整流程成功！做市商已批准');
            setProgress(100);
            setCurrentStep(6);
            
            // 刷新申请列表
            setTimeout(() => {
              loadApplications();
            }, 2000);
          },
          onError: (error) => {
            throw error;
          }
        });
      } else {
        addLog(4, 'success', `⏳ 提案还需要 ${updatedVoting.threshold - updatedVoting.ayes.length} 票才能执行`);
        addLog(4, 'success', '💡 提示：需要其他 Council 成员投票');
        setProgress(90);
        setCurrentStep(4);
        
        message.info('提案已发起并投票，但还需要其他成员投票才能执行');
      }

    } catch (error: any) {
      console.error('快速批准失败:', error);
      addLog(currentStep, 'error', `❌ 操作失败`, error.message);
      message.error(`操作失败: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 申请表格列
  const columns = [
    {
      title: 'MM ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '申请人',
      dataIndex: 'owner',
      key: 'owner',
      render: (addr: string) => (
        <Text copyable={{ text: addr }}>
          {addr.slice(0, 6)}...{addr.slice(-6)}
        </Text>
      ),
    },
    {
      title: '押金',
      dataIndex: 'deposit',
      key: 'deposit',
      render: (val: string) => `${(BigInt(val) / BigInt(1e12)).toString()} MEMO`,
    },
    {
      title: '首购资金池',
      dataIndex: 'firstPurchasePool',
      key: 'firstPurchasePool',
      render: (val: string) => `${(BigInt(val) / BigInt(1e12)).toString()} MEMO`,
    },
    {
      title: 'Epay配置',
      dataIndex: 'epayGateway',
      key: 'epayGateway',
      render: (val: string) => {
        if (val) {
          return <Tag color="green">已配置</Tag>
        }
        return <Tag color="red">未配置</Tag>
      },
    },
    {
      title: '审核状态',
      key: 'reviewStatus',
      width: 200,
      render: (record: Application) => {
        if (!record.hasProposal) {
          return <Tag color="default">未发起提案</Tag>;
        }

        const { votingInfo, hasVoted } = record;
        if (!votingInfo) {
          return <Tag color="default">未发起提案</Tag>;
        }

        const reachedThreshold = votingInfo.ayes >= votingInfo.threshold;

        return (
          <Space direction="vertical" size={0}>
            <Space size={4}>
              <Tag color={reachedThreshold ? 'success' : 'processing'}>
                {votingInfo.ayes}/{votingInfo.threshold} 票
              </Tag>
              {hasVoted && <Tag color="blue">已投票</Tag>}
            </Space>
            {reachedThreshold && (
              <Text type="success" style={{ fontSize: 12 }}>
                ✅ 可执行
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (record: Application) => {
        const reachedThreshold = record.votingInfo && record.votingInfo.ayes >= record.votingInfo.threshold;
        const hasVoted = record.hasVoted;
        const hasProposal = record.hasProposal;

        // 如果已投票且已达到阈值
        if (hasVoted && reachedThreshold) {
          return (
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Tag color="success" icon={<CheckCircleOutlined />}>
                已投票·可执行
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                请在普通审批页面执行
              </Text>
            </Space>
          );
        }

        // 如果已投票但未达到阈值
        if (hasVoted) {
          return (
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Tag color="blue" icon={<CheckCircleOutlined />}>
                已投票
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                等待其他成员投票
              </Text>
            </Space>
          );
        }

        return (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认一键批准？',
                  icon: <InfoCircleOutlined />,
                  content: (
                    <div>
                      {hasProposal ? (
                        <Alert
                          message="提案已存在"
                          description="将跳过创建提案步骤，直接投票"
                          type="info"
                          showIcon
                          style={{ marginBottom: 16 }}
                        />
                      ) : (
                        <p>将自动执行以下步骤：</p>
                      )}
                      <ol>
                        <li>校验 Council 成员资格</li>
                        {!hasProposal && <li>发起批准提案</li>}
                        <li>投赞成票</li>
                        <li>如果达到阈值，关闭并执行提案</li>
                      </ol>
                      <Alert
                        message="注意"
                        description="如果当前投票未达到阈值，需要其他 Council 成员继续投票"
                        type="warning"
                        showIcon
                        style={{ marginTop: 16 }}
                      />
                    </div>
                  ),
                  okText: '确认批准',
                  cancelText: '取消',
                  onOk: () => handleQuickApprove(record.id)
                });
              }}
              loading={isProcessing && selectedMmId === record.id}
              disabled={isProcessing}
            >
              {hasProposal ? '继续投票' : '一键批准'}
            </Button>
            <Button
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => {
              Modal.info({
                title: `做市商申请详情 #${record.id}`,
                width: 600,
                content: (
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="申请人">
                      <Text copyable={{ text: record.owner }}>{record.owner}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="押金">
                      {(BigInt(record.deposit) / BigInt(1e12)).toString()} MEMO
                    </Descriptions.Item>
                    <Descriptions.Item label="首购资金池">
                      {(BigInt(record.firstPurchasePool) / BigInt(1e12)).toString()} MEMO
                    </Descriptions.Item>
                    <Descriptions.Item label="Epay网关">
                      {record.epayGateway || '未配置'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Epay端口">
                      {record.epayPort || '未配置'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Epay商户ID">
                      {record.epayPid || '未配置'}
                    </Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color="orange">{record.status}</Tag>
                    </Descriptions.Item>
                  </Descriptions>
                )
              });
            }}
          >
            查看详情
          </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <ThunderboltOutlined /> 做市商快速审批
      </Title>

      <Alert
        message="一键式自动化审批"
        description={
          <div>
            <p><strong>功能说明：</strong></p>
            <ul style={{ marginBottom: 0 }}>
              <li>点击"一键批准"将自动执行完整审批流程</li>
              <li>自动发起提案、投票、执行（如果达到阈值）</li>
              <li>显示详细的操作日志，便于追踪进度</li>
              <li>模仿 Node.js 脚本 <code>批准做市商完整流程.js</code> 的自动化逻辑</li>
            </ul>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* Council 信息 */}
      {councilInfo && (
        <Card
          title="Council 信息"
          size="small"
          style={{ marginBottom: 24 }}
        >
          <Descriptions column={2} size="small">
            <Descriptions.Item label="成员数">
              {councilInfo.members.length}
            </Descriptions.Item>
            <Descriptions.Item label="投票阈值">
              {councilInfo.threshold} 票（{Math.ceil(councilInfo.threshold / councilInfo.members.length * 100)}%）
            </Descriptions.Item>
            <Descriptions.Item label="当前账户">
              <Text copyable={{ text: activeAccount || '' }}>
                {activeAccount?.slice(0, 10)}...{activeAccount?.slice(-10)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="是否为成员">
              {activeAccount && councilInfo.members.includes(activeAccount) ? (
                <Tag color="green">✅ 是</Tag>
              ) : (
                <Tag color="red">❌ 否</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 待审批申请列表 */}
      <Card
        title={`待审批申请（${applications.length}）`}
        extra={
          <Button onClick={loadApplications} loading={loading}>
            刷新
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        <Table
          columns={columns}
          dataSource={applications}
          loading={loading}
          rowKey="id"
          pagination={false}
        />
      </Card>

      {/* 操作进度 */}
      {isProcessing && (
        <Card title="操作进度" style={{ marginBottom: 24 }}>
          <Progress percent={progress} status={progress === 100 ? 'success' : 'active'} />
          <Divider />
          <Steps current={currentStep - 1} size="small" style={{ marginBottom: 16 }}>
            <Step title="成员校验" />
            <Step title="发起提案" />
            <Step title="投票" />
            <Step title="检查阈值" />
            <Step title="执行提案" />
            <Step title="完成" />
          </Steps>
        </Card>
      )}

      {/* 操作日志 */}
      {operationLogs.length > 0 && (
        <Card title="操作日志">
          <List
            size="small"
            dataSource={operationLogs}
            renderItem={(log) => (
              <List.Item>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <Tag color={
                      log.status === 'success' ? 'green' :
                      log.status === 'error' ? 'red' :
                      log.status === 'running' ? 'blue' : 'default'
                    }>
                      {log.status === 'success' ? <CheckCircleOutlined /> :
                       log.status === 'error' ? <CloseCircleOutlined /> : null}
                      {log.status.toUpperCase()}
                    </Tag>
                    <Text>
                      [{log.timestamp.toLocaleTimeString()}] {log.message}
                    </Text>
                  </Space>
                  {log.detail && (
                    <Text type="secondary" style={{ fontSize: 12, paddingLeft: 60 }}>
                      {log.detail}
                    </Text>
                  )}
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
};

export default MarketMakerQuickApproval;

