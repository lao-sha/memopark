/**
 * 函数级详细中文注释：支付页面组件
 * 
 * 功能：
 * 1. 显示支付二维码
 * 2. 15分钟倒计时
 * 3. 轮询订单状态
 * 4. 支付成功自动跳转
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Space,
  Alert,
  Button,
  QRCode,
  Statistic,
  Spin,
  Result,
  Row,
  Col,
  Tag,
  Steps,
} from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  WalletOutlined,
  QrcodeOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { CountdownTimer } from './components/CountdownTimer';
import { firstPurchaseApi } from './api';
import './styles.css';

const { Title, Text, Paragraph } = Typography;

export const PaymentPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [orderData, setOrderData] = useState<any>(location.state?.orderData);
  const [loading, setLoading] = useState<boolean>(!orderData);
  const [status, setStatus] = useState<string>('pending');
  const [countdown, setCountdown] = useState<number>(900);
  
  /**
   * 函数级详细中文注释：加载订单数据
   */
  useEffect(() => {
    if (orderData) return;
    
    const loadOrder = async () => {
      if (!orderId) return;
      
      try {
        setLoading(true);
        const result = await firstPurchaseApi.getOrderStatus(orderId);
        
        if (!result.exists) {
          navigate('/first-purchase');
          return;
        }
        
        setOrderData(result);
        setStatus(result.status);
        setCountdown(result.countdown);
      } catch (error) {
        console.error('加载订单失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadOrder();
  }, [orderId, orderData, navigate]);

  /**
   * 函数级详细中文注释：轮询订单状态
   */
  useEffect(() => {
    if (!orderId) return;
    if (status === 'completed' || status === 'expired') return;
    
    const poller = setInterval(async () => {
      try {
        const result = await firstPurchaseApi.getOrderStatus(orderId);
        setStatus(result.status);
        setCountdown(result.countdown);
        
        // 支付成功，跳转到成功页面
        if (result.status === 'completed') {
          navigate('/first-purchase/success', {
            state: { orderData: result },
          });
        }
        
        // 订单过期
        if (result.status === 'expired') {
          clearInterval(poller);
        }
      } catch (error) {
        console.error('轮询订单状态失败:', error);
      }
    }, 3000); // 每3秒轮询一次
    
    return () => clearInterval(poller);
  }, [orderId, status, navigate]);

  if (loading) {
    return (
      <div className="first-purchase-container">
        <Card>
          <Spin size="large" tip="加载订单中..." />
        </Card>
      </div>
    );
  }

  // 订单过期
  if (status === 'expired') {
    return (
      <div className="first-purchase-container">
        <Card>
          <Result
            status="warning"
            title="订单已过期"
            subTitle="订单未在15分钟内完成支付，已自动作废"
            extra={[
              <Button
                type="primary"
                key="create"
                onClick={() => navigate('/first-purchase')}
              >
                重新创建订单
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="first-purchase-container">
      <Card className="payment-card">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 标题 */}
          <div style={{ textAlign: 'center' }}>
            <Title level={2}>
              <QrcodeOutlined /> 扫码支付
            </Title>
            <Paragraph type="secondary">
              请在 15 分钟内完成支付
            </Paragraph>
          </div>

          {/* 倒计时 */}
          <Card size="small" style={{ background: '#fff7e6', borderColor: '#ffd666' }}>
            <CountdownTimer
              seconds={countdown}
              onExpire={() => setStatus('expired')}
            />
          </Card>

          {/* 进度条 */}
          <Steps
            current={status === 'pending' ? 0 : status === 'paid' ? 1 : 2}
            items={[
              {
                title: '等待支付',
                icon: status === 'pending' ? <LoadingOutlined /> : <CheckCircleOutlined />,
              },
              {
                title: '处理中',
                icon: status === 'paid' ? <LoadingOutlined /> : undefined,
              },
              {
                title: '完成',
              },
            ]}
          />

          {/* 二维码 */}
          <div style={{ textAlign: 'center' }}>
            <QRCode
              value={orderData?.paymentUrl || ''}
              size={256}
              errorLevel="H"
            />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                使用支付宝或微信扫码支付
              </Text>
            </div>
          </div>

          {/* 订单信息 */}
          <Card size="small" title="订单信息">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Row>
                <Col span={8}>
                  <Text type="secondary">订单号:</Text>
                </Col>
                <Col span={16}>
                  <Text code>{orderData?.orderId}</Text>
                </Col>
              </Row>
              
              <Row>
                <Col span={8}>
                  <Text type="secondary">购买数量:</Text>
                </Col>
                <Col span={16}>
                  <Text strong>{orderData?.amount} MEMO</Text>
                </Col>
              </Row>
              
              <Row>
                <Col span={8}>
                  <Text type="secondary">支付金额:</Text>
                </Col>
                <Col span={16}>
                  <Text strong style={{ color: '#1890ff', fontSize: 18 }}>
                    ¥ {orderData?.paymentAmount?.toFixed(2)}
                  </Text>
                </Col>
              </Row>
              
              {orderData?.referrer && (
                <Row>
                  <Col span={8}>
                    <Text type="secondary">推荐人:</Text>
                  </Col>
                  <Col span={16}>
                    <Text code>{orderData.referrer.slice(0, 8)}...</Text>
                    <Tag color="success" style={{ marginLeft: 8 }}>
                      9折优惠
                    </Tag>
                  </Col>
                </Row>
              )}
              
              <Row>
                <Col span={8}>
                  <Text type="secondary">状态:</Text>
                </Col>
                <Col span={16}>
                  {status === 'pending' && <Tag color="processing">等待支付</Tag>}
                  {status === 'paid' && <Tag color="warning">处理中</Tag>}
                  {status === 'completed' && <Tag color="success">已完成</Tag>}
                </Col>
              </Row>
            </Space>
          </Card>

          {/* 提示信息 */}
          <Alert
            type="info"
            message="支付提示"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>请在 15 分钟内完成支付，超时订单将自动作废</li>
                <li>支付成功后，MEMO 将自动发送到您的钱包地址</li>
                <li>如遇问题，请联系客服</li>
              </ul>
            }
            showIcon
          />

          {/* 返回按钮 */}
          <Button
            block
            onClick={() => navigate('/first-purchase')}
          >
            返回
          </Button>
        </Space>
      </Card>
    </div>
  );
};

