(() => {
  const { DEFAULT_FILTER_OPTIONS, FILTER_STORAGE_KEY } =
    globalThis.LogFormatter?.filterDefinitions ||
    (typeof require !== 'undefined' ? require('./definitions.js') : {});

  /**
   * Carrega as preferências de filtro salvas no localStorage ou retorna as padrões.
   * @returns {Object<string, boolean>} Objeto com o estado de cada filtro.
   */
  const loadFilterPreferences = () => {
    try {
      if (typeof localStorage === 'undefined') {
        return { ...DEFAULT_FILTER_OPTIONS };
      }
      const rawStoredValue = localStorage.getItem(FILTER_STORAGE_KEY);
      if (!rawStoredValue) {
        return { ...DEFAULT_FILTER_OPTIONS };
      }
      const parsedFilters = JSON.parse(rawStoredValue);
      return { ...DEFAULT_FILTER_OPTIONS, ...parsedFilters };
    } catch {
      return { ...DEFAULT_FILTER_OPTIONS };
    }
  };

  /**
   * Salva as preferências de filtro no localStorage.
   * @param {Object<string, boolean>} filterPreferences - Mapa de filtros a persistir.
   */
  const saveFilterPreferences = (filterPreferences) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filterPreferences));
      }
    } catch {}
  };

  const filterStorage = {
    loadFilterPreferences,
    saveFilterPreferences,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.filterStorage = filterStorage;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = filterStorage;
  }
})();
