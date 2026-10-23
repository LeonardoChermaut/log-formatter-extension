(() => {
  /**
   * Converte sequências de escape em caracteres reais correspondentes (\n, \t, etc.).
   * @param {string} textWithEscapes - Texto original contendo sequências de escape.
   * @returns {string} Texto com os caracteres de escape resolvidos.
   */
  const unescapeJavaScriptString = (textWithEscapes) => {
    if (typeof textWithEscapes !== 'string') {
      return '';
    }

    return textWithEscapes.replace(/\\(.)/g, (_matchedSequence, escapedCharacter) => {
      const escapeLookup = {
        n: '\n',
        r: '\r',
        t: '\t',
        "'": "'",
        '"': '"',
        '\\': '\\',
      };
      return escapeLookup[escapedCharacter] ?? escapedCharacter;
    });
  };

  const jsonEscape = {
    unescapeJavaScriptString,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.jsonEscape = jsonEscape;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = jsonEscape;
  }
})();
