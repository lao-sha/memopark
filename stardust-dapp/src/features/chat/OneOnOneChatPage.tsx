/**
 * 一对一聊天页面
 *
 * 功能说明：
 * 1. 会话列表展示
 * 2. 聊天界面
 * 3. 消息发送和接收
 * 4. 已读/未读状态
 * 5. 用户资料管理
 *
 * 创建日期：2025-11-22
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Input,
  Avatar,
  Badge,
  Empty,
  Spin,
  message as antMessage,
  Modal,
  Drawer,
} from 'antd'
import {
  SendOutlined,
  UserOutlined,
  SearchOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
  MoreOutlined,
  DeleteOutlined,
  CheckOutlined,
  ContactsOutlined,
} from '@ant-design/icons'
import { useWallet } from '../../hooks/useWallet'
import { createChatService, MessageType } from '../../services/chatService'
import type { SessionInfo, MessageMeta } from '../../services/chatService'

// 动态导入类型
type Web3FromAddress = typeof import('@polkadot/extension-dapp').web3FromAddress

const { TextArea } = Input

// ========== 主组件 ==========

export const OneOnOneChatPage: React.FC = () => {
  const { account } = useWallet()
  const [currentView, setCurrentView] = useState<'session-list' | 'chat'>('session-list')
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null)
  const [messages, setMessages] = useState<MessageMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [inputText, setInputText] = useState('')
  const [searchText, setSearchText] = useState('')
  const chatServiceRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentUser = account?.address || ''

  // 初始化聊天服务
  useEffect(() => {
    if (!currentUser) return

    createChatService().then((service) => {
      chatServiceRef.current = service
      loadUserSessions()
    })
  }, [currentUser])

  // 加载用户会话列表
  const loadUserSessions = useCallback(async () => {
    if (!chatServiceRef.current || !currentUser) return

    setLoading(true)
    try {
      const userSessions = await chatServiceRef.current.getUserSessions(currentUser)
      setSessions(userSessions)
    } catch (error) {
      console.error('加载会话失败:', error)
      antMessage.error('加载会话失败')
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  // 加载会话消息
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    if (!chatServiceRef.current) return

    setLoading(true)
    try {
      const msgIds = await chatServiceRef.current.getSessionMessages(sessionId)
      const msgs: MessageMeta[] = []

      for (const msgId of msgIds) {
        const msg = await chatServiceRef.current.getMessage(msgId)
        if (msg && !msg.isDeletedBySender && !msg.isDeletedByReceiver) {
          msgs.push(msg)
        }
      }

      setMessages(msgs.sort((a, b) => a.sentAt - b.sentAt))
    } catch (error) {
      console.error('加载消息失败:', error)
      antMessage.error('加载消息失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 进入聊天
  const handleEnterChat = useCallback(async (session: SessionInfo) => {
    setSelectedSession(session)
    setCurrentView('chat')
    await loadSessionMessages(session.sessionId)

    // 标记会话为已读
    if (chatServiceRef.current) {
      try {
        const tx = chatServiceRef.current.buildMarkSessionAsReadTx(session.sessionId)
        const { web3FromAddress } = await import('@polkadot/extension-dapp')
        const injector = await web3FromAddress(currentUser)
        await tx.signAndSend(currentUser, { signer: injector.signer })
      } catch (error) {
        console.error('标记已读失败:', error)
      }
    }

    // 滚动到底部
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [currentUser, loadSessionMessages])

  // 返回会话列表
  const handleBackToSessionList = useCallback(() => {
    setSelectedSession(null)
    setCurrentView('session-list')
    setMessages([])
    loadUserSessions()
  }, [loadUserSessions])

  // 发送消息
  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || !selectedSession || !chatServiceRef.current) return

    const receiverAddress = selectedSession.participants.find((p) => p !== currentUser)
    if (!receiverAddress) return

    try {
      setLoading(true)

      // TODO: 实现IPFS上传和加密
      // 目前使用模拟CID
      const mockCid = `Qm${Math.random().toString(36).substring(2, 15)}`

      await chatServiceRef.current.sendMessage(currentUser, {
        receiver: receiverAddress,
        contentCid: mockCid,
        msgType: MessageType.Text,
        sessionId: selectedSession.sessionId,
      })

      antMessage.success('消息已发送')
      setInputText('')

      // 重新加载消息
      await loadSessionMessages(selectedSession.sessionId)

      // 滚动到底部
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (error) {
      console.error('发送消息失败:', error)
      antMessage.error('发送消息失败')
    } finally {
      setLoading(false)
    }
  }, [inputText, selectedSession, currentUser, loadSessionMessages])

  // 渲染会话列表
  const renderSessionList = () => {
    const filteredSessions = sessions.filter((session) => {
      const otherUser = session.participants.find((p) => p !== currentUser)
      return otherUser?.toLowerCase().includes(searchText.toLowerCase())
    })

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col max-w-[480px] mx-auto">
        {/* 标题栏 */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <UserOutlined className="text-2xl" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">私信</h1>
                  <p className="text-white/80 text-xs">端到端加密聊天</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* 通讯录入口 */}
                <button
                  className="p-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl transition-all"
                  onClick={() => {
                    window.location.hash = '#/contacts'
                  }}
                  title="通讯录"
                >
                  <ContactsOutlined className="text-xl" />
                </button>
                {/* 新建会话 */}
                <button
                  className="p-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl transition-all"
                  onClick={() => {
                    const address = window.prompt('请输入对方地址：')
                    if (address) {
                      // TODO: 创建新会话
                      antMessage.info('功能开发中...')
                    }
                  }}
                  title="新建对话"
                >
                  <PlusOutlined className="text-xl" />
                </button>
              </div>
            </div>

            {/* 搜索框 */}
            <div className="relative">
              <SearchOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="搜索联系人..."
                className="w-full pl-10 pr-4 py-2.5 bg-white/90 backdrop-blur-sm rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-white/50 text-gray-900 placeholder-gray-500"
              />
            </div>
          </div>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && sessions.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <Spin size="large" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Empty
                description={
                  <div className="text-center">
                    <p className="text-gray-600 font-medium mb-1">暂无会话</p>
                    <p className="text-gray-400 text-sm">点击右上角 + 开始新对话</p>
                  </div>
                }
              />
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSessions.map((session) => {
                const otherUser = session.participants.find((p) => p !== currentUser) || ''
                const otherUserShort = `${otherUser.slice(0, 6)}...${otherUser.slice(-4)}`

                return (
                  <div
                    key={session.sessionId}
                    onClick={() => handleEnterChat(session)}
                    className="bg-white rounded-2xl shadow-sm hover:shadow-md border border-gray-100 p-4 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <Avatar
                          size={52}
                          className="bg-gradient-to-br from-blue-400 to-purple-500 text-lg font-semibold shadow-sm"
                        >
                          {otherUser.slice(0, 2).toUpperCase()}
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {otherUserShort}
                          </h3>
                          <span className="text-xs text-gray-400">
                            {new Date(session.lastActive * 1000).toLocaleTimeString('zh-CN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          点击进入聊天...
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // 渲染聊天界面
  const renderChat = () => {
    if (!selectedSession) return null

    const otherUser = selectedSession.participants.find((p) => p !== currentUser) || ''
    const otherUserShort = `${otherUser.slice(0, 6)}...${otherUser.slice(-4)}`

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col max-w-[480px] mx-auto">
        {/* 聊天头部 */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg">
          <div className="px-4 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToSessionList}
                className="p-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl transition-all"
              >
                <ArrowLeftOutlined className="text-lg" />
              </button>

              <div className="flex items-center gap-3 flex-1">
                <div className="relative">
                  <Avatar
                    size={44}
                    className="bg-gradient-to-br from-white/30 to-white/20 text-base font-semibold"
                  >
                    {otherUser.slice(0, 2).toUpperCase()}
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold truncate">{otherUserShort}</h2>
                  <p className="text-white/70 text-xs">在线</p>
                </div>
              </div>

              <button
                className="p-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl transition-all"
                onClick={() => {
                  // TODO: 显示更多选项
                  antMessage.info('功能开发中...')
                }}
              >
                <MoreOutlined className="text-lg" />
              </button>
            </div>
          </div>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading && messages.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <Spin />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Empty description="暂无消息" />
            </div>
          ) : (
            messages.map((msg) => {
              const isSent = msg.sender === currentUser
              return (
                <div
                  key={msg.msgId}
                  className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[75%] ${isSent ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <div
                      className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                        isSent
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-br-sm'
                          : 'bg-white text-gray-900 rounded-bl-sm'
                      }`}
                    >
                      <p className="text-sm leading-relaxed break-words">
                        {msg.contentCid}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 px-1">
                      <span className="text-xs text-gray-400">
                        {new Date(msg.sentAt * 1000).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {isSent && msg.isRead && (
                        <CheckOutlined className="text-xs text-blue-500" />
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入框 */}
        <div className="bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextArea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder="输入消息... (Shift+Enter换行)"
                autoSize={{ minRows: 1, maxRows: 4 }}
                className="border-0 focus:ring-2 focus:ring-blue-500 rounded-xl resize-none bg-gray-50"
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || loading}
              className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <SendOutlined className="text-lg" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 主渲染
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center max-w-[480px] mx-auto">
        <Empty description="请先连接钱包" />
      </div>
    )
  }

  return currentView === 'session-list' ? renderSessionList() : renderChat()
}

export default OneOnOneChatPage