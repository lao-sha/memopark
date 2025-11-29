#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 读取路由配置
const routesContent = fs.readFileSync('./src/routes.tsx', 'utf-8');
const appContent = fs.readFileSync('./src/App.tsx', 'utf-8');

// 提取所有页面文件
const featuresDir = './src/features';
const allPages = [];

function findPages(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findPages(fullPath);
    } else if (file.match(/(Page|Form)\.tsx$/)) {
      allPages.push(fullPath);
    }
  });
}

findPages(featuresDir);

// 提取路由中使用的页面
const usedPages = new Set();

// 从 routes.tsx 中提取
const routeMatches = routesContent.matchAll(/import\(['"]\.\/features\/([^'"]+)['"]\)/g);
for (const match of routeMatches) {
  usedPages.add(`./src/features/${match[1]}.tsx`);
}

// 从 App.tsx 中提取直接导入的
const appMatches = appContent.matchAll(/import.*from ['"]\.\/features\/([^'"]+)['"]/g);
for (const match of appMatches) {
  usedPages.add(`./src/features/${match[1]}.tsx`);
}

// 找出未使用的页面
const unusedPages = allPages.filter(page => !usedPages.has(page));

console.log('=== 未使用的页面 ===\n');
unusedPages.forEach(page => {
  console.log(page.replace('./src/features/', ''));
});

console.log(`\n总计: ${unusedPages.length} 个未使用的页面`);
console.log(`已使用: ${usedPages.size} 个页面`);
console.log(`全部页面: ${allPages.length} 个`);
