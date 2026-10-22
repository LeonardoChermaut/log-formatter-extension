(() => {
  /**
   * Tenta converter uma string JSON em um objeto JavaScript. Se a string estiver
   * incompleta ou truncada (como ocorre comumente no Kibana com limites de caracteres),
   * fecha aspas e delimitadores abertos para recuperar todos os dados íntegros anteriores.
   * @param {string} rawJsonText - Texto em formato JSON (potencialmente truncado).
   * @returns {Object|Array|undefined} Objeto ou array interpretado, ou undefined se inválido.
   */
  const tryParseJson = (rawJsonText) => {
    if (typeof rawJsonText !== 'string') {
      return undefined;
    }

    const trimmedText = rawJsonText.trim();
    if (!trimmedText.startsWith('{') && !trimmedText.startsWith('[')) {
      return undefined;
    }

    try {
      return JSON.parse(trimmedText);
    } catch (parseError) {}

    const maximumScanLength = trimmedText.length;
    for (let cutIndex = maximumScanLength; cutIndex > 0; cutIndex -= 1) {
      const candidateCharacter = trimmedText[cutIndex - 1];

      const isCandidateBoundary =
        cutIndex === maximumScanLength ||
        candidateCharacter === ',' ||
        candidateCharacter === '{' ||
        candidateCharacter === '[' ||
        candidateCharacter === '"' ||
        candidateCharacter === ':';

      if (isCandidateBoundary) {
        const candidateSlice = trimmedText.slice(0, cutIndex);
        let openBracketsStack = [];
        let isInsideQuote = false;
        let isEscapedCharacter = false;

        for (let characterIndex = 0; characterIndex < candidateSlice.length; characterIndex += 1) {
          const currentCharacter = candidateSlice[characterIndex];
          if (isInsideQuote) {
            if (isEscapedCharacter) {
              isEscapedCharacter = false;
            } else if (currentCharacter === '\\') {
              isEscapedCharacter = true;
            } else if (currentCharacter === '"') {
              isInsideQuote = false;
            }
          } else {
            if (currentCharacter === '"') {
              isInsideQuote = true;
            } else if (currentCharacter === '{' || currentCharacter === '[') {
              openBracketsStack.push(currentCharacter);
            } else if (currentCharacter === '}') {
              if (openBracketsStack[openBracketsStack.length - 1] === '{') {
                openBracketsStack.pop();
              }
            } else if (currentCharacter === ']') {
              if (openBracketsStack[openBracketsStack.length - 1] === '[') {
                openBracketsStack.pop();
              }
            }
          }
        }

        let closedAttemptText = candidateSlice;
        if (isInsideQuote) {
          closedAttemptText += '"';
        }

        for (let stackIndex = openBracketsStack.length - 1; stackIndex >= 0; stackIndex -= 1) {
          const openingBracket = openBracketsStack[stackIndex];
          closedAttemptText += openingBracket === '{' ? '}' : ']';
        }

        try {
          return JSON.parse(closedAttemptText);
        } catch (repairError) {}
      }
    }

    return undefined;
  };

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

  /**
   * Formata timestamps ISO para o padrão brasileiro de data e hora no fuso de São Paulo.
   * @param {string} isoTimestampString - String de data no formato ISO.
   * @returns {string} Data e hora formatadas (ex: 21/10/2026, 16:43:25,091).
   */
  const formatTimestamp = (isoTimestampString) => {
    if (!isoTimestampString) {
      return '';
    }

    const dateInstance = new Date(isoTimestampString);
    if (Number.isNaN(dateInstance.getTime())) {
      return String(isoTimestampString);
    }

    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      hour12: false,
    }).format(dateInstance);
  };

  /**
   * Identifica se um texto de célula corresponde estritamente a uma data/hora,
   * garantindo que a coluna de horário do Kibana nunca seja modificada ou receba botões.
   * @param {string} candidateText - Texto a ser verificado.
   * @returns {boolean} Verdadeiro se o texto for exclusivamente uma data/hora.
   */
  const isDateOrTimeOnly = (candidateText) => {
    if (typeof candidateText !== 'string') {
      return false;
    }

    const trimmedCandidate = candidateText.trim();
    if (!trimmedCandidate) {
      return false;
    }

    if (
      /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}\s+@\s+\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?$/i.test(
        trimmedCandidate
      )
    ) {
      return true;
    }
    if (
      /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/i.test(
        trimmedCandidate
      )
    ) {
      return true;
    }
    if (
      /^\d{1,2}\/\d{1,2}\/\d{4}[,\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?$/i.test(trimmedCandidate)
    ) {
      return true;
    }

    return false;
  };

  const utilities = {
    tryParseJson,
    unescapeJavaScriptString,
    parseNestedJson,
    formatTimestamp,
    isDateOrTimeOnly,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.utilities = utilities;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = utilities;
  }
})();
