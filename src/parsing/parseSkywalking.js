(() => {
  const { unescapeJavaScriptString } =
    globalThis.LogFormatter?.jsonEscape ||
    (typeof require !== 'undefined' ? require('../json/escape.js') : {});

  /**
   * Converte o texto bruto de log do Skywalking em entidades estruturadas.
   * @param {string} rawLogText - Texto bruto contendo o log do Skywalking.
   * @returns {Array<Object>} Lista de entradas do Skywalking.
   */
  const parseSkywalkingText = (rawLogText) => {
    const extractFieldValue = (fieldName) => {
      const matchResult = rawLogText.match(new RegExp(`${fieldName}:\\s*'([^']*)'`));
      if (matchResult) {
        return unescapeJavaScriptString(matchResult[1]);
      }
      return undefined;
    };

    return [
      {
        format: 'skywalking',
        level: extractFieldValue('level'),
        message: extractFieldValue('message'),
        source: extractFieldValue('file'),
        errorCode: extractFieldValue('code'),
        details: extractFieldValue('details'),
        stack: extractFieldValue('stack'),
      },
    ];
  };

  const parseSkywalking = {
    parseSkywalkingText,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.parseSkywalking = parseSkywalking;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = parseSkywalking;
  }
})();
