/**
 * 节点状态检查组件
 *
 * 功能：
 * - 自动检测节点状态
 * - 显示友好的错误提示
 * - 提供启动指引
 */

import React, { useState, useEffect } from 'react';
import { Alert, Button, Space, Modal, Typography, Steps, Spin } from 'antd';
import {
  ExclamationCircleOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import {
  checkNodeStatus,
  getStartNodeHelp,
  type NodeStatus,
} from '../services/nodeStatusService';

const { Text, Paragraph } = Typography;

interface NodeStatusCheckerProps {
  /** 检查成功后的回调 */
  onSuccess?: () => void;
  /** 是否自动检查 */
  autoCheck?: boolean;
  /** 检查间隔（毫秒） */
  checkInterval?: number;
}

/**
 * 节点状态检查组件
 */
export const NodeStatusChecker: React.FC<NodeStatusCheckerProps> = ({
  onSuccess,
  autoCheck = true,
  checkInterval = 5000,
}) => {
  const [status, setStatus] = useState<NodeStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);

  /**
   * 检查节点状态
   */
  const checkStatus = async () => {
    setChecking(true);
    try {
      const result = await checkNodeStatus();
      setStatus(result);

      if (result.isOnline && result.hasBaziChart) {
        onSuccess?.();
      }
    } catch (error) {
      console.error('[NodeStatusChecker] 检查失败:', error);
    } finally {
      setChecking(false);
    }
  };

  /**
   * 自动检查
   */
  useEffect(() => {
    if (!autoCheck) return;

    checkStatus();

    const interval = setInterval(() => {
      checkStatus();
    }, checkInterval);

    return () => clearInterval(interval);
  }, [autoCheck, checkInterval]);

  /**
   * 显示帮助弹窗
   */
  const showHelp = () => {
    setHelpModalVisible(true);
  };

  /**
   * 渲染状态图标
   */
  const renderStatusIcon = () => {
    if (checking) {
      return <Spin size="small" />;
    }

    if (!status) {
      return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
    }

    if (status.isOnline && status.hasBaziChart) {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    }

    return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
  };

  /**
   * 渲染状态消息
   */
  const renderStatusMessage = () => {
    if (checking) {
      return '正在检查节点状态...';
    }

    if (!status) {
      return '等待检查节点状态';
    }

    if (status.isOnline && status.hasBaziChart) {
      return '✓ 节点状态正常';
    }

    return status.userMessage || '节点状态异常';
  };

  /**
   * 获取告警类型
   */
  const getAlertType = (): 'success' | 'info' | 'warning' | 'error' => {
    if (!status || checking) return 'info';
    if (status.isOnline && status.hasBaziChart) return 'success';
    if (!status.isOnline) return 'error';
    return 'warning';
  };

  // 节点正常，不显示提示
  if (status?.isOnline && status?.hasBaziChart) {
    return null;
  }

  const help = getStartNodeHelp();

  return (
    <>
      <Alert
        message={
          <Space>
            {renderStatusIcon()}
            <Text strong>{renderStatusMessage()}</Text>
          </Space>
        }
        description={
          status && !status.hasBaziChart && (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Paragraph style={{ marginBottom: 8 }}>
                {status.userMessage}
              </Paragraph>
              <Space>
                <Button
                  size="small"
                  icon={<InfoCircleOutlined />}
                  onClick={showHelp}
                >
                  查看启动指引
                </Button>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={checkStatus}
                  loading={checking}
                >
                  重新检查
                </Button>
              </Space>
            </Space>
          )
        }
        type={getAlertType()}
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            {help.title}
          </Space>
        }
        open={helpModalVisible}
        onCancel={() => setHelpModalVisible(false)}
        footer={
          <Space>
            <Button onClick={() => setHelpModalVisible(false)}>
              我知道了
            </Button>
            <Button type="primary" icon={<ReloadOutlined />} onClick={checkStatus}>
              重新检查
            </Button>
          </Space>
        }
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Steps
            direction="vertical"
            size="small"
            current={-1}
            items={help.steps.map((step, index) => ({
              title: step,
              status: 'wait',
            }))}
          />

          <Alert
            message="启动命令"
            description={
              <pre
                style={{
                  backgroundColor: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '4px',
                  marginTop: '8px',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  navigator.clipboard.writeText(help.command);
                  Modal.success({
                    title: '已复制',
                    content: '命令已复制到剪贴板',
                  });
                }}
              >
                {help.command}
              </pre>
            }
            type="info"
          />

          <Alert
            message="提示"
            description="节点启动后会自动开始出块，首次启动可能需要10-30秒。启动成功后刷新此页面即可。"
            type="warning"
            showIcon
          />
        </Space>
      </Modal>
    </>
  );
};

export default NodeStatusChecker;
