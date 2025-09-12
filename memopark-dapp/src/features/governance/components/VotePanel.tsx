import React, { useState } from 'react';

/**
 * 函数级详细中文注释：投票面板组件（移动端优先）
 * - 允许用户选择 Aye/Nay、设定 Conviction（锁仓倍数）与投票金额
 * - 仅提供 UI 与回调骨架；真实提交由上层注入
 */
interface Props {
  onSubmit?: (params: { aye: boolean; conviction: number; amount: string }) => void;
}

const convictions = [0, 1, 2, 3, 4, 5, 6];

const VotePanel: React.FC<Props> = ({ onSubmit }) => {
  const [aye, setAye] = useState(true);
  const [conviction, setConviction] = useState(0);
  const [amount, setAmount] = useState('');

  function validate(): string | null {
    if (!amount) return '请输入投票金额'
    if (!/^\d+(\.\d+)?$/.test(amount)) return '金额格式错误'
    if (parseFloat(amount) <= 0) return '金额需大于 0'
    return null
  }

  return (
    <div style={{ position: 'sticky', bottom: 0, background: '#fff', padding: 12, borderTop: '1px solid #eee' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={() => setAye(true)} style={{ flex: 1, padding: 10, borderRadius: 8, border: aye ? '2px solid #16a34a' : '1px solid #e5e7eb', background: aye ? '#dcfce7' : '#fff' }}>赞成 Aye</button>
        <button onClick={() => setAye(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: !aye ? '2px solid #ef4444' : '1px solid #e5e7eb', background: !aye ? '#fee2e2' : '#fff' }}>反对 Nay</button>
      </div>
      <div style={{ display: 'flex', overflowX: 'auto', gap: 8, paddingBottom: 8 }}>
        {convictions.map(c => (
          <button key={c} onClick={() => setConviction(c)} style={{ padding: '6px 10px', borderRadius: 999, border: conviction === c ? '2px solid #1677ff' : '1px solid #e5e7eb', background: conviction === c ? '#e6f4ff' : '#fff', whiteSpace: 'nowrap' }}>{c}x</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="输入投票金额" style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }} />
        <button onClick={() => { const err = validate(); if (err) { window.alert(err); return } onSubmit?.({ aye, conviction, amount }) }} style={{ padding: '10px 16px', borderRadius: 8, background: '#1677ff', color: '#fff', border: 'none' }}>提交</button>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>锁仓说明：Conviction 为 n× 时，锁仓期约为基期的 n 倍；撤票或到期后可解锁。</div>
    </div>
  );
};

export default VotePanel;


