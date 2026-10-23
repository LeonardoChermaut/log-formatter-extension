(() => {
  const { unescapeJavaScriptString } =
    globalThis.LogFormatter?.jsonEscape ||
    (typeof require !== 'undefined' ? require('../json/escape.js') : {});

  /**
   * Interpreta literais escalares simples extraídos de texto inspecionado (Node util.inspect).
   * @param {string} scalarText - Texto contendo literal com ou sem aspas.
   * @returns {string|undefined} Valor da string ou undefined se ausente.
   */
  const parseScalarLiteral = (scalarText) => {
    const matchResult = scalarText.match(/^\s*(?:'((?:[^'\\]|\\.)*)'|([^\s,}]+))/);
    if (!matchResult) {
      return undefined;
    }
    if (matchResult[1] !== undefined) {
      return unescapeJavaScriptString(matchResult[1]);
    }
    if (matchResult[2] === 'undefined' || matchResult[2] === 'null') {
      return undefined;
    }

    return matchResult[2];
  };

  /**
   * Interpreta o campo message do log inspecionado, capturando tanto a mensagem
   * quanto o contador de caracteres omitidos caso o Kibana tenha truncado o log.
   * Suporta strings entre aspas simples, aspas duplas e template literals (backticks).
   * @param {string} messageFieldText - Texto bruto do campo message.
   * @returns {{ text: string, omittedCount: number }} Conteúdo da mensagem e caracteres omitidos.
   */
  const parseMessageLiteral = (messageFieldText) => {
    const singleQuoteMatch = messageFieldText.match(
      /^\s*'([\s\S]*)'(?:\.\.\. (\d+) more characters?)?\s*,?\s*$/
    );
    if (singleQuoteMatch) {
      return {
        text: unescapeJavaScriptString(singleQuoteMatch[1]),
        omittedCount: Number(singleQuoteMatch[2] ?? 0),
      };
    }

    const backtickMatch = messageFieldText.match(
      /^\s*`([\s\S]*)`(?:\.\.\. (\d+) more characters?)?\s*,?\s*$/
    );
    if (backtickMatch) {
      return {
        text: unescapeJavaScriptString(backtickMatch[1]),
        omittedCount: Number(backtickMatch[2] ?? 0),
      };
    }

    const doubleQuoteMatch = messageFieldText.match(
      /^\s*"([\s\S]*)"(?:\.\.\. (\d+) more characters?)?\s*,?\s*$/
    );
    if (doubleQuoteMatch) {
      return {
        text: unescapeJavaScriptString(doubleQuoteMatch[1]),
        omittedCount: Number(doubleQuoteMatch[2] ?? 0),
      };
    }

    return {
      text: parseScalarLiteral(messageFieldText) ?? '',
      omittedCount: 0,
    };
  };

  /**
   * Interpreta o objeto ou Map do campo context preservando os nomes das chaves originais.
   * Tenta parsear valores que pareçam objetos/arrays literais (ex: { key: 'value' }, [1, 2, 3]).
   * @param {string} contextFieldText - Texto bruto do campo context.
   * @returns {Object<string, *>} Mapa de chaves originais e valores correspondentes (strings ou objetos parseados).
   */
  const parseContextLiteral = (contextFieldText) => {
    const valuePattern = "(?:'((?:[^'\\\\]|\\\\.)*)'|([^,\\n}]+))";
    const mapPattern = new RegExp(`'([^']+)' => ${valuePattern}`, 'g');
    const objectPattern = new RegExp(`^\\s*'?([\\w$-]+)'?: ${valuePattern}`, 'gm');

    const toContextEntry = (matchedGroup) => {
      const [, propertyKey, matchedValue, unquotedValue] = matchedGroup;
      const rawValue =
        matchedValue !== undefined ? unescapeJavaScriptString(matchedValue) : unquotedValue.trim();
      const parsedValue = tryParseInspectValue(rawValue);
      return [propertyKey, parsedValue];
    };

    const mapEntries = [...contextFieldText.matchAll(mapPattern)].map(toContextEntry);
    if (mapEntries.length > 0) {
      return Object.fromEntries(mapEntries);
    }

    const objectEntries = [...contextFieldText.matchAll(objectPattern)].map(toContextEntry);
    return Object.fromEntries(objectEntries);
  };

  /**
   * Tenta parsear um valor do context que possa ser um objeto/array literal.
   * @param {string} rawValue - Valor bruto extraído do context.
   * @returns {*} Valor parseado (objeto/array) ou string original.
   */
  const tryParseInspectValue = (rawValue) => {
    const trimmed = rawValue.trim();
    if (!trimmed || trimmed === '[Object]' || trimmed === '[Array]') {
      return rawValue;
    }

    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      const parsed = parseInspectObject(trimmed);
      if (parsed !== trimmed && typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    }

    return rawValue;
  };

  /**
   * Interpreta um literal de objeto do util.inspect (ex: trace, errorResponse).
   * Suporta objetos aninhados, arrays e valores primitivos.
   * @param {string} objectText - Texto bruto do objeto.
   * @returns {Object|string} Objeto parseado ou string original se falhar.
   */
  const parseInspectObject = (objectText) => {
    const trimmed = objectText.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
      return undefined;
    }

    if (trimmed === '[Object]' || trimmed === '[Array]') {
      return trimmed;
    }

    try {
      const jsonCompatible = trimmed
        .replace(/'/g, '"')
        .replace(/(\w+):/g, '"$1":')
        .replace(/:\s*'([^']*)'/g, ': "$1"')
        .replace(/:\s*`([^`]*)`/g, ': "$1"');
      return JSON.parse(jsonCompatible);
    } catch {
      const braceMatch = trimmed.match(/^\{(.*)\}$/s);
      if (braceMatch) {
        const content = braceMatch[1];
        const result = {};
        let depth = 0;
        let currentKey = '';
        let currentValue = '';
        let inKey = true;
        let inString = false;
        let stringChar = '';
        let escapeNext = false;

        for (let i = 0; i < content.length; i++) {
          const char = content[i];

          if (escapeNext) {
            if (inKey) {
              currentKey += char;
            } else {
              currentValue += char;
            }
            escapeNext = false;
            continue;
          }

          if (char === '\\') {
            escapeNext = true;
            if (inKey) {
              currentKey += char;
            } else {
              currentValue += char;
            }
            continue;
          }

          if ((char === '"' || char === "'" || char === '`') && !inString) {
            inString = true;
            stringChar = char;
            if (inKey) {
              currentKey += char;
            } else {
              currentValue += char;
            }
            continue;
          }

          if (char === stringChar && inString) {
            inString = false;
            stringChar = '';
            if (inKey) {
              currentKey += char;
            } else {
              currentValue += char;
            }
            continue;
          }

          if (inString) {
            if (inKey) {
              currentKey += char;
            } else {
              currentValue += char;
            }
            continue;
          }

          if (char === '{' || char === '[') {
            depth++;
            if (inKey) {
              currentKey += char;
            } else {
              currentValue += char;
            }
            continue;
          }

          if (char === '}' || char === ']') {
            depth--;
            if (inKey) {
              currentKey += char;
            } else {
              currentValue += char;
            }
            continue;
          }

          if (depth === 0 && char === ':' && inKey) {
            inKey = false;
            continue;
          }

          if (depth === 0 && char === ',') {
            const key = currentKey.trim().replace(/^['"`]|['"`]$/g, '');
            const value = currentValue.trim();
            if (key) {
              result[key] = parseInspectObject(value);
            }
            currentKey = '';
            currentValue = '';
            inKey = true;
            continue;
          }

          if (inKey) {
            currentKey += char;
          } else {
            currentValue += char;
          }
        }

        if (currentKey.trim()) {
          const key = currentKey.trim().replace(/^['"`]|['"`]$/g, '');
          const value = currentValue.trim();
          if (key) {
            result[key] = parseInspectObject(value);
          }
        }

        return Object.keys(result).length > 0 ? result : trimmed;
      }

      return trimmed;
    }
  };

  const parseInspect = {
    parseScalarLiteral,
    parseMessageLiteral,
    parseContextLiteral,
    tryParseInspectValue,
    parseInspectObject,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.parseInspect = parseInspect;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = parseInspect;
  }
})();
