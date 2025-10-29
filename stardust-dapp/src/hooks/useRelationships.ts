import { useState, useEffect, useCallback } from 'react'
import { getApi } from '../lib/polkadot-safe'

/**
 * 函数级详细中文注释：家族关系查询Hook
 * 
 * ### 功能
 * - 查询某个逝者的所有家族关系
 * - 递归查询多层关系（支持家族图谱）
 * - 缓存已查询的关系，避免重复请求
 * 
 * ### 关系类型
 * - 0 = ParentOf（有向）：A是B的父母
 * - 1 = SpouseOf（无向）：A和B是配偶
 * - 2 = SiblingOf（无向）：A和B是兄弟姐妹
 * - 3 = ChildOf（有向）：A是B的子女
 * 
 * ### 设计理念
 * - **性能优化**：批量查询、缓存机制
 * - **递归控制**：限制最大深度，避免死循环
 * - **错误处理**：优雅降级，不影响主流程
 */

export interface Relationship {
  from: number
  to: number
  kind: number
  kindLabel: string
  note?: string
  createdAt?: number
}

export interface DeceasedNode {
  id: number
  name?: string
  gender?: string
  birth?: string
  death?: string
  mainImageCid?: string
  owner?: string
}

export interface RelationshipGraphData {
  nodes: DeceasedNode[]
  edges: Relationship[]
}

/**
 * 函数级详细中文注释：获取关系类型标签
 */
export function getRelationLabel(kind: number): string {
  switch (kind) {
    case 0: return '父母'
    case 1: return '配偶'
    case 2: return '兄弟姐妹'
    case 3: return '子女'
    default: return '未知关系'
  }
}

/**
 * 函数级详细中文注释：判断是否为无向关系
 */
function isUndirectedKind(kind: number): boolean {
  return kind === 1 || kind === 2 // SpouseOf, SiblingOf
}

/**
 * 函数级详细中文注释：查询单个逝者的关系Hook
 * 
 * @param deceasedId 逝者ID
 * @returns 关系列表、加载状态、错误信息
 */
export function useRelationships(deceasedId: number | null) {
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (deceasedId == null) {
      setRelationships([])
      return
    }

    let mounted = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const api = await getApi()
        
        // 查询 RelationsByDeceased 获取所有关系索引
        const relationsAny: any = await api.query.deceased.relationsByDeceased(deceasedId)
        const relationList: Array<[number, number]> = relationsAny.toJSON() || []
        
        if (!mounted) return
        
        if (relationList.length === 0) {
          setRelationships([])
          setLoading(false)
          return
        }
        
        // 批量查询关系详情
        const relationships: Relationship[] = []
        
        for (const [peerId, kind] of relationList) {
          try {
            // 尝试查询 Relations(deceasedId, peerId)
            let detail: any = await api.query.deceased.relations(deceasedId, peerId)
            
            if (!detail || !detail.isSome) {
              // 如果无向关系，尝试反向查询
              if (isUndirectedKind(kind)) {
                detail = await api.query.deceased.relations(peerId, deceasedId)
              }
            }
            
            if (detail && detail.isSome) {
              const d = detail.unwrap()
              const json: any = d.toJSON()
              
              relationships.push({
                from: deceasedId,
                to: peerId,
                kind,
                kindLabel: getRelationLabel(kind),
                note: json.note ? new TextDecoder().decode(new Uint8Array(json.note)) : undefined,
                createdAt: json.createdAt,
              })
            } else {
              // 如果查询不到详情，至少保存基本信息
              relationships.push({
                from: deceasedId,
                to: peerId,
                kind,
                kindLabel: getRelationLabel(kind),
              })
            }
          } catch (e) {
            console.warn(`查询关系详情失败 (${deceasedId} -> ${peerId}):`, e)
          }
        }
        
        if (!mounted) return
        setRelationships(relationships)
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || '加载关系失败')
        console.error('加载关系失败:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    
    load()
    return () => { mounted = false }
  }, [deceasedId])

  return { relationships, loading, error }
}

/**
 * 函数级详细中文注释：递归查询家族图谱Hook
 * 
 * @param rootDeceasedId 根节点逝者ID
 * @param maxDepth 最大递归深度（默认3层）
 * @returns 图谱数据、加载状态、错误信息
 */
export function useRelationshipGraph(rootDeceasedId: number | null, maxDepth: number = 3) {
  const [graphData, setGraphData] = useState<RelationshipGraphData>({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const loadGraph = useCallback(async (rootId: number, depth: number) => {
    setLoading(true)
    setError('')
    
    try {
      const api = await getApi()
      const visited = new Set<number>()
      const nodes: DeceasedNode[] = []
      const edges: Relationship[] = []
      
      // 递归查询函数
      const queryRecursive = async (deceasedId: number, currentDepth: number) => {
        if (visited.has(deceasedId) || currentDepth > depth) {
          return
        }
        
        visited.add(deceasedId)
        
        // 查询逝者详情
        try {
          const detailAny: any = await api.query.deceased.deceasedOf(deceasedId)
          if (detailAny && detailAny.isSome) {
            const d = detailAny.unwrap()
            const json: any = d.toJSON()
            
            const toStringFromAny = (x: any): string | undefined => {
              try {
                if (!x) return undefined
                if (x.toU8a) return new TextDecoder().decode(x.toU8a())
                if (x.isSome && x.unwrap) return new TextDecoder().decode(x.unwrap().toU8a ? x.unwrap().toU8a() : new Uint8Array([]))
                if (x.toJSON) {
                  const u8 = new Uint8Array(x.toJSON())
                  return new TextDecoder().decode(u8)
                }
                return String(x)
              } catch { return undefined }
            }
            
            const name = toStringFromAny(d.name)
            const genderEnum = String(json.gender || '').toUpperCase()
            const gender = /M/.test(genderEnum) ? '男' : /F/.test(genderEnum) ? '女' : '保密'
            const birth = toStringFromAny(d.birthTs || d.birth_ts)
            const death = toStringFromAny(d.deathTs || d.death_ts)
            const mainImageCid = toStringFromAny(d.mainImageCid || d.main_image_cid)
            const owner = d.owner?.toString?.() || String(d.owner || '')
            
            nodes.push({
              id: deceasedId,
              name,
              gender,
              birth,
              death,
              mainImageCid,
              owner,
            })
          }
        } catch (e) {
          console.warn(`查询逝者详情失败 (${deceasedId}):`, e)
          // 即使查询失败，也添加基本节点
          nodes.push({ id: deceasedId })
        }
        
        // 查询关系
        try {
          const relationsAny: any = await api.query.deceased.relationsByDeceased(deceasedId)
          const relationList: Array<[number, number]> = relationsAny.toJSON() || []
          
          // 递归查询每个关联的逝者
          for (const [peerId, kind] of relationList) {
            edges.push({
              from: deceasedId,
              to: peerId,
              kind,
              kindLabel: getRelationLabel(kind),
            })
            
            // 递归查询下一层
            if (currentDepth < depth) {
              await queryRecursive(peerId, currentDepth + 1)
            }
          }
        } catch (e) {
          console.warn(`查询关系失败 (${deceasedId}):`, e)
        }
      }
      
      // 从根节点开始递归查询
      await queryRecursive(rootId, 0)
      
      setGraphData({ nodes, edges })
    } catch (e: any) {
      setError(e?.message || '加载家族图谱失败')
      console.error('加载家族图谱失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (rootDeceasedId != null) {
      loadGraph(rootDeceasedId, maxDepth)
    } else {
      setGraphData({ nodes: [], edges: [] })
    }
  }, [rootDeceasedId, maxDepth, loadGraph])

  return { graphData, loading, error, reload: () => rootDeceasedId != null && loadGraph(rootDeceasedId, maxDepth) }
}

/**
 * 函数级详细中文注释：查询逝者详情Hook
 * 
 * @param deceasedId 逝者ID
 * @returns 逝者详情、加载状态
 */
export function useDeceasedDetail(deceasedId: number | null) {
  const [deceased, setDeceased] = useState<DeceasedNode | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (deceasedId == null) {
      setDeceased(null)
      return
    }

    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const api = await getApi()
        const detailAny: any = await api.query.deceased.deceasedOf(deceasedId)
        
        if (!mounted) return
        
        if (detailAny && detailAny.isSome) {
          const d = detailAny.unwrap()
          const json: any = d.toJSON()
          
          const toStringFromAny = (x: any): string | undefined => {
            try {
              if (!x) return undefined
              if (x.toU8a) return new TextDecoder().decode(x.toU8a())
              if (x.isSome && x.unwrap) return new TextDecoder().decode(x.unwrap().toU8a ? x.unwrap().toU8a() : new Uint8Array([]))
              if (x.toJSON) {
                const u8 = new Uint8Array(x.toJSON())
                return new TextDecoder().decode(u8)
              }
              return String(x)
            } catch { return undefined }
          }
          
          const name = toStringFromAny(d.name)
          const genderEnum = String(json.gender || '').toUpperCase()
          const gender = /M/.test(genderEnum) ? '男' : /F/.test(genderEnum) ? '女' : '保密'
          const birth = toStringFromAny(d.birthTs || d.birth_ts)
          const death = toStringFromAny(d.deathTs || d.death_ts)
          const mainImageCid = toStringFromAny(d.mainImageCid || d.main_image_cid)
          const owner = d.owner?.toString?.() || String(d.owner || '')
          
          setDeceased({
            id: deceasedId,
            name,
            gender,
            birth,
            death,
            mainImageCid,
            owner,
          })
        } else {
          setDeceased(null)
        }
      } catch (e) {
        if (!mounted) return
        console.error('查询逝者详情失败:', e)
        setDeceased(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    
    load()
    return () => { mounted = false }
  }, [deceasedId])

  return { deceased, loading }
}

