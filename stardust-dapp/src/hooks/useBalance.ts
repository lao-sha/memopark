import { useEffect, useState } from 'react';
import { queryFreeBalance } from '../lib/polkadot-safe';

interface BalanceState {
  loading: boolean;
  error: string | null;
  formatted: string;
  symbol: string;
  raw: string;
}

/**
 * 简单余额 Hook（可后续换成 react-query）
 * - 轮询可选（默认 0 = 不轮询）
 */
export function useBalance(address?: string, pollMs = 0): BalanceState {
  const [state, setState] = useState<BalanceState>({ loading: !!address, error: null, formatted: '0', symbol: '---', raw: '0' });

  async function load() {
    if (!address) return;
    try {
      setState(s => ({ ...s, loading: true, error: null }));
      const b = await queryFreeBalance(address);
      setState({ loading: false, error: null, formatted: b.formatted, symbol: b.symbol, raw: b.free });
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) }));
    }
  }

  useEffect(() => { load(); }, [address]);
  useEffect(() => {
    if (pollMs > 0) {
      const id = setInterval(load, pollMs);
      return () => clearInterval(id);
    }
  }, [address, pollMs]);

  return state;
}
