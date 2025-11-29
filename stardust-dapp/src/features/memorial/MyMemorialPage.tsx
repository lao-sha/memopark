import React, { useState, useEffect, useMemo } from 'react'
import { Card, Avatar, Tag, Empty, Spin } from 'antd'
import {
  HomeOutlined,
  TeamOutlined,
  HeartOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { useAccount } from '../../hooks/useAccount'
import { useWallet } from '../../providers/WalletProvider'
import { sessionManager } from '../../lib/sessionManager'
import { isSameAddress } from '../../utils/address'
import './MyMemorialPage.css'

/**
 * 函数级详细中文注释：逝者信息接口
 * - 从链上解析的逝者基本信息
 */
interface DeceasedItem {
  id: number
  name: string
  owner: string
  creator: string
  gender: number // 0=男, 1=女
  birthTs: string // YYYYMMDD
  deathTs: string // YYYYMMDD
  mainImageCid: string
}

/**
 * 函数级详细中文注释：我的纪念馆页面
 * - 上方：三个入口（创建的馆、亲友团的馆、关注的馆）
 * - 下方：我创建的纪念馆列表（从链上查询）
 * - 参考云上思念UI设计
 */
const MyMemorialPage: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [memorials, setMemorials] = useState<DeceasedItem[]>([])
  const account = useAccount()
  const { accounts } = useWallet()
  const currentAddr = account?.address || null
  const sessionAddr = sessionManager.getCurrentSession()?.address || null

  const monitoredAddresses = useMemo(() => {
    const list: string[] = []
    for (const acc of accounts || []) {
      if (acc?.address && !list.some(addr => isSameAddress(addr, acc.address))) {
        list.push(acc.address)
      }
    }
    if (currentAddr && !list.some(addr => isSameAddress(addr, currentAddr))) {
      list.push(currentAddr)
    }
    if (sessionAddr && !list.some(addr => isSameAddress(addr, sessionAddr))) {
      list.push(sessionAddr)
    }
    return list
  }, [accounts, currentAddr, sessionAddr])

  /**
   * 函数级中文注释：解码字节数组为字符串
   */
  const decodeBytes = (data: any): string => {
    try {
      const u8 = data?.toU8a ? data.toU8a() : (data?.toJSON ? new Uint8Array(data.toJSON()) : undefined)
      if (u8) return new TextDecoder().decode(u8)
    } catch {}
    return ''
  }

  /**
   * 函数级中文注释：格式化日期显示（YYYYMMDD -> YYYY年MM月DD日）
   */
  const formatDate = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 8) return dateStr
    const year = dateStr.slice(0, 4)
    const month = dateStr.slice(4, 6)
    const day = dateStr.slice(6, 8)
    return `${year}年${month}月${day}日`
  }

  /**
   * 函数级中文注释：计算逝世年数
   */
  const calculateYearsSinceDeath = (deathTs: string): string => {
    if (!deathTs || deathTs.length !== 8) return ''
    const deathYear = parseInt(deathTs.slice(0, 4), 10)
    const currentYear = new Date().getFullYear()
    const years = currentYear - deathYear
    if (years <= 0) return '今年'
    return `逝世${years}周年`
  }

  /**
   * 函数级中文注释：加载我创建的纪念馆列表（从链上查询）
   */
  useEffect(() => {
    const loadMemorials = async () => {
      try {
        if (!monitoredAddresses.length) {
          console.log('未登录，无法查询我的纪念馆')
          setMemorials([])
          setLoading(false)
          return
        }

        setLoading(true)

        const api = await getApi()
        const queryRoot: any = api.query as any
        const dq: any = queryRoot.deceased || queryRoot.memoDeceased || queryRoot.memo_deceased

        if (!dq?.deceasedOf) {
          console.error('运行时未启用 deceased 模块')
          setMemorials([])
          return
        }

        // 🔧 修复：使用 entries() 查询所有逝者（支持随机ID）
        // 原代码依赖 nextDeceasedId 顺序遍历，但链上已改为随机ID生成
        console.log('使用 entries() 查询所有逝者...')
        const entries = await dq.deceasedOf.entries()
        console.log('总逝者数量:', entries.length)

        // 遍历所有 deceased，筛选当前用户创建的
        const myMemorials: DeceasedItem[] = []

        for (const [key, opt] of entries) {
          try {
            if (!opt || !opt.isSome) continue

            const id = key.args[0].toNumber?.() ?? parseInt(key.args[0].toString(), 10)
            const d = opt.unwrap()
            const owner = d.owner?.toString?.() || String(d.owner)
            const creator = d.creator?.toString?.() || String(d.creator)

            console.log(`逝者 #${id}: owner=${owner}, creator=${creator}, currentAddr=${currentAddr}`)

            const isMine = monitoredAddresses.some(addr =>
              isSameAddress(owner, addr) || isSameAddress(creator, addr)
            )

            if (isMine) {
              const name = decodeBytes(d.name)

              // 处理 Option 类型的字段（birthTs/deathTs/mainImageCid）
              let birthTs = ''
              let deathTs = ''
              let mainImageCid = ''

              // birth_ts -> birthTs (驼峰命名)
              if (d.birthTs?.isSome) {
                birthTs = decodeBytes(d.birthTs.unwrap())
              } else if (d.birth_ts?.isSome) {
                birthTs = decodeBytes(d.birth_ts.unwrap())
              }

              // death_ts -> deathTs
              if (d.deathTs?.isSome) {
                deathTs = decodeBytes(d.deathTs.unwrap())
              } else if (d.death_ts?.isSome) {
                deathTs = decodeBytes(d.death_ts.unwrap())
              }

              // main_image_cid -> mainImageCid
              if (d.mainImageCid?.isSome) {
                mainImageCid = decodeBytes(d.mainImageCid.unwrap())
              } else if (d.main_image_cid?.isSome) {
                mainImageCid = decodeBytes(d.main_image_cid.unwrap())
              }

              const gender = d.gender?.isMale ? 0 : (d.gender?.isFemale ? 1 : 0)

              console.log(`匹配到逝者 #${id}: name=${name}, birthTs=${birthTs}, deathTs=${deathTs}`)

              myMemorials.push({
                id,
                name: name || `逝者 #${id}`,
                owner,
                creator,
                gender,
                birthTs,
                deathTs,
                mainImageCid
              })
            }
          } catch (e) {
            console.error(`查询 deceased 失败:`, e)
          }
        }

        // 按 ID 倒序排序（最新创建的在前）
        myMemorials.sort((a, b) => b.id - a.id)
        console.log('我创建的纪念馆:', myMemorials)
        setMemorials(myMemorials)
      } catch (error) {
        console.error('加载纪念馆失败:', error)
        setMemorials([])
      } finally {
        setLoading(false)
      }
    }

    loadMemorials()
  }, [monitoredAddresses])

  const handleNavigate = (type: string) => {
    switch (type) {
      case 'created':
        // 跳转到我创建的纪念馆列表
        window.location.hash = '#/memorial/my-created'
        break
      case 'family':
        // 跳转到亲友团的馆
        window.location.hash = '#/memorial/family'
        break
      case 'followed':
        // 跳转到关注的馆
        window.location.hash = '#/memorial/followed'
        break
      default:
        break
    }
  }

  const handleMemorialClick = (id: number) => {
    // 跳转到纪念馆详情页
    window.location.hash = `#/memorial/${id}`
  }

  return (
    <div className="my-memorial-page">
      {/* 顶部导航栏 */}
      <div className="memorial-header">
        <button
          className="back-btn"
          onClick={() => window.history.back()}
        >
          <ArrowLeftOutlined />
        </button>
        <div className="header-title">我的纪念馆</div>
        <div style={{ width: 40 }} />
      </div>

      {/* 主要内容区域 */}
      <div className="memorial-content">
        {/* 三个入口卡片 - 移到上方 */}
        <div className="action-section">
          <div className="memorial-grid">
            {/* 创建的馆 */}
            <Card
              className="memorial-card"
              hoverable
              onClick={() => handleNavigate('created')}
            >
              <div className="card-icon created">
                <HomeOutlined />
              </div>
              <div className="card-title">创建的馆</div>
            </Card>

            {/* 亲友团的馆 */}
            <Card
              className="memorial-card"
              hoverable
              onClick={() => handleNavigate('family')}
            >
              <div className="card-icon family">
                <TeamOutlined />
              </div>
              <div className="card-title">亲友团的馆</div>
            </Card>

            {/* 关注的馆 */}
            <Card
              className="memorial-card"
              hoverable
              onClick={() => handleNavigate('followed')}
            >
              <div className="card-icon followed">
                <HeartOutlined />
              </div>
              <div className="card-title">关注的馆</div>
            </Card>
          </div>
        </div>

        {/* 纪念馆列表 - 移到下方 */}
        <div className="memorial-list-section">
          <div className="section-title">我创建的纪念馆</div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: '#999' }}>加载中...</div>
            </div>
          ) : memorials.length === 0 ? (
            <Empty
              description="暂无纪念馆"
              style={{ padding: 60 }}
            />
          ) : (
            <div className="memorial-list">
              {memorials.map((memorial) => {
                // 构建 IPFS 头像 URL
                const avatarUrl = memorial.mainImageCid
                  ? `https://ipfs.io/ipfs/${memorial.mainImageCid}`
                  : ''

                return (
                  <Card
                    key={memorial.id}
                    className="memorial-item-card"
                    hoverable
                    onClick={() => handleMemorialClick(memorial.id)}
                  >
                    <div className="card-content">
                      {/* 左侧头像 */}
                      <Avatar
                        size={64}
                        src={avatarUrl}
                        icon={!avatarUrl && <HomeOutlined />}
                        className="memorial-avatar"
                        style={{
                          backgroundColor: avatarUrl ? 'transparent' : '#d9d9d9'
                        }}
                      />

                      {/* 中间信息 */}
                      <div className="memorial-info">
                        <div className="memorial-name">{memorial.name}</div>
                        <div className="memorial-date-row">
                          <span className="date-badge">
                            <span className="badge-icon">{memorial.gender === 0 ? '👨' : '👩'}</span>
                            <span>{formatDate(memorial.birthTs)}</span>
                          </span>
                        </div>
                        <div className="memorial-date-text">{calculateYearsSinceDeath(memorial.deathTs)}</div>
                      </div>

                      {/* 右侧标签 */}
                      <div className="memorial-tag">
                        <Tag
                          color="blue"
                          className="status-tag"
                        >
                          #{memorial.id}
                        </Tag>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MyMemorialPage
