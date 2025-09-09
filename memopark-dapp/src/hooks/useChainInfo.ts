import { useEffect, useState } from 'react';
import { getApi } from '../lib/polkadot-safe';

interface ChainInfoState { loading: boolean; name?: string; tokenSymbol?: string; decimals?: number; error?: string }

export function useChainInfo(): ChainInfoState {
  const [info, setInfo] = useState<ChainInfoState>({ loading: true });

  useEffect(() => {
    (async () => {
      try {
        const api = await getApi();
        const chain = await api.rpc.system.chain();
        const symbol = api.registry.chainTokens?.[0];
        const decimals = api.registry.chainDecimals?.[0];
        setInfo({ loading: false, name: chain.toString(), tokenSymbol: symbol, decimals });
      } catch (e) {
        setInfo({ loading: false, error: e instanceof Error ? e.message : String(e) });
      }
    })();
  }, []);

  return info;
}
