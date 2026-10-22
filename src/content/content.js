(() => {
  const LOG_CELL_SELECTOR =
    '[data-test-subj="docTableRow"] > [data-test-subj="docTableField"] > .truncate-by-height';

  const TARGET_PAGE_PATTERN = /\/app\/(discover|kibana)/;

  const PROCESSED_ATTRIBUTE = 'data-log-formatter';
  const ACTIVE_CELL_CLASS = 'log-formatter-cell';

  const LABEL_SHOW_ORIGINAL = 'Ver original';
  const LABEL_SHOW_FORMATTED = 'Ver formatado';

  const viewStateByCell = new WeakMap();
  const formattedCells = new Set();

  const logFormatterApi =
    globalThis.logFormatterApi ||
    (typeof require !== 'undefined' ? require('../formatters/formatLogEntry.js') : {});
  const utilities =
    globalThis.LogFormatter?.utilities ||
    (typeof require !== 'undefined' ? require('../utils/utilities.js') : {});

  const { parseRawLogText, formatLogEntries } = logFormatterApi;
  const {
    isDateOrTimeOnly,
    FILTER_DEFINITIONS = [],
    loadFilterPreferences,
    saveFilterPreferences,
  } = utilities;

  const activeFilters = typeof loadFilterPreferences === 'function' ? loadFilterPreferences() : {};

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
   * Gera o rótulo do botão de filtros com o contador de filtros ativos.
   * @param {Object<string, boolean>} filters - Filtros ativos.
   * @returns {string} Rótulo formatado.
   */
  const getFilterButtonLabel = (filters) => {
    const activeCount = FILTER_DEFINITIONS.filter((def) => filters[def.id]).length;
    return activeCount > 0 ? `Filtros (${activeCount}) ▾` : 'Filtros ▾';
  };

  /**
   * Sincroniza o estado visual das caixas de seleção de um menu de filtros aberto.
   * @param {HTMLElement} menuElement - Elemento do menu dropdown.
   */
  const syncFilterMenuCheckboxes = (menuElement) => {
    if (!menuElement) {
      return;
    }

    const masterCheckbox = menuElement.querySelector('.log-formatter__master-checkbox');
    const allItemCheckboxes = menuElement.querySelectorAll('.log-formatter__item-checkbox');

    const allChecked =
      FILTER_DEFINITIONS.length > 0 &&
      FILTER_DEFINITIONS.every((filterDef) => activeFilters[filterDef.id]);
    const anyChecked = FILTER_DEFINITIONS.some((filterDef) => activeFilters[filterDef.id]);

    if (masterCheckbox) {
      masterCheckbox.checked = allChecked;
      masterCheckbox.indeterminate = anyChecked && !allChecked;
    }

    allItemCheckboxes.forEach((checkboxElement) => {
      const filterId = checkboxElement.getAttribute('data-filter-id');
      if (filterId) {
        checkboxElement.checked = Boolean(activeFilters[filterId]);
      }
    });
  };

  /**
   * Atualiza a renderização de todas as células formatadas registradas na tela
   * aplicando as novas configurações de filtro persistidas.
   */
  const updateAllCells = () => {
    if (typeof saveFilterPreferences === 'function') {
      saveFilterPreferences(activeFilters);
    }

    formattedCells.forEach((cellElement) => {
      if (!document.body || !document.body.contains(cellElement)) {
        formattedCells.delete(cellElement);
        return;
      }

      const cellViewState = viewStateByCell.get(cellElement);
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

      syncFilterMenuCheckboxes(cellViewState.filterMenu);

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

  /**
   * Constrói o menu popover com as opções de filtragem de campos vazios.
   * @returns {{ filterWrapper: HTMLElement, filterButton: HTMLElement, filterMenu: HTMLElement }} Elementos criados.
   */
  const buildFilterDropdown = () => {
    const filterWrapper = document.createElement('div');
    filterWrapper.className = 'log-formatter__filter-wrapper';

    const filterButton = document.createElement('button');
    filterButton.type = 'button';
    filterButton.className = 'log-formatter__btn';
    filterButton.textContent = getFilterButtonLabel(activeFilters);

    const activeCount = FILTER_DEFINITIONS.filter((def) => activeFilters[def.id]).length;
    if (activeCount > 0) {
      filterButton.classList.add('log-formatter__btn--active');
    }

    const filterMenu = document.createElement('div');
    filterMenu.className = 'log-formatter__filter-menu';

    const headerElement = document.createElement('div');
    headerElement.className = 'log-formatter__filter-header';
    headerElement.textContent = 'Ocultar campos vazios';
    filterMenu.appendChild(headerElement);

    const masterOptionLabel = document.createElement('label');
    masterOptionLabel.className = 'log-formatter__filter-item';

    const masterCheckbox = document.createElement('input');
    masterCheckbox.type = 'checkbox';
    masterCheckbox.className = 'log-formatter__master-checkbox';
    const allChecked =
      FILTER_DEFINITIONS.length > 0 &&
      FILTER_DEFINITIONS.every((filterDef) => activeFilters[filterDef.id]);
    const anyChecked = FILTER_DEFINITIONS.some((filterDef) => activeFilters[filterDef.id]);
    masterCheckbox.checked = allChecked;
    masterCheckbox.indeterminate = anyChecked && !allChecked;

    masterCheckbox.addEventListener('change', (changeEvent) => {
      changeEvent.stopPropagation();
      const shouldCheckAll = masterCheckbox.checked;
      FILTER_DEFINITIONS.forEach((filterDef) => {
        activeFilters[filterDef.id] = shouldCheckAll;
      });
      updateAllCells();
    });

    const masterLabelText = document.createElement('span');
    masterLabelText.textContent = 'Selecionar todos';
    masterOptionLabel.appendChild(masterCheckbox);
    masterOptionLabel.appendChild(masterLabelText);
    filterMenu.appendChild(masterOptionLabel);

    const dividerElement = document.createElement('div');
    dividerElement.className = 'log-formatter__filter-divider';
    filterMenu.appendChild(dividerElement);

    FILTER_DEFINITIONS.forEach((filterDefinition) => {
      const optionLabel = document.createElement('label');
      optionLabel.className = 'log-formatter__filter-item';

      const optionCheckbox = document.createElement('input');
      optionCheckbox.type = 'checkbox';
      optionCheckbox.className = 'log-formatter__item-checkbox';
      optionCheckbox.setAttribute('data-filter-id', filterDefinition.id);
      optionCheckbox.checked = Boolean(activeFilters[filterDefinition.id]);

      optionCheckbox.addEventListener('change', (changeEvent) => {
        changeEvent.stopPropagation();
        activeFilters[filterDefinition.id] = optionCheckbox.checked;
        updateAllCells();
      });

      const optionLabelText = document.createElement('span');
      optionLabelText.textContent = filterDefinition.label;

      optionLabel.appendChild(optionCheckbox);
      optionLabel.appendChild(optionLabelText);
      filterMenu.appendChild(optionLabel);
    });

    filterButton.addEventListener('click', (clickEvent) => {
      clickEvent.stopPropagation();
      const isAlreadyOpen = filterMenu.classList.contains('log-formatter__filter-menu--open');
      document.querySelectorAll('.log-formatter__filter-menu--open').forEach((openMenuElement) => {
        openMenuElement.classList.remove('log-formatter__filter-menu--open');
      });

      if (!isAlreadyOpen) {
        syncFilterMenuCheckboxes(filterMenu);
        filterMenu.classList.add('log-formatter__filter-menu--open');
      }
    });

    filterWrapper.appendChild(filterButton);
    filterWrapper.appendChild(filterMenu);

    return {
      filterWrapper,
      filterButton,
      filterMenu,
    };
  };

  /**
   * Constrói a barra de ferramentas contendo o botão de alternância e o menu de filtros.
   * @param {HTMLElement} cellElement - Célula onde a barra será inserida.
   * @returns {Object} Componentes da barra de ferramentas.
   */
  const buildToolbar = (cellElement) => {
    const toolbarElement = document.createElement('div');
    toolbarElement.className = 'log-formatter__toolbar';

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'log-formatter__toggle';
    toggleButton.textContent = LABEL_SHOW_ORIGINAL;
    toggleButton.addEventListener('click', (clickEvent) => {
      clickEvent.stopPropagation();
      const cellViewState = viewStateByCell.get(cellElement);
      if (cellViewState) {
        showView(cellElement, cellViewState, !cellViewState.isShowingFormatted);
      }
    });

    const { filterWrapper, filterButton, filterMenu } = buildFilterDropdown();

    toolbarElement.appendChild(filterWrapper);
    toolbarElement.appendChild(toggleButton);

    return {
      toolbarElement,
      toggleButton,
      filterWrapper,
      filterButton,
      filterMenu,
    };
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

    const toolbarComponents = buildToolbar(cellElement);

    const cellViewState = {
      originalNodes: originalChildNodes,
      formattedNodes: [formattedViewNode],
      parsedLogEntries,
      ...toolbarComponents,
      isShowingFormatted: true,
    };

    viewStateByCell.set(cellElement, cellViewState);
    formattedCells.add(cellElement);
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
