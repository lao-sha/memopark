import React from 'react'
import { usePreimage } from '../hooks/usePreimage'
import { fetchPreimageHexByHash, summarizePreimage } from '../lib/governance'
import { useEffect, useState } from 'react'

/**
 * 函数级详细中文注释：预映像信息查看组件
 * - 根据哈希展示预映像是否可用、长度与提供者（占位数据）
 */
const PreimageViewer: React.FC<{ hash?: string; hex?: string }> = ({ hash, hex }) => {
  const { loading, error, data } = usePreimage(hash)
  const [preview, setPreview] = useState<string>('')
  useEffect(() => {
    (async () => {
      if (!hash) return
      const originHex = hex || await fetchPreimageHexByHash(hash)
      if (originHex) {
        const s = await summarizePreimage(originHex)
        if (s) setPreview(s)
      }
    })()
  }, [hash, hex])
  if (!hash) return <div style={{ fontSize: 12, color: '#999' }}>无预映像哈希</div>
  if (loading) return <div style={{ fontSize: 12, color: '#999' }}>加载预映像信息...</div>
  if (error) return <div style={{ fontSize: 12, color: '#ef4444' }}>加载失败：{error}</div>
  return (
    <div style={{ fontSize: 12, color: '#666' }}>
      <div>哈希：<span style={{ fontFamily: 'monospace' }}>{data?.hash}</span></div>
      <div>可用：{data?.available ? '是' : '否'}，长度：{data?.length ?? '-'}，提供者：{data?.provider ?? '-'}</div>
      {hex && <div style={{ marginTop: 6 }}>原始HEX（截断）：<span style={{ fontFamily: 'monospace' }}>{hex.slice(0, 34)}…</span></div>}
      {preview && <div style={{ marginTop: 6 }}>调用预览：{preview}</div>}
    </div>
  )
}

export default PreimageViewer


