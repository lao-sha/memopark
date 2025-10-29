import React, { useMemo, useState } from 'react'
import { Drawer, List, Tag, Space, Button, message } from 'antd'

export type TxItem = { id: string; section: string; method: string; hash?: string; status: 'Ready'|'InBlock'|'Finalized'|'Error'; error?: string }

export const TxQueueDrawer: React.FC<{ open: boolean, onClose: ()=>void, items: TxItem[] }>=({ open, onClose, items })=>{
  const base = (import.meta as any)?.env?.VITE_EXPLORER || ''
  const explorer = (hash?: string)=> hash && base ? `${base.replace(/\/$/, '')}/extrinsic/${hash}` : ''
  return (
    <Drawer title="交易队列" placement="bottom" onClose={onClose} open={open} height={360}>
      <List
        dataSource={items}
        renderItem={(it)=> (
          <List.Item actions={[
            it.hash ? <a key="copy" onClick={()=>{ navigator.clipboard.writeText(it.hash!); message.success('已复制哈希') }}>复制哈希</a> : null,
            it.hash ? <a key="view" href={explorer(it.hash)} target="_blank" rel="noreferrer">浏览器查看</a> : null,
          ]}>
            <List.Item.Meta
              title={<Space><span>{it.section}.{it.method}</span><Tag color={it.status==='Error'?'red':it.status==='Finalized'?'green':it.status==='InBlock'?'blue':'default'}>{it.status}</Tag></Space>}
              description={it.error || it.hash || it.id}
            />
          </List.Item>
        )}
      />
    </Drawer>
  )
}


