import React from 'react';
// import UIShowcase from './UIShowcase'; // 如果需要演示页面，取消注释

// 如果需要查看 UI 组件库演示，请将 App.tsx 中的内容替换为：
/*
import UIShowcase from './components/ui/UIShowcase';

function App() {
  return <UIShowcase />;
}

export default App;
*/

// 快速集成示例：在现有页面中使用新组件
function QuickIntegrationExample() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* 导入并使用新的 UI 组件 */}
      <div className="p-8">
        <h1 className="text-white text-2xl mb-4">Memopark UI 组件集成示例</h1>
        <p className="text-gray-300 mb-6">
          查看 memopark-dapp/src/components/ui/ 目录中的组件库
        </p>
        <p className="text-gray-300 mb-6">
          阅读 UI-GUIDE.md 了解使用方法
        </p>
        <p className="text-gray-300">
          参考 UI-IMPROVEMENT-SUMMARY.md 了解设计理念
        </p>
      </div>
    </div>
  );
}

// 导出组件以供使用
export default QuickIntegrationExample;
