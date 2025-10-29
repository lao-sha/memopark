/**
 * 统一投诉按钮组件
 * 
 * 功能：
 * 1. 根据上下文自动判断投诉类型
 * 2. 弹出投诉表单Modal
 * 3. 处理投诉提交流程
 * 4. 显示进度和结果
 * 
 * @author Memopark Team
 * @version 1.0.0
 * @date 2025-10-27
 */

import React, { useState } from 'react';
import { Button, Modal, Form, Upload, Input, message, Progress, Alert } from 'antd';
import { ExclamationCircleOutlined, UploadOutlined } from '@ant-design/icons';
import { usePolkadotApi } from '../hooks/usePolkadotApi';
import { useWallet } from '../hooks/useWallet';
import UnifiedComplaintService, { ComplaintType, ComplaintResult } from '../services/unified-complaint';

const { TextArea } = Input;

// ============= 类型定义 =============

export interface ComplaintButtonProps {
  /** 投诉类型 */
  type: ComplaintType;
  /** 目标对象ID */
  targetId: string;
  /** 操作类型 */
  action: number;
  /** 按钮文本 */
  buttonText?: string;
  /** 按钮类型 */
  buttonType?: 'primary' | 'default' | 'link' | 'text';
  /** 投诉成功回调 */
  onSuccess?: (result: ComplaintResult) => void;
  /** 投诉失败回调 */
  onError?: (error: Error) => void;
}

interface FormValues {
  evidence: any[];
  reason?: string;
}

// ============= 主组件 =============

export const ComplaintButton: React.FC<ComplaintButtonProps> = ({
  type,
  targetId,
  action,
  buttonText = '投诉',
  buttonType = 'link',
  onSuccess,
  onError,
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [form] = Form.useForm<FormValues>();
  
  const { api } = usePolkadotApi();
  const { account, signer } = useWallet();

  /**
   * 打开投诉Modal
   */
  const handleOpen = () => {
    if (!account) {
      message.error('请先连接钱包');
      return;
    }
    setOpen(true);
  };

  /**
   * 关闭Modal并重置表单
   */
  const handleClose = () => {
    setOpen(false);
    form.resetFields();
    setProgress(0);
  };

  /**
   * 提交投诉
   */
  const handleSubmit = async (values: FormValues) => {
    if (!api || !signer) {
      message.error('未连接到区块链网络');
      return;
    }

    try {
      setLoading(true);
      setProgress(10);

      // 1. 创建服务实例
      const service = new UnifiedComplaintService(api, signer);

      // 2. 准备证据文件
      const evidenceFiles: File[] = values.evidence
        ? values.evidence.map((file: any) => file.originFileObj)
        : [];

      if (evidenceFiles.length === 0) {
        message.error('请至少上传一个证据文件');
        setLoading(false);
        return;
      }

      setProgress(30);

      // 3. 提交投诉
      message.info('正在上传证据到IPFS...');
      const result = await service.submitComplaint({
        type,
        targetId,
        action,
        evidence: evidenceFiles,
        reason: values.reason,
      });

      setProgress(100);

      // 4. 成功提示
      message.success({
        content: (
          <div>
            <div>投诉已提交成功！</div>
            <div>申诉ID: {result.id}</div>
            <div>交易Hash: {result.txHash.slice(0, 10)}...</div>
          </div>
        ),
        duration: 5,
      });

      // 5. 回调
      onSuccess?.(result);

      // 6. 关闭Modal
      handleClose();
    } catch (error: any) {
      console.error('[ComplaintButton] 提交失败:', error);
      message.error(`投诉提交失败: ${error.message || '未知错误'}`);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取投诉类型的中文名称
   */
  const getTypeName = (): string => {
    const typeNames: Record<ComplaintType, string> = {
      [ComplaintType.DeceasedText]: '逝者文本',
      [ComplaintType.DeceasedMedia]: '逝者媒体',
      [ComplaintType.Grave]: '墓地',
      [ComplaintType.OtcOrder]: 'OTC订单',
      [ComplaintType.SimpleBridge]: '跨链桥接',
    };
    return typeNames[type] || '未知';
  };

  /**
   * 获取投诉说明
   */
  const getDescription = (): string => {
    const descriptions: Record<ComplaintType, string> = {
      [ComplaintType.DeceasedText]: '如果您发现该文本内容存在违规、不当或侵权行为，请提供相关证据进行投诉。',
      [ComplaintType.DeceasedMedia]: '如果您发现该媒体内容存在违规、不当或侵权行为，请提供相关证据进行投诉。',
      [ComplaintType.Grave]: '如果您发现该墓地存在违规行为，请提供相关证据进行投诉。',
      [ComplaintType.OtcOrder]: '如果您认为该订单存在欺诈或违约行为，请提供相关证据发起争议。',
      [ComplaintType.SimpleBridge]: '如果您认为该桥接记录存在问题，请提供相关证据发起争议。',
    };
    return descriptions[type] || '请提供相关证据进行投诉。';
  };

  return (
    <>
      <Button
        type={buttonType}
        icon={<ExclamationCircleOutlined />}
        onClick={handleOpen}
        danger
      >
        {buttonText}
      </Button>

      <Modal
        title={`投诉${getTypeName()}`}
        open={open}
        onCancel={handleClose}
        onOk={() => form.submit()}
        okText="提交投诉"
        cancelText="取消"
        confirmLoading={loading}
        width={600}
      >
        <Alert
          message="投诉说明"
          description={getDescription()}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        {loading && (
          <Progress
            percent={progress}
            status="active"
            style={{ marginBottom: 16 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="evidence"
            label="证据文件"
            rules={[{ required: true, message: '请上传至少一个证据文件' }]}
            extra="支持图片、PDF、视频等格式，文件将上传到IPFS"
          >
            <Upload
              beforeUpload={() => false}
              multiple
              maxCount={5}
              listType="picture"
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>

          <Form.Item
            name="reason"
            label="投诉理由"
            extra="请详细说明投诉原因（可选）"
          >
            <TextArea
              rows={4}
              placeholder="请描述具体的投诉理由..."
              maxLength={1000}
              showCount
            />
          </Form.Item>
        </Form>

        <Alert
          message="注意事项"
          description={
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              <li>提交投诉需要冻结押金（根据历史记录动态计算）</li>
              <li>如果投诉被驳回，将罚没30%押金</li>
              <li>如果投诉成功，押金将全额退回并获得20%奖励</li>
              <li>提交后可在"我的投诉"中查看进度</li>
            </ul>
          }
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Modal>
    </>
  );
};

export default ComplaintButton;

