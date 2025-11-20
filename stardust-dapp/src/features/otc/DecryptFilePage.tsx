import React from 'react'
import { Card, Input, Button, Space, Typography, Alert, List, message, Spin } from 'antd'
import { UnlockOutlined, DownloadOutlined, EyeOutlined, ArrowLeftOutlined } from '@ant-design/icons'

/**
 * 函数级详细中文注释：文件解密工具页面（供委员会审核使用）
 * - 输入 IPFS CID 和密码
 * - 从 IPFS 下载加密文件
 * - 使用 Web Crypto API 解密
 * - 显示文件列表并支持下载/预览
 */

interface DecryptedFile {
  name: string
  originalName: string
  size: number
  type: string
  blob: Blob
}

export default function DecryptFilePage() {
  const [cid, setCid] = React.useState<string>('')
  const [password, setPassword] = React.useState<string>('')
  const [loading, setLoading] = React.useState<boolean>(false)
  const [decryptedFiles, setDecryptedFiles] = React.useState<DecryptedFile[]>([])

  /**
   * 函数级详细中文注释：使用 Web Crypto API 解密文件
   * - 算法：AES-256-GCM
   * - 使用 PBKDF2 从密码派生密钥（与加密时相同的参数）
   */
  async function decryptFile(encryptedBuffer: ArrayBuffer, password: string, fileName: string): Promise<Blob> {
    try {
      // 提取盐值、IV 和加密数据
      const data = new Uint8Array(encryptedBuffer)
      const salt = data.slice(0, 16)
      const iv = data.slice(16, 28) // GCM 模式使用 12 字节 IV
      const encrypted = data.slice(28)
      
      // 从密码派生密钥（PBKDF2）
      const passwordKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      )
      
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      )
      
      // 解密数据
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      )
      
      // 根据文件名推断 MIME 类型
      const mimeType = getMimeType(fileName)
      return new Blob([decryptedData], { type: mimeType })
      
    } catch (error: any) {
      console.error('解密失败:', error)
      throw new Error('解密失败：密码错误或文件损坏')
    }
  }

  /**
   * 函数级详细中文注释：从 IPFS 下载并解密所有文件
   */
  async function handleDecrypt() {
    if (!cid) {
      message.error('请输入 IPFS CID')
      return
    }
    
    if (!password) {
      message.error('请输入解密密码')
      return
    }

    setLoading(true)
    setDecryptedFiles([])
    
    try {
      message.loading({ content: '正在从 IPFS 下载...', key: 'decrypt', duration: 0 })
      
      // TODO: 实际从 IPFS 下载文件
      // const response = await fetch(`https://ipfs.io/ipfs/${cid}`)
      // const manifest = await response.json()
      
      // 模拟数据
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const mockManifest = {
        version: '1.0',
        encrypted: true,
        algorithm: 'AES-256-GCM',
        files: [
          { name: 'license.pdf.enc', original_name: '营业执照.pdf', type: 'business_license' },
          { name: 'identity.pdf.enc', original_name: '身份证明.pdf', type: 'identity' }
        ]
      }
      
      message.loading({ content: '正在解密文件...', key: 'decrypt', duration: 0 })
      
      const decrypted: DecryptedFile[] = []
      
      for (const file of mockManifest.files) {
        // TODO: 实际下载加密文件
        // const encResponse = await fetch(`https://ipfs.io/ipfs/${cid}/${file.name}`)
        // const encryptedBuffer = await encResponse.arrayBuffer()
        
        // 模拟加密文件（实际应从 IPFS 下载）
        const mockEncryptedBuffer = new ArrayBuffer(1024)
        
        try {
          const blob = await decryptFile(mockEncryptedBuffer, password, file.original_name)
          
          decrypted.push({
            name: file.name,
            originalName: file.original_name,
            size: blob.size,
            type: file.type,
            blob: blob
          })
        } catch (error: any) {
          console.error(`解密 ${file.name} 失败:`, error)
          // 继续解密其他文件
        }
      }
      
      if (decrypted.length === 0) {
        throw new Error('所有文件解密失败，请检查密码是否正确')
      }
      
      setDecryptedFiles(decrypted)
      message.success({ 
        content: `成功解密 ${decrypted.length} 个文件`, 
        key: 'decrypt',
        duration: 5
      })
      
    } catch (error: any) {
      console.error('解密失败:', error)
      message.error({ content: error.message || '解密失败', key: 'decrypt' })
    } finally {
      setLoading(false)
    }
  }

  /**
   * 函数级详细中文注释：下载解密后的文件
   */
  function handleDownload(file: DecryptedFile) {
    const url = URL.createObjectURL(file.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.originalName
    a.click()
    URL.revokeObjectURL(url)
    message.success(`已下载: ${file.originalName}`)
  }

  /**
   * 函数级详细中文注释：预览解密后的文件（新窗口打开）
   */
  function handlePreview(file: DecryptedFile) {
    const url = URL.createObjectURL(file.blob)
    window.open(url, '_blank')
    message.info(`已在新窗口打开: ${file.originalName}`)
  }

  /**
   * 函数级详细中文注释：根据文件名获取 MIME 类型
   */
  function getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'json': 'application/json',
      'txt': 'text/plain',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
    return mimeTypes[ext || ''] || 'application/octet-stream'
  }

  /**
   * 函数级详细中文注释：获取文件类型的中文名称
   */
  function getFileTypeName(type: string): string {
    const types: Record<string, string> = {
      'business_license': '营业执照',
      'identity': '身份证明',
      'funding_proof': '资金证明',
      'contact': '联系方式',
      'other': '其他'
    }
    return types[type] || '未知'
  }

  /**
   * 函数级详细中文注释：返回上一页
   */
  function handleBack() {
    window.location.hash = '#/otc/mm-apply'
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        position: 'relative'
      }}
    >
      {/* 返回按钮 */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}>
        <Button
          type="default"
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
          style={{
            background: 'rgba(255,255,255,0.9)',
            border: 'none',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
        >
          返回申请页面
        </Button>
      </div>

      {/* 主内容 */}
      <div style={{ maxWidth: 480, margin: '60px auto 0', padding: '0 20px' }}>
        <Card
          style={{
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* 标题 */}
            <div style={{ textAlign: 'center' }}>
              <UnlockOutlined style={{ fontSize: 48, color: '#667eea', marginBottom: 16 }} />
              <Typography.Title level={3} style={{ margin: 0 }}>
                私密文件解密工具
              </Typography.Title>
              <Typography.Text type="secondary">
                委员会审核专用 · 需要申请人提供的加密密码
              </Typography.Text>
            </div>

            {/* 说明 */}
            <Alert
              type="warning"
              message="委员会成员注意"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>此工具用于审核做市商申请时解密私密文件</li>
                  <li>需要申请人通过安全渠道提供加密密码</li>
                  <li>解密后的文件仅用于审核，严禁外传</li>
                  <li>审核完成后请立即删除本地保存的文件</li>
                </ul>
              }
              showIcon
            />

            {/* 输入区域 */}
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text strong>1. 输入 IPFS CID</Typography.Text>
              <Input
                placeholder="输入私密资料根 CID（例如：bafybei...）"
                value={cid}
                onChange={(e) => setCid(e.target.value)}
                disabled={loading}
                size="large"
              />
            </Space>

            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text strong>2. 输入解密密码</Typography.Text>
              <Input.Password
                placeholder="输入申请人提供的加密密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                size="large"
                prefix={<UnlockOutlined />}
              />
            </Space>

            {/* 操作按钮 */}
            <Button
              type="primary"
              size="large"
              block
              icon={<UnlockOutlined />}
              onClick={handleDecrypt}
              loading={loading}
              disabled={!cid || !password}
              style={{
                height: 48,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                fontSize: 16
              }}
            >
              {loading ? '正在解密...' : '开始解密'}
            </Button>

            {/* 解密结果 */}
            {decryptedFiles.length > 0 && (
              <div>
                <Typography.Text strong style={{ fontSize: 16 }}>
                  解密成功（{decryptedFiles.length} 个文件）
                </Typography.Text>
                
                <List
                  bordered
                  dataSource={decryptedFiles}
                  style={{ marginTop: 12 }}
                  renderItem={(file) => (
                    <List.Item
                      actions={[
                        <Button
                          type="link"
                          icon={<EyeOutlined />}
                          onClick={() => handlePreview(file)}
                        >
                          预览
                        </Button>,
                        <Button
                          type="primary"
                          icon={<DownloadOutlined />}
                          onClick={() => handleDownload(file)}
                        >
                          下载
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        title={file.originalName}
                        description={
                          <Space>
                            <Typography.Text type="secondary">
                              类型：{getFileTypeName(file.type)}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              大小：{(file.size / 1024).toFixed(2)} KB
                            </Typography.Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
                
                <Alert
                  type="success"
                  message="解密完成"
                  description="您可以预览或下载文件进行审核。审核完成后请安全删除本地文件。"
                  style={{ marginTop: 16 }}
                  showIcon
                />
              </div>
            )}

            {/* 使用说明 */}
            <Alert
              type="info"
              message="使用说明"
              description={
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  <li>在做市商申请详情中找到"私密资料根 CID"</li>
                  <li>通过安全渠道向申请人索要解密密码</li>
                  <li>输入 CID 和密码，点击"开始解密"</li>
                  <li>预览或下载文件进行审核</li>
                  <li>审核完成后清空密码并删除本地文件</li>
                </ol>
              }
              showIcon
            />
          </Space>
        </Card>
      </div>
    </div>
  )
}

