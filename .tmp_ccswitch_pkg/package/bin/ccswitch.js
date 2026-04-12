#!/usr/bin/env node

/**
 * @bainiu/ccswitch - CLI 入口
 * 项目级模型切换 & MCP 启用工具
 */

const path = require('path');
const CommandManager = require(path.join(__dirname, '../src/commands'));

/**
 * CLI 入口点
 * 解析命令行参数并路由到相应的命令处理程序
 */
async function main() {
    const [, , ...args] = process.argv;

    // 如果没有参数或参数是 --help/-h，显示帮助信息
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        showHelp();
        process.exit(0);
    }

    const command = args[0];

    try {
        await CommandManager.execute(command, args.slice(1));
    } catch (error) {
        console.error('\n❌ 错误:', error.message);
        process.exit(1);
    }
}

/**
 * 显示帮助信息
 */
function showHelp() {
    console.log(`
ccswitch v${require('../package.json').version} — 项目级模型切换 & MCP 管理工具

用法：
  ccswitch <命令> [子命令] [选项]

命令：
  model          模型管理命令
    [无参数]     交互式模型选择和切换（默认）
    list         列出已安装的模型
    add [name]   添加新模型配置（支持模板）
    use <name>   切换到指定模型
    current      显示当前模型状态
    key          修改当前项目 API 密钥
    help         显示模型命令帮助

  mcp            MCP 服务器管理
    list         列出已配置的 MCP 服务器
    add          添加新的 MCP 服务器
    edit         编辑现有 MCP 配置
    remove       删除 MCP 服务器配置
    help         显示 MCP 命令帮助

示例：
  ccswitch model                 # 交互式选择模型（带快捷键支持）
  ccswitch model list            # 查看已安装的模型
  ccswitch model add GLM         # 添加 GLM 模型配置
  ccswitch model use kimi-k2     # 切换到 Kimi 模型
  ccswitch model current         # 查看当前模型状态
  ccswitch model key             # 修改 API 密钥

  ccswitch mcp list              # 查看已配置的 MCP 服务器
  ccswitch mcp add               # 添加新 MCP 服务器
  ccswitch mcp edit memory       # 编辑 memory 服务器配置
  ccswitch mcp remove puppeteer  # 删除 puppeteer 服务器

别名支持：
  mcp rm, mcp delete             # 等同于 mcp remove
  mcp update                     # 等同于 mcp edit

模型模板：
  GLM, MiniMax-M2, Kimi-k2       # 内置支持的模型模板

MCP 服务器模板：
  memory, filesystem, github     # 内置 MCP 服务器模板
  puppeteer, web-search

更多信息请访问: https://git.code.tencent.com/bainiu/open-source/ccswitch
  `);
}

// 运行 CLI
if (require.main === module) {
    main();
}

module.exports = { main };
