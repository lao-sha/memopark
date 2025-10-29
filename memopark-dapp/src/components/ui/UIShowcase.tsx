import React, { useState } from 'react';
import {
  Button,
  Card,
  Input,
  Modal,
  Navigation,
  WalletConnection,
  MemorialCard,
  StatCard,
  ActivityCard,
  MemorialGalleryCard,
  type NavigationItem,
} from '../ui';

const UIShowcase: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('buttons');

  const navItems: NavigationItem[] = [
    {
      id: 'home',
      label: '首页',
      icon: '🏠',
      active: activeTab === 'home',
    },
    {
      id: 'memorial',
      label: '纪念馆',
      icon: '🏛️',
      badge: '3',
    },
    {
      id: 'offerings',
      label: '祭品',
      icon: '🕯️',
    },
    {
      id: 'governance',
      label: '治理',
      icon: '🗳️',
    },
    {
      id: 'settings',
      label: '设置',
      icon: '⚙️',
    },
  ];

  const tabs = [
    { id: 'buttons', label: '按钮组件' },
    { id: 'cards', label: '卡片组件' },
    { id: 'forms', label: '表单组件' },
    { id: 'navigation', label: '导航组件' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Navigation */}
      <Navigation
        items={navItems}
        activeItem="home"
        onItemClick={(id) => console.log('Nav clicked:', id)}
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Memopark UI 组件库
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            现代化的 Web3 设计系统，采用玻璃态拟物化风格，专为纪念园区应用设计
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'primary' : 'ghost'}
              onClick={() => setActiveTab(tab.id)}
              glassmorphism
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-12">
          {/* Buttons Section */}
          {activeTab === 'buttons' && (
            <Card className="p-8">
              <h2 className="text-2xl font-bold text-white mb-6">按钮组件</h2>
              
              <div className="space-y-8">
                {/* Button Variants */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">按钮样式</h3>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="primary">主要按钮</Button>
                    <Button variant="secondary">次要按钮</Button>
                    <Button variant="memorial">纪念按钮</Button>
                    <Button variant="ghost">幽灵按钮</Button>
                    <Button variant="danger">危险按钮</Button>
                  </div>
                </div>

                {/* Button Sizes */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">按钮尺寸</h3>
                  <div className="flex flex-wrap gap-4 items-center">
                    <Button size="sm">小按钮</Button>
                    <Button size="md">中按钮</Button>
                    <Button size="lg">大按钮</Button>
                  </div>
                </div>

                {/* Button States */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">按钮状态</h3>
                  <div className="flex flex-wrap gap-4">
                    <Button>正常状态</Button>
                    <Button loading>加载中</Button>
                    <Button disabled>禁用状态</Button>
                  </div>
                </div>

                {/* Glassmorphism */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">玻璃态效果</h3>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="primary" glassmorphism>玻璃态主要</Button>
                    <Button variant="secondary" glassmorphism>玻璃态次要</Button>
                    <Button variant="memorial" glassmorphism>玻璃态纪念</Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Cards Section */}
          {activeTab === 'cards' && (
            <div className="space-y-8">
              <h2 className="text-2xl font-bold text-white">卡片组件</h2>
              
              {/* Basic Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <h3 className="text-lg font-semibold text-white mb-2">基础卡片</h3>
                  <p className="text-gray-300">这是一个基础的卡片组件，支持玻璃态效果。</p>
                </Card>
                
                <MemorialCard>
                  <h3 className="text-lg font-semibold text-white mb-2">纪念卡片</h3>
                  <p className="text-gray-300">专为纪念内容设计的卡片，带有紫色渐变效果。</p>
                </MemorialCard>
                
                <Card hoverable onClick={() => alert('卡片被点击')}>
                  <h3 className="text-lg font-semibold text-white mb-2">可点击卡片</h3>
                  <p className="text-gray-300">这个卡片可以点击，具有悬停效果。</p>
                </Card>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                  title="总用户数"
                  value="12,345"
                  subtitle="较昨日 +5.2%"
                />
                <StatCard
                  title="纪念馆数量"
                  value="8,901"
                  subtitle="较上月 +12%"
                />
                <StatCard
                  title="祭品总额"
                  value="¥234,567"
                  subtitle="较上周 +8.5%"
                />
                <StatCard
                  title="活跃度"
                  value="98.5%"
                  subtitle="系统正常运行"
                />
              </div>

              {/* Memorial Gallery Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <MemorialGalleryCard
                  title="张三的纪念馆"
                  description="一个温馨的纪念空间，记录着美好的回忆..."
                  date="2024-01-15"
                  onClick={() => console.log('Memorial clicked')}
                />
                <MemorialGalleryCard
                  title="李四的纪念园"
                  description="充满爱与思念的永恒空间..."
                  date="2024-02-20"
                  onClick={() => console.log('Memorial clicked')}
                />
                <MemorialGalleryCard
                  title="王五的追思馆"
                  description="记录生命中最珍贵的时光..."
                  date="2024-03-10"
                  onClick={() => console.log('Memorial clicked')}
                />
              </div>

              {/* Activity Cards */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">活动记录</h3>
                <ActivityCard
                  title="祭品献给张三"
                  description="献花一束"
                  status="success"
                  timestamp="2分钟前"
                  amount="50 DUST"
                />
                <ActivityCard
                  title="创建纪念馆"
                  description="李四的纪念园已创建"
                  status="pending"
                  timestamp="10分钟前"
                />
                <ActivityCard
                  title="治理投票"
                  description="提案 #123 投票失败"
                  status="failed"
                  timestamp="1小时前"
                />
              </div>
            </div>
          )}

          {/* Forms Section */}
          {activeTab === 'forms' && (
            <Card className="p-8">
              <h2 className="text-2xl font-bold text-white mb-6">表单组件</h2>
              
              <div className="max-w-2xl space-y-6">
                <Input
                  label="用户名"
                  placeholder="请输入用户名"
                  hint="用户名应为 3-20 个字符"
                />
                
                <Input
                  label="邮箱地址"
                  type="email"
                  placeholder="example@email.com"
                  leftIcon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  }
                />
                
                <Input
                  label="密码"
                  type="password"
                  placeholder="请输入密码"
                  error="密码长度至少为 8 位"
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="名字"
                    placeholder="请输入名字"
                    size="sm"
                  />
                  <Input
                    label="姓氏"
                    placeholder="请输入姓氏"
                    size="sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-4">
                    纪念内容
                  </label>
                  <div className="space-y-4">
                    <Input
                      placeholder="纪念馆标题"
                      glassmorphism
                    />
                    {/* Note: Textarea component would go here */}
                    <div className="p-4 bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg">
                      <p className="text-gray-300">Textarea 组件 (待实现)</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button variant="primary" type="submit">
                    提交
                  </Button>
                  <Button variant="ghost" type="reset">
                    重置
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Navigation Section */}
          {activeTab === 'navigation' && (
            <div className="space-y-8">
              <h2 className="text-2xl font-bold text-white">导航组件</h2>
              
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">钱包连接</h3>
                <WalletConnection
                  onConnect={(account) => console.log('Connected:', account)}
                  onDisconnect={() => console.log('Disconnected')}
                />
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">模态对话框</h3>
                <Button onClick={() => setIsModalOpen(true)}>
                  打开模态框
                </Button>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Demo Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="演示模态框"
      >
        <div className="p-6">
          <p className="text-gray-300 mb-4">
            这是一个演示模态框，展示了玻璃态效果和现代化的设计。
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={() => setIsModalOpen(false)}>
              确认
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UIShowcase;
