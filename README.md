# Dashboard de Estudos

Dashboard responsivo em HTML, CSS e JavaScript puro, criado a partir da planilha `Estudos(4).xlsx` disponível na biblioteca.

## Arquivos

- `index.html` — estrutura da interface
- `styles.css` — layout responsivo, componentes e estados
- `app.js` — navegação, progresso, timer, modal e persistência
- `data.js` — disciplinas convertidas da planilha

## Como usar

Abra `index.html` no navegador. Não há build, servidor, framework nem dependência externa.

O progresso é salvo em `localStorage`, portanto permanece após recarregar a página no mesmo navegador.

## Sobre os nomes das aulas

A planilha disponível contém apenas:

- Disciplina
- Aulas totais
- Dia
- Instituição

Ela não traz títulos individuais das aulas nem status de conclusão. Por isso o app usa `Aula 1`, `Aula 2` etc. como fallback.

Para inserir títulos específicos, edite em `data.js` a propriedade `lessonTitles` de cada disciplina, mantendo a ordem. Exemplo:

```js
{
  id: 'historia-do-cinema',
  name: 'História do Cinema',
  totalLessons: 56,
  day: 'Terça',
  institution: 'Pablo Villaça',
  lessonTitles: [
    'A Criação do Cinema e Seus Anos Iniciais',
    'Origens do Cinema e Formação da Linguagem Cinematográfica'
  ]
}
```

O dashboard passará automaticamente a mostrar o título da próxima aula após a última aula marcada como concluída.
