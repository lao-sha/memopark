/**
 * 节点状态检测服务
 *
 * 功能：
 * - 检测区块链节点是否在线
 * - 检测 BaziChart pallet 是否可用
 * - 提供友好的错误提示
 */

import { getApi } from '../lib/polkadot';

/**
 * 节点状态
 */
export interface NodeStatus {
  /** 节点是否在线 */
  isOnline: boolean;
  /** BaziChart pallet 是否可用 */
  hasBaziChart: boolean;
  /** 错误信息 */
  error?: string;
  /** 友好的用户提示 */
  userMessage?: string;
}

/**
 * 检查节点状态
 */
export async function checkNodeStatus(): Promise<NodeStatus> {
  try {
    const api = await getApi();

    // 检查节点是否在线
    const isOnline = api.isConnected;

    if (!isOnline) {
      return {
        isOnline: false,
        hasBaziChart: false,
        error: 'NODE_OFFLINE',
        userMessage: '区块链节点未启动，请先启动节点'
      };
    }

    // 检查 BaziChart pallet 是否存在
    const hasBaziChart = !!(api.tx.baziChart && api.tx.baziChart.createChart);

    if (!hasBaziChart) {
      return {
        isOnline: true,
        hasBaziChart: false,
        error: 'MISSING_BAZI_PALLET',
        userMessage: '节点未包含八字命理模块，请更新节点版本'
      };
    }

    return {
      isOnline: true,
      hasBaziChart: true
    };
  } catch (error) {
    console.error('[NodeStatus] 检查失败:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    // 判断错误类型
    if (errorMessage.includes('CONNECTION') || errorMessage.includes('connect')) {
      return {
        isOnline: false,
        hasBaziChart: false,
        error: 'CONNECTION_ERROR',
        userMessage: '无法连接到区块链节点，请检查节点是否运行在 ws://127.0.0.1:9944'
      };
    }

    return {
      isOnline: false,
      hasBaziChart: false,
      error: 'UNKNOWN_ERROR',
      userMessage: '检查节点状态失败，请稍后重试'
    };
  }
}

/**
 * 检查 BaziChart pallet 是否可用
 */
export async function checkBaziChartAvailable(): Promise<boolean> {
  try {
    const api = await getApi();
    return !!(api.tx.baziChart && api.tx.baziChart.createChart);
  } catch {
    return false;
  }
}

/**
 * 获取友好的错误提示
 */
export function getFriendlyErrorMessage(error: any): string {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // 节点未启动
  if (errorMessage.includes('CONNECTION') || errorMessage.includes('connect') || errorMessage.includes('WebSocket')) {
    return '⚠️ 区块链节点未启动\n\n' +
           '请在终端运行以下命令启动节点：\n' +
           'cd /home/xiaodong/文档/stardust\n' +
           './restart-with-bazi.sh';
  }

  // 缺少 BaziChart pallet
  if (errorMessage.includes('baziChart') || errorMessage.includes('pallet-bazi-chart')) {
    return '⚠️ 节点版本过旧\n\n' +
           '您的节点不包含八字命理模块，请更新：\n' +
           '1. 停止旧节点\n' +
           '2. 运行: ./restart-with-bazi.sh\n' +
           '3. 或手动编译: cargo build --release -p stardust-node';
  }

  // 钱包未连接
  if (errorMessage.includes('signer') || errorMessage.includes('account')) {
    return '⚠️ 请先连接钱包\n\n' +
           '点击右上角的"连接钱包"按钮';
  }

  // 通用错误
  return `❌ 操作失败\n\n${errorMessage}`;
}

/**
 * 获取启动节点的帮助信息
 */
export function getStartNodeHelp(): {
  title: string;
  steps: string[];
  command: string;
} {
  return {
    title: '如何启动区块链节点',
    steps: [
      '1. 打开新终端窗口',
      '2. 进入项目目录',
      '3. 运行启动脚本',
      '4. 等待节点启动完成（约10秒）',
      '5. 刷新此页面'
    ],
    command: 'cd /home/xiaodong/文档/stardust && ./restart-with-bazi.sh'
  };
}
