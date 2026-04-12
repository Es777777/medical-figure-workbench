/**
 * help 子命令 - 显示模型命令帮助
 */

function showModelHelp() {
  console.log(`
模型管理命令 (model)

用法:
  ccswitch model <子命令> [选项]

子命令:
  list         列出所有可用的模型模板
  add <name>   添加一个新的模型模板
  help         显示此帮助信息

示例:
  ccswitch model list                 # 列出所有模型
  ccswitch model add my-model         # 添加名为 my-model 的模型

更多信息请访问项目文档。
  `);
}

module.exports = showModelHelp;
