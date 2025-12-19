/**
 * 紫微斗数排盘测试脚本
 *
 * 功能：创建测试命盘用于前端展示和调试
 * 使用：node test-ziwei-create.js
 */

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');

// 配置
const WS_ENDPOINT = 'ws://localhost:9944';

// 枚举定义（需要与链端保持一致）
const DiZhi = {
  Zi: 0,   // 子时 (23-01)
  Chou: 1, // 丑时 (01-03)
  Yin: 2,  // 寅时 (03-05)
  Mao: 3,  // 卯时 (05-07)
  Chen: 4, // 辰时 (07-09)
  Si: 5,   // 巳时 (09-11)
  Wu: 6,   // 午时 (11-13)
  Wei: 7,  // 未时 (13-15)
  Shen: 8, // 申时 (15-17)
  You: 9,  // 酉时 (17-19)
  Xu: 10,  // 戌时 (19-21)
  Hai: 11, // 亥时 (21-23)
};

const Gender = {
  Male: 0,
  Female: 1,
};

// 测试数据
const TEST_CHARTS = [
  {
    name: '男命-子时',
    lunarYear: 1990,
    lunarMonth: 5,
    lunarDay: 15,
    birthHour: DiZhi.Zi,
    gender: Gender.Male,
    isLeapMonth: false,
  },
  {
    name: '女命-午时',
    lunarYear: 1995,
    lunarMonth: 8,
    lunarDay: 20,
    birthHour: DiZhi.Wu,
    gender: Gender.Female,
    isLeapMonth: false,
  },
  {
    name: '男命-卯时',
    lunarYear: 1988,
    lunarMonth: 3,
    lunarDay: 10,
    birthHour: DiZhi.Mao,
    gender: Gender.Male,
    isLeapMonth: false,
  },
];

async function main() {
  console.log('🔗 连接到区块链节点:', WS_ENDPOINT);

  try {
    // 连接到本地节点
    const wsProvider = new WsProvider(WS_ENDPOINT);
    const api = await ApiPromise.create({ provider: wsProvider });

    console.log('✅ 节点连接成功');
    console.log('📋 链名称:', (await api.rpc.system.chain()).toString());

    // 检查 ziwei pallet 是否存在
    if (!api.tx.ziwei || !api.tx.ziwei.divineByTime) {
      console.error('❌ 错误: ziwei pallet 不存在');
      console.log('提示: 请确保节点包含 pallet-ziwei 模块');
      process.exit(1);
    }

    console.log('✅ ziwei pallet 已找到');

    // 使用 Alice 账户（开发环境）
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');

    console.log('👤 使用账户: Alice');
    console.log('📍 地址:', alice.address);

    // 查询账户余额
    const { data: balance } = await api.query.system.account(alice.address);
    console.log('💰 余额:', balance.free.toHuman());

    console.log('\n📝 开始创建测试命盘...\n');

    // 创建命盘
    for (let i = 0; i < TEST_CHARTS.length; i++) {
      const chart = TEST_CHARTS[i];
      console.log(`[${i + 1}/${TEST_CHARTS.length}] 创建命盘: ${chart.name}`);
      console.log(`  - 出生: ${chart.lunarYear}年${chart.lunarMonth}月${chart.lunarDay}日`);
      console.log(`  - 时辰: ${Object.keys(DiZhi)[chart.birthHour]}`);
      console.log(`  - 性别: ${chart.gender === Gender.Male ? '男' : '女'}`);

      try {
        const tx = api.tx.ziwei.divineByTime(
          chart.lunarYear,
          chart.lunarMonth,
          chart.lunarDay,
          chart.birthHour,
          chart.gender,
          chart.isLeapMonth
        );

        // 发送交易并等待结果
        const chartId = await new Promise((resolve, reject) => {
          tx.signAndSend(alice, ({ status, events, dispatchError }) => {
            if (dispatchError) {
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                const { docs, name, section } = decoded;
                reject(new Error(`${section}.${name}: ${docs.join(' ')}`));
              } else {
                reject(new Error(dispatchError.toString()));
              }
              return;
            }

            if (status.isInBlock || status.isFinalized) {
              // 查找 ChartCreated 事件
              const event = events.find((e) =>
                e.event.section === 'ziwei' && e.event.method === 'ChartCreated'
              );

              if (event) {
                const id = event.event.data[0].toNumber();
                resolve(id);
              } else if (status.isFinalized) {
                reject(new Error('交易成功但未找到命盘创建事件'));
              }
            }
          }).catch(reject);
        });

        console.log(`✅ 命盘创建成功! ID: ${chartId}`);
        console.log(`   查看链接: http://localhost:5173/#/ziwei/interpretation/${chartId}\n`);

      } catch (error) {
        console.error(`❌ 创建失败:`, error.message);
      }
    }

    console.log('✅ 所有测试命盘创建完成!');
    console.log('\n📋 访问以下链接查看命盘列表:');
    console.log('   http://localhost:5173/#/ziwei/list');

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    process.exit(0);
  }
}

// 运行脚本
main().catch(console.error);
