import React, { useState, useEffect } from 'react';
import { Card, List, Tag, Space, Button, Typography, Spin, Empty, Tabs, message } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useWallet } from '../../providers/WalletProvider';
import { getApi } from '../../lib/polkadot-safe';

const { Title, Text, Paragraph } = Typography;

/**
 * 函数级详细中文注释：联盟治理仪表板组件
 *
 * ## 功能说明
 * - 展示即时分成比例（InstantLevelPercents）的全部治理提案
 * - 支持按状态筛选：讨论中、投票中、已通过、已拒绝
 * - 提供提案详情查看和投票入口
 *
 * ## 数据来源
 * - 从 pallet-affiliate 的 ActiveProposals 存储读取提案列表
 * - 从 ProposalVotes 读取投票统计
 * - 从 VoteTally 读取实时投票结果
 */
const AffiliateGovernanceDashboard: React.FC = () => {
  const { current } = useWallet();
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('all');

  /**
   * 函数级中文注释：从链上加载提案列表
   */
  const loadProposals = async () => {
    if (!current) {
      message.warning('请先连接钱包');
      return;
    }

    setLoading(true);
    try {
      const api = await getApi();
      const palletName = 'affiliate';

      // 读取所有活跃提案
      const entries = await (api.query as any)[palletName].activeProposals.entries();

      const proposalList = await Promise.all(
        entries.map(async ([key, proposal]: [any, any]) => {
          const proposalId = key.args[0].toNumber();

          // 读取投票统计
          let voteTally = null;
          try {
            voteTally = await (api.query as any)[palletName].voteTally(proposalId);
          } catch (e) {
            console.warn('Failed to load vote tally:', e);
          }

          return {
            proposalId,
            proposer: proposal.proposer.toString(),
            titleCid: proposal.title_cid ? proposal.title_cid.toHex() : '',
            descriptionCid: proposal.description_cid ? proposal.description_cid.toHex() : '',
            rationaleCid: proposal.rationale_cid ? proposal.rationale_cid.toHex() : '',
            newPercentages: proposal.new_percentages.map((p: any) => p.toNumber()),
            effectiveBlock: proposal.effective_block.toNumber(),
            status: proposal.status.toString(),
            isMajor: proposal.is_major.toPrimitive(),
            createdAt: proposal.created_at.toNumber(),
            votingStart: proposal.voting_start.isSome ? proposal.voting_start.unwrap().toNumber() : null,
            votingEnd: proposal.voting_end.isSome ? proposal.voting_end.unwrap().toNumber() : null,
            voteTally: voteTally ? {
              ayeVotes: voteTally.aye_votes.toString(),
              nayVotes: voteTally.nay_votes.toString(),
              abstainVotes: voteTally.abstain_votes.toString(),
              totalTurnout: voteTally.total_turnout.toString(),
            } : null,
          };
        })
      );

      setProposals(proposalList);
    } catch (error) {
      console.error('加载提案失败:', error);
      message.error('加载提案失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProposals();
  }, [current]);

  /**
   * 函数级中文注释：提案状态标签渲染
   */
  const renderStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      Discussion: { color: 'blue', icon: <ClockCircleOutlined />, text: '讨论中' },
      Voting: { color: 'orange', icon: <ClockCircleOutlined />, text: '投票中' },
      Approved: { color: 'green', icon: <CheckCircleOutlined />, text: '已通过' },
      Rejected: { color: 'red', icon: <CloseCircleOutlined />, text: '已拒绝' },
      Cancelled: { color: 'default', icon: <CloseCircleOutlined />, text: '已取消' },
      Executed: { color: 'success', icon: <CheckCircleOutlined />, text: '已执行' },
    };

    const config = statusMap[status] || statusMap.Discussion;
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  /**
   * 函数级中文注释：提案类型标签渲染
   */
  const renderProposalTypeTag = (isMajor: boolean) => {
    return isMajor ? (
      <Tag color="red">重大提案</Tag>
    ) : (
      <Tag color="blue">微调提案</Tag>
    );
  };

  /**
   * 函数级中文注释：投票进度渲染
   */
  const renderVoteProgress = (voteTally: any) => {
    if (!voteTally) return <Text type="secondary">暂无投票</Text>;

    const ayeVotes = BigInt(voteTally.ayeVotes);
    const nayVotes = BigInt(voteTally.nayVotes);
    const total = ayeVotes + nayVotes;

    if (total === BigInt(0)) return <Text type="secondary">暂无投票</Text>;

    const ayePercent = Number((ayeVotes * BigInt(100)) / total);
    const nayPercent = 100 - ayePercent;

    return (
      <Space direction="vertical" style={{ width: '100%' }} size={4}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="success">支持 {ayePercent}%</Text>
          <Text type="danger">反对 {nayPercent}%</Text>
        </div>
        <div
          style={{
            height: 8,
            background: '#f0f0f0',
            borderRadius: 4,
            overflow: 'hidden',
            display: 'flex',
          }}
        >
          <div style={{ width: `${ayePercent}%`, background: '#52c41a' }} />
          <div style={{ width: `${nayPercent}%`, background: '#ff4d4f' }} />
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          总投票权重: {voteTally.totalTurnout}
        </Text>
      </Space>
    );
  };

  /**
   * 函数级中文注释：过滤提案列表
   */
  const getFilteredProposals = () => {
    if (activeTab === 'all') return proposals;

    const tabStatusMap: Record<string, string[]> = {
      discussion: ['Discussion'],
      voting: ['Voting'],
      approved: ['Approved', 'Executed'],
      rejected: ['Rejected', 'Cancelled'],
    };

    return proposals.filter((p) => tabStatusMap[activeTab]?.includes(p.status));
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      {/* 顶部导航 */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          background: '#fff',
          zIndex: 10,
          padding: '8px 0',
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          onClick={() => window.history.back()}
          style={{ border: '1px solid #eee', padding: '6px 12px', borderRadius: 8 }}
        >
          返回
        </button>
        <Title level={4} style={{ margin: 0 }}>
          联盟治理
        </Title>
        <Button
          type="primary"
          size="small"
          onClick={() => (window.location.hash = '#/gov/affiliate/create-proposal')}
        >
          发起提案
        </Button>
      </div>

      {/* 提案说明 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Paragraph style={{ margin: 0, fontSize: 13 }}>
          <strong>联盟治理</strong>：通过全民投票机制修改即时分成比例（InstantLevelPercents）。
          所有比例调整必须通过社区投票，确保公平透明。
        </Paragraph>
      </Card>

      {/* 状态筛选标签 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'all', label: `全部 (${proposals.length})` },
          {
            key: 'discussion',
            label: `讨论中 (${proposals.filter((p) => p.status === 'Discussion').length})`,
          },
          {
            key: 'voting',
            label: `投票中 (${proposals.filter((p) => p.status === 'Voting').length})`,
          },
          {
            key: 'approved',
            label: `已通过 (${proposals.filter((p) => ['Approved', 'Executed'].includes(p.status)).length})`,
          },
          {
            key: 'rejected',
            label: `已拒绝 (${proposals.filter((p) => ['Rejected', 'Cancelled'].includes(p.status)).length})`,
          },
        ]}
        style={{ marginBottom: 16 }}
      />

      {/* 提案列表 */}
      <Spin spinning={loading}>
        {getFilteredProposals().length === 0 ? (
          <Empty description="暂无提案" />
        ) : (
          <List
            dataSource={getFilteredProposals()}
            renderItem={(proposal) => (
              <Card
                key={proposal.proposalId}
                size="small"
                style={{ marginBottom: 12 }}
                hoverable
                onClick={() =>
                  (window.location.hash = `#/gov/affiliate/proposal/${proposal.proposalId}`)
                }
              >
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {/* 提案头部 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Space>
                      <Text strong>提案 #{proposal.proposalId}</Text>
                      {renderProposalTypeTag(proposal.isMajor)}
                    </Space>
                    {renderStatusTag(proposal.status)}
                  </div>

                  {/* 提案详情 */}
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      提案人: {proposal.proposer.slice(0, 8)}...
                      {proposal.proposer.slice(-6)}
                    </Text>
                  </div>

                  {/* 新比例预览（前3层） */}
                  <div>
                    <Text style={{ fontSize: 12 }}>
                      新比例前3层: {proposal.newPercentages.slice(0, 3).join('%, ')}%
                    </Text>
                  </div>

                  {/* 投票进度 */}
                  {proposal.status === 'Voting' && renderVoteProgress(proposal.voteTally)}

                  {/* 操作按钮 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.hash = `#/gov/affiliate/proposal/${proposal.proposalId}`;
                      }}
                    >
                      查看详情
                    </Button>
                    {proposal.status === 'Voting' && (
                      <Button
                        size="small"
                        type="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.hash = `#/gov/affiliate/vote/${proposal.proposalId}`;
                        }}
                      >
                        立即投票
                      </Button>
                    )}
                  </div>
                </Space>
              </Card>
            )}
          />
        )}
      </Spin>
    </div>
  );
};

export default AffiliateGovernanceDashboard;
