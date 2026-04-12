/**
 * 命令管理器 - 负责命令路由和执行
 */

const ModelCommands = require('./model');
const McpCommands = require('./mcp');

/**
 * 命令管理器类
 * 统一管理所有命令的注册和执行
 */
class CommandManager {
  /**
     * 注册所有可用命令
     */
  static registerCommands() {
    return {
      model: ModelCommands,
      mcp: McpCommands,
    };
  }

  /**
     * 执行指定命令
     * @param {string} command - 命令名称
     * @param {Array} args - 命令参数
     */
  static async execute(command, args = []) {
    const commands = this.registerCommands();

    if (!commands[command]) {
      throw new Error(`未知命令: ${command}\n使用 'ccswitch --help' 查看可用命令`);
    }

    // 如果是复合命令（如 model list），第一个参数是子命令
    const subCommand = args[0];

    // 检查是否为 help 子命令
    if (subCommand === 'help' || subCommand === '--help' || subCommand === '-h') {
      if (commands[command].help) {
        return commands[command].help();
      }
      if (commands[command].commandHelp && args[1]) {
        return commands[command].commandHelp(args[1]);
      }
    }

    if (subCommand && commands[command][subCommand]) {
      // 执行子命令
      return await commands[command][subCommand](args.slice(1));
    }

    if (commands[command].default) {
      // 执行默认命令
      return await commands[command].default(args);
    }

    // 如果没有匹配的子命令，显示帮助
    if (commands[command].help) {
      return commands[command].help();
    }

    throw new Error(`未知子命令: ${subCommand}\n使用 'ccswitch ${command} help' 查看可用子命令`);
  }
}

module.exports = CommandManager;
