/**
 * MCP list 命令实现
 * 列出当前项目中已配置的 MCP 服务器
 */

const { readMcpConfig, getProjectPaths } = require('../../lib/mcp-manager');
const { findProjectRoot } = require('../../lib/project-root');
const fs = require('fs').promises;

/**
 * 检查文件/目录是否存在
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>} 是否存在
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
 * 获取服务器状态信息
 * @param {Object} serverConfig - 服务器配置
 * @returns {Promise<Object>} 状态信息
 */
async function getServerStatus(serverConfig) {
  const status = {
    enabled: true,
    commandExists: false,
    envVarsSet: true,
    issues: [],
  };

  // 检查命令是否存在
  if (serverConfig.command) {
    try {
      // 简单的命令存在性检查（在 Unix 系统上）
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec(`which ${serverConfig.command.split(' ')[0]}`, (error) => {
          if (error) {
            status.commandExists = false;
            status.issues.push(`命令未找到: ${serverConfig.command}`);
            reject(error);
          } else {
            status.commandExists = true;
            resolve();
          }
        });
      });
    } catch {
      // 忽略命令检查错误，在某些系统上可能不支持
    }
  }

  // 检查环境变量
  if (serverConfig.env) {
    for (const [key, value] of Object.entries(serverConfig.env)) {
      if (value && value.includes('<') && value.includes('>')) {
        status.envVarsSet = false;
        status.issues.push(`环境变量未设置: ${key}`);
      }
    }
  }

  return status;
}

/**
 * 格式化服务器信息显示
 * @param {Object} serverConfig - 服务器配置
 * @param {string} name - 服务器名称
 * @param {Object} status - 服务器状态
 * @param {boolean} verbose - 是否显示详细信息
 */
function formatServerInfo(serverConfig, name, status, verbose = false) {
  const statusIcon = status.enabled ? '✅' : '❌';
  const commandIcon = status.commandExists ? '✅' : '❌';
  const envIcon = status.envVarsSet ? '✅' : '❌';

  console.log(`  ${statusIcon} ${name}`);

  if (verbose) {
    console.log(`    命令: ${serverConfig.command}`);
    if (serverConfig.args && serverConfig.args.length > 0) {
      console.log(`    参数: ${serverConfig.args.join(' ')}`);
    }
    if (serverConfig.env) {
      console.log('    环境变量:');
      for (const [key, value] of Object.entries(serverConfig.env)) {
        const displayValue = value.includes('<') && value.includes('>') ? '[未设置]' : value;
        console.log(`      ${key}: ${displayValue}`);
      }
    }
    console.log(`    状态: 命令${commandIcon} 环境变量${envIcon}`);

    if (status.issues.length > 0) {
      console.log('    问题:');
      status.issues.forEach(issue => {
        console.log(`      ⚠️  ${issue}`);
      });
    }
  }

  console.log();
}

/**
 * 处理 MCP list 命令
 * @param {Array} args - 命令参数
 */
async function handleMcpList(args) {
  // 检查是否请求帮助
  if (args.includes('--help') || args.includes('-h')) {
    showMcpListHelp();
    return;
  }

  try {
    const projectRoot = await findProjectRoot();
    const { mcpConfig } = getProjectPaths(projectRoot);

    console.log('📋 MCP 服务器配置列表');
    console.log('📍 项目根目录:', projectRoot);
    console.log('📄 配置文件:', mcpConfig);
    console.log();

    // 检查配置文件是否存在
    if (!(await checkExists(mcpConfig))) {
      console.log('❌ 未找到 MCP 配置文件 (.mcp.json)');
      console.log();
      console.log('💡 提示: 运行以下命令初始化 MCP 配置:');
      console.log('   ccswitch mcp init');
      return;
    }

    // 读取 MCP 配置
    const config = await readMcpConfig(projectRoot);
    if (!config) {
      console.log('❌ MCP 配置文件格式无效或为空');
      return;
    }

    const servers = config.mcpServers;
    const serverNames = Object.keys(servers);

    if (serverNames.length === 0) {
      console.log('📝 当前未配置任何 MCP 服务器');
      console.log();
      console.log('💡 提示: 运行以下命令添加 MCP 服务器:');
      console.log('   ccswitch mcp add');
      return;
    }

    // 显示服务器列表
    console.log(`🔧 已配置 ${serverNames.length} 个 MCP 服务器:`);
    console.log();

    const verbose = args.includes('--verbose') || args.includes('-v');

    for (const [name, serverConfig] of Object.entries(servers)) {
      const status = await getServerStatus(serverConfig);
      formatServerInfo(serverConfig, name, status, verbose);
    }

    // 显示摘要信息
    const enabledCount = serverNames.length; // 所有配置的服务器都视为启用
    console.log(`📊 摘要: ${enabledCount} 个服务器已配置, ${serverNames.length - enabledCount} 个服务器已禁用`);

  } catch (error) {
    console.error('❌ 读取 MCP 配置失败:', error.message);
    process.exit(1);
  }
}

/**
 * 显示 MCP list 命令帮助信息
 */
function showMcpListHelp() {
  console.log(`
MCP 服务器列表 (list)

用法:
  ccswitch mcp list [选项]

选项:
  -v, --verbose  显示详细的服务器信息
  -h, --help     显示此帮助信息

功能:
  • 列出当前项目中已配置的 MCP 服务器
  • 显示服务器状态和配置信息
  • 检查命令可用性和环境变量设置
  • 支持简洁和详细两种显示模式

示例:
  ccswitch mcp list                # 简洁列表
  ccswitch mcp list --verbose      # 详细信息
  ccswitch mcp list -v             # 详细信息（简写）

输出说明:
  ✅ 服务器名称                     - 服务器已启用
  ❌ 服务器名称                     - 服务器已禁用
  命令✅                           - 命令可用
  环境变量✅                       - 环境变量已设置
  ⚠️  问题信息                      - 配置问题提醒

更多信息请访问项目文档。
  `);
}

module.exports = {
  handler: handleMcpList,
  help: showMcpListHelp,
};