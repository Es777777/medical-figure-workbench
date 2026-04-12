/**
 * MCP 删除命令
 * 负责移除 MCP 服务器配置，并清理相关的环境变量
 */

const { readMcpConfig, writeMcpConfig } = require('../../lib/mcp-manager');
const { findProjectRoot } = require('../../lib/project-root');
const { getClaudeConfigPaths } = require('../../lib/path-helper');
const { readConfigFile, writeConfigFile, fileExists } = require('../../lib/file-ops');
const interactive = require('../../lib/interactive');

async function removeMcp(_args) {
  try {
    const projectRoot = await findProjectRoot();
    if (!projectRoot) {
      console.error('❌ 请在项目根目录下运行此命令');
      return;
    }

    // 1. 读取现有配置
    const config = await readMcpConfig(projectRoot);
    if (!config || !config.mcpServers || Object.keys(config.mcpServers).length === 0) {
      console.log('📭 当前没有安装任何 MCP 服务器');
      return;
    }

    // 2. 构建选择列表
    const installedNames = Object.keys(config.mcpServers);
    const choices = installedNames.map((name) => ({
      name: `${name} (${config.mcpServers[name].command})`,
      value: name,
    }));

    // 3. 交互式选择 (支持取消)
    choices.push({ name: '❌ 取消操作', value: null });

    const selected = await interactive.select(choices, '请选择要删除的 MCP 服务器');
    if (!selected || !selected.value) {
      console.log('❌ 操作已取消');
      return;
    }

    const serverName = selected.value;
    const serverConfig = config.mcpServers[serverName];

    // 4. 确认删除
    const confirmed = await interactive.confirm(`⚠️  确定要删除 "${serverName}" 吗?`, false);
    if (!confirmed) {
      console.log('❌ 操作已取消');
      return;
    }

    // 5. 执行删除 (移除 .mcp.json 中的配置)
    delete config.mcpServers[serverName];
    await writeMcpConfig(config, projectRoot);
    console.log(`\n✅ 已从 .mcp.json 中移除 "${serverName}"`);

    // 6. 深度清理 (检查 settings.local.json)
    // 如果被删除的 MCP 配置中有 env，我们检查本地配置里是否有同名 Key
    if (serverConfig.env) {
      const envKeys = Object.keys(serverConfig.env);
      if (envKeys.length > 0) {
        const paths = getClaudeConfigPaths(projectRoot);
        if (await fileExists(paths.localSettings)) {
          const localSettings = await readConfigFile(paths.localSettings);

          if (localSettings.env) {
            const keysToRemove = envKeys.filter((key) => Object.prototype.hasOwnProperty.call(localSettings.env, key));

            if (keysToRemove.length > 0) {
              console.log('\n🧹 检测到相关的环境变量(Key):', keysToRemove.join(', '));
              const shouldClean = await interactive.confirm('是否同时从 settings.local.json 中清理这些 Key?', true);

              if (shouldClean) {
                keysToRemove.forEach((key) => delete localSettings.env[key]);
                await writeConfigFile(paths.localSettings, localSettings);
                console.log('✅ 环境变量已清理');
              }
            }
          }
        }
      }
    }

    console.log('\n🔄 请重启 Claude Code 以使更改生效');
  } catch (error) {
    console.error('❌ 删除失败:', error.message);
  }
}

module.exports = removeMcp;
