(() => {
  const { isNestjsFormat, isSkywalkingFormat, isFilebeatFormat } =
    globalThis.LogFormatter?.detectFormat ||
    (typeof require !== 'undefined' ? require('./detectFormat.js') : {});
  const { parseNestjsText } =
    globalThis.LogFormatter?.parseNestjs ||
    (typeof require !== 'undefined' ? require('./parseNestjs.js') : {});
  const { parseSkywalkingText } =
    globalThis.LogFormatter?.parseSkywalking ||
    (typeof require !== 'undefined' ? require('./parseSkywalking.js') : {});
  const { parseFilebeatText } =
    globalThis.LogFormatter?.parseFilebeat ||
    (typeof require !== 'undefined' ? require('./parseFilebeat.js') : {});
  const { isDateOrTimeOnly } =
    globalThis.LogFormatter?.dateUtils ||
    (typeof require !== 'undefined' ? require('../utils/date.js') : {});

  /**
   * Identifica o formato do log e o converte em entidades estruturadas.
   * Rejeita textos que sejam apenas datas/horários para proteger a coluna de tempo do Kibana.
   * @param {string} rawLogText - Texto bruto da célula.
   * @returns {Array<Object>} Entradas de log interpretadas, ou array vazio se não for log.
   */
  const parseRawLogText = (rawLogText) => {
    if (!rawLogText || typeof rawLogText !== 'string') {
      return [];
    }
    if (isDateOrTimeOnly(rawLogText)) {
      return [];
    }
    if (isNestjsFormat(rawLogText)) {
      return parseNestjsText(rawLogText);
    }
    if (isSkywalkingFormat(rawLogText)) {
      return parseSkywalkingText(rawLogText);
    }
    if (isFilebeatFormat(rawLogText, isDateOrTimeOnly)) {
      return parseFilebeatText(rawLogText);
    }

    return [];
  };

  const parsingIndex = {
    parseRawLogText,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.parsing = parsingIndex;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = parsingIndex;
  }
})();
