(() => {
  /**
   * Cria um segmento de texto com estilo de fonte normal.
   * @param {string} segmentText - O conteúdo do texto.
   * @returns {{ bold: boolean, text: string }} Segmento para criação de elemento DOM.
   */
  const createTextSegment = (segmentText) => ({
    bold: false,
    text: String(segmentText ?? ''),
  });

  /**
   * Cria um segmento de texto com estilo de fonte em negrito (identificadores e chaves).
   * @param {string} segmentText - O conteúdo do texto.
   * @returns {{ bold: boolean, text: string }} Segmento para criação de elemento DOM.
   */
  const createBoldSegment = (segmentText) => ({
    bold: true,
    text: String(segmentText ?? ''),
  });

  /**
   * Cria uma linha em branco para espaçamento vertical no layout.
   * @returns {Array<{ bold: boolean, text: string }>} Linha com segmento vazio.
   */
  const createEmptyLine = () => [createTextSegment('')];

  /**
   * Cria uma linha separadora visual entre registros consecutivos.
   * @returns {Array<{ type: string, bold: boolean, text: string }>} Linha separadora estruturada.
   */
  const createSeparatorLine = () => [{ type: 'separator', bold: false, text: '' }];

  const renderSegments = {
    createTextSegment,
    createBoldSegment,
    createEmptyLine,
    createSeparatorLine,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.renderSegments = renderSegments;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = renderSegments;
  }
})();
