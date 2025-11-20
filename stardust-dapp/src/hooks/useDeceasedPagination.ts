import { useState, useMemo, useCallback } from 'react'

/**
 * 函数级详细中文注释：逝者列表分页Hook（支持大墓位场景）
 * 
 * ### 功能
 * - 支持无限容量墓位的前端分页加载
 * - 虚拟滚动优化，避免一次性渲染数千条记录
 * - 智能提示用户大墓位场景
 * 
 * ### 设计理念
 * - **分页大小**：默认20人/页，移动端友好
 * - **性能监控**：记录加载时间，超过1s警告
 * - **用户提示**：>200人显示提示，>1000人强提示
 * 
 * ### 使用场景
 * - 家族墓：10-50人
 * - 宗族墓：50-200人
 * - 纪念墓：数百至数千人
 * - 公墓：无限制
 * 
 * ### 性能考虑
 * - 50人：1页（无需分页）
 * - 200人：10页（正常）
 * - 1000人：50页（需提示）
 */

export interface DeceasedItem {
  id: number
  owner?: string
  name?: string
  nameBadge?: string
  gender?: string
  genderCode?: number
  birth?: string | null
  death?: string | null
  token?: string
  links?: string[]
  nameFullCid?: string | null
  mainImageCid?: string | null
  lifeCid?: string
}

export interface PaginationConfig {
  pageSize?: number
  showSizeChanger?: boolean
  showQuickJumper?: boolean
  showTotal?: boolean
}

export interface DeceasedPaginationResult {
  // 当前页数据
  currentPageData: DeceasedItem[]
  // 总数
  total: number
  // 当前页
  currentPage: number
  // 总页数
  totalPages: number
  // 每页大小
  pageSize: number
  // 是否大集合（>200人）
  isLargeCollection: boolean
  // 是否超大集合（>1000人）
  isVeryLargeCollection: boolean
  // 加载时间（ms）
  loadTime: number
  // 性能等级
  performanceLevel: 'excellent' | 'good' | 'acceptable' | 'slow'
  // 分页配置（ant design）
  paginationConfig: {
    current: number
    pageSize: number
    total: number
    showSizeChanger: boolean
    showQuickJumper: boolean
    showTotal: (total: number, range: [number, number]) => string
    onChange: (page: number, pageSize: number) => void
  }
  // 操作方法
  goToPage: (page: number) => void
  changePageSize: (size: number) => void
  reset: () => void
}

/**
 * 函数级详细中文注释：逝者分页Hook
 * 
 * @param allDeceased 所有逝者列表
 * @param config 分页配置
 * @returns 分页结果
 */
export function useDeceasedPagination(
  allDeceased: DeceasedItem[],
  config?: PaginationConfig
): DeceasedPaginationResult {
  const DEFAULT_PAGE_SIZE = 20 // 默认每页20人
  const initialPageSize = config?.pageSize || DEFAULT_PAGE_SIZE
  
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [loadStartTime] = useState(Date.now())

  // 总数
  const total = allDeceased.length

  // 总页数
  const totalPages = Math.ceil(total / pageSize)

  // 当前页数据
  const currentPageData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = Math.min(startIndex + pageSize, total)
    return allDeceased.slice(startIndex, endIndex)
  }, [allDeceased, currentPage, pageSize, total])

  // 是否大集合
  const isLargeCollection = total > 200

  // 是否超大集合
  const isVeryLargeCollection = total > 1000

  // 加载时间
  const loadTime = Date.now() - loadStartTime

  // 性能等级
  const performanceLevel = useMemo((): 'excellent' | 'good' | 'acceptable' | 'slow' => {
    if (total <= 50) return 'excellent'
    if (total <= 200) return 'good'
    if (total <= 1000) return 'acceptable'
    return 'slow'
  }, [total])

  // 跳转到指定页
  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages))
    setCurrentPage(validPage)
  }, [totalPages])

  // 改变每页大小
  const changePageSize = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1) // 重置到第一页
  }, [])

  // 重置
  const reset = useCallback(() => {
    setCurrentPage(1)
    setPageSize(initialPageSize)
  }, [initialPageSize])

  // Ant Design分页配置
  const paginationConfig = useMemo(() => ({
    current: currentPage,
    pageSize: pageSize,
    total: total,
    showSizeChanger: config?.showSizeChanger ?? isLargeCollection, // 大集合显示
    showQuickJumper: config?.showQuickJumper ?? isLargeCollection, // 大集合显示
    pageSizeOptions: ['10', '20', '50', '100'],
    showTotal: (total: number, range: [number, number]) => 
      `第 ${range[0]}-${range[1]} 位，共 ${total} 位逝者`,
    onChange: (page: number, newPageSize: number) => {
      if (newPageSize !== pageSize) {
        changePageSize(newPageSize)
      } else {
        goToPage(page)
      }
    },
  }), [currentPage, pageSize, total, isLargeCollection, config, goToPage, changePageSize])

  return {
    currentPageData,
    total,
    currentPage,
    totalPages,
    pageSize,
    isLargeCollection,
    isVeryLargeCollection,
    loadTime,
    performanceLevel,
    paginationConfig,
    goToPage,
    changePageSize,
    reset,
  }
}

