(() => {
  const { LOG_LEVEL } =
    globalThis.LogFormatter?.coreConstants ||
    (typeof require !== 'undefined' ? require('../core/constants.js') : {});
  const { createTextSegment, createBoldSegment, createEmptyLine } =
    globalThis.LogFormatter?.renderSegments ||
    (typeof require !== 'undefined' ? require('./renderSegments.js') : {});

  /**
   * Formata um registro do Skywalking.
   * @param {Object} logEntry - Registro com campos do Skywalking.
   * @returns {Array<Array<{ bold: boolean, text: string }>>} Linhas formatadas.
   */
  const formatSkywalkingEntry = (logEntry) => {
    const formattedLines = [
      [
        {
          type: 'header',
          ...createBoldSegment(`[${LOG_LEVEL[logEntry.level] ?? 'ERRO'}]`),
        },
        createTextSegment(' Agente Skywalking'),
      ],
      createEmptyLine(),
    ];

    if (logEntry.source) {
      formattedLines.push([createBoldSegment('Arquivo: '), createTextSegment(logEntry.source)]);
    }
    if (logEntry.errorCode) {
      formattedLines.push([
        createBoldSegment('Código de erro: '),
        createTextSegment(logEntry.errorCode),
      ]);
    }
    if (logEntry.message) {
      formattedLines.push([createBoldSegment('Mensagem: '), createTextSegment(logEntry.message)]);
    }
    if (logEntry.details) {
      formattedLines.push([createBoldSegment('Detalhes: '), createTextSegment(logEntry.details)]);
    }
    if (logEntry.stack) {
      formattedLines.push(createEmptyLine(), [createBoldSegment('Stack trace:')]);
      logEntry.stack.split('\n').forEach((stackLine) => {
        formattedLines.push([createTextSegment(`  ${stackLine.trim()}`)]);
      });
    }

    return formattedLines;
  };

  const formatSkywalking = {
    formatSkywalkingEntry,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.formatSkywalking = formatSkywalking;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = formatSkywalking;
  }
})();
