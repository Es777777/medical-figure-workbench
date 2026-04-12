/**
 * use 子命令 - 切换到指定模型
 */

const { findProjectRoot } = require('../../lib/project-root');
const { getClaudeConfigPaths } = require('../../lib/path-helper');
const { readConfigFile, writeConfigFile, fileExists } = require('../../lib/file-ops');
const { mergeConfigs } = require('../../lib/json-handler');
const { scanInstalledModels } = require('../../lib/model-scanner');

async function useModel(args) {
  try {
    const modelNameInput = args[0];
    if (!modelNameInput) {
      console.error('❌ 请指定要切换的模型名称');
      console.log('💡 示例: ccswitch model use GLM');
      return;
    }

    // 1. 获取项目根目录
    const projectRoot = await findProjectRoot();
    if (!projectRoot) {
      console.error('❌ 当前不在 Claude Code 项目目录中');
      return;
    }

    // 2. 查找已安装的模型配置
    const installedModels = await scanInstalledModels(projectRoot);

    // --- 🔍 智能匹配逻辑 ---
    let targetModel = installedModels.find((m) => m.name === modelNameInput);

    if (!targetModel) {
      targetModel = installedModels.find((m) => m.name.toLowerCase() === modelNameInput.toLowerCase());
    }

    if (!targetModel) {
      targetModel = installedModels.find((m) => m.displayName && m.displayName.toLowerCase() === modelNameInput.toLowerCase());
    }

    if (!targetModel) {
      console.error(`❌ 未找到模型配置: "${modelNameInput}"`);
      const similarModels = installedModels.filter(
        (m) => m.name.toLowerCase().includes(modelNameInput.toLowerCase()) || (m.displayName && m.displayName.toLowerCase().includes(modelNameInput.toLowerCase())),
      );

      if (similarModels.length > 0) {
        console.log('\n🤔 您是不是指:');
        similarModels.forEach((m) => console.log(`   - ${m.name} (${m.displayName})`));
      } else {
        console.log('💡 使用 "ccswitch model list" 查看可用模型');
      }
      return;
    }

    console.log(`\n🔄 正在切换到模型: ${targetModel.displayName} (${targetModel.name}) ...`);

    // 3. 读取选定的模型配置模板 (Source)
    const modelConfig = await readConfigFile(targetModel.path);

    // 4. 获取项目配置文件路径 (Target)
    const paths = getClaudeConfigPaths(projectRoot);
    const sharedSettingsPath = paths.sharedSettings; // settings.json - 非敏感配置
    const localSettingsPath = paths.localSettings;   // settings.local.json - API密钥

    // 5. 读取项目现有配置
    let currentSharedConfig = {};
    let currentLocalConfig = {};

    if (await fileExists(sharedSettingsPath)) {
      try {
        currentSharedConfig = await readConfigFile(sharedSettingsPath);
      } catch (e) {
        console.warn(`⚠️  无法读取现有共享配置文件，将创建新文件: ${e.message}`);
      }
    }

    if (await fileExists(localSettingsPath)) {
      try {
        currentLocalConfig = await readConfigFile(localSettingsPath);
      } catch (e) {
        console.warn(`⚠️  无法读取现有本地配置文件，将创建新文件: ${e.message}`);
      }
    }

    // 6. 分离敏感信息和非敏感信息
    const sensitiveKeys = ['ANTHROPIC_AUTH_TOKEN'];
    const sharedConfig = { ...modelConfig };
    const localConfig = {};

    // 确保配置结构正确
    if (!sharedConfig.env) sharedConfig.env = {};
    if (!localConfig.env) localConfig.env = {};

    // 分离敏感信息
    for (const key of sensitiveKeys) {
      if (sharedConfig.env && sharedConfig.env[key]) {
        localConfig.env[key] = sharedConfig.env[key];
        delete sharedConfig.env[key];
      }
    }

    // 7. 合并配置
    const newSharedConfig = mergeConfigs(currentSharedConfig, sharedConfig);

    // 合并本地配置，但排除 CCSWITCH_API_KEY
    const cleanedCurrentLocalConfig = JSON.parse(JSON.stringify(currentLocalConfig));
    if (cleanedCurrentLocalConfig.env && cleanedCurrentLocalConfig.env.CCSWITCH_API_KEY) {
      delete cleanedCurrentLocalConfig.env.CCSWITCH_API_KEY;
    }
    const newLocalConfig = mergeConfigs(cleanedCurrentLocalConfig, localConfig);

    // 8. 写入配置文件
    await writeConfigFile(sharedSettingsPath, newSharedConfig);
    if (Object.keys(localConfig.env).length > 0) {
      await writeConfigFile(localSettingsPath, newLocalConfig);
    }

    console.log('✅ 已成功切换模型!');
    console.log(`📂 更新共享配置文件: ${sharedSettingsPath}`);
    if (Object.keys(localConfig.env).length > 0) {
      console.log(`🔒 更新本地配置文件: ${localSettingsPath}`);
    }

    if (modelConfig.env && modelConfig.env.ANTHROPIC_MODEL) {
      console.log(`🤖 模型 ID: ${modelConfig.env.ANTHROPIC_MODEL}`);
    }

    console.log('🔄 请重启 Claude Code 以使更改生效');
  } catch (error) {
    console.error('❌ 切换模型失败:', error.message);
    process.exit(1);
  }
}

module.exports = useModel;
