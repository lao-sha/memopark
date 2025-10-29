#!/bin/bash

# ============================================================================
# IPFS核心节点公网连接检查脚本
# ============================================================================
# 功能：检查3个核心IPFS节点是否正确连接到IPFS公网DHT
# 作者：Claude Sonnet 4.5
# 日期：2025-10-27
# ============================================================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置：3个核心节点的API地址
NODES=(
    "http://localhost:5001"      # 节点1
    "http://localhost:5002"      # 节点2（如果有）
    "http://localhost:5003"      # 节点3（如果有）
)

# 节点名称
NODE_NAMES=(
    "Core Node 1"
    "Core Node 2"
    "Core Node 3"
)

# 报告文件
REPORT_FILE="ipfs-public-network-check-$(date +%Y%m%d-%H%M%S).md"

# ============================================================================
# 辅助函数
# ============================================================================

# 打印带颜色的标题
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# 打印成功消息
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 打印警告消息
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 打印错误消息
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "命令 '$1' 未找到，请先安装"
        exit 1
    fi
}

# 判断IP是否为私有地址
is_private_ip() {
    local ip=$1
    if [[ $ip =~ ^10\. ]] || \
       [[ $ip =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]] || \
       [[ $ip =~ ^192\.168\. ]] || \
       [[ $ip =~ ^127\. ]] || \
       [[ $ip =~ ^localhost$ ]]; then
        return 0
    else
        return 1
    fi
}

# IPFS API调用
ipfs_api_call() {
    local node_url=$1
    local endpoint=$2
    curl -s -X POST "${node_url}/api/v0/${endpoint}" 2>/dev/null
}

# ============================================================================
# 检查函数
# ============================================================================

# 检查1：节点是否在线
check_node_online() {
    local node_url=$1
    local node_name=$2
    
    echo "检查节点是否在线: $node_name ($node_url)"
    
    local response=$(curl -s -X POST "${node_url}/api/v0/id" 2>/dev/null)
    
    if [ -n "$response" ] && echo "$response" | grep -q "ID"; then
        print_success "节点在线"
        return 0
    else
        print_error "节点离线或无法访问"
        return 1
    fi
}

# 检查2：获取节点ID和地址
check_node_info() {
    local node_url=$1
    local node_name=$2
    
    echo -e "\n检查节点信息: $node_name"
    
    local response=$(curl -s -X POST "${node_url}/api/v0/id" 2>/dev/null)
    
    if [ -n "$response" ]; then
        local peer_id=$(echo "$response" | jq -r '.ID' 2>/dev/null)
        local addresses=$(echo "$response" | jq -r '.Addresses[]' 2>/dev/null)
        
        echo "Peer ID: $peer_id"
        echo -e "\n监听地址:"
        echo "$addresses"
        
        # 检查是否有公网地址
        local has_public=false
        while IFS= read -r addr; do
            # 提取IP地址
            local ip=$(echo "$addr" | grep -oP '/ip4/\K[0-9.]+' || echo "")
            if [ -n "$ip" ] && ! is_private_ip "$ip"; then
                has_public=true
                print_success "检测到公网地址: $addr"
            fi
        done <<< "$addresses"
        
        if [ "$has_public" = false ]; then
            print_warning "未检测到公网监听地址（仅私有地址）"
        fi
        
        echo -e "\n---" >> "$REPORT_FILE"
        echo "### $node_name" >> "$REPORT_FILE"
        echo "**Peer ID**: \`$peer_id\`" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        
        return 0
    else
        print_error "无法获取节点信息"
        return 1
    fi
}

# 检查3：Swarm连接的对等节点
check_swarm_peers() {
    local node_url=$1
    local node_name=$2
    
    echo -e "\n检查Swarm对等节点: $node_name"
    
    local response=$(curl -s -X POST "${node_url}/api/v0/swarm/peers" 2>/dev/null)
    
    if [ -n "$response" ]; then
        local total_peers=$(echo "$response" | jq -r '.Peers | length' 2>/dev/null)
        
        if [ "$total_peers" = "null" ] || [ "$total_peers" = "0" ]; then
            print_error "无对等节点连接 - 节点未连接到网络"
            echo "**对等节点数**: 0 ❌ 未连接到IPFS网络" >> "$REPORT_FILE"
            return 1
        fi
        
        echo "总对等节点数: $total_peers"
        
        # 分析公网vs私有节点
        local public_peers=0
        local private_peers=0
        
        echo "$response" | jq -r '.Peers[].Addr' 2>/dev/null | while read -r addr; do
            local ip=$(echo "$addr" | grep -oP '/ip4/\K[0-9.]+' || echo "")
            if [ -n "$ip" ]; then
                if is_private_ip "$ip"; then
                    ((private_peers++)) || true
                else
                    ((public_peers++)) || true
                fi
            fi
        done
        
        # 重新统计（因为子shell问题）
        public_peers=$(echo "$response" | jq -r '.Peers[].Addr' 2>/dev/null | grep -oP '/ip4/\K[0-9.]+' | while read ip; do
            if ! is_private_ip "$ip" 2>/dev/null; then
                echo "1"
            fi
        done | wc -l)
        
        private_peers=$((total_peers - public_peers))
        
        echo "  - 公网节点: $public_peers"
        echo "  - 私有节点: $private_peers"
        
        if [ $public_peers -gt 10 ]; then
            print_success "连接到足够的公网节点 ($public_peers个)"
            echo "**对等节点数**: $total_peers (公网: $public_peers ✓, 私有: $private_peers)" >> "$REPORT_FILE"
        elif [ $public_peers -gt 0 ]; then
            print_warning "公网节点连接较少 ($public_peers个)"
            echo "**对等节点数**: $total_peers (公网: $public_peers ⚠️, 私有: $private_peers)" >> "$REPORT_FILE"
        else
            print_error "未连接到任何公网节点 - 可能在隔离网络中"
            echo "**对等节点数**: $total_peers (公网: 0 ❌, 私有: $private_peers)" >> "$REPORT_FILE"
        fi
        
        echo "" >> "$REPORT_FILE"
        return 0
    else
        print_error "无法获取Swarm信息"
        return 1
    fi
}

# 检查4：DHT功能测试
check_dht_functionality() {
    local node_url=$1
    local node_name=$2
    
    echo -e "\n检查DHT功能: $node_name"
    
    # 使用一个已知的公开CID测试DHT查询
    local test_cid="QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"  # 测试用CID
    
    echo "测试DHT查询 (CID: $test_cid)..."
    
    # 注意：这个调用可能需要一些时间
    local response=$(curl -s -m 10 -X POST "${node_url}/api/v0/dht/findprovs?arg=${test_cid}" 2>/dev/null)
    
    if [ -n "$response" ] && echo "$response" | grep -q "ID"; then
        local provider_count=$(echo "$response" | grep -o "ID" | wc -l)
        print_success "DHT查询成功 - 找到 $provider_count 个提供者"
        echo "**DHT功能**: ✓ 正常 (找到 $provider_count 个提供者)" >> "$REPORT_FILE"
        return 0
    elif [ -n "$response" ] && echo "$response" | grep -qi "timeout"; then
        print_warning "DHT查询超时 - 网络可能较慢"
        echo "**DHT功能**: ⚠️ 超时" >> "$REPORT_FILE"
        return 1
    else
        print_error "DHT查询失败 - DHT可能未启用或网络隔离"
        echo "**DHT功能**: ❌ 失败" >> "$REPORT_FILE"
        return 1
    fi
}

# 检查5：测试内容发布和检索
check_content_routing() {
    local node_url=$1
    local node_name=$2
    
    echo -e "\n检查内容路由: $node_name"
    
    # 创建测试文件并添加到IPFS
    local test_content="test-$(date +%s)"
    local test_file="/tmp/ipfs-test-$test_content.txt"
    echo "$test_content" > "$test_file"
    
    echo "添加测试文件到IPFS..."
    local add_response=$(curl -s -X POST -F "file=@${test_file}" "${node_url}/api/v0/add" 2>/dev/null)
    
    if [ -n "$add_response" ]; then
        local test_cid=$(echo "$add_response" | jq -r '.Hash' 2>/dev/null)
        echo "测试CID: $test_cid"
        
        # 等待一下让内容传播
        sleep 2
        
        # 尝试通过公网网关检索（验证公网可达性）
        echo "通过公网网关检索测试..."
        local gateway_url="https://ipfs.io/ipfs/${test_cid}"
        local gateway_response=$(curl -s -m 10 "$gateway_url" 2>/dev/null)
        
        if [ "$gateway_response" = "$test_content" ]; then
            print_success "内容可通过公网网关访问 - 节点已连接公网"
            echo "**内容路由**: ✓ 公网可访问" >> "$REPORT_FILE"
        else
            print_warning "内容无法通过公网网关访问 - 可能需要时间传播或节点未暴露"
            echo "**内容路由**: ⚠️ 公网不可达" >> "$REPORT_FILE"
        fi
        
        # 清理测试文件
        rm -f "$test_file"
        
        return 0
    else
        print_error "无法添加测试文件"
        echo "**内容路由**: ❌ 测试失败" >> "$REPORT_FILE"
        rm -f "$test_file"
        return 1
    fi
}

# 检查6：配置检查
check_ipfs_config() {
    local node_url=$1
    local node_name=$2
    
    echo -e "\n检查IPFS配置: $node_name"
    
    # 检查关键配置项
    echo "检查Routing配置..."
    local routing=$(curl -s -X POST "${node_url}/api/v0/config?arg=Routing.Type" 2>/dev/null | jq -r '.Value' 2>/dev/null)
    
    if [ "$routing" = "dht" ] || [ "$routing" = "dhtclient" ]; then
        print_success "Routing类型: $routing (DHT已启用)"
        echo "**Routing配置**: \`$routing\` ✓" >> "$REPORT_FILE"
    else
        print_warning "Routing类型: $routing (可能未连接公网DHT)"
        echo "**Routing配置**: \`$routing\` ⚠️" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
}

# ============================================================================
# 主检查流程
# ============================================================================

main() {
    print_header "IPFS核心节点公网连接检查"
    
    # 检查必要的工具
    check_command "curl"
    check_command "jq"
    
    # 初始化报告
    cat > "$REPORT_FILE" << EOF
# IPFS核心节点公网连接检查报告

**检查时间**: $(date '+%Y-%m-%d %H:%M:%S')  
**检查目的**: 验证3个核心IPFS节点是否正确连接到IPFS公网DHT  
**检查工具**: ipfs-check-script v1.0

---

## 执行摘要

EOF

    local total_nodes=${#NODES[@]}
    local online_nodes=0
    local public_connected=0
    
    # 遍历检查每个节点
    for i in "${!NODES[@]}"; do
        local node_url="${NODES[$i]}"
        local node_name="${NODE_NAMES[$i]}"
        
        print_header "检查节点 $((i+1))/$total_nodes: $node_name"
        
        echo "## 节点 $((i+1)): $node_name" >> "$REPORT_FILE"
        echo "**API地址**: $node_url" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        
        # 1. 检查节点是否在线
        if ! check_node_online "$node_url" "$node_name"; then
            echo "**状态**: ❌ 离线" >> "$REPORT_FILE"
            echo "" >> "$REPORT_FILE"
            continue
        fi
        ((online_nodes++))
        
        # 2. 获取节点信息
        check_node_info "$node_url" "$node_name"
        
        # 3. 检查Swarm连接
        if check_swarm_peers "$node_url" "$node_name"; then
            ((public_connected++))
        fi
        
        # 4. 检查DHT功能
        check_dht_functionality "$node_url" "$node_name"
        
        # 5. 测试内容路由
        # check_content_routing "$node_url" "$node_name"  # 可选：耗时较长
        
        # 6. 检查配置
        check_ipfs_config "$node_url" "$node_name"
        
        echo "" >> "$REPORT_FILE"
    done
    
    # 生成总结
    print_header "检查完成"
    
    cat >> "$REPORT_FILE" << EOF

---

## 总结

| 指标 | 结果 |
|------|------|
| 检查节点总数 | $total_nodes |
| 在线节点数 | $online_nodes |
| 连接公网节点数 | $public_connected |

### 建议

EOF

    if [ $public_connected -eq $total_nodes ]; then
        print_success "所有核心节点均已正确连接到IPFS公网 ✓"
        echo "✅ **所有核心节点均已正确连接到IPFS公网**" >> "$REPORT_FILE"
    elif [ $public_connected -gt 0 ]; then
        print_warning "部分节点连接到IPFS公网，建议检查其他节点配置"
        cat >> "$REPORT_FILE" << EOF
⚠️ **部分节点未连接到IPFS公网**

建议操作：
1. 检查未连接节点的防火墙设置
2. 确认节点配置中的 \`Routing.Type\` 设置为 \`dht\`
3. 验证节点是否监听公网地址
4. 检查网络连通性
EOF
    else
        print_error "所有节点均未连接到IPFS公网 - 可能运行在隔离网络中"
        cat >> "$REPORT_FILE" << EOF
❌ **所有节点均未连接到IPFS公网**

**严重问题** - 节点可能运行在完全隔离的私有网络中！

立即操作：
1. 检查所有节点的网络配置
2. 验证IPFS Daemon启动参数
3. 检查 \`ipfs config Routing.Type\` 设置
4. 确认防火墙和路由器配置允许IPFS端口（默认4001）
5. 考虑使用 \`ipfs bootstrap add\` 添加公网引导节点
EOF
    fi
    
    echo "" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
    echo "**报告生成时间**: $(date '+%Y-%m-%d %H:%M:%S')" >> "$REPORT_FILE"
    
    echo -e "\n报告已保存到: ${GREEN}$REPORT_FILE${NC}"
    echo ""
    
    # 显示报告路径
    print_header "报告位置"
    echo "完整路径: $(pwd)/$REPORT_FILE"
}

# 运行主函数
main "$@"

