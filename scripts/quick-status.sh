#!/bin/bash
echo "🔍 Stardust 供奉品系统状态检查"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 初始化进度"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f init-progress.log ]; then
  tail -3 init-progress.log | head -1
else
  echo "   ⚠️  日志文件不存在"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⛓️  链端数据"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
node verify-data.js 2>/dev/null | head -5

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 文件清单"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   数据文件:"
ls -lh *.json 2>/dev/null | awk '{print "      " $9 " (" $5 ")"}'
echo ""
echo "   图片文件:"
if [ -d images ]; then
  echo "      images/ ($(ls images | wc -l) 个文件)"
else
  echo "      ⚠️  images/ 目录不存在"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 前端访问"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   URL: http://127.0.0.1:5173/#/browse/category"
echo "   组件: OfferingsCatalog.tsx"
echo "   状态: ✅ 已更新"
echo ""
