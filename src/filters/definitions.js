(() => {
  const FILTER_DEFINITIONS = [
    { id: 'null', label: 'Valores nulos (null, undefined)' },
    { id: 'emptyString', label: 'Strings vazias ("")' },
    { id: 'false', label: 'Valores falsos (false)' },
    { id: 'emptyArray', label: 'Arrays vazios ([], ["", ""])' },
    { id: 'emptyObject', label: 'Objetos vazios ({})' },
  ];

  const DEFAULT_FILTER_OPTIONS = {
    null: false,
    emptyString: false,
    false: false,
    emptyArray: false,
    emptyObject: false,
  };

  const FILTER_STORAGE_KEY = 'kibana_log_formatter_filters';

  const definitions = {
    FILTER_DEFINITIONS,
    DEFAULT_FILTER_OPTIONS,
    FILTER_STORAGE_KEY,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.filterDefinitions = definitions;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = definitions;
  }
})();
