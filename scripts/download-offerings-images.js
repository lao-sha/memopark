/**
 * 函数级详细中文注释：供奉品图片下载脚本
 * 
 * 用途：
 * - 从云上思念网站下载所有供奉品图片
 * - 保存到本地 images 文件夹
 * - 生成图片映射文件供 IPFS 上传使用
 * 
 * 使用方法：
 * 1. 安装依赖: npm install axios
 * 2. 运行: node scripts/download-offerings-images.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * 函数级详细中文注释：下载单个图片
 * @param {string} url - 图片URL
 * @param {string} filepath - 保存路径
 */
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    // 选择 http 或 https
    const client = url.startsWith('https') ? https : http;
    
    // 处理 URL 中的 // 问题
    url = url.replace(/([^:])\/\//g, '$1/');
    
    console.log(`   下载: ${path.basename(filepath)}`);
    
    client.get(url, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(filepath);
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
        
        fileStream.on('error', (err) => {
          fs.unlinkSync(filepath);
          reject(err);
        });
      } else {
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
      }
    }).on('error', reject);
  });
}

/**
 * 函数级详细中文注释：主函数
 */
async function main() {
  console.log('🚀 开始下载供奉品图片...\n');

  // 读取供奉品数据
  const dataPath = path.join(__dirname, 'offerings-with-images.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log(`📦 总共 ${data.total} 个供奉品\n`);

  // 创建图片保存目录
  const imagesDir = path.join(__dirname, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  // 统计信息
  let successCount = 0;
  let failCount = 0;
  const imageMap = {}; // 名称 -> 本地文件路径的映射

  // 限制并发数（避免请求过多）
  const concurrency = 5;
  const offerings = data.offerings;

  console.log('📥 开始下载图片（并发数: ' + concurrency + '）\n');

  for (let i = 0; i < offerings.length; i += concurrency) {
    const batch = offerings.slice(i, i + concurrency);
    
    console.log(`批次 ${Math.floor(i / concurrency) + 1}/${Math.ceil(offerings.length / concurrency)}`);
    
    await Promise.allSettled(
      batch.map(async (item) => {
        try {
          // 提取文件名
          const url = item.imageUrl;
          const filename = path.basename(url);
          const filepath = path.join(imagesDir, filename);

          // 跳过已下载的文件
          if (fs.existsSync(filepath)) {
            imageMap[item.name] = filename;
            return;
          }

          // 下载图片
          await downloadImage(url, filepath);
          
          // 记录映射
          imageMap[item.name] = filename;
          successCount++;
          
        } catch (error) {
          console.error(`   ❌ 失败: ${item.name} - ${error.message}`);
          failCount++;
        }
      })
    );
  }

  console.log('\n' + '='.repeat(80));
  console.log('✨ 图片下载完成！');
  console.log('='.repeat(80));
  console.log(`✅ 成功: ${successCount} 个`);
  console.log(`❌ 失败: ${failCount} 个`);
  console.log(`📊 成功率: ${((successCount / (successCount + failCount)) * 100).toFixed(2)}%\n`);

  // 保存图片映射文件
  const mapPath = path.join(__dirname, 'image-map.json');
  fs.writeFileSync(mapPath, JSON.stringify(imageMap, null, 2), 'utf-8');
  console.log(`📄 图片映射已保存到: ${mapPath}\n`);

  console.log('✅ 脚本执行完成\n');
}

// 运行主函数
main().catch((error) => {
  console.error('\n❌ 脚本执行失败:', error);
  process.exit(1);
});

