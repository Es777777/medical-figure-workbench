/**
 * JSON 文件处理工具
 * 提供 JSON 文件的安全解析、验证和格式化
 */

/**
 * 安全解析 JSON 文件
 * @param {string} jsonString - JSON 字符串
 * @param {string} filePath - 文件路径（用于错误提示）
 * @returns {Object} 解析后的对象
 */
function safeParse(jsonString, filePath = '文件') {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`${filePath} JSON 格式错误: ${error.message}`);
  }
}

/**
 * 验证 JSON 对象结构
 * @param {Object} obj - 要验证的对象
 * @param {Array} requiredFields - 必需字段列表
 * @returns {boolean} 验证结果
 */
function validateRequiredFields(obj, requiredFields) {
  const missingFields = requiredFields.filter((field) => !(field in obj));

  if (missingFields.length > 0) {
    throw new Error(`缺少必需字段: ${missingFields.join(', ')}`);
  }

  return true;
}

/**
 * 格式化 JSON 对象为字符串
 * @param {Object} obj - 要格式化的对象
 * @param {number} indent - 缩进空格数
 * @returns {string} 格式化的 JSON 字符串
 */
function formatJSON(obj, indent = 2) {
  return JSON.stringify(obj, null, indent);
}

/**
 * 验证 JSON 文件结构
 * @param {Object} obj - JSON 对象
 * @param {Object} schema - 验证规则
 * @returns {boolean} 验证结果
 */
function validateSchema(obj, schema) {
  const errors = [];

  // 检查必需字段
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in obj)) {
        errors.push(`缺少必需字段: ${field}`);
      }
    }
  }

  // 检查字段类型
  if (schema.properties) {
    for (const [field, rule] of Object.entries(schema.properties)) {
      if (field in obj) {
        const value = obj[field];
        const expectedType = rule.type;

        if (!checkType(value, expectedType)) {
          errors.push(`字段 ${field} 应该是 ${expectedType} 类型`);
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`JSON 验证失败:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }

  return true;
}

/**
 * 检查值的类型
 * @param {*} value - 要检查的值
 * @param {string} expectedType - 期望的类型
 * @returns {boolean} 类型是否匹配
 */
function checkType(value, expectedType) {
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  return actualType === expectedType;
}

/**
 * 验证 Claude Code 配置文件
 * @param {Object} config - 配置对象
 * @param {string} configType - 配置类型 ('settings' | 'mcp')
 */
function validateClaudeConfig(config, configType = 'settings') {
  if (configType === 'settings') {
    return validateSettingsConfig(config);
  } else if (configType === 'mcp') {
    return validateMcpConfig(config);
  } else {
    throw new Error(`未知的配置类型: ${configType}`);
  }
}

/**
 * 验证 Claude Code settings 配置
 * @param {Object} config - settings 配置对象
 */
function validateSettingsConfig(config) {
  const errors = [];

  // 检查必需字段
  if (!config.env || typeof config.env !== 'object') {
    errors.push('settings 配置必须包含 env 对象');
  } else {
    // 验证常见的环境变量
    const commonEnvVars = ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL'];

    for (const envVar of commonEnvVars) {
      if (envVar in config.env && typeof config.env[envVar] !== 'string') {
        errors.push(`环境变量 ${envVar} 必须是字符串类型`);
      }
    }

    // 检查是否有占位符未替换
    for (const [key, value] of Object.entries(config.env)) {
      if (typeof value === 'string' && value.includes('<') && value.includes('>')) {
        errors.push(`环境变量 ${key} 包含未替换的占位符: ${value}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`settings 配置验证失败:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }

  return true;
}

/**
 * 验证 MCP 配置文件
 * @param {Object} config - MCP 配置对象
 */
function validateMcpConfig(config) {
  const errors = [];

  // 检查必需字段
  if (!config.mcpServers || typeof config.mcpServers !== 'object') {
    errors.push('MCP 配置必须包含 mcpServers 对象');
  } else {
    for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
      if (typeof serverConfig !== 'object' || serverConfig === null) {
        errors.push(`MCP 服务器 ${serverName} 配置必须是对象`);
        continue;
      }

      // 检查服务器配置的必需字段
      if (!serverConfig.command || typeof serverConfig.command !== 'string') {
        errors.push(`MCP 服务器 ${serverName} 缺少 command 字段`);
      }

      if (serverConfig.args && !Array.isArray(serverConfig.args)) {
        errors.push(`MCP 服务器 ${serverName} 的 args 字段必须是数组`);
      }

      // 检查占位符
      for (const [key, value] of Object.entries(serverConfig)) {
        if (typeof value === 'string' && value.includes('<') && value.includes('>')) {
          errors.push(`MCP 服务器 ${serverName} 的 ${key} 字段包含未替换的占位符: ${value}`);
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`MCP 配置验证失败:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }

  return true;
}

/**
 * 合并配置对象（智能合并模式：深度合并 env，覆盖其他）
 * @param {Object} targetConfig - 目标配置 (现有文件内容)
 * @param {Object} newConfig - 新配置 (要写入的模型配置)
 * @returns {Object} 合并后的配置
 */
function mergeConfig(targetConfig, newConfig) {
  const result = { ...targetConfig };

  for (const [key, value] of Object.entries(newConfig)) {
    // 特殊处理 env 对象：进行深度合并
    if (key === 'env' && typeof value === 'object' && value !== null) {
      const baseEnv = result.env && typeof result.env === 'object' ? result.env : {};
      // 新的环境变量覆盖旧的，但旧的非冲突变量会被保留
      result.env = { ...baseEnv, ...value };
    } else {
      // 其他字段直接覆盖
      result[key] = value;
    }
  }
  return result;
}

/**
 * 替换模板中的占位符
 * @param {Object} template - 模板对象
 * @param {Object} replacements - 替换映射
 * @returns {Object} 替换后的对象
 */
function replaceTemplatePlaceholders(template, replacements) {
  const result = JSON.parse(JSON.stringify(template)); // 深拷贝

  function replaceInObject(obj) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        let replacedValue = value;
        for (const [placeholder, replacement] of Object.entries(replacements)) {
          const pattern = new RegExp(`<${placeholder}>`, 'g');
          replacedValue = replacedValue.replace(pattern, replacement);
        }
        obj[key] = replacedValue;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        replaceInObject(value);
      }
    }
  }

  replaceInObject(result);
  return result;
}

/**
 * 检查配置是否包含敏感信息
 * @param {Object} config - 配置对象
 * @returns {boolean} 是否包含敏感信息
 */
function containsSensitiveInfo(config) {
  const sensitivePatterns = [/key/i, /token/i, /secret/i, /password/i, /auth/i];

  function checkObject(obj) {
    for (const [key, value] of Object.entries(obj)) {
      if (sensitivePatterns.some((pattern) => pattern.test(key))) {
        return true;
      }
      if (typeof value === 'string' && value.length > 20) {
        return true;
      }
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (checkObject(value)) {
          return true;
        }
      }
    }
    return false;
  }

  return checkObject(config);
}

// 兼容别名：允许使用 mergeConfigs 导入 (对应 use.js 中的调用)
const mergeConfigs = mergeConfig;

module.exports = {
  safeParse,
  validateRequiredFields,
  formatJSON,
  validateSchema,
  validateClaudeConfig,
  validateSettingsConfig,
  validateMcpConfig,
  mergeConfig,
  mergeConfigs, // 👈 新增导出，兼容 use.js
  replaceTemplatePlaceholders,
  containsSensitiveInfo,
};
