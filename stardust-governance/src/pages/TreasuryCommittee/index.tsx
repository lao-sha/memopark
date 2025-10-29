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
  List,
  Statistic,
  Row,
  Col
} from 'antd';
import { 
  DollarOutlined,
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useWallet } from '@/contexts/Wallet';
import { useApi } from '@/contexts/Api';
import { signAndSend } from '@/services/wallet/signer';

const { Title, Text, Paragraph } = Typography;

interface Member {
  address: string;
  name?: string;
}

interface Proposal {
  hash: string;
  index: number;
  proposer: string;
  threshold: number;
  ayes: string[];
  nays: string[];
  end: number;
  description: string;
  callData: any;
}

/**
 * 财务委员会管理页面
 * 管理 Instance2 (TechnicalCommittee) - 用作财务委员会
 */
const TreasuryCommittee: React.FC = () => {
  const { api } = useApi();
  const { activeAccount, accounts } = useWallet();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 投票相关状态
  const [voteModalVisible, setVoteModalVisible] = useState(false);
  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [voteApprove, setVoteApprove] = useState(true);
  
  // 统计数据
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeProposals: 0,
    isUserMember: false
  });

  /**
   * 加载财务委员会成员
   */
  const loadMembers = async () => {
    if (!api) return;
    
    setLoading(true);
    try {
      const memberList = await api.query.technicalCommittee.members();
      const membersData = memberList.map((addr: any) => ({
        address: addr.toString(),
        name: getAccountName(addr.toString())
      }));
      
      setMembers(membersData);
      
      // 更新统计
      setStats(prev => ({
        ...prev,
        totalMembers: membersData.length,
        isUserMember: activeAccount ? membersData.some(m => m.address === activeAccount) : false
      }));
    } catch (error) {
      console.error('加载成员失败:', error);
      message.error('加载成员失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载提案列表
   */
  const loadProposals = async () => {
    if (!api) return;
    
    setLoading(true);
    try {
      const proposalHashes = await api.query.technicalCommittee.proposals();
      const proposalList: Proposal[] = [];

      for (const hash of proposalHashes.toJSON() as string[]) {
        const proposalOpt = await api.query.technicalCommittee.proposalOf(hash);
        const voting = await api.query.technicalCommittee.voting(hash);
        
        if (proposalOpt.isSome && voting.isSome) {
          const proposal = proposalOpt.unwrap();
          const votingInfo = voting.unwrap().toJSON() as any;
          
          let description = '财务提案';
          try {
            const call = proposal.toJSON() as any;
            if (call.treasury) {
              if (call.treasury.approveProposal !== undefined) {
                description = `批准财务提案 #${call.treasury.approveProposal}`;
              } else if (call.treasury.rejectProposal !== undefined) {
                description = `驳回财务提案 #${call.treasury.rejectProposal}`;
              }
            } else if (call.system?.remark) {
              description = `备注: ${call.system.remark}`;
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
            callData: proposal.toJSON(),
            description,
          });
        }
      }

      setProposals(proposalList);
      setStats(prev => ({
        ...prev,
        activeProposals: proposalList.length
      }));
    } catch (error) {
      console.error('加载提案失败:', error);
      message.error('加载提案失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取账户名称
   */
  const getAccountName = (address: string): string | undefined => {
    const account = accounts.find(acc => acc.address === address);
    return account?.meta.name as string | undefined;
  };

  useEffect(() => {
    if (api) {
      loadMembers();
      loadProposals();
    }
  }, [api, activeAccount]);

  /**
   * 投票
   */
  const handleVote = async () => {
    if (!api || !activeAccount || !selectedProposal) {
      message.error('请先连接钱包并选择提案');
      return;
    }

    setLoading(true);
    try {
      const tx = api.tx.technicalCommittee.vote(
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
   * 关闭提案并执行
   */
  const handleCloseProposal = async () => {
    if (!api || !activeAccount || !selectedProposal) {
      message.error('请先连接钱包并选择提案');
      return;
    }

    setLoading(true);
    try {
      const proposalWeightBound = {
        refTime: 1000000000,
        proofSize: 64 * 1024,
      };
      
      const lengthBound = 1000;

      const tx = api.tx.technicalCommittee.close(
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

  // 成员表格列
  const memberColumns = [
    {
      title: '成员账户',
      dataIndex: 'address',
      key: 'address',
      render: (addr: string, record: Member) => (
        <Space>
          <Text copyable={{ text: addr }}>
            {addr.slice(0, 8)}...{addr.slice(-8)}
          </Text>
          {record.name && <Tag color="blue">{record.name}</Tag>}
          {addr === activeAccount && <Tag color="green">当前账户</Tag>}
        </Space>
      ),
    },
    {
      title: '角色',
      key: 'role',
      render: () => <Tag color="purple">财务委员会成员</Tag>,
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
              赞成
            </Button>
            <Button
              size="small"
              onClick={() => {
                setSelectedProposal(record);
                setVoteApprove(false);
                setVoteModalVisible(true);
              }}
            >
              反对
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
              关闭
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <DollarOutlined /> 财务委员会管理
      </Title>
      
      <Paragraph>
        财务委员会负责审批国库支出提案、管理项目财务等重要财务治理事务。
      </Paragraph>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="委员会成员"
              value={stats.totalMembers}
              prefix={<TeamOutlined />}
              suffix="人"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="进行中的提案"
              value={stats.activeProposals}
              prefix={<FileTextOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="您的状态"
              value={stats.isUserMember ? '是成员' : '非成员'}
              valueStyle={{ color: stats.isUserMember ? '#3f8600' : '#999' }}
              prefix={stats.isUserMember ? <CheckCircleOutlined /> : <InfoCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {!stats.isUserMember && activeAccount && (
        <Alert
          message="提示"
          description="您当前不是财务委员会成员，无法发起提案或投票。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Tabs defaultActiveKey="members">
        <Tabs.TabPane tab="委员会成员" key="members">
          <Card 
            title={`财务委员会成员（${members.length}）`}
            extra={
              <Button onClick={loadMembers} loading={loading}>
                刷新
              </Button>
            }
          >
            <Table
              columns={memberColumns}
              dataSource={members}
              loading={loading}
              rowKey="address"
              pagination={false}
            />
          </Card>
        </Tabs.TabPane>

        <Tabs.TabPane tab="进行中的提案" key="proposals">
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
        </Tabs.TabPane>
      </Tabs>

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
              description="财务委员会成员可以对提案投赞成票或反对票。达到阈值后即可关闭提案并执行。"
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
                    icon={<CheckCircleOutlined />}
                    onClick={() => setVoteApprove(true)}
                  >
                    赞成
                  </Button>
                  <Button
                    type={!voteApprove ? 'primary' : 'default'}
                    icon={<CloseCircleOutlined />}
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
              description="提案已达到投票阈值，关闭后将自动执行财务操作。"
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

export default TreasuryCommittee;

