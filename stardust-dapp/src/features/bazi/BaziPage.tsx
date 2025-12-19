/**
 * 八字排盘页面 - 链端生成版
 *
 * 架构说明：
 * 1. 用户输入出生信息
 * 2. 提交到链端，由 pallet-bazi-chart 生成八字命盘
 * 3. 通过 Runtime API 免费获取完整解盘结果
 * 4. 前端只负责展示，不进行八字计算
 *
 * 优势：
 * - ✅ 算法一致性：避免前后端算法不同步
 * - ✅ 自动升级：链端升级算法，前端无需更新
 * - ✅ 免费计算：Runtime API 不消耗 gas
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  DatePicker,
  Select,
  Typography,
  Space,
  Divider,
  Tag,
  Row,
  Col,
  Statistic,
  message,
  Radio,
  Modal,
  Spin,
  Cascader,
} from 'antd';
import {
  CalendarOutlined,
  UserOutlined,
  HistoryOutlined,
  ArrowRightOutlined,
  RobotOutlined,
  LoadingOutlined,
  QuestionCircleOutlined,
  BgColorsOutlined,
  GiftOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import {
  Gender,
  GENDER_NAMES,
  TIAN_GAN_NAMES,
  DI_ZHI_NAMES,
  WU_XING_NAMES,
  WU_XING_COLORS,
  WU_XING_BG_COLORS,
  SHI_SHEN_SHORT,
  SHI_SHEN_COLORS,
  DI_ZHI_HOURS,
  DiZhi,
  getGanZhiName,
  GanZhi,
  WuXing,
  ShiShen,
  TianGan,
} from '../../types/bazi';
import {
  saveBaziToChain,
  getBaziChart,
  getInterpretation,
  type V3FullInterpretation,
} from '../../services/baziChainService';
import {
  requestDivinationInterpretation,
  getDivinationInterpretationRequest,
} from '../../services/divinationService';
import { DivinationType, InterpretationType } from '../../types/divination';
import { getFriendlyErrorMessage } from '../../services/nodeStatusService';
import { useWalletStore } from '../../stores/walletStore';
import { getCityCoordinate, getDefaultCoordinate, type CityCoordinate } from '../../data/cityCoordinates';
// @ts-ignore - china-division 没有类型定义
import pcaData from 'china-division/dist/pca.json';
import './BaziPage.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

/**
 * 将 china-division 的 pca.json 转换为 Cascader 需要的格式
 */
interface CascaderOption {
  value: string;
  label: string;
  children?: CascaderOption[];
}

const convertToCascaderOptions = (data: Record<string, Record<string, string[]>>): CascaderOption[] => {
  return Object.entries(data).map(([province, cities]) => ({
    value: province,
    label: province,
    children: Object.entries(cities).map(([city, districts]) => ({
      value: city,
      label: city,
      children: districts.map(district => ({
        value: district,
        label: district,
      })),
    })),
  }));
};

// 预处理 Cascader 选项数据（只执行一次）
const cascaderOptions = convertToCascaderOptions(pcaData as Record<string, Record<string, string[]>>);

/**
 * 链上八字命盘数据（从 getBaziChart 返回）
 */
interface ChainBaziChart {
  id: number;
  creator: string;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour: number;
  gender: number;
  isPublic: boolean;
  createdAt: number;
  status: number;
}

/**
 * 八字排盘页面组件
 */
const BaziPage: React.FC = () => {
  // 输入状态
  const [name, setName] = useState<string>(''); // 姓名
  const [birthDate, setBirthDate] = useState<dayjs.Dayjs | null>(null);
  const [birthHour, setBirthHour] = useState<number>(12);
  const [gender, setGender] = useState<Gender>(Gender.Male);
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar'>('solar'); // 公历/农历
  const [location, setLocation] = useState<string>('未知地'); // 地点
  const [longitude, setLongitude] = useState<number>(116.416); // 经度（默认北京）
  const [latitude, setLatitude] = useState<number>(39.9288); // 纬度（默认北京）
  const [selectedAddress, setSelectedAddress] = useState<string[]>([]); // Cascader 选中的地址

  /**
   * 处理地址选择变化
   */
  const handleAddressChange = useCallback((value: (string | number)[]) => {
    const stringValue = value.map(v => String(v));
    setSelectedAddress(stringValue);

    if (stringValue.length >= 2) {
      // 获取城市名（第二级）
      const cityName = stringValue[1];
      const coord = getCityCoordinate(cityName);

      if (coord) {
        setLocation(cityName);
        setLongitude(coord.longitude);
        setLatitude(coord.latitude);
      } else {
        // 如果没有找到城市经纬度，使用省会
        const provinceName = stringValue[0];
        const provinceCoord = getCityCoordinate(provinceName.replace(/省|自治区|特别行政区/g, ''));
        if (provinceCoord) {
          setLocation(cityName);
          setLongitude(provinceCoord.longitude);
          setLatitude(provinceCoord.latitude);
        } else {
          // 使用默认（北京）
          const defaultCoord = getDefaultCoordinate();
          setLocation(cityName);
          setLongitude(defaultCoord.longitude);
          setLatitude(defaultCoord.latitude);
        }
      }
    } else if (stringValue.length === 1) {
      // 只选择了省份
      const provinceName = stringValue[0];
      setLocation(provinceName);
      const coord = getCityCoordinate(provinceName);
      if (coord) {
        setLongitude(coord.longitude);
        setLatitude(coord.latitude);
      }
    }
  }, []);

  // 结果状态
  const [chartData, setChartData] = useState<ChainBaziChart | null>(null);
  const [interpretation, setInterpretation] = useState<V3FullInterpretation | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedChartId, setSavedChartId] = useState<number | null>(null);

  // AI解读状态
  const [requestingAI, setRequestingAI] = useState(false);

  // 钱包状态
  const { selectedAccount, isConnected } = useWalletStore();

  /**
   * 执行排盘（提交到链端）
   */
  const handleCalculate = useCallback(async () => {
    if (!birthDate) {
      message.warning('请选择出生日期');
      return;
    }

    if (!isConnected || !selectedAccount) {
      message.warning('请先连接钱包');
      return;
    }

    setLoading(true);
    try {
      // 提交到链端生成八字
      message.info('正在提交到区块链...');
      const chartId = await saveBaziToChain({
        year: birthDate.year(),
        month: birthDate.month() + 1,
        day: birthDate.date(),
        hour: birthHour,
        gender,
      });

      setSavedChartId(chartId);
      message.success('八字命盘已生成！');

      // 获取链上数据
      const chart = await getBaziChart(chartId);
      if (!chart) {
        throw new Error('获取命盘数据失败');
      }
      setChartData(chart);

      // 通过 Runtime API 获取完整解盘（免费）
      message.info('正在获取解盘结果...');
      const interp = await getInterpretation(chartId);
      if (!interp) {
        throw new Error('获取解盘失败，命盘可能不存在');
      }
      setInterpretation(interp);

      message.success('排盘完成！');
    } catch (error) {
      console.error('排盘失败:', error);
      const friendlyMessage = getFriendlyErrorMessage(error);
      Modal.error({
        title: '排盘失败',
        content: <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{friendlyMessage}</pre>,
        width: 500,
      });
    } finally {
      setLoading(false);
    }
  }, [birthDate, birthHour, gender, isConnected, selectedAccount]);

  /**
   * 重新排盘
   */
  const handleReset = useCallback(() => {
    setChartData(null);
    setInterpretation(null);
    setName('');
    setBirthDate(null);
    setBirthHour(12);
    setGender(Gender.Male);
    setCalendarType('solar');
    setSavedChartId(null);
    setLocation('未知地');
    setLongitude(116.416);
    setLatitude(39.9288);
    setSelectedAddress([]);
  }, []);

  /**
   * 查看详情页
   */
  const handleViewDetail = useCallback(() => {
    if (savedChartId) {
      window.location.hash = `#/bazi/${savedChartId}`;
    }
  }, [savedChartId]);

  /**
   * 请求AI智能解盘
   */
  const handleRequestAIInterpretation = useCallback(async () => {
    if (!savedChartId) {
      message.warning('请先保存命盘到链上');
      return;
    }

    if (!isConnected || !selectedAccount) {
      message.warning('请先连接钱包');
      return;
    }

    setRequestingAI(true);
    try {
      const requestId = await requestDivinationInterpretation(
        DivinationType.Bazi,
        savedChartId,
        InterpretationType.Professional // 使用"专业解读"类型
      );

      message.success('AI解读请求已提交，正在处理中...');

      // 轮询检查解读状态
      const checkInterval = setInterval(async () => {
        try {
          const request = await getDivinationInterpretationRequest(requestId);
          if (request && request.status === 2) {
            clearInterval(checkInterval);
            message.success('AI解读完成！');
            window.location.hash = `#/divination/interpretation/${requestId}`;
          } else if (request && request.status === 3) {
            clearInterval(checkInterval);
            message.error('AI解读失败，请稍后重试');
            setRequestingAI(false);
          }
        } catch (error) {
          console.error('检查解读状态失败:', error);
        }
      }, 3000);

      setTimeout(() => {
        clearInterval(checkInterval);
        if (requestingAI) {
          setRequestingAI(false);
          message.info('解读处理时间较长，请稍后在"我的解读"页面查看结果');
        }
      }, 30000);
    } catch (error) {
      console.error('请求AI解读失败:', error);
      message.error(`请求失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setRequestingAI(false);
    }
  }, [savedChartId, isConnected, selectedAccount, requestingAI]);

  /**
   * 渲染四柱（基于链上解盘结果）
   */
  const renderSiZhu = () => {
    if (!interpretation) return null;

    // 从链上解盘结果重构四柱数据
    // 注意：链上 Runtime API 返回的是完整解盘，包含四柱、用神等信息
    // 这里我们只展示基础信息

    return (
      <Card className="si-zhu-card" size="small">
        <Title level={5}>四柱八字</Title>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Text type="secondary">
            链上已生成命盘，命盘ID: {savedChartId}
          </Text>
          <br />
          <Button type="link" onClick={handleViewDetail}>
            查看完整命盘详情 →
          </Button>
        </div>
      </Card>
    );
  };

  /**
   * 渲染解盘核心信息
   */
  const renderInterpretationCore = () => {
    if (!interpretation) return null;

    const { core } = interpretation;

    return (
      <Card className="interpretation-card" size="small">
        <Title level={5}>命盘解析</Title>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Statistic title="格局" value={core.geJu} valueStyle={{ fontSize: 16 }} />
            </Col>
            <Col span={12}>
              <Statistic title="强弱" value={core.qiangRuo} valueStyle={{ fontSize: 16 }} />
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Statistic
                title="用神"
                value={core.yongShen}
                valueStyle={{ fontSize: 16, color: '#52c41a' }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="喜神"
                value={core.xiShen}
                valueStyle={{ fontSize: 16, color: '#1890ff' }}
              />
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Statistic
                title="忌神"
                value={core.jiShen}
                valueStyle={{ fontSize: 16, color: '#ff4d4f' }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="综合评分"
                value={core.score}
                suffix="分"
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
          </Row>
          <Divider style={{ margin: '8px 0' }} />
          <div>
            <Text strong>用神类型：</Text>
            <Tag color="blue">{core.yongShenType}</Tag>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              可信度: {core.confidence}% | 算法版本: v{core.algorithmVersion}
            </Text>
          </div>
        </Space>
      </Card>
    );
  };

  /**
   * 渲染性格分析
   */
  const renderXingGeAnalysis = () => {
    if (!interpretation || !interpretation.xingGe) return null;

    const { xingGe } = interpretation;

    return (
      <Card className="xingge-card" size="small">
        <Title level={5}>性格分析</Title>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {xingGe.zhuYaoTeDian.length > 0 && (
            <div>
              <Text strong>主要特点：</Text>
              <div style={{ marginTop: 8 }}>
                {xingGe.zhuYaoTeDian.map((trait, idx) => (
                  <Tag key={idx} color="blue" style={{ marginBottom: 4 }}>
                    {trait}
                  </Tag>
                ))}
              </div>
            </div>
          )}
          {xingGe.youDian.length > 0 && (
            <div>
              <Text strong>优点：</Text>
              <div style={{ marginTop: 8 }}>
                {xingGe.youDian.map((trait, idx) => (
                  <Tag key={idx} color="green" style={{ marginBottom: 4 }}>
                    {trait}
                  </Tag>
                ))}
              </div>
            </div>
          )}
          {xingGe.queDian.length > 0 && (
            <div>
              <Text strong>缺点：</Text>
              <div style={{ marginTop: 8 }}>
                {xingGe.queDian.map((trait, idx) => (
                  <Tag key={idx} color="orange" style={{ marginBottom: 4 }}>
                    {trait}
                  </Tag>
                ))}
              </div>
            </div>
          )}
          {xingGe.shiHeZhiYe.length > 0 && (
            <div>
              <Text strong>适合职业：</Text>
              <div style={{ marginTop: 8 }}>
                {xingGe.shiHeZhiYe.map((career, idx) => (
                  <Tag key={idx} color="purple" style={{ marginBottom: 4 }}>
                    {career}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </Space>
      </Card>
    );
  };

  /**
   * 渲染输入表单
   */
  const renderInputForm = () => (
    <>
      {/* 顶部导航卡片 */}
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
          {/* 左边：五运六气 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
            <BgColorsOutlined style={{ fontSize: '18px', color: '#999' }} />
            <div style={{ fontSize: '10px', color: '#999' }}>五运六气</div>
          </div>

          {/* 中间：问真排盘 */}
          <div style={{ fontSize: '18px', color: '#333', fontWeight: '500', whiteSpace: 'nowrap' }}>问真排盘</div>

          {/* 右边：生日 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <CalendarOutlined style={{ fontSize: '18px', color: '#999' }} />
            <div style={{ fontSize: '10px', color: '#999' }}>生日</div>
          </div>
      </div>

      {/* 顶部占位 */}
      <div style={{ height: '50px' }}></div>

      {/* 主卡片 */}
      <Card className="input-card" style={{ position: 'relative' }}>

      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {/* 姓名输入框 - 下划线样式 */}
        <div className="form-item">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入姓名"
            className="name-input"
            style={{
              width: '100%',
              padding: '12px 0',
              fontSize: '15px',
              border: 'none',
              borderBottom: '1px solid #e5e5e5',
              borderRadius: '0',
              outline: 'none',
              backgroundColor: '#FFFFFF',
              color: '#333',
            }}
          />
        </div>

        {/* 性别和日历类型按钮组 - 两组分别靠两边 */}
        <div className="form-item" style={{ display: 'flex', gap: '16px', justifyContent: 'space-between' }}>
          {/* 性别选择组 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setGender(Gender.Male)}
              style={{
                padding: '8px 18px',
                fontSize: '14px',
                borderRadius: '18px',
                border: 'none',
                backgroundColor: gender === Gender.Male ? '#B2955D' : 'transparent',
                color: gender === Gender.Male ? '#FFFFFF' : '#929292',
                cursor: 'pointer',
                fontWeight: '400',
              }}
            >
              男
            </button>
            <button
              onClick={() => setGender(Gender.Female)}
              style={{
                padding: '8px 18px',
                fontSize: '14px',
                borderRadius: '18px',
                border: 'none',
                backgroundColor: gender === Gender.Female ? '#B2955D' : 'transparent',
                color: gender === Gender.Female ? '#FFFFFF' : '#929292',
                cursor: 'pointer',
                fontWeight: '400',
              }}
            >
              女
            </button>
          </div>

          {/* 日历类型选择组 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setCalendarType('solar')}
              style={{
                padding: '8px 18px',
                fontSize: '14px',
                borderRadius: '18px',
                border: 'none',
                backgroundColor: calendarType === 'solar' ? '#B2955D' : 'transparent',
                color: calendarType === 'solar' ? '#FFFFFF' : '#929292',
                cursor: 'pointer',
                fontWeight: '400',
              }}
            >
              公历
            </button>
            <button
              onClick={() => setCalendarType('lunar')}
              style={{
                padding: '8px 18px',
                fontSize: '14px',
                borderRadius: '18px',
                border: 'none',
                backgroundColor: calendarType === 'lunar' ? '#B2955D' : 'transparent',
                color: calendarType === 'lunar' ? '#FFFFFF' : '#929292',
                cursor: 'pointer',
                fontWeight: '400',
              }}
            >
              农历
            </button>
          </div>
        </div>
        {/* 出生日期 - 下划线样式显示 */}
        <div className="form-item" style={{
          borderBottom: '1px solid #e5e5e5',
          paddingBottom: '8px',
        }}>
          <DatePicker
            value={birthDate}
            onChange={(date) => setBirthDate(date)}
            placeholder="选择出生日期"
            style={{ width: '100%' }}
            size="middle"
            bordered={false}
            disabledDate={(current) => current && current > dayjs()}
            format="YYYY年MM月DD日 HH:mm"
            showTime={{ format: 'HH:mm' }}
          />
        </div>

        {/* 地点选择 - 下划线样式 */}
        <div className="form-item" style={{
          borderBottom: '1px solid #e5e5e5',
          paddingBottom: '4px',
        }}>
          <Cascader
            options={cascaderOptions}
            value={selectedAddress}
            onChange={handleAddressChange}
            placeholder="选择出生地（省/市/区）"
            style={{ width: '100%' }}
            size="small"
            variant="borderless"
            showSearch={{
              filter: (inputValue, path) =>
                path.some(option =>
                  (option.label as string).toLowerCase().indexOf(inputValue.toLowerCase()) > -1
                ),
            }}
            changeOnSelect
            expandTrigger="hover"
          />
        </div>

        {/* 经纬度和地点显示 - 下划线样式 */}
        <div className="form-item" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 0',
          borderBottom: '1px solid #e5e5e5',
          backgroundColor: '#FFFFFF',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EnvironmentOutlined style={{ color: '#999' }} />
            <Text style={{ color: '#333' }}>{location}</Text>
          </div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            北纬{latitude.toFixed(4)} 东经{longitude.toFixed(3)}
          </Text>
        </div>

        {/* 真太阳时显示 - 简洁样式 */}
        {birthDate && (
          <div className="form-item" style={{
            padding: '8px 0',
            backgroundColor: '#FFFFFF',
          }}>
            <Text style={{ fontSize: '13px', color: '#999' }}>
              真太阳时：{birthDate.format('YYYY-MM-DD HH:mm')}
            </Text>
          </div>
        )}

        {/* 删除原有的单独时辰选择和性别选择 */}

        <Button
          type="primary"
          size="large"
          block
          onClick={handleCalculate}
          loading={loading}
          disabled={!birthDate || !isConnected}
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
          {isConnected ? '开始排盘' : '请先连接钱包'}
        </Button>

        {!isConnected && (
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              💡 需要连接钱包才能使用区块链生成八字
            </Text>
          </div>
        )}
      </Space>
    </Card>
    </>
  );

  /**
   * 渲染排盘结果
   */
  const renderResult = () => {
    if (!chartData || !interpretation) return null;

    return (
      <div className="result-container">
        {/* 基本信息 */}
        <Card className="info-card" size="small">
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title="公历"
                value={`${chartData.birthYear}年${chartData.birthMonth}月${chartData.birthDay}日`}
                valueStyle={{ fontSize: 14 }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="性别"
                value={chartData.gender === 0 ? '女' : '男'}
                valueStyle={{ fontSize: 14 }}
              />
            </Col>
          </Row>
          <Divider style={{ margin: '12px 0' }} />
          <div className="bazi-summary">
            <Text strong>命盘ID：</Text>
            <Text code style={{ fontSize: 16 }}>#{savedChartId}</Text>
          </div>
        </Card>

        {/* 四柱 */}
        {renderSiZhu()}

        {/* 解盘核心 */}
        {renderInterpretationCore()}

        {/* 性格分析 */}
        {renderXingGeAnalysis()}

        {/* 操作按钮 */}
        <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            block
            onClick={handleRequestAIInterpretation}
            loading={requestingAI}
            disabled={!isConnected || requestingAI}
            style={{
              background: 'linear-gradient(135deg, #B2955D 0%, #9A7D4A 100%)',
              borderColor: '#B2955D',
            }}
          >
            {requestingAI ? 'AI解读中...' : 'AI智能解盘'}
          </Button>
          <Button
            type="default"
            block
            onClick={handleViewDetail}
            icon={<ArrowRightOutlined />}
          >
            查看命盘详情
          </Button>
          <Button block onClick={handleReset}>
            重新排盘
          </Button>
          <Divider style={{ margin: '12px 0' }} />
          <Button
            type="link"
            block
            onClick={() => (window.location.hash = '#/divination/market?type=1')}
          >
            找大师解读命盘 <ArrowRightOutlined />
          </Button>
        </Space>
      </div>
    );
  };

  return (
    <div className="bazi-page">
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin
            indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
            tip="正在区块链上生成八字命盘..."
          />
        </div>
      )}

      {!loading && (chartData && interpretation ? renderResult() : renderInputForm())}

      {/* 底部导航 */}
      <div className="bottom-nav">
        <Space split={<Divider type="vertical" />}>
          <Button type="link" onClick={() => (window.location.hash = '#/bazi/list')}>
            <HistoryOutlined /> 我的八字
          </Button>
          <Button type="link" onClick={() => (window.location.hash = '#/divination')}>
            <ArrowRightOutlined /> 占卜入口
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default BaziPage;
