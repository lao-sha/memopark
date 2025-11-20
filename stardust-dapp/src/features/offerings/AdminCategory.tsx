import React, { useEffect, useMemo, useState } from 'react'
import { Card, Form, Input, InputNumber, Button, Space, Typography, Table, message } from 'antd'
import { getApi } from '../../lib/polkadot'
import { signAndSendLocalFromKeystore } from '../../lib/polkadot-safe'

/**
 * 函数级详细中文注释：目录类目管理（两级）
 * - 创建/更新类目：create_category(name,parent?) / update_category(id,name?,parent?)
 * - 为目录项指派类目：assign_category(id, primary?, secondary?)
 * - 读取类目树：CategoryOf.entries()；读取子类目：ChildrenByCategory(primary)
 */
const AdminCategory: React.FC = () => {
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [cats, setCats] = useState<Array<{ id: number; name: string; parent?: number; level: number }>>([])
  const [children, setChildren] = useState<Record<number, number[]>>({})

  const load = async () => {
    try {
      const api = await getApi()
      // 读取全部类目
      const entries = await (api.query as any).memoSacrifice?.categoryOf?.entries?.()
      const list: Array<{ id: number; name: string; parent?: number; level: number }> = []
      for (const [key, val] of entries) {
        const id = Number(key.args[0])
        const v = (val as any).toJSON?.() || (val as any)
        // [id, nameBytes, parent?, level]
        const name = Array.isArray(v) ? new TextDecoder().decode(new Uint8Array(v[1])) : ''
        const parent = Array.isArray(v) && v[2] != null ? Number(v[2]) : undefined
        const level = Array.isArray(v) ? Number(v[3]) : 1
        list.push({ id, name, parent, level })
      }
      setCats(list.sort((a,b)=>a.id-b.id))
      // 子类目索引
      const ch: Record<number, number[]> = {}
      for (const c of list.filter(x=>x.level===1)) {
        const v = await (api.query as any).memoSacrifice?.childrenByCategory?.(c.id)
        const arr = (v as any)?.toJSON?.() as number[] | undefined
        ch[c.id] = Array.isArray(arr)? arr.map(Number) : []
      }
      setChildren(ch)
    } catch (e) { console.warn('load cats error', e) }
  }
  useEffect(() => { load() }, [])

  const [createForm] = Form.useForm()
  const [updateForm] = Form.useForm()
  const [assignForm] = Form.useForm()

  const primaryCats = useMemo(()=> cats.filter(c=>c.level===1), [cats])

  const onCreate = async (v:any) => {
    try {
      setCreating(true)
      const nameBytes = new TextEncoder().encode(String(v.name||''))
      const parent = v.parent==='' || v.parent==null ? null : Number(v.parent)
      const tx = await signAndSendLocalFromKeystore('memoSacrifice', 'createCategory', [Array.from(nameBytes), parent])
      message.success(`已创建类目 #${tx}`)
      createForm.resetFields(); load()
    } catch (e:any) { message.error(e?.message||'创建失败') } finally { setCreating(false) }
  }
  const onUpdate = async (v:any) => {
    try {
      setUpdating(true)
      const id = Number(v.id)
      const nameOpt = v.name? Array.from(new TextEncoder().encode(String(v.name))) : null
      // parent 仅支持“不变”或设置为新父（不支持清空父级的 Some(None) 情况）
      const parentOpt = v.parent==='' || v.parent==null ? null : Number(v.parent)
      const tx = await signAndSendLocalFromKeystore('memoSacrifice', 'updateCategory', [id, nameOpt, parentOpt==null? null : [parentOpt]])
      message.success(`已更新类目 #${id} (${tx})`)
      updateForm.resetFields(); load()
    } catch (e:any) { message.error(e?.message||'更新失败') } finally { setUpdating(false) }
  }
  const onAssign = async (v:any) => {
    try {
      setAssigning(true)
      const id = BigInt(v.id)
      const p = v.primary===''||v.primary==null? null : Number(v.primary)
      const s = v.secondary===''||v.secondary==null? null : Number(v.secondary)
      const tx = await signAndSendLocalFromKeystore('memoSacrifice', 'assignCategory', [id, p, s])
      message.success(`已为目录项 ${id} 指派类目 (${tx})`)
      assignForm.resetFields()
    } catch (e:any) { message.error(e?.message||'指派失败') } finally { setAssigning(false) }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 12 }}>
      <Typography.Title level={4} style={{ textAlign: 'left' }}>目录类目管理</Typography.Title>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Card size="small" title="创建类目">
          <Form form={createForm} layout="inline" onFinish={onCreate} style={{ rowGap: 8 }}>
            <Form.Item name="name" rules={[{ required: true }]}>
              <Input placeholder="类目名" />
            </Form.Item>
            <Form.Item name="parent">
              <InputNumber placeholder="父类目ID(可空)" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={creating}>创建</Button>
            </Form.Item>
          </Form>
        </Card>
        <Card size="small" title="更新类目">
          <Form form={updateForm} layout="inline" onFinish={onUpdate} style={{ rowGap: 8 }}>
            <Form.Item name="id" rules={[{ required: true }]}>
              <InputNumber placeholder="类目ID" />
            </Form.Item>
            <Form.Item name="name">
              <Input placeholder="新名称(可空)" />
            </Form.Item>
            <Form.Item name="parent">
              <InputNumber placeholder="父类目ID(不变留空)" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={updating}>更新</Button>
            </Form.Item>
          </Form>
        </Card>
        <Card size="small" title="为目录项指派类目">
          <Form form={assignForm} layout="inline" onFinish={onAssign} style={{ rowGap: 8 }}>
            <Form.Item name="id" rules={[{ required: true }]}>
              <InputNumber placeholder="目录项ID(u64)" />
            </Form.Item>
            <Form.Item name="primary">
              <InputNumber placeholder="一级类目ID(可空)" />
            </Form.Item>
            <Form.Item name="secondary">
              <InputNumber placeholder="二级类目ID(可空)" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={assigning}>指派</Button>
            </Form.Item>
          </Form>
        </Card>

        <Card size="small" title="类目树（点击行可预填“更新类目”）">
          <Table
            size="small"
            rowKey="id"
            dataSource={cats}
            pagination={false}
            columns={[
              { title: 'ID', dataIndex: 'id', width: 80 },
              { title: '层级', dataIndex: 'level', width: 60 },
              { title: '名称', dataIndex: 'name' },
              { title: '父类目', dataIndex: 'parent', width: 100, render: (v)=> v ?? '-' },
              { title: '子类目', width: 160, render: (_, r)=> r.level===1? (children[r.id]?.join(',') || '-') : '-' },
            ]}
            onRow={(r)=> ({ onClick(){ updateForm.setFieldsValue({ id: r.id, name: r.name, parent: r.parent }) } })}
          />
        </Card>
      </Space>
    </div>
  )
}

export default AdminCategory


