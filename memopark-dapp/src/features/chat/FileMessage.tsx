/**
 * 文件消息组件
 * 
 * 功能：
 * - 显示文件信息
 * - 文件下载按钮
 * - 文件图标（根据类型）
 */

import React from 'react';
import { Button, Typography, Space } from 'antd';
import {
  FilePdfOutlined,
  FileWordOutlined,
  FileTextOutlined,
  FileZipOutlined,
  FileOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { getIpfsUrl } from '../../lib/chat-ipfs';
import './FileMessage.css';

const { Text } = Typography;

interface FileMessageProps {
  /** 文件名 */
  fileName: string;
  /** 文件大小（字节） */
  fileSize: number;
  /** IPFS CID */
  fileCid: string;
}

/**
 * 文件消息组件
 */
export const FileMessage: React.FC<FileMessageProps> = ({
  fileName,
  fileSize,
  fileCid,
}) => {
  /**
   * 获取文件图标
   */
  const getFileIcon = () => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'pdf':
        return <FilePdfOutlined style={{ fontSize: 32, color: '#f5222d' }} />;
      case 'doc':
      case 'docx':
        return <FileWordOutlined style={{ fontSize: 32, color: '#1890ff' }} />;
      case 'txt':
        return <FileTextOutlined style={{ fontSize: 32, color: '#52c41a' }} />;
      case 'zip':
      case 'rar':
        return <FileZipOutlined style={{ fontSize: 32, color: '#fa8c16' }} />;
      default:
        return <FileOutlined style={{ fontSize: 32, color: '#8c8c8c' }} />;
    }
  };

  /**
   * 格式化文件大小
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  /**
   * 下载文件
   */
  const handleDownload = () => {
    const url = getIpfsUrl(fileCid);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="file-message">
      <div className="file-message-icon">{getFileIcon()}</div>
      <div className="file-message-info">
        <Text strong ellipsis={{ tooltip: fileName }} className="file-message-name">
          {fileName}
        </Text>
        <Text type="secondary" className="file-message-size">
          {formatFileSize(fileSize)}
        </Text>
      </div>
      <Button
        type="primary"
        icon={<DownloadOutlined />}
        onClick={handleDownload}
        size="small"
      >
        下载
      </Button>
    </div>
  );
};

