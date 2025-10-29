/**
 * 关系提案管理组件
 * 
 * 提供关系提案的查看、批准、拒绝、撤回功能
 */

import React, { useState, useEffect, useCallback } from 'react';
import { List, Button, Tag, Space, Modal, message, Spin, Empty, Tooltip } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  UndoOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { ApiPromise } from '@polkadot/api';
import { handleRelationError } from '@/utils/deceasedErrorHandler';

/**
 * 关系类型枚举
 */
export enum RelationKind {
  ParentOf = 0,    // 父母（有向）
  SpouseOf = 1,    // 配偶（无向）
  SiblingOf = 2,   // 兄弟姐妹（无向）
  ChildOf = 3,     // 子女（有向）
}

/**
 * 关系类型名称映射
 */
const relationKindNames: Record<RelationKind, string> = {
  [RelationKind.ParentOf]: '父母',
  [RelationKind.SpouseOf]: '配偶',
  [RelationKind.SiblingOf]: '兄弟姐妹',
  [RelationKind.ChildOf]: '子女',
};

/**
 * 提案数据结构
 */
export interface RelationProposal {
  from: number;
  to: number;
  kind: RelationKind;
  requester: string;
  note: string;
  createdAt: number;
}

/**
 * 组件 Props
 */
interface RelationProposalManagerProps {
  /** Polkadot API 实例 */
  api: ApiPromise | null;
  /** 当前用户账户 */
  account: string | null;
  /** 我管理的逝者ID（用于筛选提案） */
  myDeceasedId?: number;
  /** 显示模式：received=我收到的提案，sent=我发起的提案，all=全部 */
  mode?: 'received' | 'sent' | 'all';
  /** 刷新触发器（外部可以通过改变这个值来触发刷新） */
  refreshTrigger?: number;
}

/**
 * 关系提案管理组件
 */
const RelationProposalManager: React.FC<RelationProposalManagerProps> = ({
  api,
  account,
  myDeceasedId,
  mode = 'received',
  refreshTrigger = 0,
}) => {
  const [proposals, setProposals] = useState<RelationProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /**
   * 查询待审批提案
   * 
   * TODO: 实现实际的链上查询逻辑
   * 1. 遍历 PendingRelationRequests 存储
   * 2. 根据 mode 过滤提案
   * 3. 更新 proposals 状态
   */
  const fetchProposals = useCallback(async () => {
    if (!api || !myDeceasedId) return;

    setLoading(true);
    try {
      // TODO: 实现链上查询
      // 示例代码：
      // const entries = await api.query.deceased.pendingRelationRequests.entries();
      // const filteredProposals = entries
      //   .map(([key, value]) => {
      //     const [from, to] = key.args;
      //     const [kind, requester, note, createdAt] = value;
      //     return { from: from.toNumber(), to: to.toNumber(), kind, requester, note, createdAt };
      //   })
      //   .filter(p => {
      //     if (mode === 'received') return p.to === myDeceasedId;
      //     if (mode === 'sent') return p.from === myDeceasedId;
      //     return true;
      //   });
      // setProposals(filteredProposals);
      
      // 暂时使用模拟数据
      console.log('fetchProposals called, myDeceasedId:', myDeceasedId, 'mode:', mode);
      setProposals([]);
    } catch (error) {
      console.error('查询提案失败:', error);
      message.error('查询提案失败');
    } finally {
      setLoading(false);
    }
  }, [api, myDeceasedId, mode]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals, refreshTrigger]);

  /**
   * 批准提案
   */
  const handleApprove = async (proposal: RelationProposal) => {
    if (!api || !account) {
      message.error('请先连接钱包');
      return;
    }

    const actionKey = `approve-${proposal.from}-${proposal.to}`;
    setActionLoading(actionKey);

    try {
      const tx = api.tx.deceased.approveRelation(proposal.from, proposal.to);

      await tx.signAndSend(account, ({ status, events }) => {
        if (status.isInBlock || status.isFinalized) {
          // 检查事件
          let approved = false;
          let failed = false;

          events.forEach(({ event }) => {
            if (api.events.deceased.RelationApproved.is(event)) {
              approved = true;
            } else if (api.events.system.ExtrinsicFailed.is(event)) {
              failed = true;
              const [dispatchError] = event.data;
              if (dispatchError.isModule) {
                handleRelationError(dispatchError, api, 'approve');
              }
            }
          });

          if (approved) {
            message.success('✅ 关系已批准');
            fetchProposals(); // 刷新列表
          }

          if (!failed && !approved) {
            message.info('交易已提交，等待确认...');
          }

          setActionLoading(null);
        }
      });
    } catch (error: unknown) {
      console.error('批准失败:', error);
      message.error(`批准失败: ${error instanceof Error ? error.message : String(error)}`);
      setActionLoading(null);
    }
  };

  /**
   * 拒绝提案
   */
  const handleReject = async (proposal: RelationProposal) => {
    if (!api || !account) {
      message.error('请先连接钱包');
      return;
    }

    const actionKey = `reject-${proposal.from}-${proposal.to}`;
    setActionLoading(actionKey);

    try {
      const tx = api.tx.deceased.rejectRelation(proposal.from, proposal.to);

      await tx.signAndSend(account, ({ status, events }) => {
        if (status.isInBlock || status.isFinalized) {
          let rejected = false;
          let failed = false;

          events.forEach(({ event }) => {
            if (api.events.deceased.RelationRejected.is(event)) {
              rejected = true;
            } else if (api.events.system.ExtrinsicFailed.is(event)) {
              failed = true;
              const [dispatchError] = event.data;
              if (dispatchError.isModule) {
                handleRelationError(dispatchError, api, 'reject');
              }
            }
          });

          if (rejected) {
            message.success('✅ 提案已拒绝');
            fetchProposals();
          }

          if (!failed && !rejected) {
            message.info('交易已提交，等待确认...');
          }

          setActionLoading(null);
        }
      });
    } catch (error: unknown) {
      console.error('拒绝失败:', error);
      message.error(`拒绝失败: ${error instanceof Error ? error.message : String(error)}`);
      setActionLoading(null);
    }
  };

  /**
   * 撤回提案（仅发起方可用）
   */
  const handleCancel = async (proposal: RelationProposal) => {
    if (!api || !account) {
      message.error('请先连接钱包');
      return;
    }

    Modal.confirm({
      title: '确认撤回提案',
      content: '撤回后提案将被删除，如需重新建立关系需重新发起提案。',
      okText: '确认撤回',
      cancelText: '取消',
      onOk: async () => {
        const actionKey = `cancel-${proposal.from}-${proposal.to}`;
        setActionLoading(actionKey);

        try {
          const tx = api.tx.deceased.cancelRelationProposal(proposal.from, proposal.to);

          await tx.signAndSend(account, ({ status, events }) => {
            if (status.isInBlock || status.isFinalized) {
              let cancelled = false;
              let failed = false;

              events.forEach(({ event }) => {
                if (api.events.deceased.RelationProposalCancelled?.is(event)) {
                  cancelled = true;
                } else if (api.events.system.ExtrinsicFailed.is(event)) {
                  failed = true;
                  const [dispatchError] = event.data;
                  if (dispatchError.isModule) {
                    handleRelationError(dispatchError, api, 'cancel');
                  }
                }
              });

              if (cancelled) {
                message.success('✅ 提案已撤回');
                fetchProposals();
              }

              if (!failed && !cancelled) {
                message.info('交易已提交，等待确认...');
              }

              setActionLoading(null);
            }
          });
        } catch (error: unknown) {
          console.error('撤回失败:', error);
          message.error(`撤回失败: ${error instanceof Error ? error.message : String(error)}`);
          setActionLoading(null);
        }
      },
    });
  };

  /**
   * 获取关系类型的Tag颜色
   */
  const getRelationColor = (kind: RelationKind): string => {
    switch (kind) {
      case RelationKind.ParentOf:
        return 'blue';
      case RelationKind.SpouseOf:
        return 'pink';
      case RelationKind.SiblingOf:
        return 'green';
      case RelationKind.ChildOf:
        return 'purple';
      default:
        return 'default';
    }
  };

  /**
   * 渲染提案操作按钮
   */
  const renderActions = (proposal: RelationProposal) => {
    const isReceived = mode === 'received' || proposal.to === myDeceasedId;
    const isSent = mode === 'sent' || proposal.from === myDeceasedId;

    const approveKey = `approve-${proposal.from}-${proposal.to}`;
    const rejectKey = `reject-${proposal.from}-${proposal.to}`;
    const cancelKey = `cancel-${proposal.from}-${proposal.to}`;

    if (isReceived) {
      // 我收到的提案：可以批准或拒绝
      return [
        <Tooltip title="批准这个关系提案">
          <Button
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => handleApprove(proposal)}
            loading={actionLoading === approveKey}
            disabled={!!actionLoading && actionLoading !== approveKey}
          >
            批准
          </Button>
        </Tooltip>,
        <Tooltip title="拒绝这个关系提案">
          <Button
            danger
            icon={<CloseOutlined />}
            onClick={() => handleReject(proposal)}
            loading={actionLoading === rejectKey}
            disabled={!!actionLoading && actionLoading !== rejectKey}
          >
            拒绝
          </Button>
        </Tooltip>,
      ];
    } else if (isSent) {
      // 我发起的提案：可以撤回
      return [
        <Tooltip title="撤回这个提案（不可恢复）">
          <Button
            icon={<UndoOutlined />}
            onClick={() => handleCancel(proposal)}
            loading={actionLoading === cancelKey}
            disabled={!!actionLoading && actionLoading !== cancelKey}
          >
            撤回提案
          </Button>
        </Tooltip>,
      ];
    }

    return [];
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin tip="加载中..." />
      </div>
    );
  }

  if (proposals.length === 0) {
    const emptyMessages = {
      received: '暂无收到的提案',
      sent: '暂无发起的提案',
      all: '暂无提案',
    };

    return (
      <Empty
        description={emptyMessages[mode]}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <List
      dataSource={proposals}
      renderItem={(proposal) => {
        const isReceived = mode === 'received' || proposal.to === myDeceasedId;
        const title = isReceived
          ? `逝者 #${proposal.from} 提出关系声明`
          : `我向逝者 #${proposal.to} 发起提案`;

        return (
          <List.Item
            actions={renderActions(proposal)}
          >
            <List.Item.Meta
              title={
                <Space>
                  <span>{title}</span>
                  <Tag color={getRelationColor(proposal.kind)}>
                    {relationKindNames[proposal.kind]}
                  </Tag>
                  {isReceived ? (
                    <Tag color="orange">待我批准</Tag>
                  ) : (
                    <Tag color="cyan">等待对方响应</Tag>
                  )}
                </Space>
              }
              description={
                <div>
                  {proposal.note && (
                    <div style={{ marginBottom: 4 }}>
                      <strong>备注：</strong>
                      {proposal.note}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#999' }}>
                    <strong>发起人：</strong>
                    {proposal.requester}
                  </div>
                  {isReceived && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#666', display: 'flex', alignItems: 'center' }}>
                      <QuestionCircleOutlined style={{ marginRight: 4 }} />
                      <span>
                        提示：批准后将建立正式关系，任何一方都可以单方面撤销
                      </span>
                    </div>
                  )}
                </div>
              }
            />
          </List.Item>
        );
      }}
    />
  );
};

export default RelationProposalManager;

