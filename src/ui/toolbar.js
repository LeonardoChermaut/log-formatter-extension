(() => {
  const { LABEL_SHOW_ORIGINAL } =
    globalThis.LogFormatter?.coreConstants ||
    (typeof require !== 'undefined' ? require('../core/constants.js') : {});
  const { FILTER_DEFINITIONS } =
    globalThis.LogFormatter?.filterDefinitions ||
    (typeof require !== 'undefined' ? require('../filters/definitions.js') : {});
  const { getFilterButtonLabel, syncFilterMenuCheckboxes } =
    globalThis.LogFormatter?.filterSync ||
    (typeof require !== 'undefined' ? require('./filterSync.js') : {});

  /**
   * Constrói o menu popover com as opções de filtragem de campos vazios.
   * @param {Object<string, boolean>} activeFilters - Filtros ativos.
   * @param {Function} updateAllCells - Função para atualizar todas as células.
   * @returns {{ filterWrapper: HTMLElement, filterButton: HTMLElement, filterMenu: HTMLElement }} Elementos criados.
   */
  const buildFilterDropdown = (activeFilters, updateAllCells) => {
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
        syncFilterMenuCheckboxes(filterMenu, activeFilters);
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
   * @param {Object<string, boolean>} activeFilters - Filtros ativos.
   * @param {Function} updateAllCells - Função para atualizar todas as células.
   * @returns {Object} Componentes da barra de ferramentas.
   */
  const buildToolbar = (cellElement, activeFilters, updateAllCells) => {
    const toolbarElement = document.createElement('div');
    toolbarElement.className = 'log-formatter__toolbar';

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'log-formatter__toggle';
    toggleButton.textContent = LABEL_SHOW_ORIGINAL;
    toggleButton.addEventListener('click', (clickEvent) => {
      clickEvent.stopPropagation();
      const cellViewState = cellState.get(cellElement);
      if (cellViewState) {
        showView(cellElement, cellViewState, !cellViewState.isShowingFormatted);
      }
    });

    const { filterWrapper, filterButton, filterMenu } = buildFilterDropdown(
      activeFilters,
      updateAllCells
    );

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

  let cellState = null;
  let showView = null;

  const toolbar = {
    buildFilterDropdown,
    buildToolbar,
    setDependencies: (cellStateModule, showViewFn) => {
      cellState = cellStateModule;
      showView = showViewFn;
    },
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.toolbar = toolbar;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = toolbar;
  }
})();
