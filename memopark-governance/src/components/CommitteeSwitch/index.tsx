import { Segmented, Space } from 'antd'
import {
  TeamOutlined,
  CodeOutlined,
  SafetyOutlined
} from '@ant-design/icons'
import { COMMITTEES, type CommitteeType } from '@/types/committee'

/**
 * 委员会切换器组件
 * 用于在不同委员会之间切换
 */
interface Props {
  value: CommitteeType
  onChange: (type: CommitteeType) => void
  size?: 'large' | 'middle' | 'small'
}

/**
 * 根据图标名称获取图标组件
 */
function getIcon(iconName: string) {
  const icons: Record<string, any> = {
    TeamOutlined: <TeamOutlined />,
    CodeOutlined: <CodeOutlined />,
    SafetyOutlined: <SafetyOutlined />
  }
  return icons[iconName] || <TeamOutlined />
}

export default function CommitteeSwitch({ value, onChange, size = 'large' }: Props) {
  return (
    <Segmented
      value={value}
      onChange={onChange}
      size={size}
      options={COMMITTEES.map((c) => ({
        label: (
          <Space>
            {getIcon(c.iconName)}
            <span>{c.name}</span>
          </Space>
        ),
        value: c.key
      }))}
      block
    />
  )
}

