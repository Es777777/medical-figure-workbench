/**
 * MCP 编辑命令
 * 允许修改 MCP 服务器的参数 (args) 和环境变量 (env)
 */

const { readMcpConfig, writeMcpConfig } = require('../../lib/mcp-manager');
const { findProjectRoot } = require('../../lib/project-root');
const { getClaudeConfigPaths } = require('../../lib/path-helper');
const { readConfigFile, writeConfigFile, fileExists } = require('../../lib/file-ops');
const interactive = require('../../lib/interactive');

async function editMcp(_args) {
  try {
    const projectRoot = await findProjectRoot();
    if (!projectRoot) {
      console.error('❌ 请在项目根目录下运行此命令');
      return;
    }

    // 1. 读取配置
    const config = await readMcpConfig(projectRoot);
    if (!config || !config.mcpServers || Object.keys(config.mcpServers).length === 0) {
      console.log('📭 当前没有安装任何 MCP 服务器');
      return;
    }

    // 2. 选择要编辑的服务器
    const choices = Object.keys(config.mcpServers).map((name) => ({
      name: name,
      value: name,
    }));
    choices.push({ name: '❌ 取消', value: null });

    const selectedServer = await interactive.select(choices, '请选择要编辑的服务器');
    if (!selectedServer || !selectedServer.value) return;

    const serverName = selectedServer.value;
    const serverConfig = config.mcpServers[serverName];

    console.log(`\n🔧 正在编辑: ${serverName}`);

    // 3. 选择编辑项
    const actionChoices = [
      { name: '📝 修改启动参数 (Args) - 如文件路径', value: 'args' },
      { name: '🔑 修改环境变量 (Env) - 如 API Key', value: 'env' },
      { name: '❌ 取消', value: null },
    ];

    const action = await interactive.select(actionChoices, '请选择编辑内容');
    if (!action || !action.value) return;

    // 4. 执行编辑逻辑
    if (action.value === 'args') {
      await editArgs(serverConfig, serverName, config, projectRoot);
    } else if (action.value === 'env') {
      await editEnv(serverConfig, serverName, config, projectRoot);
    }
  } catch (error) {
    console.error('❌ 编辑失败:', error.message);
  }
}

/**
 * 编辑启动参数
 */
async function editArgs(serverConfig, serverName, fullConfig, projectRoot) {
  console.log('\n当前参数:', JSON.stringify(serverConfig.args, null, 2));
  console.log('💡 提示: 请输入新的参数数组 (JSON格式)，或者直接按回车跳过');

  // 将数组转换为字符串作为默认值
  const defaultVal = JSON.stringify(serverConfig.args);
  const input = await interactive.askInput('新参数', false, defaultVal);

  try {
    const newArgs = JSON.parse(input);
    if (!Array.isArray(newArgs)) throw new Error('必须是数组');

    serverConfig.args = newArgs;

    // 保存
    await writeMcpConfig(fullConfig, projectRoot);
    console.log('✅ 参数已更新');
    console.log('🔄 请重启 Claude Code 以生效');
  } catch (e) {
    console.error('❌ 格式错误: 参数必须是合法的 JSON 数组');
  }
}

/**
 * 编辑环境变量
 */
async function editEnv(serverConfig, serverName, fullConfig, projectRoot) {
  const currentEnv = serverConfig.env || {};
  const envKeys = Object.keys(currentEnv);

  if (envKeys.length === 0) {
    console.log('⚠️  该服务器当前没有配置环境变量。');
    const add = await interactive.confirm('是否添加新的环境变量?', true);
    if (!add) return;

    const key = await interactive.askInput('请输入变量名 (如 MY_API_KEY)');
    if (!key) return;
    envKeys.push(key);
    currentEnv[key] = ''; // 初始化
  }

  // 选择要修改的 Key
  const keyChoices = envKeys.map((k) => ({ name: `${k} = ${maskValue(currentEnv[k])}`, value: k }));
  keyChoices.push({ name: '➕ 添加新变量', value: 'NEW_VAR' });

  const selectedKey = await interactive.select(keyChoices, '请选择要修改的变量');
  if (!selectedKey) return;

  let targetKey = selectedKey.value;
  if (targetKey === 'NEW_VAR') {
    targetKey = await interactive.askInput('请输入新变量名');
    if (!targetKey) return;
  }

  // 输入新值
  const newValue = await interactive.askInput(`请输入 ${targetKey} 的新值`, true); // 默认为密文输入

  // 更新 .mcp.json
  if (!serverConfig.env) serverConfig.env = {};
  serverConfig.env[targetKey] = newValue;
  await writeMcpConfig(fullConfig, projectRoot);
  console.log('✅ .mcp.json 已更新');

  // 同步更新 settings.local.json (如果存在)
  const paths = getClaudeConfigPaths(projectRoot);
  if (await fileExists(paths.localSettings)) {
    const shouldSync = await interactive.confirm(`是否同步更新 settings.local.json 中的 ${targetKey}?`, true);
    if (shouldSync) {
      const localConfig = await readConfigFile(paths.localSettings);
      if (!localConfig.env) localConfig.env = {};
      localConfig.env[targetKey] = newValue;
      await writeConfigFile(paths.localSettings, localConfig);
      console.log('✅ settings.local.json 已同步');
    }
  }

  console.log('🔄 请重启 Claude Code 以生效');
}

// 辅助函数：遮蔽敏感信息
function maskValue(val) {
  if (!val) return '(空)';
  if (val.length < 8) return '******';
  return `${val.substring(0, 3)}...${val.substring(val.length - 3)}`;
}

module.exports = editMcp;
