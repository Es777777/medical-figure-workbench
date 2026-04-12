# `@bainiu/ccswitch`

> 项目级模型切换 & MCP 启用工具（Claude Code）

[![npm version](https://img.shields.io/badge/npm-v0.1.8-blue.svg)](https://www.npmjs.com/package/@bainiu/ccswitch)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org/)
[![MIT License](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

一个功能完整的命令行工具，用于管理 Claude Code 模型配置和 MCP (Model Context Protocol) 服务器。支持零配置安装、交互式操作和简单易用的命令接口。

## ✨ 特性

- 🎯 **零配置安装**：使用 `npx` 直接运行，无需全局安装
- 🔄 **智能模型管理**：添加、切换、查看模型配置，支持 API 密钥管理
- 🔢 **数字快速选择**：交互式界面支持数字输入，快速切换模型，无需记住复杂名称
- 🔌 **完整 MCP 管理**：添加、编辑、删除、列出 MCP 服务器配置
- 💡 **优化交互界面**：颜色区分、清晰标记、便捷操作的现代化选择体验
- 🛡️ **安全设计**：区分本地和团队配置，支持密钥安全注入和管理
- 📦 **丰富模板系统**：内置 GLM、MiniMax、Kimi 等模型模板和多种 MCP 服务器模板

## 🚀 快速开始

### 安装

```bash
# 无需安装，使用 npx 直接运行
npx @bainiu/ccswitch --help
```

### 基本使用

```bash
# 交互式模型选择和切换（默认命令）
npx @bainiu/ccswitch

# 查看已安装模型
npx @bainiu/ccswitch model list

# 添加新模型配置（支持模板）
npx @bainiu/ccswitch model add

# 查看 MCP 服务器配置
npx @bainiu/ccswitch mcp list
```

## 📚 使用指南

### 模型管理 (`model`)

```bash
# 交互式模型选择和切换（默认行为）
# 支持数字快速选择，无需记住复杂模型名
npx @bainiu/ccswitch model

# 列出已安装模型
npx @bainiu/ccswitch model list

# 添加新模型配置（支持模板选择）
npx @bainiu/ccswitch model add [modelName]

# 切换到指定模型
npx @bainiu/ccswitch model use <modelName>

# 查看当前模型配置
npx @bainiu/ccswitch model current

# 修改当前项目 API 密钥
npx @bainiu/ccswitch model key

# 查看帮助
npx @bainiu/ccswitch model help
```

#### 交互式模型选择

使用 `npx @bainiu/ccswitch model` 命令会进入交互式选择界面：

```
🔄 模型切换选择

📍 当前模型: Kimi-k2 (Moonshot AI)

请选择要切换的模型:

 1. GLM - 智谱AI
 2. Kimi-k2 - Moonshot AI → [当前]
 3. 修改当前项目 API Key

请选择模型 (输入序号):
```

**特性说明**：

- 🎯 **数字选择**：直接输入序号（1、2、3...）快速选择，无需记住复杂模型名
- 🎨 **视觉区分**：当前模型使用绿色 `[当前]` 标记，编辑选项使用青色显示
- ⚡ **便捷操作**：支持输入 `q` 快速退出，选择编辑选项可修改 API 密钥
- 🔄 **动态排序**：模型选项始终在前面，编辑选项固定在最后

**支持的模型模板**：

- **Anthropic** - Claude 官方模型 (claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus)
- **OpenAI** - OpenAI GPT 系列 (gpt-4o, gpt-4o-mini)
- **DeepSeek** - DeepSeek 系列模型 (deepseek-chat, deepseek-coder)
- **Qwen** - 阿里通义千问 (qwen-plus, qwen-turbo, qwen-max)
- **GLM** - 智谱清言系列模型 (glm-4.6, glm-4.5-air)
- **MiniMax-M2** - MiniMax 系列模型
- **Kimi-k2** - 月之暗面 Kimi 系列

### MCP 管理 (`mcp)

```bash
# 列出已配置的 MCP 服务器
npx @bainiu/ccswitch mcp list

# 添加新的 MCP 服务器（支持内置模板）
npx @bainiu/ccswitch mcp add

# 编辑现有 MCP 配置
npx @bainiu/ccswitch mcp edit

# 删除 MCP 服务器配置
npx @bainiu/ccswitch mcp remove

# 别名支持
npx @bainiu/ccswitch mcp rm      # 等同于 remove
npx @bainiu/ccswitch mcp update  # 等同于 edit
```

**内置 MCP 服务器模板**：

- **memory** - 持久化对话上下文
- **filesystem** - 文件系统访问
- **github** - GitHub 集成
- **puppeteer** - 网页自动化
- **web-search** - 网页搜索
- **context7** - 实时技术文档获取

## 🏗️ 架构设计

### 目录结构

```
ccswitch/
├── bin/
│   └── ccswitch.js           # CLI 入口点
├── src/
│   ├── commands/             # 命令管理层
│   │   ├── index.js          # CommandManager - 命令路由
│   │   ├── model/            # 模型管理命令
│   │   │   ├── index.js      # 命令聚合入口
│   │   │   ├── list.js       # 列出模型
│   │   │   ├── add.js        # 添加模型
│   │   │   ├── use.js        # 切换模型
│   │   │   ├── current.js    # 当前模型
│   │   │   ├── key.js        # 密钥管理
│   │   │   └── help.js       # 帮助信息
│   │   ├── mcp/              # MCP 管理命令
│   │   │   ├── index.js      # 命令聚合入口
│   │   │   ├── list.js       # 列出服务器
│   │   │   ├── add.js        # 添加服务器
│   │   │   ├── edit.js       # 编辑配置
│   │   │   └── remove.js     # 删除配置
│   └── lib/                  # 核心工具库
│       ├── project-root.js   # 项目根识别
│       ├── file-ops.js       # 文件操作
│       ├── input-processor.js # 输入处理
│       ├── interactive.js    # 终端交互
│       ├── json-handler.js   # JSON 处理
│       ├── mcp-manager.js    # MCP 管理
│       ├── model-scanner.js  # 模型扫描
│       ├── path-helper.js    # 路径处理
│       └── validators.js     # 验证器
├── template/                 # 配置模板
│   ├── models/               # 模型模板
│   │   ├── GLM.json          # 智谱清言
│   │   ├── MiniMax-M2.json   # MiniMax
│   │   └── Kimi-k2.json      # kimi-k2
│   └── mcp/                  # MCP 服务器模板
│       ├── memory.json       # 持久化上下文
│       ├── filesystem.json   # 文件系统访问
│       ├── github.json       # GitHub 集成
│       ├── puppeteer.json    # 网页自动化
│       └── web-search.json   # 网页搜索
│       ├── context7.json      # 技术文档获取
├── test/                     # Jest 测试文件
└── index.js                  # 包主入口
```

### 核心组件

#### 1. 命令管理层 (`src/commands/`)

**CommandManager** - 统一命令路由

- 负责解析命令行参数和子命令
- 路由到对应的命令处理器
- 统一错误处理和帮助信息显示
- 支持命令别名和帮助系统

**ModelCommands** - 模型管理命令集

- `list`: 列出已安装模型
- `add`: 添加新模型配置（支持模板）
- `use`: 切换到指定模型
- `current`: 显示当前模型
- `key`: 管理 API 密钥
- `help`: 显示帮助信息
- `default`: 交互式模型选择和切换

**McpCommands** - MCP 管理命令集

- `list`: 列出已配置的 MCP 服务器
- `add`: 添加新的 MCP 服务器（支持模板）
- `edit`: 编辑现有 MCP 配置
- `remove`: 删除 MCP 服务器配置
- 别名支持: `rm`, `delete` → `remove`; `update` → `edit`

#### 2. 工具库层 (`src/lib/`)

| 模块                 | 职责       | 关键特性                              |
| -------------------- | ---------- | ------------------------------------- |
| `project-root.js`    | 项目根识别 | 向上查找 `.claude/`/`.git/`，结果缓存 |
| `file-ops.js`        | 文件操作   | 跨平台路径处理，目录创建，文件读写    |
| `input-processor.js` | 输入处理   | 用户输入验证、转换和格式化            |
| `interactive.js`     | 终端交互   | TUI + 降级方案，进度条，确认提示      |
| `json-handler.js`    | JSON 处理  | 安全解析，字段验证，格式化输出        |
| `mcp-manager.js`     | MCP 管理   | MCP 服务器配置和启用逻辑              |
| `model-scanner.js`   | 模型扫描   | 扫描和发现可用模型配置                |
| `path-helper.js`     | 路径辅助   | 跨平台路径处理，路径拼接和解析        |
| `validators.js`      | 验证器     | 配置验证、数据校验和安全检查          |

#### 3. 模板系统 (`template/`)

**模型模板** - `template/models/*.json`

- **Anthropic.json**: Claude 官方模型配置
- **OpenAI.json**: OpenAI GPT 系列模型配置
- **DeepSeek.json**: DeepSeek 系列模型配置
- **Qwen.json**: 阿里通义千问模型配置
- **GLM.json**: 智谱清言系列模型配置
- **MiniMax-M2.json**: MiniMax 系列模型配置
- **Kimi-k2.json**: 月之暗面 Kimi 系列配置
- 支持 `<API_KEY>` 占位符自动替换

**MCP 模板** - `template/mcp/*.json`

- **memory.json**: 持久化对话上下文服务器
- **filesystem.json**: 文件系统访问服务器
- **github.json**: GitHub 集成服务器
- **puppeteer.json**: 网页自动化服务器
- **web-search.json**: 网页搜索服务器

## 📖 配置文件结构

### 目录约定

**模型相关**:

- **模型模板**: `template/models/*.json` (内置模板)
- **用户模型库**: `~/.ccswitch/models/*.json` (用户安装的模型)
- **项目配置**:
  - `./.claude/settings.local.json` (本地配置，可包含密钥，不提交 Git)
  - `./.claude/settings.json` (团队共享配置，无密钥，提交 Git)

**MCP 相关**:

- **MCP 模板**: `template/mcp/*.json` (内置模板)
- **用户 MCP**: `~/.ccswitch/mcp/*` (用户 MCP 配置)
- **项目配置**: `./.mcp.json` (项目根目录，共享文件)

### 文件写入语义

**重要**: 所有配置写入都是**完整文件覆盖**，不会进行字段级合并：

- 不保留现有配置内容
- 直接文件替换确保配置一致性

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- test/commands/model.test.js

# 监视模式运行测试
npm run test:watch

# 运行测试并生成覆盖率报告
npm run test:coverage

# 代码风格检查
npm run lint

# 自动修复代码风格问题
npm run lint:fix
```

**覆盖率要求**: 分支覆盖率 ≥70%，行/函数/语句覆盖率 ≥80%

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: 添加某项功能'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发规范

- **代码风格**: 遵循 [JavaScript Standard Style](https://standardjs.com/)
- **测试要求**: 为新功能添加测试用例，维持覆盖率阈值
- **文档更新**: 更新相关文档和 README
- **提交前检查**: 运行 `npm test` 和 `npm run lint` 确保无错误

### 添加新功能

1. **新命令**: 在 `src/commands/` 创建目录，实现命令逻辑
2. **命令注册**: 在 `src/commands/index.js` 的 `CommandManager.registerCommands()` 中注册
3. **工具模块**: 在 `src/lib/` 创建可复用的工具函数
4. **模板扩展**: 在 `template/` 添加新的配置模板
5. **测试覆盖**: 在 `test/` 对应目录添加测试文件

## 📝 版本历史

### v0.1.8 (当前版本)

- ✅ **新增 4 种主流模型模板**：Anthropic (Claude)、OpenAI (GPT-4o)、DeepSeek、Qwen (通义千问)
- ✅ **修复 Context7 MCP 包名**：从错误的 `@context7/mcp-server` 修复为正确的 `@upstash/context7-mcp`
- ✅ **优化 MCP 配置**：为 memory、puppeteer、web-search 添加 `-y` 参数，确保自动安装
- ✅ 现已支持 7 种模型模板 + 6 种 MCP 服务器模板

### v0.1.7

- ✅ 完整的模型管理功能：list, add, use, current, key
- ✅ 完整的 MCP 管理功能：list, add, edit, remove 及命令别名
- ✅ **优化交互式界面**：支持数字快速选择模型，无需记住复杂名称
- ✅ **视觉优化**：当前模型绿色标记，编辑选项青色显示
- ✅ 丰富的模板系统：GLM, MiniMax, Kimi 等 3 种模型 + 6 种 MCP 服务器
- ✅ 增强的输入处理和验证系统
- ✅ 完善的帮助系统和错误处理
- ✅ 项目根自动检测和安全的配置文件管理

### v0.1.0

- ✅ 初始化项目架构
- ✅ 基础命令路由系统
- ✅ 核心工具库实现
- ✅ 测试框架搭建

## ⚠️ 重要提示

1. **配置覆盖**: 所有写入操作都是完整文件覆盖，不会保留原有配置
2. **安全准则**:
   - `settings.local.json` 可包含 API 密钥引用
   - `settings.json` 和 `.mcp.json` 为共享文件，**禁止包含任何密钥**
3. **重启要求**: 更改配置后需要重启 Claude Code 会话/IDE 以生效
4. **项目检测**: 自动向上查找 `.claude/` 或 `.git/` 目录确定项目根目录
5. **版本要求**: 需要 Node.js ≥18 版本

## 🔗 相关链接

- **项目仓库**: https://git.code.tencent.com/bainiu/open-source/ccswitch
- **NPM 包**: https://www.npmjs.com/package/@bainiu/ccswitch

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！

---

**Happy Coding! 🎉**
