import React from 'react'
import { Upload, Button, Input, message, Space, List, Progress, Alert, Modal, Typography, Tag } from 'antd'
import { UploadOutlined, LockOutlined, CloudUploadOutlined, DeleteOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'

/**
 * 函数级详细中文注释：文件加密上传组件
 * - 支持多文件上传
 * - 使用 Web Crypto API 进行 AES-256-GCM 加密
 * - 上传到 IPFS 并获取 CID
 * - 生成 manifest.json 清单文件
 */

interface EncryptedFile {
  name: string
  originalName: string
  size: number
  type: string
  encrypted: boolean
  blob?: Blob
}

interface FileEncryptUploadProps {
  onCidGenerated?: (cid: string) => void
  title?: string
  description?: string
}

export default function FileEncryptUpload({ onCidGenerated, title, description }: FileEncryptUploadProps) {
  const [password, setPassword] = React.useState<string>('')
  const [fileList, setFileList] = React.useState<UploadFile[]>([])
  const [encryptedFiles, setEncryptedFiles] = React.useState<EncryptedFile[]>([])
  const [uploading, setUploading] = React.useState<boolean>(false)
  const [uploadProgress, setUploadProgress] = React.useState<number>(0)
  const [generatedCid, setGeneratedCid] = React.useState<string>('')

  /**
   * 函数级详细中文注释：使用 Web Crypto API 加密文件
   * - 算法：AES-256-GCM（推荐用于浏览器）
   * - 使用 PBKDF2 从密码派生密钥
   * - 返回加密后的 ArrayBuffer
   */
  async function encryptFile(file: File, password: string): Promise<ArrayBuffer> {
    try {
      // 读取文件内容
      const arrayBuffer = await file.arrayBuffer()
      
      // 生成盐值和 IV
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const iv = crypto.getRandomValues(new Uint8Array(12)) // GCM 模式使用 12 字节 IV
      
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
        ['encrypt']
      )
      
      // 加密数据
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        arrayBuffer
      )
      
      // 组合：盐值(16) + IV(12) + 加密数据
      const result = new Uint8Array(salt.length + iv.length + encryptedData.byteLength)
      result.set(salt, 0)
      result.set(iv, salt.length)
      result.set(new Uint8Array(encryptedData), salt.length + iv.length)
      
      return result.buffer
    } catch (error: any) {
      console.error('加密失败:', error)
      throw new Error('文件加密失败：' + error.message)
    }
  }

  /**
   * 函数级详细中文注释：加密所有选中的文件
   */
  async function handleEncryptFiles() {
    if (!password) {
      message.error('请输入加密密码')
      return
    }
    
    if (fileList.length === 0) {
      message.error('请先选择文件')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    
    try {
      const encrypted: EncryptedFile[] = []
      
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        const originFile = file.originFileObj
        
        if (!originFile) continue
        
        message.loading({ content: `正在加密 ${file.name}...`, key: 'encrypt', duration: 0 })
        
        // 加密文件
        const encryptedBuffer = await encryptFile(originFile, password)
        const blob = new Blob([encryptedBuffer], { type: 'application/octet-stream' })
        
        encrypted.push({
          name: `${file.name}.enc`,
          originalName: file.name,
          size: blob.size,
          type: getFileType(file.name),
          encrypted: true,
          blob: blob
        })
        
        setUploadProgress(Math.round(((i + 1) / fileList.length) * 50))
      }
      
      setEncryptedFiles(encrypted)
      message.success({ content: `成功加密 ${encrypted.length} 个文件`, key: 'encrypt' })
      
    } catch (error: any) {
      console.error('加密失败:', error)
      message.error({ content: '加密失败：' + error.message, key: 'encrypt' })
    } finally {
      setUploading(false)
    }
  }

  /**
   * 函数级详细中文注释：上传到 IPFS（模拟）
   * - 实际项目中需要连接到 IPFS 节点
   * - 这里生成模拟 CID 用于演示
   */
  async function handleUploadToIPFS() {
    if (encryptedFiles.length === 0) {
      message.error('请先加密文件')
      return
    }

    setUploading(true)
    setUploadProgress(50)
    
    try {
      message.loading({ content: '正在上传到 IPFS...', key: 'upload', duration: 0 })
      
      // 生成 manifest.json
      const manifest = {
        version: '1.0',
        encrypted: true,
        algorithm: 'AES-256-GCM',
        iterations: 100000,
        files: encryptedFiles.map(f => ({
          name: f.name,
          original_name: f.originalName,
          type: f.type,
          size: f.size,
          encrypted_at: new Date().toISOString()
        })),
        note: '委员会审核时需使用共享密钥解密'
      }
      
      // TODO: 实际上传到 IPFS
      // 这里模拟上传过程
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // 模拟生成 CID（实际应从 IPFS 返回）
      const mockCid = `bafybei${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}abcdefghijk`
      
      setGeneratedCid(mockCid)
      setUploadProgress(100)
      
      message.success({ 
        content: '文件已上传到 IPFS', 
        key: 'upload',
        duration: 5 
      })
      
      // 回调通知父组件
      if (onCidGenerated) {
        onCidGenerated(mockCid)
      }
      
      // 显示成功对话框
      Modal.success({
        title: '上传成功',
        content: (
          <div>
            <p><strong>私密资料根 CID：</strong></p>
            <Input.TextArea 
              value={mockCid} 
              readOnly 
              rows={2}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
            <Alert 
              type="info" 
              message="重要提示" 
              description="请将此 CID 填入下方表单，并妥善保管加密密码。委员会审核时需要使用密码解密文件。"
              style={{ marginTop: 12 }}
              showIcon
            />
          </div>
        ),
        width: 600
      })
      
    } catch (error: any) {
      console.error('上传失败:', error)
      message.error({ content: '上传失败：' + error.message, key: 'upload' })
    } finally {
      setUploading(false)
    }
  }

  /**
   * 函数级详细中文注释：根据文件名推断文件类型
   */
  function getFileType(fileName: string): string {
    const lower = fileName.toLowerCase()
    if (lower.includes('license') || lower.includes('营业执照')) return 'business_license'
    if (lower.includes('identity') || lower.includes('身份证')) return 'identity'
    if (lower.includes('funding') || lower.includes('资金')) return 'funding_proof'
    if (lower.includes('contact') || lower.includes('联系')) return 'contact'
    return 'other'
  }

  /**
   * 函数级详细中文注释：清空所有数据
   */
  function handleReset() {
    setFileList([])
    setEncryptedFiles([])
    setGeneratedCid('')
    setUploadProgress(0)
    message.info('已清空所有数据')
  }

  return (
    <div style={{ padding: '16px', background: '#fafafa', borderRadius: '8px' }}>
      <Typography.Title level={5}>
        <LockOutlined /> {title || '私密文件加密上传'}
      </Typography.Title>
      
      {description && (
        <Alert 
          type="info" 
          message={description}
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      {/* 步骤1：选择文件 */}
      <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
        <Typography.Text strong>1. 选择需要加密的文件</Typography.Text>
        <Upload
          multiple
          fileList={fileList}
          onChange={({ fileList: newFileList }) => setFileList(newFileList)}
          beforeUpload={() => false}
          onRemove={(file) => {
            setFileList(prev => prev.filter(f => f.uid !== file.uid))
          }}
        >
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          支持：营业执照、身份证明、资金证明、联系方式等私密文件（PDF、JSON、图片等）
        </Typography.Text>
      </Space>

      {/* 步骤2：输入密码 */}
      <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
        <Typography.Text strong>2. 设置加密密码</Typography.Text>
        <Input.Password
          prefix={<LockOutlined />}
          placeholder="请输入强密码（至少12位，包含大小写字母、数字、符号）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={uploading}
        />
        <Typography.Text type="warning" style={{ fontSize: 12 }}>
          ⚠️ 请妥善保管此密码，委员会审核时需要使用！
        </Typography.Text>
      </Space>

      {/* 步骤3：加密文件 */}
      <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
        <Typography.Text strong>3. 加密并上传到 IPFS</Typography.Text>
        <Space>
          <Button
            type="primary"
            icon={<LockOutlined />}
            onClick={handleEncryptFiles}
            disabled={uploading || fileList.length === 0 || !password}
            loading={uploading && uploadProgress < 50}
          >
            加密文件
          </Button>
          <Button
            type="primary"
            icon={<CloudUploadOutlined />}
            onClick={handleUploadToIPFS}
            disabled={uploading || encryptedFiles.length === 0}
            loading={uploading && uploadProgress >= 50}
          >
            上传到 IPFS
          </Button>
          <Button
            icon={<DeleteOutlined />}
            onClick={handleReset}
            disabled={uploading}
          >
            清空
          </Button>
        </Space>
      </Space>

      {/* 进度条 */}
      {uploadProgress > 0 && (
        <Progress 
          percent={uploadProgress} 
          status={uploadProgress === 100 ? 'success' : 'active'}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 加密文件列表 */}
      {encryptedFiles.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Typography.Text strong>已加密文件：</Typography.Text>
          <List
            size="small"
            bordered
            dataSource={encryptedFiles}
            renderItem={(item) => (
              <List.Item>
                <Space>
                  <LockOutlined style={{ color: '#52c41a' }} />
                  <Typography.Text>{item.name}</Typography.Text>
                  <Typography.Text type="secondary">
                    ({(item.size / 1024).toFixed(2)} KB)
                  </Typography.Text>
                  <Tag color="green">已加密</Tag>
                </Space>
              </List.Item>
            )}
          />
        </div>
      )}

      {/* 生成的 CID */}
      {generatedCid && (
        <Alert
          type="success"
          message="IPFS CID 已生成"
          description={
            <div>
              <Input.TextArea
                value={generatedCid}
                readOnly
                rows={2}
                style={{ fontFamily: 'monospace', fontSize: 12, marginTop: 8 }}
              />
              <Typography.Text 
                copyable={{ text: generatedCid }}
                style={{ marginTop: 8, display: 'block' }}
              >
                点击复制 CID
              </Typography.Text>
            </div>
          }
          showIcon
          style={{ marginTop: 16 }}
        />
      )}

      {/* 使用说明 */}
      <Alert
        type="info"
        message="使用说明"
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>选择需要加密的私密文件（营业执照、身份证等）</li>
            <li>设置强密码（建议使用密码管理器生成）</li>
            <li>点击"加密文件"进行 AES-256-GCM 加密</li>
            <li>点击"上传到 IPFS"获取根 CID</li>
            <li>将生成的 CID 填入下方的"私密资料根 CID"字段</li>
            <li>将加密密码通过安全渠道分享给委员会</li>
          </ul>
        }
        style={{ marginTop: 16 }}
        showIcon
      />
    </div>
  )
}

