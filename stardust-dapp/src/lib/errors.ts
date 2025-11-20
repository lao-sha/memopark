/**
 * 函数级详细中文注释：错误信息映射工具
 * - 从链上返回的错误对象/字符串中提取 pallet 错误枚举名，映射为中文提示。
 * - 适度通用化：仅基于字符串包含匹配，避免强依赖元数据结构。
 */
export function mapDispatchErrorMessage(err: unknown, fallback = '提交失败'): string {
  try {
    const raw = (err as any)?.message ? String((err as any).message) : String(err ?? '')
    const m: Record<string, string> = {
      // deceased 亲友团
      NotAuthorized: '无权限操作（仅管理员/owner 可执行）',
      DeceasedNotFound: '逝者不存在',
      FriendAlreadyMember: '已是亲友成员',
      FriendNotMember: '该账户不是亲友成员',
      FriendPendingExists: '已存在待审批申请',
      FriendNoPending: '未找到待审批申请',
      FriendTooMany: '成员数量达到上限',
      BadInput: '输入不合法（长度/数量越界）',
      NotApplied: '无可退款余额或已领取',
      NotFound: '目标不存在',
      PolicyViolation: '策略不允许或功能已停用',
      DepositFailed: '押金相关操作失败',
      FeePaymentFailed: '创建费扣款失败（余额不足或存在性余额保护）',
      SlugExists: '人类可读ID冲突，请稍后重试',
      InvalidSlug: '人类可读ID非法',
      NotAdmin: '无权限（仅墓主或园区管理员可操作）',
      NotOwner: '无权限（仅墓主可操作）',
      CapacityExceeded: '容量已达上限',
      // deceased 相关
      DeceasedTokenExists: '同信息已存在，请调整徽标或日期',
    }
    for (const k of Object.keys(m)) {
      if (raw.includes(k)) return m[k]
    }
    // 常见 RPC 断开/网络错误
    if (/Disconnect|Network|ECONN|EHOST|timeout/i.test(raw)) return '网络异常，请稍后重试'
    return raw || fallback
  } catch {
    return fallback
  }
}


