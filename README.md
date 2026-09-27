# Dashboard de Estudos 2026

Dashboard responsivo em HTML, CSS e JavaScript alimentado pela planilha `estudos2026.xlsx`.

## Arquivos
- `index.html`: estrutura da interface e carregamento do parser XLSX.
- `styles.css`: design responsivo para mobile, tablet e desktop.
- `app.js`: leitura da planilha, progresso, próxima aula, ordenação, timer, modal de conclusão em lote e navegação.
- `data.js`: fallback dos dados caso a leitura da planilha não esteja disponível.
- `estudos2026.xlsx`: fonte principal das disciplinas e aulas.

## Como os dados funcionam

Quando o site é servido por HTTP/HTTPS (por exemplo, GitHub Pages), o dashboard carrega diretamente o arquivo `estudos2026.xlsx` a cada abertura, com cache desativado. Novas aulas e novas disciplinas adicionadas à planilha passam a aparecer automaticamente, sem necessidade de regenerar o `data.js`.

O parser procura as colunas `Aula`, `Disciplina` e `Dia` e aceita os dados em qualquer aba da pasta de trabalho. Linhas sem aula ou disciplina são ignoradas.

Se a leitura do XLSX falhar — por exemplo, ao abrir `index.html` diretamente pelo protocolo `file://`, que pode bloquear `fetch` — o sistema usa `data.js` como contingência.

## Progresso

O progresso das aulas e o timer são salvos no `localStorage` do navegador. A planilha continua sendo apenas a fonte do catálogo de disciplinas, aulas e dias; marcar uma aula como concluída não modifica o arquivo XLSX.

## Dependência

A leitura de XLSX no navegador usa SheetJS (`xlsx@0.18.5`) carregado por CDN.
