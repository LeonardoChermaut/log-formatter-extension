(() => {
  const { buildFormattedView } =
    globalThis.LogFormatter?.buildSegments ||
    (typeof require !== 'undefined' ? require('./buildSegments.js') : {});
  const { formatLogEntries } =
    globalThis.LogFormatter?.formatting ||
    (typeof require !== 'undefined' ? require('../formatting/index.js') : {});
  const { saveFilterPreferences } =
    globalThis.LogFormatter?.filterStorage ||
    (typeof require !== 'undefined' ? require('../filters/storage.js') : {});
  const { getFilterButtonLabel } =
    globalThis.LogFormatter?.filterSync ||
    (typeof require !== 'undefined' ? require('./filterSync.js') : {});
  const { FILTER_DEFINITIONS } =
    globalThis.LogFormatter?.filterDefinitions ||
    (typeof require !== 'undefined' ? require('../filters/definitions.js') : {});
  const { LABEL_SHOW_ORIGINAL, LABEL_SHOW_FORMATTED } =
    globalThis.LogFormatter?.coreConstants ||
    (typeof require !== 'undefined' ? require('../core/constants.js') : {});

  /**
   * Estado de visualização por célula (WeakMap).
   */
  const cellViews = new WeakMap();

  /**
   * Conjunto de células rastreadas (formatadas).
   */
  const trackedCells = new Set();

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

    cellElement.replaceChildren(cellViewState.toolbarElement, ...nodesToDisplay);
    cellViewState.toggleButton.textContent = shouldShowFormatted
      ? LABEL_SHOW_ORIGINAL
      : LABEL_SHOW_FORMATTED;

    cellViewState.filterWrapper.style.display = shouldShowFormatted ? '' : 'none';
    if (!shouldShowFormatted) {
      cellViewState.filterMenu.classList.remove('log-formatter__filter-menu--open');
    }
    cellViewState.isShowingFormatted = shouldShowFormatted;
  };

  /**
   * Atualiza a renderização de todas as células formatadas registradas na tela
   * aplicando as novas configurações de filtro persistidas.
   * @param {Object<string, boolean>} activeFilters - Filtros ativos.
   */
  const updateAllCells = (activeFilters) => {
    if (typeof saveFilterPreferences === 'function') {
      saveFilterPreferences(activeFilters);
    }

    trackedCells.forEach((cellElement) => {
      if (!document.body || !document.body.contains(cellElement)) {
        trackedCells.delete(cellElement);
        return;
      }

      const cellViewState = cellViews.get(cellElement);
      if (!cellViewState) {
        return;
      }

      if (cellViewState.filterButton) {
        cellViewState.filterButton.textContent = getFilterButtonLabel(activeFilters);
        const activeCount = FILTER_DEFINITIONS.filter((def) => activeFilters[def.id]).length;
        if (activeCount > 0) {
          cellViewState.filterButton.classList.add('log-formatter__btn--active');
        } else {
          cellViewState.filterButton.classList.remove('log-formatter__btn--active');
        }
      }

      const { syncFilterMenuCheckboxes } =
        globalThis.LogFormatter?.filterSync ||
        (typeof require !== 'undefined' ? require('./filterSync.js') : {});
      syncFilterMenuCheckboxes(cellViewState.filterMenu, activeFilters);

      if (cellViewState.isShowingFormatted) {
        const formattedLineSegments = formatLogEntries(
          cellViewState.parsedLogEntries,
          activeFilters
        );
        cellViewState.formattedNodes = [buildFormattedView(formattedLineSegments)];
        showView(cellElement, cellViewState, true);
      }
    });
  };

  const cellState = {
    cellViews,
    trackedCells,
    showView,
    updateAllCells,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.cellState = cellState;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = cellState;
  }
})();
