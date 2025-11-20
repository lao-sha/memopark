/**
 * GraveDetailPage 主逝者功能集成指南
 *
 * 这个文件展示了如何在现有的 GraveDetailPage 中集成主逝者功能
 * 需要进行的修改包括：导入、组件集成和标识显示
 *
 * 创建日期：2025-11-10
 */

// ========================================
// 1. 在文件顶部添加导入
// ========================================

// 在现有导入中添加：
import PrimaryDeceasedManager, {
  SimplePrimaryBadge,
  InlinePrimaryInfo
} from '../../components/grave/PrimaryDeceasedManager'
import '../../components/grave/PrimaryDeceasedManager.css'
import { usePrimaryDeceased } from '../../hooks/usePrimaryDeceased'

// ========================================
// 2. 在组件状态中添加主逝者相关状态
// ========================================

// 在现有状态声明后添加：
const { primaryDeceasedId, isPrimary, loading: primaryLoading } = usePrimaryDeceased({
  graveId: graveId || 0
})

// ========================================
// 3. 修改 Tabs 配置以添加主逝者管理页面
// ========================================

// 在现有的 tabs items 中添加主逝者管理标签页：
const tabItems = [
  {
    key: 'deceased',
    label: '逝者信息',
    children: (
      <div>
        {/* 现有的逝者信息内容 */}

        {/* 主逝者管理组件 */}
        {graveId && (
          <PrimaryDeceasedManager
            graveId={graveId}
            deceasedList={deceased.map(d => ({
              id: d.id,
              name: d.name || '未知',
              gender: d.gender,
              birth: d.birth || undefined,
              death: d.death || undefined,
              mainImageCid: d.mainImageCid || undefined,
              owner: d.owner
            }))}
            onDataChange={() => {
              // 刷新逝者数据的回调
              loadData()
            }}
            style={{ marginTop: 16 }}
          />
        )}
      </div>
    )
  },
  // ... 其他已存在的标签页
]

// ========================================
// 4. 在逝者列表中添加主逝者标识
// ========================================

// 修改逝者列表渲染，在每个逝者项后添加主逝者标识：
const renderDeceasedItem = (item: any) => (
  <List.Item
    key={item.id}
    actions={[
      <Button key="detail" type="link" onClick={() => openDetail(item)}>
        查看详情
      </Button>
    ]}
  >
    <List.Item.Meta
      avatar={<Avatar src={item.mainImageCid ? `/ipfs/${item.mainImageCid}` : undefined} />}
      title={
        <Space>
          <Text>{item.name}</Text>
          {/* 添加主逝者标识 */}
          <SimplePrimaryBadge isPrimary={isPrimary(item.id)} />
        </Space>
      }
      description={`${item.gender || '未知'} • ${item.birth || ''} - ${item.death || '现在'}`}
    />
  </List.Item>
)

// ========================================
// 5. 在墓位封面区域显示主逝者信息
// ========================================

// 在墓位基本信息卡片中添加主逝者信息展示：
const primaryDeceased = deceased.find(d => d.id === primaryDeceasedId)

const GraveInfoCard = () => (
  <Card title="墓位信息">
    {/* 现有的墓位信息 */}
    <Descriptions column={1}>
      <Descriptions.Item label="墓位ID">{graveInfo?.id}</Descriptions.Item>
      <Descriptions.Item label="所有者">{graveInfo?.owner}</Descriptions.Item>

      {/* 添加主逝者信息展示 */}
      <Descriptions.Item label="主逝者">
        <InlinePrimaryInfo
          deceased={primaryDeceased ? {
            id: primaryDeceased.id,
            name: primaryDeceased.name || '未知',
            gender: primaryDeceased.gender,
            birth: primaryDeceased.birth || undefined,
            death: primaryDeceased.death || undefined,
            mainImageCid: primaryDeceased.mainImageCid || undefined,
            owner: primaryDeceased.owner
          } : null}
          loading={primaryLoading}
        />
      </Descriptions.Item>

      {/* 其他现有字段 */}
    </Descriptions>
  </Card>
)

// ========================================
// 6. 在墓位标题中突出显示主逝者
// ========================================

// 修改页面标题，包含主逝者信息：
const PageHeader = () => (
  <div className="grave-header">
    <Title level={2}>
      {graveInfo?.name || `墓位 #${graveId}`}
    </Title>

    {/* 主逝者信息副标题 */}
    {primaryDeceased && (
      <div style={{ marginTop: 8, fontSize: 16 }}>
        <InlinePrimaryInfo
          deceased={{
            id: primaryDeceased.id,
            name: primaryDeceased.name || '未知',
            gender: primaryDeceased.gender,
            birth: primaryDeceased.birth || undefined,
            death: primaryDeceased.death || undefined,
            mainImageCid: primaryDeceased.mainImageCid || undefined,
            owner: primaryDeceased.owner
          }}
          loading={primaryLoading}
        />
      </div>
    )}
  </div>
)

// ========================================
// 7. 响应主逝者变更事件
// ========================================

// 在组件中添加事件监听：
import { usePrimaryDeceasedEvents } from '../../hooks/usePrimaryDeceased'

// 在组件内部添加：
usePrimaryDeceasedEvents(
  (event) => {
    if (event.graveId === graveId) {
      // 主逝者变更时的处理
      message.success(
        event.type === 'set'
          ? `主逝者已设置为 ${deceased.find(d => d.id === event.deceasedId)?.name || '未知'}`
          : '主逝者设置已清除'
      )

      // 刷新页面数据
      loadData()
    }
  },
  graveId || undefined
)

// ========================================
// 8. 完整的修改后组件示例（关键部分）
// ========================================

const GraveDetailPageWithPrimaryDeceased: React.FC = () => {
  // 现有状态...

  // 添加主逝者 hook
  const { primaryDeceasedId, isPrimary, loading: primaryLoading } = usePrimaryDeceased({
    graveId: graveId || 0
  })

  // 事件监听
  usePrimaryDeceasedEvents(
    (event) => {
      if (event.graveId === graveId) {
        message.info(
          event.type === 'set'
            ? `主逝者已更新`
            : '主逝者设置已清除'
        )
        loadData()
      }
    },
    graveId || undefined
  )

  // 获取主逝者信息
  const primaryDeceased = deceased.find(d => d.id === primaryDeceasedId)

  return (
    <div className="grave-detail-page">
      {/* 页面头部 */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={2}>
          {graveInfo?.name || `墓位 #${graveId}`}
        </Title>

        {/* 主逝者信息展示 */}
        {primaryDeceased && (
          <div style={{ marginTop: 12 }}>
            <InlinePrimaryInfo
              deceased={{
                id: primaryDeceased.id,
                name: primaryDeceased.name || '未知',
                gender: primaryDeceased.gender,
                birth: primaryDeceased.birth || undefined,
                death: primaryDeceased.death || undefined,
                mainImageCid: primaryDeceased.mainImageCid || undefined,
                owner: primaryDeceased.owner
              }}
              loading={primaryLoading}
            />
          </div>
        )}
      </Card>

      {/* 标签页 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'deceased',
            label: '逝者管理',
            children: (
              <div>
                {/* 现有逝者列表 */}
                <List
                  dataSource={deceased}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button key="detail" type="link" onClick={() => openDetail(item)}>
                          查看详情
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<Avatar src={item.mainImageCid ? `/ipfs/${item.mainImageCid}` : undefined} />}
                        title={
                          <Space>
                            <Text>{item.name}</Text>
                            <SimplePrimaryBadge isPrimary={isPrimary(item.id)} />
                          </Space>
                        }
                        description={`${item.gender || '未知'} • ${item.birth || ''} - ${item.death || '现在'}`}
                      />
                    </List.Item>
                  )}
                />

                {/* 主逝者管理组件 */}
                {graveId && (
                  <PrimaryDeceasedManager
                    graveId={graveId}
                    deceasedList={deceased.map(d => ({
                      id: d.id,
                      name: d.name || '未知',
                      gender: d.gender,
                      birth: d.birth || undefined,
                      death: d.death || undefined,
                      mainImageCid: d.mainImageCid || undefined,
                      owner: d.owner
                    }))}
                    onDataChange={loadData}
                    style={{ marginTop: 24 }}
                  />
                )}
              </div>
            )
          },
          // 其他现有标签页...
        ]}
      />
    </div>
  )
}

// ========================================
// 9. 应用修改的步骤总结
// ========================================

/*
要将主逝者功能集成到现有的 GraveDetailPage，需要执行以下步骤：

1. 添加必要的导入语句
2. 在组件中添加 usePrimaryDeceased hook
3. 添加主逝者事件监听
4. 在逝者列表中添加主逝者标识
5. 在墓位信息中显示主逝者
6. 添加 PrimaryDeceasedManager 组件
7. 更新页面样式和布局

修改后的页面将提供：
- 主逝者视觉标识
- 主逝者设置和管理功能
- 实时事件更新
- 权限控制
- 用户友好的交互体验
*/