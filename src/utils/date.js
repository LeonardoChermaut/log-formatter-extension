(() => {
  /**
   * Formata timestamps ISO para o padrão brasileiro de data e hora no fuso de São Paulo.
   * @param {string} isoTimestampString - String de data no formato ISO.
   * @returns {string} Data e hora formatadas (ex: 21/10/2026, 16:43:25,091).
   */
  const formatTimestamp = (isoTimestampString) => {
    if (!isoTimestampString) {
      return '';
    }

    const dateInstance = new Date(isoTimestampString);
    if (Number.isNaN(dateInstance.getTime())) {
      return String(isoTimestampString);
    }

    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      hour12: false,
    }).format(dateInstance);
  };

  /**
   * Identifica se um texto de célula corresponde estritamente a uma data/hora,
   * garantindo que a coluna de horário do Kibana nunca seja modificada ou receba botões.
   * @param {string} candidateText - Texto a ser verificado.
   * @returns {boolean} Verdadeiro se o texto for exclusivamente uma data/hora.
   */
  const isDateOrTimeOnly = (candidateText) => {
    if (typeof candidateText !== 'string') {
      return false;
    }

    const trimmedCandidate = candidateText.trim();
    if (!trimmedCandidate) {
      return false;
    }

    if (
      /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}\s+@\s+\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?$/i.test(
        trimmedCandidate
      )
    ) {
      return true;
    }
    if (
      /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/i.test(
        trimmedCandidate
      )
    ) {
      return true;
    }
    if (
      /^\d{1,2}\/\d{1,2}\/\d{4}[,\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?$/i.test(trimmedCandidate)
    ) {
      return true;
    }

    return false;
  };

  const dateUtils = {
    formatTimestamp,
    isDateOrTimeOnly,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.dateUtils = dateUtils;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = dateUtils;
  }
})();
