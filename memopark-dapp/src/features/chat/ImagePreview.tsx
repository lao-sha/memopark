/**
 * 图片预览组件
 * 
 * 功能：
 * - 显示图片缩略图
 * - 点击查看大图
 * - 支持从 IPFS 加载
 */

import React from 'react';
import { Image } from 'antd';
import { getIpfsUrl } from '../../lib/chat-ipfs';
import './ImagePreview.css';

interface ImagePreviewProps {
  /** IPFS CID 或 URL */
  src: string;
  /** 图片宽度 */
  width?: number | string;
  /** 图片高度 */
  height?: number | string;
  /** 是否显示预览按钮 */
  preview?: boolean;
}

/**
 * 图片预览组件
 */
export const ImagePreview: React.FC<ImagePreviewProps> = ({
  src,
  width = 200,
  height = 'auto',
  preview = true,
}) => {
  // 判断是否是 IPFS CID
  const imageUrl = src.startsWith('http') ? src : getIpfsUrl(src);

  return (
    <div className="image-preview">
      <Image
        src={imageUrl}
        width={width}
        height={height}
        preview={preview}
        placeholder={
          <div className="image-preview-placeholder">加载中...</div>
        }
        fallback="/placeholder-image.png"
      />
    </div>
  );
};

