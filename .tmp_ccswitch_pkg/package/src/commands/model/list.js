/**
 * list 子命令 - 列出已安装的模型
 */

const { findProjectRoot } = require('../../lib/project-root');
const { scanInstalledModels, getCurrentModel } = require('../../lib/model-scanner');

/**
 * 列出所有已安装的模型
 */
async function listModels(_args) {
  try {
    const projectRoot = await findProjectRoot();
    const installedModels = await scanInstalledModels(projectRoot);
    const currentModel = await getCurrentModel(projectRoot);

    if (installedModels.length === 0) {
      console.log('📭 未找到已安装的模型');
      console.log('💡 使用 "ccswitch model add <modelName>" 添加模型配置');
      return;
    }

    console.log('📋 已安装的模型:\n');

    installedModels.forEach((model, index) => {
      let indicator = '';

      if (currentModel) {
        const isMatch = model.model === currentModel.model || model.name === currentModel.name;

        if (isMatch) {
          if (currentModel.source && currentModel.source.startsWith('project')) {
            indicator = ' → \x1b[32m[当前项目]\x1b[0m';
          } else if (currentModel.source && currentModel.source.startsWith('global')) {
            indicator = ' → \x1b[36m[当前全局]\x1b[0m';
          } else {
            indicator = ' → [当前]';
          }
        }
      }

      const provider = model.provider ? ` (${model.provider})` : '';
      console.log(`  ${index + 1}. ${model.displayName}${indicator}${provider}`);
    });

    console.log(`\n共找到 ${installedModels.length} 个已安装模型`);
    console.log('\n💡 使用 "ccswitch model" 交互式切换模型 (包含修改Key功能)'); // 👈 修改
    console.log('💡 使用 "ccswitch model key" 修改当前项目的 API Key'); // 👈 新增
    console.log('💡 使用 "ccswitch model use <modelName>" 直接切换到指定模型');
  } catch (error) {
    throw new Error(`读取已安装模型失败: ${error.message}`);
  }
}

module.exports = listModels;
