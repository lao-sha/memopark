/**
 * 申诉数据导出工具
 * 
 * 功能：
 * - 导出申诉数据为CSV格式
 * - 按条件筛选导出
 * - 批量导出和单个导出
 * 
 * 导出字段：
 * - 申诉ID、状态、提交人、目标对象
 * - 押金、提交时间、批准/驳回时间
 * - 理由CID、证据CID
 */

import React, { useState } from 'react';
import {
  Card,
  Form,
  Select,
  Button,
  DatePicker,
  Space,
  message,
  Row,
  Col,
  Statistic,
  Alert,
} from 'antd';
import {
  DownloadOutlined,
  FileExcelOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { useApi } from '@/contexts/Api';
import {
  getAllAppeals,
  AppealInfo,
  AppealStatusLabels,
  DomainLabels,
} from '@/services/blockchain/contentGovernance';
import { formatBalance } from '@/utils/format';
import type { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

/**
 * 导出过滤条件
 */
interface ExportFilters {
  status?: number;
  domain?: number;
  startDate?: number;
  endDate?: number;
}

/**
 * 将申诉数据转换为CSV格式
 */
function convertToCSV(appeals: AppealInfo[]): string {
  // CSV表头
  const headers = [
    '申诉ID',
    '状态',
    '域',
    '目标ID',
    '提交人',
    '押金(MEMO)',
    '提交时间',
    '理由CID',
    '证据CID',
    '公示期(区块)',
    '执行区块',
  ];
  
  // CSV行
  const rows = appeals.map(appeal => [
    appeal.id,
    AppealStatusLabels[typeof appeal.status === 'number' ? appeal.status : 0] || '未知',
    DomainLabels[appeal.domain] || `域${appeal.domain}`,
    appeal.target,
    appeal.submitter,
    formatBalance(appeal.deposit),
    new Date(appeal.submitted_at * 1000).toLocaleString('zh-CN'),
    appeal.reason_cid || '',
    appeal.evidence_cid || '',
    appeal.notice_blocks || '',
    appeal.execute_at || '',
  ]);
  
  // 组合CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csvContent;
}

/**
 * 下载CSV文件
 */
function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * 数据导出组件
 */
const DataExporter: React.FC = () => {
  const { api } = useApi();
  const [form] = Form.useForm();
  
  const [loading, setLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  
  /**
   * 预览导出数据量
   */
  const handlePreview = async () => {
    if (!api) {
      message.error('API未连接');
      return;
    }
    
    setLoading(true);
    try {
      const values = form.getFieldsValue();
      const filters: ExportFilters = {};
      
      // 状态过滤
      if (values.status !== undefined) {
        filters.status = values.status;
      }
      
      // 域过滤
      if (values.domain !== undefined) {
        filters.domain = values.domain;
      }
      
      // 时间范围过滤
      if (values.dateRange && values.dateRange.length === 2) {
        filters.startDate = values.dateRange[0].unix();
        filters.endDate = values.dateRange[1].unix();
      }
      
      // 获取所有申诉
      const allAppeals = await getAllAppeals(api);
      
      // 应用过滤
      const filtered = allAppeals.filter(appeal => {
        if (filters.status !== undefined) {
          const appealStatus = typeof appeal.status === 'number' ? appeal.status : 0;
          if (appealStatus !== filters.status) return false;
        }
        
        if (filters.domain !== undefined && appeal.domain !== filters.domain) {
          return false;
        }
        
        if (filters.startDate && appeal.submitted_at < filters.startDate) {
          return false;
        }
        
        if (filters.endDate && appeal.submitted_at > filters.endDate) {
          return false;
        }
        
        return true;
      });
      
      setPreviewCount(filtered.length);
      message.success(`预览完成，将导出 ${filtered.length} 条记录`);
    } catch (e) {
      console.error('预览失败:', e);
      message.error('预览失败');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 导出CSV
   */
  const handleExport = async () => {
    if (!api) {
      message.error('API未连接');
      return;
    }
    
    setLoading(true);
    try {
      const values = form.getFieldsValue();
      const filters: ExportFilters = {};
      
      // 状态过滤
      if (values.status !== undefined) {
        filters.status = values.status;
      }
      
      // 域过滤
      if (values.domain !== undefined) {
        filters.domain = values.domain;
      }
      
      // 时间范围过滤
      if (values.dateRange && values.dateRange.length === 2) {
        filters.startDate = values.dateRange[0].unix();
        filters.endDate = values.dateRange[1].unix();
      }
      
      // 获取所有申诉
      const allAppeals = await getAllAppeals(api);
      
      // 应用过滤
      const filtered = allAppeals.filter(appeal => {
        if (filters.status !== undefined) {
          const appealStatus = typeof appeal.status === 'number' ? appeal.status : 0;
          if (appealStatus !== filters.status) return false;
        }
        
        if (filters.domain !== undefined && appeal.domain !== filters.domain) {
          return false;
        }
        
        if (filters.startDate && appeal.submitted_at < filters.startDate) {
          return false;
        }
        
        if (filters.endDate && appeal.submitted_at > filters.endDate) {
          return false;
        }
        
        return true;
      });
      
      if (filtered.length === 0) {
        message.warning('没有符合条件的数据');
        return;
      }
      
      // 转换为CSV
      const csv = convertToCSV(filtered);
      
      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `申诉数据导出_${timestamp}.csv`;
      
      // 下载文件
      downloadCSV(csv, filename);
      
      message.success(`成功导出 ${filtered.length} 条记录`);
    } catch (e) {
      console.error('导出失败:', e);
      message.error('导出失败');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card
      title={
        <Space>
          <FileExcelOutlined />
          <span>申诉数据导出</span>
        </Space>
      }
    >
      <Alert
        type="info"
        message="导出说明"
        description="支持按状态、域、时间范围筛选导出申诉数据。导出格式为CSV，可用Excel打开。"
        showIcon
        style={{ marginBottom: 24 }}
      />
      
      <Form
        form={form}
        layout="vertical"
      >
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="申诉状态" name="status">
              <Select
                placeholder="全部状态"
                allowClear
                options={[
                  { label: '待审批', value: 0 },
                  { label: '已批准', value: 1 },
                  { label: '已驳回', value: 2 },
                  { label: '已撤回', value: 3 },
                  { label: '已执行', value: 4 },
                ]}
              />
            </Form.Item>
          </Col>
          
          <Col xs={24} md={8}>
            <Form.Item label="目标域" name="domain">
              <Select
                placeholder="全部域"
                allowClear
                options={[
                  { label: '墓地', value: 1 },
                  { label: '逝者文本', value: 3 },
                  { label: '逝者媒体', value: 4 },
                  { label: 'OTC订单', value: 7 },
                  { label: '简单桥接', value: 8 },
                ]}
              />
            </Form.Item>
          </Col>
          
          <Col xs={24} md={8}>
            <Form.Item label="提交时间范围" name="dateRange">
              <RangePicker
                style={{ width: '100%' }}
                placeholder={['开始日期', '结束日期']}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
      
      {/* 预览统计 */}
      {previewCount !== null && (
        <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f0f2f5' }}>
          <Statistic
            title="预计导出记录数"
            value={previewCount}
            suffix="条"
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      )}
      
      {/* 操作按钮 */}
      <Space>
        <Button
          icon={<FilterOutlined />}
          onClick={handlePreview}
          loading={loading}
        >
          预览数据量
        </Button>
        
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleExport}
          loading={loading}
        >
          导出CSV
        </Button>
      </Space>
    </Card>
  );
};

export default DataExporter;
