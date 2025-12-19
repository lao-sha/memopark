import React from 'react';
import { Card, Alert, Button, Space, Typography } from 'antd';
import { useWallet } from '../../providers/WalletProvider';

/**
 * 函数级详细中文注释：我的治理引导页面（简化版）
 * - 引导用户访问 Web 治理平台查看完整功能
 * - 提供快捷跳转链接
 */
const MyGovernancePage: React.FC = () => {
  const { current } = useWallet()

  return (
    <div style={{ maxWidth: 414, margin: '0 auto', padding: 16 }}>
      <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, padding: '4px 0', marginBottom: 12 }}>
        <button onClick={()=> window.history.back()} style={{ border: '1px solid #eee', padding: '4px 10px', borderRadius: 8 }}>返回</button>
      </div>

      <Card>
        <Typography.Title level={4} style={{ marginTop: 0 }}>我的治理</Typography.Title>

        {!current && (
          <Alert
            type="warning"
            showIcon
            message="请先选择或创建钱包地址"
            style={{ marginBottom: 16 }}
          />
        )}

        <Alert
          type="success"
          showIcon
          message="专业治理功能已迁移到 Web 平台"
          description={
            <div>
              <div style={{ marginBottom: 12 }}>
                完整的治理功能（提案、投票、委员会管理、仲裁等）已迁移到专业 Web 治理平台，提供更强大的工具和更好的体验。
              </div>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button 
                  type="primary" 
                  size="large"
                  block
                  onClick={() => {
                    const url = `https://governance.memopark.com/voting${current ? '?address=' + current : ''}`
                    window.open(url, '_blank')
                  }}
                >
                  🖥️ 打开 Web 治理平台
                </Button>
                
                <Button 
                  block
                  onClick={() => {
                    window.location.hash = '#/gov/appeal'
                  }}
                >
                  快速提交申诉（移动端）
                </Button>
              </Space>
            </div>
          }
          style={{ marginBottom: 16 }}
        />

        <Card size="small" title="🔗 快捷入口" style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Button
              block
              onClick={() => {
                window.open('https://governance.memopark.com/content-governance', '_blank')
              }}
            >
              内容治理（审批申诉）
            </Button>
            
            <Button
              block
              onClick={() => {
                window.open('https://governance.memopark.com/applications', '_blank')
              }}
            >
              做市商审批
            </Button>
            
            <Button
              block
              onClick={() => {
                window.open('https://governance.memopark.com/committees', '_blank')
              }}
            >
              委员会管理
            </Button>
            
            <Button
              block
              onClick={() => {
                window.open('https://governance.memopark.com/arbitration', '_blank')
              }}
            >
              仲裁管理
            </Button>

            <Button
              block
              onClick={() => {
                window.open('https://governance.memopark.com/park-governance', '_blank')
              }}
            >
              陵园治理
            </Button>
          </Space>
        </Card>

        <Alert
          type="info"
          style={{ marginTop: 16 }}
          message="平台说明"
          description={
            <div style={{ fontSize: 12 }}>
              <div><strong>📱 DAPP（移动端）</strong>：日常管理、供奉、留言、浏览</div>
              <div><strong>🖥️ Web平台（桌面端）</strong>：专业治理、批量操作、数据分析</div>
            </div>
          }
        />
      </Card>
    </div>
  );
};

export default MyGovernancePage;
