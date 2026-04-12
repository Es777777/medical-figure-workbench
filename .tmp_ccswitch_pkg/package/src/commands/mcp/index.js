/**
 * MCP 管理命令集合
 */

const listModule = require('./list');
const add = require('./add');
const edit = require('./edit');
const remove = require('./remove');
const init = require('./init');

/**
 * 统一 Help 处理
 */
function showHelp() {
  console.log(`
MCP 服务器管理 (mcp)

用法:
  ccswitch mcp <子命令> [选项]

命令:
  list          列出已配置的 MCP 服务器
  init          初始化 MCP 配置文件
  add           添加新的 MCP 服务器 (支持内置模板/全局导入)
  edit          编辑现有 MCP 配置 (参数/密钥)
  remove        删除 MCP 服务器配置

别名:
  rm, delete    -> remove
  update        -> edit

示例:
  ccswitch mcp init
  ccswitch mcp list
  ccswitch mcp add
  ccswitch mcp edit
  `);
}

module.exports = {
  // 适配 list 模块 (它导出的是对象 { handler, help })
  list: listModule.handler,

  // 其他模块直接导出了函数
  init,
  add,
  edit,
  remove,

  // 别名支持
  rm: remove,
  delete: remove,
  update: edit,

  // 帮助命令
  help: showHelp,

  // 默认行为：列出
  default: listModule.handler,
};
