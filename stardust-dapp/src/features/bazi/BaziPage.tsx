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
  Input,
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
} from 'antd';
import type { RadioChangeEvent } from 'antd';
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
  calculateBaziTemp,
  type V3FullInterpretation,
  type FullBaziChartV5,
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
 * 二十四小时时辰选项（下拉框用，每小时一个选项）
 */
const SHICHEN_OPTIONS = [
  { value: 0, label: '0-子' },
  { value: 1, label: '1-丑' },
  { value: 2, label: '2-丑' },
  { value: 3, label: '3-寅' },
  { value: 4, label: '4-寅' },
  { value: 5, label: '5-卯' },
  { value: 6, label: '6-卯' },
  { value: 7, label: '7-辰' },
  { value: 8, label: '8-辰' },
  { value: 9, label: '9-巳' },
  { value: 10, label: '10-巳' },
  { value: 11, label: '11-午' },
  { value: 12, label: '12-午' },
  { value: 13, label: '13-未' },
  { value: 14, label: '14-未' },
  { value: 15, label: '15-申' },
  { value: 16, label: '16-申' },
  { value: 17, label: '17-酉' },
  { value: 18, label: '18-酉' },
  { value: 19, label: '19-戌' },
  { value: 20, label: '20-戌' },
  { value: 21, label: '21-亥' },
  { value: 22, label: '22-亥' },
  { value: 23, label: '23-子' },
];

/**
 * 将 china-division 的 pca.json 转换为省市区数据
 */
interface ProvinceData {
  province: string;
  cities: {
    city: string;
    districts: string[];
  }[];
}

const convertToProvinceData = (data: Record<string, Record<string, string[]>>): ProvinceData[] => {
  return Object.entries(data).map(([province, cities]) => ({
    province,
    cities: Object.entries(cities).map(([city, districts]) => ({
      city,
      districts,
    })),
  }));
};

// 预处理省市区数据（只执行一次）
const provinceData = convertToProvinceData(pcaData as Record<string, Record<string, string[]>>);

// 省份选项
const provinceOptions = provinceData.map(p => ({
  value: p.province,
  label: p.province,
}));

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
  const [birthDate, setBirthDate] = useState<dayjs.Dayjs>(dayjs());
  const [birthHour, setBirthHour] = useState<number>(new Date().getHours());
  const [birthMinute, setBirthMinute] = useState<number>(new Date().getMinutes());
  const [gender, setGender] = useState<Gender>(Gender.Male);
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar' | 'rizhu'>('solar'); // 公历/农历/日柱
  const [useTrueSolarTime, setUseTrueSolarTime] = useState<boolean>(false); // 真太阳时
  const [location, setLocation] = useState<string>('未知地'); // 地点
  const [longitude, setLongitude] = useState<number>(116.416); // 经度（默认北京）
  const [latitude, setLatitude] = useState<number>(39.9288); // 纬度（默认北京）

  // 出生地点选择（三级联动）
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');

  // 根据选中的省份获取城市列表
  const cityOptions = useMemo(() => {
    if (!selectedProvince) return [];
    const province = provinceData.find(p => p.province === selectedProvince);
    return province?.cities.map(c => ({ value: c.city, label: c.city })) || [];
  }, [selectedProvince]);

  // 根据选中的城市获取区县列表
  const districtOptions = useMemo(() => {
    if (!selectedProvince || !selectedCity) return [];
    const province = provinceData.find(p => p.province === selectedProvince);
    const city = province?.cities.find(c => c.city === selectedCity);
    return city?.districts.map(d => ({ value: d, label: d })) || [];
  }, [selectedProvince, selectedCity]);

  /**
   * 处理省份选择变化
   */
  const handleProvinceChange = useCallback((value: string) => {
    setSelectedProvince(value);
    setSelectedCity('');
    setSelectedDistrict('');
    // 更新经纬度
    const coord = getCityCoordinate(value.replace(/省|自治区|特别行政区/g, ''));
    if (coord) {
      setLocation(value);
      setLongitude(coord.longitude);
      setLatitude(coord.latitude);
    }
  }, []);

  /**
   * 处理城市选择变化
   */
  const handleCityChange = useCallback((value: string) => {
    setSelectedCity(value);
    setSelectedDistrict('');
    // 更新经纬度
    const coord = getCityCoordinate(value);
    if (coord) {
      setLocation(value);
      setLongitude(coord.longitude);
      setLatitude(coord.latitude);
    } else {
      setLocation(value);
    }
  }, []);

  /**
   * 处理区县选择变化
   */
  const handleDistrictChange = useCallback((value: string) => {
    setSelectedDistrict(value);
    setLocation(selectedCity ? `${selectedCity} ${value}` : value);
  }, [selectedCity]);

  // 结果状态
  const [chartData, setChartData] = useState<ChainBaziChart | null>(null);
  const [interpretation, setInterpretation] = useState<V3FullInterpretation | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedChartId, setSavedChartId] = useState<number | null>(null);

  // 临时排盘状态
  const [tempChart, setTempChart] = useState<FullBaziChartV5 | null>(null);
  const [tempLoading, setTempLoading] = useState(false);
  const [isTempMode, setIsTempMode] = useState(false); // 是否为临时排盘模式

  // AI解读状态
  const [requestingAI, setRequestingAI] = useState(false);

  // 钱包状态
  const { selectedAccount, isConnected } = useWalletStore();

  /**
   * 执行排盘（提交到链端）
   */
  const handleCalculate = useCallback(async () => {
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
   * 临时排盘（免费，不存储）
   */
  const handleTempCalculate = useCallback(async () => {
    setTempLoading(true);
    setIsTempMode(true);
    try {
      message.info('正在计算八字（免费试算）...');

      // 调用临时排盘 Runtime API（免费）
      const result = await calculateBaziTemp({
        year: birthDate.year(),
        month: birthDate.month() + 1,
        day: birthDate.date(),
        hour: birthHour,
        minute: birthMinute,
        gender,
        zishiMode: 2, // 现代派
        longitude: useTrueSolarTime ? longitude : null,
      });

      if (!result) {
        throw new Error('排盘计算失败，请检查输入参数');
      }

      setTempChart(result);
      message.success('临时排盘完成！结果不会保存到链上');
    } catch (error) {
      console.error('临时排盘失败:', error);
      const friendlyMessage = getFriendlyErrorMessage(error);
      Modal.error({
        title: '临时排盘失败',
        content: <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{friendlyMessage}</pre>,
        width: 500,
      });
    } finally {
      setTempLoading(false);
    }
  }, [birthDate, birthHour, birthMinute, gender, useTrueSolarTime, longitude]);

  /**
   * 从临时排盘保存到链上
   */
  const handleSaveTempToChain = useCallback(async () => {
    if (!isConnected || !selectedAccount) {
      message.warning('请先连接钱包');
      return;
    }

    setLoading(true);
    try {
      message.info('正在保存到区块链...');

      // 调用上链保存
      const chartId = await saveBaziToChain({
        year: birthDate.year(),
        month: birthDate.month() + 1,
        day: birthDate.date(),
        hour: birthHour,
        gender,
      });

      setSavedChartId(chartId);
      setIsTempMode(false);

      // 获取链上数据
      const chart = await getBaziChart(chartId);
      if (chart) {
        setChartData(chart);
      }

      // 获取解盘
      const interp = await getInterpretation(chartId);
      if (interp) {
        setInterpretation(interp);
      }

      setTempChart(null); // 清除临时数据
      message.success(`命盘已保存！ID: ${chartId}`);
    } catch (error) {
      console.error('保存失败:', error);
      const friendlyMessage = getFriendlyErrorMessage(error);
      Modal.error({
        title: '保存失败',
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
    setTempChart(null);
    setIsTempMode(false);
    setName('');
    setBirthDate(dayjs());
    setBirthHour(new Date().getHours());
    setBirthMinute(new Date().getMinutes());
    setGender(Gender.Male);
    setCalendarType('solar');
    setUseTrueSolarTime(false);
    setSavedChartId(null);
    setLocation('未知地');
    setLongitude(116.416);
    setLatitude(39.9288);
    setSelectedProvince('');
    setSelectedCity('');
    setSelectedDistrict('');
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
   * 渲染临时排盘结果（四柱显示）
   */
  const renderTempSiZhu = () => {
    if (!tempChart) return null;

    const { siZhu } = tempChart;

    return (
      <Card className="si-zhu-card" size="small">
        <Title level={5}>
          四柱八字
          <Tag color="orange" style={{ marginLeft: 8, fontSize: 12 }}>临时排盘</Tag>
        </Title>
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '16px 0' }}>
          {/* 年柱 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>年柱</div>
            <div style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: WU_XING_COLORS[siZhu.yearZhu.ganZhi.tianGan % 5]
            }}>
              {TIAN_GAN_NAMES[siZhu.yearZhu.ganZhi.tianGan]}
            </div>
            <div style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: WU_XING_COLORS[(siZhu.yearZhu.ganZhi.diZhi % 12) % 5]
            }}>
              {DI_ZHI_NAMES[siZhu.yearZhu.ganZhi.diZhi]}
            </div>
            <Tag color={SHI_SHEN_COLORS[siZhu.yearZhu.tianGanShiShen]} style={{ marginTop: 4, fontSize: 10 }}>
              {SHI_SHEN_SHORT[siZhu.yearZhu.tianGanShiShen]}
            </Tag>
          </div>
          {/* 月柱 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>月柱</div>
            <div style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: WU_XING_COLORS[siZhu.monthZhu.ganZhi.tianGan % 5]
            }}>
              {TIAN_GAN_NAMES[siZhu.monthZhu.ganZhi.tianGan]}
            </div>
            <div style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: WU_XING_COLORS[(siZhu.monthZhu.ganZhi.diZhi % 12) % 5]
            }}>
              {DI_ZHI_NAMES[siZhu.monthZhu.ganZhi.diZhi]}
            </div>
            <Tag color={SHI_SHEN_COLORS[siZhu.monthZhu.tianGanShiShen]} style={{ marginTop: 4, fontSize: 10 }}>
              {SHI_SHEN_SHORT[siZhu.monthZhu.tianGanShiShen]}
            </Tag>
          </div>
          {/* 日柱 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>日柱</div>
            <div style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: WU_XING_COLORS[siZhu.dayZhu.ganZhi.tianGan % 5]
            }}>
              {TIAN_GAN_NAMES[siZhu.dayZhu.ganZhi.tianGan]}
            </div>
            <div style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: WU_XING_COLORS[(siZhu.dayZhu.ganZhi.diZhi % 12) % 5]
            }}>
              {DI_ZHI_NAMES[siZhu.dayZhu.ganZhi.diZhi]}
            </div>
            <Tag color="gold" style={{ marginTop: 4, fontSize: 10 }}>日主</Tag>
          </div>
          {/* 时柱 */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>时柱</div>
            <div style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: WU_XING_COLORS[siZhu.hourZhu.ganZhi.tianGan % 5]
            }}>
              {TIAN_GAN_NAMES[siZhu.hourZhu.ganZhi.tianGan]}
            </div>
            <div style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: WU_XING_COLORS[(siZhu.hourZhu.ganZhi.diZhi % 12) % 5]
            }}>
              {DI_ZHI_NAMES[siZhu.hourZhu.ganZhi.diZhi]}
            </div>
            <Tag color={SHI_SHEN_COLORS[siZhu.hourZhu.tianGanShiShen]} style={{ marginTop: 4, fontSize: 10 }}>
              {SHI_SHEN_SHORT[siZhu.hourZhu.tianGanShiShen]}
            </Tag>
          </div>
        </div>
        <Divider style={{ margin: '8px 0' }} />
        <div style={{ textAlign: 'center' }}>
          <Text type="warning" style={{ fontSize: 12 }}>
            此为临时排盘结果，不会保存到链上
          </Text>
        </div>
      </Card>
    );
  };

  /**
   * 渲染临时排盘的五行强度
   */
  const renderTempWuXingStrength = () => {
    if (!tempChart) return null;

    const { wuXingStrength } = tempChart;
    const total = wuXingStrength.jin + wuXingStrength.mu + wuXingStrength.shui + wuXingStrength.huo + wuXingStrength.tu;

    const wuXingData = [
      { name: '金', value: wuXingStrength.jin, color: WU_XING_COLORS[3] },
      { name: '木', value: wuXingStrength.mu, color: WU_XING_COLORS[0] },
      { name: '水', value: wuXingStrength.shui, color: WU_XING_COLORS[4] },
      { name: '火', value: wuXingStrength.huo, color: WU_XING_COLORS[1] },
      { name: '土', value: wuXingStrength.tu, color: WU_XING_COLORS[2] },
    ];

    return (
      <Card className="wuxing-card" size="small">
        <Title level={5}>五行强度</Title>
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0' }}>
          {wuXingData.map((wx) => (
            <div key={wx.name} style={{ textAlign: 'center' }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: wx.color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: 16,
                margin: '0 auto'
              }}>
                {wx.name}
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {total > 0 ? Math.round((wx.value / total) * 100) : 0}%
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  /**
   * 渲染临时排盘结果页面
   */
  const renderTempResult = () => {
    if (!tempChart) return null;

    return (
      <div className="result-container">
        {/* 基本信息 */}
        <Card className="info-card" size="small">
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title="公历"
                value={`${tempChart.birthTime.year}年${tempChart.birthTime.month}月${tempChart.birthTime.day}日`}
                valueStyle={{ fontSize: 14 }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="性别"
                value={tempChart.gender === Gender.Male ? '男' : '女'}
                valueStyle={{ fontSize: 14 }}
              />
            </Col>
          </Row>
          <Divider style={{ margin: '12px 0' }} />
          <div style={{ textAlign: 'center' }}>
            <Tag color="orange">临时排盘（免费试算）</Tag>
          </div>
        </Card>

        {/* 四柱 */}
        {renderTempSiZhu()}

        {/* 五行强度 */}
        {renderTempWuXingStrength()}

        {/* 操作按钮 */}
        <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
          <Button
            type="primary"
            block
            onClick={handleSaveTempToChain}
            loading={loading}
            disabled={!isConnected}
            style={{
              background: '#000000',
              borderColor: '#000000',
              height: '48px',
              fontSize: '16px',
              fontWeight: '500',
              color: '#F7D3A1',
            }}
          >
            {isConnected ? '保存到链上（需支付Gas）' : '请先连接钱包'}
          </Button>
          <Button block onClick={handleReset}>
            重新排盘
          </Button>
        </Space>

        <Divider style={{ margin: '16px 0' }} />
        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            💡 保存到链上后可获取完整解盘、AI解读等功能
          </Text>
        </div>
      </div>
    );
  };

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
          {/* 左边：我的命盘 */}
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', cursor: 'pointer' }}
            onClick={() => (window.location.hash = '#/bazi/list')}
          >
            <BgColorsOutlined style={{ fontSize: '18px', color: '#999' }} />
            <div style={{ fontSize: '10px', color: '#999' }}>我的命盘</div>
          </div>

          {/* 中间：星尘玄鉴-八字排盘 */}
          <div style={{ fontSize: '18px', color: '#333', fontWeight: '500', whiteSpace: 'nowrap' }}>星尘玄鉴-八字排盘</div>

          {/* 右边：生日 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <CalendarOutlined style={{ fontSize: '18px', color: '#999' }} />
            <div style={{ fontSize: '10px', color: '#999' }}>生日</div>
          </div>
      </div>

      {/* 顶部占位 */}
      <div style={{ height: '50px' }}></div>

      {/* 主卡片 */}
      <Card className="divination-card input-card" style={{ margin: '12px', borderRadius: '8px', width: 'calc(100% + 10px)', marginLeft: '-5px' }}>

      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {/* 命主姓名 + 性别 - form-row布局 */}
        <div className="form-row" style={{ marginBottom: 16 }}>
          <div className="form-label" style={{ width: 65, textAlign: 'right', paddingRight: 8 }}>
            命主姓名：
          </div>
          <div className="form-content" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="求测者"
              style={{ width: 80 }}
            />
            <span style={{ color: '#8B6914', fontSize: 14, whiteSpace: 'nowrap' }}>性别：</span>
            <Radio.Group
              value={gender}
              onChange={(e: RadioChangeEvent) => setGender(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value={Gender.Male}>男</Radio.Button>
              <Radio.Button value={Gender.Female}>女</Radio.Button>
            </Radio.Group>
          </div>
        </div>

        {/* 日期类型 - form-row布局 */}
        <div className="form-row" style={{ marginBottom: 16 }}>
          <div className="form-label" style={{ width: 65, textAlign: 'right', paddingRight: 8 }}>
            日期类型：
          </div>
          <div className="form-content" style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
            <Radio.Group
              value={calendarType}
              onChange={(e: RadioChangeEvent) => setCalendarType(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="solar">公历</Radio.Button>
              <Radio.Button value="lunar">农历</Radio.Button>
              <Radio.Button value="rizhu">日柱</Radio.Button>
            </Radio.Group>
          </div>
        </div>
        {/* 出生日期 - form-row布局，参考紫微页面 */}
        <div className="form-row" style={{ marginBottom: 16 }}>
          <div className="form-label" style={{ width: 65, textAlign: 'right', paddingRight: 8 }}>
            出生日期：
          </div>
          <div className="form-content" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Select
              value={birthDate.year()}
              onChange={(v) => setBirthDate(birthDate.year(v))}
              style={{ width: 90 }}
              options={Array.from({ length: 100 }, (_, i) => ({
                value: 1950 + i,
                label: `${1950 + i}年`
              }))}
            />
            <Select
              value={birthDate.month() + 1}
              onChange={(v) => setBirthDate(birthDate.month(v - 1))}
              style={{ width: 70 }}
              options={Array.from({ length: 12 }, (_, i) => ({
                value: i + 1,
                label: `${i + 1}月`
              }))}
            />
            <Select
              value={birthDate.date()}
              onChange={(v) => setBirthDate(birthDate.date(v))}
              style={{ width: 70 }}
              options={Array.from({ length: 31 }, (_, i) => ({
                value: i + 1,
                label: `${i + 1}日`
              }))}
            />
            <Select
              value={birthHour}
              onChange={setBirthHour}
              style={{ width: 78 }}
              options={SHICHEN_OPTIONS}
            />
            <span>时</span>
            <Select
              value={birthMinute}
              onChange={setBirthMinute}
              style={{ width: 58 }}
              options={Array.from({ length: 60 }, (_, i) => ({
                value: i,
                label: `${i}`
              }))}
            />
            <span>分</span>
          </div>
        </div>

        {/* 真太阳时 - form-row布局 */}
        <div className="form-row" style={{ marginBottom: 16 }}>
          <div className="form-label" style={{ width: 65, textAlign: 'right', paddingRight: 8 }}>
            真太阳时：
          </div>
          <div className="form-content" style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
            <Radio.Group
              value={useTrueSolarTime}
              onChange={(e: RadioChangeEvent) => setUseTrueSolarTime(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value={false}>不使用</Radio.Button>
              <Radio.Button value={true}>使用</Radio.Button>
            </Radio.Group>
          </div>
        </div>

        {/* 出生地点 - 使用三个独立 Select（手机友好） */}
        <div className="form-row" style={{ marginBottom: 8 }}>
          <div className="form-label" style={{ width: 65, textAlign: 'right', paddingRight: 8 }}>
            出生地点：
          </div>
          <div className="form-content" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Select
              value={selectedProvince || undefined}
              onChange={handleProvinceChange}
              placeholder="省份"
              style={{ width: 100 }}
              options={provinceOptions}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
            <Select
              value={selectedCity || undefined}
              onChange={handleCityChange}
              placeholder="城市"
              style={{ width: 100 }}
              options={cityOptions}
              disabled={!selectedProvince}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
            <Select
              value={selectedDistrict || undefined}
              onChange={handleDistrictChange}
              placeholder="区县"
              style={{ width: 100 }}
              options={districtOptions}
              disabled={!selectedCity}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>
        </div>

        {/* 经纬度和地点显示 */}
        <div className="form-row" style={{ marginBottom: 4 }}>
          <div className="form-label" style={{ width: 65 }}></div>
          <div className="form-content" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <EnvironmentOutlined style={{ color: '#999', fontSize: 12 }} />
              <Text style={{ color: '#333', fontSize: 12 }}>{location}</Text>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              北纬{latitude.toFixed(4)} 东经{longitude.toFixed(3)}
            </Text>
          </div>
        </div>

        {/* 真太阳时显示 */}
        {useTrueSolarTime && (
          <div className="form-row" style={{ marginBottom: 4 }}>
            <div className="form-label" style={{ width: 65 }}></div>
            <div className="form-content" style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: '#999' }}>
                真太阳时：{birthDate.year()}年{birthDate.month() + 1}月{birthDate.date()}日 {birthHour}时{birthMinute}分
              </Text>
            </div>
          </div>
        )}

        {/* 临时排盘按钮（免费试算） */}
        <Button
          type="default"
          size="large"
          block
          onClick={handleTempCalculate}
          loading={tempLoading}
          style={{
            background: '#fff',
            borderColor: '#B2955D',
            borderRadius: '0',
            height: '48px',
            fontSize: '16px',
            fontWeight: '500',
            color: '#B2955D',
            marginBottom: 8,
          }}
        >
          {tempLoading ? '计算中...' : '免费试算（不保存）'}
        </Button>

        {/* 保存到链上按钮 */}
        <Button
          type="primary"
          size="large"
          block
          onClick={handleCalculate}
          loading={loading}
          disabled={!isConnected}
          style={{
            background: '#000000',
            borderColor: '#000000',
            borderRadius: '0',
            height: '48px',
            fontSize: '16px',
            fontWeight: '500',
            color: '#F7D3A1',
          }}
        >
          {isConnected ? '开始排盘' : '请先连接钱包'}
        </Button>

        {!isConnected && (
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              💡 需要连接钱包才能保存到区块链
            </Text>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            免费试算：立即查看四柱八字 | 开始排盘：保存到链上并获取完整解盘
          </Text>
        </div>
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
      {(loading || tempLoading) && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin
            indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
            tip={tempLoading ? '正在计算八字（免费试算）...' : '正在区块链上生成八字命盘...'}
          />
        </div>
      )}

      {!loading && !tempLoading && (
        // 判断显示顺序：链上结果 > 临时结果 > 输入表单
        chartData && interpretation
          ? renderResult()
          : tempChart
            ? renderTempResult()
            : renderInputForm()
      )}

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
