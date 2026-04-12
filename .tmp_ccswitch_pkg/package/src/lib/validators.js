/**
 * 通用输入验证器集合
 * 提供各种常见的输入验证功能
 */

/**
 * 验证器集合
 */
const VALIDATORS = {
  /**
     * GitHub Token 验证器
     * @param {string} input - 输入的 token
     * @returns {boolean|string} - true 表示验证通过，字符串表示错误信息
     */
  github_token: (input) => {
    if (!input) return 'Token 不能为空';
    if (!input.startsWith('ghp_') && !input.startsWith('github_pat_') && !input.match(/^[a-zA-Z0-9_]+$/)) {
      return 'Token 格式不正确 (通常以 ghp_ 或 github_pat_ 开头)';
    }
    return true;
  },

  /**
     * API 密钥验证器
     * @param {string} input - 输入的 API 密钥
     * @returns {boolean|string} - 验证结果
     */
  api_key: (input) => {
    if (!input) return 'API 密钥不能为空';
    if (input.length < 8) return 'API 密钥长度过短';
    return true;
  },

  /**
     * 路径验证器
     * @param {string} input - 输入的路径
     * @returns {boolean|string} - 验证结果
     */
  path: (input) => {
    if (!input) return '路径不能为空';

    // 检查路径中是否包含潜在的非法字符
    // eslint-disable-next-line no-control-regex
    const invalidChars = /[<>:"|?*\x00-\x1F]/;
    if (invalidChars.test(input)) {
      return '路径包含非法字符，请检查输入';
    }

    // 警告系统关键目录
    const criticalPaths = ['/etc', '/usr/bin', '/bin', '/sbin', '/System'];
    const normalizedInput = input.toLowerCase().replace(/\\/g, '/');
    for (const critical of criticalPaths) {
      if (normalizedInput.startsWith(`${critical.toLowerCase()  }/`) || normalizedInput === critical.toLowerCase()) {
        return `⚠️  警告：${critical} 是系统关键目录，建议选择其他目录`;
      }
    }

    return true;
  },

  /**
     * URL 验证器
     * @param {string} input - 输入的 URL
     * @returns {boolean|string} - 验证结果
     */
  url: (input) => {
    if (!input) return 'URL 不能为空';
    try {
      new URL(input);
      return true;
    } catch {
      return 'URL 格式不正确';
    }
  },

  /**
     * 非空验证器
     * @param {string} input - 输入值
     * @returns {boolean|string} - 验证结果
     */
  non_empty: (input) => {
    if (!input || !input.trim()) return '输入不能为空';
    return true;
  },
};

/**
 * 获取验证器
 * @param {string} validatorName - 验证器名称
 * @returns {Function} - 验证器函数
 */
function getValidator(validatorName) {
  return VALIDATORS[validatorName] || VALIDATORS.non_empty;
}

/**
 * 运行验证
 * @param {string} validatorName - 验证器名称
 * @param {string} input - 输入值
 * @returns {boolean|string} - 验证结果
 */
function validate(validatorName, input) {
  const validator = getValidator(validatorName);
  return validator(input);
}

module.exports = {
  VALIDATORS,
  getValidator,
  validate,
};