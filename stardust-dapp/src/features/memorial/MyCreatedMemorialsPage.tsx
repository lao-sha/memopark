import React, { useState, useEffect, useMemo } from 'react'
import { Card, Avatar, Tag, Empty, Spin, Button } from 'antd'
import {
  HomeOutlined,
  ArrowLeftOutlined,
  HeartFilled,
  FireFilled,
  PlusOutlined
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot'
import { useAccount } from '../../hooks/useAccount'
import { useWallet } from '../../providers/WalletProvider'
import { sessionManager } from '../../lib/sessionManager'
import { isSameAddress } from '../../utils/address'
import './MyMemorialPage.css'

/**
 * 函数级详细中文注释：我创建的纪念馆列表页面
 * - 显示当前用户创建的所有纪念馆
 * - 支持从链上查询用户创建的逝者记录
 * - 点击可跳转到纪念馆详情页
 */
const MyCreatedMemorialsPage: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [memorials, setMemorials] = useState<any[]>([])
  const account = useAccount()
  const { accounts } = useWallet()
  const address = account?.address || null
  const sessionAddr = sessionManager.getCurrentSession()?.address || null

  const monitoredAddresses = useMemo(() => {
    const list: string[] = []
    for (const acc of accounts || []) {
      if (acc?.address && !list.some(addr => isSameAddress(addr, acc.address))) {
        list.push(acc.address)
      }
    }
    if (address && !list.some(addr => isSameAddress(addr, address))) {
      list.push(address)
    }
    if (sessionAddr && !list.some(addr => isSameAddress(addr, sessionAddr))) {
      list.push(sessionAddr)
    }
    return list
  }, [accounts, address, sessionAddr])

  const hasAnyAddress = monitoredAddresses.length > 0

  /**
   * 函数级中文注释：从链上加载用户创建的纪念馆列表
   */
  const decodeBytes = (data: any): string => {
    try {
      const u8 = data?.toU8a ? data.toU8a() : (data?.toJSON ? new Uint8Array(data.toJSON()) : undefined)
      if (u8) return new TextDecoder().decode(u8)
    } catch {}
    return ''
  }

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '未知'
    if (dateStr.length === 8) {
      return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    }
    return dateStr
  }

  useEffect(() => {
    const loadMemorials = async () => {
      try {
        if (!hasAnyAddress) {
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

        const entries = await dq.deceasedOf.entries()
        const deceasedList: any[] = []

        for (const [key, opt] of entries) {
          try {
            if (!opt || !opt.isSome) continue

            const id = key.args[0].toNumber?.() ?? parseInt(key.args[0].toString(), 10)
            const d = opt.unwrap()
            const creator = d.creator?.toString?.() || String(d.creator)

            const isMine = monitoredAddresses.some(addr => isSameAddress(creator, addr))
            if (!isMine) continue

            const name = decodeBytes(d.name) || `逝者 #${id}`
            const gender = d.gender?.isMale ? 'male' : (d.gender?.isFemale ? 'female' : 'unknown')

            let birthTs = ''
            let deathTs = ''
            let mainImageCid = ''

            if (d.birthTs?.isSome) {
              birthTs = decodeBytes(d.birthTs.unwrap())
            } else if (d.birth_ts?.isSome) {
              birthTs = decodeBytes(d.birth_ts.unwrap())
            }

            if (d.deathTs?.isSome) {
              deathTs = decodeBytes(d.deathTs.unwrap())
            } else if (d.death_ts?.isSome) {
              deathTs = decodeBytes(d.death_ts.unwrap())
            }

            if (d.mainImageCid?.isSome) {
              mainImageCid = decodeBytes(d.mainImageCid.unwrap())
            } else if (d.main_image_cid?.isSome) {
              mainImageCid = decodeBytes(d.main_image_cid.unwrap())
            }

            deceasedList.push({
              id,
              name,
              avatar: mainImageCid ? `https://ipfs.io/ipfs/${mainImageCid}` : '',
              gender,
              birthDate: formatDate(birthTs),
              deathDate: formatDate(deathTs),
              likes: 0,
              candles: 0,
              status: 'memorial'
            })
          } catch (error) {
            console.error('解析逝者数据失败:', error)
          }
        }

        deceasedList.sort((a, b) => b.id - a.id)
        setMemorials(deceasedList)
      } catch (error) {
        console.error('加载纪念馆失败:', error)
        setMemorials([])
      } finally {
        setLoading(false)
      }
    }

    loadMemorials()
  }, [monitoredAddresses])

  /**
   * 函数级中文注释：跳转到纪念馆详情页
   */
  const handleMemorialClick = (id: string | number) => {
    window.location.hash = `#/memorial/comprehensive?id=${id}`
  }

  /**
   * 函数级中文注释：跳转到创建逝者页面
   */
  const handleCreateNew = () => {
    window.location.hash = '#/deceased/create'
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
        <div className="header-title">我创建的纪念馆</div>
        <div style={{ width: 40 }} />
      </div>

      {/* 主要内容区域 */}
      <div className="memorial-content">
        {/* 纪念馆列表 */}
        <div className="memorial-list-section">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: '#999' }}>加载中...</div>
            </div>
          ) : !hasAnyAddress ? (
            <Empty
              description="请先连接钱包"
              style={{ padding: 60 }}
            >
              <Button
                type="primary"
                onClick={() => window.location.hash = '#/wallet'}
                style={{ backgroundColor: '#5DBAAA', borderColor: '#5DBAAA' }}
              >
                连接钱包
              </Button>
            </Empty>
          ) : memorials.length === 0 ? (
            <Empty
              description="您还没有创建纪念馆"
              style={{ padding: 60 }}
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreateNew}
                style={{ backgroundColor: '#5DBAAA', borderColor: '#5DBAAA' }}
              >
                创建纪念馆
              </Button>
            </Empty>
          ) : (
            <div className="memorial-list">
              {memorials.map((memorial) => (
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
                      src={memorial.avatar}
                      icon={!memorial.avatar && <HomeOutlined />}
                      className="memorial-avatar"
                      style={{
                        backgroundColor: memorial.avatar ? 'transparent' : '#d9d9d9'
                      }}
                    />

                    {/* 中间信息 */}
                    <div className="memorial-info">
                      <div className="memorial-name">{memorial.name}</div>
                      <div className="memorial-date-row">
                        <span className="date-badge">
                          <span className="badge-icon">🅰️</span>
                          <span>{memorial.birthDate}</span>
                        </span>
                      </div>
                      <div className="memorial-date-text">{memorial.deathDate}</div>
                      <div className="memorial-stats">
                        <span className="stat-item">
                          <HeartFilled style={{ color: '#ff4d4f' }} />
                          <span>{memorial.likes}</span>
                        </span>
                        <span className="stat-item">
                          <FireFilled style={{ color: '#faad14' }} />
                          <span>{memorial.candles}</span>
                        </span>
                      </div>
                    </div>

                    {/* 右侧标签 */}
                    <div className="memorial-tag">
                      <Tag
                        color={memorial.status === 'memorial' ? 'red' : 'green'}
                        className="status-tag"
                      >
                        {memorial.status === 'memorial' ? '忌日' : '逝辰'}
                      </Tag>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* 创建新纪念馆按钮 - 固定在底部 */}
        {address && memorials.length > 0 && (
          <div style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100
          }}>
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={handleCreateNew}
              style={{
                backgroundColor: '#5DBAAA',
                borderColor: '#5DBAAA',
                borderRadius: 24,
                padding: '0 24px',
                height: 48,
                boxShadow: '0 4px 12px rgba(93, 186, 170, 0.4)'
              }}
            >
              创建纪念馆
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default MyCreatedMemorialsPage
