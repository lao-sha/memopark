import React from 'react'
import { Alert, Button, Card, Form, Input, Radio, Space, Typography } from 'antd'
import { buildCallPreimageHex, summarizePreimage, buildDeceasedMediaGovPreimage, buildMediaGovSetMediaHidden, buildMediaGovReplaceMediaUri, buildMediaGovRemoveMedia, buildMediaGovFreezeAlbum, buildMediaGovFreezeAlbum as buildMediaGovFreezeAlbumWithEv, buildMediaGovSetMediaHiddenWithEvidence, buildMediaGovReplaceMediaUriWithEvidence, buildMediaGovRemoveMediaWithEvidence, buildMediaGovSetPrimaryImageFor, buildMediaGovSetAlbumPrimaryPhoto, buildTextGovResolveLifeComplaint, buildTextGovResolveEulogyComplaint, buildTextGovRemoveEulogy, buildTextGovSetArticleFor, buildOfferingsGovSetOfferParams, buildOfferingsGovSetOfferingPrice, buildOfferingsGovSetPauseGlobal, buildOfferingsGovSetPauseDomain } from './lib/governance'

/**
 * 函数级详细中文注释：治理工单（失钥救济/内容治理）页面
 * - 目标：统一录入“证据 CID”与要执行的治理动作（通过预映像）
 * - 功能：
 *   1) 选择动作模板（通用 hex / 媒体治理快捷模板）
 *   2) 输入参数并生成预映像 hex，展示摘要
 *   3) 填写证据 CID（明文 CID，不加密）
 *   4) 显示押金与挑战期提示（只读说明）
 */
const GovTicketPage: React.FC = () => {
  const [form] = Form.useForm()
  const [hex, setHex] = React.useState<string>('')
  const [summary, setSummary] = React.useState<string>('')

  const onGenerate = async () => {
    const v = await form.validateFields()
    let outHex = ''
    if (v.mode === 'raw') {
      outHex = v.callHex
    } else if (v.mode === 'media') {
      const evidence = String(v.evidenceCid || '').trim()
      if (!evidence) throw new Error('请填写证据CID')
      if (v.mediaTemplate === 'freezeAlbum') {
        outHex = (await buildMediaGovFreezeAlbumWithEv(Number(v.albumId), Boolean(v.frozen), evidence)).hex
      } else if (v.mediaTemplate === 'setHidden') {
        outHex = (await buildMediaGovSetMediaHiddenWithEvidence(Number(v.mediaId), Boolean(v.hidden), evidence)).hex
      } else if (v.mediaTemplate === 'replaceUri') {
        outHex = (await buildMediaGovReplaceMediaUriWithEvidence(Number(v.mediaId), String(v.newUri), evidence)).hex
      } else if (v.mediaTemplate === 'removeMedia') {
        outHex = (await buildMediaGovRemoveMediaWithEvidence(Number(v.mediaId), evidence)).hex
      } else if (v.mediaTemplate === 'setPrimaryImage') {
        outHex = (await buildMediaGovSetPrimaryImageFor(Number(v.deceasedId), v.primaryMediaId ? Number(v.primaryMediaId) : null, evidence)).hex
      } else if (v.mediaTemplate === 'setAlbumPrimary') {
        outHex = (await buildMediaGovSetAlbumPrimaryPhoto(Number(v.albumId), v.primaryMediaId ? Number(v.primaryMediaId) : null, evidence)).hex
      }
    } else if (v.mode === 'custom') {
      outHex = (await buildCallPreimageHex(String(v.section), String(v.method), JSON.parse(String(v.args || '[]')))).hex
    } else if (v.mode === 'text') {
      const evidence = String(v.evidenceCid || '').trim()
      if (!evidence) throw new Error('请填写证据CID')
      if (v.textTemplate === 'resolveLife') {
        outHex = (await buildTextGovResolveLifeComplaint(Number(v.deceasedId), Boolean(v.uphold), evidence)).hex
      } else if (v.textTemplate === 'resolveEulogy') {
        outHex = (await buildTextGovResolveEulogyComplaint(Number(v.textId), Boolean(v.uphold), evidence)).hex
      } else if (v.textTemplate === 'removeEulogy') {
        outHex = (await buildTextGovRemoveEulogy(Number(v.textId), evidence)).hex
      } else if (v.textTemplate === 'setArticleFor') {
        outHex = (await buildTextGovSetArticleFor(String(v.owner), Number(v.deceasedId), String(v.cid), v.title ? String(v.title) : null, v.summary ? String(v.summary) : null, evidence)).hex
      }
    } else if (v.mode === 'offerings') {
      const evidence = String(v.evidenceCid || '').trim()
      if (!evidence) throw new Error('请填写证据CID')
      if (v.offeringsTemplate === 'setParams') {
        const ow = v.offerWindow ? Number(v.offerWindow) : null
        const om = v.offerMaxInWindow ? Number(v.offerMaxInWindow) : null
        const min = v.minOfferAmount ? Number(v.minOfferAmount) : null
        outHex = (await buildOfferingsGovSetOfferParams(ow, om, min, evidence)).hex
      } else if (v.offeringsTemplate === 'setPrice') {
        const k = Number(v.kindCode)
        // 前端将三态输入映射为链上双层 Option：
        // fixedPrice: ''/未填 → null(保持)；'null' → { Some: null }(删除)；数值 → { Some: Number }
        const fp = (v.fixedPrice === '' || v.fixedPrice == null)
          ? null
          : (String(v.fixedPrice).toLowerCase() === 'null' ? { Some: null } : { Some: Number(v.fixedPrice) })
        const up = (v.unitPricePerWeek === '' || v.unitPricePerWeek == null)
          ? null
          : (String(v.unitPricePerWeek).toLowerCase() === 'null' ? { Some: null } : { Some: Number(v.unitPricePerWeek) })
        outHex = (await buildOfferingsGovSetOfferingPrice(k, fp, up, evidence)).hex
      } else if (v.offeringsTemplate === 'pauseGlobal') {
        outHex = (await buildOfferingsGovSetPauseGlobal(Boolean(v.paused), evidence)).hex
      } else if (v.offeringsTemplate === 'pauseDomain') {
        outHex = (await buildOfferingsGovSetPauseDomain(Number(v.domain), Boolean(v.paused), evidence)).hex
      }
    }
    setHex(outHex)
    const s = await summarizePreimage(outHex)
    setSummary(s || '')
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 12 }}>
      <Typography.Title level={4}>治理工单（失钥救济/内容治理）</Typography.Title>
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        message="提示"
        description="请先根据具体场景在下方生成将要执行的预映像（RuntimeCall hex），并填写证据 CID。押金与挑战期以运行时与治理轨道为准，提交后请在详情页关注进度。"/>

      <Card title="动作生成">
        <Form form={form} layout="vertical" initialValues={{ mode: 'media' }}>
          <Form.Item label="模式" name="mode">
            <Radio.Group>
              <Radio.Button value="media">媒体治理模板</Radio.Button>
              <Radio.Button value="text">文本治理模板</Radio.Button>
              <Radio.Button value="offerings">供奉治理模板</Radio.Button>
              <Radio.Button value="custom">自定义 section.method + args</Radio.Button>
              <Radio.Button value="raw">直接输入 callHex</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(p, c) => p.mode !== c.mode}>
            {({ getFieldValue }) => {
              const mode = getFieldValue('mode')
              if (mode === 'media') {
                return (
                  <>
                    <Form.Item label="模板" name="mediaTemplate" rules={[{ required: true, message: '请选择模板' }]}>
                      <Radio.Group>
                        <Radio value="freezeAlbum">冻结相册</Radio>
                        <Radio value="setHidden">隐藏/取消隐藏媒体</Radio>
                        <Radio value="replaceUri">替换媒体URI</Radio>
                        <Radio value="removeMedia">移除媒体</Radio>
                        <Radio value="setPrimaryImage">设置逝者主图</Radio>
                        <Radio value="setAlbumPrimary">设置相册主图</Radio>
                      </Radio.Group>
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate={(p, c) => p.mediaTemplate !== c.mediaTemplate}>
                      {({ getFieldValue }) => {
                        const t = getFieldValue('mediaTemplate')
                        if (t === 'freezeAlbum') {
                          return (
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Form.Item label="albumId" name="albumId" rules={[{ required: true, message: '请输入 albumId' }]}>
                                <Input inputMode="numeric" placeholder="数字"/>
                              </Form.Item>
                              <Form.Item label="冻结?" name="frozen" initialValue={true}>
                                <Radio.Group>
                                  <Radio value={true}>冻结</Radio>
                                  <Radio value={false}>解冻</Radio>
                                </Radio.Group>
                              </Form.Item>
                            </Space>
                          )
                        }
                        if (t === 'setHidden') {
                          return (
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Form.Item label="mediaId" name="mediaId" rules={[{ required: true, message: '请输入 mediaId' }]}>
                                <Input inputMode="numeric" placeholder="数字"/>
                              </Form.Item>
                              <Form.Item label="隐藏?" name="hidden" initialValue={true}>
                                <Radio.Group>
                                  <Radio value={true}>隐藏</Radio>
                                  <Radio value={false}>取消隐藏</Radio>
                                </Radio.Group>
                              </Form.Item>
                            </Space>
                          )
                        }
                        if (t === 'replaceUri') {
                          return (
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Form.Item label="mediaId" name="mediaId" rules={[{ required: true, message: '请输入 mediaId' }]}>
                                <Input inputMode="numeric" placeholder="数字"/>
                              </Form.Item>
                              <Form.Item label="newUri" name="newUri" rules={[{ required: true, message: '请输入新URI（IPFS/HTTPS）' }]}>
                                <Input placeholder="ipfs://... 或 https://..."/>
                              </Form.Item>
                            </Space>
                          )
                        }
                        if (t === 'removeMedia') {
                          return (
                            <Form.Item label="mediaId" name="mediaId" rules={[{ required: true, message: '请输入 mediaId' }]}>
                              <Input inputMode="numeric" placeholder="数字"/>
                            </Form.Item>
                          )
                        }
                        if (t === 'setPrimaryImage') {
                          return (
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Form.Item label="deceasedId" name="deceasedId" rules={[{ required: true, message: '请输入 deceasedId' }]}>
                                <Input inputMode="numeric" placeholder="数字"/>
                              </Form.Item>
                              <Form.Item label="primaryMediaId(为空=清空)" name="primaryMediaId">
                                <Input inputMode="numeric" placeholder="数字或留空"/>
                              </Form.Item>
                            </Space>
                          )
                        }
                        if (t === 'setAlbumPrimary') {
                          return (
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Form.Item label="albumId" name="albumId" rules={[{ required: true, message: '请输入 albumId' }]}>
                                <Input inputMode="numeric" placeholder="数字"/>
                              </Form.Item>
                              <Form.Item label="primaryMediaId(为空=清空)" name="primaryMediaId">
                                <Input inputMode="numeric" placeholder="数字或留空"/>
                              </Form.Item>
                            </Space>
                          )
                        }
                        return null
                      }}
                    </Form.Item>
                  </>
                )
              }
              if (mode === 'text') {
                return (
                  <>
                    <Form.Item label="模板" name="textTemplate" rules={[{ required: true, message: '请选择模板' }]}>
                      <Radio.Group>
                        <Radio value="resolveLife">裁决生平投诉</Radio>
                        <Radio value="resolveEulogy">裁决悼词投诉</Radio>
                        <Radio value="removeEulogy">治理移除悼词</Radio>
                        <Radio value="setArticleFor">治理代表设置文章</Radio>
                      </Radio.Group>
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate={(p, c) => p.textTemplate !== c.textTemplate}>
                      {({ getFieldValue }) => {
                        const t = getFieldValue('textTemplate')
                        if (t === 'resolveLife') {
                          return (
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Form.Item label="deceasedId" name="deceasedId" rules={[{ required: true, message: '请输入 deceasedId' }]}>
                                <Input inputMode="numeric" placeholder="数字"/>
                              </Form.Item>
                              <Form.Item label="维持投诉?" name="uphold" initialValue={true}>
                                <Radio.Group>
                                  <Radio value={true}>维持</Radio>
                                  <Radio value={false}>驳回</Radio>
                                </Radio.Group>
                              </Form.Item>
                            </Space>
                          )
                        }
                        if (t === 'resolveEulogy') {
                          return (
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Form.Item label="textId" name="textId" rules={[{ required: true, message: '请输入 textId' }]}>
                                <Input inputMode="numeric" placeholder="数字"/>
                              </Form.Item>
                              <Form.Item label="维持投诉?" name="uphold" initialValue={true}>
                                <Radio.Group>
                                  <Radio value={true}>维持</Radio>
                                  <Radio value={false}>驳回</Radio>
                                </Radio.Group>
                              </Form.Item>
                            </Space>
                          )
                        }
                        if (t === 'removeEulogy') {
                          return (
                            <Form.Item label="textId" name="textId" rules={[{ required: true, message: '请输入 textId' }]}>
                              <Input inputMode="numeric" placeholder="数字"/>
                            </Form.Item>
                          )
                        }
                        if (t === 'setArticleFor') {
                          return (
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Form.Item label="owner(SS58)" name="owner" rules={[{ required: true, message: '请输入 owner' }]}>
                                <Input placeholder="SS58 地址"/>
                              </Form.Item>
                              <Form.Item label="deceasedId" name="deceasedId" rules={[{ required: true, message: '请输入 deceasedId' }]}>
                                <Input inputMode="numeric" placeholder="数字"/>
                              </Form.Item>
                              <Form.Item label="cid" name="cid" rules={[{ required: true, message: '请输入 CID' }]}>
                                <Input placeholder="ipfs://... 或 https://..."/>
                              </Form.Item>
                              <Form.Item label="title(可空)" name="title"><Input/></Form.Item>
                              <Form.Item label="summary(可空)" name="summary"><Input/></Form.Item>
                            </Space>
                          )
                        }
                        return null
                      }}
                    </Form.Item>
                  </>
                )
              }
              if (mode === 'offerings') {
                return (
                  <>
                    <Form.Item label="模板" name="offeringsTemplate" rules={[{ required: true, message: '请选择模板' }]}> 
                      <Radio.Group>
                        <Radio value="setParams">更新风控参数</Radio>
                        <Radio value="setPrice">更新定价</Radio>
                        <Radio value="pauseGlobal">全局暂停/恢复</Radio>
                        <Radio value="pauseDomain">域暂停/恢复</Radio>
                      </Radio.Group>
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate={(p, c) => p.offeringsTemplate !== c.offeringsTemplate}>
                      {({ getFieldValue }) => {
                        const t = getFieldValue('offeringsTemplate')
                        if (t === 'setParams') {
                          return (
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Form.Item label="offerWindow(块，可空)" name="offerWindow"><Input inputMode="numeric" placeholder="留空=保持"/></Form.Item>
                              <Form.Item label="offerMaxInWindow(次数，可空)" name="offerMaxInWindow"><Input inputMode="numeric" placeholder="留空=保持"/></Form.Item>
                              <Form.Item label="minOfferAmount(Planck，可空)" name="minOfferAmount"><Input inputMode="numeric" placeholder="留空=保持"/></Form.Item>
                            </Space>
                          )
                        }
                        if (t === 'setPrice') {
                          return (
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Form.Item label="kindCode" name="kindCode" rules={[{ required: true, message: '请输入 kindCode' }]}>
                                <Input inputMode="numeric" placeholder="数字"/>
                              </Form.Item>
                              <Form.Item label="fixedPrice(Planck)" name="fixedPrice">
                                <Input placeholder="三态输入：空=保持；输入 null=删除；输入数字=设置"/>
                              </Form.Item>
                              <Form.Item label="unitPricePerWeek(Planck)" name="unitPricePerWeek">
                                <Input placeholder="三态输入：空=保持；输入 null=删除；输入数字=设置"/>
                              </Form.Item>
                            </Space>
                          )
                        }
                        if (t === 'pauseGlobal') {
                          return (
                            <Form.Item label="暂停?" name="paused" initialValue={true}>
                              <Radio.Group>
                                <Radio value={true}>暂停</Radio>
                                <Radio value={false}>恢复</Radio>
                              </Radio.Group>
                            </Form.Item>
                          )
                        }
                        if (t === 'pauseDomain') {
                          return (
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Form.Item label="domain" name="domain" rules={[{ required: true, message: '请输入 domain' }]}>
                                <Input inputMode="numeric" placeholder="数字"/>
                              </Form.Item>
                              <Form.Item label="暂停?" name="paused" initialValue={true}>
                                <Radio.Group>
                                  <Radio value={true}>暂停</Radio>
                                  <Radio value={false}>恢复</Radio>
                                </Radio.Group>
                              </Form.Item>
                            </Space>
                          )
                        }
                        return null
                      }}
                    </Form.Item>
                  </>
                )
              }
              if (mode === 'custom') {
                return (
                  <>
                    <Form.Item label="section" name="section" rules={[{ required: true, message: '请输入 section' }]}>
                      <Input placeholder="如 treasury"/>
                    </Form.Item>
                    <Form.Item label="method" name="method" rules={[{ required: true, message: '请输入 method' }]}>
                      <Input placeholder="如 spend"/>
                    </Form.Item>
                    <Form.Item label="args(JSON)" name="args" rules={[{ required: true, message: '请输入 JSON 数组' }]}>
                      <Input.TextArea rows={3} placeholder='如 ["1000000000000","5F..."]'/>
                    </Form.Item>
                  </>
                )
              }
              return (
                <Form.Item label="callHex" name="callHex" rules={[{ required: true, message: '请输入 Call hex' }]}>
                  <Input.TextArea rows={3} placeholder="0x...（Call bytes）"/>
                </Form.Item>
              )
            }}
          </Form.Item>

          <Form.Item>
            <Button type="primary" block onClick={onGenerate}>生成预映像与摘要</Button>
          </Form.Item>

          {hex ? (
            <Card size="small" title="生成结果" style={{ marginTop: 8 }}>
              <Typography.Paragraph copyable>callHex: {hex}</Typography.Paragraph>
              {summary && <Typography.Paragraph>摘要：{summary}</Typography.Paragraph>}
            </Card>
          ) : null}
        </Form>
      </Card>

      <Card title="证据与风控提示" style={{ marginTop: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Form layout="vertical">
            <Form.Item label="证据 CID (IPFS/HTTPS，明文存储)" name="evidenceCid" required>
              <Input placeholder="ipfs://... 或 https://..."/>
            </Form.Item>
          </Form>
          <Alert type="warning" showIcon message="押金与挑战期" description="
            - 预映像与提交可能需要押金，退还规则以运行时为准。
            - 内容治理建议设置确认期与最小延迟执行，便于异议与撤回。
            - 失钥救济应附充分证据，并接受公开审计与回溯。"/>
        </Space>
      </Card>
    </div>
  )
}

export default GovTicketPage


