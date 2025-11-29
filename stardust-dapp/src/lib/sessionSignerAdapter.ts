import type { Registry, Signer, SignerPayloadJSON, SignerPayloadRaw, SignerResult } from '@polkadot/types/types';
import { hexToU8a, u8aToHex } from '@polkadot/util';
import sessionSigner from './session-signer';

class SessionSignerAdapter implements Signer {
  private id = 0;

  constructor(private registry: Registry) {}

  private nextId(): number {
    this.id = (this.id + 1) % Number.MAX_SAFE_INTEGER;
    if (this.id === 0) {
      this.id = 1;
    }
    return this.id;
  }

  async signPayload(payload: SignerPayloadJSON): Promise<SignerResult> {
    const pair = await sessionSigner.getKeyPairForAddress(payload.address);
    const extrinsicPayload = this.registry.createType('ExtrinsicPayload', payload, { version: payload.version });
    const { signature } = extrinsicPayload.sign(pair);
    return { id: this.nextId(), signature };
  }

  async signRaw(raw: SignerPayloadRaw): Promise<SignerResult> {
    const pair = await sessionSigner.getKeyPairForAddress(raw.address);
    const signature = u8aToHex(pair.sign(hexToU8a(raw.data)));
    return { id: this.nextId(), signature };
  }

  // update 回调目前不需要处理，保留空实现
  update(): void {
    // no-op
  }
}

export const createSessionSignerAdapter = (registry: Registry): Signer => {
  return new SessionSignerAdapter(registry);
};

export type SessionSigner = SessionSignerAdapter;
