/**
 * 中国主要城市经纬度数据
 * 用于八字排盘的真太阳时计算
 */

export interface CityCoordinate {
  name: string;
  longitude: number; // 经度
  latitude: number;  // 纬度
}

// 省会城市和主要城市经纬度
export const CITY_COORDINATES: Record<string, CityCoordinate> = {
  // 直辖市
  '北京市': { name: '北京市', longitude: 116.4074, latitude: 39.9042 },
  '天津市': { name: '天津市', longitude: 117.1901, latitude: 39.0851 },
  '上海市': { name: '上海市', longitude: 121.4737, latitude: 31.2304 },
  '重庆市': { name: '重庆市', longitude: 106.5516, latitude: 29.5630 },

  // 省会城市
  '石家庄市': { name: '石家庄市', longitude: 114.5149, latitude: 38.0428 },
  '太原市': { name: '太原市', longitude: 112.5489, latitude: 37.8706 },
  '呼和浩特市': { name: '呼和浩特市', longitude: 111.7490, latitude: 40.8424 },
  '沈阳市': { name: '沈阳市', longitude: 123.4315, latitude: 41.7922 },
  '长春市': { name: '长春市', longitude: 125.3235, latitude: 43.8171 },
  '哈尔滨市': { name: '哈尔滨市', longitude: 126.6424, latitude: 45.7567 },
  '南京市': { name: '南京市', longitude: 118.7969, latitude: 32.0603 },
  '杭州市': { name: '杭州市', longitude: 120.1551, latitude: 30.2741 },
  '合肥市': { name: '合肥市', longitude: 117.2272, latitude: 31.8206 },
  '福州市': { name: '福州市', longitude: 119.2965, latitude: 26.0745 },
  '南昌市': { name: '南昌市', longitude: 115.8579, latitude: 28.6820 },
  '济南市': { name: '济南市', longitude: 117.1205, latitude: 36.6510 },
  '郑州市': { name: '郑州市', longitude: 113.6254, latitude: 34.7466 },
  '武汉市': { name: '武汉市', longitude: 114.3055, latitude: 30.5928 },
  '长沙市': { name: '长沙市', longitude: 112.9388, latitude: 28.2282 },
  '广州市': { name: '广州市', longitude: 113.2644, latitude: 23.1291 },
  '南宁市': { name: '南宁市', longitude: 108.3661, latitude: 22.8170 },
  '海口市': { name: '海口市', longitude: 110.1999, latitude: 20.0444 },
  '成都市': { name: '成都市', longitude: 104.0657, latitude: 30.6595 },
  '贵阳市': { name: '贵阳市', longitude: 106.6302, latitude: 26.6477 },
  '昆明市': { name: '昆明市', longitude: 102.8329, latitude: 24.8801 },
  '拉萨市': { name: '拉萨市', longitude: 91.1145, latitude: 29.6500 },
  '西安市': { name: '西安市', longitude: 108.9398, latitude: 34.3416 },
  '兰州市': { name: '兰州市', longitude: 103.8343, latitude: 36.0611 },
  '西宁市': { name: '西宁市', longitude: 101.7782, latitude: 36.6171 },
  '银川市': { name: '银川市', longitude: 106.2782, latitude: 38.4664 },
  '乌鲁木齐市': { name: '乌鲁木齐市', longitude: 87.6177, latitude: 43.7928 },

  // 主要城市
  '深圳市': { name: '深圳市', longitude: 114.0579, latitude: 22.5431 },
  '珠海市': { name: '珠海市', longitude: 113.5767, latitude: 22.2707 },
  '汕头市': { name: '汕头市', longitude: 116.6822, latitude: 23.3535 },
  '佛山市': { name: '佛山市', longitude: 113.1219, latitude: 23.0214 },
  '东莞市': { name: '东莞市', longitude: 113.7518, latitude: 23.0205 },
  '中山市': { name: '中山市', longitude: 113.3926, latitude: 22.5171 },
  '惠州市': { name: '惠州市', longitude: 114.4160, latitude: 23.1115 },
  '厦门市': { name: '厦门市', longitude: 118.0894, latitude: 24.4798 },
  '泉州市': { name: '泉州市', longitude: 118.6758, latitude: 24.8741 },
  '苏州市': { name: '苏州市', longitude: 120.5853, latitude: 31.2989 },
  '无锡市': { name: '无锡市', longitude: 120.3119, latitude: 31.4912 },
  '常州市': { name: '常州市', longitude: 119.9741, latitude: 31.8118 },
  '南通市': { name: '南通市', longitude: 120.8943, latitude: 31.9807 },
  '宁波市': { name: '宁波市', longitude: 121.5440, latitude: 29.8683 },
  '温州市': { name: '温州市', longitude: 120.6994, latitude: 28.0006 },
  '嘉兴市': { name: '嘉兴市', longitude: 120.7555, latitude: 30.7463 },
  '绍兴市': { name: '绍兴市', longitude: 120.5802, latitude: 30.0360 },
  '金华市': { name: '金华市', longitude: 119.6492, latitude: 29.0895 },
  '青岛市': { name: '青岛市', longitude: 120.3826, latitude: 36.0671 },
  '烟台市': { name: '烟台市', longitude: 121.4479, latitude: 37.4638 },
  '威海市': { name: '威海市', longitude: 122.1164, latitude: 37.5091 },
  '潍坊市': { name: '潍坊市', longitude: 119.1619, latitude: 36.7068 },
  '淄博市': { name: '淄博市', longitude: 118.0548, latitude: 36.8133 },
  '大连市': { name: '大连市', longitude: 121.6147, latitude: 38.9140 },
  '鞍山市': { name: '鞍山市', longitude: 122.9945, latitude: 41.1085 },
  '唐山市': { name: '唐山市', longitude: 118.1802, latitude: 39.6305 },
  '秦皇岛市': { name: '秦皇岛市', longitude: 119.6005, latitude: 39.9354 },
  '保定市': { name: '保定市', longitude: 115.4646, latitude: 38.8737 },
  '廊坊市': { name: '廊坊市', longitude: 116.6838, latitude: 39.5383 },
  '洛阳市': { name: '洛阳市', longitude: 112.4540, latitude: 34.6197 },
  '开封市': { name: '开封市', longitude: 114.3076, latitude: 34.7971 },
  '许昌市': { name: '许昌市', longitude: 113.8523, latitude: 34.0354 },
  '芜湖市': { name: '芜湖市', longitude: 118.4327, latitude: 31.3525 },
  '蚌埠市': { name: '蚌埠市', longitude: 117.3891, latitude: 32.9166 },
  '九江市': { name: '九江市', longitude: 116.0019, latitude: 29.7052 },
  '赣州市': { name: '赣州市', longitude: 114.9350, latitude: 25.8312 },
  '桂林市': { name: '桂林市', longitude: 110.2903, latitude: 25.2744 },
  '柳州市': { name: '柳州市', longitude: 109.4286, latitude: 24.3264 },
  '三亚市': { name: '三亚市', longitude: 109.5119, latitude: 18.2528 },
  '绵阳市': { name: '绵阳市', longitude: 104.6796, latitude: 31.4677 },
  '泸州市': { name: '泸州市', longitude: 105.4423, latitude: 28.8713 },
  '遵义市': { name: '遵义市', longitude: 106.9272, latitude: 27.7257 },
  '大理市': { name: '大理市', longitude: 100.2672, latitude: 25.6065 },
  '丽江市': { name: '丽江市', longitude: 100.2330, latitude: 26.8554 },
  '西双版纳傣族自治州': { name: '西双版纳', longitude: 100.7971, latitude: 22.0017 },
  '宝鸡市': { name: '宝鸡市', longitude: 107.2378, latitude: 34.3618 },
  '咸阳市': { name: '咸阳市', longitude: 108.7054, latitude: 34.3295 },
  '延安市': { name: '延安市', longitude: 109.4894, latitude: 36.5853 },
  '天水市': { name: '天水市', longitude: 105.7248, latitude: 34.5809 },
  '酒泉市': { name: '酒泉市', longitude: 98.4941, latitude: 39.7327 },
  '包头市': { name: '包头市', longitude: 109.8404, latitude: 40.6573 },
  '鄂尔多斯市': { name: '鄂尔多斯市', longitude: 109.7816, latitude: 39.6082 },
  '吉林市': { name: '吉林市', longitude: 126.5493, latitude: 43.8378 },
  '齐齐哈尔市': { name: '齐齐哈尔市', longitude: 123.9180, latitude: 47.3541 },
  '大庆市': { name: '大庆市', longitude: 125.1044, latitude: 46.5898 },
  '牡丹江市': { name: '牡丹江市', longitude: 129.6085, latitude: 44.5528 },
  '徐州市': { name: '徐州市', longitude: 117.2845, latitude: 34.2044 },
  '连云港市': { name: '连云港市', longitude: 119.2216, latitude: 34.5967 },
  '盐城市': { name: '盐城市', longitude: 120.1394, latitude: 33.3478 },
  '扬州市': { name: '扬州市', longitude: 119.4216, latitude: 32.3936 },
  '镇江市': { name: '镇江市', longitude: 119.4248, latitude: 32.1882 },
  '泰州市': { name: '泰州市', longitude: 119.9232, latitude: 32.4551 },
  '台州市': { name: '台州市', longitude: 121.4208, latitude: 28.6561 },
  '湖州市': { name: '湖州市', longitude: 120.0865, latitude: 30.8943 },
  '衢州市': { name: '衢州市', longitude: 118.8750, latitude: 28.9355 },
  '丽水市': { name: '丽水市', longitude: 119.9228, latitude: 28.4672 },
  '舟山市': { name: '舟山市', longitude: 122.2068, latitude: 29.9853 },
  '漳州市': { name: '漳州市', longitude: 117.6476, latitude: 24.5128 },
  '莆田市': { name: '莆田市', longitude: 119.0078, latitude: 25.4541 },
  '三明市': { name: '三明市', longitude: 117.6389, latitude: 26.2631 },
  '龙岩市': { name: '龙岩市', longitude: 117.0170, latitude: 25.0750 },
  '宁德市': { name: '宁德市', longitude: 119.5479, latitude: 26.6658 },
  '景德镇市': { name: '景德镇市', longitude: 117.1784, latitude: 29.2686 },
  '萍乡市': { name: '萍乡市', longitude: 113.8872, latitude: 27.6228 },
  '新余市': { name: '新余市', longitude: 114.9173, latitude: 27.8180 },
  '鹰潭市': { name: '鹰潭市', longitude: 117.0689, latitude: 28.2608 },
  '吉安市': { name: '吉安市', longitude: 114.9927, latitude: 27.1138 },
  '宜春市': { name: '宜春市', longitude: 114.4161, latitude: 27.8136 },
  '抚州市': { name: '抚州市', longitude: 116.3582, latitude: 27.9484 },
  '上饶市': { name: '上饶市', longitude: 117.9431, latitude: 28.4550 },
  '临沂市': { name: '临沂市', longitude: 118.3262, latitude: 35.0653 },
  '德州市': { name: '德州市', longitude: 116.3575, latitude: 37.4341 },
  '聊城市': { name: '聊城市', longitude: 115.9853, latitude: 36.4569 },
  '滨州市': { name: '滨州市', longitude: 117.9706, latitude: 37.3821 },
  '菏泽市': { name: '菏泽市', longitude: 115.4804, latitude: 35.2336 },
  '枣庄市': { name: '枣庄市', longitude: 117.3238, latitude: 34.8108 },
  '东营市': { name: '东营市', longitude: 118.6747, latitude: 37.4346 },
  '泰安市': { name: '泰安市', longitude: 117.0879, latitude: 36.2001 },
  '济宁市': { name: '济宁市', longitude: 116.5871, latitude: 35.4148 },
  '日照市': { name: '日照市', longitude: 119.5269, latitude: 35.4164 },
  '宜昌市': { name: '宜昌市', longitude: 111.2864, latitude: 30.6918 },
  '襄阳市': { name: '襄阳市', longitude: 112.1228, latitude: 32.0087 },
  '荆州市': { name: '荆州市', longitude: 112.2390, latitude: 30.3269 },
  '黄石市': { name: '黄石市', longitude: 115.0389, latitude: 30.1996 },
  '十堰市': { name: '十堰市', longitude: 110.7879, latitude: 32.6468 },
  '恩施土家族苗族自治州': { name: '恩施', longitude: 109.4869, latitude: 30.2721 },
  '株洲市': { name: '株洲市', longitude: 113.1338, latitude: 27.8274 },
  '湘潭市': { name: '湘潭市', longitude: 112.9446, latitude: 27.8297 },
  '衡阳市': { name: '衡阳市', longitude: 112.5718, latitude: 26.8936 },
  '岳阳市': { name: '岳阳市', longitude: 113.1286, latitude: 29.3571 },
  '常德市': { name: '常德市', longitude: 111.6987, latitude: 29.0318 },
  '张家界市': { name: '张家界市', longitude: 110.4792, latitude: 29.1170 },
  '益阳市': { name: '益阳市', longitude: 112.3553, latitude: 28.5530 },
  '郴州市': { name: '郴州市', longitude: 113.0147, latitude: 25.7704 },
  '永州市': { name: '永州市', longitude: 111.6131, latitude: 26.4345 },
  '怀化市': { name: '怀化市', longitude: 109.9777, latitude: 27.5501 },
  '娄底市': { name: '娄底市', longitude: 111.9938, latitude: 27.6973 },
  '邵阳市': { name: '邵阳市', longitude: 111.4691, latitude: 27.2389 },
  '湘西土家族苗族自治州': { name: '湘西', longitude: 109.7379, latitude: 28.3119 },
  '梧州市': { name: '梧州市', longitude: 111.2795, latitude: 23.4765 },
  '北海市': { name: '北海市', longitude: 109.1200, latitude: 21.4814 },
  '防城港市': { name: '防城港市', longitude: 108.3549, latitude: 21.6869 },
  '钦州市': { name: '钦州市', longitude: 108.6554, latitude: 21.9671 },
  '贵港市': { name: '贵港市', longitude: 109.5982, latitude: 23.1116 },
  '玉林市': { name: '玉林市', longitude: 110.1646, latitude: 22.6362 },
  '百色市': { name: '百色市', longitude: 106.6185, latitude: 23.9023 },
  '贺州市': { name: '贺州市', longitude: 111.5525, latitude: 24.4035 },
  '河池市': { name: '河池市', longitude: 108.0854, latitude: 24.6928 },
  '来宾市': { name: '来宾市', longitude: 109.2216, latitude: 23.7503 },
  '崇左市': { name: '崇左市', longitude: 107.3645, latitude: 22.3774 },
  '自贡市': { name: '自贡市', longitude: 104.7733, latitude: 29.3520 },
  '攀枝花市': { name: '攀枝花市', longitude: 101.7181, latitude: 26.5823 },
  '德阳市': { name: '德阳市', longitude: 104.3981, latitude: 31.1269 },
  '广元市': { name: '广元市', longitude: 105.8432, latitude: 32.4351 },
  '遂宁市': { name: '遂宁市', longitude: 105.5929, latitude: 30.5330 },
  '内江市': { name: '内江市', longitude: 105.0584, latitude: 29.5801 },
  '乐山市': { name: '乐山市', longitude: 103.7655, latitude: 29.5521 },
  '南充市': { name: '南充市', longitude: 106.1106, latitude: 30.8372 },
  '眉山市': { name: '眉山市', longitude: 103.8486, latitude: 30.0764 },
  '宜宾市': { name: '宜宾市', longitude: 104.6428, latitude: 28.7520 },
  '广安市': { name: '广安市', longitude: 106.6333, latitude: 30.4560 },
  '达州市': { name: '达州市', longitude: 107.4680, latitude: 31.2095 },
  '雅安市': { name: '雅安市', longitude: 103.0014, latitude: 29.9880 },
  '巴中市': { name: '巴中市', longitude: 106.7477, latitude: 31.8672 },
  '资阳市': { name: '资阳市', longitude: 104.6277, latitude: 30.1287 },
  '六盘水市': { name: '六盘水市', longitude: 104.8460, latitude: 26.5847 },
  '安顺市': { name: '安顺市', longitude: 105.9323, latitude: 26.2456 },
  '毕节市': { name: '毕节市', longitude: 105.2853, latitude: 27.3017 },
  '铜仁市': { name: '铜仁市', longitude: 109.1897, latitude: 27.7183 },
  '曲靖市': { name: '曲靖市', longitude: 103.7961, latitude: 25.4902 },
  '玉溪市': { name: '玉溪市', longitude: 102.5467, latitude: 24.3520 },
  '保山市': { name: '保山市', longitude: 99.1671, latitude: 25.1120 },
  '昭通市': { name: '昭通市', longitude: 103.7169, latitude: 27.3388 },
  '普洱市': { name: '普洱市', longitude: 100.9662, latitude: 22.8254 },
  '临沧市': { name: '临沧市', longitude: 100.0866, latitude: 23.8866 },
  '日喀则市': { name: '日喀则市', longitude: 88.8806, latitude: 29.2668 },
  '昌都市': { name: '昌都市', longitude: 97.1785, latitude: 31.1409 },
  '林芝市': { name: '林芝市', longitude: 94.3624, latitude: 29.6490 },
  '山南市': { name: '山南市', longitude: 91.7665, latitude: 29.2290 },
  '那曲市': { name: '那曲市', longitude: 92.0512, latitude: 31.4763 },
  '铜川市': { name: '铜川市', longitude: 108.9451, latitude: 34.8967 },
  '渭南市': { name: '渭南市', longitude: 109.5096, latitude: 34.4998 },
  '汉中市': { name: '汉中市', longitude: 107.0286, latitude: 33.0672 },
  '榆林市': { name: '榆林市', longitude: 109.7346, latitude: 38.2851 },
  '安康市': { name: '安康市', longitude: 109.0293, latitude: 32.6903 },
  '商洛市': { name: '商洛市', longitude: 109.9180, latitude: 33.8684 },
  '嘉峪关市': { name: '嘉峪关市', longitude: 98.2773, latitude: 39.7865 },
  '金昌市': { name: '金昌市', longitude: 102.1877, latitude: 38.5200 },
  '白银市': { name: '白银市', longitude: 104.1389, latitude: 36.5447 },
  '武威市': { name: '武威市', longitude: 102.6378, latitude: 37.9283 },
  '张掖市': { name: '张掖市', longitude: 100.4496, latitude: 38.9260 },
  '平凉市': { name: '平凉市', longitude: 106.6651, latitude: 35.5428 },
  '庆阳市': { name: '庆阳市', longitude: 107.6433, latitude: 35.7093 },
  '定西市': { name: '定西市', longitude: 104.5921, latitude: 35.5806 },
  '陇南市': { name: '陇南市', longitude: 104.9220, latitude: 33.3886 },
  '海东市': { name: '海东市', longitude: 102.1028, latitude: 36.5023 },
  '石嘴山市': { name: '石嘴山市', longitude: 106.3761, latitude: 38.9833 },
  '吴忠市': { name: '吴忠市', longitude: 106.1995, latitude: 37.9975 },
  '固原市': { name: '固原市', longitude: 106.2426, latitude: 36.0160 },
  '中卫市': { name: '中卫市', longitude: 105.1965, latitude: 37.5001 },
  '克拉玛依市': { name: '克拉玛依市', longitude: 84.8893, latitude: 45.5959 },
  '吐鲁番市': { name: '吐鲁番市', longitude: 89.1895, latitude: 42.9513 },
  '哈密市': { name: '哈密市', longitude: 93.5132, latitude: 42.8333 },
};

/**
 * 根据城市名获取经纬度
 * 支持模糊匹配（去除"市"等后缀）
 */
export function getCityCoordinate(cityName: string): CityCoordinate | null {
  // 精确匹配
  if (CITY_COORDINATES[cityName]) {
    return CITY_COORDINATES[cityName];
  }

  // 尝试添加"市"后缀匹配
  const withSuffix = cityName + '市';
  if (CITY_COORDINATES[withSuffix]) {
    return CITY_COORDINATES[withSuffix];
  }

  // 尝试去除"市"后缀匹配
  const withoutSuffix = cityName.replace(/市$/, '');
  for (const key of Object.keys(CITY_COORDINATES)) {
    if (key.replace(/市$/, '') === withoutSuffix) {
      return CITY_COORDINATES[key];
    }
  }

  return null;
}

/**
 * 获取默认坐标（北京）
 */
export function getDefaultCoordinate(): CityCoordinate {
  return CITY_COORDINATES['北京市'];
}
