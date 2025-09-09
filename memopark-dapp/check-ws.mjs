/**
 * 函数级详细中文注释：
 * main
 * - 功能：使用 @polkadot/api 连接本地/环境变量指定的节点 WS 端点，输出链信息与最新区块高度。
 * - 入参：无（从环境变量 VITE_WS 或默认 ws://127.0.0.1:9944 读取端点）。
 * - 返回：进程退出码 0 表示成功，非 0 表示失败。
 * - 安全性：仅读取公开链信息，不涉及隐私或资金操作。
 */
import { ApiPromise, WsProvider } from '@polkadot/api';

async function main() {
  const endpoint = process.env.VITE_WS || 'ws://127.0.0.1:9944';
  let api;
  try {
    api = await ApiPromise.create({ provider: new WsProvider(endpoint) });
    const [chain, nodeName, nodeVersion, header] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.system.name(),
      api.rpc.system.version(),
      api.rpc.chain.getHeader(),
    ]);
    console.log(`endpoint=${endpoint}`);
    console.log(`chain=${chain.toString()} name=${nodeName.toString()} version=${nodeVersion.toString()} best=${header.number.toString()}`);
  } catch (e) {
    console.error('连接失败：', e?.message || e);
    process.exitCode = 1;
  } finally {
    if (api) await api.disconnect();
  }
}

main();


