/**
 * 路径处理工具
 * 跨平台路径处理和解析
 */

const path = require('path');

/**
 * 标准化路径分隔符
 * @param {string} filePath - 文件路径
 * @returns {string} 标准化后的路径
 */
function normalizePath(filePath) {
  return filePath.replace(/[\\/]+/g, path.sep);
}

/**
 * 解析相对路径为绝对路径
 * @param {string} relativePath - 相对路径
 * @param {string} basePath - 基础路径（默认为当前工作目录）
 * @returns {string} 绝对路径
 */
function resolvePath(relativePath, basePath = process.cwd()) {
  return path.resolve(basePath, relativePath);
}

/**
 * 获取文件扩展名
 * @param {string} filePath - 文件路径
 * @returns {string} 文件扩展名
 */
function getExtension(filePath) {
  return path.extname(filePath);
}

/**
 * 获取文件名（不包含扩展名）
 * @param {string} filePath - 文件路径
 * @returns {string} 文件名
 */
function getBaseName(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

/**
 * 获取目录名
 * @param {string} filePath - 文件路径
 * @returns {string} 目录名
 */
function getDirName(filePath) {
  return path.dirname(filePath);
}

/**
 * 跨平台路径拼接
 * @param {...string} paths - 路径片段
 * @returns {string} 拼接后的路径
 */
function joinPaths(...paths) {
  return path.join(...paths);
}

/**
 * 检查路径是否为绝对路径
 * @param {string} filePath - 文件路径
 * @returns {boolean} 是否为绝对路径
 */
function isAbsolute(filePath) {
  return path.isAbsolute(filePath);
}

/**
 * 获取用户主目录路径
 * @returns {string} 用户主目录路径
 */
function getHomeDir() {
  return path.resolve(require('os').homedir());
}

/**
 * 获取 Claude 配置目录路径
 * @param {string} projectRoot - 项目根目录
 * @returns {Object} Claude 配置路径对象
 */
function getClaudeConfigPaths(projectRoot = process.cwd()) {
  return {
    claudeDir: joinPaths(projectRoot, '.claude'),
    sharedSettings: joinPaths(projectRoot, '.claude', 'settings.json'),
    localSettings: joinPaths(projectRoot, '.claude', 'settings.local.json'),
    mcpConfig: joinPaths(projectRoot, '.mcp.json'),
    userModelsDir: joinPaths(getHomeDir(), '.ccswitch', 'models'),
  };
}

/**
 * 获取全局 Claude 配置目录路径
 * @returns {Object} 全局 Claude 配置路径对象
 */
function getGlobalClaudeConfigPaths() {
  const globalClaudeDir = joinPaths(getHomeDir(), '.claude');
  return {
    claudeDir: globalClaudeDir,
    sharedSettings: joinPaths(globalClaudeDir, 'settings.json'),
    localSettings: joinPaths(globalClaudeDir, 'settings.local.json'),
    mcpConfig: joinPaths(getHomeDir(), '.mcp.json'),
    userModelsDir: joinPaths(getHomeDir(), '.ccswitch', 'models'),
  };
}

/**
 * 安全地连接路径，防止路径遍历攻击
 * @param {string} basePath - 基础路径
 * @param {...string} paths - 要连接的路径片段
 * @returns {string} 安全连接后的路径
 */
function safeJoin(basePath, ...paths) {
  const resolved = path.resolve(basePath, ...paths);

  // 确保结果路径仍然在基础路径下
  if (!resolved.startsWith(path.resolve(basePath))) {
    throw new Error('路径遍历攻击检测：目标路径超出基础路径范围');
  }

  return resolved;
}

/**
 * 获取相对于基础路径的相对路径
 * @param {string} filePath - 文件路径
 * @param {string} basePath - 基础路径
 * @returns {string} 相对路径
 */
function getRelativePath(filePath, basePath = process.cwd()) {
  return path.relative(basePath, filePath);
}

/**
 * 检查路径是否存在（仅做路径检查，不访问文件系统）
 * @param {string} filePath - 文件路径
 * @returns {boolean} 路径格式是否有效
 */
function isValidPath(filePath) {
  try {
    path.parse(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 规范化文件名（移除非法字符）
 * @param {string} filename - 原始文件名
 * @returns {string} 规范化后的文件名
 */
function sanitizeFilename(filename) {
  // Windows/Linux/macOS 常见非法字符
  // eslint-disable-next-line no-control-regex
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g;
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

  let sanitized = filename.replace(invalidChars, '_');

  // 移除前后空格和点
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');

  // 处理Windows保留名称
  if (reservedNames.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }

  // 确保文件名不为空
  if (!sanitized) {
    sanitized = 'unnamed';
  }

  return sanitized;
}

module.exports = {
  normalizePath,
  resolvePath,
  getExtension,
  getBaseName,
  getDirName,
  joinPaths,
  isAbsolute,
  getHomeDir,
  getClaudeConfigPaths,
  getGlobalClaudeConfigPaths,
  safeJoin,
  getRelativePath,
  isValidPath,
  sanitizeFilename,
};
