#!/usr/bin/env node

/**
 * 函数级详细中文注释：创建测试逝者数据
 *
 * 功能：
 * - 连接到Substrate链节点
 * - 创建不同分类的测试逝者数据
 * - 验证公众纪念馆过滤功能
 */

const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');

// 测试逝者数据
const testDeceasedData = [
  {
    fullName: "张三",
    bio: "普通工人，热爱生活",
    category: "Ordinary",  // 普通民众，不应在公众纪念馆显示
    categoryCode: 0,
    birthDate: new Date('1950-01-01'),
    deathDate: new Date('2020-01-01'),
    gender: "Male"
  },
  {
    fullName: "毛泽东",
    bio: "中华人民共和国开国领袖，伟大的马克思主义者",
    category: "HistoricalFigure",  // 历史人物，应在公众纪念馆显示
    categoryCode: 1,
    birthDate: new Date('1893-12-26'),
    deathDate: new Date('1976-09-09'),
    gender: "Male"
  },
  {
    fullName: "黄继光",
    bio: "中国人民志愿军战士，在抗美援朝战争中壮烈牺牲",
    category: "Martyr",  // 革命烈士，应在公众纪念馆显示
    categoryCode: 2,
    birthDate: new Date('1931-01-08'),
    deathDate: new Date('1952-10-20'),
    gender: "Male"
  },
  {
    fullName: "袁隆平",
    bio: "中国杂交水稻育种专家，被誉为杂交水稻之父",
    category: "Hero",  // 英雄模范，应在公众纪念馆显示
    categoryCode: 3,
    birthDate: new Date('1930-09-07'),
    deathDate: new Date('2021-05-22'),
    gender: "Male"
  },
  {
    fullName: "李明",
    bio: "普通教师，为教育事业奉献一生",
    category: "Ordinary",  // 普通民众，不应在公众纪念馆显示
    categoryCode: 0,
    birthDate: new Date('1960-03-15'),
    deathDate: new Date('2022-07-10'),
    gender: "Male"
  },
  {
    fullName: "邓小平",
    bio: "中国改革开放的总设计师",
    category: "HistoricalFigure",  // 历史人物，应在公众纪念馆显示
    categoryCode: 1,
    birthDate: new Date('1904-08-22'),
    deathDate: new Date('1997-02-19'),
    gender: "Male"
  }
];

/**
 * 函数级详细中文注释：创建测试数据
 */
async function createTestData() {
  console.log('🔗 正在连接到Substrate节点...');

  const wsEndpoint = process.env.WS_ENDPOINT || 'ws://127.0.0.1:9944';
  const provider = new WsProvider(wsEndpoint);

  try {
    const api = await ApiPromise.create({ provider });
    console.log(`✅ 已连接到链：${await api.rpc.system.chain()}`);

    // 创建密钥环并添加Alice账户（开发环境默认账户）
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');
    console.log(`👤 使用账户：${alice.address}`);

    console.log('📋 开始创建测试逝者数据...');
    console.log('─'.repeat(80));

    for (const [index, data] of testDeceasedData.entries()) {
      try {
        console.log(`📝 创建逝者 ${index + 1}/${testDeceasedData.length}: ${data.fullName} (${data.category})`);

        // 🔧 在发送交易前，先查询当前的 nextDeceasedId（作为预期ID）
        const expectedIdQuery = await api.query.deceased.nextDeceasedId();
        const expectedId = expectedIdQuery.toNumber();

        // 创建逝者交易
        const createTx = api.tx.deceased.createDeceased(
          data.fullName,                               // name: Vec<u8>
          data.gender === 'Male' ? 0 : 1,             // gender_code: u8 (0=M, 1=F, 2=B)
          `ipfs-cid-name-${index}`,                   // name_full_cid: Option<Vec<u8>>
          data.birthDate.toISOString().slice(0,10).replace(/-/g, ''), // birth_ts: Vec<u8> (YYYYMMDD)
          data.deathDate.toISOString().slice(0,10).replace(/-/g, ''), // death_ts: Vec<u8> (YYYYMMDD)
          []                                          // links: Vec<Vec<u8>>
        );

        // 发送交易并等待交易成功，然后从链上查询最新逝者ID
        let deceasedId = null;
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('交易超时(30秒)')), 30000);

          createTx.signAndSend(alice, async ({ status, dispatchError, events }) => {
            // 检查交易错误
            if (dispatchError) {
              clearTimeout(timeout);
              const errorMessage = dispatchError.isModule
                ? api.registry.findMetaError(dispatchError.asModule).docs.join(' ')
                : dispatchError.toString();
              reject(new Error(errorMessage));
              return;
            }

            // 检查区块确认并解析事件
            if (status.isInBlock) {
              console.log(`  ✅ 交易已进入区块: ${status.asInBlock.toHex().substring(0, 10)}...`);
            }

            // 最终确认
            if (status.isFinalized) {
              clearTimeout(timeout);

              // 方案1: 尝试从事件中获取ID
              events.forEach(({ event }) => {
                // 优先捕获 DeceasedCreated 事件
                if (event.section === 'deceased' && event.method === 'DeceasedCreated') {
                  deceasedId = event.data[0] ? event.data[0].toNumber() : null;
                  console.log(`  🎉 逝者创建成功！ID: ${deceasedId} (从 DeceasedCreated 事件获取)`);
                }
                // 备用方案：捕获 DeceasedCreatedWithDeposit 事件
                else if (event.section === 'deceased' && event.method === 'DeceasedCreatedWithDeposit') {
                  const eventData = event.data.toJSON();
                  deceasedId = eventData.deceased_id || eventData.deceasedId;
                  console.log(`  🎉 逝者创建成功！ID: ${deceasedId} (从 DeceasedCreatedWithDeposit 事件获取)`);
                }
              });

              // 方案2: 如果事件解析失败，使用预期ID
              if (deceasedId === null) {
                deceasedId = expectedId;
                console.log(`  🎉 逝者创建成功！ID: ${deceasedId} (使用预期ID)`);
              }

              if (deceasedId === null) {
                reject(new Error('无法获取逝者ID（事件和链上查询均失败）'));
              } else {
                resolve(deceasedId);
              }
            }
          }).catch(err => {
            clearTimeout(timeout);
            reject(err);
          });
        });

        // 如果不是普通民众，设置特殊分类
        if (data.category !== 'Ordinary' && deceasedId !== null) {
          console.log(`  🏷️  正在设置分类为: ${data.category}`);

          // 强制设置分类（Root权限）
          const setCategoryTx = api.tx.deceased.forceSetCategory(
            deceasedId,
            data.categoryCode,  // 使用数字代码：0=Ordinary, 1=HistoricalFigure, 2=Martyr, 3=Hero, etc.
            `设置为${data.category}分类`
          );

          // 等待分类设置完成
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('分类设置超时(30秒)')), 30000);

            setCategoryTx.signAndSend(alice, ({ status, dispatchError }) => {
              if (dispatchError) {
                clearTimeout(timeout);
                const errorMessage = dispatchError.isModule
                  ? api.registry.findMetaError(dispatchError.asModule).docs.join(' ')
                  : dispatchError.toString();
                reject(new Error(errorMessage));
                return;
              }

              if (status.isFinalized) {
                clearTimeout(timeout);
                console.log(`  ✅ 分类已设置为: ${data.category}`);
                resolve();
              }
            }).catch(err => {
              clearTimeout(timeout);
              reject(err);
            });
          });
        }

      } catch (error) {
        console.error(`  ❌ 创建失败: ${error.message}`);
      }

      console.log('─'.repeat(80));
    }

    console.log('✅ 测试数据创建完成！');
    console.log('\n🔍 验证数据...');

    // 验证创建的数据
    const entries = await api.query.deceased.deceasedOf.entries();
    console.log(`📊 链上逝者总数: ${entries.length}`);

    let ordinaryCount = 0;
    let specialCount = 0;

    for (const [key, value] of entries) {
      if (value.isNone) continue;

      const id = key.args[0].toNumber();
      const categoryResult = await api.query.deceased.categoryOf(id);

      if (categoryResult.isOrdinary) {
        ordinaryCount++;
      } else {
        specialCount++;
      }
    }

    console.log(`👤 普通民众: ${ordinaryCount} 个（不会在公众纪念馆显示）`);
    console.log(`🌟 特殊分类: ${specialCount} 个（会在公众纪念馆显示）`);

    console.log('\n🎉 现在可以访问前端页面验证过滤效果：');
    console.log('   http://localhost:5175/#/memorial');

  } catch (error) {
    console.error('❌ 连接失败：', error.message);
    console.log('\n💡 请确保链节点正在运行：');
    console.log('   ./target/release/stardust-node --dev');
  } finally {
    process.exit(0);
  }
}

// 运行创建测试数据
createTestData().catch(console.error);