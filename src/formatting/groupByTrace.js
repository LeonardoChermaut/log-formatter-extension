(() => {
  const { createTextSegment, createEmptyLine, createSeparatorLine } =
    globalThis.LogFormatter?.renderSegments ||
    (typeof require !== 'undefined' ? require('./renderSegments.js') : {});
  const { formatNestjsEntry } =
    globalThis.LogFormatter?.formatNestjs ||
    (typeof require !== 'undefined' ? require('./formatNestjs.js') : {});
  const { formatSkywalkingEntry } =
    globalThis.LogFormatter?.formatSkywalking ||
    (typeof require !== 'undefined' ? require('./formatSkywalking.js') : {});
  const { formatFilebeatEntry } =
    globalThis.LogFormatter?.formatFilebeat ||
    (typeof require !== 'undefined' ? require('./formatFilebeat.js') : {});

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

  /**
   * Agrupa as entradas de log por traceId e as ordena cronologicamente por timestamp.
   * @param {Array<Object>} logEntries - Lista de entradas de log.
   * @returns {Array<[string, Array<Object>]>} Lista de tuplas com traceId e grupo de logs ordenado.
   */
  const groupEntriesByTraceId = (logEntries) => {
    const traceGroupsMap = new Map();

    logEntries.forEach((currentEntry) => {
      const traceIdentifier = currentEntry.traceId ?? 'sem-traceId';
      const existingGroup = traceGroupsMap.get(traceIdentifier) ?? [];
      existingGroup.push(currentEntry);
      traceGroupsMap.set(traceIdentifier, existingGroup);
    });

    return [...traceGroupsMap].map(([traceIdentifier, entriesList]) => {
      const sortedEntriesList = [...entriesList].sort((firstEntry, secondEntry) => {
        const firstTimestamp = new Date(firstEntry.timestamp).getTime();
        const secondTimestamp = new Date(secondEntry.timestamp).getTime();
        return firstTimestamp - secondTimestamp;
      });
      return [traceIdentifier, sortedEntriesList];
    });
  };

  /**
   * Formata um grupo de logs pertencentes ao mesmo traceId.
   * @param {[string, Array<Object>]} traceGroupTuple - Tupla com o traceId e lista de logs.
   * @param {Object<string, boolean>} [activeFilters={}] - Mapa de filtros ativos.
   * @returns {Array<Array<{ bold: boolean, text: string }>>} Linhas formatadas com o título do grupo.
   */
  const formatTraceGroup = ([traceIdentifier, groupEntries], activeFilters = {}) => {
    const groupTitle =
      traceIdentifier === 'sem-traceId'
        ? `${groupEntries.length} registro(s)`
        : `traceId ${traceIdentifier}`;

    const renderedGroupLines = [[{ type: 'group-title', bold: true, text: groupTitle }]];

    groupEntries.forEach((logEntry, entryIndex) => {
      if (entryIndex > 0) {
        renderedGroupLines.push(createSeparatorLine());
      }
      const singleEntryLines = formatLogEntry(logEntry, activeFilters);
      const orderPrefix =
        groupEntries.length > 1 ? `(${entryIndex + 1}/${groupEntries.length}) ` : '';
      const firstLineSegments = singleEntryLines[0] ?? [createTextSegment('')];
      renderedGroupLines.push(
        [{ type: 'header', ...createTextSegment(orderPrefix) }, ...firstLineSegments],
        ...singleEntryLines.slice(1)
      );
    });

    return renderedGroupLines;
  };

  /**
   * Formata um array de entradas de log agrupando-as por traceId.
   * @param {Array<Object>} logEntries - As entradas de log a serem formatadas.
   * @param {Object<string, boolean>} [activeFilters={}] - Mapa de filtros ativos.
   * @returns {Array<Array<{ bold: boolean, text: string }>>} As entradas de log formatadas prontas para renderização.
   */
  const formatLogEntries = (logEntries, activeFilters = {}) => {
    const renderedOutput = [];

    groupEntriesByTraceId(logEntries).forEach((logGroup, groupIndex) => {
      if (groupIndex > 0) {
        renderedOutput.push(createEmptyLine(), createEmptyLine());
      }
      renderedOutput.push(...formatTraceGroup(logGroup, activeFilters));
    });

    return renderedOutput;
  };

  const groupByTrace = {
    groupEntriesByTraceId,
    formatTraceGroup,
    formatLogEntries,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.groupByTrace = groupByTrace;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = groupByTrace;
  }
})();
