/**
 * 做市商 NotFound 错误快速修复脚本
 * 
 * 使用方法：
 * 1. 打开浏览器控制台（F12）
 * 2. 复制整个脚本并粘贴到控制台
 * 3. 按回车执行
 * 4. 按照提示操作
 */

(async function fixMarketMakerNotFound() {
  console.log('='.repeat(60))
  console.log('🔧 做市商 NotFound 错误诊断和修复工具')
  console.log('='.repeat(60))
  
  try {
    // 1. 检查当前账户
    const current = localStorage.getItem('mp.current')
    if (!current) {
      console.error('❌ 未找到当前账户，请先登录')
      return
    }
    console.log('✅ 当前账户:', current)
    
    // 2. 检查缓存的 mmId
    const cachedMmId = localStorage.getItem('mm_apply_id')
    console.log('📦 缓存的 mmId:', cachedMmId || '(无)')
    
    // 3. 连接 API
    console.log('\n正在连接区块链...')
    const { ApiPromise, WsProvider } = window.polkadotApi || {}
    if (!ApiPromise || !WsProvider) {
      console.error('❌ Polkadot API 未加载，请确保在正确的页面')
      return
    }
    
    const wsEndpoint = localStorage.getItem('mp.ws_endpoint') || 'ws://127.0.0.1:9944'
    const provider = new WsProvider(wsEndpoint)
    const api = await ApiPromise.create({ provider })
    console.log('✅ 区块链连接成功')
    
    // 4. 查询真实 mmId
    console.log('\n正在查询真实 mmId...')
    const ownerIndexOpt = await api.query.marketMaker.ownerIndex(current)
    
    if (ownerIndexOpt.isSome) {
      const realMmId = ownerIndexOpt.unwrap().toNumber()
      console.log('✅ 找到真实 mmId:', realMmId)
      
      // 5. 验证链上记录
      const appOpt = await api.query.marketMaker.applications(realMmId)
      if (appOpt.isSome) {
        const app = appOpt.unwrap().toJSON()
        console.log('✅ 链上记录存在')
        console.log('  状态:', app.status)
        console.log('  创建时间:', new Date(app.createdAt * 1000).toLocaleString())
        console.log('  资料截止:', new Date(app.infoDeadline * 1000).toLocaleString())
        console.log('  审核截止:', new Date(app.reviewDeadline * 1000).toLocaleString())
        
        // 6. 检查是否过期
        const now = Math.floor(Date.now() / 1000)
        const infoExpired = now > app.infoDeadline
        const reviewExpired = now > app.reviewDeadline
        
        if (infoExpired && app.status === 'DepositLocked') {
          console.warn('⚠️ 资料提交已过期，需要取消并重新申请')
        } else if (reviewExpired && app.status === 'PendingReview') {
          console.warn('⚠️ 审核已过期，需要取消并重新申请')
        } else {
          console.log('✅ 申请未过期，可以继续')
        }
        
        // 7. 对比缓存和真实 mmId
        if (cachedMmId && cachedMmId !== String(realMmId)) {
          console.warn('\n⚠️ 检测到缓存 mmId 与真实 mmId 不一致')
          console.warn('  缓存:', cachedMmId)
          console.warn('  真实:', realMmId)
          console.warn('  → 将使用真实 mmId 修复缓存')
        }
        
        // 8. 修复缓存
        console.log('\n正在修复缓存...')
        localStorage.setItem('mm_apply_id', String(realMmId))
        localStorage.setItem('mm_apply_deadline', String(app.infoDeadline))
        
        if (app.status === 'DepositLocked') {
          localStorage.setItem('mm_apply_step', '1')
          console.log('✅ 缓存已修复，当前步骤：第 2 步（提交资料）')
        } else if (app.status === 'PendingReview') {
          localStorage.setItem('mm_apply_step', '2')
          console.log('✅ 缓存已修复，当前步骤：第 3 步（等待审核）')
        } else {
          console.log('✅ 缓存已修复，状态:', app.status)
        }
        
        // 9. 提示下一步
        console.log('\n' + '='.repeat(60))
        console.log('🎉 修复完成！请按以下步骤操作：')
        console.log('='.repeat(60))
        console.log('1. 刷新页面: location.reload()')
        console.log('2. 继续填写并提交资料')
        console.log('3. 如仍有问题，请联系技术支持')
        console.log('='.repeat(60))
        
      } else {
        console.error('❌ 链上记录不存在，申请可能已被删除')
        console.log('\n建议操作：')
        console.log('1. 清除缓存并重新申请')
        console.log('   localStorage.removeItem("mm_apply_id")')
        console.log('   localStorage.removeItem("mm_apply_deadline")')
        console.log('   localStorage.removeItem("mm_apply_step")')
        console.log('   location.reload()')
      }
      
    } else {
      console.error('❌ 未找到该账户的做市商申请记录')
      console.log('\n可能的原因：')
      console.log('1. 尚未质押押金')
      console.log('2. 申请已被取消或过期')
      console.log('3. 使用了错误的账户')
      
      if (cachedMmId) {
        console.log('\n检测到缓存中有无效的 mmId，建议清除：')
        console.log('localStorage.removeItem("mm_apply_id")')
        console.log('localStorage.removeItem("mm_apply_deadline")')
        console.log('localStorage.removeItem("mm_apply_step")')
        console.log('location.reload()')
      }
    }
    
    // 断开连接
    await api.disconnect()
    
  } catch (error) {
    console.error('❌ 执行失败:', error)
    console.log('\n请检查：')
    console.log('1. 是否在正确的页面（应该在 memopark-dapp）')
    console.log('2. 节点是否正常运行')
    console.log('3. 浏览器控制台是否有其他错误')
  }
})()

