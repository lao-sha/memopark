import React, { useMemo, useState } from 'react';
import TrackSelector, { type TrackOption } from './components/TrackSelector';
import { useTracks } from './hooks/useTracks';
import { submitPreimage, submitProposal, buildTreasurySpendPreimage, decodePreimageHex, summarizePreimage, buildBalancesForceTransferPreimage } from './lib/governance';
import PasswordModal from './components/PasswordModal';
import { appendTx } from '../../lib/txHistory';
import { useWallet } from '../../providers/WalletProvider';

/**
 * 函数级详细中文注释：发起提案页面（移动端优先）
 * - 步骤：上传预映像 → 选择轨道 → 填写说明 → 估算押金 → 提交
 * - 当前为最小骨架，后续接入实际链上调用
 */
const NewProposalPage: React.FC = () => {
  const { tracks } = useTracks()
  const { current } = useWallet()
  const [trackId, setTrackId] = useState<number | undefined>(undefined)
  const [preimage, setPreimage] = useState('')
  const [desc, setDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [beneficiary, setBeneficiary] = useState('')
  const [amount, setAmount] = useState('')
  const [preview, setPreview] = useState<string>('')
  const [confirmMsg, setConfirmMsg] = useState<string>('')
  const [forceSrc, setForceSrc] = useState('')
  const [forceDest, setForceDest] = useState('')
  const [forceAmt, setForceAmt] = useState('')

  async function handleSubmit() {
    if (!trackId) return window.alert('请选择轨道')
    if (!preimage) return window.alert('请输入预映像原始字节（hex 或 SCALE 编码说明占位）')
    setPwdOpen(true)
  }

  const options: TrackOption[] = tracks.map(t => ({ id: t.id, name: t.name, summary: t.summary }))
  // 自动选择“财库”相关轨道（名称包含“财库/Treasury”）
  useMemo(() => {
    if (!trackId && tracks.length > 0) {
      const found = tracks.find(t => /财库|treasury/i.test(t.name)) || tracks[0]
      setTrackId(found.id)
    }
  }, [tracks])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>发起提案</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, marginBottom: 8 }}>选择轨道</div>
          <TrackSelector options={options} value={trackId} onChange={setTrackId} />
        </div>
        <div>
          <div style={{ fontSize: 14, marginBottom: 8 }}>预映像数据</div>
          <textarea value={preimage} onChange={async (e) => {
            const v = e.target.value; setPreimage(v);
            if (v && v.startsWith('0x') && v.length > 4) {
              const s = await summarizePreimage(v)
              if (s) {
                setPreview(s)
                setConfirmMsg(`将提交预映像调用：${s}`)
              } else {
                const r = await decodePreimageHex(v)
                if (r && r.section && r.method) {
                  const text = `${r.section}.${r.method}(${JSON.stringify(r.args)})`
                  setPreview(text)
                  setConfirmMsg(`将提交预映像调用：${text}`)
                } else {
                  setPreview('无法解析（请确认为 call.method 的十六进制）')
                  setConfirmMsg('')
                }
              }
            } else { setPreview('') }
          }} rows={4} placeholder="输入提案预映像（占位：原始字节/哈希说明）" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }} />
          {preview && <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>调用预览：{preview}</div>}
        </div>
        <div style={{ border: '1px dashed #e5e7eb', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>财库支出快捷构建（treasury.spend）</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={beneficiary} onChange={(e)=>setBeneficiary(e.target.value)} placeholder="收款地址（SS58）" style={{ padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }} />
            <input value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="金额（MEMO，小数可选）" style={{ padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }} />
            <button onClick={async()=>{
              try {
                if (!beneficiary) return window.alert('请输入收款地址')
                // 地址基本校验：长度与字符集
                if (!/^\w{40,64}$/i.test(beneficiary)) return window.alert('收款地址格式不正确')
                if (!amount) return window.alert('请输入金额（MEMO）')
                if (!/^\d+(?:\.\d+)?$/.test(amount)) return window.alert('金额格式不正确')
                if (parseFloat(amount) <= 0) return window.alert('金额需大于 0')
                const { hex, hash, planck, symbol } = await buildTreasurySpendPreimage(beneficiary, amount)
                setPreimage(hex)
                window.alert(`已生成预映像\n哈希：${hash}\n原始金额：${planck} ${symbol}`)
              } catch(e) { window.alert(e instanceof Error? e.message: String(e)) }
            }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}>生成预映像</button>
          </div>
        </div>

        <div style={{ border: '1px dashed #fde68a', borderRadius: 8, padding: 12, background: '#fffbeb' }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: '#b45309' }}>高风险（Root）：balances.forceTransfer 快速构建（测试/应急）</div>
          <div style={{ fontSize: 12, color: '#b45309', marginBottom: 6 }}>仅用于测试网或应急提案。请确保走危险轨道且有二次确认。</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={forceSrc} onChange={(e)=>setForceSrc(e.target.value)} placeholder="源地址（SS58）" style={{ padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }} />
            <input value={forceDest} onChange={(e)=>setForceDest(e.target.value)} placeholder="目标地址（SS58）" style={{ padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }} />
            <input value={forceAmt} onChange={(e)=>setForceAmt(e.target.value)} placeholder="金额（MEMO）" style={{ padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }} />
            <button onClick={async()=>{
              try {
                if (!forceSrc || !forceDest || !forceAmt) return window.alert('请完整填写源/目标/金额')
                const { hex, hash, planck, symbol } = await buildBalancesForceTransferPreimage(forceSrc, forceDest, forceAmt)
                setPreimage(hex)
                window.alert(`已生成预映像\n哈希：${hash}\n原始金额：${planck} ${symbol}`)
              } catch(e) { window.alert(e instanceof Error? e.message: String(e)) }
            }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}>生成预映像</button>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 14, marginBottom: 8 }}>提案说明（可选）</div>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="填写提案目的与风险提示（仅前端展示）" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }} />
        </div>
        <button disabled={submitting} onClick={handleSubmit} style={{ padding: '10px 16px', borderRadius: 8, background: '#1677ff', color: '#fff', border: 'none' }}>{submitting ? '提交中...' : '提交提案'}</button>
      </div>
      <PasswordModal
        open={pwdOpen}
        title="提交提案 - 输入钱包密码"
        message={confirmMsg || undefined}
        onOk={async (password) => {
          try {
            setSubmitting(true)
            const pre = await submitPreimage(preimage, password)
            const hash = await submitProposal(trackId as number, pre, password)
            window.alert(`提案已提交：${hash}`)
            try {
              // 写入本地交易历史：referenda.submit
              appendTx({ hash, section: 'referenda', method: 'submit', args: [trackId, pre.hash, pre.len], timestamp: Date.now(), from: current || undefined })
            } catch {}
          } catch (e) {
            window.alert(`提交失败：${e instanceof Error ? e.message : String(e)}`)
          } finally {
            setSubmitting(false)
            setPwdOpen(false)
          }
        }}
        onCancel={() => setPwdOpen(false)}
      />
    </div>
  );
};

export default NewProposalPage;


