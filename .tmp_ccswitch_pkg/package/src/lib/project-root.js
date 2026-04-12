/**
 * 项目根目录识别工具
 * 向上查找 .claude/ 或 .git/ 目录确定项目根
 */

const path = require('path');
const fs = require('fs').promises;

/**
 * 缓存项目根目录路径
 */
let projectRootCache = null;

/**
 * 检查文件/目录是否存在
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>} 是否存在
 */
async function _exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 清除项目根目录缓存（主要用于测试）
 */
function clearCache() {
  projectRootCache = null;
}

/**
 * 向上查找项目根目录
 * @param {string} startPath - 起始路径
 * @returns {Promise<string>} 项目根目录路径
 */
async function findProjectRoot(startPath = process.cwd()) {
  // 返回缓存结果
  if (projectRootCache) {
    return projectRootCache;
  }

  let currentPath = startPath;

  // 向上查找，最多查找 10 层
  for (let i = 0; i < 10; i++) {
    try {
      // 检查是否存在 .claude/ 或 .git/ 目录
      const claudeDir = path.join(currentPath, '.claude');
      const gitDir = path.join(currentPath, '.git');

      const claudeExists = await checkExists(claudeDir);
      const gitExists = await checkExists(gitDir);

      if (claudeExists || gitExists) {
        projectRootCache = currentPath;
        return currentPath;
      }

      // 移动到父目录
      const parentPath = path.dirname(currentPath);

      // 如果已经是根目录，停止查找
      if (parentPath === currentPath) {
        break;
      }

      currentPath = parentPath;
    } catch (error) {
      // 忽略错误，继续向上查找
    }
  }

  // 未找到项目根，返回起始路径
  projectRootCache = startPath;
  return startPath;
}

/**
 * 检查文件/目录是否存在（内部函数）
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>} 是否存在
 */
async function checkExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  findProjectRoot,
  clearCache,
  exists: checkExists,
};
