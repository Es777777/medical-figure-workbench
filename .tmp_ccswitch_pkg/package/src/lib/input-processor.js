/**
 * 通用输入处理模块
 * 处理模板替换、路径处理等通用逻辑
 */

const { resolvePath, getHomeDir } = require('./path-helper');
const { validate } = require('./validators');
const interactive = require('./interactive');

/**
 * 处理路径输入
 * @param {string} input - 用户输入的路径
 * @param {string} projectRoot - 项目根目录
 * @returns {string} - 处理后的绝对路径
 */
function processPathInput(input, projectRoot) {
  if (!input) return input;

  // 展开波浪号路径
  if (input.startsWith('~/')) {
    return resolvePath(input.replace('~/', ''), getHomeDir());
  } else if (input === '~') {
    return getHomeDir();
  } else if (!input.startsWith('/') && input !== '.') {
    // 相对路径转换为绝对路径（基于项目根目录）
    return resolvePath(input, projectRoot);
  } else if (input === '.') {
    return projectRoot;
  }

  return input;
}

/**
 * 替换配置中的占位符
 * @param {Object} config - 配置对象
 * @param {string} placeholder - 占位符（如 '<API_KEY>'）
 * @param {string} value - 替换值
 * @returns {Object} - 替换后的配置
 */
function replacePlaceholder(config, placeholder, value) {
  const result = JSON.parse(JSON.stringify(config));

  // Args 替换
  if (result.args) {
    result.args = result.args.map((arg) =>
      typeof arg === 'string' ? arg.replace(new RegExp(placeholder, 'g'), value) : arg,
    );
  }

  // Env 替换
  if (result.env) {
    for (const [key, val] of Object.entries(result.env)) {
      if (typeof val === 'string' && val.includes(placeholder)) {
        result.env[key] = val.replace(new RegExp(placeholder, 'g'), value);
      }
    }
  }

  return result;
}

/**
 * 处理交互式输入
 * @param {Object} prompt - 提示配置
 * @param {string} projectRoot - 项目根目录
 * @returns {Promise<string>} - 用户输入的值
 */
async function processInteractiveInput(prompt, projectRoot) {
  const { message, type = 'text', validate: validatorName, default: defaultValue } = prompt;
  const validator = validatorName ? (input) => validate(validatorName, input) : null;

  let userInput = '';

  // 根据类型选择输入方式
  if (type === 'confirm') {
    const confirmed = await interactive.confirm(message, defaultValue);
    if (!confirmed) {
      return null; // 表示用户取消
    }
    return confirmed;
  } else if (type === 'password' || validatorName === 'github_token') {
    userInput = await interactive.askInput(`${message} (隐私输入)`, true);
  } else {
    userInput = await interactive.askInput(message, false, defaultValue);
  }

  // 特殊处理路径输入
  if (validatorName === 'path' && userInput) {
    userInput = processPathInput(userInput, projectRoot);
  }

  // 验证输入
  if (validator) {
    const validationResult = validator(userInput);
    if (validationResult !== true) {
      throw new Error(`验证失败: ${validationResult}`);
    }
  }

  return userInput;
}

/**
 * 批量处理提示配置
 * @param {Array} prompts - 提示配置数组
 * @param {string} projectRoot - 项目根目录
 * @returns {Promise<Object>} - 处理结果 { replacements: {}, sensitiveKeys: {} }
 */
async function processPrompts(prompts, projectRoot) {
  const replacements = {};
  const sensitiveKeys = {};

  for (const prompt of prompts) {
    try {
      const result = await processInteractiveInput(prompt, projectRoot);

      // 如果用户取消（confirm 类型返回 null）
      if (result === null) {
        return { cancelled: true, replacements, sensitiveKeys };
      }

      // 如果是 confirm 类型且结果为布尔值，不需要后续处理
      if (typeof result === 'boolean') {
        continue;
      }

      // 提取占位符键名
      const placeholderKey = extractPlaceholderKey(prompt.placeholder);
      if (placeholderKey) {
        replacements[placeholderKey] = result;
      }

      // 收集敏感信息
      if (prompt.type === 'password' || prompt.placeholder?.includes('KEY') || prompt.placeholder?.includes('TOKEN')) {
        // 假设敏感信息会保存到环境变量中
        const envKey = prompt.placeholder?.replace(/[<>]/g, '').toUpperCase();
        if (envKey) {
          sensitiveKeys[envKey] = result;
        }
      }

    } catch (error) {
      throw new Error(`处理提示 "${prompt.message}" 时出错: ${error.message}`);
    }
  }

  return { cancelled: false, replacements, sensitiveKeys };
}

/**
 * 从占位符中提取键名
 * @param {string} placeholder - 占位符（如 '<API_KEY>'）
 * @returns {string|null} - 键名（如 'API_KEY'）
 */
function extractPlaceholderKey(placeholder) {
  if (!placeholder) return null;
  const match = placeholder.match(/<(.+)>/);
  return match ? match[1] : null;
}

module.exports = {
  processPathInput,
  replacePlaceholder,
  processInteractiveInput,
  processPrompts,
  extractPlaceholderKey,
};