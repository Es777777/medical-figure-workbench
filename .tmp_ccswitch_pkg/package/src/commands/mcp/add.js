/**
 * MCP 添加向导
 * 支持从 内置模板 或 全局配置 中选择添加，包含参数引导和 Key 安全注入
 */

const { getAvailableMcpSources, readMcpConfig, writeMcpConfig } = require('../../lib/mcp-manager');
const { findProjectRoot } = require('../../lib/project-root');
const { readConfigFile, writeConfigFile, fileExists } = require('../../lib/file-ops');
const { getClaudeConfigPaths } = require('../../lib/path-helper');
const { processPrompts, replacePlaceholder } = require('../../lib/input-processor');
const interactive = require('../../lib/interactive');

/**
 * 颜色辅助函数
 */
function colorize(text, color) {
  const colors = {
    blue: '\x1b[36m',   // 青色 (蓝色)
    reset: '\x1b[0m'    // 重置
  };
  return `${colors[color]}${text}${colors.reset}`;
}

async function addMcp(_args) {
  try {
    const projectRoot = await findProjectRoot();
    if (!projectRoot) {
      console.error('❌ 请在项目根目录下运行此命令');
      return;
    }

    // 1. 获取源
    console.log('🔄 正在扫描可用 MCP 服务器...');
    const sources = await getAvailableMcpSources();
    const currentConfig = (await readMcpConfig(projectRoot)) || { mcpServers: {} };
    const installedNames = Object.keys(currentConfig.mcpServers);

    // 2. 构建列表
    const choices = sources.map((source) => {
      const isInstalled = installedNames.includes(source.name);
      const icon = source.source === 'builtin' ? '📦' : '🖥️';
      const installedMark = isInstalled ? ` ${colorize('[已安装]', 'blue')}` : '';

      return {
        name: `${icon} ${source.name} - ${source.description}${installedMark}`,
        value: source,
      };
    });

    if (choices.length === 0) {
      console.log('📭 未找到可用的 MCP 模板或全局配置');
      return;
    }

    // 3. 选择
    const selectedSource = await interactive.select(choices, '请选择要添加的 MCP 服务器');
    if (!selectedSource) return;

    const source = selectedSource.value;
    console.log(`\n🚀 准备配置: ${source.name}`);

    // 4. 参数引导
    let finalConfig = JSON.parse(JSON.stringify(source.config));
    let sensitiveKeys = {};

    if (source.meta && source.meta.prompts) {
      const result = await processPrompts(source.meta.prompts, projectRoot);

      // 检查是否用户取消
      if (result.cancelled) {
        console.log('❌ 操作已取消');
        return;
      }

      // 应用替换
      for (const [key, value] of Object.entries(result.replacements)) {
        const placeholder = `<${key}>`;
        finalConfig = replacePlaceholder(finalConfig, placeholder, value);
      }

      // 处理路径的安全确认
      if (source.meta.prompts.some(p => p.validate === 'path')) {
        const pathPrompts = source.meta.prompts.filter(p => p.validate === 'path');
        for (const pathPrompt of pathPrompts) {
          const placeholderKey = pathPrompt.placeholder?.replace(/[<>]/g, '');
          if (placeholderKey && result.replacements[placeholderKey]) {
            const pathInput = result.replacements[placeholderKey];
            console.log('\n📍 将授予 AI 对以下目录的访问权限:');
            console.log(`   ${pathInput}`);
            console.log('\n⚠️  AI 将能够:');
            console.log('   • 读取该目录及其所有子目录中的文件');
            console.log('   • 创建、修改和删除文件');
            console.log('   • 创建新的子目录');

            const confirm = await interactive.confirm('确认授予此访问权限吗？', true);
            if (!confirm) {
              console.log('❌ 操作已取消');
              return;
            }
          }
        }
      }

      // 收集敏感键
      sensitiveKeys = result.sensitiveKeys;

      // 从配置中提取敏感键（用于现有配置中的敏感信息）
      if (finalConfig.env) {
        for (const [key, val] of Object.entries(finalConfig.env)) {
          if (typeof val === 'string') {
            // 检查是否包含占位符替换后的值
            for (const replacedValue of Object.values(result.replacements)) {
              if (val === replacedValue && (key.includes('TOKEN') || key.includes('KEY'))) {
                sensitiveKeys[key] = replacedValue;
              }
            }
          }
        }
      }
    }

    // 5. 全局配置敏感信息检查
    if (source.source === 'global' && source.config.env) {
      const hasKey = Object.keys(source.config.env).some((k) => k.match(/KEY|TOKEN/i));
      if (hasKey) {
        console.log('⚠️  检测到全局配置包含潜在的敏感 Key。');
        const keepKeys = await interactive.confirm('是否在项目中保留这些 Key?', true);
        if (!keepKeys) finalConfig.env = {};
      }
    }

    // 6. 写入 .mcp.json
    console.log('\n💾 正在写入项目配置...');
    currentConfig.mcpServers[source.name] = finalConfig;
    await writeMcpConfig(currentConfig, projectRoot);
    console.log('✅ 已更新 .mcp.json');

    // 7. 处理敏感 Key (settings.local.json)
    if (Object.keys(sensitiveKeys).length > 0) {
      console.log('🔒 正在安全保存密钥到 settings.local.json...');
      const paths = getClaudeConfigPaths(projectRoot);
      let localSettings = {};
      if (await fileExists(paths.localSettings)) {
        try {
          localSettings = await readConfigFile(paths.localSettings);
        } catch (e) {
          // 忽略读取错误，使用默认配置
        }
      }

      if (!localSettings.env) localSettings.env = {};
      Object.assign(localSettings.env, sensitiveKeys);

      await writeConfigFile(paths.localSettings, localSettings);
      console.log('✅ 密钥已保存');
    }

    console.log(`\n🎉 MCP 服务器 "${source.name}" 配置成功！`);
    console.log('🔄 请重启 Claude Code 以生效。');
  } catch (error) {
    console.error('❌ 添加失败:', error.message);
  }
}

module.exports = addMcp;
