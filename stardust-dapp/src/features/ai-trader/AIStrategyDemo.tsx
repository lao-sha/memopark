/**
 * AI策略演示页面
 * 
 * 函数级详细中文注释：
 * 展示如何使用 AI 推理服务的完整示例页面。
 * 
 * @component AIStrategyDemo
 * @created 2025-11-04
 */

import React from 'react';
import { Card, Row, Col, Tabs, Typography, Space } from 'antd';
import { AITradingPanel } from './AITradingPanel';
import { useAIInference } from '../../hooks/useAIInference';

const { Title, Paragraph, Text } = Typography;
const { TabPane } = Tabs;

/**
 * 函数级详细中文注释：AI策略演示页面
 */
export const AIStrategyDemo: React.FC = () => {
  const handleExecuteTrade = (signal: any) => {
    console.log('执行交易信号:', signal);
    // TODO: 集成到实际的交易逻辑
  };

  return (
    <div style={{ padding: 24, maxWidth: 414, margin: '0 auto' }}>
      <Title level={2}>🤖 AI 交易策略中心</Title>
      <Paragraph>
        基于深度学习的智能交易助手，提供实时市场分析和交易建议。
      </Paragraph>

      <Tabs defaultActiveKey="1">
        {/* Tab 1: 交易面板 */}
        <TabPane tab="交易面板" key="1">
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <AITradingPanel
                symbol="DUST-USDT"
                currentPrice={0.1}
                onExecuteTrade={handleExecuteTrade}
              />
            </Col>
            <Col xs={24} lg={8}>
              <Card title="📖 使用说明">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>1. 设置参数</Text>
                    <Paragraph type="secondary">
                      输入交易对、当前价格，选择 AI 模型类型
                    </Paragraph>
                  </div>
                  <div>
                    <Text strong>2. 获取信号</Text>
                    <Paragraph type="secondary">
                      点击"获取 AI 交易信号"按钮，AI 将分析市场数据
                    </Paragraph>
                  </div>
                  <div>
                    <Text strong>3. 查看分析</Text>
                    <Paragraph type="secondary">
                      查看交易信号、置信度、价格建议和风险评分
                    </Paragraph>
                  </div>
                  <div>
                    <Text strong>4. 执行交易</Text>
                    <Paragraph type="secondary">
                      根据 AI 建议，点击执行按钮完成交易
                    </Paragraph>
                  </div>
                </Space>
              </Card>

              <Card title="⚡ 模型说明" style={{ marginTop: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>LSTM (快速)</Text>
                    <Paragraph type="secondary">
                      长短期记忆网络，适合快速决策，响应时间短
                    </Paragraph>
                  </div>
                  <div>
                    <Text strong>本地模型</Text>
                    <Paragraph type="secondary">
                      基于技术指标的本地模型，稳定可靠
                    </Paragraph>
                  </div>
                  <div>
                    <Text strong>集成模型 (高精度)</Text>
                    <Paragraph type="secondary">
                      结合多个模型的集成学习，准确度更高
                    </Paragraph>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        </TabPane>

        {/* Tab 2: 代码示例 */}
        <TabPane tab="代码示例" key="2">
          <Row gutter={[24, 24]}>
            <Col span={24}>
              <Card title="基础用法">
                <Paragraph>
                  <Text code>import &#123; AITradingPanel &#125; from './features/ai-strategy/AITradingPanel';</Text>
                </Paragraph>
                <pre style={{ background: '#f6f6f6', padding: 16, borderRadius: 4 }}>
{`function TradingPage() {
  const handleExecuteTrade = (signal) => {
    console.log('执行交易:', signal);
    // 调用区块链交易接口
  };

  return (
    <AITradingPanel
      symbol="DUST-USDT"
      currentPrice={0.1}
      onExecuteTrade={handleExecuteTrade}
    />
  );
}`}
                </pre>
              </Card>
            </Col>

            <Col span={24}>
              <Card title="使用 Hook">
                <pre style={{ background: '#f6f6f6', padding: 16, borderRadius: 4 }}>
{`import { useAIInference } from './hooks/useAIInference';

function CustomTrading() {
  const {
    result,
    loading,
    error,
    getTradingSignalWithMockData,
  } = useAIInference();

  const handleGetSignal = async () => {
    await getTradingSignalWithMockData('DUST-USDT', 0.1);
  };

  return (
    <div>
      <button onClick={handleGetSignal} disabled={loading}>
        获取 AI 信号
      </button>
      {result && <div>信号: {result.signal}</div>}
    </div>
  );
}`}
                </pre>
              </Card>
            </Col>

            <Col span={24}>
              <Card title="直接调用服务">
                <pre style={{ background: '#f6f6f6', padding: 16, borderRadius: 4 }}>
{`import { getAIInferenceService } from './services/aiInferenceService';

async function getSignal() {
  const aiService = getAIInferenceService();
  
  // 生成市场数据
  const marketData = aiService.generateMockMarketData('DUST-USDT', 0.1);
  
  // 获取交易信号
  const result = await aiService.getTradingSignal({
    strategy_id: 1,
    market_data: marketData,
    model_type: 'lstm',
    confidence_threshold: 60,
  });
  
  console.log('AI信号:', result);
  return result;
}`}
                </pre>
              </Card>
            </Col>
          </Row>
        </TabPane>

        {/* Tab 3: API 文档 */}
        <TabPane tab="API 文档" key="3">
          <Row gutter={[24, 24]}>
            <Col span={24}>
              <Card title="InferenceResult 接口">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ padding: 8, textAlign: 'left', border: '1px solid #e8e8e8' }}>字段</th>
                      <th style={{ padding: 8, textAlign: 'left', border: '1px solid #e8e8e8' }}>类型</th>
                      <th style={{ padding: 8, textAlign: 'left', border: '1px solid #e8e8e8' }}>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}><Text code>signal</Text></td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>TradingSignal</td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>交易信号 (BUY/SELL/HOLD)</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}><Text code>confidence</Text></td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>number</td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>置信度 (0-100)</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}><Text code>position_size</Text></td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>number</td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>建议仓位大小</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}><Text code>entry_price</Text></td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>number</td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>入场价格</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}><Text code>stop_loss</Text></td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>number</td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>止损价格</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}><Text code>take_profit</Text></td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>number</td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>止盈价格</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}><Text code>reasoning</Text></td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>string</td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>推理依据</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}><Text code>feature_importance</Text></td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>Record</td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>特征重要性</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}><Text code>risk_score</Text></td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>number</td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>风险评分 (0-100)</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}><Text code>market_condition</Text></td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>MarketCondition</td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>市场状况</td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            </Col>

            <Col span={24}>
              <Card title="useAIInference Hook">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ padding: 8, textAlign: 'left', border: '1px solid #e8e8e8' }}>属性/方法</th>
                      <th style={{ padding: 8, textAlign: 'left', border: '1px solid #e8e8e8' }}>类型</th>
                      <th style={{ padding: 8, textAlign: 'left', border: '1px solid #e8e8e8' }}>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}><Text code>result</Text></td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>InferenceResult | null</td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>推理结果</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}><Text code>loading</Text></td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>boolean</td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>加载状态</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}><Text code>error</Text></td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>string | null</td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>错误信息</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}><Text code>getTradingSignal()</Text></td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>function</td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>获取交易信号</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}><Text code>getTradingSignalWithMockData()</Text></td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>function</td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>使用模拟数据获取信号</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}><Text code>checkHealth()</Text></td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>function</td>
                      <td style={{ padding: 8, border: '1px solid #e8e8e8' }}>检查服务健康状态</td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default AIStrategyDemo;

