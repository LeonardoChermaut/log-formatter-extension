const utilities =
  globalThis.LogFormatter?.utilities ||
  (typeof require !== 'undefined' ? require('../utils/utilities.js') : {});

const {
  tryParseJson,
  unescapeJavaScriptString,
  parseNestedJson,
  formatTimestamp,
  isDateOrTimeOnly,
  isNumericArray,
} = utilities;

/**
 * Tradução padronizada dos níveis de severidade dos logs.
 */
const LOG_LEVEL = {
  error: 'ERRO',
  warn: 'AVISO',
  info: 'INFORMAÇÃO',
  debug: 'DEPURAÇÃO',
};

/**
 * Cria um segmento de texto com estilo de fonte normal.
 * @param {string} segmentText - O conteúdo do texto.
 * @returns {{ bold: boolean, text: string }} Segmento para criação de elemento DOM.
 */
const createTextSegment = (segmentText) => {
  return {
    bold: false,
    text: String(segmentText ?? ''),
  };
};

/**
 * Cria um segmento de texto com estilo de fonte em negrito (identificadores e chaves).
 * @param {string} segmentText - O conteúdo do texto.
 * @returns {{ bold: boolean, text: string }} Segmento para criação de elemento DOM.
 */
const createBoldSegment = (segmentText) => {
  return {
    bold: true,
    text: String(segmentText ?? ''),
  };
};

/**
 * Cria uma linha em branco para espaçamento vertical no layout.
 * @returns {Array<{ bold: boolean, text: string }>} Linha com segmento vazio.
 */
const createEmptyLine = () => {
  return [createTextSegment('')];
};

/**
 * Cria uma linha separadora visual entre registros consecutivos.
 * @returns {Array<{ type: string, bold: boolean, text: string }>} Linha separadora estruturada.
 */
const createSeparatorLine = () => {
  return [{ type: 'separator', bold: false, text: '' }];
};

/**
 * Renderiza um array preservando formato condensado para primitivos e hierárquico para objetos.
 * Oculta arrays puramente numéricos (como buffers binários de bytes) para evitar poluição visual.
 * @param {Array} arrayValue - Array a ser renderizado.
 * @param {string} indentationSpaces - Espaços de recuo para hierarquia visual.
 * @returns {Array<Array<{ bold: boolean, text: string }>>} Lista de linhas compostas por segmentos.
 */
const renderArrayValue = (arrayValue, indentationSpaces = '') => {
  if (arrayValue.length === 0) {
    return [[createTextSegment(`${indentationSpaces}[]`)]];
  }

  if (isNumericArray(arrayValue)) {
    return [
      [
        createTextSegment(
          `${indentationSpaces}[dados numéricos ocultados (${arrayValue.length} itens)]`
        ),
      ],
    ];
  }

  const isAllPrimitiveArray = arrayValue.every((item) => typeof item !== 'object' || item === null);

  if (isAllPrimitiveArray) {
    const formattedPrimitives = arrayValue
      .map((primitiveItem) =>
        typeof primitiveItem === 'string' ? `"${primitiveItem}"` : String(primitiveItem)
      )
      .join(', ');
    return [[createTextSegment(`${indentationSpaces}[${formattedPrimitives}]`)]];
  }

  const renderedLines = [];
  arrayValue.forEach((item, index) => {
    if (typeof item === 'object' && item !== null) {
      renderedLines.push([createBoldSegment(`${indentationSpaces}[Item ${index + 1}]:`)]);
      renderedLines.push(...renderComplexValue(item, `${indentationSpaces}  `));
    } else {
      renderedLines.push([
        createBoldSegment(`${indentationSpaces}[Item ${index + 1}]: `),
        createTextSegment(String(item)),
      ]);
    }
  });

  return renderedLines;
};

/**
 * Renderiza entradas de um objeto, tratando buffers e arrays aninhados.
 * @param {Object} objectValue - Objeto a ser renderizado.
 * @param {string} indentationSpaces - Espaços de recuo para hierarquia visual.
 * @returns {Array<Array<{ bold: boolean, text: string }>>} Lista de linhas compostas por segmentos.
 */
const renderObjectValue = (objectValue, indentationSpaces = '') => {
  const objectEntries = Object.entries(objectValue);
  if (objectEntries.length === 0) {
    return [[createTextSegment(`${indentationSpaces}{}`)]];
  }

  const renderedLines = [];
  objectEntries.forEach(([originalKey, propertyValue]) => {
    if (
      propertyValue !== null &&
      typeof propertyValue === 'object' &&
      propertyValue.type === 'Buffer' &&
      Array.isArray(propertyValue.data)
    ) {
      renderedLines.push([
        createBoldSegment(`${indentationSpaces}${originalKey}: `),
        createTextSegment(`[Buffer binário ocultado (${propertyValue.data.length} bytes)]`),
      ]);
      return;
    }

    if (isNumericArray(propertyValue)) {
      renderedLines.push([
        createBoldSegment(`${indentationSpaces}${originalKey}: `),
        createTextSegment(`[dados numéricos ocultados (${propertyValue.length} itens)]`),
      ]);
      return;
    }

    if (propertyValue !== null && typeof propertyValue === 'object') {
      renderedLines.push([createBoldSegment(`${indentationSpaces}${originalKey}:`)]);
      renderedLines.push(...renderComplexValue(propertyValue, `${indentationSpaces}  `));
    } else {
      const stringifiedValue = String(propertyValue ?? '');
      if (stringifiedValue.includes('\n')) {
        renderedLines.push([createBoldSegment(`${indentationSpaces}${originalKey}:`)]);
        stringifiedValue.split('\n').forEach((textLine) => {
          renderedLines.push([createTextSegment(`${indentationSpaces}  ${textLine}`)]);
        });
      } else {
        renderedLines.push([
          createBoldSegment(`${indentationSpaces}${originalKey}: `),
          createTextSegment(stringifiedValue),
        ]);
      }
    }
  });

  return renderedLines;
};

/**
 * Renderiza recursivamente estruturas complexas (objetos, arrays e strings com quebras de linha),
 * preservando as chaves originais exatas em negrito e os valores em formato legível, sem truncar.
 * @param {*} valueToRender - Valor a ser renderizado hierarquicamente.
 * @param {string} indentationSpaces - Espaços de recuo para hierarquia visual.
 * @returns {Array<Array<{ bold: boolean, text: string }>>} Lista de linhas compostas por segmentos.
 */
const renderComplexValue = (valueToRender, indentationSpaces = '') => {
  if (valueToRender === null || valueToRender === undefined) {
    return [[createTextSegment(`${indentationSpaces}null`)]];
  }

  if (typeof valueToRender === 'object') {
    if (Array.isArray(valueToRender)) {
      return renderArrayValue(valueToRender, indentationSpaces);
    }
    return renderObjectValue(valueToRender, indentationSpaces);
  }

  const stringValue = String(valueToRender);
  if (stringValue.includes('\n')) {
    const renderedLines = [];
    stringValue.split('\n').forEach((textLine) => {
      renderedLines.push([createTextSegment(`${indentationSpaces}${textLine}`)]);
    });
    return renderedLines;
  }

  return [[createTextSegment(`${indentationSpaces}${stringValue}`)]];
};

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
 * @param {string} messageFieldText - Texto bruto do campo message.
 * @returns {{ text: string, omittedCount: number }} Conteúdo da mensagem e caracteres omitidos.
 */
const parseMessageLiteral = (messageFieldText) => {
  const matchResult = messageFieldText.match(
    /^\s*'([\s\S]*)'(?:\.\.\. (\d+) more characters?)?\s*,?\s*$/
  );
  if (!matchResult) {
    return {
      text: parseScalarLiteral(messageFieldText) ?? '',
      omittedCount: 0,
    };
  }

  return {
    text: unescapeJavaScriptString(matchResult[1]),
    omittedCount: Number(matchResult[2] ?? 0),
  };
};

/**
 * Interpreta o objeto ou Map do campo context preservando os nomes das chaves originais.
 * @param {string} contextFieldText - Texto bruto do campo context.
 * @returns {Object<string, string>} Mapa de chaves originais e valores correspondentes.
 */
const parseContextLiteral = (contextFieldText) => {
  const valuePattern = "(?:'((?:[^'\\\\]|\\\\.)*)'|([^,\\n}]+))";
  const mapPattern = new RegExp(`'([^']+)' => ${valuePattern}`, 'g');
  const objectPattern = new RegExp(`^\\s*'?([\\w$-]+)'?: ${valuePattern}`, 'gm');

  const createEntry = (matchedGroup) => {
    const [, propertyKey, matchedValue, unquotedValue] = matchedGroup;
    const propertyValue =
      matchedValue !== undefined ? unescapeJavaScriptString(matchedValue) : unquotedValue.trim();
    return [propertyKey, propertyValue];
  };

  const mapEntries = [...contextFieldText.matchAll(mapPattern)].map(createEntry);
  if (mapEntries.length > 0) {
    return Object.fromEntries(mapEntries);
  }

  const objectEntries = [...contextFieldText.matchAll(objectPattern)].map(createEntry);
  return Object.fromEntries(objectEntries);
};

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
    trace: parseScalarLiteral(fieldMap.trace ?? ''),
  };
};

/**
 * Verifica se a string pertence ao formato de log gerado pelo NestJS com util.inspect.
 * @param {string} rawLogText - Texto bruto da célula.
 * @returns {boolean} Verdadeiro se for log NestJS.
 */
const isNestjsFormat = (rawLogText) => /\{\s*timestamp:\s*'/.test(rawLogText);

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

/**
 * Verifica se a string pertence ao formato de log do agente Skywalking.
 * @param {string} rawLogText - Texto bruto da célula.
 * @returns {boolean} Verdadeiro se for log Skywalking.
 */
const isSkywalkingFormat = (rawLogText) =>
  /\bfile:\s*['"]/.test(rawLogText) &&
  /\blevel:\s*'/.test(rawLogText) &&
  !isNestjsFormat(rawLogText);

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

/**
 * Verifica se o texto corresponde ao formato de log do Filebeat ou Kubernetes (chave: valor por linha).
 * @param {string} rawLogText - Texto bruto da célula.
 * @returns {boolean} Verdadeiro se for formato Filebeat / Kubernetes.
 */
const isFilebeatFormat = (rawLogText) => {
  return (
    /^[@\w][\w.-]*:\s+\S/m.test(rawLogText) &&
    !isNestjsFormat(rawLogText) &&
    !isSkywalkingFormat(rawLogText) &&
    !isDateOrTimeOnly(rawLogText)
  );
};

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
  if (isFilebeatFormat(rawLogText)) {
    return parseFilebeatText(rawLogText);
  }

  return [];
};

/**
 * Formata um registro do NestJS exibindo cabeçalho legível, payload (JSON ou texto),
 * dados de origem e contexto preservando as chaves originais sem sobreescrever.
 * @param {Object} logEntry - Objeto com os atributos do log do NestJS.
 * @returns {Array<Array<{ bold: boolean, text: string }>>} Linhas de segmentos formatadas.
 */
const formatNestjsEntry = (logEntry) => {
  const formattedLines = [];

  const levelDescription =
    LOG_LEVEL[logEntry.level] ?? String(logEntry.level ?? 'INFO').toUpperCase();
  const formattedDateTime = formatTimestamp(logEntry.timestamp);
  const applicationDetails = [
    logEntry.application,
    logEntry.environment ? `(${logEntry.environment})` : '',
  ]
    .filter(Boolean)
    .join(' ');

  formattedLines.push([
    {
      type: 'header',
      ...createBoldSegment(`[${levelDescription}]`),
    },
    createTextSegment(
      ` ${formattedDateTime}${applicationDetails ? ` | ${applicationDetails}` : ''}`
    ),
  ]);

  if (logEntry.message) {
    formattedLines.push(createEmptyLine());
    const parsedJsonMessage = tryParseJson(logEntry.message);

    if (parsedJsonMessage !== undefined) {
      const expandedMessageData = parseNestedJson(parsedJsonMessage);
      formattedLines.push([createBoldSegment('Mensagem:')]);
      formattedLines.push(...renderComplexValue(expandedMessageData, '  '));
    } else {
      formattedLines.push([createBoldSegment('Mensagem:')]);
      logEntry.message.split('\n').forEach((messageLine) => {
        formattedLines.push([createTextSegment(`  ${messageLine}`)]);
      });
    }
  }

  const sourceMetadataLines = [];
  if (logEntry.logger) {
    sourceMetadataLines.push([createBoldSegment('service: '), createTextSegment(logEntry.logger)]);
  }
  if (logEntry.source) {
    sourceMetadataLines.push([createBoldSegment('file: '), createTextSegment(logEntry.source)]);
  }
  if (logEntry.traceId) {
    sourceMetadataLines.push([
      createBoldSegment('traceId: '),
      createTextSegment(logEntry.traceId),
    ]);
  }
  if (logEntry.trace) {
    sourceMetadataLines.push([
      createBoldSegment('Marcador (trace): '),
      createTextSegment(logEntry.trace),
    ]);
  }
  if (logEntry.omittedCount > 0) {
    sourceMetadataLines.push([
      createBoldSegment('Mensagem truncada no Kibana: '),
      createTextSegment(`${logEntry.omittedCount.toLocaleString('pt-BR')} caracteres omitidos`),
    ]);
  }

  if (sourceMetadataLines.length > 0) {
    formattedLines.push(createEmptyLine(), [createBoldSegment('Origem do log')]);
    formattedLines.push(...sourceMetadataLines);
  }

  if (logEntry.context && typeof logEntry.context === 'object') {
    const contextEntries = Object.entries(logEntry.context).filter(([contextKey]) => {
      return contextKey !== 'traceId';
    });

    if (contextEntries.length > 0) {
      formattedLines.push(createEmptyLine(), [
        createBoldSegment('Contexto da requisição recebida'),
      ]);
      contextEntries.forEach(([originalKey, contextValue]) => {
        formattedLines.push([
          createBoldSegment(`${originalKey}: `),
          createTextSegment(String(contextValue ?? '')),
        ]);
      });
    }
  }

  return formattedLines;
};

/**
 * Formata um registro do Skywalking.
 * @param {Object} logEntry - Registro com campos do Skywalking.
 * @returns {Array<Array<{ bold: boolean, text: string }>>} Linhas formatadas.
 */
const formatSkywalkingEntry = (logEntry) => {
  const formattedLines = [
    [
      {
        type: 'header',
        ...createBoldSegment(`[${LOG_LEVEL[logEntry.level] ?? 'ERRO'}]`),
      },
      createTextSegment(' Agente Skywalking'),
    ],
    createEmptyLine(),
  ];

  if (logEntry.source) {
    formattedLines.push([createBoldSegment('Arquivo: '), createTextSegment(logEntry.source)]);
  }
  if (logEntry.errorCode) {
    formattedLines.push([
      createBoldSegment('Código de erro: '),
      createTextSegment(logEntry.errorCode),
    ]);
  }
  if (logEntry.message) {
    formattedLines.push([createBoldSegment('Mensagem: '), createTextSegment(logEntry.message)]);
  }
  if (logEntry.details) {
    formattedLines.push([createBoldSegment('Detalhes: '), createTextSegment(logEntry.details)]);
  }
  if (logEntry.stack) {
    formattedLines.push(createEmptyLine(), [createBoldSegment('Stack trace:')]);
    logEntry.stack.split('\n').forEach((stackLine) => {
      formattedLines.push([createTextSegment(`  ${stackLine.trim()}`)]);
    });
  }

  return formattedLines;
};

/**
 * Formata um registro do Filebeat / Kubernetes preservando as chaves originais.
 * Expande valores que contenham JSON aninhado via parseNestedJson e renderComplexValue.
 * @param {Object} logEntry - Registro com campos do Filebeat.
 * @returns {Array<Array<{ bold: boolean, text: string }>>} Linhas formatadas.
 */
const formatFilebeatEntry = (logEntry) => {
  const rawLogLevel = logEntry.fields['log.level'] ?? logEntry.fields.level ?? '';
  const serviceName = logEntry.fields['service.name'] ?? '';
  const headerText = [
    LOG_LEVEL[rawLogLevel.toLowerCase()] ?? rawLogLevel.toUpperCase(),
    serviceName,
  ]
    .filter(Boolean)
    .join(' | ');

  const formattedLines = [];
  if (headerText) {
    formattedLines.push([{ type: 'header', ...createBoldSegment(`[${headerText}]`) }]);
  }
  formattedLines.push(createEmptyLine());

  Object.entries(logEntry.fields).forEach(([originalKey, propertyValue]) => {
    const parsedJsonCandidate = tryParseJson(propertyValue);
    if (parsedJsonCandidate !== undefined) {
      const expandedValue = parseNestedJson(parsedJsonCandidate);
      formattedLines.push([createBoldSegment(`${originalKey}:`)]);
      formattedLines.push(...renderComplexValue(expandedValue, '  '));
    } else {
      const stringifiedValue = String(propertyValue ?? '');
      if (stringifiedValue.includes('\n')) {
        formattedLines.push([createBoldSegment(`${originalKey}:`)]);
        stringifiedValue.split('\n').forEach((textLine) => {
          formattedLines.push([createTextSegment(`  ${textLine}`)]);
        });
      } else {
        formattedLines.push([
          createBoldSegment(`${originalKey}: `),
          createTextSegment(stringifiedValue),
        ]);
      }
    }
  });

  return formattedLines;
};

/**
 * Direciona o registro de log para o formatador apropriado com base em seu formato identificado.
 * @param {Object} logEntry - Registro de log a ser formatado.
 * @returns {Array<Array<{ bold: boolean, text: string }>>} Linhas de segmentos formatadas.
 */
const formatLogEntry = (logEntry) => {
  if (logEntry.format === 'nestjs') {
    return formatNestjsEntry(logEntry);
  }
  if (logEntry.format === 'skywalking') {
    return formatSkywalkingEntry(logEntry);
  }
  return formatFilebeatEntry(logEntry);
};

/**
 * Agrupa as entradas de log por traceId e as ordena cronologicamente por timestamp.
 * @param {Array<Object>} logEntries - Lista de entradas de log.
 * @returns {Array<[string, Array<Object>]>} Lista de tuplas com traceId e grupo de logs ordenado.
 */
const groupEntriesByTraceId = (logEntries) => {
  const traceGroupsMap = new Map();

  logEntries.forEach((currentEntry) => {
    const traceIdentifier = currentEntry.traceId ?? 'sem-traceId';
    const existingGroup = traceGroupsMap.get(traceIdentifier) ?? [];
    existingGroup.push(currentEntry);
    traceGroupsMap.set(traceIdentifier, existingGroup);
  });

  return [...traceGroupsMap].map(([traceIdentifier, entriesList]) => {
    const sortedEntriesList = [...entriesList].sort((firstEntry, secondEntry) => {
      const firstTimestamp = new Date(firstEntry.timestamp).getTime();
      const secondTimestamp = new Date(secondEntry.timestamp).getTime();
      return firstTimestamp - secondTimestamp;
    });
    return [traceIdentifier, sortedEntriesList];
  });
};

/**
 * Formata um grupo de logs pertencentes ao mesmo traceId.
 * @param {[string, Array<Object>]} traceGroupTuple - Tupla com o traceId e lista de logs.
 * @returns {Array<Array<{ bold: boolean, text: string }>>} Linhas formatadas com o título do grupo.
 */
const formatTraceGroup = ([traceIdentifier, groupEntries]) => {
  const groupTitle =
    traceIdentifier === 'sem-traceId'
      ? `${groupEntries.length} registro(s)`
      : `traceId ${traceIdentifier}`;

  const renderedGroupLines = [[{ type: 'group-title', bold: true, text: groupTitle }]];

  groupEntries.forEach((logEntry, entryIndex) => {
    if (entryIndex > 0) {
      renderedGroupLines.push(createSeparatorLine());
    }
    const singleEntryLines = formatLogEntry(logEntry);
    const orderPrefix =
      groupEntries.length > 1 ? `(${entryIndex + 1}/${groupEntries.length}) ` : '';
    const firstLineSegments = singleEntryLines[0] ?? [createTextSegment('')];
    renderedGroupLines.push(
      [{ type: 'header', ...createTextSegment(orderPrefix) }, ...firstLineSegments],
      ...singleEntryLines.slice(1)
    );
  });

  return renderedGroupLines;
};

/**
 * Formata um array de entradas de log agrupando-as por traceId.
 * @param {Array<Object>} logEntries - As entradas de log a serem formatadas.
 * @returns {Array<Array<{ bold: boolean, text: string }>>} As entradas de log formatadas prontas para renderização.
 */
const formatLogEntries = (logEntries) => {
  const renderedOutput = [];

  groupEntriesByTraceId(logEntries).forEach((logGroup, groupIndex) => {
    if (groupIndex > 0) {
      renderedOutput.push(createEmptyLine(), createEmptyLine());
    }
    renderedOutput.push(...formatTraceGroup(logGroup));
  });

  return renderedOutput;
};

const logFormatterApi = {
  parseRawLogText,
  formatLogEntry,
  formatLogEntries,
};

globalThis.logFormatterApi = logFormatterApi;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = logFormatterApi;
}
