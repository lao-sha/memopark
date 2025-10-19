import React, { useState, useEffect } from 'react';
import { 
  Card, Form, Input, Button, Alert, Steps, Typography, 
  message, Space, Spin, Descriptions, Tag, Upload, Timeline 
} from 'antd';
import { 
  WarningOutlined, FileTextOutlined, CheckCircleOutlined, 
  CloseCircleOutlined, UploadOutlined, ArrowLeftOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined 
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { usePolkadot } from '@/providers/WalletProvider';
import { signAndSendTxWithPrompt } from '@/lib/polkadot-safe';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * 做市商投诉和仲裁页面
 * 
 * 功能：
 * - 用户查看兑换记录详情
 * - 超时后提交举报
 * - 上传证据到 IPFS
 * - 查看仲裁进度和结果
 * - 显示仲裁时间线
 */
export const MakerBridgeComplaintPage: React.FC = () => {
  const { swapId } = useParams<{ swapId: string }>();
  const { api, currentAccount } = usePolkadot();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  
  // 兑换记录
  const [swapRecord, setSwapRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  
  // 证据上传
  const [evidenceCid, setEvidenceCid] = useState<string>('');
  const [evidenceDescription, setEvidenceDescription] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  
  // 仲裁状态
  const [arbitrationResult, setArbitrationResult] = useState<any>(null);
  
  /**
   * 加载兑换记录
   */
  const loadSwapRecord = async () => {
    if (!api || !swapId) {
      message.error('参数错误');
      return;
    }
    
    setRecordLoading(true);
    try {
      const id = parseInt(swapId);
      const recordOpt = await api.query.simpleBridge.makerSwaps(id);
      
      if (recordOpt.isNone) {
        message.error('兑换记录不存在');
        navigate('/bridge/maker-list');
        return;
      }
      
      const record = recordOpt.unwrap();
      const recordData = {
        swapId: record.swap_id.toNumber(),
        makerId: record.maker_id.toNumber(),
        maker: record.maker.toHuman(),
        user: record.user.toHuman(),
        memoAmount: record.memo_amount.toNumber() / 1e12,
        usdtAmount: record.usdt_amount.toNumber() / 1_000_000,
        usdtAddress: record.usdt_address.toHuman(),
        createdAt: record.created_at.toNumber(),
        timeoutAt: record.timeout_at.toNumber(),
        trc20TxHash: record.trc20_tx_hash.isSome ? record.trc20_tx_hash.unwrap().toHuman() : null,
        completedAt: record.completed_at.isSome ? record.completed_at.unwrap().toNumber() : null,
        evidenceCid: record.evidence_cid.isSome ? record.evidence_cid.unwrap().toHuman() : null,
        status: record.status.toHuman(),
        priceUsdt: record.price_usdt.toNumber() / 1_000_000,
      };
      
      setSwapRecord(recordData);
      
      // 如果已有证据，显示
      if (recordData.evidenceCid) {
        setEvidenceCid(recordData.evidenceCid);
      }
      
    } catch (error: any) {
      console.error('加载兑换记录失败:', error);
      message.error(`加载失败: ${error.message || '未知错误'}`);
    } finally {
      setRecordLoading(false);
    }
  };
  
  /**
   * 提交举报
   */
  const handleSubmitComplaint = async (values: any) => {
    if (!api || !currentAccount || !swapId) {
      message.error('请先连接钱包');
      return;
    }
    
    if (!evidenceCid) {
      message.error('请先上传证据');
      return;
    }
    
    setLoading(true);
    try {
      const id = parseInt(swapId);
      
      // 调用链上方法
      const tx = api.tx.simpleBridge.reportMaker(
        id,
        evidenceCid
      );
      
      const hash = await signAndSendTxWithPrompt(tx, currentAccount.address);
      
      message.success(`举报已提交，等待委员会仲裁！交易哈希: ${hash.substring(0, 10)}...`);
      
      // 刷新记录
      await loadSwapRecord();
    } catch (error: any) {
      console.error('提交举报失败:', error);
      message.error(`举报失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 上传证据到 IPFS（模拟）
   * 实际应该调用 IPFS API
   */
  const handleUploadEvidence = async (file: any) => {
    setUploading(true);
    try {
      // TODO: 实际上传到 IPFS
      // const cid = await uploadToIPFS(file);
      
      // 模拟上传
      await new Promise(resolve => setTimeout(resolve, 2000));
      const mockCid = `Qm${Math.random().toString(36).substring(2, 15)}`;
      
      setEvidenceCid(mockCid);
      message.success(`证据已上传: ${mockCid}`);
    } catch (error: any) {
      console.error('上传证据失败:', error);
      message.error(`上传失败: ${error.message || '未知错误'}`);
    } finally {
      setUploading(false);
    }
    
    return false; // 阻止默认上传行为
  };
  
  /**
   * 检查是否超时
   */
  const isTimeout = () => {
    if (!swapRecord) return false;
    const currentBlock = Date.now() / 1000 / 6; // 模拟当前区块
    return currentBlock > swapRecord.timeoutAt;
  };
  
  /**
   * 检查用户是否为兑换发起者
   */
  const isSwapUser = () => {
    if (!swapRecord || !currentAccount) return false;
    return swapRecord.user === currentAccount.address;
  };
  
  // 初始加载
  useEffect(() => {
    loadSwapRecord();
  }, [api, swapId]);
  
  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'Pending':
        return <Tag color="processing" icon={<ClockCircleOutlined />}>等待转账</Tag>;
      case 'Completed':
        return <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>;
      case 'UserReported':
        return <Tag color="warning" icon={<ExclamationCircleOutlined />}>用户已举报</Tag>;
      case 'Arbitrating':
        return <Tag color="orange" icon={<ClockCircleOutlined />}>仲裁中</Tag>;
      case 'ArbitrationApproved':
        return <Tag color="success" icon={<CheckCircleOutlined />}>仲裁通过</Tag>;
      case 'ArbitrationRejected':
        return <Tag color="error" icon={<CloseCircleOutlined />}>仲裁拒绝（做市商违约）</Tag>;
      case 'Refunded':
        return <Tag color="default" icon={<CheckCircleOutlined />}>已退款</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };
  
  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <Card>
        {/* 返回按钮 */}
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/bridge/maker-list')}
          style={{ marginBottom: 16 }}
        >
          返回列表
        </Button>
        
        {/* 页面标题 */}
        <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: 24 }}>
          <Title level={2}>
            <WarningOutlined /> 投诉与仲裁
          </Title>
          <Paragraph type="secondary">
            如果做市商超过 30 分钟未转账，您可以提交举报并上传证据。委员会将在 3 天内进行仲裁。
          </Paragraph>
        </Space>
        
        {recordLoading ? (
          <Spin tip="加载兑换记录..." />
        ) : swapRecord ? (
          <>
            {/* 兑换记录详情 */}
            <Card title="兑换记录详情" style={{ marginBottom: 24 }}>
              <Descriptions column={2} bordered>
                <Descriptions.Item label="兑换 ID">{swapRecord.swapId}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  {getStatusTag(swapRecord.status)}
                </Descriptions.Item>
                <Descriptions.Item label="做市商 ID">{swapRecord.makerId}</Descriptions.Item>
                <Descriptions.Item label="做市商地址">
                  <Text copyable ellipsis style={{ maxWidth: 200 }}>
                    {swapRecord.maker}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="MEMO 数量">
                  {swapRecord.memoAmount.toFixed(2)} MEMO
                </Descriptions.Item>
                <Descriptions.Item label="USDT 金额">
                  {swapRecord.usdtAmount.toFixed(2)} USDT
                </Descriptions.Item>
                <Descriptions.Item label="USDT 地址">
                  <Text copyable ellipsis style={{ maxWidth: 200 }}>
                    {swapRecord.usdtAddress}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="兑换价格">
                  {swapRecord.priceUsdt.toFixed(4)} USDT/MEMO
                </Descriptions.Item>
                {swapRecord.trc20TxHash && (
                  <Descriptions.Item label="TRC20 交易哈希" span={2}>
                    <Text copyable ellipsis style={{ maxWidth: 400 }}>
                      {swapRecord.trc20TxHash}
                    </Text>
                  </Descriptions.Item>
                )}
                {swapRecord.evidenceCid && (
                  <Descriptions.Item label="证据 CID" span={2}>
                    <Text copyable ellipsis style={{ maxWidth: 400 }}>
                      {swapRecord.evidenceCid}
                    </Text>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
            
            {/* 根据状态显示不同内容 */}
            
            {/* 状态：Pending 且超时 */}
            {swapRecord.status === 'Pending' && isTimeout() && isSwapUser() && (
              <Card title="提交举报" style={{ marginBottom: 24 }}>
                <Alert
                  message="做市商已超时"
                  description="做市商超过 30 分钟未转账 USDT，您可以提交举报并上传证据（如聊天记录、截图等）。"
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
                  style={{ marginBottom: 16 }}
                />
                
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSubmitComplaint}
                >
                  <Form.Item
                    label="证据说明"
                    name="description"
                    rules={[{ required: true, message: '请输入证据说明' }]}
                  >
                    <TextArea
                      rows={4}
                      placeholder="请描述您的投诉理由，以及提供的证据内容..."
                      onChange={(e) => setEvidenceDescription(e.target.value)}
                    />
                  </Form.Item>
                  
                  <Form.Item label="上传证据">
                    <Upload
                      name="evidence"
                      beforeUpload={handleUploadEvidence}
                      maxCount={1}
                    >
                      <Button 
                        icon={<UploadOutlined />} 
                        loading={uploading}
                      >
                        {uploading ? '上传中...' : '选择文件'}
                      </Button>
                    </Upload>
                    {evidenceCid && (
                      <Alert
                        message={`已上传: ${evidenceCid}`}
                        type="success"
                        showIcon
                        style={{ marginTop: 8 }}
                      />
                    )}
                  </Form.Item>
                  
                  <Form.Item>
                    <Button 
                      type="primary" 
                      htmlType="submit" 
                      block
                      danger
                      icon={<WarningOutlined />}
                      loading={loading}
                      disabled={!evidenceCid}
                    >
                      提交举报
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            )}
            
            {/* 状态：UserReported 或 Arbitrating */}
            {(swapRecord.status === 'UserReported' || swapRecord.status === 'Arbitrating') && (
              <Card title="仲裁进度" style={{ marginBottom: 24 }}>
                <Alert
                  message="已进入仲裁流程"
                  description="委员会将在 3 天内进行仲裁，请耐心等待结果。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                
                <Timeline>
                  <Timeline.Item color="green">
                    <Text>用户提交举报</Text>
                    <br />
                    <Text type="secondary">证据 CID: {swapRecord.evidenceCid}</Text>
                  </Timeline.Item>
                  <Timeline.Item color="blue">
                    <Text>委员会审核中...</Text>
                  </Timeline.Item>
                  <Timeline.Item color="gray">
                    <Text type="secondary">等待仲裁结果</Text>
                  </Timeline.Item>
                </Timeline>
              </Card>
            )}
            
            {/* 状态：ArbitrationApproved（做市商履约）*/}
            {swapRecord.status === 'ArbitrationApproved' && (
              <Card style={{ textAlign: 'center', marginBottom: 24 }}>
                <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
                <Title level={3} style={{ marginTop: 16, color: '#52c41a' }}>
                  仲裁通过
                </Title>
                <Paragraph type="secondary">
                  委员会认定做市商已履行转账义务，兑换已完成。
                </Paragraph>
              </Card>
            )}
            
            {/* 状态：ArbitrationRejected（做市商违约）*/}
            {swapRecord.status === 'ArbitrationRejected' && (
              <Card style={{ textAlign: 'center', marginBottom: 24 }}>
                <CloseCircleOutlined style={{ fontSize: 64, color: '#cf1322' }} />
                <Title level={3} style={{ marginTop: 16, color: '#cf1322' }}>
                  做市商违约
                </Title>
                <Paragraph type="secondary">
                  委员会认定做市商未履行转账义务，您已获得退款并获得 20% 补偿（从做市商押金扣除）。
                </Paragraph>
                <Alert
                  message="补偿金额"
                  description={`原兑换金额 ${swapRecord.memoAmount.toFixed(2)} MEMO + 20% 补偿 = ${(swapRecord.memoAmount * 1.2).toFixed(2)} MEMO`}
                  type="success"
                  showIcon
                />
              </Card>
            )}
            
            {/* 状态：Refunded（超时退款）*/}
            {swapRecord.status === 'Refunded' && (
              <Card style={{ textAlign: 'center', marginBottom: 24 }}>
                <CheckCircleOutlined style={{ fontSize: 64, color: '#1890ff' }} />
                <Title level={3} style={{ marginTop: 16, color: '#1890ff' }}>
                  已退款
                </Title>
                <Paragraph type="secondary">
                  由于做市商长时间未响应，系统已自动退款。
                </Paragraph>
              </Card>
            )}
            
            {/* 权限提示 */}
            {!isSwapUser() && (
              <Alert
                message="权限限制"
                description="您不是该兑换的发起者，无法提交举报。"
                type="warning"
                showIcon
              />
            )}
          </>
        ) : (
          <Alert
            message="兑换记录不存在"
            description="无法找到该兑换记录，请检查兑换 ID 是否正确。"
            type="error"
            showIcon
          />
        )}
      </Card>
    </div>
  );
};

export default MakerBridgeComplaintPage;

