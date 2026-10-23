(() => {
  const { KIBANA_LOG_CELL_SELECTOR, TARGET_PAGE_PATTERN, PROCESSED_ATTRIBUTE, ACTIVE_CELL_CLASS } =
    globalThis.LogFormatter?.coreConstants ||
    (typeof require !== 'undefined' ? require('../core/constants.js') : {});

  const { parseRawLogText } =
    globalThis.LogFormatter?.parsing ||
    (typeof require !== 'undefined' ? require('../parsing/index.js') : {});
  const { isDateOrTimeOnly } =
    globalThis.LogFormatter?.dateUtils ||
    (typeof require !== 'undefined' ? require('../utils/date.js') : {});
  const { loadFilterPreferences } =
    globalThis.LogFormatter?.filterStorage ||
    (typeof require !== 'undefined' ? require('../filters/storage.js') : {});
  const { buildToolbar } =
    globalThis.LogFormatter?.toolbar ||
    (typeof require !== 'undefined' ? require('./toolbar.js') : {});
  const { cellViews, trackedCells, showView, updateAllCells } =
    globalThis.LogFormatter?.cellState ||
    (typeof require !== 'undefined' ? require('./cellState.js') : {});
  const { formatLogEntries } =
    globalThis.LogFormatter?.formatting ||
    (typeof require !== 'undefined' ? require('../formatting/index.js') : {});
  const { buildFormattedView } =
    globalThis.LogFormatter?.buildSegments ||
    (typeof require !== 'undefined' ? require('./buildSegments.js') : {});

  const { setDependencies } =
    globalThis.LogFormatter?.toolbar ||
    (typeof require !== 'undefined' ? require('./toolbar.js') : {});
  setDependencies({ get: (cell) => cellViews.get(cell) }, showView);

  const activeFilters = typeof loadFilterPreferences === 'function' ? loadFilterPreferences() : {};

  /**
   * Verifica se a URL atual pertence à seção do Discover do Kibana.
   * @returns {boolean} Verdadeiro se estiver na página alvo.
   */
  const isTargetPage = () => TARGET_PAGE_PATTERN.test(window.location.href);

  /**
   * Identifica se uma célula pertence à coluna de data/hora ou se contém exclusivamente
   * uma representação temporal, garantindo que essa coluna permaneça inalterada.
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
    const formattedLineSegments = formatLogEntries(parsedLogEntries, activeFilters);
    const formattedViewNode = buildFormattedView(formattedLineSegments);

    const toolbarComponents = buildToolbar(cellElement, activeFilters, () =>
      updateAllCells(activeFilters)
    );

    const cellViewState = {
      originalNodes: originalChildNodes,
      formattedNodes: [formattedViewNode],
      parsedLogEntries,
      ...toolbarComponents,
      isShowingFormatted: true,
    };

    cellViews.set(cellElement, cellViewState);
    trackedCells.add(cellElement);
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
      .querySelectorAll(KIBANA_LOG_CELL_SELECTOR)
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

  if (typeof document !== 'undefined') {
    document.addEventListener('click', (clickEvent) => {
      if (!clickEvent.target || !clickEvent.target.closest('.log-formatter__filter-wrapper')) {
        document
          .querySelectorAll('.log-formatter__filter-menu--open')
          .forEach((openMenuElement) => {
            openMenuElement.classList.remove('log-formatter__filter-menu--open');
          });
      }
    });

    if (document.body) {
      const mutationObserver = new MutationObserver(handleDomMutations);
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });

      formatAllLogCells();
    }
  }
})();
