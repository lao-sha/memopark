#!/bin/bash

# 八字知识库测试脚本

echo "🧪 开始测试八字知识库..."
echo ""

# 测试1: 检查知识库文件是否存在
echo "📋 测试1: 检查知识库文件完整性"
echo "-----------------------------------"

check_file() {
    if [ -f "$1" ]; then
        echo "✅ $1 存在"
        return 0
    else
        echo "❌ $1 不存在"
        return 1
    fi
}

check_file "knowledge/bazi/basics/tiangan.json"
check_file "knowledge/bazi/basics/dizhi.json"
check_file "knowledge/bazi/basics/wuxing.json"
check_file "knowledge/bazi/basics/shishen.json"
check_file "knowledge/bazi/patterns/zhengge.json"
check_file "knowledge/bazi/yongshen/tiaohuo.json"
check_file "knowledge/bazi/interpretations/core_rules.json"

echo ""

# 测试2: 验证JSON格式
echo "📋 测试2: 验证JSON格式正确性"
echo "-----------------------------------"

validate_json() {
    if python3 -m json.tool "$1" > /dev/null 2>&1; then
        echo "✅ $1 JSON格式正确"
        return 0
    else
        echo "❌ $1 JSON格式错误"
        python3 -m json.tool "$1"
        return 1
    fi
}

validate_json "knowledge/bazi/basics/tiangan.json"
validate_json "knowledge/bazi/basics/dizhi.json"
validate_json "knowledge/bazi/basics/wuxing.json"
validate_json "knowledge/bazi/basics/shishen.json"
validate_json "knowledge/bazi/patterns/zhengge.json"
validate_json "knowledge/bazi/yongshen/tiaohuo.json"
validate_json "knowledge/bazi/interpretations/core_rules.json"

echo ""

# 测试3: 统计知识库内容
echo "📋 测试3: 知识库内容统计"
echo "-----------------------------------"

echo "天干条目数:"
cat knowledge/bazi/basics/tiangan.json | grep -o '"[甲乙丙丁戊己庚辛壬癸]":' | wc -l

echo "地支条目数:"
cat knowledge/bazi/basics/dizhi.json | grep -o '"[子丑寅卯辰巳午未申酉戌亥]":' | wc -l

echo "格局条目数:"
cat knowledge/bazi/patterns/zhengge.json | grep -o '".*格":' | wc -l

echo ""

# 测试4: 查询示例
echo "📋 测试4: 知识库查询示例"
echo "-----------------------------------"

echo "查询甲木信息:"
python3 << 'EOF'
import json
with open('knowledge/bazi/basics/tiangan.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    jia = data.get('甲', {})
    print(f"五行: {jia.get('wuxing')}")
    print(f"阴阳: {jia.get('yinyang')}")
    print(f"象义: {jia.get('image')}")
    print(f"性格: {jia.get('nature')}")
EOF

echo ""
echo "查询正官格信息:"
python3 << 'EOF'
import json
with open('knowledge/bazi/patterns/zhengge.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    zhengguan = data.get('正官格', {})
    print(f"定义: {zhengguan.get('definition')}")
    print(f"人生层次: {zhengguan.get('life_level')}")
    print(f"适合职业: {', '.join(zhengguan.get('career', []))}")
EOF

echo ""
echo "🎉 所有测试完成！"
