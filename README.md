# Formatador de Logs do Kibana

Extensão para navegadores Chromium (Google Chrome, Microsoft Edge, Brave, etc.) que formata e organiza automaticamente os logs na tabela do **Discover** do Kibana.

---

## Recursos

- **Chaves e identificadores em negrito**: Chaves originais (`spanId`, `userId`, `userEmail`, `url`, `method`, etc.) ficam em negrito, com os valores em fonte normal e legível.
- **Hierarquia sem perda de dados**: Expande objetos e JSONs aninhados sem truncar campos importantes (como CPF/documento, endereços e itens).
- **Ocultação de buffers numéricos**: Arrays compostos apenas por números (como bytes/buffers brutos) são recolhidos de forma compacta para evitar poluição visual.
- **Preservação da coluna de data/hora**: A coluna de tempo do Kibana não é modificada e não recebe botões indesejados.
- **Alternância rápida**: Botão **"Ver original"** / **"Ver formatado"** em cada célula para alternar a qualquer momento.
- **Filtros de campos vazios**: Menu dropdown para ocultar valores nulos, strings vazias, `false`, arrays vazios e objetos vazios **apenas em estruturas aninhadas** (message, context, Filebeat fields) - nunca remove campos principais como message, trace, stack, error.

---

## Como Adicionar no Navegador

### Passo 1: Acessar a página de extensões

- No **Google Chrome**: abra uma nova aba e acesse `chrome://extensions`
- No **Microsoft Edge**: acesse `edge://extensions`
- No **Brave**: acesse `brave://extensions`

### Passo 2: Ativar o Modo do Desenvolvedor

- Ative a chave **"Modo do desenvolvedor"** (_Developer mode_).

### Passo 3: Carregar a extensão

1. Clique no botão **"Carregar sem compactação"** (_Load unpacked_) no canto superior esquerdo.
2. Na janela que se abrir, selecione a pasta do projeto:
   ```
   {path}\log-formatter-extension
   ```
3. Clique em **"Selecionar pasta"**.

Pronto! A extensão aparecerá na sua lista de extensões ativas.
Coloque-a para "fixar" ou "favoritar" pra sempre estar visível no navegador.

---

## Como Usar

1. Acesse o seu Kibana na aba **Discover**:
   ```
   https://kibana.eks.tools.fastshopdigital.com/*
   ```
2. As células de log serão automaticamente organizadas e formatadas.
3. Se quiser conferir o texto bruto original de qualquer log, só clicar no botão **"Ver original"**. Para voltar à visualização limpa, clique em **"Ver formatado"**.
4. Use o botão **"Filtros"** para ocultar campos vazios em estruturas aninhadas.

---

## Como Atualizar a Extensão

Sempre que fizer alterações nos arquivos:

1. Acesse `chrome://extensions` novamente.
2. Localize o cartão do **Formatador de Logs do Kibana**.
3. Clique no ícone de **recarregar** (ícone circular com seta 🔄).
4. Atualize a página do Kibana (pressione `F5` ou `Ctrl + R`).

---

## Estrutura do Projeto

```text
log-formatter-extension/
├── manifest.json              # Manifesto V3 da extensão
├── package.json               # Dependências e scripts npm
├── eslint.config.mjs          # Regras e linting do ESLint
├── .prettierrc                # Regras de formatação de código
├── AGENTS.md                  # Guia para agentes de IA
├── commit.md                  # Histórico de mudanças (convenção git)
├── planning.md                # Análise de arquitetura e plano de refatoração
├── src/
│   ├── content.css            # Estilos aplicados no Kibana
│   ├── core/                  # Tipos e constantes compartilhadas
│   │   ├── constants.js       # LOG_LEVEL, seletores, labels, storage keys
│   │   └── types.js           # Tipos TypeScript/JSDoc compartilhados
│   ├── parsing/               # Camada de parsing (texto bruto → estruturado)
│   │   ├── detectFormat.js    # Detecção de formato (NestJS, Skywalking, Filebeat)
│   │   ├── parseNestjs.js     # Parser NestJS (util.inspect)
│   │   ├── parseSkywalking.js # Parser Skywalking
│   │   ├── parseFilebeat.js   # Parser Filebeat/Kubernetes
│   │   ├── parseInspect.js    # Parser util.inspect (objetos, context, trace)
│   │   └── index.js           # Orquestrador parseRawLogText
│   ├── formatting/            # Camada de formatação (estruturado → segmentos)
│   │   ├── renderSegments.js  # Primitivas: createTextSegment, createBoldSegment, createEmptyLine
│   │   ├── renderValue.js     # Render hierárquico: renderComplexValue, renderArrayValue, renderObjectValue
│   │   ├── formatNestjs.js    # Formatter NestJS
│   │   ├── formatSkywalking.js # Formatter Skywalking
│   │   ├── formatFilebeat.js  # Formatter Filebeat
│   │   ├── groupByTrace.js    # Agrupamento por traceId + ordenação temporal
│   │   └── index.js           # Dispatcher formatLogEntry + formatLogEntries
│   ├── json/                  # Utilitários JSON puros (sem side effects)
│   │   ├── repair.js          # tryParseJson (reparo JSON truncado do Kibana)
│   │   ├── expand.js          # parseNestedJson (expansão recursiva JSON strings)
│   │   └── escape.js          # unescapeJavaScriptString (\n, \t, etc.)
│   ├── filters/               # Sistema de filtros (estado + lógica + persistência)
│   │   ├── definitions.js     # FILTER_DEFINITIONS, DEFAULT_FILTER_OPTIONS, FILTER_STORAGE_KEY
│   │   ├── engine.js          # shouldFilterValue, pruneLogData
│   │   └── storage.js         # loadFilterPreferences, saveFilterPreferences (localStorage)
│   ├── ui/                    # Camada de UI (DOM + interação)
│   │   ├── buildSegments.js   # buildSegmentSpan, buildLineElement, buildFormattedView
│   │   ├── toolbar.js         # buildToolbar, buildFilterDropdown
│   │   ├── filterSync.js      # syncFilterMenuCheckboxes, getFilterButtonLabel
│   │   ├── cellState.js       # cellViews (WeakMap), trackedCells (Set), showView, updateAllCells
│   │   └── content.js         # Entry point: MutationObserver, formatCell, formatAllLogCells
│   └── utils/                 # Helpers genuínamente genéricos
│       ├── date.js            # formatTimestamp (pt-BR, São Paulo), isDateOrTimeOnly
│       └── typeGuards.js      # isNumericArray, isEmpty*, isNullOrUndefined, isFalse
```

---

## Arquitetura em Camadas

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                             │
│  content.js → MutationObserver → formatCell → buildToolbar │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Formatting Layer                        │
│  formatNestjs / formatSkywalking / formatFilebeat           │
│  groupByTrace → formatLogEntries                            │
│  renderValue → renderComplexValue → renderArray/Object      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       Parsing Layer                         │
│  parseRawLogText → detectFormat → parseNestjs/Sky/Filebeat  │
│  parseInspect → parseMessageLiteral, parseContextLiteral    │
│  parseInspectObject (util.inspect output)                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
      ┌─────────┐    ┌────────────┐  ┌──────────┐
      │  json/  │    │  filters/  │  │  utils/  │
      │ repair  │    │ engine     │  │ date     │
      │ expand  │    │ storage    │  │ typeGuard│
      │ escape  │    │ definitions│  │          │
      └─────────┘    └────────────┘  └──────────┘
```

---

## Formatos de Log Suportados

1. **NestJS** (output `util.inspect`): `{ timestamp: '...', message: '...', context: Map(...) }`
2. **Skywalking**: `file: '...', level: '...', message: '...'`
3. **Filebeat/Kubernetes**: `key: value` por linha

---

## Lógica de Parsing Crítica

- `parseMessageLiteral` - Suporta `'single'`, `"double"`, `` `backtick` `` quoted strings
- `parseContextLiteral` - Extrai entradas `Map` (`'key' => value`) e campos de objeto
- `parseInspectObject` - Parser recursivo para objetos aninhados em `trace`, `errorResponse`, valores do context
- `tryParseJson` - Repara JSON truncado (comum no Kibana por limites de caracteres)
- `parseNestedJson` - Expande recursivamente strings JSON dentro de objetos/arrays
- `renderComplexValue` - Renderiza objetos/arrays hierarquicamente com chaves em negrito

---

## Desenvolvimento

### Comandos

```bash
npm run lint          # ESLint check
npm run lint:fix      # ESLint auto-fix
npm run format        # Prettier write
npm run format:check  # Prettier check
```

**Ordem obrigatória antes de commit:** `lint` → `format:check` (husky pre-commit roda lint-staged)
