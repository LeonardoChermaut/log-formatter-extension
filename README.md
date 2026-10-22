# Formatador de Logs do Kibana

Extensão para navegadores Chromium (Google Chrome, Microsoft Edge, Brave, etc.) que formata e organiza automaticamente os logs na tabela do **Discover** do Kibana.

---

## Recursos

- **Chaves e identificadores em negrito**: Chaves originais (`spanId`, `userId`, `userEmail`, `url`, `method`, etc.) ficam em negrito, com os valores em fonte normal e legível.
- **Hierarquia sem perda de dados**: Expande objetos e JSONs aninhados sem truncar campos importantes (como CPF/documento, endereços e itens).
- **Ocultação de buffers numéricos**: Arrays compostos apenas por números (como bytes/buffers brutos) são recolhidos de forma compacta para evitar poluição visual.
- **Preservação da coluna de data/hora**: A coluna de tempo do Kibana não é modificada e não recebe botões indesejados.
- **Alternância rápida**: Botão **"Ver original"** / **"Ver formatado"** em cada célula para alternar a qualquer momento.

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
3. Se quiser conferir o texto bruto original de qualquer log, só clicar no botão **"Ver original"** . Para voltar à visualização limpa, clique em **"Ver formatado"**.

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
├── src/
│   ├── content/               # Content scripts injetados na página
│   │   ├── content.js         # Observador DOM e controle de UI da tabela
│   │   └── content.css        # Estilos aplicados no Kibana
│   ├── formatters/            # Motores de análise e formatação de logs
│   │   └── formatLogEntry.js  # Parser e formatador estrutural de logs
│   └── utils/                 # Funções utilitárias reutilizáveis
│       └── utilities.js       # JSON parsing/repair, datas, etc.
```
