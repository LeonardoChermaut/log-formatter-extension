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
    } catch {}

    const length = trimmedText.length;
    for (let cutIndex = length; cutIndex > 0; cutIndex -= 1) {
      const char = trimmedText[cutIndex - 1];

      const isCandidateBoundary =
        cutIndex === length ||
        char === ',' ||
        char === '{' ||
        char === '[' ||
        char === '"' ||
        char === ':';

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
        } catch {}
      }
    }

    return undefined;
  };

  const jsonRepair = {
    tryParseJson,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.jsonRepair = jsonRepair;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = jsonRepair;
  }
})();
