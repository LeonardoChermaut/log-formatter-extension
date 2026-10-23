(() => {
  const { LOG_LEVEL } =
    globalThis.LogFormatter?.coreConstants ||
    (typeof require !== 'undefined' ? require('../core/constants.js') : {});
  const { createTextSegment, createBoldSegment, createEmptyLine } =
    globalThis.LogFormatter?.renderSegments ||
    (typeof require !== 'undefined' ? require('./renderSegments.js') : {});
  const { renderComplexValue } =
    globalThis.LogFormatter?.renderValue ||
    (typeof require !== 'undefined' ? require('./renderValue.js') : {});
  const { tryParseJson } =
    globalThis.LogFormatter?.jsonRepair ||
    (typeof require !== 'undefined' ? require('../json/repair.js') : {});
  const { parseNestedJson } =
    globalThis.LogFormatter?.jsonExpand ||
    (typeof require !== 'undefined' ? require('../json/expand.js') : {});
  const { pruneLogData } =
    globalThis.LogFormatter?.filterEngine ||
    (typeof require !== 'undefined' ? require('../filters/engine.js') : {});

  /**
   * Formata um registro do Filebeat / Kubernetes preservando as chaves originais.
   * Expande valores que contenham JSON aninhado via parseNestedJson e renderComplexValue.
   * @param {Object} logEntry - Registro com campos do Filebeat.
   * @param {Object<string, boolean>} [activeFilters={}] - Mapa de filtros ativos.
   * @returns {Array<Array<{ bold: boolean, text: string }>>} Linhas formatadas.
   */
  const formatFilebeatEntry = (logEntry, activeFilters = {}) => {
    const rawLogLevel = logEntry.fields['log.level'] ?? logEntry.fields.level ?? '';
    const serviceName = logEntry.fields['service.name'] ?? '';
    const headerText = [
      LOG_LEVEL[rawLogLevel.toLowerCase()] ?? rawLogLevel.toUpperCase(),
      serviceName,
    ]
      .filter(Boolean)
      .join(' | ');

    const formattedLines = [];
    if (headerText) {
      formattedLines.push([{ type: 'header', ...createBoldSegment(`[${headerText}]`) }]);
    }
    formattedLines.push(createEmptyLine());

    Object.entries(logEntry.fields).forEach(([originalKey, propertyValue]) => {
      const parsedJsonCandidate = tryParseJson(propertyValue);
      if (parsedJsonCandidate !== undefined) {
        const expandedValue = parseNestedJson(parsedJsonCandidate);
        // Apply pruning to nested JSON in Filebeat fields
        const prunedValue = pruneLogData(expandedValue, activeFilters);
        if (prunedValue !== undefined) {
          formattedLines.push([createBoldSegment(`${originalKey}:`)]);
          formattedLines.push(...renderComplexValue(prunedValue, '  '));
        }
      } else {
        const stringifiedValue = String(propertyValue ?? '');
        if (stringifiedValue.includes('\n')) {
          formattedLines.push([createBoldSegment(`${originalKey}:`)]);
          stringifiedValue.split('\n').forEach((textLine) => {
            formattedLines.push([createTextSegment(`  ${textLine}`)]);
          });
        } else {
          formattedLines.push([
            createBoldSegment(`${originalKey}: `),
            createTextSegment(stringifiedValue),
          ]);
        }
      }
    });

    return formattedLines;
  };

  const formatFilebeat = {
    formatFilebeatEntry,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.formatFilebeat = formatFilebeat;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = formatFilebeat;
  }
})();
