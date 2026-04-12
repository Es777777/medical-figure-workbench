/**
 * current 子命令 - 显示当前激活的模型状态
 */

const { findProjectRoot } = require('../../lib/project-root');
const { getClaudeConfigPaths, getGlobalClaudeConfigPaths } = require('../../lib/path-helper');
const { readConfigFile, fileExists, readDir } = require('../../lib/file-ops');
const path = require('path');

/**
 * 深度合并对象
 * @param {Object} target - 目标对象
 * @param {Object} source - 源对象
 * @returns {Object} 合并后的对象
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * 读取并合并配置文件
 * @param {string} projectRoot - 项目根目录
 * @returns {Promise<Object>} 合并后的配置和来源信息
 */
async function readMergedConfig(projectRoot) {
  let config = {};
  let source = '';
  let hasLocal = false;
  let hasShared = false;

  if (projectRoot) {
    const projectPaths = getClaudeConfigPaths(projectRoot);

    // 读取项目级配置
    let localConfig = null;
    let sharedConfig = null;

    if (await fileExists(projectPaths.localSettings)) {
      try {
        localConfig = await readConfigFile(projectPaths.localSettings);
        hasLocal = true;
      } catch (error) {
        console.warn(`⚠️  读取本地配置失败: ${error.message}`);
      }
    }

    if (await fileExists(projectPaths.sharedSettings)) {
      try {
        sharedConfig = await readConfigFile(projectPaths.sharedSettings);
        hasShared = true;
      } catch (error) {
        console.warn(`⚠️  读取共享配置失败: ${error.message}`);
      }
    }

    // 合并项目配置
    if (hasShared || hasLocal) {
      if (sharedConfig) {
        config = { ...sharedConfig };
      }
      if (localConfig) {
        config = deepMerge(config, localConfig);
      }
      source = 'project';
    }
  }

  // 如果没有项目配置，尝试全局配置
  if (!config || Object.keys(config).length === 0) {
    const globalPaths = getGlobalClaudeConfigPaths();
    let localConfig = null;
    let sharedConfig = null;

    if (await fileExists(globalPaths.localSettings)) {
      try {
        localConfig = await readConfigFile(globalPaths.localSettings);
        hasLocal = true;
      } catch (error) {
        console.warn(`⚠️  读取全局本地配置失败: ${error.message}`);
      }
    }

    if (await fileExists(globalPaths.sharedSettings)) {
      try {
        sharedConfig = await readConfigFile(globalPaths.sharedSettings);
        hasShared = true;
      } catch (error) {
        console.warn(`⚠️  读取全局共享配置失败: ${error.message}`);
      }
    }

    // 合并全局配置
    if (hasShared || hasLocal) {
      if (sharedConfig) {
        config = { ...sharedConfig };
      }
      if (localConfig) {
        config = deepMerge(config, localConfig);
      }
      source = 'global';
    }
  }

  return { config, source, hasLocal, hasShared };
}

/**
 * 显示当前激活的模型状态
 */
async function showCurrentModel() {
  try {
    // 查找项目根目录
    const projectRoot = await findProjectRoot();
    const paths = getClaudeConfigPaths(projectRoot);

    // 读取并合并配置
    const { config: currentConfig, source, hasLocal, hasShared } = await readMergedConfig(projectRoot);

    if (!currentConfig.env || !currentConfig.env.ANTHROPIC_MODEL) {
      console.log('📭 当前未设置模型配置');
      console.log('💡 使用 "ccswitch model add <modelName>" 添加模型配置');
      return;
    }

    // 显示当前模型信息
    console.log('🎯 当前模型状态:\n');

    // 模型名称
    const modelName = currentConfig.env.ANTHROPIC_MODEL || '未知';
    console.log(`🤖 模型名称: ${modelName}`);

    // API 端点
    if (currentConfig.env.ANTHROPIC_BASE_URL) {
      console.log(`🔗 API 端点: ${currentConfig.env.ANTHROPIC_BASE_URL}`);
    }

    // 其他模型设置
    const otherModels = [
      'ANTHROPIC_SMALL_FAST_MODEL',
      'ANTHROPIC_DEFAULT_HAIKU_MODEL',
      'ANTHROPIC_DEFAULT_SONNET_MODEL',
      'ANTHROPIC_DEFAULT_OPUS_MODEL',
    ];

    otherModels.forEach(envVar => {
      if (currentConfig.env[envVar]) {
        const displayName = envVar.replace('ANTHROPIC_', '').replace(/_/g, ' ');
        console.log(`⚙️  ${displayName}: ${currentConfig.env[envVar]}`);
      }
    });

    // 配置文件位置
    console.log('\n📍 配置文件位置:');

    if (source === 'project') {
      console.log('   ✅ 使用项目级配置');
      if (hasShared) {
        console.log(`   - 共享配置: ${paths.sharedSettings} (可提交到版本控制)`);
      }
      if (hasLocal) {
        console.log(`   - 本地配置: ${paths.localSettings} (包含敏感信息，不提交)`);
      }
    } else if (source === 'global') {
      const globalPaths = getGlobalClaudeConfigPaths();
      console.log('   ✅ 使用全局配置');
      if (hasShared) {
        console.log(`   - 共享配置: ${globalPaths.sharedSettings}`);
      }
      if (hasLocal) {
        console.log(`   - 本地配置: ${globalPaths.localSettings}`);
      }
    } else {
      console.log('   📭 未找到任何配置文件');
    }

    // 检查可用的其他模型
    console.log('\n📋 可用模型:');

    // 检查用户模型目录
    if (await fileExists(paths.userModelsDir)) {
      try {
        const modelFiles = await readDir(paths.userModelsDir);
        const models = modelFiles
          .filter(file => file.endsWith('.json'))
          .map(file => path.basename(file, '.json'))
          .sort();

        if (models.length > 0) {
          models.forEach(model => {
            const isCurrent = model === modelName ||
                            (currentConfig.env.ANTHROPIC_MODEL &&
                             model.toLowerCase().includes(modelName.toLowerCase()));
            const indicator = isCurrent ? ' → [当前]' : '';
            console.log(`   ${model}${indicator}`);
          });
        } else {
          console.log('   无可用模型 (请先使用 ccswitch model add 添加)');
        }
      } catch (error) {
        console.log('   无法读取模型列表');
      }
    } else {
      console.log('   用户模型目录不存在');
    }

    console.log('\n💡 使用 "ccswitch model" 交互式切换模型');
    console.log('💡 使用 "ccswitch model use <modelName>" 直接切换到指定模型');

  } catch (error) {
    console.error('❌ 获取当前模型状态失败:', error.message);
    process.exit(1);
  }
}

module.exports = showCurrentModel;