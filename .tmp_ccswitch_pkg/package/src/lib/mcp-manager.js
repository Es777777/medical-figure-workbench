/**
 * MCP 配置管理器 (升级版)
 * 支持全局配置读取、模板元数据解析
 */

const { safeParse } = require('./json-handler');
const { findProjectRoot } = require('./project-root');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

/**
 * 检查文件是否存在
 */
async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取 JSON 文件
 */
async function readJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return safeParse(content, filePath);
  } catch (error) {
    throw new Error(`读取文件失败 ${filePath}: ${error.message}`);
  }
}

/**
 * 写入 JSON 文件
 */
async function writeJson(filePath, data, options = {}) {
  const { indent = 2 } = options;
  try {
    const content = JSON.stringify(data, null, indent);
    await fs.writeFile(filePath, content, 'utf8');
  } catch (error) {
    throw new Error(`写入文件失败 ${filePath}: ${error.message}`);
  }
}

/**
 * 获取项目相关路径 (包含全局配置路径)
 */
function getProjectPaths(projectRoot = null) {
  const root = projectRoot || process.cwd();

  // 识别操作系统以确定全局配置路径
  let globalConfigPath = '';
  const platform = os.platform();
  const home = os.homedir();

  if (platform === 'darwin') {
    // macOS
    globalConfigPath = path.join(home, 'Library', 'Application Support', 'Claude Code', 'settings.json');
  } else if (platform === 'win32') {
    // Windows
    globalConfigPath = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude Code', 'settings.json');
  } else {
    // Linux
    globalConfigPath = path.join(home, '.config', 'Claude Code', 'settings.json');
  }

  return {
    projectRoot: root,
    mcpConfig: path.join(root, '.mcp.json'),
    mcpTemplates: path.join(__dirname, '../../template/mcp'),
    globalMcpConfig: globalConfigPath,
  };
}

/**
 * 验证 MCP 配置
 */
function validateMcpConfig(config) {
  if (!config || typeof config !== 'object') return false;
  if (!config.mcpServers || typeof config.mcpServers !== 'object') return false;
  return true;
}

/**
 * 读取项目 MCP 配置
 */
async function readMcpConfig(projectRoot = null) {
  const root = projectRoot || (await findProjectRoot());
  const { mcpConfig } = getProjectPaths(root);

  if (!(await exists(mcpConfig))) return null;

  try {
    const config = await readJson(mcpConfig);
    return validateMcpConfig(config) ? config : null;
  } catch (error) {
    throw new Error(`读取 MCP 配置失败: ${error.message}`);
  }
}

/**
 * 写入 MCP 配置 (自动剔除 _meta)
 */
async function writeMcpConfig(config, projectRoot = null) {
  const root = projectRoot || (await findProjectRoot());
  const { mcpConfig } = getProjectPaths(root);

  // 只保留 mcpServers 和其他根级字段，剔除元数据
  const dataToWrite = { ...config };
  delete dataToWrite._meta;

  // 确保 mcpServers 存在
  if (!dataToWrite.mcpServers) dataToWrite.mcpServers = {};

  try {
    await writeJson(mcpConfig, dataToWrite, { indent: 2 });
  } catch (error) {
    throw new Error(`写入 MCP 配置失败: ${error.message}`);
  }
}

/**
 * 读取系统全局 MCP 配置
 */
async function readGlobalMcpConfig() {
  const { globalMcpConfig } = getProjectPaths();

  if (!(await exists(globalMcpConfig))) {
    return null;
  }

  try {
    const config = await readJson(globalMcpConfig);

    // Claude Code 的 settings.json 格式，MCP 配置在 mcp.mcpServers 下
    if (config && config.mcp && config.mcp.mcpServers) {
      return { mcpServers: config.mcp.mcpServers };
    }

    // 兼容旧格式
    if (validateMcpConfig(config)) {
      return config;
    }

    return null;
  } catch (error) {
    // 忽略读取错误，可能是权限问题或文件损坏
    return null;
  }
}

/**
 * 获取所有可用 MCP 源 (内置 + 全局)
 */
async function getAvailableMcpSources() {
  const sources = [];

  // 1. 获取内置模板
  const { mcpTemplates } = getProjectPaths();
  if (await exists(mcpTemplates)) {
    const files = await fs.readdir(mcpTemplates);
    for (const file of files) {
      if (file.endsWith('.json') && file !== 'template.json') {
        try {
          const content = await readJson(path.join(mcpTemplates, file));
          const meta = content._meta || {};
          const serverKeys = Object.keys(content.mcpServers || {});

          if (serverKeys.length > 0) {
            const serverName = serverKeys[0];
            sources.push({
              id: `builtin:${serverName}`,
              name: serverName,
              source: 'builtin',
              description: meta.description || content.mcpServers[serverName].description || '内置 MCP 服务器',
              config: content.mcpServers[serverName],
              meta: meta,
            });
          }
        } catch (e) {
          // ignore error
        }
      }
    }
  }

  // 2. 获取全局配置
  const globalConfig = await readGlobalMcpConfig();
  if (globalConfig && globalConfig.mcpServers) {
    for (const [name, config] of Object.entries(globalConfig.mcpServers)) {
      // 允许全局配置和内置配置并存
      sources.push({
        id: `global:${name}`,
        name: name,
        source: 'global',
        description: `(来自 Claude Desktop) ${config.description || ''}`,
        config: config,
        meta: {}, // 全局配置没有引导元数据
      });
    }
  }

  return sources;
}

module.exports = {
  getProjectPaths,
  readMcpConfig,
  writeMcpConfig,
  readGlobalMcpConfig,
  getAvailableMcpSources,
  validateMcpConfig,
};
