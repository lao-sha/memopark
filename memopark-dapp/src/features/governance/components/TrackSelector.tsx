import React from 'react';

/**
 * 函数级详细中文注释：轨道选择器组件（移动端优先）
 * - 展示可用轨道列表与关键参数摘要（保证金/冷静期/延迟/曲线等）
 * - 当前为最小骨架：仅占位展示与回调，不含数据源
 */
export interface TrackOption {
  id: number;
  name: string;
  summary?: string;
}

interface Props {
  options: TrackOption[];
  value?: number;
  onChange?: (trackId: number) => void;
}

const TrackSelector: React.FC<Props> = ({ options, value, onChange }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => onChange?.(opt.id)}
          style={{
            padding: 12,
            textAlign: 'left',
            borderRadius: 8,
            border: value === opt.id ? '2px solid #1677ff' : '1px solid #e5e7eb',
            background: value === opt.id ? '#e6f4ff' : '#fff'
          }}
        >
          <div style={{ fontWeight: 600 }}>{opt.name}</div>
          {opt.summary && <div style={{ fontSize: 12, color: '#666' }}>{opt.summary}</div>}
        </button>
      ))}
    </div>
  );
};

export default TrackSelector;


