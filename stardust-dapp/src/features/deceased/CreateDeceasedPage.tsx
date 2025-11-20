import React from 'react'
import {
  Button,
  Form,
  Input,
  Modal,
  message,
  DatePicker,
  Upload,
  Avatar,
  Card
} from 'antd'
import {
  ArrowLeftOutlined,
  UserOutlined,
  ManOutlined,
  WomanOutlined,
  CameraOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import { uploadToIpfs } from '../../lib/ipfs'
import { signAndSendLocalWithPassword } from '../../lib/polkadot-safe'
import { mapDispatchErrorMessage } from '../../lib/errors'
import { useWallet } from '../../providers/WalletProvider'
import { useDeceasedEvents } from '../../hooks/useDeceasedEvents'
import { PinStatusIndicator } from '../../components/deceased/PinStatusIndicator'
import dayjs from 'dayjs'
import './CreateDeceasedPage.css'

/**
 * 函数级详细中文注释：创建逝者页面（云上思念UI风格）
 * - 参考云上思念的简洁优雅设计
 * - 移动端优先，卡片式布局
 * - 简化表单字段，聚焦核心信息
 * - 对应后端 `pallet-deceased::createDeceased`
 */
const CreateDeceasedPage: React.FC = () => {
  const [form] = Form.useForm()
  const [pwdOpen, setPwdOpen] = React.useState(false)
  const [pwdVal, setPwdVal] = React.useState('')
  const [confirmLoading, setConfirmLoading] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [selectedGender, setSelectedGender] = React.useState(0) // 默认男性
  const { current } = useWallet()

  // 事件监听
  const { events, getEventsByDeceasedId } = useDeceasedEvents(true)
  const [latestDeceasedId, setLatestDeceasedId] = React.useState<number | null>(null)
  const [pinStatusShown, setPinStatusShown] = React.useState(false)

  // 主图上传相关状态
  const [mainImageFile, setMainImageFile] = React.useState<File | null>(null)
  const [mainImagePreview, setMainImagePreview] = React.useState<string>('')
  const [uploadingImage, setUploadingImage] = React.useState(false)
  const [uploadedMainImageCid, setUploadedMainImageCid] = React.useState<string>('')

  // 事务上下文
  const txRef = React.useRef<{ args: any[] } | null>(null)

  /**
   * 函数级中文注释：将字符串转换为字节数组
   */
  const toBytes = React.useCallback((s: string): number[] =>
    Array.from(new TextEncoder().encode(String(s || ''))),
  [])

  /**
   * 函数级中文注释：处理主图上传
   */
  const handleImageUpload = React.useCallback(async (file: File) => {
    try {
      setUploadingImage(true)

      if (!file.type.startsWith('image/')) {
        message.error('请上传图片文件')
        return false
      }

      if (file.size > 5 * 1024 * 1024) {
        message.error('图片大小不能超过 5MB')
        return false
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        setMainImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      message.loading({ key: 'upload-image', content: '正在上传图片到 IPFS...' })
      const cid = await uploadToIpfs(file)
      message.success({ key: 'upload-image', content: '图片上传成功' })

      setUploadedMainImageCid(cid)
      setMainImageFile(file)

      return false
    } catch (error: any) {
      message.error({ key: 'upload-image', content: `上传失败：${error.message}` })
      return false
    } finally {
      setUploadingImage(false)
    }
  }, [])

  /**
   * 函数级中文注释：设置逝者主图到链上
   */
  const setMainImageOnChain = React.useCallback(async (deceasedId: number, cid: string, password: string) => {
    try {
      const cidBytes = toBytes(cid)
      const txHash = await signAndSendLocalWithPassword(
        'deceased',
        'setMainImage',
        [deceasedId, cidBytes],
        password
      )
      message.success(`主图设置成功`)
      return true
    } catch (error: any) {
      const msg = mapDispatchErrorMessage(error, '设置主图失败')
      message.error(msg)
      return false
    }
  }, [toBytes])

  /**
   * 函数级中文注释：校验 YYYYMMDD
   */
  const isYYYYMMDD = React.useCallback((s: string): boolean =>
    /^(\d{8})$/.test(String(s || '')),
  [])

  /**
   * 函数级中文注释：提交前校验
   * - 显示"3次修改机会"提示框
   * - 确认后再弹出签名窗口
   */
  const onFinish = React.useCallback(async (v: any) => {
    try {
      setSubmitting(true)

      const name = String(v.name || '').trim()
      if (!name) {
        setSubmitting(false)
        return message.warning('请填写逝者姓名')
      }

      const gender = selectedGender

      let birth = ''
      let death = ''

      if (v.birth_date && dayjs.isDayjs(v.birth_date)) {
        birth = v.birth_date.format('YYYYMMDD')
      }

      if (v.death_date && dayjs.isDayjs(v.death_date)) {
        death = v.death_date.format('YYYYMMDD')
      }

      if (!isYYYYMMDD(birth)) {
        setSubmitting(false)
        return message.error('请选择出生日期')
      }
      if (!isYYYYMMDD(death)) {
        setSubmitting(false)
        return message.error('请选择离世日期')
      }

      const args: any[] = [
        0,
        toBytes(name),
        gender,
        null,
        toBytes(birth),
        toBytes(death),
        []
      ]

      // 先显示"3次修改机会"提示
      Modal.confirm({
        title: '重要提示',
        content: (
          <div style={{ lineHeight: 1.8 }}>
            <div style={{ marginBottom: 12, fontSize: 15, color: '#333' }}>
              创建逝者档案后，基本信息将永久存储在区块链上。
            </div>
            <div style={{
              padding: '12px 16px',
              background: 'rgba(93, 186, 170, 0.08)',
              borderRadius: 8,
              borderLeft: '4px solid #5DBAAA',
              marginBottom: 12
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#2F4F4F', marginBottom: 4 }}>
                ⚠️ 修改限制
              </div>
              <div style={{ fontSize: 13, color: '#666' }}>
                姓名、性别、出生/离世日期仅可修改 <span style={{ color: '#F08080', fontWeight: 600 }}>3次</span>，请谨慎填写。
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#999' }}>
              确认信息无误后，请继续操作。
            </div>
          </div>
        ),
        okText: '确认创建',
        cancelText: '再检查一下',
        centered: true,
        width: 420,
        okButtonProps: {
          style: {
            background: 'linear-gradient(135deg, #5DBAAA 0%, #7DD4C6 100%)',
            border: 'none',
            height: 40,
            borderRadius: 8,
            fontWeight: 600
          }
        },
        cancelButtonProps: {
          style: {
            height: 40,
            borderRadius: 8
          }
        },
        onOk: () => {
          // 确认后再弹出签名窗口
          txRef.current = { args }
          setPwdVal('')
          setPwdOpen(true)
        },
        onCancel: () => {
          setSubmitting(false)
        }
      })
    } catch (e: any) {
      message.error(mapDispatchErrorMessage(e, '提交失败'))
      setSubmitting(false)
    }
  }, [toBytes, isYYYYMMDD, selectedGender])

  /**
   * 函数级中文注释：监听创建成功事件
   */
  React.useEffect(() => {
    if (!latestDeceasedId || pinStatusShown) return

    const deceasedEvents = getEventsByDeceasedId(latestDeceasedId)
    const hasAutoPin = deceasedEvents.some(e =>
      e.event === 'AutoPinSuccess' || e.event === 'AutoPinFailed'
    )

    if (hasAutoPin) {
      setPinStatusShown(true)
    }
  }, [events, latestDeceasedId, getEventsByDeceasedId, pinStatusShown])

  /**
   * 函数级中文注释：确认密码并提交
   */
  const onConfirm = React.useCallback(async () => {
    if (!txRef.current) {
      setPwdOpen(false)
      setSubmitting(false)
      return
    }
    if (!pwdVal || pwdVal.length < 8) {
      return message.warning('请输入至少 8 位签名密码')
    }

    const key = 'tx-create-deceased'
    try {
      setConfirmLoading(true)
      setPinStatusShown(false)
      message.loading({ key, content: '正在提交交易…' })

      const timer = setTimeout(()=>
        message.loading({ key, content: '连接节点较慢，仍在等待…' }),
        8000
      )

      const txHash = await signAndSendLocalWithPassword(
        'deceased',
        'createDeceased',
        txRef.current.args,
        pwdVal
      )
      clearTimeout(timer)
      message.success({ key, content: `创建成功` })
      setPwdOpen(false)

      message.info({ key: 'waiting-events', content: '正在检测IPFS固定状态...' })

      let createdDeceasedId: number | null = null
      const checkEvents = setInterval(() => {
        const createdEvent = events.find(e => e.event === 'DeceasedCreated')
        if (createdEvent) {
          createdDeceasedId = createdEvent.deceasedId
          setLatestDeceasedId(createdEvent.deceasedId)
          message.destroy('waiting-events')
          clearInterval(checkEvents)
        }
      }, 500)

      setTimeout(async () => {
        clearInterval(checkEvents)
        message.destroy('waiting-events')

        if (uploadedMainImageCid && createdDeceasedId) {
          try {
            message.loading({ key: 'set-image', content: '正在设置主图...' })
            const success = await setMainImageOnChain(createdDeceasedId, uploadedMainImageCid, pwdVal)
            if (success) {
              message.success({ key: 'set-image', content: '主图设置成功' })
            }
          } catch (error: any) {
            message.warning({
              key: 'set-image',
              content: '主图设置失败，请稍后在管理页面手动设置'
            })
          }
        }

        form.resetFields()
        setMainImageFile(null)
        setMainImagePreview('')
        setUploadedMainImageCid('')
        setSelectedGender(0) // 重置为男性

        try {
          window.dispatchEvent(new Event('mp.txUpdate'))
        } catch {}

        setTimeout(()=> {
          window.location.hash = '#/deceased/list'
        }, uploadedMainImageCid ? 3000 : 2000)
      }, 3000)

    } catch (e: any) {
      const raw = String(e?.message || '')
      const mapped = mapDispatchErrorMessage(e, '提交失败')
      if (/未找到本地钱包/.test(mapped)) {
        message.destroy(key)
        Modal.confirm({
          title: '未发现本地钱包',
          content: '请先创建或导入钱包后再试。',
          okText: '去创建/导入',
          cancelText: '取消',
          onOk: () => {
            try {
              window.dispatchEvent(new CustomEvent('mp.nav', { detail: { tab: 'create' } }))
            } catch {}
          }
        })
      } else if (/密码|password/i.test(raw)) {
        message.error({ key, content: '密码错误或解密失败，请重试' })
      } else {
        message.error({ key, content: mapped })
      }
    } finally {
      setConfirmLoading(false)
      setSubmitting(false)
    }
  }, [pwdVal, form, events, uploadedMainImageCid, setMainImageOnChain])

  return (
    <div className="create-deceased-page">
      {/* 顶部导航栏（云上思念风格） */}
      <div className="page-header">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => window.history.back()}
          className="back-button"
        >
          返回
        </Button>
        <div className="page-title">创建逝者档案</div>
        <div style={{ width: 40 }} />
      </div>

      {/* 主要内容区域 */}
      <div className="page-content">
        {/* 提示信息 */}
        {!current && (
          <div className="warning-banner">
            <div className="warning-icon">⚠️</div>
            <div>
              <div className="warning-title">需要连接钱包</div>
              <div className="warning-desc">请先创建或导入钱包后，才能创建逝者档案</div>
            </div>
          </div>
        )}

        {/* Pin状态指示器 */}
        {latestDeceasedId && (() => {
          const deceasedEvents = getEventsByDeceasedId(latestDeceasedId)
          const pinSuccess = deceasedEvents.find(e => e.event === 'AutoPinSuccess')
          const pinFailed = deceasedEvents.find(e => e.event === 'AutoPinFailed')

          if (pinSuccess || pinFailed) {
            return (
              <Card className="pin-status-card">
                <PinStatusIndicator
                  deceasedId={latestDeceasedId}
                  successData={pinSuccess?.data}
                  failedData={pinFailed?.data}
                  showRetry={false}
                />
              </Card>
            )
          }
          return null
        })()}

        {/* 创建表单（云上思念风格） */}
        <div className="form-container">
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            className="deceased-form"
          >
            {/* 主图上传 */}
            <div className="avatar-section">
              <div className="section-title">逝者照片</div>
              <div className="avatar-upload-container">
                {mainImagePreview ? (
                  <div className="avatar-preview" onClick={() => {
                    setMainImageFile(null)
                    setMainImagePreview('')
                    setUploadedMainImageCid('')
                  }}>
                    <img src={mainImagePreview} alt="逝者照片" />
                    <div className="avatar-overlay">
                      <CameraOutlined style={{ fontSize: 24 }} />
                      <div style={{ marginTop: 8 }}>点击重新上传</div>
                    </div>
                  </div>
                ) : (
                  <Upload
                    beforeUpload={handleImageUpload}
                    showUploadList={false}
                    accept="image/*"
                  >
                    <div className="avatar-placeholder">
                      <CameraOutlined style={{ fontSize: 32, color: '#999' }} />
                      <div style={{ marginTop: 12, fontSize: 14, color: '#999' }}>
                        {uploadingImage ? '上传中...' : '上传照片'}
                      </div>
                    </div>
                  </Upload>
                )}
              </div>
              <div className="section-hint">建议上传清晰的遗照，支持 JPG/PNG 格式</div>
            </div>

            {/* 基本信息 */}
            <div className="form-section">
              <div className="section-title">基本信息</div>

              <Form.Item
                label="逝者姓名"
                name="name"
                rules={[{ required: true, message: '请填写逝者姓名' }]}
              >
                <Input
                  placeholder="请输入逝者姓名"
                  prefix={<UserOutlined style={{ color: '#5DBAAA' }} />}
                  className="form-input"
                />
              </Form.Item>

              {/* 性别选择（统一青绿色风格） */}
              <div className="gender-section">
                <div className="form-label">性别</div>
                <div className="gender-buttons">
                  <Button
                    className={`gender-btn ${selectedGender === 0 ? 'active male' : ''}`}
                    onClick={() => setSelectedGender(0)}
                  >
                    <ManOutlined />
                    <span>男</span>
                  </Button>
                  <Button
                    className={`gender-btn ${selectedGender === 1 ? 'active female' : ''}`}
                    onClick={() => setSelectedGender(1)}
                  >
                    <WomanOutlined />
                    <span>女</span>
                  </Button>
                </div>
              </div>

              <Form.Item
                label="出生日期"
                name="birth_date"
                rules={[{ required: true, message: '请选择出生日期' }]}
              >
                <DatePicker
                  placeholder="选择日期"
                  format="YYYY年MM月DD日"
                  className="form-date-picker"
                  suffixIcon={null}
                />
              </Form.Item>

              <Form.Item
                label="离世日期"
                name="death_date"
                rules={[{ required: true, message: '请选择离世日期' }]}
              >
                <DatePicker
                  placeholder="选择日期"
                  format="YYYY年MM月DD日"
                  className="form-date-picker"
                  suffixIcon={null}
                />
              </Form.Item>
            </div>

            {/* 提交按钮 */}
            <div className="form-footer">
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                block
                className="submit-button"
                icon={<CheckCircleOutlined />}
              >
                {submitting ? '正在创建...' : '创建逝者档案'}
              </Button>

              <div className="footer-hint">
                创建后不可删除，请谨慎填写
              </div>
            </div>
          </Form>
        </div>

        {/* 密码确认弹窗 */}
        <Modal
          open={pwdOpen}
          title="输入签名密码"
          onCancel={()=> {
            setPwdOpen(false)
            setSubmitting(false)
          }}
          onOk={onConfirm}
          okText="确认创建"
          cancelText="取消"
          confirmLoading={confirmLoading}
          centered
          className="password-modal"
        >
          <div style={{ padding: '20px 0' }}>
            <div style={{ textAlign: 'center', marginBottom: 20, color: '#666', fontSize: 14 }}>
              请输入钱包密码以完成上链交易
            </div>
            <Input.Password
              placeholder="至少 8 位密码"
              value={pwdVal}
              onChange={e => setPwdVal(e.target.value)}
              size="large"
              className="password-input"
            />
          </div>
        </Modal>

        {/* 使用说明（云上思念风格） */}
        <div className="guide-section">
          <div className="guide-title">创建说明</div>
          <div className="guide-content">
            <div className="guide-item">
              <div className="guide-icon">📝</div>
              <div className="guide-text">
                <div className="guide-item-title">填写真实信息</div>
                <div className="guide-item-desc">姓名和日期将生成唯一标识，创建后不可修改</div>
              </div>
            </div>
            <div className="guide-item">
              <div className="guide-icon">🖼️</div>
              <div className="guide-text">
                <div className="guide-item-title">上传遗照</div>
                <div className="guide-item-desc">照片将自动存储到 IPFS 去中心化网络</div>
              </div>
            </div>
            <div className="guide-item">
              <div className="guide-icon">🔗</div>
              <div className="guide-text">
                <div className="guide-item-title">建立关系</div>
                <div className="guide-item-desc">创建完成后可通过关系功能建立亲属关联</div>
              </div>
            </div>
            <div className="guide-item">
              <div className="guide-icon">⛓️</div>
              <div className="guide-text">
                <div className="guide-item-title">链上存储</div>
                <div className="guide-item-desc">所有信息永久存储在区块链上，不可篡改</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateDeceasedPage
