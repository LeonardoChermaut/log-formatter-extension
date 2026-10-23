(() => {
  /**
   * Verifica se a string pertence ao formato de log gerado pelo NestJS com util.inspect.
   * @param {string} rawLogText - Texto bruto da célula.
   * @returns {boolean} Verdadeiro se for log NestJS.
   */
  const isNestjsFormat = (rawLogText) => /\{\s*timestamp:\s*'/.test(rawLogText);

  /**
   * Verifica se a string pertence ao formato de log do agente Skywalking.
   * @param {string} rawLogText - Texto bruto da célula.
   * @returns {boolean} Verdadeiro se for log Skywalking.
   */
  const isSkywalkingFormat = (rawLogText) =>
    /\bfile:\s*['"]/.test(rawLogText) &&
    /\blevel:\s*'/.test(rawLogText) &&
    !isNestjsFormat(rawLogText);

  /**
   * Verifica se o texto corresponde ao formato de log do Filebeat ou Kubernetes (chave: valor por linha).
   * @param {string} rawLogText - Texto bruto da célula.
   * @param {Function} isDateOrTimeOnlyFn - Função para verificar se é apenas data/hora.
   * @returns {boolean} Verdadeiro se for formato Filebeat / Kubernetes.
   */
  const isFilebeatFormat = (rawLogText, isDateOrTimeOnlyFn) => {
    return (
      /^[@\w][\w.-]*:\s+\S/m.test(rawLogText) &&
      !isNestjsFormat(rawLogText) &&
      !isSkywalkingFormat(rawLogText) &&
      !isDateOrTimeOnlyFn(rawLogText)
    );
  };

  const detectFormat = {
    isNestjsFormat,
    isSkywalkingFormat,
    isFilebeatFormat,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.detectFormat = detectFormat;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = detectFormat;
  }
})();
