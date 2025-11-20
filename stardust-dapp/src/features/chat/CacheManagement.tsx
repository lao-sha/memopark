/**
 * 函数级详细中文注释：缓存管理页面
 * - 显示缓存统计信息
 * - 手动清理过期缓存
 * - 清空所有缓存
 * - 移动端优化设计
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Statistic, Space, message as antMessage, Modal, Typography, Divider } from 'antd';
import { 
  ArrowLeftOutlined,
  DeleteOutlined, 
  ReloadOutlined,
  DatabaseOutlined,
  ClockCircleOutlined 
} from '@ant-design/icons';
import { getCacheStats, cleanupOldCache } from '../../lib/chat-cache';

const { Text, Title } = Typography;

/**
 * 缓存管理组件
 */
export const CacheManagement: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  
  useEffect(() => {
    loadStats();
  }, []);
  
  /**
   * 函数级详细中文注释：加载缓存统计
   */
  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await getCacheStats();
      setStats(data);
    } catch (error) {
      console.error('加载统计失败:', error);
      antMessage.error('加载统计失败');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 函数级详细中文注释：清理过期消息
   */
  const handleCleanup = async () => {
    Modal.confirm({
      title: '确认清理',
      content: '将删除30天前的缓存消息，此操作不可恢复',
      okText: '确认清理',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        setCleaning(true);
        try {
          const count = await cleanupOldCache(30);
          antMessage.success(`已清理 ${count} 条过期消息`);
          loadStats();
        } catch (error) {
          antMessage.error('清理失败');
        } finally {
          setCleaning(false);
        }
      },
    });
  };
  
  /**
   * 函数级详细中文注释：清空所有缓存
   */
  const handleClearAll = () => {
    Modal.confirm({
      title: '确认清空',
      content: '将删除所有缓存消息，下次打开会话需要重新加载',
      okText: '确认清空',
      cancelText: '取消',
      okType: 'danger',
      centered: true,
      onOk: async () => {
        try {
          // 清理所有缓存
          await cleanupOldCache(0);  // 0天表示全部清理
          antMessage.success('缓存已清空');
          loadStats();
        } catch (error) {
          antMessage.error('清空失败');
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
          缓存管理
        </Text>
        <Button
          type="text"
          icon={<ReloadOutlined style={{ fontSize: 20, color: '#fff' }} />}
          onClick={loadStats}
          loading={loading}
          style={{ color: '#fff' }}
        />
      </div>
      
      {/* 内容区域 */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
        {/* 统计信息卡片 */}
        <Card
          loading={loading}
          style={{
            marginBottom: 16,
            borderRadius: 12,
            border: '2px solid rgba(184, 134, 11, 0.15)',
            boxShadow: '0 2px 8px rgba(47, 79, 79, 0.1)',
          }}
        >
          <Title level={5} style={{ marginBottom: 16, color: '#2F4F4F' }}>
            <DatabaseOutlined /> 缓存统计
          </Title>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Statistic
              title="缓存消息"
              value={stats?.totalMessages || 0}
              suffix="条"
              valueStyle={{ color: '#B8860B', fontSize: 24 }}
            />
            <Statistic
              title="会话数量"
              value={stats?.totalSessions || 0}
              suffix="个"
              valueStyle={{ color: '#2F4F4F', fontSize: 24 }}
            />
          </div>
          
          <Divider style={{ margin: '16px 0' }} />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
                存储大小
              </Text>
              <Text strong style={{ fontSize: 18, color: '#4682B4' }}>
                {((stats?.cacheSize || 0) / 1024 / 1024).toFixed(2)} MB
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
                最早消息
              </Text>
              <Text strong style={{ fontSize: 13, color: '#708090' }}>
                {stats?.oldestMessage 
                  ? new Date(stats.oldestMessage).toLocaleDateString()
                  : '-'
                }
              </Text>
            </div>
          </div>
        </Card>
        
        {/* 操作卡片 */}
        <Card
          title={
            <span>
              <ClockCircleOutlined /> 缓存管理
            </span>
          }
          style={{
            borderRadius: 12,
            border: '2px solid rgba(184, 134, 11, 0.15)',
            boxShadow: '0 2px 8px rgba(47, 79, 79, 0.1)',
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                清理过期消息
              </Text>
              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
                删除30天前的缓存消息，释放存储空间
              </Text>
              <Button
                icon={<DeleteOutlined />}
                onClick={handleCleanup}
                loading={cleaning}
                block
                size="large"
                style={{
                  borderRadius: 8,
                  border: '2px solid rgba(184, 134, 11, 0.3)',
                  color: '#B8860B',
                  fontWeight: 500,
                }}
              >
                清理过期消息（30天前）
              </Button>
            </div>
            
            <Divider style={{ margin: '8px 0' }} />
            
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                清空所有缓存
              </Text>
              <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
                删除所有缓存，下次打开会话需要重新加载
              </Text>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleClearAll}
                block
                size="large"
                style={{
                  borderRadius: 8,
                  fontWeight: 500,
                }}
              >
                清空所有缓存
              </Button>
            </div>
          </Space>
        </Card>
        
        {/* 说明卡片 */}
        <Card
          style={{
            marginTop: 16,
            borderRadius: 12,
            border: '2px solid rgba(47, 79, 79, 0.15)',
            background: 'linear-gradient(135deg, #fff 0%, #fafafa 100%)',
          }}
        >
          <Title level={5} style={{ marginBottom: 12, color: '#2F4F4F' }}>
            缓存说明
          </Title>
          <ul style={{
            margin: 0,
            paddingLeft: 20,
            color: '#708090',
            fontSize: 13,
            lineHeight: 1.8,
          }}>
            <li>缓存用于加速消息加载，再次打开会话秒开</li>
            <li>每5分钟自动同步最新消息</li>
            <li>30天前的消息会自动清理</li>
            <li>清理缓存不影响链上数据</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default CacheManagement;

