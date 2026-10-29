(() => {
  const { LOG_LEVEL } =
    globalThis.LogFormatter?.coreConstants ||
    (typeof require !== 'undefined' ? require('../core/constants.js') : {});
  const { formatTimestamp } =
    globalThis.LogFormatter?.dateUtils ||
    (typeof require !== 'undefined' ? require('../utils/date.js') : {});
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
   * Formata um registro do NestJS exibindo cabeçalho legível, payload (JSON ou texto),
   * dados de origem e contexto preservando as chaves originais sem sobreescrever.
   * @param {Object} logEntry - Objeto com os atributos do log do NestJS.
   * @param {Object<string, boolean>} [activeFilters={}] - Mapa de filtros ativos.
   * @returns {Array<Array<{ bold: boolean, text: string }>>} Linhas de segmentos formatadas.
   */
  const formatNestjsEntry = (logEntry, activeFilters = {}) => {
    const formattedLines = [];

    const levelDescription =
      LOG_LEVEL[logEntry.level] ?? String(logEntry.level ?? 'INFO').toUpperCase();
    const formattedDateTime = formatTimestamp(logEntry.timestamp);
    const applicationDetails = [
      logEntry.application,
      logEntry.environment ? `(${logEntry.environment})` : '',
    ]
      .filter(Boolean)
      .join(' ');

    formattedLines.push([
      {
        type: 'header',
        ...createBoldSegment(`[${levelDescription}]`),
      },
      createTextSegment(
        ` ${formattedDateTime}${applicationDetails ? ` | ${applicationDetails}` : ''}`
      ),
    ]);

    if (logEntry.message) {
      formattedLines.push(createEmptyLine());
      const parsedJsonMessage = tryParseJson(logEntry.message);

      if (parsedJsonMessage !== undefined) {
        const expandedMessageData = parseNestedJson(parsedJsonMessagage)
        const prunedMessageData = pruneLogData(expandedMessageData, activeFilters);
        if (prunedMessageData !== undefined) {
          formattedLines.push([createBoldSegment('Mensagem:')]);
          formattedLines.push(...renderComplexValue(prunedMessageData, '  '));
        }
      } else {
        formattedLines.push([createBoldSegment('Mensagem:')]);
        logEntry.message.split('\n').forEach((messageLine) => {
          formattedLines.push([createTextSegment(`  ${messageLine}`)]);
        });
      }
    }

    const sourceMetadataLines = [];
    if (logEntry.logger) {
      sourceMetadataLines.push([
        createBoldSegment('service: '),
        createTextSegment(logEntry.logger),
      ]);
    }
    if (logEntry.source) {
      sourceMetadataLines.push([createBoldSegment('file: '), createTextSegment(logEntry.source)]);
    }
    if (logEntry.traceId) {
      sourceMetadataLines.push([
        createBoldSegment('traceId: '),
        createTextSegment(logEntry.traceId),
      ]);
    }
    if (logEntry.trace) {
      sourceMetadataLines.push([
        createBoldSegment('Marcador (trace): '),
        createTextSegment(logEntry.trace),
      ]);
    }
    if (logEntry.omittedCount > 0) {
      sourceMetadataLines.push([
        createBoldSegment('Mensagem truncada no Kibana: '),
        createTextSegment(`${logEntry.omittedCount.toLocaleString('pt-BR')} caracteres omitidos`),
      ]);
    }

    if (sourceMetadataLines.length > 0) {
      formattedLines.push(createEmptyLine(), [createBoldSegment('Origem do log')]);
      formattedLines.push(...sourceMetadataLines);
    }

    if (logEntry.context && typeof logEntry.context === 'object') {
      const contextEntries = Object.entries(logEntry.context).filter(([contextKey]) => {
        return contextKey !== 'traceId';
      });

      if (contextEntries.length > 0) {
        formattedLines.push(createEmptyLine(), [
          createBoldSegment('Contexto da requisição recebida'),
        ]);
        contextEntries.forEach(([originalKey, contextValue]) => {
          if (contextValue !== null && typeof contextValue === 'object') {
            const prunedContextValue = pruneLogData(contextValue, activeFilters);
            if (prunedContextValue !== undefined) {
              formattedLines.push([createBoldSegment(`${originalKey}:`)]);
              formattedLines.push(...renderComplexValue(prunedContextValue, '  '));
            }
          } else {
            formattedLines.push([
              createBoldSegment(`${originalKey}: `),
              createTextSegment(String(contextValue ?? '')),
            ]);
          }
        });
      }
    }

    return formattedLines;
  };

  const formatNestjs = {
    formatNestjsEntry,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.formatNestjs = formatNestjs;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = formatNestjs;
  }
})();
