/**
 * 悬赏详情页面
 *
 * 展示悬赏问题详情、回答列表、支持投票和采纳操作
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Typography,
  Tag,
  Space,
  Spin,
  Empty,
  List,
  Avatar,
  message,
  Divider,
  Row,
  Col,
  Progress,
  Modal,
  Badge,
} from 'antd';
import {
  UserOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  FireOutlined,
  LikeOutlined,
  CheckCircleOutlined,
  GiftOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type {
  BountyQuestion,
  BountyAnswer,
} from '../../types/divination';
import {
  DIVINATION_TYPE_NAMES,
  DIVINATION_TYPE_ICONS,
  PROVIDER_TIER_NAMES,
  PROVIDER_TIER_COLORS,
  formatBountyAmount,
  formatBountyStatusTag,
  getBountyTimeRemaining,
  canSubmitAnswer,
  canCloseBounty,
  canAdoptAnswers,
  BOUNTY_ANSWER_STATUS_NAMES,
  BOUNTY_ANSWER_STATUS_COLORS,
} from '../../types/divination';
import { BountyService } from '../../services/bountyService';
import { SubmitAnswerModal } from './components/SubmitAnswerModal';
import './BountyDetailPage.css';

const { Title, Text, Paragraph } = Typography;

/**
 * 回答卡片组件
 */
const AnswerCard: React.FC<{
  answer: BountyAnswer;
  bounty: BountyQuestion;
  canVote: boolean;
  hasVoted: boolean;
  onVote: () => void;
  isWinner: boolean;
  rank?: number;
}> = ({ answer, bounty, canVote, hasVoted, onVote, isWinner, rank }) => {
  const statusColor = BOUNTY_ANSWER_STATUS_COLORS[answer.status];

  return (
    <Card
      className={`answer-card ${isWinner ? 'winner-card' : ''}`}
      size="small"
    >
      {/* 回答者信息 */}
      <div className="answer-header">
        <Space>
          <Avatar
            size={40}
            icon={<UserOutlined />}
            style={{
              backgroundColor: answer.isCertified ? '#52c41a' : '#8c8c8c',
            }}
          />
          <div>
            <div>
              <Text strong>{answer.answerer.substring(0, 8)}...</Text>
              {answer.isCertified && answer.providerTier !== undefined && (
                <Tag
                  color={PROVIDER_TIER_COLORS[answer.providerTier]}
                  style={{ marginLeft: 8 }}
                >
                  {PROVIDER_TIER_NAMES[answer.providerTier]}
                </Tag>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              提交于 #{answer.submittedAt}
            </Text>
          </div>
        </Space>

        {/* 状态标签 */}
        <div>
          {isWinner && rank !== undefined && (
            <Tag
              color={rank === 1 ? 'gold' : rank === 2 ? 'blue' : 'purple'}
              style={{ fontSize: 14 }}
            >
              {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'} {rank === 1 ? '第一名' : rank === 2 ? '第二名' : '第三名'}
            </Tag>
          )}
          <Tag color={statusColor}>
            {BOUNTY_ANSWER_STATUS_NAMES[answer.status]}
          </Tag>
        </div>
      </div>

      {/* 回答内容 */}
      <div className="answer-content">
        <Paragraph>
          {/* TODO: 从IPFS加载回答内容 */}
          回答内容CID: {answer.contentCid}
        </Paragraph>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 回答底部：投票和奖励 */}
      <div className="answer-footer">
        <Space>
          {/* 投票按钮 */}
          {bounty.allowVoting && (
            <Button
              type={hasVoted ? 'primary' : 'default'}
              icon={<LikeOutlined />}
              size="small"
              onClick={onVote}
              disabled={!canVote || hasVoted}
            >
              {answer.votes} 票
            </Button>
          )}

          {/* 奖励金额 */}
          {answer.rewardAmount > BigInt(0) && (
            <Space size="small">
              <GiftOutlined style={{ color: '#faad14' }} />
              <Text strong style={{ color: '#faad14' }}>
                {formatBountyAmount(answer.rewardAmount)} DUST
              </Text>
            </Space>
          )}
        </Space>
      </div>
    </Card>
  );
};

/**
 * 悬赏详情页面组件（从URL提取bountyId）
 */
export const BountyDetailPage: React.FC = () => {
  // 从URL hash中提取悬赏ID
  const bountyId = parseInt(window.location.hash.match(/#\/bounty\/(\d+)/)?.[1] || '0');

  const [bounty, setBounty] = useState<BountyQuestion | null>(null);
  const [answers, setAnswers] = useState<BountyAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [userAccount, setUserAccount] = useState<string>('');
  const [submitModalVisible, setSubmitModalVisible] = useState(false);

  // 检查bountyId是否有效
  if (!bountyId || bountyId <= 0) {
    return (
      <Card>
        <Empty
          description="无效的悬赏ID"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => window.location.hash = '#/bounty'}>
            返回悬赏列表
          </Button>
        </Empty>
      </Card>
    );
  }

  /**
   * 加载悬赏详情
   */
  const loadBountyDetail = async () => {
    setLoading(true);
    try {
      // TODO: 获取API实例和用户账户
      const api = null as any;
      const service = new BountyService(api);

      // 获取当前区块号
      setCurrentBlock(1000000); // 临时模拟值

      // 加载悬赏详情
      const bountyData = await service.getBountyQuestion(bountyId);
      if (!bountyData) {
        message.error('悬赏不存在');
        return;
      }
      setBounty(bountyData);

      // 加载回答列表
      const answerList = await service.getBountyAnswers(bountyId);
      setAnswers(answerList);
    } catch (error) {
      console.error('加载悬赏详情失败:', error);
      message.error('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBountyDetail();
  }, [bountyId]);

  if (loading) {
    return (
      <div className="loading-container" style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" tip="加载悬赏详情..." />
      </div>
    );
  }

  if (!bounty) {
    return (
      <Card>
        <Empty description="悬赏不存在" />
      </Card>
    );
  }

  const statusTag = formatBountyStatusTag(bounty.status);
  const timeRemaining = getBountyTimeRemaining(bounty.deadline, currentBlock);
  const canSubmit = canSubmitAnswer(bounty, currentBlock);
  const isCreator = bounty.creator === userAccount;

  /**
   * 处理投票
   */
  const handleVote = async (answerId: number) => {
    try {
      // TODO: 实现投票功能
      message.success('投票成功！');
      loadBountyDetail();
    } catch (error) {
      console.error('投票失败:', error);
      message.error('投票失败，请稍后重试');
    }
  };

  /**
   * 处理关闭悬赏
   */
  const handleCloseBounty = async () => {
    if (!canCloseBounty(bounty)) {
      message.error('回答数不足，无法关闭悬赏');
      return;
    }

    Modal.confirm({
      title: '确认关闭悬赏？',
      content: '关闭后将不再接受新回答，您可以选择获奖答案',
      onOk: async () => {
        try {
          // TODO: 实现关闭悬赏功能
          message.success('悬赏已关闭');
          loadBountyDetail();
        } catch (error) {
          console.error('关闭悬赏失败:', error);
          message.error('关闭失败，请稍后重试');
        }
      },
    });
  };

  /**
   * 处理采纳答案
   */
  const handleAdoptAnswers = async () => {
    if (!canAdoptAnswers(bounty)) {
      message.error('当前无法采纳答案');
      return;
    }

    // TODO: 显示选择获奖答案的弹窗
    message.info('请选择前三名获奖答案');
  };

  /**
   * 获取获奖答案
   */
  const getWinningAnswers = () => {
    const winners: Array<{ answer: BountyAnswer; rank: number }> = [];

    if (bounty.adoptedAnswerId !== undefined) {
      const answer = answers.find(a => a.id === bounty.adoptedAnswerId);
      if (answer) winners.push({ answer, rank: 1 });
    }

    if (bounty.secondPlaceId !== undefined) {
      const answer = answers.find(a => a.id === bounty.secondPlaceId);
      if (answer) winners.push({ answer, rank: 2 });
    }

    if (bounty.thirdPlaceId !== undefined) {
      const answer = answers.find(a => a.id === bounty.thirdPlaceId);
      if (answer) winners.push({ answer, rank: 3 });
    }

    return winners;
  };

  const winningAnswers = getWinningAnswers();

  return (
    <div className="bounty-detail-page">
      {/* 悬赏信息卡片 */}
      <Card className="bounty-info-card">
        {/* 头部 */}
        <div className="bounty-detail-header">
          <div>
            <Space>
              <Tag color="purple" style={{ fontSize: 14 }}>
                {DIVINATION_TYPE_ICONS[bounty.divinationType]}{' '}
                {DIVINATION_TYPE_NAMES[bounty.divinationType]}
              </Tag>
              <Tag color={statusTag.color} style={{ fontSize: 14 }}>
                {statusTag.icon} {statusTag.name}
              </Tag>
            </Space>
            <Title level={4} style={{ marginTop: 8 }}>
              悬赏 #{bountyId}
            </Title>
          </div>

          <div className="bounty-amount-large">
            <TrophyOutlined style={{ fontSize: 32, color: '#faad14' }} />
            <div>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#faad14' }}>
                {formatBountyAmount(bounty.bountyAmount)}
              </Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>DUST</Text>
            </div>
          </div>
        </div>

        <Divider />

        {/* 问题内容 */}
        <div className="bounty-question-content">
          <Title level={5}>问题描述</Title>
          <Paragraph>
            {/* TODO: 从IPFS加载问题内容 */}
            问题CID: {bounty.questionCid}
          </Paragraph>
        </div>

        <Divider />

        {/* 悬赏统计 */}
        <Row gutter={16}>
          <Col span={6}>
            <div className="stat-item">
              <Text type="secondary">截止时间</Text>
              <div>
                <ClockCircleOutlined
                  style={{
                    color: timeRemaining.isExpired ? '#ff4d4f' : '#1890ff',
                    marginRight: 4,
                  }}
                />
                <Text strong>
                  {timeRemaining.isExpired
                    ? '已过期'
                    : `${timeRemaining.hours.toFixed(0)}小时`}
                </Text>
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div className="stat-item">
              <Text type="secondary">回答数量</Text>
              <div>
                <Progress
                  percent={(bounty.answerCount / bounty.maxAnswers) * 100}
                  size="small"
                  showInfo={false}
                />
                <Text strong>
                  {bounty.answerCount}/{bounty.maxAnswers}
                </Text>
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div className="stat-item">
              <Text type="secondary">总票数</Text>
              <div>
                <FireOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />
                <Text strong>{bounty.totalVotes}</Text>
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div className="stat-item">
              <Text type="secondary">创建者</Text>
              <Text strong>{bounty.creator.substring(0, 10)}...</Text>
            </div>
          </Col>
        </Row>

        {/* 操作按钮 */}
        {isCreator ? (
          <div style={{ marginTop: 16 }}>
            <Space>
              {bounty.status === 0 && canCloseBounty(bounty) && (
                <Button
                  type="primary"
                  onClick={handleCloseBounty}
                >
                  关闭悬赏
                </Button>
              )}
              {bounty.status === 1 && canAdoptAnswers(bounty) && (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleAdoptAnswers}
                >
                  采纳答案
                </Button>
              )}
            </Space>
          </div>
        ) : (
          canSubmit && (
            <div style={{ marginTop: 16 }}>
              <Button
                type="primary"
                size="large"
                icon={<FireOutlined />}
                onClick={() => setSubmitModalVisible(true)}
              >
                提交回答
              </Button>
            </div>
          )
        )}
      </Card>

      {/* 获奖答案区域 */}
      {winningAnswers.length > 0 && (
        <Card
          title={
            <Space>
              <TrophyOutlined style={{ color: '#faad14' }} />
              <span>获奖答案</span>
            </Space>
          }
          className="winners-section"
        >
          <List
            dataSource={winningAnswers}
            renderItem={({ answer, rank }) => (
              <AnswerCard
                key={answer.id}
                answer={answer}
                bounty={bounty}
                canVote={false}
                hasVoted={false}
                onVote={() => {}}
                isWinner={true}
                rank={rank}
              />
            )}
          />
        </Card>
      )}

      {/* 回答列表 */}
      <Card
        title={
          <Space>
            <FireOutlined />
            <span>所有回答 ({answers.length})</span>
          </Space>
        }
        className="answers-section"
      >
        {answers.length === 0 ? (
          <Empty description="暂无回答" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={answers.filter(
              a => !winningAnswers.some(w => w.answer.id === a.id)
            )}
            renderItem={(answer) => (
              <AnswerCard
                key={answer.id}
                answer={answer}
                bounty={bounty}
                canVote={bounty.allowVoting && bounty.status === 0}
                hasVoted={false} // TODO: 检查用户是否已投票
                onVote={() => handleVote(answer.id)}
                isWinner={false}
              />
            )}
          />
        )}
      </Card>

      {/* 提交回答弹窗 */}
      {submitModalVisible && (
        <SubmitAnswerModal
          visible={submitModalVisible}
          bounty={bounty}
          userAccount={userAccount}
          currentBlock={currentBlock}
          onCancel={() => setSubmitModalVisible(false)}
          onSuccess={(answerId) => {
            setSubmitModalVisible(false);
            loadBountyDetail();
          }}
        />
      )}
    </div>
  );
};

export default BountyDetailPage;