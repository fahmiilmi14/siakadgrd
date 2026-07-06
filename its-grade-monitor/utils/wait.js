/**
 * Wait Utilities
 * Provides helpers for timeouts, delays, and waiting conditions using async/await.
 */

export const wait = {
  /**
   * Resolve after a designated number of milliseconds.
   * @param {number} ms Milliseconds to wait
   * @returns {Promise<void>}
   */
  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Wait for a condition function to return true or timeout.
   * @param {Function} conditionFn Async or sync function returning boolean
   * @param {number} [timeoutMs=30000] Maximum wait time
   * @param {number} [checkIntervalMs=500] Frequency of checks
   * @returns {Promise<boolean>} Resolves to true if condition met, false if timed out
   */
  async forCondition(conditionFn, timeoutMs = 30000, checkIntervalMs = 500) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (await conditionFn()) {
        return true;
      }
      await this.delay(checkIntervalMs);
    }
    return false;
  }
};
