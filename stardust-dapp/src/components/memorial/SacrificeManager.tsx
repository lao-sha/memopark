/**
 * 祭祀品目录管理组件（管理员）
 * 
 * 功能说明：
 * 1. 展示所有祭祀品列表（支持筛选）
 * 2. 创建新祭祀品
 * 3. 编辑现有祭祀品
 * 4. 设置祭祀品状态（启用/禁用/隐藏）
 * 5. 支持场景和类目筛选
 * 6. 支持按价格类型筛选（固定价/按周计费）
 * 
 * 创建日期：2025-10-28
 */

import React, { useState, useEffect } from 'react'
import { 
  Row, 
  Col, 
  Space, 
  Typography, 
  Button, 
  Modal, 
  Form, 
  Input, 
  InputNumber,
  Select,
  Switch,
  Radio,
  message,
  Spin,
  Tag,
  Empty,
  Divider,
} from 'antd'
import { 
  PlusOutlined, 
  FilterOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { getApi } from '../../lib/polkadot-safe'
import { 
  createMemorialService, 
  Scene,
  Category,
  SacrificeStatus,
  type SacrificeItem,
} from '../../services/memorialService'
import { SacrificeCard } from './SacrificeCard'

const { Title } = Typography
const { TextArea } = Input

interface SacrificeManagerProps {
  /** 当前管理员账户 */
  adminAccount: string
}

/**
 * 函数级详细中文注释：祭祀品表单数据接口
 */
interface SacrificeFormData {
  name: string
  resourceUrl: string
  description: string
  isVipExclusive: boolean
  priceType: 'fixed' | 'weekly' | 'both'
  fixedPrice?: string
  unitPricePerWeek?: string
  scene: Scene
  category: Category
}

/**
 * 函数级详细中文注释：祭祀品目录管理组件
 */
export const SacrificeManager: React.FC<SacrificeManagerProps> = ({ adminAccount }) => {
  const [sacrifices, setSacrifices] = useState<SacrificeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingSacrifice, setEditingSacrifice] = useState<SacrificeItem | null>(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  // 筛选状态
  const [filters, setFilters] = useState({
    scene: undefined as Scene | undefined,
    category: undefined as Category | undefined,
    status: undefined as SacrificeStatus | undefined,
    isVipExclusive: undefined as boolean | undefined,
  })

  /**
   * 函数级详细中文注释：加载祭祀品列表
   */
  const loadSacrifices = async () => {
    setLoading(true)
    try {
      const api = await getApi()
      const service = createMemorialService(api)
      
      const items = await service.listSacrifices({
        ...filters,
        limit: 100,
      })
      
      setSacrifices(items)
    } catch (error) {
      console.error('加载祭祀品列表失败:', error)
      message.error('加载祭祀品列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSacrifices()
  }, [filters])

  /**
   * 函数级详细中文注释：打开创建弹窗
   */
  const handleCreate = () => {
    form.resetFields()
    form.setFieldsValue({
      priceType: 'fixed',
      isVipExclusive: false,
      scene: Scene.Memorial,
      category: Category.Flower,
    })
    setEditingSacrifice(null)
    setShowCreateModal(true)
  }

  /**
   * 函数级详细中文注释：打开编辑弹窗
   */
  const handleEdit = (sacrifice: SacrificeItem) => {
    let priceType: 'fixed' | 'weekly' | 'both'
    if (sacrifice.fixedPrice && sacrifice.unitPricePerWeek) {
      priceType = 'both'
    } else if (sacrifice.fixedPrice) {
      priceType = 'fixed'
    } else {
      priceType = 'weekly'
    }

    form.setFieldsValue({
      name: sacrifice.name,
      resourceUrl: sacrifice.resourceUrl,
      description: sacrifice.description,
      isVipExclusive: sacrifice.isVipExclusive,
      priceType,
      fixedPrice: sacrifice.fixedPrice ? (BigInt(sacrifice.fixedPrice) / BigInt(1_000_000)).toString() : undefined,
      unitPricePerWeek: sacrifice.unitPricePerWeek ? (BigInt(sacrifice.unitPricePerWeek) / BigInt(1_000_000)).toString() : undefined,
      scene: sacrifice.scene,
      category: sacrifice.category,
    })
    
    setEditingSacrifice(sacrifice)
    setShowCreateModal(true)
  }

  /**
   * 函数级详细中文注释：提交表单
   */
  const handleSubmit = async (values: SacrificeFormData) => {
    setSubmitting(true)
    try {
      const api = await getApi()
      const service = createMemorialService(api)

      // 转换价格（MEMO单位）
      const toMinimalUnits = (memo: string) => (BigInt(memo) * BigInt(1_000_000)).toString()
      
      const fixedPrice = values.priceType === 'fixed' || values.priceType === 'both'
        ? toMinimalUnits(values.fixedPrice!)
        : null
      
      const unitPricePerWeek = values.priceType === 'weekly' || values.priceType === 'both'
        ? toMinimalUnits(values.unitPricePerWeek!)
        : null

      let tx
      if (editingSacrifice) {
        // 更新祭祀品
        tx = service.buildUpdateSacrificeTx({
          id: editingSacrifice.id,
          name: values.name,
          resourceUrl: values.resourceUrl,
          description: values.description,
          isVipExclusive: values.isVipExclusive,
          fixedPrice,
          unitPricePerWeek,
          scene: values.scene,
          category: values.category,
        })
      } else {
        // 创建祭祀品
        tx = service.buildCreateSacrificeTx({
          name: values.name,
          resourceUrl: values.resourceUrl,
          description: values.description,
          isVipExclusive: values.isVipExclusive,
          fixedPrice,
          unitPricePerWeek,
          scene: values.scene,
          category: values.category,
        })
      }

      const { web3FromAddress } = await import('@polkadot/extension-dapp')
      const injector = await web3FromAddress(adminAccount)

      await tx.signAndSend(
        adminAccount,
        { signer: injector.signer },
        ({ status }) => {
          if (status.isFinalized) {
            message.success(editingSacrifice ? '祭祀品更新成功！' : '祭祀品创建成功！')
            setShowCreateModal(false)
            loadSacrifices()
          }
        }
      )
    } catch (error: any) {
      message.error(error.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * 函数级详细中文注释：设置祭祀品状态
   */
  const handleSetStatus = async (sacrifice: SacrificeItem, newStatus: SacrificeStatus) => {
    try {
      const api = await getApi()
      const service = createMemorialService(api)
      
      const tx = service.buildSetSacrificeStatusTx({
        id: sacrifice.id,
        status: newStatus,
      })

      const { web3FromAddress } = await import('@polkadot/extension-dapp')
      const injector = await web3FromAddress(adminAccount)

      await tx.signAndSend(
        adminAccount,
        { signer: injector.signer },
        ({ status }) => {
          if (status.isFinalized) {
            message.success('状态更新成功！')
            loadSacrifices()
          }
        }
      )
    } catch (error: any) {
      message.error(error.message || '状态更新失败')
    }
  }

  return (
    <div style={{ padding: '24px 0' }}>
      {/* 头部 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ marginBottom: 8 }}>
              祭祀品目录管理
            </Title>
            <Tag color="blue">{sacrifices.length} 个祭祀品</Tag>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadSacrifices}>
              刷新
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleCreate}
            >
              创建祭祀品
            </Button>
          </Space>
        </div>
      </div>

      {/* 筛选器 */}
      <div style={{ 
        background: '#f5f5f5', 
        padding: 16, 
        borderRadius: 8,
        marginBottom: 24,
      }}>
        <Space size="large" wrap>
          <div>
            <FilterOutlined style={{ marginRight: 8, color: '#999' }} />
            <Select
              placeholder="场景类型"
              style={{ width: 120 }}
              allowClear
              value={filters.scene}
              onChange={(value) => setFilters({ ...filters, scene: value })}
            >
              <Select.Option value={Scene.Memorial}>纪念馆</Select.Option>
              <Select.Option value={Scene.Pet}>宠物</Select.Option>
              <Select.Option value={Scene.Park}>公园</Select.Option>
              <Select.Option value={Scene.Memorial}>纪念馆</Select.Option>
            </Select>
          </div>
          
          <Select
            placeholder="类目"
            style={{ width: 120 }}
            allowClear
            value={filters.category}
            onChange={(value) => setFilters({ ...filters, category: value })}
          >
            <Select.Option value={Category.Flower}>鲜花</Select.Option>
            <Select.Option value={Category.Candle}>蜡烛</Select.Option>
            <Select.Option value={Category.Food}>食品</Select.Option>
            <Select.Option value={Category.Toy}>玩具</Select.Option>
            <Select.Option value={Category.Other}>其他</Select.Option>
          </Select>

          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
          >
            <Select.Option value={SacrificeStatus.Enabled}>已启用</Select.Option>
            <Select.Option value={SacrificeStatus.Disabled}>已禁用</Select.Option>
            <Select.Option value={SacrificeStatus.Hidden}>已隐藏</Select.Option>
          </Select>

          <Select
            placeholder="VIP专属"
            style={{ width: 120 }}
            allowClear
            value={filters.isVipExclusive}
            onChange={(value) => setFilters({ ...filters, isVipExclusive: value })}
          >
            <Select.Option value={true}>是</Select.Option>
            <Select.Option value={false}>否</Select.Option>
          </Select>
        </Space>
      </div>

      {/* 祭祀品列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#999' }}>加载祭祀品列表...</div>
        </div>
      ) : sacrifices.length === 0 ? (
        <Empty
          description="暂无祭祀品"
          style={{ padding: '60px 0' }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            创建第一个祭祀品
          </Button>
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {sacrifices.map((sacrifice) => (
            <Col key={sacrifice.id} xs={24} sm={12} md={8} lg={6}>
              <SacrificeCard
                sacrifice={sacrifice}
                showManageButtons
                onEdit={handleEdit}
              />
              <Divider style={{ margin: '12px 0' }} />
              <Space style={{ width: '100%', justifyContent: 'center' }}>
                {sacrifice.status === SacrificeStatus.Enabled ? (
                  <Button 
                    size="small" 
                    onClick={() => handleSetStatus(sacrifice, SacrificeStatus.Disabled)}
                  >
                    禁用
                  </Button>
                ) : (
                  <Button 
                    size="small" 
                    type="primary"
                    onClick={() => handleSetStatus(sacrifice, SacrificeStatus.Enabled)}
                  >
                    启用
                  </Button>
                )}
                {sacrifice.status !== SacrificeStatus.Hidden && (
                  <Button 
                    size="small"
                    onClick={() => handleSetStatus(sacrifice, SacrificeStatus.Hidden)}
                  >
                    隐藏
                  </Button>
                )}
              </Space>
            </Col>
          ))}
        </Row>
      )}

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingSacrifice ? '编辑祭祀品' : '创建祭祀品'}
        open={showCreateModal}
        onCancel={() => setShowCreateModal(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editingSacrifice ? '保存' : '创建'}
        cancelText="取消"
        width={700}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            label="祭祀品名称"
            name="name"
            rules={[{ required: true, message: '请输入祭祀品名称' }]}
          >
            <Input placeholder="例如：向日葵" />
          </Form.Item>

          <Form.Item
            label="资源URL"
            name="resourceUrl"
            rules={[{ required: true, message: '请输入资源URL' }]}
            tooltip="祭祀品图片的URL或IPFS链接"
          >
            <Input placeholder="https://..." />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <TextArea rows={3} placeholder="描述此祭祀品的特点和寓意" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="场景"
                name="scene"
                rules={[{ required: true, message: '请选择场景' }]}
              >
                <Select>
                  <Select.Option value={Scene.Memorial}>纪念馆</Select.Option>
                  <Select.Option value={Scene.Pet}>宠物</Select.Option>
                  <Select.Option value={Scene.Park}>公园</Select.Option>
                  <Select.Option value={Scene.Memorial}>纪念馆</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="类目"
                name="category"
                rules={[{ required: true, message: '请选择类目' }]}
              >
                <Select>
                  <Select.Option value={Category.Flower}>鲜花</Select.Option>
                  <Select.Option value={Category.Candle}>蜡烛</Select.Option>
                  <Select.Option value={Category.Food}>食品</Select.Option>
                  <Select.Option value={Category.Toy}>玩具</Select.Option>
                  <Select.Option value={Category.Other}>其他</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="VIP专属"
            name="isVipExclusive"
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>

          <Form.Item
            label="价格类型"
            name="priceType"
            rules={[{ required: true, message: '请选择价格类型' }]}
          >
            <Radio.Group>
              <Radio value="fixed">固定价格</Radio>
              <Radio value="weekly">按周单价</Radio>
              <Radio value="both">两种价格都支持</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => 
              prevValues.priceType !== currentValues.priceType
            }
          >
            {({ getFieldValue }) => {
              const priceType = getFieldValue('priceType')
              return (
                <Row gutter={16}>
                  {(priceType === 'fixed' || priceType === 'both') && (
                    <Col span={12}>
                      <Form.Item
                        label="固定价格（DUST）"
                        name="fixedPrice"
                        rules={[{ required: true, message: '请输入固定价格' }]}
                      >
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          placeholder="0.001"
                          precision={6}
                        />
                      </Form.Item>
                    </Col>
                  )}
                  {(priceType === 'weekly' || priceType === 'both') && (
                    <Col span={12}>
                      <Form.Item
                        label="按周单价（DUST/周）"
                        name="unitPricePerWeek"
                        rules={[{ required: true, message: '请输入按周单价' }]}
                      >
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          placeholder="0.001"
                          precision={6}
                        />
                      </Form.Item>
                    </Col>
                  )}
                </Row>
              )
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

