(() => {
  const LOG_CELL_SELECTOR =
    '[data-test-subj="docTableRow"] > [data-test-subj="docTableField"] > .truncate-by-height';

  const TARGET_PAGE_PATTERN = /\/app\/(discover|kibana)/;

  const PROCESSED_ATTRIBUTE = 'data-log-formatter';
  const ACTIVE_CELL_CLASS = 'log-formatter-cell';

  const LABEL_SHOW_ORIGINAL = 'Ver original';
  const LABEL_SHOW_FORMATTED = 'Ver formatado';

  const viewStateByCell = new WeakMap();

  const logFormatterApi =
    globalThis.logFormatterApi ||
    (typeof require !== 'undefined' ? require('../formatters/formatLogEntry.js') : {});
  const utilities =
    globalThis.LogFormatter?.utilities ||
    (typeof require !== 'undefined' ? require('../utils/utilities.js') : {});

  const { parseRawLogText, formatLogEntries } = logFormatterApi;
  const { isDateOrTimeOnly } = utilities;

  /**
   * Verifica se a URL atual pertence à seção do Discover do Kibana.
   * @returns {boolean} Verdadeiro se estiver na página alvo.
   */
  const isTargetPage = () => TARGET_PAGE_PATTERN.test(window.location.href);

  /**
   * Identifica se uma célula pertence à coluna de data/hora ou se contém exclusivamente
   * uma representação temporal (ex: "Oct 21, 2026 @ 20:32:44.21"), garantindo que essa
   * coluna permaneça inalterada e nunca receba botões ou modificações de layout.
   * @param {HTMLElement} cellElement - Elemento HTML da célula.
   * @param {string} cellText - Conteúdo textual da célula.
   * @returns {boolean} Verdadeiro se for uma célula de data/hora.
   */
  const isTimeCell = (cellElement, cellText) => {
    const tableDataCell = cellElement.closest('td');
    if (tableDataCell) {
      const fieldAttribute =
        tableDataCell.getAttribute('data-cell-field') ||
        tableDataCell.getAttribute('data-test-subj') ||
        '';
      if (/(time|@timestamp)/i.test(fieldAttribute)) {
        return true;
      }
    }

    return isDateOrTimeOnly(cellText);
  };

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
   * @param {Array<{ bold: boolean, text: string }>} lineSegments - Segmentos que compõem a linha.
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

    const firstSegmentText = lineSegments[0]?.text ?? '';
    if (firstSegmentText.startsWith('===')) {
      lineElement.className = 'log-formatter__group-title';
    } else if (firstSegmentText.startsWith('---') || firstSegmentText.includes('---')) {
      lineElement.className = 'log-formatter__separator';
    } else if (lineIndex === 0 && /^(\(\d+\/\d+\) )?\[/.test(firstSegmentText)) {
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

  /**
   * Alterna os nós filhos da célula entre a versão original e a versão formatada.
   * @param {HTMLElement} cellElement - Elemento da célula.
   * @param {Object} cellViewState - Estado contendo os nós originais e formatados.
   * @param {boolean} shouldShowFormatted - Se deve exibir a versão formatada.
   */
  const showView = (cellElement, cellViewState, shouldShowFormatted) => {
    const nodesToDisplay = shouldShowFormatted
      ? cellViewState.formattedNodes
      : cellViewState.originalNodes;

    cellElement.replaceChildren(cellViewState.toggleButton, ...nodesToDisplay);
    cellViewState.toggleButton.textContent = shouldShowFormatted
      ? LABEL_SHOW_ORIGINAL
      : LABEL_SHOW_FORMATTED;
    cellViewState.isShowingFormatted = shouldShowFormatted;
  };

  /**
   * Cria o botão que permite ao desenvolvedor alternar entre a exibição formatada e o texto bruto.
   * @param {HTMLElement} cellElement - Célula onde o botão será inserido.
   * @returns {HTMLButtonElement} Botão configurado com listener de clique.
   */
  const buildToggleButton = (cellElement) => {
    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'log-formatter__toggle';
    toggleButton.addEventListener('click', (mouseClickEvent) => {
      mouseClickEvent.stopPropagation();
      const cellViewState = viewStateByCell.get(cellElement);
      if (cellViewState) {
        showView(cellElement, cellViewState, !cellViewState.isShowingFormatted);
      }
    });

    return toggleButton;
  };

  /**
   * Avalia e formata uma célula de log da tabela do Discover caso contenha log estruturado.
   * @param {HTMLElement} cellElement - Célula da tabela a ser processada.
   */
  const formatCell = (cellElement) => {
    const currentProcessingStatus = cellElement.getAttribute(PROCESSED_ATTRIBUTE);
    if (currentProcessingStatus === 'formatted' || currentProcessingStatus === 'skipped') {
      return;
    }

    const cellTextContent = cellElement.textContent.trim();

    if (cellTextContent === '') {
      cellElement.setAttribute(PROCESSED_ATTRIBUTE, 'pending');
      return;
    }

    if (isTimeCell(cellElement, cellTextContent)) {
      cellElement.setAttribute(PROCESSED_ATTRIBUTE, 'skipped');
      return;
    }

    const parsedLogEntries = parseRawLogText(cellTextContent);
    if (parsedLogEntries.length === 0) {
      cellElement.setAttribute(PROCESSED_ATTRIBUTE, 'skipped');
      return;
    }

    const originalChildNodes = [...cellElement.childNodes];
    const formattedLineSegments = formatLogEntries(parsedLogEntries);
    const formattedViewNode = buildFormattedView(formattedLineSegments);

    const cellViewState = {
      originalNodes: originalChildNodes,
      formattedNodes: [formattedViewNode],
      toggleButton: buildToggleButton(cellElement),
      isShowingFormatted: true,
    };

    viewStateByCell.set(cellElement, cellViewState);
    cellElement.classList.add(ACTIVE_CELL_CLASS);
    cellElement.setAttribute(PROCESSED_ATTRIBUTE, 'formatted');
    showView(cellElement, cellViewState, true);
  };

  /**
   * Localiza e processa todas as células de log visíveis na página ativa.
   */
  const formatAllLogCells = () => {
    if (!isTargetPage()) {
      return;
    }

    document
      .querySelectorAll(LOG_CELL_SELECTOR)
      .forEach((singleCellElement) => formatCell(singleCellElement));
  };

  let isProcessingScheduled = false;

  /**
   * Trata mutações no DOM agendando a formatação de novas células adicionadas na página.
   */
  const handleDomMutations = () => {
    if (isProcessingScheduled) {
      return;
    }

    isProcessingScheduled = true;
    window.requestAnimationFrame(() => {
      isProcessingScheduled = false;
      formatAllLogCells();
    });
  };

  if (typeof document !== 'undefined' && document.body) {
    new MutationObserver(handleDomMutations).observe(document.body, {
      childList: true,
      subtree: true,
    });

    formatAllLogCells();
  }
})();
