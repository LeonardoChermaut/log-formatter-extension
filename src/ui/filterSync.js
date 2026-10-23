(() => {
  const { FILTER_DEFINITIONS } =
    globalThis.LogFormatter?.filterDefinitions ||
    (typeof require !== 'undefined' ? require('../filters/definitions.js') : {});

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
   * @param {Object<string, boolean>} activeFilters - Filtros ativos.
   */
  const syncFilterMenuCheckboxes = (menuElement, activeFilters) => {
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

  const filterSync = {
    getFilterButtonLabel,
    syncFilterMenuCheckboxes,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.filterSync = filterSync;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = filterSync;
  }
})();
