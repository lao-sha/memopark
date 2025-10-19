import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Modal, 
  InputNumber, 
  message, 
  Descriptions, 
  Tag, 
  Space,
  Tabs,
  Typography,
  Alert,
  Divider,
  List
} from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  FileTextOutlined,
  TeamOutlined 
} from '@ant-design/icons';
import { useWallet } from '@/contexts/Wallet';
import { useApi } from '@/contexts/Api';
import { signAndSend } from '@/services/wallet/signer';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

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
}

interface Proposal {
  hash: string;
  index: number;
  proposer: string;
  threshold: number;
  ayes: string[];
  nays: string[];
  end: number;
  deposit: string;
  callData: any;
  description: string;
}

/**
 * 做市商治理审批页面
 * 实现委员会投票审批流程（生产环境）
 */
const MarketMakerGovernance: React.FC = () => {
  const { api } = useApi();
  const { activeAccount, accounts } = useWallet();
  const [applications, setApplications] = useState<Application[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 提案相关状态
  const [proposeModalVisible, setProposeModalVisible] = useState(false);
  const [voteModalVisible, setVoteModalVisible] = useState(false);
  const [closeModalVisible, setCloseModalVisible] = useState(false);
  
  // 操作参数
  const [selectedMmId, setSelectedMmId] = useState<number | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [slashBps, setSlashBps] = useState(200); // 驳回惩罚比例，默认2%
  
  // 投票参数
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [voteApprove, setVoteApprove] = useState(true);

  /**
   * 加载待审批的做市商申请
   */
  const loadApplications = async () => {
    if (!api) return;
    
    setLoading(true);
    try {
      const entries = await api.query.marketMaker.applications.entries();
      const apps = entries
        .map(([key, value]: any) => {
          const id = key.args[0].toNumber();
          const app = value.toJSON() as any;
          return {
            id,
            owner: app.owner,
            deposit: app.deposit,
            status: app.status,
            epayGateway: app.epayGateway || '',
            epayPort: app.epayPort || 0,
            epayPid: app.epayPid || '',
            epayKey: app.epayKey || '',
            reviewDeadline: app.reviewDeadline || 0,
          };
        })
        .filter((app: Application) => app.status === 'PendingReview');
      
      setApplications(apps);
    } catch (error) {
      console.error('加载申请失败:', error);
      message.error('加载申请失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载委员会提案列表
   */
  const loadProposals = async () => {
    if (!api) return;
    
    setLoading(true);
    try {
      // 获取提案哈希列表
      const proposalHashes = await api.query.council.proposals();
      const proposalList: Proposal[] = [];

      for (const hash of proposalHashes.toJSON() as string[]) {
        // 获取提案详情
        const proposalOpt = await api.query.council.proposalOf(hash);
        const voting = await api.query.council.voting(hash);
        
        if (proposalOpt.isSome && voting.isSome) {
          const proposal = proposalOpt.unwrap();
          const votingInfo = voting.unwrap().toJSON() as any;
          
          // 解析调用数据
          let description = '未知操作';
          let mmId = null;
          
          try {
            const call = proposal.toJSON() as any;
            if (call.marketMaker) {
              if (call.marketMaker.approve !== undefined) {
                mmId = call.marketMaker.approve;
                description = `批准做市商 #${mmId}`;
              } else if (call.marketMaker.reject !== undefined) {
                const [id, slash] = call.marketMaker.reject;
                mmId = id;
                description = `驳回做市商 #${id}（惩罚 ${slash / 100}%）`;
              }
            }
          } catch (e) {
            console.error('解析提案失败:', e);
          }

          proposalList.push({
            hash: hash.toString(),
            index: votingInfo.index || 0,
            proposer: votingInfo.proposer || '',
            threshold: votingInfo.threshold || 0,
            ayes: votingInfo.ayes || [],
            nays: votingInfo.nays || [],
            end: votingInfo.end || 0,
            deposit: votingInfo.deposit || '0',
            callData: proposal.toJSON(),
            description,
          });
        }
      }

      setProposals(proposalList);
    } catch (error) {
      console.error('加载提案失败:', error);
      message.error('加载提案失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (api) {
      loadApplications();
      loadProposals();
    }
  }, [api]);

  /**
   * 步骤1：委员会成员发起提案（动态阈值 + 成员资格校验）
   * - 先校验签名账户是否为委员会成员（非成员直接拦截，避免链端校验触发 panic）
   * - 根据当前委员会成员数量，动态计算阈值 threshold = ceil(2/3 * memberCount)，并保证 1 <= threshold <= memberCount
   * - 构造 council.propose(threshold, innerCall, lengthBound) 进行提案
   */
  const handlePropose = async () => {
    if (!api || !activeAccount || selectedMmId === null) {
      message.error('请先连接钱包并选择申请');
      return;
    }
    
    setLoading(true);
    try {
      // 🔧 参数类型转换和验证
      const mmIdNum = Number(selectedMmId)
      if (!Number.isInteger(mmIdNum) || mmIdNum < 0) {
        throw new Error(`申请编号无效: ${selectedMmId}`)
      }
      
      let slashBpsNum = 0
      if (actionType === 'reject') {
        slashBpsNum = Number(slashBps)
        if (!Number.isInteger(slashBpsNum) || slashBpsNum < 0 || slashBpsNum > 10000) {
          throw new Error(`扣罚比例无效: ${slashBps}，必须在 0-10000 范围内`)
        }
      }

      // ✅ 成员资格校验：非委员会成员直接拦截
      const membersOpt: any = await api.query.council.members();
      const members: string[] = (membersOpt?.toJSON?.() as any[])?.map((m: any) => m.toString()) || [];
      const isMember = members.includes(activeAccount);
      if (!isMember) {
        throw new Error('您不是委员会成员，无权提交提案');
      }
      const memberCount = members.length;
      if (memberCount <= 0) {
        throw new Error('委员会成员列表为空，请初始化委员会成员后再试');
      }
      
      // 🔍 调试日志：打印参数
      console.group('📤 [发起提案] 参数详情')
      console.log('提案类型:', actionType)
      console.log('mmId:', mmIdNum, '(u64)')
      console.log('委员会成员数:', memberCount)
      if (actionType === 'reject') {
        console.log('扣罚比例:', slashBpsNum, 'bps (u16)')
      }
      console.groupEnd()
      
      // 构建内部调用
      let innerCall;
      if (actionType === 'approve') {
        innerCall = api.tx.marketMaker.approve(mmIdNum);
      } else {
        innerCall = api.tx.marketMaker.reject(mmIdNum, slashBpsNum);
      }

      // ✅ 动态计算投票阈值：ceil(2/3 * 成员数)，并确保在 [1, 成员数] 范围内
      const threshold = Math.max(1, Math.min(memberCount, Math.ceil(memberCount * 2 / 3)));
      
      // 提案长度上限
      const lengthBound = innerCall.encodedLength;

      // 发起提案
      const tx = api.tx.council.propose(threshold, innerCall, lengthBound);

      await signAndSend(activeAccount, tx, {
        onSuccess: (blockHash) => {
          message.success(`提案已提交！区块哈希: ${blockHash.slice(0, 10)}...`);
          setProposeModalVisible(false);
          loadProposals();
          
          // 刷新申请列表
          setTimeout(() => {
            loadApplications();
          }, 2000);
        },
        onError: (error) => {
          console.error('发起提案失败:', error);
          message.error(`发起提案失败: ${error.message}`);
        }
      });
    } catch (error: any) {
      console.error('发起提案失败:', error);
      message.error(`发起提案失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 步骤2：委员会成员投票
   */
  const handleVote = async () => {
    if (!api || !activeAccount || !selectedProposal) {
      message.error('请先连接钱包并选择提案');
      return;
    }
    
    setLoading(true);
    try {
      const tx = api.tx.council.vote(
        selectedProposal.hash,
        selectedProposal.index,
        voteApprove
      );

      await signAndSend(activeAccount, tx, {
        onSuccess: () => {
          message.success(`投票成功！投票: ${voteApprove ? '赞成' : '反对'}`);
          setVoteModalVisible(false);
          loadProposals();
        },
        onError: (error) => {
          console.error('投票失败:', error);
          message.error(`投票失败: ${error.message}`);
        }
      });
    } catch (error: any) {
      console.error('投票失败:', error);
      message.error(`投票失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 步骤3：关闭提案并执行
   */
  const handleCloseProposal = async () => {
    if (!api || !activeAccount || !selectedProposal) {
      message.error('请先连接钱包并选择提案');
      return;
    }
    
    setLoading(true);
    try {
      // 预估权重上限
      const proposalWeightBound = {
        refTime: 1000000000,
        proofSize: 64 * 1024,
      };
      
      // 提案长度
      const lengthBound = 1000;

      const tx = api.tx.council.close(
        selectedProposal.hash,
        selectedProposal.index,
        proposalWeightBound,
        lengthBound
      );

      await signAndSend(activeAccount, tx, {
        onSuccess: () => {
          message.success('提案已关闭并执行！');
          setCloseModalVisible(false);
          loadProposals();
          loadApplications();
        },
        onError: (error) => {
          console.error('关闭提案失败:', error);
          message.error(`关闭提案失败: ${error.message}`);
        }
      });
    } catch (error: any) {
      console.error('关闭提案失败:', error);
      message.error(`关闭提案失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 待审批申请表格列
  const applicationColumns = [
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
      title: 'Epay网关',
      dataIndex: 'epayGateway',
      key: 'epayGateway',
      width: 200,
      render: (val: string, record: Application) => {
        if (val) {
          return (
            <Space direction="vertical" size={0}>
              <Text style={{ fontSize: 12 }} ellipsis>
                {val}:{record.epayPort}
              </Text>
              <Tag color="green" style={{ marginTop: 2 }}>已配置</Tag>
            </Space>
          )
        }
        return <Tag color="red">未配置</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color="orange">{status}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (record: Application) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => {
              setSelectedMmId(record.id);
              setSelectedApplication(record);
              setActionType('approve');
              setProposeModalVisible(true);
            }}
          >
            批准提案
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseCircleOutlined />}
            onClick={() => {
              setSelectedMmId(record.id);
              setSelectedApplication(record);
              setActionType('reject');
              setProposeModalVisible(true);
            }}
          >
            驳回提案
          </Button>
        </Space>
      ),
    },
  ];

  // 提案表格列
  const proposalColumns = [
    {
      title: '提案',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => (
        <Space>
          <FileTextOutlined />
          <Text strong>{desc}</Text>
        </Space>
      ),
    },
    {
      title: '发起人',
      dataIndex: 'proposer',
      key: 'proposer',
      render: (addr: string) => (
        <Text copyable={{ text: addr }}>
          {addr.slice(0, 6)}...{addr.slice(-6)}
        </Text>
      ),
    },
    {
      title: '投票情况',
      key: 'votes',
      render: (record: Proposal) => (
        <Space>
          <Tag color="green">赞成: {record.ayes.length}</Tag>
          <Tag color="red">反对: {record.nays.length}</Tag>
          <Tag color="blue">阈值: {record.threshold}</Tag>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (record: Proposal) => {
        const canClose = record.ayes.length >= record.threshold;
        return (
          <Space>
            <Button
              type="default"
              size="small"
              onClick={() => {
                setSelectedProposal(record);
                setVoteApprove(true);
                setVoteModalVisible(true);
              }}
            >
              投赞成票
            </Button>
            <Button
              size="small"
              onClick={() => {
                setSelectedProposal(record);
                setVoteApprove(false);
                setVoteModalVisible(true);
              }}
            >
              投反对票
            </Button>
            <Button
              type="primary"
              size="small"
              disabled={!canClose}
              onClick={() => {
                setSelectedProposal(record);
                setCloseModalVisible(true);
              }}
            >
              关闭提案
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <TeamOutlined /> 做市商治理审批（委员会流程）
      </Title>
      
      <Alert
        message="生产环境审批流程"
        description={
          <div>
            <p><strong>委员会投票审批流程：</strong></p>
            <ol style={{ marginBottom: 0 }}>
              <li>委员会成员在"待审批申请"中点击"批准提案"或"驳回提案"，发起提案</li>
              <li>其他委员会成员在"进行中的提案"中对提案投票（需达到2/3阈值）</li>
              <li>达到阈值后，任何人可以点击"关闭提案"执行审批操作</li>
            </ol>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Tabs defaultActiveKey="applications">
        <TabPane tab="待审批申请" key="applications">
          <Card 
            title={`待审批申请（${applications.length}）`}
            extra={
              <Button onClick={loadApplications} loading={loading}>
                刷新
              </Button>
            }
          >
            <Table
              columns={applicationColumns}
              dataSource={applications}
              loading={loading}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </TabPane>

        <TabPane tab="进行中的提案" key="proposals">
          <Card 
            title={`进行中的提案（${proposals.length}）`}
            extra={
              <Button onClick={loadProposals} loading={loading}>
                刷新
              </Button>
            }
          >
            <Table
              columns={proposalColumns}
              dataSource={proposals}
              loading={loading}
              rowKey="hash"
              pagination={false}
              expandable={{
                expandedRowRender: (record) => (
                  <div style={{ padding: '16px', background: '#fafafa' }}>
                    <Descriptions column={2} size="small">
                      <Descriptions.Item label="提案哈希">
                        <Text copyable={{ text: record.hash }}>{record.hash.slice(0, 20)}...</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="提案索引">{record.index}</Descriptions.Item>
                      <Descriptions.Item label="投票阈值">{record.threshold}</Descriptions.Item>
                      <Descriptions.Item label="当前赞成票">{record.ayes.length}</Descriptions.Item>
                    </Descriptions>
                    <Divider />
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text strong>赞成票账户：</Text>
                      <List
                        size="small"
                        bordered
                        dataSource={record.ayes}
                        renderItem={(addr: string) => (
                          <List.Item>
                            <Text copyable={{ text: addr }}>{addr}</Text>
                          </List.Item>
                        )}
                      />
                    </Space>
                  </div>
                ),
              }}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* 发起提案对话框 */}
      <Modal
        title={`发起${actionType === 'approve' ? '批准' : '驳回'}提案`}
        open={proposeModalVisible}
        onOk={handlePropose}
        onCancel={() => setProposeModalVisible(false)}
        confirmLoading={loading}
        okText="提交提案"
        cancelText="取消"
        width={600}
      >
        {selectedApplication && (
          <>
            <Alert
              message="提案流程说明"
              description="提交后将进入委员会投票流程，需要达到2/3多数票（2票）才能执行。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Descriptions column={1} bordered>
              <Descriptions.Item label="做市商 ID">{selectedMmId}</Descriptions.Item>
              <Descriptions.Item label="申请人">
                <Text copyable={{ text: selectedApplication.owner }}>
                  {selectedApplication.owner}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="押金">
                {(BigInt(selectedApplication.deposit) / BigInt(1e12)).toString()} MEMO
              </Descriptions.Item>
              <Descriptions.Item label="操作类型">
                {actionType === 'approve' ? (
                  <Tag color="green">批准申请</Tag>
                ) : (
                  <Tag color="red">驳回申请</Tag>
                )}
              </Descriptions.Item>
              
              {actionType === 'reject' && (
                <Descriptions.Item label="惩罚比例">
                  <Space>
                    <InputNumber
                      min={0}
                      max={10000}
                      value={slashBps}
                      onChange={(val) => setSlashBps(val || 0)}
                      addonAfter="bps"
                    />
                    <Text type="secondary">
                      （当前: {slashBps / 100}%，范围: 0-100%）
                    </Text>
                  </Space>
                </Descriptions.Item>
              )}
              
              <Descriptions.Item label="投票阈值">2 票（2/3 多数）</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>

      {/* 投票对话框 */}
      <Modal
        title="对提案投票"
        open={voteModalVisible}
        onOk={handleVote}
        onCancel={() => setVoteModalVisible(false)}
        confirmLoading={loading}
        okText="确认投票"
        cancelText="取消"
      >
        {selectedProposal && (
          <>
            <Alert
              message="投票说明"
              description="委员会成员可以对提案投赞成票或反对票。达到阈值后即可关闭提案并执行。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Descriptions column={1} bordered>
              <Descriptions.Item label="提案内容">
                <Text strong>{selectedProposal.description}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="发起人">
                <Text copyable={{ text: selectedProposal.proposer }}>
                  {selectedProposal.proposer.slice(0, 10)}...{selectedProposal.proposer.slice(-10)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="当前投票">
                <Space>
                  <Tag color="green">赞成: {selectedProposal.ayes.length}</Tag>
                  <Tag color="red">反对: {selectedProposal.nays.length}</Tag>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="投票阈值">{selectedProposal.threshold} 票</Descriptions.Item>
              <Descriptions.Item label="您的投票">
                <Space>
                  <Button
                    type={voteApprove ? 'primary' : 'default'}
                    onClick={() => setVoteApprove(true)}
                  >
                    赞成
                  </Button>
                  <Button
                    type={!voteApprove ? 'primary' : 'default'}
                    onClick={() => setVoteApprove(false)}
                  >
                    反对
                  </Button>
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>

      {/* 关闭提案对话框 */}
      <Modal
        title="关闭提案并执行"
        open={closeModalVisible}
        onOk={handleCloseProposal}
        onCancel={() => setCloseModalVisible(false)}
        confirmLoading={loading}
        okText="关闭并执行"
        cancelText="取消"
      >
        {selectedProposal && (
          <>
            <Alert
              message="执行说明"
              description="提案已达到投票阈值，关闭后将自动执行批准或驳回操作。"
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Descriptions column={1} bordered>
              <Descriptions.Item label="提案内容">
                <Text strong>{selectedProposal.description}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="投票结果">
                <Space>
                  <Tag color="green">赞成: {selectedProposal.ayes.length}</Tag>
                  <Tag color="red">反对: {selectedProposal.nays.length}</Tag>
                  <Tag color="blue">阈值: {selectedProposal.threshold}</Tag>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="执行状态">
                {selectedProposal.ayes.length >= selectedProposal.threshold ? (
                  <Tag color="success">已达到阈值，可以执行</Tag>
                ) : (
                  <Tag color="warning">未达到阈值，暂时无法执行</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>
    </div>
  );
};

export default MarketMakerGovernance;

