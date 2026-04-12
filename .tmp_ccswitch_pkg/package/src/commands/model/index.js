/**
 * 模型管理命令集合
 */

const list = require('./list');
const add = require('./add');
const use = require('./use');
const current = require('./current');
const help = require('./help');
const key = require('./key'); // 👈 引入新命令
const { scanInstalledModels, getCurrentModel } = require('../../lib/model-scanner');
const { findProjectRoot } = require('../../lib/project-root');
const interactive = require('../../lib/interactive');

/**
 * 交互式模型选择和切换（默认行为）
 */
async function interactiveModelSwitch() {
  try {
    const projectRoot = await findProjectRoot();
    const installedModels = await scanInstalledModels(projectRoot);
    const currentModel = await getCurrentModel(projectRoot);

    if (installedModels.length === 0) {
      console.log('📭 未找到已安装的模型');
      console.log('💡 请先使用 "ccswitch model add <modelName>" 添加模型配置');
      return;
    }

    console.log('🔄 模型切换选择\n');

    // 显示当前模型状态
    if (currentModel) {
      console.log(`📍 当前模型: ${currentModel.displayName} (${currentModel.provider})`);
    } else {
      console.log('📍 当前未设置模型');
    }

    console.log('\n请选择要切换的模型:\n');

    // 创建选择列表
    const choices = installedModels.map((model, index) => {
      const isCurrent = currentModel && (model.name === currentModel.name || model.model === currentModel.model);
      const description = model.provider ? ` - ${model.provider}` : '';

      // 使用绿色标记当前模型，与其他地方保持一致
      if (isCurrent) {
        return {
          name: `${model.displayName}${description} → \x1b[32m[当前]\x1b[0m`,
          value: model.name,
        };
      } else {
        return {
          name: `${model.displayName}${description}`,
          value: model.name,
        };
      }
    });

    // 👇 新增：添加修改 Key 的选项 (放在模型列表后面)
    if (projectRoot) {
      choices.push({
        name: '\x1b[36m修改当前项目 API Key\x1b[0m',  // 青色文字
        value: 'EDIT_KEY',
      });
    }

    // 获取用户选择
    const selectedChoice = await interactive.select(choices, '请选择模型 (输入序号)');

    if (!selectedChoice || !selectedChoice.value) {
      console.log('❌ 操作已取消');
      return;
    }

    // 👇 处理修改 Key 的逻辑
    if (selectedChoice.value === 'EDIT_KEY') {
      await key(); // 调用 key 命令
      return;
    }

    const selectedModel = selectedChoice.value;
    console.log(`\n🔄 正在切换到模型: ${selectedModel}`);

    // 执行切换
    const useCommand = require('./use');
    await useCommand([selectedModel]);
  } catch (error) {
    console.error('❌ 模型切换失败:', error.message);
    process.exit(1);
  }
}

/**
 * Model 命令聚合
 */
module.exports = {
  list,
  add,
  use,
  current,
  help,
  key, // 👈 导出新命令，允许 `ccswitch model key` 直接调用
  default: interactiveModelSwitch,
};
