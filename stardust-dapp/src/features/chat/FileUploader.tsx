/**
 * 文件上传组件
 * 
 * 功能：
 * - 支持图片上传（jpg, png, gif, webp）
 * - 支持文件上传（pdf, doc, docx, txt等）
 * - 文件大小限制（默认10MB）
 * - 文件预览
 * - 上传进度显示
 */

import React, { useState, useRef } from 'react';
import { Upload, Button, Modal, Image, message, Progress } from 'antd';
import {
  PictureOutlined,
  FileOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { uploadFileToIpfs } from '../../lib/chat-ipfs';
import './FileUploader.css';

interface FileUploaderProps {
  /** 文件上传成功回调 */
  onFileUploaded: (file: {
    cid: string;
    name: string;
    size: number;
    type: 'image' | 'file';
    url?: string;
  }) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 文件上传组件
 */
export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileUploaded,
  disabled = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  /** 支持的图片格式 */
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  /** 支持的文件格式 */
  const FILE_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed',
  ];

  /** 文件大小限制（10MB） */
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  /**
   * 处理文件选择
   */
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'image' | 'file'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const allowedTypes = type === 'image' ? IMAGE_TYPES : FILE_TYPES;
    if (!allowedTypes.includes(file.type)) {
      message.error(`不支持的${type === 'image' ? '图片' : '文件'}格式`);
      return;
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      message.error('文件大小不能超过 10MB');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // 上传到 IPFS
      const result = await uploadFileToIpfs(file);
      
      setUploadProgress(100);

      // 生成预览 URL（仅图片）
      let previewUrl: string | undefined;
      if (type === 'image') {
        previewUrl = URL.createObjectURL(file);
      }

      // 回调
      onFileUploaded({
        cid: result.cid,
        name: file.name,
        size: file.size,
        type,
        url: previewUrl,
      });

      message.success('上传成功');
    } catch (error) {
      console.error('上传失败:', error);
      message.error('上传失败，请重试');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // 清空输入框
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  /**
   * 触发图片选择
   */
  const handleSelectImage = () => {
    imageInputRef.current?.click();
  };

  /**
   * 触发文件选择
   */
  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-uploader">
      {/* 隐藏的文件输入框 */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => handleFileChange(e, 'image')}
        disabled={disabled || uploading}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.zip,.rar"
        style={{ display: 'none' }}
        onChange={(e) => handleFileChange(e, 'file')}
        disabled={disabled || uploading}
      />

      {/* 上传按钮 */}
      <div className="file-uploader-buttons">
        <Button
          icon={<PictureOutlined />}
          onClick={handleSelectImage}
          disabled={disabled || uploading}
          size="small"
        >
          图片
        </Button>
        <Button
          icon={<FileOutlined />}
          onClick={handleSelectFile}
          disabled={disabled || uploading}
          size="small"
        >
          文件
        </Button>
      </div>

      {/* 上传进度 */}
      {uploading && (
        <div className="file-uploader-progress">
          <Progress percent={uploadProgress} size="small" />
        </div>
      )}
    </div>
  );
};

