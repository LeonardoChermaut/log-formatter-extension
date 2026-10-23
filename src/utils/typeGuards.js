(() => {
  /**
   * Verifica se o valor é um array não vazio composto exclusivamente por números.
   * Utilizado para identificar buffers binários ou sequências numéricas que não agregam
   * valor legível direto aos logs e devem ser sumarizados visualmente.
   * @param {*} candidateArray - Valor a ser verificado.
   * @returns {boolean} Verdadeiro se for um array não vazio apenas com números.
   */
  const isNumericArray = (candidateArray) => {
    return (
      Array.isArray(candidateArray) &&
      candidateArray.length > 0 &&
      candidateArray.every((item) => typeof item === 'number')
    );
  };

  /**
   * Verifica se o valor é nulo ou indefinido.
   * @param {*} candidateValue - Valor a ser avaliado.
   * @returns {boolean} Verdadeiro se for null ou undefined.
   */
  const isNullOrUndefined = (candidateValue) =>
    candidateValue === null || candidateValue === undefined;

  /**
   * Verifica se o valor é uma string vazia ou composta exclusivamente por espaços em branco.
   * @param {*} candidateValue - Valor a ser avaliado.
   * @returns {boolean} Verdadeiro se for string vazia.
   */
  const isEmptyString = (candidateValue) =>
    typeof candidateValue === 'string' && candidateValue.trim() === '';

  /**
   * Verifica se o valor é estritamente o booleano false.
   * @param {*} candidateValue - Valor a ser avaliado.
   * @returns {boolean} Verdadeiro se for estritamente false.
   */
  const isFalse = (candidateValue) => candidateValue === false;

  /**
   * Verifica se o valor é um array vazio ou se contém exclusivamente itens vazios/nulos (ex: [], ["", ""]).
   * @param {*} candidateValue - Valor a ser avaliado.
   * @returns {boolean} Verdadeiro se o array não contiver conteúdo significativo.
   */
  const isEmptyArray = (candidateValue) => {
    if (!Array.isArray(candidateValue)) {
      return false;
    }
    if (candidateValue.length === 0) {
      return true;
    }
    return candidateValue.every((item) => {
      if (isNullOrUndefined(item)) {
        return true;
      }
      if (isEmptyString(item)) {
        return true;
      }
      return false;
    });
  };

  /**
   * Verifica se o valor é um objeto literal vazio (sem chaves próprias).
   * @param {*} candidateValue - Valor a ser avaliado.
   * @returns {boolean} Verdadeiro se for objeto sem propriedades.
   */
  const isEmptyObject = (candidateValue) => {
    if (
      candidateValue === null ||
      typeof candidateValue !== 'object' ||
      Array.isArray(candidateValue)
    ) {
      return false;
    }
    return Object.keys(candidateValue).length === 0;
  };

  const typeGuards = {
    isNumericArray,
    isNullOrUndefined,
    isEmptyString,
    isFalse,
    isEmptyArray,
    isEmptyObject,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.typeGuards = typeGuards;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = typeGuards;
  }
})();
