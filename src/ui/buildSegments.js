(() => {
  /**
   * Converte um segmento de texto em elemento <span>, aplicando negrito exclusivamente
   * quando textSegment.bold for true e classe de valor normal quando for false.
   * @param {{ bold: boolean, text: string }} textSegment - Segmento de texto.
   * @returns {HTMLSpanElement} Elemento span criado com a classe adequada.
   */
  const buildSegmentSpan = (textSegment) => {
    const spanElement = document.createElement('span');
    spanElement.textContent = textSegment.text;
    if (textSegment.bold) {
      spanElement.className = 'log-formatter__bold';
    } else {
      spanElement.className = 'log-formatter__value';
    }
    return spanElement;
  };

  /**
   * Constrói o elemento <div> correspondente a uma linha formatada.
   * @param {Array<{ bold: boolean, text: string, type?: string }>} lineSegments - Segmentos que compõem a linha.
   * @param {number} lineIndex - Índice sequencial da linha dentro do registro.
   * @returns {HTMLDivElement} Elemento div configurado com estilos adequados.
   */
  const buildLineElement = (lineSegments, lineIndex) => {
    const lineElement = document.createElement('div');

    if (!lineSegments || lineSegments.length === 0) {
      lineElement.textContent = '\u00a0';
      lineElement.className = 'log-formatter__line';
      return lineElement;
    }

    const firstSegment = lineSegments[0];
    const lineType = firstSegment?.type;

    if (lineType === 'group-title' || (!lineType && firstSegment?.text?.startsWith('==='))) {
      lineElement.className = 'log-formatter__group-title';
    } else if (
      lineType === 'separator' ||
      (!lineType && (firstSegment?.text?.startsWith('---') || firstSegment?.text?.includes('---')))
    ) {
      lineElement.className = 'log-formatter__separator';
      return lineElement;
    } else if (
      lineType === 'header' ||
      (lineIndex === 0 && /^(\(\d+\/\d+\) )?\[/.test(firstSegment?.text ?? ''))
    ) {
      lineElement.className = 'log-formatter__header';
    } else {
      lineElement.className = 'log-formatter__line';
    }

    lineSegments.forEach((textSegment) => lineElement.appendChild(buildSegmentSpan(textSegment)));

    return lineElement;
  };

  /**
   * Constrói o contêiner raiz da visualização formatada com todas as suas linhas.
   * @param {Array<Array<{ bold: boolean, text: string }>>} allLineSegments - Todas as linhas.
   * @returns {HTMLDivElement} Elemento contêiner pronto para inserção no DOM.
   */
  const buildFormattedView = (allLineSegments) => {
    const viewContainerElement = document.createElement('div');
    viewContainerElement.className = 'log-formatter';

    allLineSegments.forEach((lineSegments, lineIndex) =>
      viewContainerElement.appendChild(buildLineElement(lineSegments, lineIndex))
    );

    return viewContainerElement;
  };

  const buildSegments = {
    buildSegmentSpan,
    buildLineElement,
    buildFormattedView,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.buildSegments = buildSegments;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = buildSegments;
  }
})();
