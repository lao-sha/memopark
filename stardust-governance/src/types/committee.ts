import type { ReactNode } from 'react'

/**
 * 委员会类型枚举
 */
export type CommitteeType = 
  | 'council'              // 主委员会
  | 'technicalCommittee'   // 技术委员会  
  | 'contentCommittee'     // 内容委员会

/**
 * 委员会配置接口
 */
export interface CommitteeConfig {
  key: CommitteeType
  name: string
  nameEn: string
  iconName: string
  palletName: string
  description: string
  color: string
  defaultThreshold: number
  responsibilities: string[]
}

/**
 * 委员会配置列表
 */
export const COMMITTEES: CommitteeConfig[] = [
  {
    key: 'council',
    name: '主委员会',
    nameEn: 'Council',
    iconName: 'TeamOutlined',
    palletName: 'council',
    description: '负责整体治理决策、做市商审批、财库管理等核心事务',
    color: '#1890ff',
    defaultThreshold: 2,
    responsibilities: [
      '做市商申请审批',
      '财库支出审批',
      '系统参数调整',
      '紧急提案处理'
    ]
  },
  {
    key: 'technicalCommittee',
    name: '技术委员会',
    nameEn: 'Technical Committee',
    iconName: 'CodeOutlined',
    palletName: 'technicalCommittee',
    description: '负责技术升级、代码审查、链参数调整、紧急修复等技术事务',
    color: '#722ed1',
    defaultThreshold: 2,
    responsibilities: [
      'Runtime升级审批',
      '紧急技术修复',
      '链参数调整',
      '代码审查'
    ]
  },
  {
    key: 'contentCommittee',
    name: '内容委员会',
    nameEn: 'Content Committee',
    iconName: 'SafetyOutlined',
    palletName: 'contentCommittee',
    description: '负责内容审核、申诉处理、违规处理、社区管理等内容事务',
    color: '#fa8c16',
    defaultThreshold: 2,
    responsibilities: [
      '内容申诉审批',
      '违规内容处理',
      '用户举报处理',
      '社区规范执行'
    ]
  }
]

/**
 * 获取委员会图标组件
 */
export function getCommitteeIcon(_iconName: string): ReactNode {
  // 这个函数将在使用时导入实际图标
  return null
}

/**
 * 根据key获取委员会配置
 */
export function getCommitteeConfig(key: CommitteeType): CommitteeConfig {
  const config = COMMITTEES.find(c => c.key === key)
  if (!config) {
    throw new Error(`Unknown committee type: ${key}`)
  }
  return config
}

/**
 * 根据pallet名称获取委员会配置
 */
export function getCommitteeConfigByPallet(palletName: string): CommitteeConfig | null {
  return COMMITTEES.find(c => c.palletName === palletName) || null
}

/**
 * 检查委员会是否可用
 */
export function isCommitteeAvailable(api: any, type: CommitteeType): boolean {
  const config = getCommitteeConfig(type)
  return !!(api.query as any)[config.palletName]
}

/**
 * 获取所有可用的委员会
 */
export function getAvailableCommittees(api: any): CommitteeConfig[] {
  return COMMITTEES.filter(c => isCommitteeAvailable(api, c.key))
}

