// 诊断链端状态脚本
// 在浏览器控制台运行此脚本

(async () => {
  console.group('🔍 链端状态诊断')
  
  try {
    // 1. 检查 API 连接
    if (typeof window.api === 'undefined') {
      console.error('❌ API 未初始化，请刷新页面')
      return
    }
    
    const api = window.api
    console.log('✅ API 已连接')
    
    // 2. 检查当前账户
    const currentAccount = window.activeAccount
    if (!currentAccount) {
      console.error('❌ 未连接钱包')
      return
    }
    console.log('✅ 当前账户:', currentAccount)
    
    // 3. 检查是否是委员会成员
    const members = await api.query.council.members()
    const memberList = members.toJSON()
    console.log('委员会成员:', memberList)
    const isMember = memberList.includes(currentAccount)
    console.log(isMember ? '✅ 是委员会成员' : '❌ 不是委员会成员')
    
    // 4. 检查 mmId=1 的申请状态
    const mmId = 1
    console.log(`\n检查 mmId=${mmId} 的申请状态:`)
    
    const appOption = await api.query.marketMaker.applications(mmId)
    if (appOption.isNone) {
      console.error(`❌ mmId=${mmId} 的申请不存在！`)
      
      // 尝试查询所有申请
      console.log('\n查询所有待审批的申请:')
      const entries = await api.query.marketMaker.applications.entries()
      console.log(`找到 ${entries.length} 个申请:`)
      entries.forEach(([key, value]) => {
        const id = key.args[0].toNumber()
        const app = value.toJSON()
        console.log(`  mmId=${id}, status=${app.status}, owner=${app.owner}`)
      })
    } else {
      const app = appOption.unwrap().toJSON()
      console.log('✅ 申请存在')
      console.log('状态:', app.status)
      console.log('申请人:', app.owner)
      console.log('保证金:', app.deposit)
      console.log('首购资金池:', app.first_purchase_pool)
      
      // 检查状态是否为 PendingReview
      if (app.status !== 'PendingReview') {
        console.error(`❌ 状态不对！当前状态: ${app.status}，需要: PendingReview`)
        console.log('\n可能的原因:')
        console.log('  1. 申请还未提交资料（状态: DepositLocked）')
        console.log('  2. 申请已经被审批或驳回（状态: Active/Rejected）')
        console.log('  3. 申请已过期')
      } else {
        console.log('✅ 状态正确（PendingReview）')
      }
      
      // 检查审核截止时间
      const nowMs = await api.query.timestamp.now()
      const now = Number(nowMs.toString()) / 1000
      const deadline = app.reviewDeadline
      console.log('当前时间:', now)
      console.log('审核截止时间:', deadline)
      if (now > deadline) {
        console.error('❌ 已超过审核截止时间！')
      } else {
        console.log('✅ 未超过审核截止时间')
      }
    }
    
    // 5. 测试构建 innerCall
    console.log('\n测试构建 innerCall:')
    try {
      const innerCall = api.tx.marketMaker.approve(mmId)
      console.log('✅ approve innerCall 构建成功')
      console.log('  encodedLength:', innerCall.encodedLength)
      console.log('  length:', innerCall.length)
      console.log('  method:', innerCall.method.toHuman())
    } catch (e) {
      console.error('❌ innerCall 构建失败:', e)
    }
    
    try {
      const innerCall = api.tx.marketMaker.reject(mmId, 200)
      console.log('✅ reject innerCall 构建成功')
      console.log('  encodedLength:', innerCall.encodedLength)
      console.log('  length:', innerCall.length)
      console.log('  method:', innerCall.method.toHuman())
    } catch (e) {
      console.error('❌ innerCall 构建失败:', e)
    }
    
    // 6. 测试构建 propose 交易
    console.log('\n测试构建 propose 交易:')
    try {
      const innerCall = api.tx.marketMaker.approve(mmId)
      const threshold = 2
      const lengthBound = innerCall.encodedLength
      const proposeTx = api.tx.council.propose(threshold, innerCall, lengthBound)
      console.log('✅ propose 交易构建成功')
      console.log('  method:', proposeTx.method.toHuman())
    } catch (e) {
      console.error('❌ propose 交易构建失败:', e)
    }
    
    // 7. 检查 Runtime 版本
    console.log('\nRuntime 信息:')
    const version = api.runtimeVersion
    console.log('  spec_name:', version.specName.toString())
    console.log('  spec_version:', version.specVersion.toNumber())
    console.log('  impl_version:', version.implVersion.toNumber())
    
  } catch (error) {
    console.error('诊断失败:', error)
  } finally {
    console.groupEnd()
  }
})()

