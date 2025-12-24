/**
 * 紫微斗数排盘页面
 *
 * 功能：
 * - 输入出生时间排盘
 * - 显示十二宫星曜分布
 * - 大限流年分析
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Divider,
  Tag,
  message,
  DatePicker,
  Radio,
  Spin,
  Switch,
  Modal,
  Input,
  InputNumber,
  Select,
} from 'antd';
import type { RadioChangeEvent } from 'antd';
import {
  StarOutlined,
  HistoryOutlined,
  ReloadOutlined,
  UserOutlined,
  CalendarOutlined,
  CloudOutlined,
  DesktopOutlined,
  UnorderedListOutlined,
  QuestionCircleOutlined,
  ArrowRightOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

import {
  Gender,
  Gong,
  GONG_NAMES,
  ZHU_XING_NAMES,
  FU_XING_NAMES,
  SHA_XING_NAMES,
  WU_XING_JU_NAMES,
  BRIGHTNESS_NAMES,
  BRIGHTNESS_COLORS,
  DI_ZHI_NAMES,
  TIAN_GAN_NAMES,
  SI_HUA_SHORT,
  type GongInfo,
  type XingYao,
  type ZiweiChart,
  WuXingJu,
  ZhuXing,
  SiHua,
  getSiHuaDescription,
} from '../../types/ziwei';
import * as ziweiService from '../../services/ziweiService';
import { getCityCoordinate, getDefaultCoordinate } from '../../data/cityCoordinates';
// @ts-ignore - china-division 没有类型定义
import pcaData from 'china-division/dist/pca.json';
import './ZiweiPage.css';

const { Title, Text, Paragraph } = Typography;

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

/** 日期类型 */
type DateType = 'solar' | 'lunar';

/** 紫微盘式类型 */
type ChartType = 'xiantian' | 'liunian' | 'liuyue' | 'liuri';

/**
 * 时辰选项
 */
const HOUR_OPTIONS = [
  { label: '子时 (23-01)', value: 0 },
  { label: '丑时 (01-03)', value: 1 },
  { label: '寅时 (03-05)', value: 2 },
  { label: '卯时 (05-07)', value: 3 },
  { label: '辰时 (07-09)', value: 4 },
  { label: '巳时 (09-11)', value: 5 },
  { label: '午时 (11-13)', value: 6 },
  { label: '未时 (13-15)', value: 7 },
  { label: '申时 (15-17)', value: 8 },
  { label: '酉时 (17-19)', value: 9 },
  { label: '戌时 (19-21)', value: 10 },
  { label: '亥时 (21-23)', value: 11 },
];

/**
 * 二十四小时时辰选项（下拉框用，每小时一个选项，参考卜易居）
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
 * 获取当前小时（24小时制）
 */
const getCurrentHour = (): number => {
  return new Date().getHours();
};

/**
 * 模拟生成紫微命盘（实际应调用后端算法）
 */
function generateMockZiweiChart(
  year: number,
  month: number,
  day: number,
  hour: number,
  gender: Gender
): ZiweiChart {
  // 简化的模拟数据，实际需要复杂的紫微斗数排盘算法
  const gongs: GongInfo[] = [];

  // 生成十二宫
  for (let i = 0; i < 12; i++) {
    const gong = i as Gong;
    const diZhi = (i + 2) % 12; // 命宫从寅开始
    const tianGan = (year % 10 + i * 2) % 10;

    // 模拟主星分布
    const zhuXing: XingYao[] = [];
    if (i === 0) {
      // 命宫放紫微
      zhuXing.push({
        type: 'zhu',
        id: ZhuXing.ZiWei,
        name: ZHU_XING_NAMES[ZhuXing.ZiWei],
        brightness: 4,
        siHua: SiHua.HuaQuan,
      });
    }
    if (i === 3) {
      // 子女宫放天机
      zhuXing.push({
        type: 'zhu',
        id: ZhuXing.TianJi,
        name: ZHU_XING_NAMES[ZhuXing.TianJi],
        brightness: 3,
      });
    }
    if (i === 6) {
      // 迁移宫放太阳
      zhuXing.push({
        type: 'zhu',
        id: ZhuXing.TaiYang,
        name: ZHU_XING_NAMES[ZhuXing.TaiYang],
        brightness: 2,
        siHua: SiHua.HuaLu,
      });
    }

    gongs.push({
      gong,
      name: GONG_NAMES[gong],
      diZhi,
      tianGan,
      zhuXing,
      fuXing: [],
      shaXing: [],
      isShenGong: i === 4, // 假设身宫在财帛宫
    });
  }

  // 生成大限
  const wuXingJu = WuXingJu.Jin4; // 简化：固定金四局
  const startAge = wuXingJu;
  const daXians = [];
  for (let i = 0; i < 12; i++) {
    daXians.push({
      index: i + 1,
      startAge: startAge + i * 10,
      endAge: startAge + (i + 1) * 10 - 1,
      gong: ((gender === Gender.Male ? 12 - i : i) % 12) as Gong,
      tianGan: (year % 10 + i) % 10,
    });
  }

  return {
    id: Date.now(),
    creator: '',
    birthYear: year,
    birthMonth: month,
    birthDay: day,
    birthHour: hour,
    gender,
    lunarYear: year,
    lunarMonth: month,
    lunarDay: day,
    isLeapMonth: false,
    wuXingJu,
    mingZhu: ZhuXing.TanLang,
    shenZhu: ZhuXing.TianXiang,
    gongs,
    daXians,
    createdAt: Date.now(),
    isPublic: false,
  };
}

/**
 * 星曜显示组件
 */
const StarDisplay: React.FC<{ star: XingYao }> = ({ star }) => (
  <span style={{ marginRight: 4 }}>
    <Tag
      color={BRIGHTNESS_COLORS[star.brightness]}
      style={{ fontSize: 12, padding: '0 4px' }}
    >
      {star.name}
      {star.siHua !== undefined && (
        <span style={{ color: '#f5222d', marginLeft: 2 }}>
          {SI_HUA_SHORT[star.siHua]}
        </span>
      )}
    </Tag>
  </span>
);

/**
 * 宫位卡片组件
 */
const GongCard: React.FC<{ gongInfo: GongInfo }> = ({ gongInfo }) => (
  <div
    style={{
      border: '1px solid #d9d9d9',
      borderRadius: 4,
      padding: 8,
      minHeight: 100,
      backgroundColor: gongInfo.isShenGong ? '#fff7e6' : '#fff',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text strong style={{ fontSize: 12 }}>
        {gongInfo.name}
        {gongInfo.isShenGong && <Tag color="gold" style={{ marginLeft: 4, fontSize: 10 }}>身</Tag>}
      </Text>
      <Text type="secondary" style={{ fontSize: 10 }}>
        {TIAN_GAN_NAMES[gongInfo.tianGan]}{DI_ZHI_NAMES[gongInfo.diZhi]}
      </Text>
    </div>
    <div style={{ minHeight: 50 }}>
      {gongInfo.zhuXing.map((star, idx) => (
        <StarDisplay key={`zhu-${idx}`} star={star} />
      ))}
      {gongInfo.fuXing.map((star, idx) => (
        <StarDisplay key={`fu-${idx}`} star={star} />
      ))}
      {gongInfo.shaXing.map((star, idx) => (
        <StarDisplay key={`sha-${idx}`} star={star} />
      ))}
    </div>
  </div>
);

/**
 * 紫微斗数排盘页面
 */
const ZiweiPage: React.FC = () => {
  // 命主信息
  const [name, setName] = useState('求测者');
  const [gender, setGender] = useState<Gender>(Gender.Male);

  // 真太阳时
  const [useTrueSolarTime, setUseTrueSolarTime] = useState(false);

  // 出生地点
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [location, setLocation] = useState<string>('未知地');
  const [longitude, setLongitude] = useState<number>(116.416); // 经度（默认北京）
  const [latitude, setLatitude] = useState<number>(39.9288); // 纬度（默认北京）

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

  // 日期类型
  const [dateType, setDateType] = useState<DateType>('solar');

  // 出生日期
  const [birthDate, setBirthDate] = useState<Dayjs>(dayjs());
  const [birthHour, setBirthHour] = useState<number>(getCurrentHour());
  const [birthMinute, setBirthMinute] = useState<number>(new Date().getMinutes());

  // 紫微盘式
  const [chartType, setChartType] = useState<ChartType>('xiantian');

  // 流年日期
  const [flowDate, setFlowDate] = useState<Dayjs>(dayjs());
  const [flowHour, setFlowHour] = useState<number>(getCurrentHour());
  const [flowMinute, setFlowMinute] = useState<number>(new Date().getMinutes());

  // 加载状态
  const [loading, setLoading] = useState(false);
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [useChain, setUseChain] = useState(false); // 是否使用链端
  const [chainChartId, setChainChartId] = useState<number | null>(null);

  // 说明弹窗状态
  const [showInstructions, setShowInstructions] = useState(false);

  /**
   * 本地排盘
   */
  const handleLocalCalculate = useCallback(async () => {
    const result = generateMockZiweiChart(
      birthDate.year(),
      birthDate.month() + 1,
      birthDate.date(),
      birthHour,
      gender
    );
    setChart(result);
    message.success('命盘排列完成（本地模拟）');

    // 提示用户可以查看解盘详情
    setTimeout(() => {
      message.info('本地排盘仅供预览，使用链端排盘可获得完整解读');
    }, 1000);
  }, [birthDate, birthHour, gender]);

  /**
   * 链端排盘
   */
  const handleChainCalculate = useCallback(async () => {
    try {
      const chartId = await ziweiService.divineByTime(
        birthDate.year(),
        birthDate.month() + 1,  // 农历月份（简化处理）
        birthDate.date(),       // 农历日期
        birthHour as ziweiService.DiZhi,
        gender as ziweiService.Gender,
        false // 非闰月
      );
      setChainChartId(chartId);
      message.success(`链端排盘成功，命盘ID: ${chartId}`);

      // 跳转到解盘详情页
      setTimeout(() => {
        window.location.hash = `#/ziwei/interpretation/${chartId}`;
      }, 1500);
    } catch (error: any) {
      console.error('链端排盘失败:', error);
      message.error(`链端排盘失败: ${error.message || '请检查钱包连接'}`);
    }
  }, [birthDate, birthHour, gender]);

  /**
   * 排盘
   */
  const handleCalculate = useCallback(async () => {
    setLoading(true);
    try {
      if (useChain) {
        await handleChainCalculate();
      } else {
        await handleLocalCalculate();
      }
    } catch (error) {
      console.error('排盘失败:', error);
      message.error('排盘失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [useChain, handleChainCalculate, handleLocalCalculate]);

  /**
   * 重置
   */
  const handleReset = useCallback(() => {
    setName('求测者');
    setGender(Gender.Male);
    setUseTrueSolarTime(false);
    setProvince('');
    setCity('');
    setDateType('solar');
    setBirthDate(dayjs());
    setBirthHour(getCurrentHour());
    setBirthMinute(new Date().getMinutes());
    setChartType('xiantian');
    setFlowDate(dayjs());
    setFlowHour(getCurrentHour());
    setFlowMinute(new Date().getMinutes());
    setChart(null);
    setChainChartId(null);
  }, []);

  /**
   * 使用当前时间
   */
  const useCurrentTime = useCallback(() => {
    setBirthDate(dayjs());
    setBirthHour(getCurrentHour());
    setBirthMinute(new Date().getMinutes());
  }, []);

  /**
   * 渲染说明弹窗
   */
  const renderInstructionsModal = () => (
    <Modal
      title={
        <span style={{ fontSize: 18, fontWeight: 600 }}>
          <QuestionCircleOutlined style={{ marginRight: 8, color: '#B2955D' }} />
          紫微斗数 · 排盘说明
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
          排盘结果将上链保存，可永久查询。排盘需要支付少量 Gas 费用。本地排盘可快速预览命盘结构。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 紫微斗数基础 */}
        <Title level={5} style={{ color: '#B2955D' }}>紫微斗数基础</Title>
        <Paragraph>
          <Text strong>紫微斗数</Text>是中国传统命理学的重要分支，号称"天下第一神数"。以星宿为主导，结合阴阳五行、天干地支、十二宫位，通过分析命盘推断人的性格、命运、流年运势。
        </Paragraph>
        <Paragraph>
          紫微斗数以出生的年、月、日、时和性别为基础，排列出十二宫位的星曜分布，再通过大限、流年、流月、流日来分析运势变化，是最细致准确的命理体系之一。
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 十二宫位 */}
        <Title level={5} style={{ color: '#B2955D' }}>十二宫位</Title>
        <Paragraph>
          <Text strong style={{ color: '#B2955D' }}>• 命宫：</Text>主管性格、气质、先天运势
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 兄弟宫：</Text>兄弟姐妹关系、合作运
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 夫妻宫：</Text>婚姻感情、配偶状况
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 子女宫：</Text>子女关系、生育状况
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 财帛宫：</Text>财运、理财能力
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 疾厄宫：</Text>健康状况、体质
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 迁移宫：</Text>出外运、变动运
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 交友宫：</Text>朋友、同事、下属关系
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 官禄宫：</Text>事业、工作、成就
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 田宅宫：</Text>不动产、家庭环境
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 福德宫：</Text>精神生活、享受
          <br />
          <Text strong style={{ color: '#B2955D' }}>• 父母宫：</Text>父母关系、长辈运
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 星曜系统 */}
        <Title level={5} style={{ color: '#B2955D' }}>星曜系统</Title>
        <Paragraph>
          <Text strong>主星：</Text>紫微星系（紫微、天机、太阳、武曲、天同、廉贞）和天府星系（天府、太阴、贪狼、巨门、天相、天梁、七杀、破军）14颗主星，决定命运的基本格局
          <br />
          <Text strong>辅星：</Text>文昌、文曲、左辅、右弼等，辅助主星发挥作用
          <br />
          <Text strong>煞星：</Text>擎羊、陀罗、火星、铃星、地空、地劫等，主管挫折和磨难
        </Paragraph>

        <Divider style={{ margin: '16px 0' }} />

        {/* 区块链优势 */}
        <Title level={5} style={{ color: '#B2955D' }}>区块链优势</Title>
        <Paragraph>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            <li style={{ marginBottom: 8 }}>
              <Text strong>链上存储：</Text>所有命盘数据上链保存，永不丢失
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>可追溯性：</Text>随时可查询历史记录，包含完整的排盘信息
            </li>
            <li style={{ marginBottom: 8 }}>
              <Text strong>智能分析：</Text>链端AI自动分析命盘，提供专业解读
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
            <li style={{ marginBottom: 8 }}>排盘需要准确的出生时间，如不确定时辰可选择相近时段</li>
            <li style={{ marginBottom: 8 }}>性别会影响大限的顺逆排列</li>
            <li style={{ marginBottom: 8 }}>链端排盘需要连接钱包并支付少量 Gas 费用</li>
            <li style={{ marginBottom: 8 }}>本地排盘可快速预览命盘结构，不上链存储</li>
            <li style={{ marginBottom: 8 }}>如需专业解读，可前往"占卜服务市场"寻找大师</li>
          </ul>
        </Paragraph>
      </div>
    </Modal>
  );

  /**
   * 渲染输入表单
   */
  const renderInputForm = () => (
    <Card className="divination-card input-card" style={{ margin: '12px', borderRadius: '8px', width: 'calc(100% + 10px)', marginLeft: '-5px' }}>
      {/* 命主姓名 + 性别 */}
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

      {/* 真太阳时 */}
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
      <div className="form-row" style={{ marginBottom: 16 }}>
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
      <div className="form-row" style={{ marginBottom: 8 }}>
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
        <div className="form-row" style={{ marginBottom: 8 }}>
          <div className="form-label" style={{ width: 65 }}></div>
          <div className="form-content" style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: '#999' }}>
              真太阳时：{birthDate.year()}年{birthDate.month() + 1}月{birthDate.date()}日 {birthHour}时{birthMinute}分
            </Text>
          </div>
        </div>
      )}

      {/* 日期类型 */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 65, textAlign: 'right', paddingRight: 8 }}>
          日期类型：
        </div>
        <div className="form-content" style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <Radio.Group
            value={dateType}
            onChange={(e: RadioChangeEvent) => setDateType(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="solar">阳历</Radio.Button>
            <Radio.Button value="lunar">阴历</Radio.Button>
          </Radio.Group>
        </div>
      </div>

      {/* 出生日期（年月日 + 时分，参考卜易居合并一行） */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 65, textAlign: 'right', paddingRight: 8 }}>
          出生日期：
        </div>
        <div className="form-content" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <Select
            value={birthDate.year()}
            onChange={(v) => setBirthDate(birthDate.year(v))}
            style={{ width: 85 }}
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

      {/* 紫微盘式 */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 65, textAlign: 'right', paddingRight: 8 }}>
          紫微盘式：
        </div>
        <div className="form-content" style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <Radio.Group
            value={chartType}
            onChange={(e: RadioChangeEvent) => setChartType(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="xiantian">先天</Radio.Button>
            <Radio.Button value="liunian">流年</Radio.Button>
            <Radio.Button value="liuyue">流月</Radio.Button>
            <Radio.Button value="liuri">流日</Radio.Button>
          </Radio.Group>
        </div>
      </div>

      {/* 流年日期 - 始终显示（参考卜易居） */}
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ width: 65, textAlign: 'right', paddingRight: 8 }}>
          流年日期：
        </div>
        <div className="form-content" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <Select
            value={flowDate.year()}
            onChange={(v) => setFlowDate(flowDate.year(v))}
            style={{ width: 85 }}
            options={Array.from({ length: 50 }, (_, i) => ({
              value: 2000 + i,
              label: `${2000 + i}年`
            }))}
          />
          <Select
            value={flowDate.month() + 1}
            onChange={(v) => setFlowDate(flowDate.month(v - 1))}
            style={{ width: 70 }}
            options={Array.from({ length: 12 }, (_, i) => ({
              value: i + 1,
              label: `${i + 1}月`
            }))}
          />
          <Select
            value={flowDate.date()}
            onChange={(v) => setFlowDate(flowDate.date(v))}
            style={{ width: 70 }}
            options={Array.from({ length: 31 }, (_, i) => ({
              value: i + 1,
              label: `${i + 1}日`
            }))}
          />
          <Select
            value={flowHour}
            onChange={setFlowHour}
            style={{ width: 78 }}
            options={SHICHEN_OPTIONS}
          />
          <span>时</span>
          <Select
            value={flowMinute}
            onChange={setFlowMinute}
            style={{ width: 58 }}
            options={Array.from({ length: 60 }, (_, i) => ({
              value: i,
              label: `${i}`
            }))}
          />
          <span>分</span>
        </div>
      </div>

      {/* 排盘按钮 */}
      <div style={{ marginTop: 24 }}>
        <Button
          type="primary"
          size="large"
          onClick={handleCalculate}
          loading={loading}
          block
          style={{
            background: '#1a1a1a',
            border: 'none',
            height: 48,
            fontSize: 16,
            fontWeight: 500,
            borderRadius: 24
          }}
        >
          开始排盘
        </Button>
      </div>
    </Card>
  );

  /**
   * 渲染命盘
   */
  const renderChart = () => {
    if (!chart) return null;

    // 紫微命盘按照传统布局：3x4 格子
    // 顺序：巳午未申 / 辰(空)卯酉 / 寅丑子亥
    const layoutOrder = [
      [4, 5, 6, 7],      // 巳午未申 -> 疾厄、迁移、仆役、官禄
      [3, -1, -1, 8],    // 辰(空)卯酉 -> 子女、(中央)、田宅
      [2, 1, 0, 11],     // 卯寅丑子 -> 夫妻、兄弟、命宫、父母
      [9, 10, 11, null], // 戌亥子(已用) -> 田宅、福德、父母
    ];

    return (
      <Card className="chart-card" style={{ marginTop: 16 }}>
        <Title level={5}>
          命盘 - {WU_XING_JU_NAMES[chart.wuXingJu]}
        </Title>
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">
            命主：{ZHU_XING_NAMES[chart.mingZhu]} | 身主：{ZHU_XING_NAMES[chart.shenZhu]}
          </Text>
        </div>

        {/* 简化的命盘布局 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 4,
          }}
        >
          {/* 第一行：巳午未申 */}
          <GongCard gongInfo={chart.gongs[5]} />
          <GongCard gongInfo={chart.gongs[6]} />
          <GongCard gongInfo={chart.gongs[7]} />
          <GongCard gongInfo={chart.gongs[8]} />

          {/* 第二行：辰 中央 中央 酉 */}
          <GongCard gongInfo={chart.gongs[4]} />
          <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #d9d9d9', borderRadius: 4 }}>
            <div style={{ textAlign: 'center' }}>
              <Text strong style={{ fontSize: 16 }}>紫微斗数</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {chart.birthYear}年{chart.birthMonth}月{chart.birthDay}日
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {HOUR_OPTIONS[chart.birthHour]?.label.split(' ')[0]}
                {chart.gender === Gender.Male ? '男' : '女'}命
              </Text>
            </div>
          </div>
          <GongCard gongInfo={chart.gongs[9]} />

          {/* 第三行：卯 寅 丑 戌 */}
          <GongCard gongInfo={chart.gongs[3]} />
          <GongCard gongInfo={chart.gongs[2]} />
          <GongCard gongInfo={chart.gongs[1]} />
          <GongCard gongInfo={chart.gongs[10]} />

          {/* 第四行：子 亥 */}
          <GongCard gongInfo={chart.gongs[0]} />
          <GongCard gongInfo={chart.gongs[11]} />
          <div style={{ gridColumn: 'span 2' }} />
        </div>

        {/* 大限信息 */}
        <Divider />
        <Title level={5}>大限运程</Title>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {chart.daXians.slice(0, 6).map((dx) => (
            <Tag key={dx.index} color="blue">
              {dx.startAge}-{dx.endAge}岁：{GONG_NAMES[dx.gong]}
            </Tag>
          ))}
        </div>

        {/* 链端排盘提示 */}
        {!useChain && chainChartId && (
          <div style={{ marginTop: 16 }}>
            <Button
              type="primary"
              block
              onClick={() => window.location.hash = `#/ziwei/interpretation/${chainChartId}`}
            >
              查看完整解盘
            </Button>
          </div>
        )}
        {!useChain && !chainChartId && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              本地排盘仅供预览，使用链端排盘可获得完整解读
            </Text>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="ziwei-page">
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
        {/* 左边：我的命盘 */}
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', cursor: 'pointer' }}
          onClick={() => (window.location.hash = '#/ziwei/list')}
        >
          <HistoryOutlined style={{ fontSize: '18px', color: '#999' }} />
          <div style={{ fontSize: '10px', color: '#999' }}>我的命盘</div>
        </div>

        {/* 中间：紫微斗数 */}
        <div style={{ fontSize: '18px', color: '#333', fontWeight: '500', whiteSpace: 'nowrap' }}>星尘玄鉴-紫微斗数排盘</div>

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

      <Spin spinning={loading}>
        {renderInputForm()}
        {renderChart()}
      </Spin>

      {/* 说明弹窗 */}
      {renderInstructionsModal()}

      {/* 底部导航 */}
      <div className="bottom-nav">
        <Space split={<Divider type="vertical" />}>
          <Button type="link" onClick={() => (window.location.hash = '#/ziwei/list')}>
            <HistoryOutlined /> 我的命盘
          </Button>
          <Button type="link" onClick={() => (window.location.hash = '#/divination')}>
            <ArrowRightOutlined /> 占卜入口
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default ZiweiPage;
