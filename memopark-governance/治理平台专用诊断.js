// 治理平台专用诊断脚本
// 在治理平台页面的浏览器控制台运行

(async () => {
  console.group('🔍 治理平台诊断')
  
  try {
    // 方法1：尝试从 window 获取
    let api = window.__POLKADOT_API__ || window.api
    
    // 方法2：尝试从 React DevTools 获取
    if (!api) {
      console.log('尝试从页面获取 API...')
      // 等待 API 初始化
      await new Promise(resolve => setTimeout(resolve, 2000))
      api = window.__POLKADOT_API__ || window.api
    }
    
    // 方法3：提示用户手动获取
    if (!api) {
      console.error('❌ 无法自动获取 API')
      console.log('\n请手动执行以下步骤：')
      console.log('1. 打开 React DevTools（如果已安装）')
      console.log('2. 选择 ApiProvider 组件')
      console.log('3. 在 Props 中找到 api 实例')
      console.log('\n或者直接执行：')
      console.log('api = await (async () => {')
      console.log('  const { ApiPromise, WsProvider } = window.polkadotApi')
      console.log('  const provider = new WsProvider("ws://127.0.0.1:9944")')
      console.log('  return await ApiPromise.create({ provider })')
      console.log('})()')
      return
    }
    
    console.log('✅ API 已连接')
    
    // 检查 mmId
    const mmId = 1
    console.log(`\n检查 mmId=${mmId}:`)
    
    const appOption = await api.query.marketMaker.applications(mmId)
    
    if (appOption.isNone) {
      console.error(`❌ mmId=${mmId} 不存在！`)
      console.log('\n💡 解决方法：')
      console.log('1. 到用户端创建申请：')
      console.log('   http://localhost:5173/#/otc/market-maker-create')
      console.log('2. 完成两步：')
      console.log('   - 第一步：质押保证金（生成 mmId）')
      console.log('   - 第二步：提交资料（进入 PendingReview 状态）')
      console.log('3. 记录生成的 mmId（可能是 0）')
      console.log('4. 回到治理平台创建提案，使用正确的 mmId')
      
      // 查询所有申请
      console.log('\n查询所有申请：')
      const entries = await api.query.marketMaker.applications.entries()
      if (entries.length === 0) {
        console.log('  📭 当前没有任何申请')
      } else {
        console.log(`  找到 ${entries.length} 个申请：`)
        entries.forEach(([key, value]) => {
          const id = key.args[0].toNumber()
          const app = value.unwrap().toJSON()
          console.log(`  - mmId=${id}, status=${app.status}, owner=${app.owner.slice(0, 10)}...`)
        })
      }
      
      return
    }
    
    // 申请存在，检查详情
    const app = appOption.unwrap()
    const appData = app.toJSON()
    
    console.log('✅ mmId=' + mmId + ' 存在')
    console.log('申请详情：')
    console.log('  owner:', appData.owner)
    console.log('  status:', appData.status)
    console.log('  deposit:', appData.deposit)
    console.log('  first_purchase_pool:', appData.firstPurchasePool)
    
    // 检查状态
    if (appData.status !== 'PendingReview') {
      console.error('\n❌ 状态不对！')
      console.log('当前状态:', appData.status)
      console.log('需要状态: PendingReview')
      
      if (appData.status === 'DepositLocked') {
        console.log('\n💡 解决方法：')
        console.log('当前状态是 DepositLocked，需要提交资料')
        console.log('1. 回到用户端：http://localhost:5173/#/otc/market-maker-create')
        console.log('2. 继续第二步：提交资料')
        console.log('3. 等待状态变为 PendingReview')
        console.log('4. 回到治理平台创建提案')
      } else if (appData.status === 'Active') {
        console.log('\n💡 该申请已被批准，状态是 Active')
        console.log('无需再创建提案')
      } else if (appData.status === 'Rejected') {
        console.log('\n💡 该申请已被驳回')
        console.log('申请人需要重新申请')
      }
      
      return
    }
    
    console.log('✅ 状态正确（PendingReview）')
    
    // 检查截止时间
    const nowMs = await api.query.timestamp.now()
    const now = Number(nowMs.toString()) / 1000
    const reviewDeadline = appData.reviewDeadline
    
    console.log('\n⏰ 时间检查：')
    console.log('  当前时间:', new Date(now * 1000).toLocaleString())
    console.log('  审核截止:', new Date(reviewDeadline * 1000).toLocaleString())
    
    if (now > reviewDeadline) {
      console.error('❌ 已超过审核截止时间！')
      console.log('\n💡 解决方法：')
      console.log('该申请已过期，需要调用 expire 清理')
      console.log('申请人需要重新申请')
      return
    }
    
    console.log('✅ 未超过截止时间')
    
    // 检查委员会成员（需要从页面获取当前账户）
    console.log('\n👥 委员会成员检查：')
    const members = await api.query.council.members()
    const memberList = members.toJSON()
    console.log('委员会成员列表:', memberList.map(m => m.slice(0, 10) + '...'))
    
    // 提示用户检查自己的账户
    console.log('\n⚠️  请确认您的钱包账户是委员会成员之一')
    
    // 测试构建 innerCall
    console.log('\n🧪 测试构建交易：')
    try {
      const innerCall = api.tx.marketMaker.approve(mmId)
      console.log('✅ approve innerCall 构建成功')
      console.log('  method:', innerCall.method.toHuman())
      console.log('  encodedLength:', innerCall.encodedLength)
      
      // 测试 propose
      const threshold = 2
      const proposeTx = api.tx.council.propose(threshold, innerCall, innerCall.encodedLength)
      console.log('✅ council.propose 交易构建成功')
      console.log('  threshold:', threshold)
      
    } catch (e) {
      console.error('❌ 交易构建失败:', e)
      return
    }
    
    // 所有检查通过
    console.log('\n✅ 所有检查通过！')
    console.log('\n📋 如果提交提案仍然失败：')
    console.log('1. 确认您的钱包是委员会成员')
    console.log('2. 查看链端日志是否有错误')
    console.log('3. 尝试重新编译链端：')
    console.log('   cd /home/xiaodong/文档/memopark')
    console.log('   cargo build --release')
    console.log('   ./链端完全重置并启动.sh')
    
  } catch (error) {
    console.error('❌ 诊断失败:', error)
    console.log('\n可能的原因：')
    console.log('1. API 未连接到链端')
    console.log('2. 链端未启动')
    console.log('3. WebSocket 连接失败')
    console.log('\n请检查：')
    console.log('- 链端是否在运行？')
    console.log('- WebSocket 端口是否正确（默认 ws://127.0.0.1:9944）？')
  } finally {
    console.groupEnd()
  }
})()

// 如果上面的脚本无法获取 API，请尝试以下方法手动创建 API 连接：
console.log('\n💡 如果无法自动获取 API，请运行以下代码：')
console.log(`
// 手动创建 API 连接
const { ApiPromise, WsProvider } = window.polkadotApi || await import('https://unpkg.com/@polkadot/api@latest/bundle.js')
const provider = new WsProvider('ws://127.0.0.1:9944')
window.__POLKADOT_API__ = await ApiPromise.create({ provider })
console.log('✅ API 已创建，现在可以重新运行诊断脚本')
`)

