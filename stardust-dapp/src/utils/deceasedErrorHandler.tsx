/**
 * Deceased Pallet 错误处理工具
 * 
 * 提供友好的错误提示信息，帮助用户理解链上操作失败的原因
 */

import { message } from 'antd';
import type { ApiPromise } from '@polkadot/api';
import type { DispatchError } from '@polkadot/types/interfaces';

/**
 * Deceased Pallet 错误类型枚举
 */
export enum DeceasedErrorType {
  // 通用错误
  GraveNotFound = 'GraveNotFound',
  NotAuthorized = 'NotAuthorized',
  TooManyDeceasedInGrave = 'TooManyDeceasedInGrave',
  DeceasedNotFound = 'DeceasedNotFound',
  Overflow = 'Overflow',
  BadInput = 'BadInput',
  
  // 关系功能错误
  RelationExists = 'RelationExists',
  RelationNotFound = 'RelationNotFound',
  BadRelationKind = 'BadRelationKind',
  PendingApproval = 'PendingApproval',
  NotProposalResponder = 'NotProposalResponder',
  
  // 其他错误
  DeletionForbidden = 'DeletionForbidden',
  DeceasedTokenExists = 'DeceasedTokenExists',
  OwnerImmutable = 'OwnerImmutable',
  
  // 亲友团错误
  FriendAlreadyMember = 'FriendAlreadyMember',
  FriendNotMember = 'FriendNotMember',
  FriendPendingExists = 'FriendPendingExists',
  FriendNoPending = 'FriendNoPending',
  FriendTooMany = 'FriendTooMany',
}

/**
 * 错误提示消息映射表
 */
const errorMessages: Record<DeceasedErrorType, { title: string; description: string }> = {
  // 通用错误
  [DeceasedErrorType.GraveNotFound]: {
    title: '墓位不存在',
    description: '指定的墓位不存在，请检查墓位ID是否正确',
  },
  [DeceasedErrorType.NotAuthorized]: {
    title: '权限不足',
    description: '你无权执行此操作，请确认你是墓位管理员',
  },
  [DeceasedErrorType.TooManyDeceasedInGrave]: {
    title: '墓位已满',
    description: '该墓位下的逝者数量已达上限，无法添加更多逝者',
  },
  [DeceasedErrorType.DeceasedNotFound]: {
    title: '逝者不存在',
    description: '指定的逝者不存在，请检查逝者ID是否正确',
  },
  [DeceasedErrorType.Overflow]: {
    title: 'ID溢出',
    description: '系统ID已达最大值，请联系管理员',
  },
  [DeceasedErrorType.BadInput]: {
    title: '输入不合法',
    description: '输入的数据不符合要求（如长度超限、格式错误等）',
  },
  
  // 关系功能错误
  [DeceasedErrorType.RelationExists]: {
    title: '关系已存在',
    description: '该关系已经存在，无需重复建立',
  },
  [DeceasedErrorType.RelationNotFound]: {
    title: '关系或提案不存在',
    description: '指定的关系或提案不存在（可能已被处理或从未建立）',
  },
  [DeceasedErrorType.BadRelationKind]: {
    title: '关系类型冲突',
    description: '关系类型不合法或与已有关系冲突（如父母关系与配偶关系互斥）',
  },
  [DeceasedErrorType.PendingApproval]: {
    title: '提案待审批',
    description: '对方已向你发起提案，请先处理该提案',
  },
  [DeceasedErrorType.NotProposalResponder]: {
    title: '只有提案接收方可批准/拒绝',
    description: '你不是提案接收方的管理员。只有提案参数中【to】对应逝者的墓位管理员可以批准/拒绝提案',
  },
  
  // 其他错误
  [DeceasedErrorType.DeletionForbidden]: {
    title: '禁止删除',
    description: '出于合规与审计需求，逝者创建后不可删除。请使用迁移功能或关系功能',
  },
  [DeceasedErrorType.DeceasedTokenExists]: {
    title: '逝者令牌已存在',
    description: '相同的逝者令牌已存在（姓名、性别、生卒年月相同），禁止重复创建',
  },
  [DeceasedErrorType.OwnerImmutable]: {
    title: '拥有者不可变更',
    description: '逝者的拥有者为创建者且永久不可变更',
  },
  
  // 亲友团错误
  [DeceasedErrorType.FriendAlreadyMember]: {
    title: '已是成员',
    description: '该账户已经是亲友团成员',
  },
  [DeceasedErrorType.FriendNotMember]: {
    title: '不是成员',
    description: '该账户不是亲友团成员',
  },
  [DeceasedErrorType.FriendPendingExists]: {
    title: '已有待审批申请',
    description: '该账户已经提交过加入申请，正在等待审批',
  },
  [DeceasedErrorType.FriendNoPending]: {
    title: '无待审批申请',
    description: '找不到该账户的待审批申请',
  },
  [DeceasedErrorType.FriendTooMany]: {
    title: '成员数量已达上限',
    description: '亲友团成员数量已达到设定的上限',
  },
};

/**
 * 解析 DispatchError 并返回错误类型
 */
export function parseDeceasedError(
  error: DispatchError,
  api: ApiPromise
): { errorType: DeceasedErrorType | null; errorName: string; errorDocs: string[] } {
  if (error.isModule) {
    const decoded = api.registry.findMetaError(error.asModule);
    const { name, docs } = decoded;
    
    // 检查是否是 Deceased Pallet 的错误
    const errorType = Object.values(DeceasedErrorType).includes(name as DeceasedErrorType)
      ? (name as DeceasedErrorType)
      : null;
    
    return {
      errorType,
      errorName: name,
      errorDocs: docs,
    };
  }
  
  return {
    errorType: null,
    errorName: 'Unknown',
    errorDocs: ['未知错误'],
  };
}

/**
 * 处理 Deceased Pallet 的交易错误，显示友好的提示信息
 * 
 * @param error - DispatchError 对象
 * @param api - Polkadot API 实例
 * @param defaultMessage - 默认错误消息（当无法识别错误类型时使用）
 */
export function handleDeceasedError(
  error: DispatchError,
  api: ApiPromise,
  defaultMessage = '操作失败'
): void {
  const { errorType, errorName, errorDocs } = parseDeceasedError(error, api);
  
  if (errorType && errorMessages[errorType]) {
    const { title, description } = errorMessages[errorType];
    message.error({
      content: (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{description}</div>
        </div>
      ),
      duration: 6,
    });
  } else {
    // 未识别的错误，显示原始错误信息
    message.error({
      content: (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{defaultMessage}</div>
          <div style={{ fontSize: 12, color: '#666' }}>
            {errorName}: {errorDocs.join(' ')}
          </div>
        </div>
      ),
      duration: 6,
    });
  }
}

/**
 * 获取错误的详细信息（用于UI展示）
 */
export function getErrorDetail(errorType: DeceasedErrorType): { title: string; description: string } | null {
  return errorMessages[errorType] || null;
}

/**
 * 关系功能专用错误处理
 * 针对常见的关系操作错误提供额外的上下文提示
 */
export function handleRelationError(
  error: DispatchError,
  api: ApiPromise,
  operation: 'propose' | 'approve' | 'reject' | 'cancel' | 'revoke'
): void {
  const { errorType, errorName, errorDocs } = parseDeceasedError(error, api);
  
  // 针对不同操作提供更具体的提示
  if (errorType === DeceasedErrorType.NotProposalResponder) {
    let specificTip = '';
    if (operation === 'approve') {
      specificTip = '提示：只有提案接收方（参数中的【to】）的管理员可以批准提案';
    } else if (operation === 'reject') {
      specificTip = '提示：只有提案接收方（参数中的【to】）的管理员可以拒绝提案';
    } else if (operation === 'cancel') {
      specificTip = '提示：只有提案发起方（参数中的【from】）的管理员可以撤回提案';
    }
    
    message.error({
      content: (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
            ❌ {errorMessages[errorType].title}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
            {errorMessages[errorType].description}
          </div>
          {specificTip && (
            <div style={{ fontSize: 12, color: '#ff4d4f', fontStyle: 'italic' }}>
              {specificTip}
            </div>
          )}
        </div>
      ),
      duration: 8,
    });
  } else if (errorType === DeceasedErrorType.RelationNotFound) {
    let specificTip = '';
    if (operation === 'approve' || operation === 'reject' || operation === 'cancel') {
      specificTip = '提示：提案可能已被批准、拒绝或撤回，请刷新页面查看最新状态';
    } else if (operation === 'revoke') {
      specificTip = '提示：关系可能已被撤销或从未建立，请刷新页面查看最新状态';
    }
    
    message.warning({
      content: (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
            ⚠️ {errorMessages[errorType].title}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
            {errorMessages[errorType].description}
          </div>
          {specificTip && (
            <div style={{ fontSize: 12, color: '#faad14', fontStyle: 'italic' }}>
              {specificTip}
            </div>
          )}
        </div>
      ),
      duration: 8,
    });
  } else {
    // 其他错误使用通用处理
    handleDeceasedError(error, api, `${operation}操作失败`);
  }
}

