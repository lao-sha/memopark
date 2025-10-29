/**
 * 提交聊天记录证据组件
 * 
 * 功能：买家在OTC订单争议时，将与做市商的聊天记录加密提交给委员会审核
 * 
 * @module SubmitChatEvidence
 * @author Memopark Team
 * @date 2025-10-23
 */

import React, { useState, useEffect } from 'react';
import { Modal, Button, Checkbox, List, message, Spin, Typography, Alert, Space, Tag } from 'antd';
import { FileTextOutlined, LockOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useApi } from '@/hooks/useApi';
import { useAccount } from '@/hooks/useAccount';
import { MultiRecipientEncryption } from '@/utils/multiRecipientEncryption';
import { uploadToIPFS } from '@/services/ipfs';
import { decodeAddress } from '@polkadot/util-crypto';
import { u8aToHex } from '@polkadot/util';
import moment from 'moment';

const { Title, Text, Paragraph } = Typography;

/**
 * 聊天消息接口
 */
interface ChatMessage {
  /** 消息ID */
  id: number;
  
  /** 发送方账户ID */
  sender: string;
  
  /** 接收方账户ID */
  receiver: string;
  
  /** 消息内容CID（加密） */
  content_cid: string;
  
  /** 会话ID */
  session_id: string;
  
  /** 消息类型 */
  msg_type: string;
  
  /** 发送时间（区块高度） */
  sent_at: number;
  
  /** 是否已读 */
  is_read: boolean;
  
  /** 解密后的内容（仅本地） */
  decrypted_content?: string;
}

/**
 * 组件Props
 */
interface SubmitChatEvidenceProps {
  /** 订单ID */
  orderId: number;
  
  /** 做市商账户ID */
  makerAccountId: string;
  
  /** 是否显示 */
  visible: boolean;
  
  /** 关闭回调 */
  onClose: () => void;
  
  /** 提交成功回调 */
  onSuccess?: () => void;
}

/**
 * 提交聊天记录证据组件
 */
export const SubmitChatEvidence: React.FC<SubmitChatEvidenceProps> = ({
  orderId,
  makerAccountId,
  visible,
  onClose,
  onSuccess,
}) => {
  const { api } = useApi();
  const { currentAccount, injector } = useAccount();
  
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  /**
   * 加载聊天记录
   */
  useEffect(() => {
    if (visible && currentAccount && makerAccountId) {
      loadChatMessages();
    }
  }, [visible, currentAccount, makerAccountId]);
  
  /**
   * 加载与做市商的聊天记录
   */
  const loadChatMessages = async () => {
    if (!api || !currentAccount) return;
    
    setLoadingMessages(true);
    try {
      // 1. 生成会话ID（基于两个用户地址的哈希）
      const participants = [currentAccount.address, makerAccountId].sort();
      const sessionId = api.createType('Hash', participants).toHex();
      
      // 2. 获取会话的所有消息ID
      const messageIds = await api.query.chat.sessionMessages(sessionId);
      const messageIdList = messageIds.toJSON() as number[];
      
      if (messageIdList.length === 0) {
        message.info('未找到与该做市商的聊天记录');
        return;
      }
      
      // 3. 获取每条消息的元数据
      const messagesData: ChatMessage[] = [];
      for (const msgId of messageIdList) {
        const msgMeta = await api.query.chat.messages(msgId);
        if (msgMeta.isSome) {
          const meta = msgMeta.unwrap();
          messagesData.push({
            id: msgId,
            sender: meta.sender.toString(),
            receiver: meta.receiver.toString(),
            content_cid: meta.contentCid.toString(),
            session_id: meta.sessionId.toHex(),
            msg_type: meta.msgType.toString(),
            sent_at: meta.sentAt.toNumber(),
            is_read: meta.isRead.valueOf(),
          });
        }
      }
      
      // 4. 解密消息内容（买家作为发送方或接收方）
      const decryptedMessages = await Promise.all(
        messagesData.map(async (msg) => {
          try {
            // 从IPFS下载加密内容
            const encryptedContent = await fetchFromIPFS(msg.content_cid);
            
            // 使用买家私钥解密
            const decrypted = await decryptMessageContent(encryptedContent, currentAccount.meta.source);
            
            return {
              ...msg,
              decrypted_content: decrypted,
            };
          } catch (error) {
            console.error(`解密消息失败 (ID: ${msg.id}):`, error);
            return {
              ...msg,
              decrypted_content: '[解密失败]',
            };
          }
        })
      );
      
      setMessages(decryptedMessages);
      
    } catch (error) {
      console.error('加载聊天记录失败:', error);
      message.error('加载聊天记录失败');
    } finally {
      setLoadingMessages(false);
    }
  };
  
  /**
   * 提交选中的聊天记录作为证据
   */
  const handleSubmit = async () => {
    if (!api || !currentAccount || !injector) {
      message.error('请先连接钱包');
      return;
    }
    
    if (selectedMessageIds.length === 0) {
      message.warning('请至少选择一条聊天记录');
      return;
    }
    
    setSubmitting(true);
    try {
      // 1. 获取所有委员会成员（ContentCommittee, Instance3）
      const committeeMembers = await api.query.collective.members(3);
      const memberList = committeeMembers.toJSON() as string[];
      
      if (memberList.length === 0) {
        message.error('未找到委员会成员');
        return;
      }
      
      message.info(`正在为 ${memberList.length} 位委员会成员加密证据...`);
      
      // 2. 获取委员会成员的公钥
      const publicKeys: { [accountId: string]: Uint8Array } = {};
      for (const member of memberList) {
        // 使用账户地址派生公钥（Polkadot标准）
        publicKeys[member] = decodeAddress(member);
      }
      
      // 3. 准备证据数据（选中的聊天记录）
      const selectedMessages = messages.filter(msg => 
        selectedMessageIds.includes(msg.id)
      );
      
      const evidenceData = {
        order_id: orderId,
        dispute_type: 'chat_evidence',
        submitted_by: currentAccount.address,
        submitted_at: Math.floor(Date.now() / 1000),
        maker_account: makerAccountId,
        messages: selectedMessages.map(msg => ({
          id: msg.id,
          sender: msg.sender,
          receiver: msg.receiver,
          content: msg.decrypted_content,
          msg_type: msg.msg_type,
          sent_at: msg.sent_at,
          timestamp: new Date(msg.sent_at * 6000).toISOString(), // 假设6秒/块
        })),
        metadata: {
          total_messages: selectedMessages.length,
          session_id: selectedMessages[0]?.session_id,
          time_range: {
            start: Math.min(...selectedMessages.map(m => m.sent_at)),
            end: Math.max(...selectedMessages.map(m => m.sent_at)),
          },
        },
      };
      
      // 4. 加密证据数据给委员会成员
      message.loading('正在加密证据...', 0);
      const encryptedEvidence = await MultiRecipientEncryption.encrypt(
        evidenceData,
        publicKeys,
        currentAccount.address,
        `OTC订单${orderId}的聊天记录证据`
      );
      
      message.destroy();
      
      // 5. 上传到IPFS
      message.loading('正在上传到IPFS...', 0);
      const evidenceCid = await uploadToIPFS(encryptedEvidence);
      message.destroy();
      
      console.log('✅ 加密证据已上传到IPFS:', evidenceCid);
      
      // 6. 提交到链上（调用 pallet-evidence）
      message.loading('正在提交到区块链...', 0);
      
      // 获取OTC订单域的命名空间
      const otcNamespace = new Uint8Array([
        0x6f, 0x74, 0x63, 0x5f, 0x6f, 0x72, 0x64, 0x5f // "otc_ord_"
      ]);
      
      const tx = api.tx.evidence.submitEvidence(
        otcNamespace,
        orderId,
        evidenceCid,
        [], // 图片CIDs
        [], // 视频CIDs
        [], // 文档CIDs
        `聊天记录证据（${selectedMessages.length}条消息）`
      );
      
      await tx.signAndSend(
        currentAccount.address,
        { signer: injector.signer },
        ({ status, dispatchError }) => {
          if (status.isInBlock) {
            message.destroy();
            console.log(`✅ 交易已打包: ${status.asInBlock.toHex()}`);
          }
          
          if (status.isFinalized) {
            if (dispatchError) {
              let errorMsg = '提交失败';
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                errorMsg = `${decoded.section}.${decoded.name}: ${decoded.docs}`;
              }
              message.error(errorMsg);
              setSubmitting(false);
            } else {
              message.success('聊天记录证据已成功提交！');
              setSubmitting(false);
              onSuccess?.();
              onClose();
            }
          }
        }
      );
      
    } catch (error: any) {
      console.error('提交证据失败:', error);
      message.error(`提交失败: ${error.message}`);
      setSubmitting(false);
    }
  };
  
  /**
   * 切换消息选择
   */
  const toggleMessageSelection = (msgId: number) => {
    setSelectedMessageIds(prev => 
      prev.includes(msgId)
        ? prev.filter(id => id !== msgId)
        : [...prev, msgId]
    );
  };
  
  /**
   * 全选/取消全选
   */
  const toggleSelectAll = () => {
    if (selectedMessageIds.length === messages.length) {
      setSelectedMessageIds([]);
    } else {
      setSelectedMessageIds(messages.map(m => m.id));
    }
  };
  
  /**
   * 渲染消息列表项
   */
  const renderMessageItem = (msg: ChatMessage) => {
    const isSender = msg.sender === currentAccount?.address;
    const timestamp = moment(msg.sent_at * 6000).format('YYYY-MM-DD HH:mm:ss');
    
    return (
      <List.Item
        key={msg.id}
        style={{
          padding: '12px',
          cursor: 'pointer',
          backgroundColor: selectedMessageIds.includes(msg.id) ? '#e6f7ff' : 'transparent',
        }}
        onClick={() => toggleMessageSelection(msg.id)}
      >
        <Checkbox
          checked={selectedMessageIds.includes(msg.id)}
          style={{ marginRight: 12 }}
        />
        <div style={{ flex: 1 }}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Space>
              <Tag color={isSender ? 'blue' : 'green'}>
                {isSender ? '我' : '做市商'}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {timestamp}
              </Text>
            </Space>
            <Paragraph
              style={{ margin: 0, fontSize: 14 }}
              ellipsis={{ rows: 2, expandable: true }}
            >
              {msg.decrypted_content}
            </Paragraph>
          </Space>
        </div>
      </List.Item>
    );
  };
  
  return (
    <Modal
      title={
        <Space>
          <LockOutlined />
          <span>提交聊天记录证据</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={submitting}
          disabled={selectedMessageIds.length === 0}
          onClick={handleSubmit}
        >
          加密并提交给委员会（{selectedMessageIds.length}条）
        </Button>,
      ]}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          message="证据加密说明"
          description={
            <Space direction="vertical" size={8}>
              <Text>
                • 选中的聊天记录将使用<strong>混合加密（AES-256 + X25519）</strong>加密
              </Text>
              <Text>
                • 只有<strong>委员会成员</strong>可以解密查看
              </Text>
              <Text>
                • 加密后上传到<strong>IPFS</strong>，链上仅记录CID
              </Text>
              <Text type="warning">
                • 证据一旦提交<strong>无法撤回</strong>，请仔细核对
              </Text>
            </Space>
          }
          type="info"
          showIcon
          icon={<LockOutlined />}
        />
        
        {loadingMessages ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" tip="正在加载聊天记录..." />
          </div>
        ) : messages.length === 0 ? (
          <Alert
            message="未找到聊天记录"
            description="您与该做市商没有聊天记录，无法提交证据。"
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
          />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong>
                共 {messages.length} 条消息，已选择 {selectedMessageIds.length} 条
              </Text>
              <Button type="link" onClick={toggleSelectAll}>
                {selectedMessageIds.length === messages.length ? '取消全选' : '全选'}
              </Button>
            </div>
            
            <List
              bordered
              dataSource={messages}
              renderItem={renderMessageItem}
              style={{ maxHeight: 400, overflow: 'auto' }}
            />
          </>
        )}
        
        {selectedMessageIds.length > 0 && (
          <Alert
            message={`将为 ${selectedMessageIds.length} 条消息加密并提交`}
            description="委员会成员将能够解密并查看这些聊天记录，用于公正裁决。"
            type="success"
            showIcon
          />
        )}
      </Space>
    </Modal>
  );
};

/**
 * 从IPFS下载内容
 */
async function fetchFromIPFS(cid: string): Promise<any> {
  // 实际实现中应该调用IPFS服务
  // 这里是示例代码
  const response = await fetch(`https://ipfs.infura.io:5001/api/v0/cat?arg=${cid}`);
  return response.json();
}

/**
 * 解密消息内容（单接收方）
 */
async function decryptMessageContent(encryptedData: any, keySource: string): Promise<string> {
  // 实际实现中应该使用用户私钥解密
  // 这里是示例代码
  return encryptedData.content || '[内容]';
}

