(() => {
  const LOG_LEVEL = {
    error: 'ERRO',
    warn: 'AVISO',
    info: 'INFORMAÇÃO',
    debug: 'DEPURAÇÃO',
  };

  const KIBANA_LOG_CELL_SELECTOR =
    '[data-test-subj="docTableRow"] > [data-test-subj="docTableField"] > .truncate-by-height';

  const TARGET_PAGE_PATTERN = /\/app\/(discover|kibana)/;

  const PROCESSED_ATTRIBUTE = 'data-log-formatter';
  const ACTIVE_CELL_CLASS = 'log-formatter-cell';

  const LABEL_SHOW_ORIGINAL = 'Ver original';
  const LABEL_SHOW_FORMATTED = 'Ver formatado';

  const FILTER_STORAGE_KEY = 'kibana_log_formatter_filters';

  const coreConstants = {
    LOG_LEVEL,
    KIBANA_LOG_CELL_SELECTOR,
    TARGET_PAGE_PATTERN,
    PROCESSED_ATTRIBUTE,
    ACTIVE_CELL_CLASS,
    LABEL_SHOW_ORIGINAL,
    LABEL_SHOW_FORMATTED,
    FILTER_STORAGE_KEY,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.coreConstants = coreConstants;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = coreConstants;
  }
})();
