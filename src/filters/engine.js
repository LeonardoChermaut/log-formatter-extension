(() => {
  const { isNullOrUndefined, isEmptyString, isFalse, isEmptyArray, isEmptyObject } =
    globalThis.LogFormatter?.typeGuards ||
    (typeof require !== 'undefined' ? require('../utils/typeGuards.js') : {});

  /**
   * Determina se um valor primitivo ou estrutural deve ser filtrado conforme as opções ativas.
   * @param {*} candidateValue - Valor a ser verificado.
   * @param {Object<string, boolean>} activeFilters - Mapa de filtros ativos.
   * @returns {boolean} Verdadeiro se o valor deve ser removido.
   */
  const shouldFilterValue = (candidateValue, activeFilters = {}) => {
    if (!activeFilters) {
      return false;
    }
    if (activeFilters.null && isNullOrUndefined(candidateValue)) {
      return true;
    }
    if (activeFilters.emptyString && isEmptyString(candidateValue)) {
      return true;
    }
    if (activeFilters.false && isFalse(candidateValue)) {
      return true;
    }
    if (activeFilters.emptyArray && isEmptyArray(candidateValue)) {
      return true;
    }
    if (activeFilters.emptyObject && isEmptyObject(candidateValue)) {
      return true;
    }
    return false;
  };

  /**
   * Percorre recursivamente um objeto ou array e remove campos que correspondam aos filtros ativos.
   * Retorna uma nova estrutura sem mutar os dados originais.
   * @param {*} dataToPrune - Objeto, array ou valor primitivo a ser podado.
   * @param {Object<string, boolean>} activeFilters - Mapa com flags de filtros ativos.
   * @returns {*} Nova estrutura limpa com os campos filtrados removidos.
   */
  const pruneLogData = (dataToPrune, activeFilters = {}) => {
    if (!activeFilters || !Object.values(activeFilters).some(Boolean)) {
      return dataToPrune;
    }

    if (shouldFilterValue(dataToPrune, activeFilters)) {
      return undefined;
    }

    if (Array.isArray(dataToPrune)) {
      const prunedArray = dataToPrune
        .map((arrayItem) => pruneLogData(arrayItem, activeFilters))
        .filter((arrayItem) => arrayItem !== undefined);

      if (activeFilters.emptyArray && (prunedArray.length === 0 || isEmptyArray(prunedArray))) {
        return undefined;
      }
      return prunedArray;
    }

    if (dataToPrune !== null && typeof dataToPrune === 'object') {
      const prunedObject = {};
      for (const [propertyKey, propertyValue] of Object.entries(dataToPrune)) {
        const prunedPropertyValue = pruneLogData(propertyValue, activeFilters);
        if (prunedPropertyValue !== undefined) {
          prunedObject[propertyKey] = prunedPropertyValue;
        }
      }

      if (activeFilters.emptyObject && Object.keys(prunedObject).length === 0) {
        return undefined;
      }
      return prunedObject;
    }

    return dataToPrune;
  };

  const filterEngine = {
    shouldFilterValue,
    pruneLogData,
  };

  globalThis.LogFormatter = globalThis.LogFormatter || {};
  globalThis.LogFormatter.filterEngine = filterEngine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = filterEngine;
  }
})();
