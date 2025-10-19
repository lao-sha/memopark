/**
 * 应用入口
 * 函数级中文注释：挂载 React 应用到 DOM
 */

import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App.tsx';
import './index.css';

/**
 * 函数级中文注释：移除 React.StrictMode
 * - 避免开发模式下的双重挂载
 * - 防止 API 连接被意外断开
 * - 生产环境本就不使用 Strict Mode
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConfigProvider locale={zhCN}>
    <App />
  </ConfigProvider>,
);

