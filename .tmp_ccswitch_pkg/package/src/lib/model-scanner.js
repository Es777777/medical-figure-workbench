/**
 * 模型扫描工具
 * 用于扫描和管理已安装的模型配置
 */

const {
  getClaudeConfigPaths,
  getGlobalClaudeConfigPaths,
} = require("./path-helper");
const { readConfigFile, fileExists, readDir } = require("./file-ops");
const path = require("path");
const { validateClaudeConfig } = require("./json-handler");

/**
 * 深度合并对象
 * @param {Object} target - 目标对象
 * @param {Object} source - 源对象
 * @returns {Object} 合并后的对象
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * 扫描已安装的模型
 * @param {string} projectRoot - 项目根目录
 * @returns {Promise<Array>} 已安装模型列表
 */
async function scanInstalledModels(projectRoot) {
  const paths = getClaudeConfigPaths(projectRoot);
  const models = [];

  // 扫描用户模型目录
  if (await fileExists(paths.userModelsDir)) {
    try {
      const modelFiles = await readDir(paths.userModelsDir);

      for (const file of modelFiles) {
        if (file.endsWith(".json")) {
          const modelName = path.basename(file, ".json");
          const modelPath = `${paths.userModelsDir}/${file}`;

          try {
            const config = await readConfigFile(modelPath);
            validateClaudeConfig(config, "settings");

            // 提取模型信息
            const modelInfo = {
              name: modelName,
              path: modelPath,
              config: config,
              displayName: extractDisplayName(config, modelName),
              provider: extractProvider(config),
              apiUrl: config.env?.ANTHROPIC_BASE_URL || "",
              model: config.env?.ANTHROPIC_MODEL || modelName,
            };

            models.push(modelInfo);
          } catch (error) {
            // 跳过无效的模型配置
            console.warn(
              `⚠️  跳过无效的模型配置: ${modelName} - ${error.message}`
            );
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  无法读取模型目录: ${error.message}`);
    }
  }

  return models.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 提取模型显示名称
 * @param {Object} config - 模型配置
 * @param {string} fallback - 回退名称
 * @returns {string} 显示名称
 */
function extractDisplayName(config, fallback) {
  return (
    config.env?.ANTHROPIC_MODEL ||
    config.env?.ANTHROPIC_DEFAULT_SONNET_MODEL ||
    fallback
  );
}

/**
 * 提取模型提供商
 * @param {Object} config - 模型配置
 * @returns {string} 提供商名称
 */
function extractProvider(config) {
  const baseUrl = config.env?.ANTHROPIC_BASE_URL || "";

  if (baseUrl.includes("openai.com")) {
    return "OpenAI";
  } else if (baseUrl.includes("anthropic.com")) {
    return "Anthropic";
  } else if (baseUrl.includes("bigmodel.cn")) {
    return "智谱AI";
  } else if (baseUrl.includes("minimaxi.com")) {
    return "MiniMax";
  } else if (
    baseUrl.includes("moonshot.cn") ||
    baseUrl.includes("moonshot.ai")
  ) {
    return "Moonshot AI";
  } else if (baseUrl.includes("deepseek.com")) {
    return "DeepSeek";
  } else if (
    baseUrl.includes("qwen.ai") ||
    baseUrl.includes("alibabacloud.com") ||
    baseUrl.includes("aliyuncs.com")
  ) {
    return "通义千问";
  } else {
    return "未知";
  }
}

/**
 * 获取当前激活的模型（按正确优先级查找配置：localSettings > sharedSettings）
 * @param {string} projectRoot - 项目根目录
 * @returns {Promise<Object|null>} 当前模型信息
 */
async function getCurrentModel(projectRoot) {
  // 1. 尝试读取项目配置（按优先级：localSettings > sharedSettings）
  let config = null;
  let source = null; // 'project-local' | 'project-shared' | 'global-local' | 'global-shared'

  if (projectRoot) {
    const projectPaths = getClaudeConfigPaths(projectRoot);
    let localConfig = null;
    let sharedConfig = null;

    // 读取项目级 localSettings
    if (await fileExists(projectPaths.localSettings)) {
      try {
        localConfig = await readConfigFile(projectPaths.localSettings);
      } catch (e) {
        /* 忽略错误 */
      }
    }

    // 读取项目级 sharedSettings
    if (await fileExists(projectPaths.sharedSettings)) {
      try {
        sharedConfig = await readConfigFile(projectPaths.sharedSettings);
      } catch (e) {
        /* 忽略错误 */
      }
    }

    // 合并配置（local 优先级更高）
    if (localConfig || sharedConfig) {
      config = {};
      if (sharedConfig) {
        config = { ...sharedConfig };
      }
      if (localConfig) {
        config = deepMerge(config, localConfig);
      }
      source = "project-local";
    }
  }

  // 2. 如果没有项目配置，尝试读取全局配置（同样按优先级）
  if (!config) {
    const globalPaths = getGlobalClaudeConfigPaths();
    let localConfig = null;
    let sharedConfig = null;

    // 读取全局级 localSettings
    if (await fileExists(globalPaths.localSettings)) {
      try {
        localConfig = await readConfigFile(globalPaths.localSettings);
      } catch (e) {
        /* 忽略错误 */
      }
    }

    // 读取全局级 sharedSettings
    if (await fileExists(globalPaths.sharedSettings)) {
      try {
        sharedConfig = await readConfigFile(globalPaths.sharedSettings);
      } catch (e) {
        /* 忽略错误 */
      }
    }

    // 合并配置（local 优先级更高）
    if (localConfig || sharedConfig) {
      config = {};
      if (sharedConfig) {
        config = { ...sharedConfig };
      }
      if (localConfig) {
        config = deepMerge(config, localConfig);
      }
      source = "global-local";
    }
  }

  // 3. 如果都没找到，返回 null
  if (!config || !config.env || !config.env.ANTHROPIC_MODEL) {
    return null;
  }

  const currentModelName = config.env.ANTHROPIC_MODEL;
  const installedModels = await scanInstalledModels(projectRoot);

  // 4. 查找匹配的已安装模型
  // 匹配逻辑：API Model ID 相同 (精确) OR 文件名包含 (模糊)
  const matchedModel = installedModels.find(
    (model) =>
      model.model === currentModelName ||
      model.name.toLowerCase() === currentModelName.toLowerCase()
  );

  return {
    name: matchedModel ? matchedModel.name : currentModelName, // 优先用文件名
    model: currentModelName, // 实际的 API model ID
    displayName: matchedModel ? matchedModel.displayName : currentModelName,
    provider: extractProvider(config),
    source: source, // 关键：标记来源
    config: config,
  };
}

/**
 * 验证模型配置是否完整
 * @param {Object} config - 模型配置
 * @returns {Object} 验证结果
 */
function validateModelConfig(config) {
  const issues = [];
  const warnings = [];

  if (!config.env) {
    issues.push("缺少 env 配置");
    return { valid: false, issues, warnings };
  }

  // 必需字段检查
  const requiredFields = ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_MODEL"];
  for (const field of requiredFields) {
    if (!config.env[field]) {
      issues.push(`缺少必需字段: ${field}`);
    }
  }

  // 占位符检查
  for (const [key, value] of Object.entries(config.env)) {
    if (
      typeof value === "string" &&
      value.includes("<") &&
      value.includes(">")
    ) {
      warnings.push(`字段 ${key} 包含未替换的占位符: ${value}`);
    }
  }

  // API 端点检查
  if (!config.env.ANTHROPIC_BASE_URL) {
    warnings.push("未设置 API 端点，将使用默认设置");
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  };
}

module.exports = {
  scanInstalledModels,
  getCurrentModel,
  extractDisplayName,
  extractProvider,
  validateModelConfig,
};
