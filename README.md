# Dashboard de Estudos 2026

Dashboard responsivo em HTML, CSS e JavaScript criado a partir da planilha `estudos2026.xlsx`.

## Arquivos
- `index.html`: estrutura da interface.
- `styles.css`: design responsivo para mobile, tablet e desktop.
- `app.js`: progresso, próxima aula, ordenação, timer, modal de conclusão em lote e navegação.
- `data.js`: dados extraídos da planilha anexada.
- `estudos2026.xlsx`: planilha-fonte original.

## Como usar
Abra `index.html` em um navegador moderno. Não é necessário servidor nem instalação.

O progresso das aulas e o timer são salvos no `localStorage` do navegador. Isso foi necessário porque a planilha fornecida possui apenas as colunas `Aula`, `Disciplina` e `Dia`, sem coluna de status/conclusão.

## Dados atuais
- 221 aulas
- 4 disciplinas
- Teoria da História: domingo
- Geografia Mundial: domingo
- A arte do filme: terça
- História do Cinema: quarta

Se a planilha for alterada futuramente, será preciso regenerar o `data.js` a partir da nova versão para refletir novos nomes, disciplinas ou aulas.
