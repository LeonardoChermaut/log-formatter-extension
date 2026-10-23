(() => {
  const {
    tryParseInspectValue,
    parseInspectObject,
    parseScalarLiteral,
    parseContextLiteral,
    parseMessageLiteral,
  } =
    globalThis.LogFormatter?.parseInspect ||
    (typeof require !== 'undefined' ? require('./parseInspect.js') : {});

  const NESTJS_KNOWN_FIELDS = [
    'timestamp',
    'message',
    'environment',
    'source',
    'logger',
    'level',
    'application',
    'context',
    'traceId',
    'trace',
  ];

  /**
   * Localiza e divide as posições dos campos do formato inspecionado do NestJS.
   * Identifica cada campo independentemente da ordem em que aparecem no payload
   * e divide os segmentos ordenados pela posição de início no texto.
   * @param {string} entryRawText - Texto completo do registro NestJS.
   * @returns {Object<string, string>} Mapa de campos brutos separados.
   */
  const splitNestjsFields = (entryRawText) => {
    const detectedFieldPositions = [];

    NESTJS_KNOWN_FIELDS.forEach((fieldName) => {
      const fieldSearchPattern = new RegExp(`(?:^|[\\s{,])${fieldName}: `, 'g');
      const matchResult = fieldSearchPattern.exec(entryRawText);
      if (matchResult) {
        const valueStartIndex = matchResult.index + matchResult[0].length;
        detectedFieldPositions.push({
          fieldName,
          keyStartIndex: matchResult.index,
          valueStartIndex,
        });
      }
    });

    detectedFieldPositions.sort(
      (firstField, secondField) => firstField.valueStartIndex - secondField.valueStartIndex
    );

    const extractedFieldMap = {};
    detectedFieldPositions.forEach(({ fieldName, valueStartIndex }, indexPosition) => {
      const nextFieldInfo = detectedFieldPositions[indexPosition + 1];
      const valueEndIndex = nextFieldInfo ? nextFieldInfo.keyStartIndex : entryRawText.length;
      extractedFieldMap[fieldName] = entryRawText.slice(valueStartIndex, valueEndIndex);
    });

    return extractedFieldMap;
  };

  /**
   * Constrói uma entidade de log tipada a partir do texto do NestJS.
   * @param {string} entryRawText - Texto de uma entrada do NestJS.
   * @returns {Object} Objeto estruturado com todos os atributos do log.
   */
  const buildNestjsEntry = (entryRawText) => {
    const fieldMap = splitNestjsFields(entryRawText);
    const parsedMessage = parseMessageLiteral(fieldMap.message ?? '');

    return {
      format: 'nestjs',
      timestamp: parseScalarLiteral(fieldMap.timestamp ?? ''),
      message: parsedMessage.text,
      omittedCount: parsedMessage.omittedCount,
      environment: parseScalarLiteral(fieldMap.environment ?? ''),
      source: parseScalarLiteral(fieldMap.source ?? ''),
      logger: parseScalarLiteral(fieldMap.logger ?? ''),
      level: parseScalarLiteral(fieldMap.level ?? ''),
      application: parseScalarLiteral(fieldMap.application ?? ''),
      context: parseContextLiteral(fieldMap.context ?? ''),
      traceId: parseScalarLiteral(fieldMap.traceId ?? ''),
      trace: parseInspectObject(fieldMap.trace ?? ''),
    };
  };

  /**
   * Converte o texto bruto com uma ou mais entradas do NestJS em entidades estruturadas.
   * @param {string} rawLogText - Texto bruto contendo registros.
   * @returns {Array<Object>} Lista de entradas do NestJS estruturadas.
   */
  const parseNestjsText = (rawLogText) => {
    const entryStartPositions = [...rawLogText.matchAll(/\{\s*timestamp:\s*'/g)].map(
      (match) => match.index
    );
    return entryStartPositions.map((startPosition, index) => {
      const nextStartPosition = entryStartPositions[index + 1];
      const singleEntryText = rawLogText.slice(startPosition, nextStartPosition);
      return buildNestjsEntry(singleEntryText);
    });
  };

  const parseNestjs = {
    splitNestjsFields,
    buildNestjsEntry,
    parseNestjsText,
    parseMessageLiteral,
    parseContextLiteral,
    parseInspectObject,
    tryParseInspectValue,
    parseScalarLiteral,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.parseNestjs = parseNestjs;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = parseNestjs;
  }
})();
