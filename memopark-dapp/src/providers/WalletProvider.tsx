import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getApi, signAndSend, sendViaForwarder } from '../lib/polkadot'
import { web3Accounts, web3Enable } from '@polkadot/extension-dapp'

type WalletCtx = {
  connected: boolean
  accounts: { address: string; name?: string }[]
  current?: string
  connect: () => Promise<void>
  disconnect: () => void
  switchAccount: (addr: string) => void
  signAndSend: (section: string, method: string, args: any[]) => Promise<string>
  sendViaForwarder: (namespace: any, section: string, method: string, args: any[]) => Promise<string>
  queue: { id: string; section: string; method: string; hash?: string; status: 'Ready'|'InBlock'|'Finalized'|'Error'; error?: string }[]
  pushTx: (entry: { id: string; section: string; method: string }) => void
  updateTx: (id: string, patch: Partial<{ hash: string; status: 'Ready'|'InBlock'|'Finalized'|'Error'; error?: string }>) => void
}

const Ctx = createContext<WalletCtx>(null as any)

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false)
  const [accounts, setAccounts] = useState<{ address: string; name?: string }[]>([])
  const [current, setCurrent] = useState<string | undefined>(undefined)
  const [queue, setQueue] = useState<WalletCtx['queue']>([])

  useEffect(() => { (async()=>{ try{ await getApi() }catch{} })() }, [])

  const connect = useCallback(async ()=>{
    await web3Enable('memopark-dapp')
    const accs = await web3Accounts()
    const list = accs.map(a=>({ address: a.address, name: a.meta.name as string|undefined }))
    setAccounts(list)
    const saved = localStorage.getItem('mp.current')
    const use = saved && list.find(x=>x.address===saved) ? saved : list[0]?.address
    setCurrent(use)
    setConnected(true)
  },[])

  const disconnect = useCallback(()=>{
    setConnected(false); setAccounts([]); setCurrent(undefined); localStorage.removeItem('mp.current')
  },[])

  const switchAccount = useCallback((addr: string)=>{ setCurrent(addr); localStorage.setItem('mp.current', addr) },[])

  const doSignAndSend = useCallback(async (section: string, method: string, args: any[])=>{
    if(!current) throw new Error('未选择账户')
    const id = `${Date.now()}-${Math.random()}`
    setQueue(q=>[{ id, section, method, status: 'Ready' }, ...q])
    try{
      const hash = await signAndSend(current, section, method, args)
      setQueue(q=>q.map(x=> x.id===id ? { ...x, hash, status: 'InBlock' } : x))
      // 前端无法可靠得知 Finalized，这里保持 InBlock；如需可订阅系统事件进一步更新
      return hash
    }catch(e:any){ setQueue(q=>q.map(x=> x.id===id ? { ...x, status: 'Error', error: e?.message||String(e) } : x)); throw e }
  },[current])

  const doSendViaForwarder = useCallback(async (namespace: any, section: string, method: string, args: any[])=>{
    if(!current) throw new Error('未选择账户')
    const id = `${Date.now()}-${Math.random()}`
    setQueue(q=>[{ id, section, method, status: 'Ready' }, ...q])
    try{
      const hash = await sendViaForwarder(namespace, current, section, method, args)
      setQueue(q=>q.map(x=> x.id===id ? { ...x, hash, status: 'InBlock' } : x))
      return hash
    }catch(e:any){ setQueue(q=>q.map(x=> x.id===id ? { ...x, status: 'Error', error: e?.message||String(e) } : x)); throw e }
  },[current])

  const pushTx = useCallback((entry: { id: string; section: string; method: string })=>{ setQueue(q=>[ entry as any, ...q ]) },[])
  const updateTx = useCallback((id: string, patch: Partial<{ hash: string; status: 'Ready'|'InBlock'|'Finalized'|'Error'; error?: string }>)=>{ setQueue(q=>q.map(x=> x.id===id ? { ...x, ...patch } : x)) },[])

  const value = useMemo(()=>({ connected, accounts, current, connect, disconnect, switchAccount, signAndSend: doSignAndSend, sendViaForwarder: doSendViaForwarder, queue, pushTx, updateTx }),[connected, accounts, current, connect, disconnect, switchAccount, doSignAndSend, doSendViaForwarder, queue, pushTx, updateTx])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWallet(){ return useContext(Ctx) }


