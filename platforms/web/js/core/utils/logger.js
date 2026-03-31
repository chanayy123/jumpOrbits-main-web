/**
 * 简易日志系统 - 支持不同日志级别和过滤功能
 */

// 日志级别定义
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4 // 完全禁用日志
};

// 日志级别对应的样式
const LOG_STYLES = {
  [LogLevel.DEBUG]: 'color: #7f7f7f',
  [LogLevel.INFO]: 'color: #0066ff',
  [LogLevel.WARN]: 'color: #ff9900; font-weight: bold',
  [LogLevel.ERROR]: 'color: #ff0000; font-weight: bold'
};

// 日志级别对应的前缀
const LOG_PREFIX = {
  [LogLevel.DEBUG]: '[调试]',
  [LogLevel.INFO]: '[信息]',
  [LogLevel.WARN]: '[警告]',
  [LogLevel.ERROR]: '[错误]'
};

/**
 * 简易日志类 - 单例模式
 */
class Logger {
  constructor() {
    // 默认配置
    this.config = {
      level: LogLevel.DEBUG, // 默认日志级别
      enabled: true, // 是否启用日志
      showTimestamp: true, // 是否显示时间戳
    };
  }

  /**
   * 更新日志配置
   * @param {Object} config 配置对象
   */
  updateConfig(config) {
    if (config) {
      this.config = {
        level: config.DEFAULT_LEVEL ?? this.config.level,
        enabled: config.ENABLE_LOGS ?? this.config.enabled,
        showTimestamp: config.SHOW_TIMESTAMP ?? this.config.showTimestamp
      };
    }
  }

  /**
   * 设置日志级别
   * @param {LogLevel} level 日志级别
   */
  setLevel(level) {
    if (level in LogLevel) {
      this.config.level = level;
    }
  }

  /**
   * 启用或禁用日志
   * @param {boolean} enabled 是否启用
   */
  setEnabled(enabled) {
    this.config.enabled = enabled;
  }

  /**
   * 获取格式化的时间戳
   * @returns {string} 格式化的时间戳
   */
  getTimestamp() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  }

  /**
   * 内部日志方法
   * @param {LogLevel} level 日志级别
   * @param {Array} args 日志参数
   */
  _log(level, ...args) {
    // 检查是否启用日志以及日志级别
    if (!this.config.enabled || level < this.config.level) {
      return;
    }

    // 构建日志前缀
    let prefix = LOG_PREFIX[level];

    if (this.config.showTimestamp) {
      prefix = `${prefix} [${this.getTimestamp()}]`;
    }

    // 根据不同日志级别使用不同的控制台方法
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`%c${prefix}`, LOG_STYLES[level], ...args);
        break;
      case LogLevel.INFO:
        console.info(`%c${prefix}`, LOG_STYLES[level], ...args);
        break;
      case LogLevel.WARN:
        console.warn(`%c${prefix}`, LOG_STYLES[level], ...args);
        break;
      case LogLevel.ERROR:
        console.error(`%c${prefix}`, LOG_STYLES[level], ...args);
        break;
      default:
        console.log(`%c${prefix}`, LOG_STYLES[level], ...args);
    }
  }

  // 公开的日志方法
  debug(...args) {
    this._log(LogLevel.DEBUG, ...args);
  }

  info(...args) {
    this._log(LogLevel.INFO, ...args);
  }

  warn(...args) {
    this._log(LogLevel.WARN, ...args);
  }

  error(...args) {
    this._log(LogLevel.ERROR, ...args);
  }
}

// 创建单例日志实例
const logger = new Logger();

// 导出日志实例和日志级别
export { logger, LogLevel };
export default logger; 