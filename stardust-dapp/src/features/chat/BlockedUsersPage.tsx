/**
 * 函数级详细中文注释：黑名单管理页面
 * - 查看已拉黑的用户列表
 * - 拉黑新用户
 * - 解除拉黑
 * - 移动端优化设计
 */

import React, { useState, useEffect } from 'react';
import { Card, List, Typography, Button, message, Modal, Input, Avatar, Empty } from 'antd';
import { 
  ArrowLeftOutlined, 
  UserOutlined, 
  DeleteOutlined, 
  PlusOutlined,
  StopOutlined 
} from '@ant-design/icons';
import { getApi } from '../../lib/polkadot-safe';
import { useWallet } from '../../providers/WalletProvider';

const { Text } = Typography;

/**
 * 黑名单管理页面
 */
export const BlockedUsersPage: React.FC = () => {
  const { currentAccount: account } = useWallet();
  const [blockedList, setBlockedList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newBlockedAddress, setNewBlockedAddress] = useState('');
  const [operating, setOperating] = useState(false);
  
  /**
   * 函数级详细中文注释：加载黑名单列表
   */
  useEffect(() => {
    if (account) {
      loadBlockedUsers();
    }
  }, [account]);
  
  const loadBlockedUsers = async () => {
    if (!account) return;
    
    setLoading(true);
    try {
      const api = await getApi();
      
      // 调用pallet-chat的查询接口
      const list = await (api.query as any).chat?.listBlockedUsers?.(account.address);
      
      if (list) {
        const addresses = list.map((addr: any) => addr.toString());
        setBlockedList(addresses);
      }
    } catch (error) {
      console.error('加载黑名单失败:', error);
      message.error('加载黑名单失败');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 函数级详细中文注释：拉黑用户
   */
  const handleBlockUser = async () => {
    const address = newBlockedAddress.trim();
    
    if (!address) {
      message.warning('请输入用户地址');
      return;
    }
    
    if (address === account?.address) {
      message.warning('不能拉黑自己');
      return;
    }
    
    setOperating(true);
    try {
      const api = await getApi();
      const tx = (api.tx as any).chat.blockUser(address);
      
      await new Promise((resolve, reject) => {
        tx.signAndSend(account, (result: any) => {
          if (result.status.isFinalized) {
            resolve(result.status.asFinalized.toHex());
          }
          if (result.dispatchError) {
            reject(new Error('拉黑失败'));
          }
        });
      });
      
      message.success('已拉黑该用户');
      setAddModalVisible(false);
      setNewBlockedAddress('');
      loadBlockedUsers();
    } catch (error: any) {
      console.error('拉黑用户失败:', error);
      message.error(error.message || '拉黑失败');
    } finally {
      setOperating(false);
    }
  };
  
  /**
   * 函数级详细中文注释：解除拉黑
   */
  const handleUnblockUser = async (address: string) => {
    Modal.confirm({
      title: '确认解除拉黑',
      content: `解除拉黑后，该用户可以向您发送消息`,
      okText: '确认',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        setOperating(true);
        try {
          const api = await getApi();
          const tx = (api.tx as any).chat.unblockUser(address);
          
          await new Promise((resolve, reject) => {
            tx.signAndSend(account, (result: any) => {
              if (result.status.isFinalized) {
                resolve(result.status.asFinalized.toHex());
              }
              if (result.dispatchError) {
                reject(new Error('解除拉黑失败'));
              }
            });
          });
          
          message.success('已解除拉黑');
          loadBlockedUsers();
        } catch (error: any) {
          console.error('解除拉黑失败:', error);
          message.error(error.message || '解除拉黑失败');
        } finally {
          setOperating(false);
        }
      },
    });
  };
  
  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: '#F5F5DC',
      paddingBottom: 24,
    }}>
      {/* 顶部导航栏 */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'linear-gradient(135deg, #B8860B 0%, #2F4F4F 100%)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined style={{ fontSize: 20, color: '#fff' }} />}
          onClick={() => window.history.back()}
          style={{ color: '#fff' }}
        />
        <Text style={{ margin: 0, color: '#fff', fontWeight: 600, fontSize: 18 }}>
          黑名单管理
        </Text>
        <Button
          type="text"
          icon={<PlusOutlined style={{ fontSize: 20, color: '#fff' }} />}
          onClick={() => setAddModalVisible(true)}
          style={{ color: '#fff' }}
        />
      </div>
      
      {/* 内容区域 */}
      <div style={{ maxWidth: 414, margin: '0 auto', padding: 16 }}>
        <Card
          bordered={false}
          loading={loading}
          style={{
            borderRadius: 12,
            border: '2px solid rgba(184, 134, 11, 0.15)',
            boxShadow: '0 2px 8px rgba(47, 79, 79, 0.1)',
          }}
        >
          {blockedList.length === 0 ? (
            <Empty
              description="暂无黑名单"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <List
              dataSource={blockedList}
              renderItem={(address) => (
                <List.Item
                  actions={[
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleUnblockUser(address)}
                      loading={operating}
                    >
                      解除
                    </Button>,
                  ]}
                  style={{
                    padding: '12px 8px',
                    borderRadius: 8,
                    marginBottom: 8,
                    background: '#fafafa',
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        icon={<UserOutlined />}
                        style={{
                          backgroundColor: '#999',
                        }}
                      />
                    }
                    title={
                      <Text code style={{ fontSize: 13 }}>
                        {address.slice(0, 12)}...{address.slice(-8)}
                      </Text>
                    }
                    description={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <StopOutlined /> 已拉黑
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </div>
      
      {/* 添加黑名单弹窗 */}
      <Modal
        open={addModalVisible}
        title="拉黑用户"
        onCancel={() => {
          setAddModalVisible(false);
          setNewBlockedAddress('');
        }}
        onOk={handleBlockUser}
        okText="确认拉黑"
        cancelText="取消"
        confirmLoading={operating}
        centered
      >
        <div style={{ padding: '20px 0' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            拉黑后，该用户将无法向您发送消息
          </Text>
          <Input
            placeholder="请输入用户地址"
            value={newBlockedAddress}
            onChange={(e) => setNewBlockedAddress(e.target.value)}
            size="large"
            style={{
              borderRadius: 8,
              border: '2px solid rgba(184, 134, 11, 0.2)',
            }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default BlockedUsersPage;

