# 墓地详情新UI 信息架构与交互规范

## 目标
精简现有 `GraveDetailPage` 巨型组件，拆分独立可维护模块，提升首屏渲染速度与后续扩展性（媒体增量加载、权限控制、国际化）。

## 页面主结构（移动优先）
1. GraveCover（封面）
2. GraveMeta（墓地元信息/统计/操作）
3. DeceasedCarousel（逝者横向滚动列表）
4. GraveContentTabs（Tabs：Life | Albums | Videos | Articles | Messages）
5. PanelContent（懒加载具体面板）
6. ActionBar（底部固定操作）

桌面端：封面保持全宽；下方两列：左侧 Meta+Deceased 列（约 300~340px），右侧 Tabs + Panel（剩余宽度）。

## 断点与布局
- Mobile: 0 - 767px 单列
- Tablet: 768 - 1023px 适度放宽间距
- Desktop: >= 1024px 双列（CSS Grid: `grid-template-columns: 320px 1fr; gap: 24px;`）

## 视觉（初始简化）
| 用途 | 颜色 | 说明 |
| ---- | ---- | ---- |
| 背景 | #f7f9fc | 页面背景浅灰 |
| 模块卡片 | #ffffff | 基础卡片底色 |
| 强调主色 | #1677ff | 操作/高亮（Ant Design 主色）|
| 警告/私密Tag | #faad14 | 私密/未激活提醒 |
| 成功/激活Tag | #52c41a | Active 状态 |
| 危险操作 | #ff4d4f | 删除/危险操作 |

## 状态规范
### Loading
- 封面：灰色块 + 渐变动画（CSS skeleton）
- 逝者列表：显示 3~4 个圆形/方形 skeleton
- Tabs 内容：首屏 Life 自动加载，其余 Tab 首次点开再显示 skeleton

### Empty
| 面板 | 展示文案 | CTA |
| ---- | ---- | ---- |
| Life | 暂无生平内容 | （Owner）添加生平 |
| Albums | 暂无相册 | （Owner）创建相册 |
| Videos | 暂无视频 | （Owner）添加视频 |
| Articles | 暂无文章 | （Owner）发表文章 |
| Messages | 暂无留言 | 去留言 |

### Error Block
统一组件：`<ErrorBlock message="加载失败" onRetry={fn} />`
- 只在当前面板请求失败时出现，不影响其它面板

## 交互细节
### GraveCover
- 返回按钮：`window.history.length > 1 ? history.back() : location.hash='#/grave/my'`
- 分享：复制当前 `location.href`
- 编辑封面：仅 Owner 显示（触发上传/设置 CID Modal）

### GraveMeta
- 显示：墓地名称（不足时显示“未命名墓地 #ID”）、Owner 地址缩写、可见性（公开/私密 Tag）、激活状态
- 统计：逝者数 | 相册 | 视频 | 文章 | 留言（通过各 Hook 结果统计）

### DeceasedCarousel
- 水平滚动（CSS snap + overflow-x）
- Item：头像 + 姓名 + 生卒年（若有）
- 点击：切换 LifePanel 显示对应逝者生平；高亮选中

### Tabs
- 默认激活 Life
- 切换后更新 URL query：`tab=albums` 等
- 已加载的面板缓存 state

### Panel 内容策略
- LifePanel：若多逝者，顶部出现头像选择条（横向）
- Albums：只展示相册卡片，不展开全部照片（避免首屏大流量）
- Videos：展示视频封面（IPFS 缩略图占位）+ 标题
- Articles：列表（标题 + 80 字摘要）
- Messages：最近 10 条 -> “加载更多” 分页 size=10

### ActionBar
- 游客：按钮（供奉、留言、分享）
- Owner：按钮（供奉、添加逝者、管理）
- 固定底部（移动），桌面端可改成右下悬浮（后续）

## Hooks 数据契约（初稿）
```ts
interface GraveInfo { id: number; name?: string; owner?: string; slug?: string; isPublic?: boolean; active?: boolean; coverCid?: string }
interface Deceased { id: number; name?: string; birth?: string|null; death?: string|null; genderCode?: number; mainImageCid?: string; lifeCid?: string }
interface MediaAlbum { albumId: number; coverCid?: string; count: number; title?: string }
interface VideoItem { id: string; title?: string; uri?: string }
interface ArticleItem { id: string; title?: string; summary?: string; uri?: string }
interface MessageItem { id: number; cid: string; text?: string }
```

## 事件/回调命名
| 事件 | 命名 | 说明 |
| ---- | ---- | ---- |
| 选择逝者 | onSelectDeceased(id) | 切换生平面板展示对象 |
| 刷新某面板 | onRefresh() | 重新发起 hook 请求 |
| 添加留言 | onAddMessage(text) | 成功后刷新 messages |
| 创建相册 | onCreateAlbum(meta) | 成功后刷新 albums |

## 键盘与无障碍（后续）
- Tabs 支持左右箭头切换（后续）
- 图片有 alt（CID 截断）

## 性能策略（V1）
- 并发：首屏只请求 Grave + Deceased 基础，两次 Promise.all
- 其它面板点击时才请求并缓存
- 可用 stale flag + `useRef` 防止重复调度

## 未来扩展
- Incremental Streaming：大相册分页
- 离线缓存：IndexedDB 保存最近浏览墓地数据
- 权限层：基于链上 role 检查隐藏私密媒体

---
> 下一阶段：生成组件/页面骨架。
