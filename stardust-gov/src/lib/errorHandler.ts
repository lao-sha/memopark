/**
 * 错误处理工具
 * 函数级中文注释：提供统一的错误处理和用户友好的错误提示
 */

/**
 * 函数级中文注释：错误类型枚举
 */
export enum ErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  BALANCE = 'balance',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

/**
 * 函数级中文注释：错误信息接口
 */
export interface ErrorInfo {
  type: ErrorType;
  code?: string;
  message: string;
  userMessage: string;
  canRetry: boolean;
  suggestedActions?: string[];
}

/**
 * 函数级中文注释：错误分类和处理规则
 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  type: ErrorType;
  userMessage: string;
  canRetry: boolean;
  suggestedActions?: string[];
}> = [
  // 网络相关错误
  {
    pattern: /网络|连接|timeout|fetch/i,
    type: ErrorType.NETWORK,
    userMessage: '网络连接出现问题，请检查网络连接后重试',
    canRetry: true,
    suggestedActions: ['检查网络连接', '刷新页面重试']
  },

  // 余额相关错误
  {
    pattern: /余额|资金|balance|insufficient/i,
    type: ErrorType.BALANCE,
    userMessage: '账户余额不足，请先充值后再试',
    canRetry: false,
    suggestedActions: ['充值账户余额', '联系管理员']
  },

  // 权限相关错误
  {
    pattern: /权限|授权|permission|unauthorized/i,
    type: ErrorType.AUTHORIZATION,
    userMessage: '权限不足，无法执行此操作',
    canRetry: false,
    suggestedActions: ['确认账户权限', '联系管理员']
  },

  // 验证相关错误
  {
    pattern: /验证|格式|validation|invalid/i,
    type: ErrorType.VALIDATION,
    userMessage: '输入信息有误，请检查后重试',
    canRetry: false,
    suggestedActions: ['检查输入格式', '确认必填项']
  },

  // 超时错误
  {
    pattern: /超时|timeout/i,
    type: ErrorType.TIMEOUT,
    userMessage: '操作超时，请稍后重试',
    canRetry: true,
    suggestedActions: ['稍后重试', '检查网络状态']
  },

  // Polkadot.js 特定错误
  {
    pattern: /wasm|unreachable|panic/i,
    type: ErrorType.UNKNOWN,
    userMessage: '系统内部错误，请刷新页面后重试',
    canRetry: true,
    suggestedActions: ['刷新页面', '清除浏览器缓存']
  },

  // 提案相关错误
  {
    pattern: /提案|proposal/i,
    type: ErrorType.VALIDATION,
    userMessage: '提案信息有误，请刷新页面后重试',
    canRetry: true,
    suggestedActions: ['刷新页面', '重新发起提案']
  }
];

/**
 * 函数级中文注释：分析错误信息并分类
 */
export function analyzeError(error: Error | string): ErrorInfo {
  const errorMessage = typeof error === 'string' ? error : error.message;

  // 查找匹配的错误模式
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(errorMessage)) {
      return {
        type: pattern.type,
        message: errorMessage,
        userMessage: pattern.userMessage,
        canRetry: pattern.canRetry,
        suggestedActions: pattern.suggestedActions
      };
    }
  }

  // 默认处理
  return {
    type: ErrorType.UNKNOWN,
    message: errorMessage,
    userMessage: '操作失败，请稍后重试或联系技术支持',
    canRetry: true,
    suggestedActions: ['刷新页面重试', '联系技术支持']
  };
}

/**
 * 函数级中文注释：格式化错误显示
 */
export function formatErrorMessage(errorInfo: ErrorInfo): {
  title: string;
  description: string;
  actions?: string[];
} {
  const actionMap: Record<string, { title: string; description: string; actions?: string[] }> = {
    [ErrorType.NETWORK]: {
      title: '网络连接问题',
      description: errorInfo.userMessage,
      actions: errorInfo.suggestedActions
    },
    [ErrorType.BALANCE]: {
      title: '余额不足',
      description: errorInfo.userMessage,
      actions: errorInfo.suggestedActions
    },
    [ErrorType.AUTHORIZATION]: {
      title: '权限不足',
      description: errorInfo.userMessage,
      actions: errorInfo.suggestedActions
    },
    [ErrorType.VALIDATION]: {
      title: '输入验证失败',
      description: errorInfo.userMessage,
      actions: errorInfo.suggestedActions
    },
    [ErrorType.TIMEOUT]: {
      title: '操作超时',
      description: errorInfo.userMessage,
      actions: errorInfo.suggestedActions
    },
    [ErrorType.UNKNOWN]: {
      title: '系统错误',
      description: errorInfo.userMessage,
      actions: errorInfo.suggestedActions
    }
  };

  return actionMap[String(errorInfo.type)] || {
    title: '操作失败',
    description: errorInfo.userMessage,
    actions: errorInfo.suggestedActions
  };
}

/**
 * 函数级中文注释：智能错误重试判断
 */
export function shouldRetry(error: Error | string, attemptCount: number = 0): {
  canRetry: boolean;
  delay: number;
  maxAttempts: number;
} {
  const errorInfo = analyzeError(error);
  const maxAttempts = errorInfo.canRetry ? 3 : 1;
  const delay = Math.min(1000 * Math.pow(2, attemptCount), 10000); // 指数退避，最多10秒

  return {
    canRetry: errorInfo.canRetry && attemptCount < maxAttempts,
    delay,
    maxAttempts
  };
}

/**
 * 函数级中文注释：错误日志记录
 */
export function logError(error: Error, context?: any) {
  const errorInfo = analyzeError(error);
  const timestamp = new Date().toISOString();

  const logEntry = {
    timestamp,
    type: errorInfo.type,
    message: error.message,
    stack: error.stack,
    context,
    userAgent: navigator.userAgent,
    url: window.location.href
  };

  // 控制台输出（开发环境）
  if (process.env.NODE_ENV === 'development') {
    console.group(`🚨 错误日志 [${errorInfo.type}]`);
    console.error('原始错误:', error);
    console.log('分类信息:', errorInfo);
    console.log('上下文:', context);
    console.groupEnd();
  }

  // 发送到错误收集服务（生产环境）
  // 这里可以集成 Sentry、LogRocket 等服务
  try {
    // 示例：发送到自定义错误收集端点
    // await fetch('/api/errors', {
    //   method: 'POST',
    //   body: JSON.stringify(logEntry)
    // });
  } catch (reportError) {
    console.warn('错误上报失败:', reportError);
  }

  return logEntry;
}

/**
 * 函数级中文注释：用户友好的错误提示组件数据生成
 */
export function generateErrorAlertProps(error: Error | string) {
  const errorInfo = analyzeError(error);
  const formatted = formatErrorMessage(errorInfo);

  return {
    type: errorInfo.type === ErrorType.BALANCE ? 'warning' :
          errorInfo.type === ErrorType.AUTHORIZATION ? 'error' :
          errorInfo.canRetry ? 'info' : 'error',
    message: formatted.title,
    description: formatted.description,
    showIcon: true,
    action: formatted.actions && formatted.actions.length > 0 ? {
      label: '建议操作',
      items: formatted.actions.map(action => ({ label: action }))
    } : undefined
  };
}

/**
 * 函数级中文注释：批量错误处理
 */
export function handleBatchErrors(errors: Array<{ error: Error; context?: any }>) {
  const results = errors.map(({ error, context }) => {
    const errorInfo = analyzeError(error);
    const logEntry = logError(error, context);

    return {
      errorInfo,
      logEntry,
      retryInfo: shouldRetry(error)
    };
  });

  // 分组统计
  const grouped = results.reduce((acc, result) => {
    const type = result.errorInfo.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(result);
    return acc;
  }, {} as Record<ErrorType, typeof results>);

  return {
    results,
    grouped,
    summary: {
      total: errors.length,
      byType: Object.entries(grouped).map(([type, items]) => ({
        type: type as ErrorType,
        count: items.length,
        canRetry: items[0]?.retryInfo.canRetry || false
      }))
    }
  };
}

/**
 * 函数级中文注释：错误恢复建议生成器
 */
export function generateRecoverySuggestions(errorType: ErrorType): string[] {
  const suggestions: Record<string, string[]> = {
    [ErrorType.NETWORK]: [
      '检查网络连接是否正常',
      '尝试刷新页面',
      '稍后重试操作'
    ],
    [ErrorType.BALANCE]: [
      '查看账户余额信息',
      '进行充值操作',
      '联系财务人员'
    ],
    [ErrorType.AUTHORIZATION]: [
      '确认账户权限设置',
      '联系管理员授权',
      '切换到有权限的账户'
    ],
    [ErrorType.VALIDATION]: [
      '检查输入信息的格式',
      '确认必填项已填写',
      '参考帮助文档'
    ],
    [ErrorType.TIMEOUT]: [
      '等待片刻后重试',
      '检查网络状况',
      '减少并发操作'
    ],
    [ErrorType.UNKNOWN]: [
      '刷新页面重试',
      '清除浏览器缓存',
      '联系技术支持'
    ]
  };

  return suggestions[String(errorType)] || [];
}
