#!/usr/bin/env node
/**
 * 委员会快速配置脚本
 * 
 * 功能：
 * 1. 自动配置委员会成员（Alice, Bob, Charlie）
 * 2. 验证配置结果
 * 3. 显示下一步操作指南
 * 
 * 使用方式：
 * node scripts/setup-council.mjs
 * 
 * 前提条件：
 * - 链节点已启动（ws://127.0.0.1:9944）
 * - 使用开发模式（有 Alice 的 sudo 权限）
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api'
import { cryptoWaitReady } from '@polkadot/util-crypto'

async function main() {
  console.log('=== 委员会配置脚本 ===\n')
  
  // 1. 连接到链
  console.log('1. 连接到链节点...')
  const wsProvider = new WsProvider('ws://127.0.0.1:9944')
  const api = await ApiPromise.create({ provider: wsProvider })
  console.log('✓ 已连接到链\n')
  
  // 2. 准备账户
  console.log('2. 准备测试账户...')
  await cryptoWaitReady()
  const keyring = new Keyring({ type: 'sr25519' })
  
  // 开发模式测试账户
  const alice = keyring.addFromUri('//Alice')
  const bob = keyring.addFromUri('//Bob')
  const charlie = keyring.addFromUri('//Charlie')
  
  const members = [
    alice.address,
    bob.address,
    charlie.address
  ]
  
  console.log('委员会成员:')
  console.log('  Alice  :', alice.address)
  console.log('  Bob    :', bob.address)
  console.log('  Charlie:', charlie.address)
  console.log()
  
  // 3. 查询当前委员会状态
  console.log('3. 查询当前委员会状态...')
  const currentMembers = await api.query.council.members()
  console.log('当前成员数:', currentMembers.length)
  console.log()
  
  // 4. 设置委员会成员
  console.log('4. 设置委员会成员（需要 Sudo 权限）...')
  
  const setMembersTx = api.tx.council.setMembers(
    members,
    members[0],  // prime (Alice 作为首要成员)
    currentMembers.length  // oldCount
  )
  
  const sudoTx = api.tx.sudo.sudo(setMembersTx)
  
  try {
    await new Promise((resolve, reject) => {
      sudoTx.signAndSend(alice, ({ status, dispatchError, events }) => {
        console.log('交易状态:', status.type)
        
        if (status.isInBlock) {
          console.log('✓ 交易已打包进区块:', status.asInBlock.toHex())
        }
        
        if (status.isFinalized) {
          console.log('✓ 交易已最终确认:', status.asFinalized.toHex())
          
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule)
              const { docs, name, section } = decoded
              reject(new Error(`${section}.${name}: ${docs.join(' ')}`))
            } else {
              reject(new Error(dispatchError.toString()))
            }
          } else {
            // 显示事件
            events.forEach(({ event }) => {
              const { section, method, data } = event
              console.log(`  事件: ${section}.${method}`, data.toString())
            })
            resolve()
          }
        }
      }).catch(reject)
    })
  } catch (error) {
    console.error('\n❌ 设置失败:', error.message)
    process.exit(1)
  }
  
  console.log()
  
  // 5. 验证配置
  console.log('5. 验证配置结果...')
  const newMembers = await api.query.council.members()
  const prime = await api.query.council.prime()
  
  console.log('委员会成员数:', newMembers.length)
  console.log('首要成员 (Prime):', prime.toString())
  console.log()
  
  console.log('成员列表:')
  newMembers.forEach((member, index) => {
    const addr = member.toString()
    let name = 'Unknown'
    if (addr === alice.address) name = 'Alice'
    if (addr === bob.address) name = 'Bob'
    if (addr === charlie.address) name = 'Charlie'
    console.log(`  ${index + 1}. ${name}: ${addr}`)
  })
  console.log()
  
  // 6. 显示下一步指南
  console.log('=== 配置完成 ✓ ===\n')
  console.log('下一步操作：')
  console.log('1. 创建测试申请：')
  console.log('   访问 #/otc/mm-apply 页面创建做市商申请\n')
  console.log('2. 测试委员会提案流程：')
  console.log('   查看文档: docs/council-proposal-test.md\n')
  console.log('3. 使用 Polkadot.js Apps 提交提案：')
  console.log('   - 访问 https://polkadot.js.org/apps')
  console.log('   - Developer → Extrinsics')
  console.log('   - council.propose(...)\n')
  console.log('委员会成员手册: docs/council-member-guide.md')
  
  await api.disconnect()
}

main().catch(console.error)
