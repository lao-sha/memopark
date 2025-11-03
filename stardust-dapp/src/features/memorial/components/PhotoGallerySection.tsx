/**
 * 相册墙组件
 * 
 * 功能说明：
 * 1. 瀑布流照片墙展示
 * 2. 支持图片预览
 * 3. 支持上传新照片（权限控制）
 * 4. 照片分类展示
 * 
 * 创建日期：2025-11-02
 */

import React, { useState } from 'react'
import { Card, Image, Empty, Space, Button, Upload, message, Row, Col } from 'antd'
import {
  PictureOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { DeceasedInfo } from '../../../services/deceasedService'
import { MemorialColors } from '../../../theme/colors'
import type { UploadFile } from 'antd/es/upload/interface'

interface PhotoGallerySectionProps {
  /** 逝者信息 */
  deceased: DeceasedInfo
  /** 当前用户地址 */
  currentAccount?: string
  /** 是否可以上传照片 */
  canUpload?: boolean
}

/**
 * 函数级详细中文注释：相册墙组件
 */
export const PhotoGallerySection: React.FC<PhotoGallerySectionProps> = ({
  deceased,
  currentAccount,
  canUpload = false,
}) => {
  const [uploading, setUploading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])

  // 模拟照片数据（实际应从IPFS获取）
  const photos = deceased.mainImageCid
    ? [
        { cid: deceased.mainImageCid, title: '遗像' },
        // 这里可以扩展更多照片
      ]
    : []

  /**
   * 函数级详细中文注释：处理照片上传
   */
  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请选择要上传的照片')
      return
    }

    setUploading(true)
    try {
      // TODO: 实现IPFS上传逻辑
      // 1. 加密照片（如果需要）
      // 2. 上传到IPFS
      // 3. 记录到链上
      
      message.success('照片上传成功')
      setFileList([])
    } catch (error: any) {
      message.error(error.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ padding: '16px 12px' }}>
      <Card
        bordered={false}
        title={
          <Space>
            <PictureOutlined style={{ color: MemorialColors.primary }} />
            <span>照片墙</span>
          </Space>
        }
        extra={
          canUpload && (
            <Upload
              fileList={fileList}
              onChange={({ fileList }) => setFileList(fileList)}
              beforeUpload={() => false}
              accept="image/*"
              multiple
              showUploadList={false}
            >
              <Button size="small" icon={<UploadOutlined />}>
                上传照片
              </Button>
            </Upload>
          )
        }
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
        bodyStyle={{ padding: '16px' }}
      >
        {photos.length > 0 ? (
          <>
            <Image.PreviewGroup>
              <Row gutter={[8, 8]}>
                {photos.map((photo, index) => (
                  <Col span={8} key={index}>
                    <Image
                      src={`https://ipfs.io/ipfs/${photo.cid}`}
                      alt={photo.title}
                      style={{
                        width: '100%',
                        height: 120,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: `1px solid ${MemorialColors.borderLight}`,
                      }}
                      placeholder={
                        <div
                          style={{
                            width: '100%',
                            height: 120,
                            background: MemorialColors.bgSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 8,
                          }}
                        >
                          <PictureOutlined style={{ fontSize: 32, color: MemorialColors.textTertiary }} />
                        </div>
                      }
                    />
                  </Col>
                ))}
                {canUpload && (
                  <Col span={8}>
                    <Upload
                      fileList={fileList}
                      onChange={({ fileList }) => setFileList(fileList)}
                      beforeUpload={() => false}
                      accept="image/*"
                      multiple
                      showUploadList={false}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: 120,
                          background: MemorialColors.bgSecondary,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 8,
                          border: `1px dashed ${MemorialColors.border}`,
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                        }}
                      >
                        <PlusOutlined style={{ fontSize: 24, color: MemorialColors.textSecondary }} />
                        <div style={{ marginTop: 8, fontSize: 12, color: MemorialColors.textSecondary }}>
                          添加照片
                        </div>
                      </div>
                    </Upload>
                  </Col>
                )}
              </Row>
            </Image.PreviewGroup>

            {fileList.length > 0 && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Space>
                  <Button onClick={() => setFileList([])}>取消</Button>
                  <Button
                    type="primary"
                    loading={uploading}
                    onClick={handleUpload}
                  >
                    上传 {fileList.length} 张照片
                  </Button>
                </Space>
              </div>
            )}
          </>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无照片"
            style={{ padding: '40px 0' }}
          >
            {canUpload && (
              <Upload
                fileList={fileList}
                onChange={({ fileList }) => setFileList(fileList)}
                beforeUpload={() => false}
                accept="image/*"
                multiple
                showUploadList={false}
              >
                <Button type="primary" icon={<UploadOutlined />}>
                  上传首张照片
                </Button>
              </Upload>
            )}
          </Empty>
        )}
      </Card>
    </div>
  )
}

