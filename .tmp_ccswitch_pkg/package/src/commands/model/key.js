/**
 * key 子命令 - 修改当前项目的 API Key
 */

const { findProjectRoot } = require('../../lib/project-root');
const { getClaudeConfigPaths } = require('../../lib/path-helper');
const { readConfigFile, writeConfigFile, fileExists } = require('../../lib/file-ops');
const { askInput } = require('../../lib/interactive');

async function updateKey() {
  try {
    // 1. 检查项目环境
    const projectRoot = await findProjectRoot();
    if (!projectRoot) {
      console.error('❌ 当前不在 Claude Code 项目目录中 (未找到 .claude/ 或 .git/ 目录)');
      console.log('💡 "key" 命令仅用于修改当前项目的配置，请进入项目目录后重试。');
      return;
    }

    const paths = getClaudeConfigPaths(projectRoot);
    // 我们只修改 settings.local.json，因为这是存放敏感 Key 的地方
    const localSettingsPath = paths.localSettings;

    console.log('\n🔑 准备更新当前项目的 API Key');
    console.log(`📂 配置文件: ${localSettingsPath}`);

    // 2. 读取现有配置 (如果不存在则初始化空对象)
    let localConfig = {};
    if (await fileExists(localSettingsPath)) {
      try {
        localConfig = await readConfigFile(localSettingsPath);
      } catch (e) {
        console.warn('⚠️  读取现有配置文件失败，将创建新文件');
      }
    }

    // 确保 env 对象存在
    if (!localConfig.env) {
      localConfig.env = {};
    }

    // 3. 获取用户输入
    // 提示: 根据 interactive.js 的实现，这里假设 askInput 是明文输入
    // 如果需要密文输入，可能需要检查 lib/interactive.js 是否支持 secret 参数
    const newKey = await askInput('请输入新的 API Key (将会覆盖旧值)');

    if (!newKey || !newKey.trim()) {
      console.log('❌ 输入为空，操作已取消');
      return;
    }

    // 4. 更新配置
    localConfig.env.ANTHROPIC_AUTH_TOKEN = newKey.trim();

    // 5. 写入文件
    await writeConfigFile(localSettingsPath, localConfig);

    console.log('\n✅ API Key 已成功更新!');
    console.log('🔄 请务必重启 Claude Code 会话以使更改生效');
  } catch (error) {
    console.error('❌ 更新 Key 失败:', error.message);
    process.exit(1);
  }
}

module.exports = updateKey;
