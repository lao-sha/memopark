/**
 * 🆕 2025-10-22：聊天消息验证工具
 * 
 * 功能：
 * - 校验做市商发送的姓名与链上脱敏姓名是否一致
 * - 防止做市商发送错误或伪造的收款信息
 * - 提取聊天消息中的收款信息
 */

/**
 * 姓名脱敏函数（与链端算法保持一致）
 * 
 * 规则：
 * - 0字：返回空字符串
 * - 1字：返回单个星号 "×"
 * - 2字：前面×，保留后面，示例："张三" -> "×三"
 * - 3字：前后保留，中间×，示例："李四五" -> "李×五"
 * - 4字及以上：前1后1，中间1个×，示例："王二麻子" -> "王×子"
 */
export function maskName(fullName: string): string {
  if (!fullName) return '';
  
  const chars = Array.from(fullName); // 支持Unicode字符
  const len = chars.length;
  
  if (len === 0) return '';
  if (len === 1) return '×';
  if (len === 2) return `×${chars[1]}`;
  if (len === 3) return `${chars[0]}×${chars[2]}`;
  
  // 4字及以上
  return `${chars[0]}×${chars[len - 1]}`;
}

/**
 * 身份证号脱敏函数（与链端算法保持一致）
 */
export function maskIdCard(idCard: string): string {
  if (!idCard) return '';
  
  const len = idCard.length;
  
  if (len < 8) {
    return '*'.repeat(len);
  }
  
  const front = idCard.substring(0, 4);
  const back = idCard.substring(len - 4);
  const middle = '*'.repeat(len - 8);
  
  return `${front}${middle}${back}`;
}

/**
 * 银行卡号脱敏函数
 */
export function maskBankCard(cardNumber: string): string {
  if (!cardNumber) return '';
  
  // 移除空格和分隔符
  const cleanNumber = cardNumber.replace(/[\s-]/g, '');
  
  if (cleanNumber.length < 8) {
    return '*'.repeat(cleanNumber.length);
  }
  
  const front = cleanNumber.substring(0, 4);
  const back = cleanNumber.substring(cleanNumber.length - 4);
  
  return `${front}****${back}`;
}

/**
 * 手机号脱敏函数
 */
export function maskPhone(phone: string): string {
  if (!phone) return '';
  
  const cleanPhone = phone.replace(/[\s-]/g, '');
  
  if (cleanPhone.length !== 11) {
    return phone; // 非标准手机号，不脱敏
  }
  
  return `${cleanPhone.substring(0, 3)}****${cleanPhone.substring(7)}`;
}

/**
 * USDT地址脱敏函数
 */
export function maskUsdtAddress(address: string): string {
  if (!address) return '';
  
  if (address.length < 10) {
    return address;
  }
  
  const front = address.substring(0, 6);
  const back = address.substring(address.length - 4);
  
  return `${front}****${back}`;
}

/**
 * 校验结果接口
 */
export interface ValidationResult {
  /** 是否验证通过 */
  isValid: boolean;
  /** 警告信息（如果验证失败） */
  warning?: string;
  /** 提取的完整姓名 */
  extractedName?: string;
}

/**
 * 🆕 核心功能：校验收款人姓名是否与链上脱敏姓名一致
 * 
 * @param fullName - 完整姓名（从聊天消息中提取）
 * @param maskedName - 链上脱敏姓名
 * @returns 校验结果
 */
export function validateRecipientName(
  fullName: string,
  maskedName: string
): ValidationResult {
  if (!fullName || !maskedName) {
    return {
      isValid: false,
      warning: '姓名不能为空',
    };
  }
  
  // 1. 对完整姓名进行脱敏
  const computedMasked = maskName(fullName);
  
  // 2. 与链上脱敏姓名对比
  if (computedMasked === maskedName) {
    return {
      isValid: true,
      extractedName: fullName,
    };
  }
  
  // 3. 不匹配，返回警告
  return {
    isValid: false,
    warning: `⚠️ 警告：做市商发送的姓名"${fullName}"与链上注册姓名"${maskedName}"不符！\n\n这可能存在诈骗风险，请谨慎操作。如有疑问，请联系客服。`,
    extractedName: fullName,
  };
}

/**
 * 收款信息接口
 */
export interface PaymentInfo {
  /** 完整姓名 */
  fullName?: string;
  /** 银行卡号 */
  bankCard?: string;
  /** 开户行 */
  bankName?: string;
  /** 支付宝账号 */
  alipay?: string;
  /** 微信账号 */
  wechat?: string;
  /** USDT地址 */
  usdtAddress?: string;
}

/**
 * 从聊天消息中提取收款信息
 * 
 * 支持的格式：
 * - 银行卡：6214850212345678
 * - 户名：李四五
 * - 开户行：中国银行杭州分行
 * 
 * @param messageText - 聊天消息文本
 * @returns 提取的收款信息
 */
export function extractPaymentInfo(messageText: string): PaymentInfo {
  const info: PaymentInfo = {};
  
  if (!messageText) return info;
  
  // 1. 提取姓名（户名、收款人、姓名等关键词）
  const namePatterns = [
    /(?:户名|收款人|姓名)[：:]\s*([^\n\r，,。.]+)/,
    /(?:名字|真实姓名)[：:]\s*([^\n\r，,。.]+)/,
  ];
  
  for (const pattern of namePatterns) {
    const match = messageText.match(pattern);
    if (match && match[1]) {
      info.fullName = match[1].trim();
      break;
    }
  }
  
  // 2. 提取银行卡号（16-19位数字）
  const bankCardPattern = /(?:银行卡|卡号)[：:]\s*([0-9\s]{16,23})/;
  const bankCardMatch = messageText.match(bankCardPattern);
  if (bankCardMatch && bankCardMatch[1]) {
    info.bankCard = bankCardMatch[1].replace(/\s/g, '');
  }
  
  // 3. 提取开户行
  const bankNamePattern = /(?:开户行|银行)[：:]\s*([^\n\r]+)/;
  const bankNameMatch = messageText.match(bankNamePattern);
  if (bankNameMatch && bankNameMatch[1]) {
    info.bankName = bankNameMatch[1].trim();
  }
  
  // 4. 提取支付宝账号（手机号或邮箱）
  const alipayPattern = /(?:支付宝|alipay)[：:]\s*([^\n\r]+)/i;
  const alipayMatch = messageText.match(alipayPattern);
  if (alipayMatch && alipayMatch[1]) {
    info.alipay = alipayMatch[1].trim();
  }
  
  // 5. 提取微信账号
  const wechatPattern = /(?:微信|wechat)[：:]\s*([^\n\r]+)/i;
  const wechatMatch = messageText.match(wechatPattern);
  if (wechatMatch && wechatMatch[1]) {
    info.wechat = wechatMatch[1].trim();
  }
  
  // 6. 提取USDT地址（T开头的34字符）
  const usdtPattern = /(?:USDT|usdt|TRC20|trc20)[：:]\s*(T[A-Za-z0-9]{33})/;
  const usdtMatch = messageText.match(usdtPattern);
  if (usdtMatch && usdtMatch[1]) {
    info.usdtAddress = usdtMatch[1];
  }
  
  return info;
}

/**
 * 生成收款信息模板
 * 
 * 用于做市商快速填充收款信息
 * 
 * @param makerInfo - 做市商信息（从链上查询）
 * @returns 收款信息模板文本
 */
export function generatePaymentTemplate(makerInfo: {
  fullName: string;
  bankCard?: string;
  bankName?: string;
  alipay?: string;
}): string {
  const lines: string[] = [];
  
  lines.push('📋 收款信息：');
  lines.push('');
  
  if (makerInfo.bankCard) {
    lines.push(`银行卡：${makerInfo.bankCard}`);
    lines.push(`户名：${makerInfo.fullName}`);
    if (makerInfo.bankName) {
      lines.push(`开户行：${makerInfo.bankName}`);
    }
  }
  
  if (makerInfo.alipay) {
    lines.push('');
    lines.push(`支付宝：${makerInfo.alipay}`);
    lines.push(`姓名：${makerInfo.fullName}`);
  }
  
  lines.push('');
  lines.push('💡 请转账后发送转账凭证，我会及时确认并释放MEMO。');
  lines.push('⚠️ 转账时请务必核对收款人姓名。');
  
  return lines.join('\n');
}

