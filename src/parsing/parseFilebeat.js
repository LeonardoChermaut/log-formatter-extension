(() => {
  /**
   * Converte pares de chave e valor do Filebeat / Kubernetes em entidade estruturada.
   * @param {string} rawLogText - Texto bruto contendo pares chave: valor.
   * @returns {Array<Object>} Lista contendo o registro do Filebeat.
   */
  const parseFilebeatText = (rawLogText) => {
    const parsedFields = {};
    const linePattern = /^([@\w][\w.-]*):\s+([\s\S]*?)(?=\n[@\w][\w.-]*:\s|\n*$)/gm;
    let matchResult = linePattern.exec(rawLogText);

    while (matchResult !== null) {
      parsedFields[matchResult[1]] = matchResult[2].trim();
      matchResult = linePattern.exec(rawLogText);
    }

    return [
      {
        format: 'filebeat',
        fields: parsedFields,
      },
    ];
  };

  const parseFilebeat = {
    parseFilebeatText,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.parseFilebeat = parseFilebeat;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = parseFilebeat;
  }
})();
