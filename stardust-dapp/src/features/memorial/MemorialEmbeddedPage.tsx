import React, { useMemo, useRef, useState, useEffect } from 'react'
import { ReloadOutlined, LeftOutlined, RightOutlined, LinkOutlined } from '@ant-design/icons'
import './MemorialEmbeddedPage.css'

/**
 * 函数级详细中文注释：纪念馆“内嵌浏览器”页面
 *
 * 设计目标：
 * - 在应用内部以“内嵌浏览器”的风格完整承载指定 URL（默认纪念馆首页）
 * - 提供基础的浏览器交互：返回、前进、刷新、在新窗口打开
 * - 使用 iframe 承载页面，隔离样式，避免与宿主页面样式冲突
 *
 * 安全与限制：
 * - 仅用于同源场景（本地开发 http://localhost:5173），跨源需服务器允许 X-Frame-Options / CSP
 * - 不注入子页面脚本，避免破坏被嵌入页面的行为
 */
const MemorialEmbeddedPage: React.FC = () => {
  // 允许通过查询参数覆盖目标地址：#/memorial-browser?url=ENCODED_URL
  const defaultUrl = 'http://localhost:5173/#/memorial'
  const [currentUrl, setCurrentUrl] = useState<string>(defaultUrl)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  /**
   * 函数级详细中文注释：解析路由中的 url 查询参数
   */
  const parsedUrlFromHash = useMemo(() => {
    try {
      const hash = window.location.hash
      const queryIndex = hash.indexOf('?')
      if (queryIndex === -1) return null
      const query = new URLSearchParams(hash.slice(queryIndex + 1))
      const urlParam = query.get('url')
      if (!urlParam) return null
      const decoded = decodeURIComponent(urlParam)
      return decoded
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (parsedUrlFromHash) {
      setCurrentUrl(parsedUrlFromHash)
    }
  }, [parsedUrlFromHash])

  /**
   * 函数级详细中文注释：刷新 iframe
   */
  const handleReload = () => {
    if (iframeRef.current) {
      // 直接修改 src 以强制刷新
      const src = iframeRef.current.src
      iframeRef.current.src = src
    }
  }

  /**
   * 函数级详细中文注释：后退/前进
   * 说明：由于 iframe 的历史栈与父页面隔离，仅在同源且允许访问 contentWindow.history 时有效；
   * 多数前端应用 hash 变化不会阻止 back/forward，可尝试调用。
   */
  const handleBack = () => {
    try {
      iframeRef.current?.contentWindow?.history.back()
    } catch {
      // 忽略跨源错误
    }
  }
  const handleForward = () => {
    try {
      iframeRef.current?.contentWindow?.history.forward()
    } catch {
      // 忽略跨源错误
    }
  }

  /**
   * 函数级详细中文注释：在新窗口打开当前 URL
   */
  const handleOpenExternal = () => {
    window.open(currentUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="embedded-browser">
      <div className="embedded-toolbar">
        <button className="btn" onClick={handleBack} title="后退">
          <LeftOutlined />
        </button>
        <button className="btn" onClick={handleForward} title="前进">
          <RightOutlined />
        </button>
        <button className="btn" onClick={handleReload} title="刷新">
          <ReloadOutlined />
        </button>
        <div className="address-bar" title={currentUrl}>
          {currentUrl}
        </div>
        <button className="btn" onClick={handleOpenExternal} title="在新窗口打开">
          <LinkOutlined />
        </button>
      </div>
      <div className="embedded-content">
        <iframe
          ref={iframeRef}
          className="embedded-iframe"
          src={currentUrl}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  )
}

export default MemorialEmbeddedPage


