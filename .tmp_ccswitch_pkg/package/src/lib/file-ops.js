/**
 * 文件操作工具
 * 提供文件读写、创建目录等功能
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * 确保目录存在，如果不存在则创建
 * @param {string} dirPath - 目录路径
 */
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * 读取文件内容
 * @param {string} filePath - 文件路径
 * @returns {Promise<string>} 文件内容
 */
async function readFile(filePath) {
  return await fs.readFile(filePath, 'utf-8');
}

/**
 * 写入文件内容
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 * @param {Object} options - 写入选项
 */
async function writeFile(filePath, content, options = {}) {
  // 确保目录存在
  const dir = path.dirname(filePath);
  await ensureDir(dir);

  // 写入文件
  await fs.writeFile(filePath, content, {
    encoding: 'utf-8',
    ...options,
  });
}

/**
 * 检查文件是否存在
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>} 是否存在
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 复制文件
 * @param {string} src - 源文件路径
 * @param {string} dest - 目标文件路径
 */
async function copyFile(src, dest) {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

/**
 * 列出目录中的文件
 * @param {string} dirPath - 目录路径
 * @returns {Promise<string[]>} 文件名列表
 */
async function readDir(dirPath) {
  return await fs.readdir(dirPath);
}

/**
 * 写入配置文件（完整覆盖模式）
 * @param {string} filePath - 配置文件路径
 * @param {Object} config - 配置对象
 * @param {Object} options - 选项
 * @param {boolean} options.createBackup - 是否创建备份
 * @param {boolean} options.validateWrite - 是否验证写入
 */
async function writeConfigFile(filePath, config, options = {}) {
  const { createBackup = false, validateWrite = true } = options;

  // 创建备份（如果启用且文件存在）
  if (createBackup && await fileExists(filePath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup.${timestamp}`;
    await copyFile(filePath, backupPath);
  }

  // 格式化配置为 JSON
  const jsonContent = JSON.stringify(config, null, 2);

  // 写入文件
  await writeFile(filePath, jsonContent);

  // 验证写入（如果启用）
  if (validateWrite) {
    const writtenContent = await readFile(filePath);
    try {
      JSON.parse(writtenContent);
    } catch (error) {
      throw new Error(`配置文件写入验证失败: ${error.message}`);
    }
  }
}

/**
 * 读取配置文件
 * @param {string} filePath - 配置文件路径
 * @param {Object} defaultConfig - 默认配置（文件不存在时返回）
 * @returns {Promise<Object>} 配置对象
 */
async function readConfigFile(filePath, defaultConfig = {}) {
  if (!await fileExists(filePath)) {
    return defaultConfig;
  }

  const content = await readFile(filePath);
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`配置文件格式错误 (${filePath}): ${error.message}`);
  }
}

/**
 * 确保目录有适当的权限
 * @param {string} dirPath - 目录路径
 */
async function ensureDirPermissions(dirPath) {
  try {
    await fs.access(dirPath, fs.constants.W_OK);
  } catch (error) {
    throw new Error(`目录 ${dirPath} 无写入权限: ${error.message}`);
  }
}

/**
 * 获取文件权限（用于安全检查）
 * @param {string} filePath - 文件路径
 * @returns {Promise<Object>} 权限信息
 */
async function getFilePermissions(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return {
      readable: stats.mode & fs.constants.R_OK,
      writable: stats.mode & fs.constants.W_OK,
      executable: stats.mode & fs.constants.X_OK,
      owner: stats.uid,
      group: stats.gid,
    };
  } catch (error) {
    throw new Error(`无法获取文件权限 (${filePath}): ${error.message}`);
  }
}

module.exports = {
  ensureDir,
  readFile,
  writeFile,
  fileExists,
  copyFile,
  readDir,
  writeConfigFile,
  readConfigFile,
  ensureDirPermissions,
  getFilePermissions,
};
