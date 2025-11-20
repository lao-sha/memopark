/**
 * 函数级详细中文注释：上传图片到 IPFS 脚本
 * 
 * 用途：
 * - 将下载的供奉品图片上传到 IPFS
 * - 生成 CID 映射文件
 * - 供链端初始化脚本使用
 * 
 * 使用方法：
 * 1. 确保 IPFS 节点运行中
 * 2. 安装依赖: npm install ipfs-http-client
 * 3. 运行: node scripts/upload-images-to-ipfs.js
 */

const fs = require('fs');
const path = require('path');
const { create } = require('ipfs-http-client');

/**
 * 函数级详细中文注释：主函数
 */
async function main() {
  console.log('🚀 开始上传图片到 IPFS...\n');

  // 连接到本地 IPFS 节点
  const ipfs = create({
    host: 'localhost',
    port: 5001,
    protocol: 'http'
  });

  console.log('✅ 已连接到 IPFS 节点\n');

  // 读取图片目录
  const imagesDir = path.join(__dirname, 'images');
  const files = fs.readdirSync(imagesDir);

  console.log(`📦 找到 ${files.length} 个图片文件\n`);

  const cidMap = {}; // 文件名 -> CID 的映射
  let successCount = 0;
  let failCount = 0;

  // 上传每个文件
  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filepath = path.join(imagesDir, filename);

    try {
      console.log(`[${i + 1}/${files.length}] 上传: ${filename}`);

      // 读取文件
      const fileContent = fs.readFileSync(filepath);

      // 上传到 IPFS
      const result = await ipfs.add(fileContent, {
        pin: true // 固定文件
      });

      const cid = result.cid.toString();
      cidMap[filename] = cid;
      successCount++;

      console.log(`   ✅ CID: ${cid}`);

    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✨ IPFS 上传完成！');
  console.log('='.repeat(80));
  console.log(`✅ 成功: ${successCount} 个`);
  console.log(`❌ 失败: ${failCount} 个`);
  console.log(`📊 成功率: ${((successCount / (successCount + failCount)) * 100).toFixed(2)}%\n`);

  // 保存 CID 映射文件
  const cidMapPath = path.join(__dirname, 'ipfs-cid-map.json');
  fs.writeFileSync(cidMapPath, JSON.stringify(cidMap, null, 2), 'utf-8');
  console.log(`📄 CID 映射已保存到: ${cidMapPath}\n`);

  // 生成供链端使用的映射文件（名称 -> CID）
  const imageMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'image-map.json'), 'utf-8'));
  const offeringCidMap = {};

  for (const [name, filename] of Object.entries(imageMap)) {
    if (cidMap[filename]) {
      offeringCidMap[name] = cidMap[filename];
    }
  }

  const offeringCidMapPath = path.join(__dirname, 'offering-cid-map.json');
  fs.writeFileSync(offeringCidMapPath, JSON.stringify(offeringCidMap, null, 2), 'utf-8');
  console.log(`📄 供奉品 CID 映射已保存到: ${offeringCidMapPath}\n`);

  console.log('✅ 脚本执行完成\n');
}

// 运行主函数
main().catch((error) => {
  console.error('\n❌ 脚本执行失败:', error);
  process.exit(1);
});

