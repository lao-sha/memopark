/**
 * 大六壬排盘页面
 *
 * 大六壬是中国古代三大式占之一，与奇门遁甲、太乙神数并称"三式"。
 * 主要通过四课三传的方式进行推演，用于预测吉凶祸福。
 */

import React, { useState } from 'react';
import { Card, Form, DatePicker, Button, Typography, Space, Divider, message, Input, Switch, Modal } from 'antd';
import { ArrowRightOutlined, CalendarOutlined, QuestionCircleOutlined, HistoryOutlined, ReloadOutlined, CompassOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { divineByTime, DivineByTimeParams } from '../../services/daliurenService';
import './DaliurenPage.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * 简化干支计算（实际应使用万年历）
 */
function calculateGanZhi(date: dayjs.Dayjs): {
  yearGz: [number, number];
  monthGz: [number, number];
  dayGz: [number, number];
  hourGz: [number, number];
  yueJiang: number;
  zhanShi: number;
} {
  const year = date.year();
  const month = date.month() + 1; // 0-11 -> 1-12
  const day = date.date();
  const hour = date.hour();

  // 简化算法（实际需要精确的万年历计算）
  const yearGan = (year - 4) % 10; // 甲子年为0
  const yearZhi = (year - 4) % 12;

  const monthGan = ((year % 5) * 2 + month) % 10;
  const monthZhi = (month + 1) % 12; // 正月建寅

  const dayGan = (day + 9) % 10; // 简化
  const dayZhi = (day - 1) % 12;

  const hourZhi = Math.floor((hour + 1) / 2) % 12; // 时辰
  const hourGan = (dayGan * 2 + hourZhi) % 10; // 日上起时

  // 月将（正月建寅）
  const yueJiang = (month + 1) % 12;

  // 占时（时辰）
  const zhanShi = hourZhi;

  return {
    yearGz: [yearGan, yearZhi],
    monthGz: [monthGan, monthZhi],
    dayGz: [dayGan, dayZhi],
    hourGz: [hourGan, hourZhi],
    yueJiang,
    zhanShi,
  };
}

/**
 * 大六壬排盘页面
 */
const DaliurenPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  /**
   * 处理起盘提交
   */
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      console.log('大六壬起盘参数:', values);

      const date = values.dateTime as dayjs.Dayjs;
      const question = values.question?.trim();
      const isPublic = values.isPublic ?? false;

      // 计算干支
      const { yearGz, monthGz, dayGz, hourGz, yueJiang, zhanShi } = calculateGanZhi(date);

      // 判断昼夜（简化：6-18点为白天）
      const isDay = date.hour() >= 6 && date.hour() < 18;

      // 构建起课参数
      const params: DivineByTimeParams = {
        yearGz,
        monthGz,
        dayGz,
        hourGz,
        yueJiang,
        zhanShi,
        isDay,
        questionCid: question, // 简化：直接传字符串（实际应上传IPFS）
      };

      // 调用链上服务
      const panId = await divineByTime(params);

      message.success(`排盘成功！式盘ID: ${panId}`);

      // 跳转到详情页
      setTimeout(() => {
        window.location.hash = `#/daliuren/detail/${panId}`;
      }, 1000);

    } catch (error: any) {
      console.error('起盘失败:', error);
      message.error(error?.message || '起盘失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 当前时间起盘
   */
  const handleCurrentTime = () => {
    form.setFieldsValue({
      dateTime: dayjs(),
    });
    message.success('已设置为当前时间');
  };

  /**
   * 重置表单
   */
  const handleReset = () => {
    form.resetFields();
    form.setFieldsValue({
      dateTime: dayjs(),
      isPublic: false,
    });
    message.success('已重置');
  };

  /**
   * 渲染说明弹窗
   */
  const renderInstructionsModal = () => (
    <Modal
      title={
        <span style={{ fontSize: 18, fontWeight: 600 }}>
          <QuestionCircleOutlined style={{ marginRight: 8, color: '#B2955D' }} />
          大六壬 · 排盘说明
        </span>
      }
      open={showInstructions}
      onCancel={() => setShowInstructions(false)}
      footer={null}
      width={460}
      style={{ top: 20 }}
    >
      <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '8px 0' }}>
        {/* 温馨提示 */}
        <Title level={5} style={{ color: '#B2955D', marginTop: 16 }}>温馨提示</Title>
        <Paragraph>
          排盘结果将上链保存，可永久查询。排盘需要支付少量 Gas 费用。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 大六壬基础 */}
        <Title level={5} style={{ color: '#B2955D' }}>大六壬基础</Title>
        <Paragraph>
          <Text strong>大六壬</Text>是中国古代三大式占之一，与奇门遁甲、太乙神数并称"三式"。大六壬通过天地盘、四课三传等方法，进行时空预测，判断事物的吉凶祸福。
        </Paragraph>
        <Paragraph>
          大六壬以天干地支为基础，通过月将加时、四课排列、三传推算等步骤，结合神煞分析，形成完整的预测体系。它特别擅长预测具体事件的发展过程和结果应期。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 四课三传 */}
        <Title level={5} style={{ color: '#B2955D' }}>四课三传</Title>
        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>• 四课：</Text>由日干和日支的阴阳关系确定，分为上课和下课，是推算的基础
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 三传：</Text>从四课中按特定规则推算出初传、中传、末传，揭示事物发展的起因、过程和结果
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 发用：</Text>确定三传的过程，有九宗门、八专、伏吟、返吟等多种发用方法
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 排盘方法 */}
        <Title level={5} style={{ color: '#B2955D' }}>排盘方法</Title>
        <Paragraph>
          <Text strong>时间起盘：</Text>选择起盘时间，系统将自动根据干支历法计算年月日时的天干地支，确定月将，根据昼夜判断阴阳遁，排列四课三传及相关神煞。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 应用范围 */}
        <Title level={5} style={{ color: '#B2955D' }}>应用范围</Title>
        <Paragraph>
          大六壬适用于预测以下各类人生重要事项：
        </Paragraph>
        <Paragraph>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>
              <Text strong>事业：</Text>升迁、求职、合作、竞争等
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>婚姻：</Text>感情发展、婚配、和合等
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>财运：</Text>求财、投资、借贷、交易等
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>出行：</Text>旅行、搬迁、行人归期等
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>疾病：</Text>病情诊断、治疗效果、康复时间等
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>诉讼：</Text>官司胜负、纠纷解决等
            </li>
          </ul>
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 区块链优势 */}
        <Title level={5} style={{ color: '#B2955D' }}>区块链优势</Title>
        <Paragraph>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>
              <Text strong>链上存储：</Text>所有排盘数据上链保存，永不丢失
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>可追溯性：</Text>随时可查询历史记录，包含完整的起盘信息
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>智能分析：</Text>链端自动排盘，提供四课三传分析
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>AI 解读：</Text>支持请求 AI 智能解读，提供专业分析建议
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>隐私保护：</Text>可选择公开或私密，保护个人隐私
            </li>
          </ul>
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 操作提示 */}
        <Title level={5} style={{ color: '#B2955D' }}>操作提示</Title>
        <Paragraph>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>起盘前请心诚意诚，专注于所问之事</li>
            <li style={{ marginBottom: 8 }}>同一问题不宜短期内重复占测</li>
            <li style={{ marginBottom: 8 }}>选择准确的起盘时间对预测结果很重要</li>
            <li style={{ marginBottom: 8 }}>可以输入问题描述，便于后续查看和解读</li>
            <li style={{ marginBottom: 8 }}>链端排盘需要连接钱包并支付少量 Gas 费用</li>
            <li style={{ marginBottom: 8 }}>如需专业解读，可前往"占卜服务市场"寻找大师</li>
          </ul>
        </Paragraph>
      </div>
    </Modal>
  );

  return (
    <div className="daliuren-page">
      {/* 顶部导航卡片 - 复刻八字页面风格 */}
      <div className="nav-card" style={{
        borderRadius: '0',
        background: '#FFFFFF',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        border: 'none',
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '414px',
        zIndex: 100,
        height: '50px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px'
      }}>
        {/* 左边：我的式盘 */}
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', cursor: 'pointer' }}
          onClick={() => (window.location.hash = '#/daliuren/list')}
        >
          <HistoryOutlined style={{ fontSize: '18px', color: '#999' }} />
          <div style={{ fontSize: '10px', color: '#999' }}>我的式盘</div>
        </div>

        {/* 中间：大六壬 */}
        <div style={{ fontSize: '18px', color: '#333', fontWeight: '500', whiteSpace: 'nowrap' }}>大六壬</div>

        {/* 右边：使用说明 */}
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', cursor: 'pointer' }}
          onClick={() => setShowInstructions(true)}
        >
          <QuestionCircleOutlined style={{ fontSize: '18px', color: '#999' }} />
          <div style={{ fontSize: '10px', color: '#999' }}>说明</div>
        </div>
      </div>

      {/* 顶部占位 */}
      <div style={{ height: '50px' }}></div>

      {/* 输入卡片 */}
      <Card className="input-card">
        <Title level={4} className="page-title" style={{ marginBottom: 4, textAlign: 'center' }}>
          排盘
        </Title>
        <Text type="secondary" className="page-subtitle" style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}>
          大六壬为三式之一，以天人合一理论预测吉凶祸福
        </Text>

        <Divider style={{ margin: '16px 0' }} />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            dateTime: dayjs(),
            isPublic: false,
          }}
        >
          <Form.Item
            name="dateTime"
            label={<Text strong><CalendarOutlined /> 起盘时间</Text>}
            rules={[{ required: true, message: '请选择起盘时间' }]}
            style={{ borderBottom: '1px solid #e5e5e5', paddingBottom: 8 }}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
              placeholder="选择起盘时间"
              variant="borderless"
            />
          </Form.Item>

          <Form.Item
            name="question"
            label={<Text strong>问题描述（可选）</Text>}
          >
            <TextArea
              rows={3}
              placeholder="请输入您要占卜的问题，例如：最近工作运势如何？"
              maxLength={500}
            />
          </Form.Item>

          <Form.Item
            name="isPublic"
            label={<Text strong>公开设置</Text>}
            valuePropName="checked"
          >
            <Switch checkedChildren="公开" unCheckedChildren="私密" />
          </Form.Item>

          <Divider style={{ margin: '16px 0' }} />

          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Button
              block
              size="large"
              onClick={handleCurrentTime}
              icon={<CalendarOutlined />}
              style={{ borderRadius: '27px', height: '44px' }}
            >
              使用当前时间
            </Button>

            <Button
              block
              type="primary"
              size="large"
              htmlType="submit"
              loading={loading}
              icon={<CompassOutlined />}
              style={{
                background: '#000000',
                borderColor: '#000000',
                borderRadius: '54px',
                height: '54px',
                fontSize: '19px',
                fontWeight: '700',
                color: '#F7D3A1',
              }}
            >
              开始排盘
            </Button>

            <Button
              block
              onClick={handleReset}
              icon={<ReloadOutlined />}
              style={{ borderRadius: '27px', height: '44px' }}
            >
              重置
            </Button>
          </Space>
        </Form>
      </Card>

      {/* 说明弹窗 */}
      {renderInstructionsModal()}

      {/* 底部导航 */}
      <div className="bottom-nav">
        <Space split={<Divider type="vertical" />}>
          <Button type="link" onClick={() => (window.location.hash = '#/daliuren/list')}>
            <HistoryOutlined /> 我的式盘
          </Button>
          <Button type="link" onClick={() => (window.location.hash = '#/divination')}>
            <ArrowRightOutlined /> 占卜入口
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default DaliurenPage;
