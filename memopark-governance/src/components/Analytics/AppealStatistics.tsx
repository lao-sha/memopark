/**
 * 申诉统计分析组件
 * 
 * 功能：
 * - 申诉数据统计报表
 * - 趋势分析图表
 * - 多维度数据对比
 * - 导出统计报告
 * 
 * 统计维度：
 * 1. 按状态统计（待审批、已批准、已驳回等）
 * 2. 按域统计（墓地、逝者文本、OTC等）
 * 3. 按时间统计（日、周、月）
 * 4. 按用户统计（活跃用户、申诉频次）
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Spin,
  Alert,
  Button,
  DatePicker,
  Select,
  Space,
  Tag,
  Progress,
} from 'antd';
import {
  PieChartOutlined,
  BarChartOutlined,
  LineChartOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useApi } from '@/contexts/Api';
import {
  getAllAppeals,
  AppealInfo,
  AppealStatusLabels,
  DomainLabels,
} from '@/services/blockchain/contentGovernance';
import { formatBalance } from '@/utils/format';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

/**
 * 统计数据结构
 */
interface Statistics {
  // 状态统计
  byStatus: Record<number, number>;
  
  // 域统计
  byDomain: Record<number, number>;
  
  // 时间统计
  byDate: Record<string, number>;
  
  // 用户统计
  byUser: Record<string, number>;
  
  // 总计
  total: number;
  
  // 押金统计
  totalDeposit: string;
  avgDeposit: string;
  
  // 处理统计
  approvalRate: number;    // 批准率
  rejectionRate: number;   // 驳回率
  withdrawalRate: number;  // 撤回率
}

/**
 * 域排行
 */
interface DomainRank {
  domain: number;
  count: number;
  percentage: number;
}

/**
 * 用户排行
 */
interface UserRank {
  user: string;
  count: number;
  percentage: number;
}

/**
 * 计算统计数据
 */
function calculateStatistics(appeals: AppealInfo[]): Statistics {
  const byStatus: Record<number, number> = {};
  const byDomain: Record<number, number> = {};
  const byDate: Record<string, number> = {};
  const byUser: Record<string, number> = {};
  
  let totalDeposit = BigInt(0);
  
  for (const appeal of appeals) {
    // 状态统计
    const status = typeof appeal.status === 'number' ? appeal.status : 0;
    byStatus[status] = (byStatus[status] || 0) + 1;
    
    // 域统计
    byDomain[appeal.domain] = (byDomain[appeal.domain] || 0) + 1;
    
    // 时间统计（按日期）
    const date = new Date(appeal.submitted_at * 1000).toISOString().split('T')[0];
    byDate[date] = (byDate[date] || 0) + 1;
    
    // 用户统计
    byUser[appeal.submitter] = (byUser[appeal.submitter] || 0) + 1;
    
    // 押金统计
    totalDeposit += BigInt(appeal.deposit);
  }
  
  const total = appeals.length;
  const avgDeposit = total > 0 ? totalDeposit / BigInt(total) : BigInt(0);
  
  // 计算处理率
  const approved = byStatus[1] || 0;
  const rejected = byStatus[2] || 0;
  const withdrawn = byStatus[3] || 0;
  const processed = approved + rejected + withdrawn;
  
  const approvalRate = processed > 0 ? (approved / processed) * 100 : 0;
  const rejectionRate = processed > 0 ? (rejected / processed) * 100 : 0;
  const withdrawalRate = processed > 0 ? (withdrawn / processed) * 100 : 0;
  
  return {
    byStatus,
    byDomain,
    byDate,
    byUser,
    total,
    totalDeposit: totalDeposit.toString(),
    avgDeposit: avgDeposit.toString(),
    approvalRate: Math.round(approvalRate * 10) / 10,
    rejectionRate: Math.round(rejectionRate * 10) / 10,
    withdrawalRate: Math.round(withdrawalRate * 10) / 10,
  };
}

/**
 * 申诉统计分析组件
 */
const AppealStatistics: React.FC = () => {
  const { api } = useApi();
  
  const [appeals, setAppeals] = useState<AppealInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<number | undefined>();
  
  /**
   * 加载申诉数据
   */
  const loadAppeals = async () => {
    if (!api) return;
    
    setLoading(true);
    try {
      const data = await getAllAppeals(api);
      setAppeals(data);
    } catch (e) {
      console.error('加载申诉数据失败:', e);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadAppeals();
  }, [api]);
  
  /**
   * 过滤后的申诉数据
   */
  const filteredAppeals = useMemo(() => {
    let filtered = [...appeals];
    
    // 时间范围过滤
    if (dateRange) {
      const [start, end] = dateRange;
      const startTime = start.unix();
      const endTime = end.unix();
      
      filtered = filtered.filter(
        a => a.submitted_at >= startTime && a.submitted_at <= endTime
      );
    }
    
    // 域过滤
    if (selectedDomain !== undefined) {
      filtered = filtered.filter(a => a.domain === selectedDomain);
    }
    
    return filtered;
  }, [appeals, dateRange, selectedDomain]);
  
  /**
   * 统计数据
   */
  const statistics = useMemo(() => {
    return calculateStatistics(filteredAppeals);
  }, [filteredAppeals]);
  
  /**
   * 域排行
   */
  const domainRanks = useMemo((): DomainRank[] => {
    const ranks = Object.entries(statistics.byDomain).map(([domain, count]) => ({
      domain: Number(domain),
      count,
      percentage: statistics.total > 0 ? (count / statistics.total) * 100 : 0,
    }));
    
    return ranks.sort((a, b) => b.count - a.count);
  }, [statistics]);
  
  /**
   * 用户排行（Top 10）
   */
  const userRanks = useMemo((): UserRank[] => {
    const ranks = Object.entries(statistics.byUser).map(([user, count]) => ({
      user,
      count,
      percentage: statistics.total > 0 ? (count / statistics.total) * 100 : 0,
    }));
    
    return ranks.sort((a, b) => b.count - a.count).slice(0, 10);
  }, [statistics]);
  
  /**
   * 域排行表格列
   */
  const domainColumns: ColumnsType<DomainRank> = [
    {
      title: '排名',
      key: 'rank',
      width: 80,
      render: (_, __, index) => <strong>#{index + 1}</strong>,
    },
    {
      title: '域',
      dataIndex: 'domain',
      key: 'domain',
      render: (domain) => (
        <Tag color="blue">{DomainLabels[domain] || `域${domain}`}</Tag>
      ),
    },
    {
      title: '申诉数量',
      dataIndex: 'count',
      key: 'count',
      render: (count) => <strong>{count}</strong>,
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (percentage) => (
        <Progress
          percent={Math.round(percentage * 10) / 10}
          size="small"
          format={(p) => `${p}%`}
        />
      ),
    },
  ];
  
  /**
   * 用户排行表格列
   */
  const userColumns: ColumnsType<UserRank> = [
    {
      title: '排名',
      key: 'rank',
      width: 80,
      render: (_, __, index) => {
        const colors = ['gold', 'silver', '#cd7f32'];
        return (
          <Tag color={colors[index] || 'default'}>
            #{index + 1}
          </Tag>
        );
      },
    },
    {
      title: '用户地址',
      dataIndex: 'user',
      key: 'user',
      ellipsis: true,
      render: (user) => (
        <code style={{ fontSize: 11 }}>
          {user.slice(0, 8)}...{user.slice(-6)}
        </code>
      ),
    },
    {
      title: '申诉次数',
      dataIndex: 'count',
      key: 'count',
      render: (count) => <strong>{count}</strong>,
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (percentage) => `${Math.round(percentage * 10) / 10}%`,
    },
  ];
  
  if (loading && appeals.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="正在加载数据..." />
      </div>
    );
  }
  
  return (
    <div style={{ padding: 24 }}>
      {/* 筛选条件 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
            placeholder={['开始日期', '结束日期']}
          />
          
          <Select
            style={{ width: 200 }}
            placeholder="选择域"
            allowClear
            value={selectedDomain}
            onChange={setSelectedDomain}
            options={[
              { label: '墓地', value: 1 },
              { label: '逝者文本', value: 3 },
              { label: '逝者媒体', value: 4 },
              { label: 'OTC订单', value: 7 },
              { label: '简单桥接', value: 8 },
            ]}
          />
          
          <Button icon={<ReloadOutlined />} onClick={loadAppeals} loading={loading}>
            刷新
          </Button>
        </Space>
      </Card>
      
      {/* 总体统计 */}
      <Card
        title={
          <Space>
            <PieChartOutlined />
            <span>总体统计</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="总申诉数"
                value={statistics.total}
                suffix="个"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="待审批"
                value={statistics.byStatus[0] || 0}
                suffix="个"
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="总押金"
                value={formatBalance(statistics.totalDeposit)}
                suffix="MEMO"
                precision={2}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="平均押金"
                value={formatBalance(statistics.avgDeposit)}
                suffix="MEMO"
                precision={2}
              />
            </Card>
          </Col>
        </Row>
      </Card>
      
      {/* 处理率统计 */}
      <Card
        title={
          <Space>
            <BarChartOutlined />
            <span>处理率统计</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card size="small">
              <div style={{ marginBottom: 8 }}>批准率</div>
              <Progress
                percent={statistics.approvalRate}
                status="success"
                strokeColor="#52c41a"
              />
            </Card>
          </Col>
          
          <Col xs={24} md={8}>
            <Card size="small">
              <div style={{ marginBottom: 8 }}>驳回率</div>
              <Progress
                percent={statistics.rejectionRate}
                status="exception"
                strokeColor="#ff4d4f"
              />
            </Card>
          </Col>
          
          <Col xs={24} md={8}>
            <Card size="small">
              <div style={{ marginBottom: 8 }}>撤回率</div>
              <Progress
                percent={statistics.withdrawalRate}
                strokeColor="#faad14"
              />
            </Card>
          </Col>
        </Row>
      </Card>
      
      {/* 域分布排行 */}
      <Card
        title={
          <Space>
            <PieChartOutlined />
            <span>域分布排行</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          columns={domainColumns}
          dataSource={domainRanks}
          rowKey="domain"
          pagination={false}
          size="small"
        />
      </Card>
      
      {/* 活跃用户Top 10 */}
      <Card
        title={
          <Space>
            <LineChartOutlined />
            <span>活跃用户 Top 10</span>
          </Space>
        }
      >
        <Table
          columns={userColumns}
          dataSource={userRanks}
          rowKey="user"
          pagination={false}
          size="small"
        />
        
        {userRanks.length === 0 && (
          <Alert
            type="info"
            message="暂无数据"
            description="当前筛选条件下没有申诉数据"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>
    </div>
  );
};

export default AppealStatistics;

