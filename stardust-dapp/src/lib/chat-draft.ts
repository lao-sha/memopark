/**
 * 函数级详细中文注释：消息草稿管理
 * - 自动保存输入中的文本
 * - 切换会话时恢复草稿
 * - 发送后自动清除
 * - 超过24小时自动过期
 */

const DRAFT_KEY_PREFIX = 'stardust_chat_draft_';

/**
 * 草稿数据结构
 */
interface Draft {
  text: string;
  savedAt: number;
}

/**
 * 函数级详细中文注释：保存草稿
 * - 空草稿自动删除
 * - 非空草稿保存到localStorage
 */
export function saveDraft(sessionId: string, text: string): void {
  try {
    if (!text.trim()) {
      // 空草稿，删除
      localStorage.removeItem(`${DRAFT_KEY_PREFIX}${sessionId}`);
      return;
    }
    
    const draft: Draft = {
      text,
      savedAt: Date.now(),
    };
    
    localStorage.setItem(
      `${DRAFT_KEY_PREFIX}${sessionId}`,
      JSON.stringify(draft)
    );
  } catch (error) {
    console.error('保存草稿失败:', error);
  }
}

/**
 * 函数级详细中文注释：读取草稿
 * - 自动清理过期草稿（24小时）
 * - 返回草稿文本或空字符串
 */
export function loadDraft(sessionId: string): string {
  try {
    const draftStr = localStorage.getItem(`${DRAFT_KEY_PREFIX}${sessionId}`);
    if (!draftStr) return '';
    
    const draft: Draft = JSON.parse(draftStr);
    
    // 超过24小时的草稿，自动清除
    const elapsed = Date.now() - draft.savedAt;
    if (elapsed > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(`${DRAFT_KEY_PREFIX}${sessionId}`);
      return '';
    }
    
    return draft.text || '';
  } catch (error) {
    console.error('读取草稿失败:', error);
    return '';
  }
}

/**
 * 函数级详细中文注释：清除草稿
 * - 消息发送后调用
 */
export function clearDraft(sessionId: string): void {
  try {
    localStorage.removeItem(`${DRAFT_KEY_PREFIX}${sessionId}`);
  } catch (error) {
    console.error('清除草稿失败:', error);
  }
}

/**
 * 函数级详细中文注释：获取所有草稿
 * - 用于统计或清理
 */
export function getAllDrafts(): { sessionId: string; draft: Draft }[] {
  try {
    const drafts: { sessionId: string; draft: Draft }[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DRAFT_KEY_PREFIX)) {
        const sessionId = key.replace(DRAFT_KEY_PREFIX, '');
        const draftStr = localStorage.getItem(key);
        if (draftStr) {
          try {
            const draft: Draft = JSON.parse(draftStr);
            drafts.push({ sessionId, draft });
          } catch {}
        }
      }
    }
    
    return drafts;
  } catch (error) {
    console.error('获取所有草稿失败:', error);
    return [];
  }
}

/**
 * 函数级详细中文注释：清理所有过期草稿
 * - 删除24小时前的草稿
 */
export function cleanupExpiredDrafts(): number {
  try {
    const drafts = getAllDrafts();
    let deletedCount = 0;
    
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    
    drafts.forEach(({ sessionId, draft }) => {
      if (draft.savedAt < cutoff) {
        localStorage.removeItem(`${DRAFT_KEY_PREFIX}${sessionId}`);
        deletedCount++;
      }
    });
    
    return deletedCount;
  } catch (error) {
    console.error('清理过期草稿失败:', error);
    return 0;
  }
}

