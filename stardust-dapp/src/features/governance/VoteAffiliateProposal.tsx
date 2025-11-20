import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Radio,
  Button,
  Space,
  Typography,
  Alert,
  message,
  Spin,
  Descriptions,
  Row,
  Col,
  Divider,
  Progress,
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { useWallet } from '../../providers/WalletProvider';
import { getApi, signAndSendLocalWithPassword } from '../../lib/polkadot-safe';

const { Title, Text, Paragraph } = Typography;

/**
 * 函数级详细中文注释：联盟治理提案投票组件
 *
 * ## 功能说明
 * - 对即时分成比例（InstantLevelPercents）调整提案进行投票
 * - 支持三种投票选项：支持（Aye）、反对（Nay）、弃权（Abstain）
 * - 支持信念投票（Conviction）：锁定时长换取权重倍数
 * - 显示提案详情、当前投票统计和个人投票权重
 * - 调用 pallet-affiliate::vote_on_percentage_proposal
 *
 * ## 投票权重计算
 * - 持币权重（70%）：平方根，上限1000
 * - 参与权重（20%）：历史投票次数
 * - 贡献权重（10%）：推荐贡献 + 委员会成员
 * - 信念投票倍数：1x ~ 6x（锁定时长）
 */
const VoteAffiliateProposal: React.FC = () => {
  const { proposalId } = useParams<{ proposalId: string }>();
  const { current, askPassword } = useWallet();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<any>(null);
  const [voteTally, setVoteTally] = useState<any>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [votingPower, setVotingPower] = useState<string>('0');

  /**
   * 函数级中文注释：加载提案详情
   */
  const loadProposal = async () => {
    if (!proposalId) return;

    setLoading(true);
    try {
      const api = await getApi();
      const palletName = 'affiliate';

      // 读取提案
      const proposalData = await (api.query as any)[palletName].activeProposals(proposalId);

      if (!proposalData.isSome) {
        message.error('提案不存在');
        return;
      }

      const p = proposalData.unwrap();

      setProposal({
        proposalId: Number(proposalId),
        proposer: p.proposer.toString(),
        titleCid: p.title_cid ? p.title_cid.toHex() : '',
        descriptionCid: p.description_cid ? p.description_cid.toHex() : '',
        rationaleCid: p.rationale_cid ? p.rationale_cid.toHex() : '',
        newPercentages: p.new_percentages.map((v: any) => v.toNumber()),
        effectiveBlock: p.effective_block.toNumber(),
        status: p.status.toString(),
        isMajor: p.is_major.toPrimitive(),
        createdAt: p.created_at.toNumber(),
        votingStart: p.voting_start.isSome ? p.voting_start.unwrap().toNumber() : null,
        votingEnd: p.voting_end.isSome ? p.voting_end.unwrap().toNumber() : null,
      });

      // 读取投票统计
      const tally = await (api.query as any)[palletName].voteTally(proposalId);
      setVoteTally({
        ayeVotes: tally.aye_votes.toString(),
        nayVotes: tally.nay_votes.toString(),
        abstainVotes: tally.abstain_votes.toString(),
        totalTurnout: tally.total_turnout.toString(),
      });

      // 检查是否已投票
      if (current) {
        const voteRecord = await (api.query as any)[palletName].proposalVotes(proposalId, current);
        setHasVoted(voteRecord.isSome);
      }
    } catch (error) {
      console.error('加载提案失败:', error);
      message.error('加载提案失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 函数级中文注释：计算投票权重
   */
  const calculateVotingPower = async () => {
    if (!current) return;

    try {
      const api = await getApi();
      const balance = await api.query.system.account(current);
      const freeBalance = balance.data.free.toString();

      // 简化计算：使用余额的平方根
      const balanceBigInt = BigInt(freeBalance);
      const sqrt = Math.floor(Math.sqrt(Number(balanceBigInt / BigInt(1e12)))); // 转换为 DUST
      const power = Math.min(sqrt, 1000); // 上限1000

      setVotingPower(power.toString());
    } catch (error) {
      console.error('计算投票权重失败:', error);
    }
  };

  useEffect(() => {
    loadProposal();
    calculateVotingPower();
  }, [proposalId, current]);

  /**
   * 函数级中文注释：提交投票
   */
  const onFinish = async (values: any) => {
    if (!current) {
      message.error('请先连接钱包');
      return;
    }

    if (hasVoted) {
      message.error('您已经对此提案投过票');
      return;
    }

    setLoading(true);

    try {
      const password = await askPassword();
      if (!password) {
        setLoading(false);
        return;
      }

      const api = await getApi();
      const palletName = 'affiliate';

      // 投票类型：0=Aye, 1=Nay, 2=Abstain
      const voteType = values.vote;

      // 信念投票：0=None, 1=Locked1x, ..., 6=Locked6x
      const convictionType = values.conviction || 0;

      // 调用链上方法
      const result = await signAndSendLocalWithPassword(
        palletName,
        'voteOnPercentageProposal',
        [Number(proposalId), voteType, convictionType],
        password
      );

      message.success('投票成功！');
      console.log('投票结果:', result);

      // 重新加载数据
      setTimeout(() => {
        loadProposal();
      }, 1500);
    } catch (error: any) {
      console.error('投票失败:', error);
      message.error(`投票失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 函数级中文注释：渲染投票进度
   */
  const renderVoteProgress = () => {
    if (!voteTally) return null;

    const ayeVotes = BigInt(voteTally.ayeVotes);
    const nayVotes = BigInt(voteTally.nayVotes);
    const total = ayeVotes + nayVotes;

    if (total === BigInt(0)) {
      return (
        <Alert type="info" message="暂无投票数据" style={{ marginBottom: 16 }} />
      );
    }

    const ayePercent = Number((ayeVotes * BigInt(100)) / total);
    const nayPercent = 100 - ayePercent;

    return (
      <Card size="small" title="实时投票统计" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div>
            <Text type="success" strong>
              支持: {ayePercent}%
            </Text>
            <Progress
              percent={ayePercent}
              strokeColor="#52c41a"
              showInfo={false}
              style={{ marginTop: 4 }}
            />
          </div>
          <div>
            <Text type="danger" strong>
              反对: {nayPercent}%
            </Text>
            <Progress
              percent={nayPercent}
              strokeColor="#ff4d4f"
              showInfo={false}
              style={{ marginTop: 4 }}
            />
          </div>
          <Divider style={{ margin: 0 }} />
          <Row gutter={16}>
            <Col span={8}>
              <Text type="secondary">支持票</Text>
              <br />
              <Text strong>{voteTally.ayeVotes}</Text>
            </Col>
            <Col span={8}>
              <Text type="secondary">反对票</Text>
              <br />
              <Text strong>{voteTally.nayVotes}</Text>
            </Col>
            <Col span={8}>
              <Text type="secondary">弃权票</Text>
              <br />
              <Text strong>{voteTally.abstainVotes}</Text>
            </Col>
          </Row>
        </Space>
      </Card>
    );
  };

  if (loading && !proposal) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
        <Alert type="error" message="提案不存在" />
      </div>
    );
  }

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
        }}
      >
        <button
          onClick={() => window.history.back()}
          style={{ border: '1px solid #eee', padding: '6px 12px', borderRadius: 8 }}
        >
          返回
        </button>
      </div>

      <Title level={3}>提案投票 #{proposal.proposalId}</Title>

      {/* 提案状态提示 */}
      {proposal.status !== 'Voting' && (
        <Alert
          type="warning"
          message="提案当前不在投票期"
          description={`提案状态: ${proposal.status}`}
          style={{ marginBottom: 16 }}
        />
      )}

      {hasVoted && (
        <Alert
          type="info"
          message="您已对此提案投票"
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 提案详情 */}
      <Card size="small" title="提案信息" style={{ marginBottom: 16 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="提案类型">
            {proposal.isMajor ? '🔴 重大提案' : '🔵 微调提案'}
          </Descriptions.Item>
          <Descriptions.Item label="提案人">
            {proposal.proposer.slice(0, 10)}...{proposal.proposer.slice(-8)}
          </Descriptions.Item>
          <Descriptions.Item label="生效区块">{proposal.effectiveBlock}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 新比例展示 */}
      <Card size="small" title="新分成比例" style={{ marginBottom: 16 }}>
        <Row gutter={[8, 8]}>
          {proposal.newPercentages.map((p: number, idx: number) => (
            <Col span={8} key={idx}>
              <Text>
                L{idx + 1}: <Text strong>{p}%</Text>
              </Text>
            </Col>
          ))}
        </Row>
        <Divider style={{ margin: '12px 0' }} />
        <Text type="secondary">
          总和: <Text strong>{proposal.newPercentages.reduce((s: number, p: number) => s + p, 0)}%</Text>
        </Text>
      </Card>

      {/* 投票统计 */}
      {renderVoteProgress()}

      {/* 投票表单 */}
      {proposal.status === 'Voting' && !hasVoted && (
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ vote: 0, conviction: 0 }}>
          <Card size="small" title="您的投票" style={{ marginBottom: 16 }}>
            {/* 投票选项 */}
            <Form.Item
              name="vote"
              label="投票选项"
              rules={[{ required: true, message: '请选择投票选项' }]}
            >
              <Radio.Group style={{ width: '100%' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Radio value={0}>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} /> 支持（Aye）
                  </Radio>
                  <Radio value={1}>
                    <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> 反对（Nay）
                  </Radio>
                  <Radio value={2}>
                    <MinusCircleOutlined style={{ color: '#faad14' }} /> 弃权（Abstain）
                  </Radio>
                </Space>
              </Radio.Group>
            </Form.Item>

            {/* 信念投票 */}
            <Form.Item
              name="conviction"
              label="信念投票（锁定时长换取权重倍数）"
              extra="锁定代币越久，投票权重越大"
            >
              <Radio.Group style={{ width: '100%' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Radio value={0}>不锁定（1x 权重）</Radio>
                  <Radio value={1}>锁定 1 周（1.5x 权重）</Radio>
                  <Radio value={2}>锁定 2 周（2x 权重）</Radio>
                  <Radio value={3}>锁定 4 周（3x 权重）</Radio>
                  <Radio value={4}>锁定 8 周（4x 权重）</Radio>
                  <Radio value={5}>锁定 16 周（5x 权重）</Radio>
                  <Radio value={6}>锁定 32 周（6x 权重）</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>

            {/* 投票权重提示 */}
            <Alert
              type="info"
              message={`您的基础投票权重: ${votingPower}`}
              description="实际权重 = 基础权重 × 信念投票倍数"
              style={{ marginTop: 8 }}
            />
          </Card>

          {/* 提交按钮 */}
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading} size="large">
              提交投票
            </Button>
          </Form.Item>
        </Form>
      )}
    </div>
  );
};

export default VoteAffiliateProposal;
