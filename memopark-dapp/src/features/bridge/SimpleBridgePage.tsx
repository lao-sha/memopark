import React, { useState, useEffect } from 'react';
import { Card, Form, InputNumber, Input, Button, Alert, Steps, Statistic, Row, Col, message, Typography, Tag, Space, Spin } from 'antd';
import { SwapOutlined, CheckCircleOutlined, LoadingOutlined, WalletOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { usePolkadot } from '@/providers/WalletProvider';
import { signAndSendTxWithPassword } from '@/lib/polkadot-safe';

const { Title, Text, Paragraph } = Typography;

/**
 * 极简桥接页面组件（动态均价版）
 * 
 * 功能：
 * - MEMO → USDT (TRC20) 兑换
 * - 动态汇率：基于 pallet-pricing 的市场加权均价（OTC + Bridge）
 * - 冷启动阶段：使用 pallet-pricing 的默认价格（当前为 0.000001 USDT/MEMO）
 * - 手续费：0.3%
 * - 最小兑换：100 MEMO
 */
export const SimpleBridgePage: React.FC = () => {
    const { api, currentAccount } = usePolkadot();
    const [form] = Form.useForm();
    
    // 表单状态
    const [memoAmount, setMemoAmount] = useState<number>(0);
    const [tronAddress, setTronAddress] = useState<string>('');
    
    // 流程状态
    const [step, setStep] = useState(0);
    const [swapId, setSwapId] = useState<number>();
    const [actualPrice, setActualPrice] = useState<number>(0); // 实际使用的汇率
    const [loading, setLoading] = useState(false);
    
    // 余额状态
    const [balance, setBalance] = useState<string>('0');
    
    // 市场价格状态
    const [marketPrice, setMarketPrice] = useState<number>(0);
    const [priceLoading, setPriceLoading] = useState(false);
    const [priceError, setPriceError] = useState<string>('');
    
    // 固定配置
    const FEE_RATE = 0.003;     // 0.3% 手续费
    const MIN_AMOUNT = 100;     // 最小 100 MEMO
    const FALLBACK_RATE = 0.000001;  // 备用汇率（与 pallet-pricing DefaultPrice 一致）
    
    // 使用市场价格（如果为0则使用备用汇率）
    const currentRate = marketPrice > 0 ? marketPrice : FALLBACK_RATE;
    const isFallback = marketPrice === 0;
    
    // 计算预估金额
    const estimatedUsdt = memoAmount * currentRate;
    const fee = estimatedUsdt * FEE_RATE;
    const netUsdt = estimatedUsdt - fee;
    
    // 加载余额
    useEffect(() => {
        if (api && currentAccount) {
            loadBalance();
        }
    }, [api, currentAccount]);
    
    // 加载市场价格
    useEffect(() => {
        if (api) {
            loadMarketPrice();
            // 每 10 秒刷新一次价格
            const interval = setInterval(loadMarketPrice, 10000);
            return () => clearInterval(interval);
        }
    }, [api]);
    
    const loadBalance = async () => {
        if (!api || !currentAccount) return;
        
        try {
            const account = await api.query.system.account(currentAccount.address);
            const free = account.data.free.toString();
            const formatted = (parseFloat(free) / 1e12).toFixed(2);
            setBalance(formatted);
        } catch (error) {
            console.error('加载余额失败:', error);
        }
    };
    
    const loadMarketPrice = async () => {
        if (!api) return;
        
        setPriceLoading(true);
        setPriceError('');
        
        try {
            /**
             * 函数级详细中文注释：价格获取逻辑（2025-10-19 更新）
             * 
             * SimpleBridge 已删除 FallbackExchangeRate 存储项。
             * 现在 SimpleBridge 直接使用 pallet-pricing::get_memo_market_price_weighted() 的返回值。
             * 
             * pallet-pricing 的价格返回逻辑：
             * 1. 冷启动阶段（交易量 < 1亿 MEMO）：返回 DefaultPrice（当前为 0.000001 USDT/MEMO）
             * 2. 正常运行阶段：返回市场加权均价
             * 3. 无交易数据：返回 DefaultPrice
             * 
             * 因此前端直接读取 pallet-pricing 的 DefaultPrice 作为参考价格。
             * 注意：此价格仅用于前端展示，实际兑换时使用链端实时计算的价格。
             */
            
            // 从 pallet-pricing 获取默认价格
            const defaultPrice = await api.query.pricing.defaultPrice();
            const priceU64 = defaultPrice.toNumber();
            
            // 转换为 USDT/MEMO（精度 10^6）
            const priceUsdt = priceU64 / 1e6;
            setMarketPrice(priceUsdt);
            
            console.log('pallet-pricing 默认价格:', priceUsdt, 'USDT/MEMO');
            console.log('原始值（精度 10^6）:', priceU64);
        } catch (error: any) {
            console.error('加载默认价格失败:', error);
            setPriceError(error.message || '价格加载失败');
            // 失败时使用前端硬编码的备用汇率
            setMarketPrice(0);
        } finally {
            setPriceLoading(false);
        }
    };
    
    const handleSwap = async () => {
        if (!api || !currentAccount) {
            message.error('请先连接钱包');
            return;
        }
        
        // 验证表单
        if (!memoAmount || memoAmount < MIN_AMOUNT) {
            message.error(`最小兑换金额为 ${MIN_AMOUNT} MEMO`);
            return;
        }
        
        if (!tronAddress || !tronAddress.startsWith('T')) {
            message.error('请输入有效的波场地址（T 开头）');
            return;
        }
        
        setLoading(true);
        
        try {
            // 调用 simpleBridge.swap
            const tx = api.tx.simpleBridge.swap(
                BigInt(memoAmount * 1e12), // MEMO 12位小数
                tronAddress
            );
            
            await signAndSendTxWithPassword(
                tx,
                currentAccount.address,
                (status, events) => {
                    if (status.isInBlock) {
                        message.success('兑换请求已创建');
                        setStep(1);
                        
                        // 从事件中提取 swap ID 和实际汇率
                        if (events) {
                            events.forEach(({ event }: any) => {
                                if (event.section === 'simpleBridge' && event.method === 'SwapCreated') {
                                    const id = event.data.id?.toNumber() || event.data[0].toNumber();
                                    const priceUsdt = event.data.price_usdt?.toNumber() || event.data[4]?.toNumber();
                                    
                                    setSwapId(id);
                                    if (priceUsdt) {
                                        const actualRate = priceUsdt / 1e6;
                                        setActualPrice(actualRate);
                                        console.log('Swap ID:', id, '实际汇率:', actualRate, 'USDT/MEMO');
                                    }
                                }
                            });
                        }
                    }
                    if (status.isFinalized) {
                        message.success('USDT 将在 1-2 分钟内到账');
                        setStep(2);
                        setLoading(false);
                        
                        // 刷新余额
                        setTimeout(() => {
                            loadBalance();
                            loadMarketPrice(); // 同时刷新价格
                        }, 2000);
                    }
                }
            );
        } catch (error: any) {
            console.error('兑换失败:', error);
            message.error(error.message || '兑换失败');
            setLoading(false);
        }
    };
    
    const handleReset = () => {
        setStep(0);
        setSwapId(undefined);
        setActualPrice(0);
        setMemoAmount(0);
        setTronAddress('');
        form.resetFields();
        loadBalance();
        loadMarketPrice();
    };
    
    // 使用实际汇率重新计算（用于显示最终到账金额）
    const finalUsdt = actualPrice > 0 ? memoAmount * actualPrice : netUsdt;
    const finalFee = actualPrice > 0 ? finalUsdt * FEE_RATE : fee;
    const finalNet = finalUsdt - finalFee;
    
    return (
        <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
            {/* 标题 */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <Title level={2}>
                    <SwapOutlined /> MEMO → USDT 快速兑换
                </Title>
                <Paragraph type="secondary">
                    极简托管式桥接 · 动态市场均价 · 1-2分钟到账
                </Paragraph>
            </div>
            
            {/* 步骤指示器 */}
            <Steps current={step} items={[
                { title: '填写信息', icon: step === 0 ? <WalletOutlined /> : undefined },
                { title: '处理中', icon: step === 1 ? <LoadingOutlined /> : undefined },
                { title: '完成', icon: step === 2 ? <CheckCircleOutlined /> : undefined },
            ]} style={{ marginBottom: '32px' }} />
            
            <Card>
                {/* 步骤 0: 填写表单 */}
                {step === 0 && (
                    <>
                        {/* 市场价格显示 */}
                        <Card 
                            size="small" 
                            title={
                                <Space>
                                    <InfoCircleOutlined />
                                    <span>实时市场价格</span>
                                </Space>
                            }
                            extra={
                                <Button 
                                    size="small" 
                                    onClick={loadMarketPrice}
                                    loading={priceLoading}
                                >
                                    刷新
                                </Button>
                            }
                            style={{ marginBottom: '24px', background: '#e6f7ff', borderColor: '#91d5ff' }}
                        >
                            {priceLoading ? (
                                <Spin size="small" />
                            ) : priceError ? (
                                <Alert
                                    message="价格加载失败"
                                    description={`${priceError}，将使用备用汇率 ${FALLBACK_RATE} USDT/MEMO`}
                                    type="warning"
                                    showIcon
                                    closable
                                />
                            ) : (
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Statistic
                                            title="市场均价"
                                            value={currentRate}
                                            precision={6}
                                            suffix="USDT/MEMO"
                                            valueStyle={{ color: isFallback ? '#faad14' : '#3f8600' }}
                                        />
                                        {isFallback && (
                                            <Tag color="warning" style={{ marginTop: 8 }}>
                                                冷启动阶段（使用默认价格）
                                            </Tag>
                                        )}
                                    </Col>
                                    <Col span={12}>
                                        <Statistic
                                            title="数据来源"
                                            value={isFallback ? "备用汇率" : "OTC + Bridge 加权均价"}
                                            valueStyle={{ fontSize: '14px' }}
                                        />
                                    </Col>
                                </Row>
                            )}
                        </Card>
                        
                        {/* 余额显示 */}
                        {currentAccount && (
                            <Alert
                                message={
                                    <Space>
                                        <Text>当前余额:</Text>
                                        <Text strong>{balance} MEMO</Text>
                                    </Space>
                                }
                                type="info"
                                showIcon
                                style={{ marginBottom: '24px' }}
                            />
                        )}
                        
                        <Form form={form} layout="vertical">
                            <Form.Item 
                                label="MEMO 数量" 
                                required
                                help={`最小 ${MIN_AMOUNT} MEMO`}
                            >
                                <InputNumber
                                    value={memoAmount}
                                    onChange={(value) => setMemoAmount(value || 0)}
                                    min={MIN_AMOUNT}
                                    max={parseFloat(balance)}
                                    style={{ width: '100%' }}
                                    size="large"
                                    addonAfter="MEMO"
                                    placeholder={`输入 ${MIN_AMOUNT} 或更多`}
                                />
                            </Form.Item>
                            
                            <Form.Item 
                                label="波场地址 (TRON)" 
                                required
                                help="您的 TRON 钱包地址（T 开头）"
                            >
                                <Input
                                    value={tronAddress}
                                    onChange={(e) => setTronAddress(e.target.value)}
                                    placeholder="TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS"
                                    size="large"
                                />
                            </Form.Item>
                        </Form>
                        
                        {/* 兑换预估 */}
                        <Card 
                            size="small" 
                            style={{ 
                                background: '#f5f5f5', 
                                marginBottom: '24px',
                                border: 'none'
                            }}
                        >
                            <Row gutter={[16, 16]}>
                                <Col span={12}>
                                    <Statistic 
                                        title="当前汇率" 
                                        value={currentRate}
                                        suffix="USDT/MEMO"
                                        precision={6}
                                        valueStyle={{ color: isFallback ? '#faad14' : undefined }}
                                    />
                                </Col>
                                <Col span={12}>
                                    <Statistic 
                                        title="手续费率" 
                                        value={FEE_RATE * 100}
                                        suffix="%"
                                        precision={2}
                                    />
                                </Col>
                                <Col span={12}>
                                    <Statistic 
                                        title="USDT 总额" 
                                        value={estimatedUsdt}
                                        suffix="USDT"
                                        precision={6}
                                    />
                                </Col>
                                <Col span={12}>
                                    <Statistic 
                                        title="预计到账" 
                                        value={netUsdt}
                                        suffix="USDT"
                                        precision={6}
                                        valueStyle={{ color: '#3f8600' }}
                                    />
                                </Col>
                            </Row>
                        </Card>
                        
                        {/* 手续费说明 */}
                        <Alert
                            message={`手续费: ${fee.toFixed(6)} USDT (${FEE_RATE * 100}%)`}
                            description="手续费用于支付 TRON 网络 Gas 和服务运营成本"
                            type="warning"
                            showIcon
                            style={{ marginBottom: '24px' }}
                        />
                        
                        {/* 提交按钮 */}
                        <Button
                            type="primary"
                            size="large"
                            block
                            icon={<SwapOutlined />}
                            onClick={handleSwap}
                            disabled={!currentAccount || !memoAmount || !tronAddress || priceLoading}
                            loading={loading}
                        >
                            {!currentAccount ? '请先连接钱包' : '立即兑换'}
                        </Button>
                        
                        {/* 风险提示 */}
                        <Alert
                            message="重要提示"
                            description={
                                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                    <li>请仔细核对波场地址，转错地址无法找回</li>
                                    <li>汇率基于实时市场均价，提交时会锁定价格</li>
                                    <li>USDT 将在 1-2 分钟内到账您的波场地址</li>
                                    <li>如有问题，请联系客服</li>
                                </ul>
                            }
                            type="info"
                            showIcon
                            style={{ marginTop: '24px' }}
                        />
                    </>
                )}
                
                {/* 步骤 1 & 2: 处理中 / 完成 */}
                {step > 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        {step === 1 ? (
                            <>
                                <LoadingOutlined style={{ fontSize: '64px', color: '#1890ff', marginBottom: '24px' }} />
                                <Title level={4}>正在处理兑换...</Title>
                                <Paragraph type="secondary">
                                    桥接服务正在发送 USDT 到您的波场地址
                                </Paragraph>
                            </>
                        ) : (
                            <>
                                <CheckCircleOutlined style={{ fontSize: '64px', color: '#52c41a', marginBottom: '24px' }} />
                                <Title level={4}>兑换成功！</Title>
                                <Paragraph type="secondary">
                                    USDT 将在 1-2 分钟内到账
                                </Paragraph>
                            </>
                        )}
                        
                        {/* 兑换详情 */}
                        <Card 
                            size="small" 
                            style={{ 
                                textAlign: 'left', 
                                marginTop: '24px',
                                background: '#fafafa'
                            }}
                        >
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <div>
                                    <Text type="secondary">兑换 ID:</Text>{' '}
                                    <Tag color="blue">{swapId}</Tag>
                                </div>
                                <div>
                                    <Text type="secondary">MEMO 数量:</Text>{' '}
                                    <Text strong>{memoAmount} MEMO</Text>
                                </div>
                                {actualPrice > 0 && (
                                    <div>
                                        <Text type="secondary">实际汇率:</Text>{' '}
                                        <Text strong style={{ color: '#1890ff' }}>{actualPrice.toFixed(6)} USDT/MEMO</Text>
                                    </div>
                                )}
                                <div>
                                    <Text type="secondary">USDT 到账:</Text>{' '}
                                    <Text strong style={{ color: '#52c41a' }}>
                                        {actualPrice > 0 ? finalNet.toFixed(6) : netUsdt.toFixed(6)} USDT
                                    </Text>
                                </div>
                                <div>
                                    <Text type="secondary">波场地址:</Text>{' '}
                                    <Text code>{tronAddress}</Text>
                                </div>
                            </Space>
                        </Card>
                        
                        {/* 操作按钮 */}
                        {step === 2 && (
                            <Button
                                type="primary"
                                size="large"
                                onClick={handleReset}
                                style={{ marginTop: '24px' }}
                            >
                                再次兑换
                            </Button>
                        )}
                        
                        {/* 提示信息 */}
                        <Alert
                            message="温馨提示"
                            description={
                                step === 1 
                                    ? "请勿关闭页面，等待处理完成"
                                    : "可以在波场浏览器查询 USDT 到账情况"
                            }
                            type="info"
                            showIcon
                            style={{ marginTop: '24px' }}
                        />
                    </div>
                )}
            </Card>
            
            {/* FAQ */}
            <Card title="常见问题" style={{ marginTop: '24px' }}>
                <Paragraph>
                    <Text strong>Q: 多久能到账？</Text><br />
                    A: 通常 1-2 分钟，最长不超过 5 分钟。
                </Paragraph>
                <Paragraph>
                    <Text strong>Q: 最小兑换金额是多少？</Text><br />
                    A: 最小 {MIN_AMOUNT} MEMO。
                </Paragraph>
                <Paragraph>
                    <Text strong>Q: 手续费怎么算？</Text><br />
                    A: 固定 {FEE_RATE * 100}%，用于支付 TRON Gas 和服务运营。
                </Paragraph>
                <Paragraph>
                    <Text strong>Q: 汇率是怎么确定的？</Text><br />
                    A: 基于 pallet-pricing 的市场加权均价（OTC + Bridge 交易数据），每笔兑换提交时锁定价格，确保公平透明。
                </Paragraph>
                <Paragraph>
                    <Text strong>Q: 什么是冷启动阶段？</Text><br />
                    A: 在系统启动初期（交易量 &lt; 1亿 MEMO），系统使用 pallet-pricing 的默认价格 {FALLBACK_RATE} USDT/MEMO。待市场活跃后，自动切换到市场加权均价。
                </Paragraph>
                <Paragraph>
                    <Text strong>Q: 支持反向兑换吗（USDT → MEMO）？</Text><br />
                    A: 暂不支持，后续版本会添加。
                </Paragraph>
            </Card>
        </div>
    );
};

export default SimpleBridgePage;
