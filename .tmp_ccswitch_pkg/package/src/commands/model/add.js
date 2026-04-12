/**
 * add 子命令 - 添加新模型
 */

const path = require('path');
const { findProjectRoot } = require('../../lib/project-root');
const { getClaudeConfigPaths } = require('../../lib/path-helper');
const { readDir, ensureDir, writeConfigFile, readFile } = require('../../lib/file-ops');
const { askInput, confirm, select } = require('../../lib/interactive');
const { replaceTemplatePlaceholders, validateClaudeConfig } = require('../../lib/json-handler');

/**
 * 读取模型模板
 * @param {string} templateDir - 模板目录
 * @returns {Promise<Array>} 模型列表
 */
async function readModelTemplates(templateDir) {
  const files = await readDir(templateDir);
  const modelFiles = files.filter((file) => file.endsWith('.json'));

  const templates = [];
  for (const file of modelFiles) {
    const templateName = path.basename(file, '.json');
    const templatePath = path.join(templateDir, file);

    try {
      const content = await readFile(templatePath);
      const config = JSON.parse(content);

      templates.push({
        name: templateName,
        path: templatePath,
        config: config,
        displayName: config.env?.ANTHROPIC_MODEL || templateName,
        description: extractDescription(config),
      });
    } catch (error) {
      console.warn(`⚠️  跳过无效模板: ${templateName} - ${error.message}`);
    }
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 提取模板描述
 * @param {Object} config - 模板配置
 * @returns {string} 描述
 */
function extractDescription(config) {
  if (config.env?.ANTHROPIC_BASE_URL) {
    const url = config.env.ANTHROPIC_BASE_URL;
    if (url.includes('bigmodel.cn')) return '智谱AI GLM模型';
    if (url.includes('minimaxi.com')) return 'MiniMax模型';
    if (url.includes('moonshot.cn') || url.includes('moonshot.ai')) return 'Moonshot AI Kimi模型';
    if (url.includes('openai.com')) return 'OpenAI模型';
    if (url.includes('anthropic.com')) return 'Anthropic模型';
    if (url.includes('deepseek.com')) return 'DeepSeek模型';
    if (url.includes('alibabacloud.com') || url.includes('aliyuncs.com')) return '通义千问模型';
  }
  return '自定义模型';
}

/**
 * 添加新模型
 * @param {Array} args - 命令参数 [modelName]
 */
async function addModel(args) {
  const requestedModel = args[0];

  try {
    // 查找项目根目录和路径
    const projectRoot = await findProjectRoot();
    const paths = getClaudeConfigPaths(projectRoot);
    const templateDir = path.resolve(__dirname, '../../../template/models');

    console.log('🚀 模型配置添加向导\n');

    // 读取可用模板
    const templates = await readModelTemplates(templateDir);

    if (templates.length === 0) {
      console.error('❌ 未找到模型模板');
      console.log('请检查 template/models/ 目录中是否存在 .json 模板文件');
      process.exit(1);
    }

    let selectedTemplate;

    if (requestedModel) {
      // 如果指定了模型名称，直接查找
      selectedTemplate = templates.find((t) => t.name.toLowerCase() === requestedModel.toLowerCase() || t.displayName.toLowerCase().includes(requestedModel.toLowerCase()));

      if (!selectedTemplate) {
        console.error(`❌ 未找到模型模板: ${requestedModel}`);
        console.log('可用模板:');
        templates.forEach((t) => console.log(`  - ${t.name} (${t.description})`));
        process.exit(1);
      }
    } else {
      // 交互式选择模板
      console.log('请选择模型模板:');
      const choices = templates.map((t) => ({
        name: `${t.name} - ${t.description}`,
        value: t.name,
      }));

      const selectedChoice = await select(choices, '请选择模型模板');

      if (!selectedChoice) {
        console.log('❌ 操作已取消');
        process.exit(0);
      }

      selectedTemplate = templates.find((t) => t.name === selectedChoice.value);
    }

    console.log(`\n📝 配置模型: ${selectedTemplate.displayName}\n`);

    // 收集用户输入
    const replacements = {};

    // API 密钥
    const hasApiKey = selectedTemplate.config.env && Object.values(selectedTemplate.config.env).some((val) => typeof val === 'string' && val.includes('<API_KEY>'));

    if (hasApiKey) {
      const apiKey = await askInput('请输入 API 密钥');
      if (!apiKey.trim()) {
        console.error('❌ API 密钥不能为空');
        process.exit(1);
      }
      replacements.API_KEY = apiKey.trim();
    }

    // API 端点（如果是占位符）
    const apiBaseUrl = selectedTemplate.config.env?.ANTHROPIC_BASE_URL;
    if (apiBaseUrl && apiBaseUrl.includes('<BASE_URL>')) {
      const baseUrl = await askInput('请输入 API 基础URL', apiBaseUrl);
      replacements.BASE_URL = baseUrl.trim();
    }

    // 生成最终配置
    console.log('\n🔄 生成配置文件...');
    const finalConfig = replaceTemplatePlaceholders(selectedTemplate.config, replacements);

    // 验证配置
    validateClaudeConfig(finalConfig, 'settings');

    // 确保用户模型目录存在
    await ensureDir(paths.userModelsDir);

    // 确定保存的文件名
    const saveFileName = args[0] || selectedTemplate.name;
    const savePath = path.join(paths.userModelsDir, `${saveFileName}.json`);

    // 确认保存
    const shouldSave = await confirm(`是否保存模型配置到 ${savePath}?`);
    if (!shouldSave) {
      console.log('❌ 操作已取消');
      process.exit(0);
    }

    // 保存配置
    await writeConfigFile(savePath, finalConfig);

    console.log(`✅ 模型配置已保存: ${savePath}`);
    console.log(`📝 模型名称: ${finalConfig.env?.ANTHROPIC_MODEL || selectedTemplate.displayName}`);
    console.log(`🔗 API 端点: ${finalConfig.env?.ANTHROPIC_BASE_URL || '默认'}`);

    console.log('\n💡 使用方法:');
    console.log(`  ccswitch model use ${saveFileName}  # 切换到此模型`);
    console.log('  ccswitch model                    # 交互式选择模型');
    console.log('  ccswitch model list                # 查看已安装模型');
  } catch (error) {
    console.error('❌ 添加模型失败:', error.message);
    process.exit(1);
  }
}

module.exports = addModel;
