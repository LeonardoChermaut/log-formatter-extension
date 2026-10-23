(() => {
  const { isNumericArray } =
    globalThis.LogFormatter?.typeGuards ||
    (typeof require !== 'undefined' ? require('../utils/typeGuards.js') : {});
  const { createTextSegment, createBoldSegment } =
    globalThis.LogFormatter?.renderSegments ||
    (typeof require !== 'undefined' ? require('./renderSegments.js') : {});

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

    const isAllPrimitiveArray = arrayValue.every(
      (item) => typeof item !== 'object' || item === null
    );

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

  const renderValue = {
    renderArrayValue,
    renderObjectValue,
    renderComplexValue,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.renderValue = renderValue;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = renderValue;
  }
})();
