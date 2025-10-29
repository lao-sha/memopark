import { Outlet } from 'react-router-dom'

/**
 * 空白布局
 * 用于登录页等不需要侧边栏和头部的页面
 */
export default function BlankLayout() {
  return <Outlet />
}

