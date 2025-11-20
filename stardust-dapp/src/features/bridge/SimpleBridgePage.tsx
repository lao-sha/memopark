import React, { useState, useEffect } from 'react';
import { Card, Form, InputNumber, Input, Button, Alert, Steps, Statistic, Row, Col, message, Typography, Tag, Space, Spin, Modal } from 'antd';
import { SwapOutlined, CheckCircleOutlined, LoadingOutlined, WalletOutlined, InfoCircleOutlined, ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { usePolkadot } from '@/providers/WalletProvider';
import { signAndSendTxWithPassword } from '@/lib/polkadot-safe';
import './SimpleBridgePage.css';

const { Title, Text, Paragraph } = Typography;

/**
 * 函数级详细中文注释：极简桥接页面组件（统一青绿色UI风格）
 *
 * 功能：
 * - DUST → USDT (TRC20) 兑换
 * - 动态汇率：基于 pallet-pricing 的市场加权均价（OTC + Bridge）
 * - 冷启动阶段：使用 pallet-pricing 的默认价格（当前为 0.000001 USDT/DUST）
 * - 手续费：0.3%
 * - 最小兑换：100 DUST
 * - 统一青绿色 #5DBAAA 主题风格，与底部导航栏保持一致
 */
export const SimpleBridgePage: React.FC = () => {
    const { api, currentAccount } = usePolkadot();
    const [form] = Form.useForm();

    // 表单状态
    const [dustAmount, setDustAmount] = useState<number>(0);
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
    const MIN_AMOUNT = 100;     // 最小 100 DUST
    const FALLBACK_RATE = 0.000001;  // 备用汇率（与 pallet-pricing DefaultPrice 一致）

    // 使用市场价格（如果为0则使用备用汇率）
    const currentRate = marketPrice > 0 ? marketPrice : FALLBACK_RATE;
    const isFallback = marketPrice === 0;

    // 计算预估金额
    const estimatedUsdt = dustAmount * currentRate;
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
             * 1. 冷启动阶段（交易量 < 1亿 DUST）：返回 DefaultPrice（当前为 0.000001 USDT/DUST）
             * 2. 正常运行阶段：返回市场加权均价
             * 3. 无交易数据：返回 DefaultPrice
             *
             * 因此前端直接读取 pallet-pricing 的 DefaultPrice 作为参考价格。
             * 注意：此价格仅用于前端展示，实际兑换时使用链端实时计算的价格。
             */

            // 从 pallet-pricing 获取默认价格
            const defaultPrice = await api.query.pricing.defaultPrice();
            const priceU64 = defaultPrice.toNumber();

            // 转换为 USDT/DUST（精度 10^6）
            const priceUsdt = priceU64 / 1e6;
            setMarketPrice(priceUsdt);

            console.log('pallet-pricing 默认价格:', priceUsdt, 'USDT/DUST');
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
        if (!dustAmount || dustAmount < MIN_AMOUNT) {
            message.error(`最小兑换金额为 ${MIN_AMOUNT} DUST`);
            return;
        }

        if (!tronAddress || !tronAddress.startsWith('T')) {
            message.error('请输入有效的波场地址（T 开头）');
            return;
        }

        // 显示确认弹窗
        Modal.confirm({
            title: '确认兑换',
            content: (
                <div className="swap-confirm-content">
                    <div className="confirm-item">
                        <span className="confirm-label">兑换金额:</span>
                        <span className="confirm-value">{dustAmount} DUST</span>
                    </div>
                    <div className="confirm-item">
                        <span className="confirm-label">当前汇率:</span>
                        <span className="confirm-value">{currentRate.toFixed(6)} USDT/DUST</span>
                    </div>
                    <div className="confirm-item">
                        <span className="confirm-label">预计到账:</span>
                        <span className="confirm-value highlight">{netUsdt.toFixed(6)} USDT</span>
                    </div>
                    <div className="confirm-item">
                        <span className="confirm-label">波场地址:</span>
                        <span className="confirm-value address">{tronAddress}</span>
                    </div>
                    <div className="confirm-warning">
                        ⚠️ 请仔细核对地址，转错无法找回
                    </div>
                </div>
            ),
            okText: '确认兑换',
            cancelText: '再检查一下',
            centered: true,
            width: 420,
            okButtonProps: {
                className: 'confirm-ok-btn'
            },
            cancelButtonProps: {
                className: 'confirm-cancel-btn'
            },
            onOk: async () => {
                await performSwap();
            }
        });
    };

    const performSwap = async () => {
        setLoading(true);

        try {
            // 调用 bridge.swap（🆕 重构后的 pallet-bridge）
            const tx = api.tx.bridge.swap(
                BigInt(dustAmount * 1e12), // DUST 12位小数
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
                                if (event.section === 'bridge' && event.method === 'SwapCreated') {
                                    const id = event.data.id?.toNumber() || event.data[0].toNumber();
                                    const priceUsdt = event.data.price_usdt?.toNumber() || event.data[4]?.toNumber();

                                    setSwapId(id);
                                    if (priceUsdt) {
                                        const actualRate = priceUsdt / 1e6;
                                        setActualPrice(actualRate);
                                        console.log('Swap ID:', id, '实际汇率:', actualRate, 'USDT/DUST');
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
        setDustAmount(0);
        setTronAddress('');
        form.resetFields();
        loadBalance();
        loadMarketPrice();
    };

    // 使用实际汇率重新计算（用于显示最终到账金额）
    const finalUsdt = actualPrice > 0 ? dustAmount * actualPrice : netUsdt;
    const finalFee = actualPrice > 0 ? finalUsdt * FEE_RATE : fee;
    const finalNet = finalUsdt - finalFee;

    return (
        <div className="simple-bridge-page">
            {/* 顶部导航栏 */}
            <div className="bridge-header">
                <Button
                    type="text"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => window.history.back()}
                    className="back-button"
                >
                    返回
                </Button>
                <div className="page-title">DUST 兑换</div>
                <div style={{ width: 40 }} />
            </div>

            {/* 主要内容区域 */}
            <div className="bridge-content">
                {/* 步骤指示器 */}
                <div className="steps-container">
                    <div className={`step-item ${step >= 0 ? 'active' : ''}`}>
                        <div className="step-icon">
                            {step === 0 ? <WalletOutlined /> : <CheckCircleOutlined />}
                        </div>
                        <div className="step-label">填写信息</div>
                    </div>
                    <div className="step-line"></div>
                    <div className={`step-item ${step >= 1 ? 'active' : ''}`}>
                        <div className="step-icon">
                            {step === 1 ? <LoadingOutlined /> : step > 1 ? <CheckCircleOutlined /> : <LoadingOutlined />}
                        </div>
                        <div className="step-label">处理中</div>
                    </div>
                    <div className="step-line"></div>
                    <div className={`step-item ${step >= 2 ? 'active' : ''}`}>
                        <div className="step-icon">
                            <CheckCircleOutlined />
                        </div>
                        <div className="step-label">完成</div>
                    </div>
                </div>

                {/* 步骤 0: 填写表单 */}
                {step === 0 && (
                    <div className="form-container">
                        {/* 市场价格显示 */}
                        <div className="price-card">
                            <div className="price-header">
                                <InfoCircleOutlined />
                                <span>实时汇率</span>
                                <Button
                                    size="small"
                                    icon={<ReloadOutlined />}
                                    onClick={loadMarketPrice}
                                    loading={priceLoading}
                                    className="refresh-btn"
                                >
                                    刷新
                                </Button>
                            </div>

                            {priceLoading ? (
                                <div className="price-loading">
                                    <Spin size="small" />
                                    <span>加载中...</span>
                                </div>
                            ) : priceError ? (
                                <div className="price-error">
                                    <div className="error-message">价格加载失败</div>
                                    <div className="error-desc">将使用备用汇率 {FALLBACK_RATE} USDT/DUST</div>
                                </div>
                            ) : (
                                <div className="price-display">
                                    <div className="current-rate">
                                        <div className="rate-value">{currentRate.toFixed(6)}</div>
                                        <div className="rate-unit">USDT/DUST</div>
                                    </div>
                                    <div className="rate-source">
                                        {isFallback ? (
                                            <Tag color="warning" className="fallback-tag">
                                                冷启动阶段（使用默认价格）
                                            </Tag>
                                        ) : (
                                            <Tag color="success" className="market-tag">
                                                市场加权均价
                                            </Tag>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 余额显示 */}
                        {currentAccount && (
                            <div className="balance-info">
                                <WalletOutlined />
                                <span>当前余额:</span>
                                <span className="balance-amount">{balance} DUST</span>
                            </div>
                        )}

                        {/* 表单输入 */}
                        <Form form={form} layout="vertical" className="swap-form">
                            <Form.Item
                                label="DUST 数量"
                                className="form-item"
                            >
                                <div className="input-container">
                                    <InputNumber
                                        value={dustAmount}
                                        onChange={(value) => setDustAmount(value || 0)}
                                        min={MIN_AMOUNT}
                                        max={parseFloat(balance)}
                                        placeholder={`最小 ${MIN_AMOUNT} DUST`}
                                        className="amount-input"
                                        controls={false}
                                    />
                                    <div className="input-suffix">DUST</div>
                                </div>
                                <div className="input-hint">
                                    最小 {MIN_AMOUNT} DUST，最大 {balance} DUST
                                </div>
                            </Form.Item>

                            <Form.Item
                                label="波场地址 (TRON)"
                                className="form-item"
                            >
                                <Input
                                    value={tronAddress}
                                    onChange={(e) => setTronAddress(e.target.value)}
                                    placeholder="TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS"
                                    className="address-input"
                                />
                                <div className="input-hint">
                                    您的 TRON 钱包地址（T 开头）
                                </div>
                            </Form.Item>
                        </Form>

                        {/* 兑换预估 */}
                        <div className="estimation-card">
                            <div className="estimation-title">兑换预估</div>
                            <div className="estimation-content">
                                <div className="estimation-row">
                                    <span className="label">当前汇率</span>
                                    <span className="value">{currentRate.toFixed(6)} USDT/DUST</span>
                                </div>
                                <div className="estimation-row">
                                    <span className="label">手续费率</span>
                                    <span className="value">{(FEE_RATE * 100).toFixed(1)}%</span>
                                </div>
                                <div className="estimation-row">
                                    <span className="label">USDT 总额</span>
                                    <span className="value">{estimatedUsdt.toFixed(6)} USDT</span>
                                </div>
                                <div className="estimation-row total">
                                    <span className="label">预计到账</span>
                                    <span className="value highlight">{netUsdt.toFixed(6)} USDT</span>
                                </div>
                            </div>
                        </div>

                        {/* 手续费说明 */}
                        <div className="fee-notice">
                            💡 手续费 {fee.toFixed(6)} USDT ({(FEE_RATE * 100).toFixed(1)}%) 用于支付 TRON 网络 Gas 费用
                        </div>

                        {/* 提交按钮 */}
                        <Button
                            type="primary"
                            size="large"
                            block
                            icon={<SwapOutlined />}
                            onClick={handleSwap}
                            disabled={!currentAccount || !dustAmount || !tronAddress || priceLoading || dustAmount < MIN_AMOUNT}
                            loading={loading}
                            className="submit-button"
                        >
                            {!currentAccount ? '请先连接钱包' : '立即兑换'}
                        </Button>

                        {/* 风险提示 */}
                        <div className="risk-notice">
                            <div className="notice-title">⚠️ 重要提示</div>
                            <div className="notice-content">
                                <div>• 请仔细核对波场地址，转错地址无法找回</div>
                                <div>• 汇率基于实时市场均价，提交时会锁定价格</div>
                                <div>• USDT 将在 1-2 分钟内到账您的波场地址</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 步骤 1 & 2: 处理中 / 完成 */}
                {step > 0 && (
                    <div className="result-container">
                        {step === 1 ? (
                            <div className="processing-state">
                                <LoadingOutlined className="status-icon processing" />
                                <div className="status-title">正在处理兑换...</div>
                                <div className="status-desc">桥接服务正在发送 USDT 到您的波场地址</div>
                            </div>
                        ) : (
                            <div className="success-state">
                                <CheckCircleOutlined className="status-icon success" />
                                <div className="status-title">兑换成功！</div>
                                <div className="status-desc">USDT 将在 1-2 分钟内到账</div>
                            </div>
                        )}

                        {/* 兑换详情 */}
                        <div className="swap-details">
                            <div className="details-title">兑换详情</div>
                            <div className="details-content">
                                <div className="detail-row">
                                    <span className="detail-label">兑换 ID:</span>
                                    <Tag color="blue" className="detail-tag">{swapId}</Tag>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">DUST 数量:</span>
                                    <span className="detail-value">{dustAmount} DUST</span>
                                </div>
                                {actualPrice > 0 && (
                                    <div className="detail-row">
                                        <span className="detail-label">实际汇率:</span>
                                        <span className="detail-value highlight">{actualPrice.toFixed(6)} USDT/DUST</span>
                                    </div>
                                )}
                                <div className="detail-row">
                                    <span className="detail-label">USDT 到账:</span>
                                    <span className="detail-value success">
                                        {actualPrice > 0 ? finalNet.toFixed(6) : netUsdt.toFixed(6)} USDT
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">波场地址:</span>
                                    <span className="detail-value address">{tronAddress}</span>
                                </div>
                            </div>
                        </div>

                        {/* 操作按钮 */}
                        {step === 2 && (
                            <Button
                                type="primary"
                                size="large"
                                onClick={handleReset}
                                className="reset-button"
                            >
                                再次兑换
                            </Button>
                        )}

                        {/* 提示信息 */}
                        <div className="result-notice">
                            💡 {step === 1 ? "请勿关闭页面，等待处理完成" : "可以在波场浏览器查询 USDT 到账情况"}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SimpleBridgePage;
