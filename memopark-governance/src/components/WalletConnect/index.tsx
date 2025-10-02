import { Button } from 'antd'
import { WalletOutlined } from '@ant-design/icons'
import { useWallet } from '@/contexts/Wallet'

/**
 * 钱包连接按钮组件
 */
export default function WalletConnect() {
  const { isConnected, connectWallet } = useWallet()

  if (isConnected) {
    return null // 已连接时不显示按钮
  }

  return (
    <Button
      type="primary"
      icon={<WalletOutlined />}
      onClick={connectWallet}
    >
      连接钱包
    </Button>
  )
}

