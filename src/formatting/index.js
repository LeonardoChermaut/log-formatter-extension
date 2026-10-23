(() => {
  const { formatNestjsEntry } =
    globalThis.LogFormatter?.formatNestjs ||
    (typeof require !== 'undefined' ? require('./formatNestjs.js') : {});
  const { formatSkywalkingEntry } =
    globalThis.LogFormatter?.formatSkywalking ||
    (typeof require !== 'undefined' ? require('./formatSkywalking.js') : {});
  const { formatFilebeatEntry } =
    globalThis.LogFormatter?.formatFilebeat ||
    (typeof require !== 'undefined' ? require('./formatFilebeat.js') : {});
  const { formatLogEntries } =
    globalThis.LogFormatter?.groupByTrace ||
    (typeof require !== 'undefined' ? require('./groupByTrace.js') : {});

  /**
   * Direciona o registro de log para o formatador apropriado com base em seu formato identificado.
   * @param {Object} logEntry - Registro de log a ser formatado.
   * @param {Object<string, boolean>} [activeFilters={}] - Mapa de filtros ativos.
   * @returns {Array<Array<{ bold: boolean, text: string }>>} Linhas de segmentos formatadas.
   */
  const formatLogEntry = (logEntry, activeFilters = {}) => {
    if (logEntry.format === 'nestjs') {
      return formatNestjsEntry(logEntry, activeFilters);
    }
    if (logEntry.format === 'skywalking') {
      return formatSkywalkingEntry(logEntry);
    }
    return formatFilebeatEntry(logEntry, activeFilters);
  };

  const formattingIndex = {
    formatLogEntry,
    formatLogEntries,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.formatting = formattingIndex;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = formattingIndex;
  }
})();
