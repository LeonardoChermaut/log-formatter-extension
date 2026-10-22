(() => {
  const FILTER_DEFINITIONS = [
    { id: 'null', label: 'Valores nulos (null, undefined)' },
    { id: 'emptyString', label: 'Strings vazias ("")' },
    { id: 'false', label: 'Valores falsos (false)' },
    { id: 'emptyArray', label: 'Arrays vazios ([], ["", ""])' },
    { id: 'emptyObject', label: 'Objetos vazios ({})' },
  ];

  const DEFAULT_FILTER_OPTIONS = {
    null: false,
    emptyString: false,
    false: false,
    emptyArray: false,
    emptyObject: false,
  };

  const FILTER_STORAGE_KEY = 'kibana_log_formatter_filters';

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

  /**
   * Verifica se o valor é um array não vazio composto exclusivamente por números.
   * Utilizado para identificar buffers binários ou sequências numéricas que não agregam
   * valor legível direto aos logs e devem ser sumarizados visualmente.
   * @param {*} candidateArray - Valor a ser verificado.
   * @returns {boolean} Verdadeiro se for um array não vazio apenas com números.
   */
  const isNumericArray = (candidateArray) => {
    return (
      Array.isArray(candidateArray) &&
      candidateArray.length > 0 &&
      candidateArray.every((item) => typeof item === 'number')
    );
  };

  /**
   * Verifica se o valor é nulo ou indefinido.
   * @param {*} candidateValue - Valor a ser avaliado.
   * @returns {boolean} Verdadeiro se for null ou undefined.
   */
  const isNullOrUndefined = (candidateValue) =>
    candidateValue === null || candidateValue === undefined;

  /**
   * Verifica se o valor é uma string vazia ou composta exclusivamente por espaços em branco.
   * @param {*} candidateValue - Valor a ser avaliado.
   * @returns {boolean} Verdadeiro se for string vazia.
   */
  const isEmptyString = (candidateValue) =>
    typeof candidateValue === 'string' && candidateValue.trim() === '';

  /**
   * Verifica se o valor é estritamente o booleano false.
   * @param {*} candidateValue - Valor a ser avaliado.
   * @returns {boolean} Verdadeiro se for estritamente false.
   */
  const isFalse = (candidateValue) => candidateValue === false;

  /**
   * Verifica se o valor é um array vazio ou se contém exclusivamente itens vazios/nulos (ex: [], ["", ""]).
   * @param {*} candidateValue - Valor a ser avaliado.
   * @returns {boolean} Verdadeiro se o array não contiver conteúdo significativo.
   */
  const isEmptyArray = (candidateValue) => {
    if (!Array.isArray(candidateValue)) {
      return false;
    }
    if (candidateValue.length === 0) {
      return true;
    }
    return candidateValue.every((item) => {
      if (isNullOrUndefined(item)) {
        return true;
      }
      if (isEmptyString(item)) {
        return true;
      }
      return false;
    });
  };

  /**
   * Verifica se o valor é um objeto literal vazio (sem chaves próprias).
   * @param {*} candidateValue - Valor a ser avaliado.
   * @returns {boolean} Verdadeiro se for objeto sem propriedades.
   */
  const isEmptyObject = (candidateValue) => {
    if (
      candidateValue === null ||
      typeof candidateValue !== 'object' ||
      Array.isArray(candidateValue)
    ) {
      return false;
    }
    return Object.keys(candidateValue).length === 0;
  };

  /**
   * Determina se um valor primitivo ou estrutural deve ser filtrado conforme as opções ativas.
   * @param {*} candidateValue - Valor a ser verificado.
   * @param {Object<string, boolean>} activeFilters - Mapa de filtros ativos.
   * @returns {boolean} Verdadeiro se o valor deve ser removido.
   */
  const shouldFilterValue = (candidateValue, activeFilters = {}) => {
    if (!activeFilters) {
      return false;
    }
    if (activeFilters.null && isNullOrUndefined(candidateValue)) {
      return true;
    }
    if (activeFilters.emptyString && isEmptyString(candidateValue)) {
      return true;
    }
    if (activeFilters.false && isFalse(candidateValue)) {
      return true;
    }
    if (activeFilters.emptyArray && isEmptyArray(candidateValue)) {
      return true;
    }
    if (activeFilters.emptyObject && isEmptyObject(candidateValue)) {
      return true;
    }
    return false;
  };

  /**
   * Percorre recursivamente um objeto ou array e remove campos que correspondam aos filtros ativos.
   * Retorna uma nova estrutura sem mutar os dados originais.
   * @param {*} dataToPrune - Objeto, array ou valor primitivo a ser podado.
   * @param {Object<string, boolean>} activeFilters - Mapa com flags de filtros ativos.
   * @returns {*} Nova estrutura limpa com os campos filtrados removidos.
   */
  const pruneLogData = (dataToPrune, activeFilters = {}) => {
    if (!activeFilters || !Object.values(activeFilters).some(Boolean)) {
      return dataToPrune;
    }

    if (shouldFilterValue(dataToPrune, activeFilters)) {
      return undefined;
    }

    if (Array.isArray(dataToPrune)) {
      const prunedArray = dataToPrune
        .map((arrayItem) => pruneLogData(arrayItem, activeFilters))
        .filter((arrayItem) => arrayItem !== undefined);

      if (activeFilters.emptyArray && (prunedArray.length === 0 || isEmptyArray(prunedArray))) {
        return undefined;
      }
      return prunedArray;
    }

    if (dataToPrune !== null && typeof dataToPrune === 'object') {
      const prunedObject = {};
      for (const [propertyKey, propertyValue] of Object.entries(dataToPrune)) {
        const prunedPropertyValue = pruneLogData(propertyValue, activeFilters);
        if (prunedPropertyValue !== undefined) {
          prunedObject[propertyKey] = prunedPropertyValue;
        }
      }

      if (activeFilters.emptyObject && Object.keys(prunedObject).length === 0) {
        return undefined;
      }
      return prunedObject;
    }

    return dataToPrune;
  };

  /**
   * Carrega as preferências de filtro salvas no localStorage ou retorna as padrões.
   * @returns {Object<string, boolean>} Objeto com o estado de cada filtro.
   */
  const loadFilterPreferences = () => {
    try {
      if (typeof localStorage === 'undefined') {
        return { ...DEFAULT_FILTER_OPTIONS };
      }
      const rawStoredValue = localStorage.getItem(FILTER_STORAGE_KEY);
      if (!rawStoredValue) {
        return { ...DEFAULT_FILTER_OPTIONS };
      }
      const parsedFilters = JSON.parse(rawStoredValue);
      return { ...DEFAULT_FILTER_OPTIONS, ...parsedFilters };
    } catch {
      return { ...DEFAULT_FILTER_OPTIONS };
    }
  };

  /**
   * Salva as preferências de filtro no localStorage.
   * @param {Object<string, boolean>} filterPreferences - Mapa de filtros a persistir.
   */
  const saveFilterPreferences = (filterPreferences) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filterPreferences));
      }
    } catch {}
  };

  const utilities = {
    tryParseJson,
    unescapeJavaScriptString,
    parseNestedJson,
    formatTimestamp,
    isDateOrTimeOnly,
    isNumericArray,
    isNullOrUndefined,
    isEmptyString,
    isFalse,
    isEmptyArray,
    isEmptyObject,
    shouldFilterValue,
    pruneLogData,
    FILTER_DEFINITIONS,
    DEFAULT_FILTER_OPTIONS,
    FILTER_STORAGE_KEY,
    loadFilterPreferences,
    saveFilterPreferences,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.utilities = utilities;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = utilities;
  }
})();
