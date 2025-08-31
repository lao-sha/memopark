/**
 * 函数级详细中文注释：Subsquid GraphQL 客户端
 * - 前端操作方法：
 *   1) 在 Settings 或 .env 中配置 VITE_SQUID_URL
 *   2) 通过 query() 传入 GraphQL 文本与变量，返回 JSON 数据
 */
export const GQL = {
  endpoint: (import.meta as any)?.env?.VITE_SQUID_URL || 'https://squid.example.com/graphql',
}

export async function query<T = any>(gql: string, variables?: Record<string, any>): Promise<T> {
  const res = await fetch(GQL.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: gql, variables }),
  })
  const data = await res.json()
  if (!res.ok || data.errors) throw new Error(data.errors?.[0]?.message || 'GraphQL 查询失败')
  return data.data as T
}


