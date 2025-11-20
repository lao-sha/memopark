#!/usr/bin/env node

/**
 * 函数级详细中文注释：创建不同分类的测试逝者数据
 * 用于验证分类过滤功能
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');

// 分类代码映射
const categoryCodeMap = {
  'Ordinary': 0,
  'HistoricalFigure': 1,
  'Martyr': 2,
  'Hero': 3,
  'PublicFigure': 4,
  'ReligiousFigure': 5,
  'EventHall': 6
};

// 不同分类的测试逝者数据
const testDataByCategory = [
  // 普通民众（不会在公众纪念馆显示）
  {
    fullName: "张三",
    bio: "普通工人，勤劳善良",
    category: "Ordinary",
    birthDate: new Date('1950-01-01'),
    deathDate: new Date('2020-01-01'),
    gender: "Male"
  },
  {
    fullName: "李四",
    bio: "普通农民，朴实无华",
    category: "Ordinary",
    birthDate: new Date('1945-05-15'),
    deathDate: new Date('2018-12-20'),
    gender: "Male"
  },

  // 历史人物（伟人馆）
  {
    fullName: "毛泽东",
    bio: "中华人民共和国开国领袖，伟大的马克思主义者",
    category: "HistoricalFigure",
    birthDate: new Date('1893-12-26'),
    deathDate: new Date('1976-09-09'),
    gender: "Male"
  },
  {
    fullName: "邓小平",
    bio: "中国改革开放的总设计师",
    category: "HistoricalFigure",
    birthDate: new Date('1904-08-22'),
    deathDate: new Date('1997-02-19'),
    gender: "Male"
  },

  // 革命烈士（英雄馆）
  {
    fullName: "黄继光",
    bio: "中国人民志愿军战士，在抗美援朝战争中壮烈牺牲",
    category: "Martyr",
    birthDate: new Date('1931-01-08'),
    deathDate: new Date('1952-10-20'),
    gender: "Male"
  },
  {
    fullName: "董存瑞",
    bio: "中国人民解放军战士，舍身炸碉堡的英雄",
    category: "Martyr",
    birthDate: new Date('1929-10-15'),
    deathDate: new Date('1948-05-25'),
    gender: "Male"
  },

  // 英雄模范（英雄馆）
  {
    fullName: "袁隆平",
    bio: "中国杂交水稻育种专家，被誉为杂交水稻之父",
    category: "Hero",
    birthDate: new Date('1930-09-07'),
    deathDate: new Date('2021-05-22'),
    gender: "Male"
  },
  {
    fullName: "钟南山",
    bio: "中国工程院院士，抗击疫情的英雄",
    category: "Hero",
    birthDate: new Date('1936-10-20'),
    deathDate: new Date('2030-01-01'), // 假设的未来日期，用于测试
    gender: "Male"
  },

  // 公众人物（名人馆）
  {
    fullName: "梅兰芳",
    bio: "中国京剧表演艺术家，四大名旦之首",
    category: "PublicFigure",
    birthDate: new Date('1894-10-22'),
    deathDate: new Date('1961-08-08'),
    gender: "Male"
  },
  {
    fullName: "华罗庚",
    bio: "中国数学家，现代数学的开拓者",
    category: "PublicFigure",
    birthDate: new Date('1910-11-12'),
    deathDate: new Date('1985-06-12'),
    gender: "Male"
  },

  // 宗教人物/院士（院士馆）
  {
    fullName: "竺可桢",
    bio: "中国科学院院士，气象学和地理学家",
    category: "ReligiousFigure",
    birthDate: new Date('1890-03-07'),
    deathDate: new Date('1974-02-07'),
    gender: "Male"
  },

  // 事件馆
  {
    fullName: "南京大屠杀纪念",
    bio: "纪念1937年南京大屠杀遇难同胞",
    category: "EventHall",
    birthDate: new Date('1937-12-13'),
    deathDate: new Date('1938-01-31'),
    gender: "Other"
  }
];

async function createCategoryTestData() {
  console.log('🔗 正在连接到Substrate节点...');

  const wsEndpoint = 'ws://127.0.0.1:9944';
  const provider = new WsProvider(wsEndpoint);

  try {
    const api = await ApiPromise.create({ provider });
    console.log(`✅ 已连接到链：${await api.rpc.system.chain()}`);

    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');

    console.log(`📊 开始创建 ${testDataByCategory.length} 个测试逝者（各分类）...`);
    console.log('─'.repeat(80));

    for (const [index, data] of testDataByCategory.entries()) {
      try {
        console.log(`📝 ${index + 1}/${testDataByCategory.length}: ${data.fullName} (${data.category})`);

        // 创建逝者
        const createTx = api.tx.deceased.createDeceased(
          data.fullName,
          data.gender === 'Male' ? 0 : data.gender === 'Female' ? 1 : 2,
          `ipfs-name-${index}`,
          data.birthDate.toISOString().slice(0,10).replace(/-/g, ''),
          data.deathDate.toISOString().slice(0,10).replace(/-/g, ''),
          []
        );

        await createTx.signAndSend(alice);
        console.log(`  ✅ 逝者创建成功`);

        // 等待区块确认
        await new Promise(resolve => setTimeout(resolve, 6500));

        // 如果不是普通民众，设置特殊分类
        if (data.category !== 'Ordinary') {
          const categoryCode = categoryCodeMap[data.category];
          const setCategoryTx = api.tx.deceased.forceSetCategory(
            index,
            categoryCode,  // 使用数字代码
            `设置为${data.category}分类`
          );

          await setCategoryTx.signAndSend(alice);
          console.log(`  🏷️  分类设置为: ${data.category} (代码: ${categoryCode})`);

          // 等待分类设置确认
          await new Promise(resolve => setTimeout(resolve, 6500));
        }

        console.log('─'.repeat(40));

      } catch (error) {
        console.error(`  ❌ 创建失败: ${error.message}`);
      }
    }

    // 验证结果
    const entries = await api.query.deceased.deceasedOf.entries();
    console.log(`\n📊 验证结果：共 ${entries.length} 个逝者记录`);

    // 按分类统计
    const categoryStats = {
      Ordinary: 0,
      HistoricalFigure: 0,
      Martyr: 0,
      Hero: 0,
      PublicFigure: 0,
      ReligiousFigure: 0,
      EventHall: 0
    };

    for (const [key, value] of entries) {
      if (value.isNone) continue;
      const id = key.args[0].toNumber();
      const categoryResult = await api.query.deceased.categoryOf(id);

      if (categoryResult.isOrdinary) categoryStats.Ordinary++;
      else if (categoryResult.isHistoricalFigure) categoryStats.HistoricalFigure++;
      else if (categoryResult.isMartyr) categoryStats.Martyr++;
      else if (categoryResult.isHero) categoryStats.Hero++;
      else if (categoryResult.isPublicFigure) categoryStats.PublicFigure++;
      else if (categoryResult.isReligiousFigure) categoryStats.ReligiousFigure++;
      else if (categoryResult.isEventHall) categoryStats.EventHall++;
    }

    console.log('\n📈 分类统计：');
    console.log(`👤 普通民众: ${categoryStats.Ordinary} 个`);
    console.log(`🏛️ 历史人物: ${categoryStats.HistoricalFigure} 个`);
    console.log(`🔴 革命烈士: ${categoryStats.Martyr} 个`);
    console.log(`🦸 英雄模范: ${categoryStats.Hero} 个`);
    console.log(`⭐ 公众人物: ${categoryStats.PublicFigure} 个`);
    console.log(`🎓 宗教/学者: ${categoryStats.ReligiousFigure} 个`);
    console.log(`📅 事件馆: ${categoryStats.EventHall} 个`);

    console.log('\n🎉 测试数据创建完成！');
    console.log('🔗 现在可以测试前端分类过滤：http://localhost:5175/#/memorial');
    console.log('💡 点击不同分类标签查看过滤效果');

  } catch (error) {
    console.error('❌ 连接失败：', error.message);
  } finally {
    process.exit(0);
  }
}

createCategoryTestData().catch(console.error);