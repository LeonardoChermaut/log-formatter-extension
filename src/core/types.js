(() => {
  /**
   * @typedef {Object} LogEntry
   * @property {'nestjs'|'skywalking'|'filebeat'} format
   * @property {string} [timestamp]
   * @property {string} [message]
   * @property {number} [omittedCount]
   * @property {string} [environment]
   * @property {string} [source]
   * @property {string} [logger]
   * @property {string} [level]
   * @property {string} [application]
   * @property {Object<string, *>} [context]
   * @property {string} [traceId]
   * @property {*} [trace]
   * @property {string} [errorCode]
   * @property {string} [details]
   * @property {string} [stack]
   * @property {Object<string, string>} [fields]
   */

  /**
   * @typedef {Object} FormattedLine
   * @property {boolean} bold
   * @property {string} text
   * @property {string} [type]
   */

  /**
   * @typedef {Array<FormattedLine>} LineSegments
   */

  /**
   * @typedef {Array<LineSegments>} FormattedLines
   */

  /**
   * @typedef {Object} FilterConfig
   * @property {string} id
   * @property {string} label
   */

  /**
   * @typedef {Object<string, boolean>} FilterState
   */

  /**
   * @typedef {Object} CellViewState
   * @property {Node[]} originalNodes
   * @property {HTMLElement[]} formattedNodes
   * @property {LogEntry[]} parsedLogEntries
   * @property {HTMLElement} toolbarElement
   * @property {HTMLButtonElement} toggleButton
   * @property {HTMLElement} filterWrapper
   * @property {HTMLButtonElement} filterButton
   * @property {HTMLElement} filterMenu
   * @property {boolean} isShowingFormatted
   */

  const types = {};

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.types = types;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = types;
  }
})();
