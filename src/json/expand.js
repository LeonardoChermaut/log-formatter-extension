(() => {
  const { tryParseJson } =
    globalThis.LogFormatter?.jsonRepair ||
    (typeof require !== 'undefined' ? require('./repair.js') : {});

  /**
   * Percorre recursivamente um objeto ou array e converte strings que contenham
   * JSON em objetos nativos, sem perder nenhum dado.
   * @param {*} valueToExpand - Valor primitivo, string, objeto ou array.
   * @returns {*} Valor com todos os níveis de JSON expandidos.
   */
  const parseNestedJson = (valueToExpand) => {
    if (typeof valueToExpand === 'string') {
      const parsedCandidate = tryParseJson(valueToExpand);
      if (
        parsedCandidate !== undefined &&
        typeof parsedCandidate === 'object' &&
        parsedCandidate !== null
      ) {
        return parseNestedJson(parsedCandidate);
      }
      return valueToExpand;
    }

    if (Array.isArray(valueToExpand)) {
      return valueToExpand.map(parseNestedJson);
    }

    if (valueToExpand !== null && typeof valueToExpand === 'object') {
      const expandedObject = {};
      for (const [propertyKey, propertyValue] of Object.entries(valueToExpand)) {
        expandedObject[propertyKey] = parseNestedJson(propertyValue);
      }

      return expandedObject;
    }

    return valueToExpand;
  };

  const jsonExpand = {
    parseNestedJson,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.jsonExpand = jsonExpand;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = jsonExpand;
  }
})();
