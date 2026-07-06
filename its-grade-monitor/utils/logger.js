/**
 * Logger Utility
 * Provides structured logging with levels (info, warn, error, debug) and timestamps.
 */

export const logger = {
  /**
   * Log info message
   * @param {string} message
   * @param {any} [data]
   */
  info(message, data) {
    this._log('INFO', message, data);
  },

  /**
   * Log warning message
   * @param {string} message
   * @param {any} [data]
   */
  warn(message, data) {
    this._log('WARN', message, data);
  },

  /**
   * Log error message
   * @param {string} message
   * @param {any} [data]
   */
  error(message, data) {
    this._log('ERROR', message, data);
  },

  /**
   * Log debug message (if debug mode is enabled)
   * @param {string} message
   * @param {any} [data]
   */
  debug(message, data) {
    this._log('DEBUG', message, data);
  },

  /**
   * Generic logging method helper
   * @private
   */
  _log(level, message, data) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    if (data !== undefined) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }
};
