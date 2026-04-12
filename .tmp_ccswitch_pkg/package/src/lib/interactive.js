/**
 * 终端交互工具库
 * 提供选择列表、输入框等交互组件
 */

const readline = require('readline');

/**
 * 创建 readline 接口
 */
function createRL(input = process.stdin, output = process.stdout) {
  return readline.createInterface({
    input,
    output,
  });
}

/**
 * 提问并获取输入
 * @param {string} question - 问题文本
 * @param {boolean} isSecret - 是否为机密输入 (输入时不回显)
 * @param {string} defaultValue - 默认值
 * @returns {Promise<string>} 用户输入
 */
function askInput(question, isSecret = false, defaultValue = '') {
  return new Promise((resolve) => {
    const defaultText = defaultValue ? ` [${defaultValue}]` : '';
    const query = `${question}${defaultText}: `;

    if (isSecret) {
      // 密码模式
      const rl = createRL(process.stdin, process.stderr); // 使用 stderr 避免干扰
      const stdin = process.stdin;

      process.stdout.write(query);

      // 简单的静默模式实现
      const onData = (char) => {
        char = `${char  }`;
        switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.removeListener('data', onData);
          break;
        default:
          // 可以在这里打印 * 号，或者什么都不打印
          break;
        }
      };

      stdin.resume();
      stdin.setRawMode(true);

      let input = '';
      stdin.on('data', (c) => {
        c = `${c  }`;
        switch (c) {
        case '\u0003': // Ctrl+C
          process.exit();
          break;
        case '\n':
        case '\r':
          stdin.setRawMode(false);
          stdin.removeListener('data', onData); // 移除监听
          process.stdout.write('\n');
          rl.close();
          resolve(input || defaultValue);
          break;
        case '\u007f': // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            // 如果回显了星号，这里需要回退光标
          }
          break;
        default:
          input += c;
          break;
        }
      });
    } else {
      // 普通模式
      const rl = createRL();
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer.trim() || defaultValue);
      });
    }
  });
}

/**
 * 列表选择 (单选)
 * @param {Array} choices - 选项数组 [{name, value, disabled, special}]
 * @param {string} message - 提示信息
 * @returns {Promise<Object>} 选中的项 {name, value}
 */
async function select(choices, message = '请选择') {
  console.log(`\n${message}:`);

  let numberIndex = 1; // 单独的序号计数器

  choices.forEach((c) => {
    if (c.disabled) {
      // 分隔线，不占用序号
      console.log(`   ${c.name}`);
    } else if (c.special) {
      // 特殊选项（如编辑、取消），不占用序号
      console.log(`   ${c.name}`);
    } else {
      // 普通选项，占用序号
      console.log(` ${numberIndex}. ${c.name}`);
      c.displayNumber = numberIndex; // 保存显示的序号
      numberIndex++;
    }
  });

  const rl = createRL();
  return new Promise((resolve) => {
    const ask = () => {
      rl.question('\n请输入序号 (q退出): ', (answer) => {
        const trimmedAnswer = answer.trim();

        if (trimmedAnswer.toLowerCase() === 'q') {
          rl.close();
          resolve(null);
          return;
        }

        // 处理特殊选项（通过关键词匹配）
        const specialChoice = choices.find(c =>
          c.special && c.name.toLowerCase().includes(trimmedAnswer.toLowerCase())
        );

        if (specialChoice) {
          rl.close();
          resolve(specialChoice);
          return;
        }

        // 处理数字输入
        const inputNumber = parseInt(trimmedAnswer);
        const selectedChoice = choices.find(c =>
          !c.disabled && !c.special && c.displayNumber === inputNumber
        );

        if (selectedChoice) {
          rl.close();
          resolve(selectedChoice);
          return;
        }

        console.log('❌ 无效的序号，请重新输入');
        ask();
      });
    };
    ask();
  });
}

/**
 * 确认框
 * @param {string} message - 提示信息
 * @param {boolean} defaultYes - 默认是否为 Yes
 * @returns {Promise<boolean>}
 */
function confirm(message, defaultYes = true) {
  return new Promise((resolve) => {
    const rl = createRL();
    const suffix = defaultYes ? 'Y/n' : 'y/N';
    rl.question(`${message} (${suffix}): `, (answer) => {
      rl.close();
      const input = answer.trim().toLowerCase();
      if (input === '') {
        resolve(defaultYes);
      } else {
        resolve(input === 'y' || input === 'yes');
      }
    });
  });
}

module.exports = {
  askInput,
  select,
  confirm,
};
