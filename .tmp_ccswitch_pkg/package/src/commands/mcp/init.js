/**
 * MCP 配置初始化命令
 */

const { findProjectRoot } = require('../../lib/project-root');
const { writeMcpConfig, getAvailableMcpSources, readMcpConfig } = require('../../lib/mcp-manager');
const interactive = require('../../lib/interactive');
const path = require('path');
const fs = require('fs').promises;

/**
 * 检查文件是否存在
 */
async function checkExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 显示 MCP init 帮助信息
 */
function showMcpInitHelp() {
  console.log(`
MCP 配置初始化 (mcp init)

用法:
  ccswitch mcp init [选项]

选项:
  --force, -f    强制覆盖现有配置
  --help, -h     显示帮助信息

描述:
  初始化项目 MCP 配置文件 (.mcp.json)，支持以下功能：
  • 创建基础 MCP 配置文件
  • 交互式选择常用的 MCP 服务器
  • 支持从模板或全局配置导入
  • 安全覆盖现有配置

示例:
  ccswitch mcp init              # 交互式初始化
  ccswitch mcp init --force      # 强制覆盖现有配置
`);
}

/**
 * 创建基础配置文件
 */
async function createBaseConfig() {
  const baseConfig = {
    mcpServers: {}
  };

  // 尝试从全局配置导入一些常用的服务器
  try {
    const sources = await getAvailableMcpSources();
    const globalServers = sources.filter(s => s.source === 'global');

    // 自动导入一些常用的全局服务器
    const commonGlobalServers = ['memory', 'filesystem'];
    const importedServers = [];

    for (const serverName of commonGlobalServers) {
      const globalServer = globalServers.find(s => s.name === serverName);
      if (globalServer) {
        baseConfig.mcpServers[serverName] = { ...globalServer.config };
        importedServers.push(serverName);
      }
    }

    if (importedServers.length > 0) {
      console.log(`✅ 已从全局配置导入: ${importedServers.join(', ')}`);
    }
  } catch (error) {
    // 忽略全局配置导入错误
  }

  return baseConfig;
}

/**
 * 交互式选择单个 MCP 服务器
 */
async function interactiveSelectMcpServer() {
  try {
    console.log('🔍 正在扫描可用的 MCP 服务器...');
    const sources = await getAvailableMcpSources();

    if (sources.length === 0) {
      console.log('⚠️  未找到可用的 MCP 服务器模板');
      return null;
    }

    // 构建可选择的服务器列表
    const choices = sources.map((source) => {
      const icon = source.source === 'builtin' ? '📦' : '🖥️';
      return {
        name: `${icon} ${source.name} - ${source.description}`,
        value: source,
        short: source.name
      };
    });

    console.log('\n💡 提示: 推荐初学者选择以下服务器:');
    console.log('   • memory - 持久化对话上下文');
    console.log('   • filesystem - 文件系统访问');
    console.log('   • 输入 q 跳过选择，创建空配置文件');

    const selectedServer = await interactive.select(
      choices,
      '请选择要添加的 MCP 服务器 (输入序号，回车确认)'
    );

    if (!selectedServer) {
      console.log('⚠️  跳过服务器选择，将创建空配置文件');
      return null;
    }

    const source = selectedServer.value;

    // 构建配置
    const config = { mcpServers: {} };
    config.mcpServers[source.name] = { ...source.config };

    console.log(`✅ 已添加: ${source.name}`);
    return config;
  } catch (error) {
    console.log('⚠️  交互式选择失败:', error.message);
    return null;
  }
}

/**
 * MCP 初始化命令
 */
async function initMcp(args) {
  // 检查帮助选项
  if (args.includes('--help') || args.includes('-h')) {
    showMcpInitHelp();
    return;
  }

  const forceMode = args.includes('--force') || args.includes('-f');

  try {
    console.log('🚀 正在初始化 MCP 配置...\n');

    // 查找项目根目录
    const projectRoot = await findProjectRoot();
    if (!projectRoot) {
      console.error('❌ 无法确定项目根目录');
      return;
    }

    const mcpConfigPath = path.join(projectRoot, '.mcp.json');

    // 检查现有配置
    if (!forceMode && await checkExists(mcpConfigPath)) {
      console.log('⚠️  MCP 配置文件已存在:', mcpConfigPath);
      console.log();

      const interactive = require('../../lib/interactive');
      const overwrite = await interactive.confirm(
        '是否覆盖现有配置？',
        false
      );

      if (!overwrite) {
        console.log('❌ 操作已取消');
        return;
      }
      console.log();
    }

    // 直接让用户选择 MCP 服务器
    console.log('💡 选择要添加的 MCP 服务器:');
    config = await interactiveSelectMcpServer();
    if (!config) {
      config = await createBaseConfig();
    }

    // 确保有基础配置
    if (!config || !config.mcpServers) {
      config = { mcpServers: {} };
    }

    // 写入配置文件
    await writeMcpConfig(config, projectRoot);

    console.log('\n✅ MCP 配置初始化完成!');
    console.log('📍 配置文件:', mcpConfigPath);
    console.log('🔧 已配置服务器数量:', Object.keys(config.mcpServers).length);

    if (Object.keys(config.mcpServers).length > 0) {
      console.log('\n📋 已配置的服务器:');
      Object.keys(config.mcpServers).forEach(name => {
        console.log(`  • ${name}`);
      });
    }

    console.log('\n💡 下一步操作:');
    console.log('  • ccswitch mcp list    - 查看配置状态');
    console.log('  • ccswitch mcp add     - 添加更多服务器');
    console.log('  • ccswitch mcp edit    - 编辑服务器配置');

  } catch (error) {
    console.error('❌ MCP 配置初始化失败:', error.message);
    console.error('\n🔧 你可以尝试以下解决方案:');
    console.error('  • 确保在项目根目录下运行命令');
    console.error('  • 检查文件写入权限');
    console.error('  • 使用 --force 强制覆盖现有配置');
  }
}

module.exports = initMcp;