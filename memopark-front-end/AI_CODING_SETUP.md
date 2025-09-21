# AI 编程配置说明

本项目已配置了完整的 AI 编程环境，包含以下文件和规则：

## 📁 文件结构说明

### VS Code 配置目录 (`.vscode/`)
- **`settings.json`** - 项目级 VS Code 设置，包含 Copilot 和编辑器配置
- **`extensions.json`** - 推荐的扩展列表，团队成员打开项目时会收到安装提示
- **`launch.json`** - 调试配置，支持 AI 辅助调试

### 代码质量配置
- **`.copilotignore`** - 指定 GitHub Copilot 忽略的文件和目录
- **`eslint.config.js`** - ESLint 规则，确保 AI 生成代码的质量
- **`prettier.config.js`** - 代码格式化规则，保持代码风格一致
- **`tsconfig.json`** - TypeScript 配置，提供更好的类型检查

## 🚀 使用方法

### 1. 安装推荐扩展
打开项目后，VS Code 会提示安装推荐的扩展，点击安装即可。

### 2. 配置 GitHub Copilot
确保已登录 GitHub 账号并激活 Copilot 订阅。

### 3. 开始 AI 编程
- 使用 `Ctrl+I` (Linux/Windows) 或 `Cmd+I` (Mac) 打开 Copilot Chat
- 在代码中输入注释，Copilot 会自动提供代码建议
- 使用 `Tab` 键接受建议，`Esc` 键拒绝

## ⚙️ 自定义配置

### 修改 AI 行为
在 `.vscode/settings.json` 中可以调整：
- 启用/禁用特定文件类型的 AI 建议
- 调整自动完成的触发方式
- 配置代码格式化选项

### 添加项目特定规则
- 在 `eslint.config.js` 中添加项目特定的代码规范
- 在 `prettier.config.js` 中调整格式化偏好
- 在 `.copilotignore` 中添加需要忽略的文件

## 📝 最佳实践

1. **写清晰的注释** - AI 会根据注释生成更准确的代码
2. **使用有意义的变量名** - 帮助 AI 理解上下文
3. **保持函数简洁** - 小函数更容易被 AI 理解和补全
4. **定期检查生成的代码** - AI 建议不总是完美的，需要人工审查

## 🔧 故障排除

如果 AI 建议不工作：
1. 检查 GitHub Copilot 扩展是否已安装并登录
2. 确认当前文件类型在 `settings.json` 中没有被禁用
3. 重启 VS Code 或重新加载窗口
4. 检查网络连接是否正常

## 📚 相关资源

- [GitHub Copilot 官方文档](https://docs.github.com/en/copilot)
- [VS Code 官方文档](https://code.visualstudio.com/docs)
- [ESLint 规则参考](https://eslint.org/docs/rules/)
- [Prettier 配置选项](https://prettier.io/docs/en/options.html)
