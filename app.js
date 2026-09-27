(() => {
  'use strict';

  let lessons = [];
  const STORAGE_KEY = 'estudos2026:completed:v1';
  const TIMER_KEY = 'estudos2026:timer:v1';
  const DEFAULT_TIMER_SECONDS = 25 * 60;

  const dayAliases = {
    domingo: 0,
    segunda: 1,
    'segunda-feira': 1,
    terça: 2,
    terca: 2,
    'terça-feira': 2,
    'terca-feira': 2,
    quarta: 3,
    'quarta-feira': 3,
    quinta: 4,
    'quinta-feira': 4,
    sexta: 5,
    'sexta-feira': 5,
    sábado: 6,
    sabado: 6
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const normalize = (value = '') => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const lessonId = (lesson) => `${lesson.disciplina}::${lesson.aula}`;
  const html = (value = '') => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

  let completed = loadCompleted();
  let currentPage = 'dashboard';
  let pendingBatch = null;
  let pendingConfirmAction = null;
  let timerState = loadTimer();
  let timerInterval = null;
  const openSubjects = new Set();

  let subjects = [];

  function buildSubjects(source) {
    const map = new Map();
    source.forEach((lesson, absoluteIndex) => {
      if (!map.has(lesson.disciplina)) {
        map.set(lesson.disciplina, { name: lesson.disciplina, day: lesson.dia, lessons: [] });
      }
      const subject = map.get(lesson.disciplina);
      subject.lessons.push({ ...lesson, absoluteIndex, id: lessonId(lesson), index: subject.lessons.length });
    });
    return [...map.values()];
  }

  function getRowValue(row, expectedHeader) {
    const expected = normalize(expectedHeader).trim();
    for (const [key, value] of Object.entries(row)) {
      if (normalize(String(key)).trim() === expected) return value;
    }
    return '';
  }

  function parseWorkbook(arrayBuffer) {
    if (!window.XLSX) throw new Error('Biblioteca XLSX indisponível.');

    const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
    const parsedLessons = [];

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return;

      const rows = window.XLSX.utils.sheet_to_json(sheet, {
        defval: '',
        raw: false
      });

      rows.forEach(row => {
        const aula = String(getRowValue(row, 'Aula') ?? '').trim();
        const disciplina = String(getRowValue(row, 'Disciplina') ?? '').trim();
        const dia = String(getRowValue(row, 'Dia') ?? '').trim();

        if (!aula || !disciplina) return;
        parsedLessons.push({ aula, disciplina, dia });
      });
    });

    if (!parsedLessons.length) {
      throw new Error('Nenhuma aula válida foi encontrada em estudos2026.xlsx.');
    }

    return parsedLessons;
  }

  async function loadLessonsFromSpreadsheet() {
    const url = `estudos2026.xlsx?v=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Falha ao carregar a planilha (HTTP ${response.status}).`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return parseWorkbook(arrayBuffer);
  }

  async function initializeData() {
    $('#topbarStatus').textContent = 'Carregando planilha…';

    try {
      lessons = await loadLessonsFromSpreadsheet();
    } catch (error) {
      console.warn('Não foi possível ler estudos2026.xlsx; usando data.js como fallback.', error);
      lessons = Array.isArray(window.EMBEDDED_STUDY_DATA) ? window.EMBEDDED_STUDY_DATA : [];
    }

    subjects = buildSubjects(lessons);
    refreshAll();
  }

  function loadCompleted() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  function saveCompleted() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
  }

  function loadTimer() {
    try {
      const parsed = JSON.parse(localStorage.getItem(TIMER_KEY) || '{}');
      if (typeof parsed.remaining !== 'number') return { remaining: DEFAULT_TIMER_SECONDS, running: false, endsAt: null };
      if (parsed.running && parsed.endsAt) {
        const remaining = Math.max(0, Math.ceil((parsed.endsAt - Date.now()) / 1000));
        return { remaining, running: remaining > 0, endsAt: remaining > 0 ? parsed.endsAt : null };
      }
      return { remaining: Math.max(0, parsed.remaining), running: false, endsAt: null };
    } catch {
      return { remaining: DEFAULT_TIMER_SECONDS, running: false, endsAt: null };
    }
  }

  function saveTimer() {
    localStorage.setItem(TIMER_KEY, JSON.stringify(timerState));
  }

  function subjectProgress(subject) {
    const done = subject.lessons.reduce((sum, lesson) => sum + (completed.has(lesson.id) ? 1 : 0), 0);
    const total = subject.lessons.length;
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  function overallProgress() {
    const total = lessons.length;
    const validIds = new Set(lessons.map(lessonId));
    const done = [...completed].filter(id => validIds.has(id)).length;
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  function nextLesson(subject) {
    let highestCompleted = -1;
    subject.lessons.forEach((lesson, index) => {
      if (completed.has(lesson.id)) highestCompleted = Math.max(highestCompleted, index);
    });
    return subject.lessons[highestCompleted + 1] || null;
  }

  function formatDate(date) {
    const weekdays = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${weekdays[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]}`;
  }

  function todaySubjects() {
    const day = new Date().getDay();
    return subjects.filter(subject => dayAliases[normalize(subject.day)] === day);
  }

  function setDonut(element, percent) {
    element.style.setProperty('--progress', Math.max(0, Math.min(100, percent)));
    element.setAttribute('aria-label', `${percent}% concluído`);
  }

  function renderDashboard() {
    const now = new Date();
    $('#dashboardDate').textContent = formatDate(now);

    const today = todaySubjects();
    $('#todayCount').textContent = `${today.length} ${today.length === 1 ? 'matéria' : 'matérias'}`;
    $('#todayList').innerHTML = today.length
      ? today.map(subject => {
          const next = nextLesson(subject);
          return `<div class="today-item">
            <div class="today-subject">${html(subject.name)}</div>
            <div class="today-lesson">${next ? html(next.aula) : 'Disciplina concluída.'}</div>
          </div>`;
        }).join('')
      : `<div class="today-empty">Não há disciplinas programadas para hoje. Use o tempo livre para revisar ou adiantar uma aula.</div>`;

    const overall = overallProgress();
    $('#generalPercent').textContent = `${overall.percent}%`;
    $('#totalSubjects').textContent = subjects.length;
    $('#totalLessons').textContent = overall.total;
    $('#completedLessons').textContent = overall.done;
    setDonut($('#generalDonut'), overall.percent);
    $('#topbarStatus').textContent = `${overall.done}/${overall.total} aulas concluídas`;

    const ranked = subjects
      .map(subject => ({ subject, progress: subjectProgress(subject) }))
      .sort((a, b) => b.progress.percent - a.progress.percent || b.progress.done - a.progress.done || a.subject.name.localeCompare(b.subject.name, 'pt-BR'));

    $('#disciplineGrid').innerHTML = ranked.map(({ subject, progress }, index) => `
      <article class="discipline-card">
        <div class="discipline-card-header">
          <h3>${html(subject.name)}</h3>
          <span class="discipline-rank">#${index + 1}</span>
        </div>
        <div class="donut discipline-donut" style="--progress:${progress.percent}" aria-label="${progress.percent}% concluído">
          <div class="donut-core"><strong>${progress.percent}%</strong><span>concluído</span></div>
        </div>
        <div class="discipline-footer">
          <div>Aulas<strong>${progress.done}/${progress.total}</strong></div>
          <div>Dia<strong>${capitalize(subject.day)}</strong></div>
        </div>
      </article>`).join('');
  }

  function renderUpdate() {
    const query = normalize($('#lessonSearch').value.trim());
    const overall = overallProgress();
    $('#updateSummary').textContent = `${overall.done} de ${overall.total} aulas concluídas`;

    const visibleSubjects = subjects.map(subject => {
      if (!query) return { ...subject, visibleLessons: subject.lessons };
      const subjectMatches = normalize(subject.name).includes(query);
      const visibleLessons = subjectMatches ? subject.lessons : subject.lessons.filter(lesson => normalize(lesson.aula).includes(query));
      return { ...subject, visibleLessons };
    }).filter(subject => subject.visibleLessons.length);

    const container = $('#updateList');
    if (!visibleSubjects.length) {
      container.innerHTML = `<div class="panel no-results">Nenhuma aula encontrada para essa busca.</div>`;
      return;
    }

    container.innerHTML = visibleSubjects.map(subject => {
      const progress = subjectProgress(subject);
      const allDone = progress.done === progress.total;
      const lessonsMarkup = subject.visibleLessons.map(lesson => {
        const isDone = completed.has(lesson.id);
        return `<div class="lesson-row ${isDone ? 'completed' : ''}">
          <span class="lesson-number">${lesson.index + 1}</span>
          <span class="lesson-title">${html(lesson.aula)}</span>
          <button class="check-button" type="button" aria-label="${isDone ? 'Desmarcar' : 'Marcar'} aula ${lesson.index + 1} como concluída" aria-pressed="${isDone}" data-lesson-id="${html(lesson.id)}" data-subject="${html(subject.name)}" data-index="${lesson.index}">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12.5 4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>`;
      }).join('');

      const isOpen = openSubjects.has(subject.name);
      return `<details class="subject-group"${isOpen ? ' open' : ''}>
        <summary class="subject-summary">
          <div class="subject-summary-main">
            <h2>${html(subject.name)}</h2>
            <div class="subject-meta">
              <span>${progress.done}/${progress.total} concluídas</span>
              <span class="mini-progress"><span style="width:${progress.percent}%"></span></span>
              <span>${progress.percent}%</span>
            </div>
          </div>
          <div class="subject-actions">
            <button class="group-action" type="button" data-complete-subject="${html(subject.name)}">${allDone ? 'Desmarcar tudo' : 'Marcar tudo'}</button>
            <button class="subject-toggle" type="button" data-toggle-subject="${html(subject.name)}" aria-label="${isOpen ? 'Fechar' : 'Abrir'} aulas de ${html(subject.name)}" aria-expanded="${isOpen}">
              <svg class="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </summary>
        <div class="lesson-list">${lessonsMarkup}</div>
      </details>`;
    }).join('');
  }

  function capitalize(value = '') {
    return value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1);
  }

  function refreshAll() {
    renderDashboard();
    renderUpdate();
  }

  function openDrawer() {
    $('#drawer').classList.add('open');
    $('#drawer').setAttribute('aria-hidden', 'false');
    $('#menuButton').setAttribute('aria-expanded', 'true');
    $('#scrim').hidden = false;
  }

  function closeDrawer() {
    $('#drawer').classList.remove('open');
    $('#drawer').setAttribute('aria-hidden', 'true');
    $('#menuButton').setAttribute('aria-expanded', 'false');
    $('#scrim').hidden = true;
  }

  function switchPage(page) {
    currentPage = page;
    $$('.page').forEach(el => {
      const active = el.id === `page-${page}`;
      el.classList.toggle('active', active);
      el.hidden = !active;
    });
    $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
    if (page === 'update') renderUpdate();
    else renderDashboard();
    closeDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleLessonToggle(button) {
    const subject = subjects.find(item => item.name === button.dataset.subject);
    if (!subject) return;
    const index = Number(button.dataset.index);
    const lesson = subject.lessons[index];
    const isDone = completed.has(lesson.id);

    if (isDone) {
      completed.delete(lesson.id);
      saveCompleted();
      refreshAll();
      return;
    }

    const earlierIncomplete = subject.lessons.slice(0, index).some(item => !completed.has(item.id));
    if (index > 0 && earlierIncomplete) {
      pendingBatch = { subject, index, lesson };
      $('#batchModalText').textContent = `Você marcou a aula ${index + 1} de ${subject.name}. Deseja marcar também todas as aulas da 1 à ${index + 1} como concluídas?`;
      $('#batchLessonsButton').textContent = `Marcar 1–${index + 1}`;
      $('#batchModal').showModal();
      return;
    }

    completed.add(lesson.id);
    saveCompleted();
    refreshAll();
  }

  function resolveBatch(mode) {
    if (!pendingBatch) return;
    const { subject, index, lesson } = pendingBatch;
    if (mode === 'batch') subject.lessons.slice(0, index + 1).forEach(item => completed.add(item.id));
    else completed.add(lesson.id);
    pendingBatch = null;
    saveCompleted();
    refreshAll();
  }

  function toggleSubject(name) {
    const subject = subjects.find(item => item.name === name);
    if (!subject) return;
    const progress = subjectProgress(subject);
    const allDone = progress.done === progress.total;
    subject.lessons.forEach(lesson => allDone ? completed.delete(lesson.id) : completed.add(lesson.id));
    saveCompleted();
    refreshAll();
  }

  function openConfirm({ title, text, actionLabel, onConfirm }) {
    $('#confirmModalTitle').textContent = title;
    $('#confirmModalText').textContent = text;
    $('#confirmModalAction').textContent = actionLabel;
    pendingConfirmAction = onConfirm;
    $('#confirmModal').showModal();
  }

  function markEverythingComplete() {
    openConfirm({
      title: 'Concluir todas as aulas?',
      text: `Isso marcará as ${lessons.length} aulas das ${subjects.length} disciplinas como concluídas neste navegador.`,
      actionLabel: 'Marcar tudo',
      onConfirm: () => {
        lessons.forEach(lesson => completed.add(lessonId(lesson)));
        saveCompleted();
        refreshAll();
      }
    });
  }

  function resetProgress() {
    openConfirm({
      title: 'Apagar todo o progresso?',
      text: 'Todas as marcações de aulas concluídas serão removidas deste navegador. Essa ação não altera a planilha original.',
      actionLabel: 'Apagar progresso',
      onConfirm: () => {
        completed.clear();
        saveCompleted();
        refreshAll();
        closeDrawer();
      }
    });
  }

  function renderTimer() {
    if (timerState.running && timerState.endsAt) {
      timerState.remaining = Math.max(0, Math.ceil((timerState.endsAt - Date.now()) / 1000));
      if (timerState.remaining <= 0) {
        timerState.running = false;
        timerState.endsAt = null;
        stopTimerInterval();
        saveTimer();
      }
    }
    const minutes = Math.floor(timerState.remaining / 60);
    const seconds = timerState.remaining % 60;
    $('#timerDisplay').textContent = `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    $('#timerToggle').textContent = timerState.running ? 'Pausar' : (timerState.remaining === 0 ? 'Iniciar' : 'Iniciar');
    document.title = timerState.running ? `${$('#timerDisplay').textContent} · Estudos` : 'Dashboard de Estudos';
  }

  function startTimerInterval() {
    stopTimerInterval();
    timerInterval = window.setInterval(() => {
      renderTimer();
      if (!timerState.running) return;
      saveTimer();
    }, 250);
  }

  function stopTimerInterval() {
    if (timerInterval) window.clearInterval(timerInterval);
    timerInterval = null;
  }

  function toggleTimer() {
    if (timerState.running) {
      timerState.remaining = Math.max(0, Math.ceil((timerState.endsAt - Date.now()) / 1000));
      timerState.running = false;
      timerState.endsAt = null;
      stopTimerInterval();
    } else {
      if (timerState.remaining <= 0) timerState.remaining = DEFAULT_TIMER_SECONDS;
      timerState.running = true;
      timerState.endsAt = Date.now() + timerState.remaining * 1000;
      startTimerInterval();
    }
    saveTimer();
    renderTimer();
  }

  function resetTimer() {
    timerState = { remaining: DEFAULT_TIMER_SECONDS, running: false, endsAt: null };
    stopTimerInterval();
    saveTimer();
    renderTimer();
  }

  $('#menuButton').addEventListener('click', openDrawer);
  $('#closeMenuButton').addEventListener('click', closeDrawer);
  $('#scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeDrawer(); });
  $$('.nav-item').forEach(item => item.addEventListener('click', () => switchPage(item.dataset.page)));

  $('#lessonSearch').addEventListener('input', renderUpdate);
  $('#updateList').addEventListener('click', event => {
    const button = event.target.closest('.check-button');
    if (button) return handleLessonToggle(button);

    const toggleButton = event.target.closest('[data-toggle-subject]');
    if (toggleButton) {
      event.preventDefault();
      event.stopPropagation();

      const name = toggleButton.dataset.toggleSubject;
      if (openSubjects.has(name)) openSubjects.delete(name);
      else openSubjects.add(name);

      renderUpdate();
      return;
    }

    const subjectButton = event.target.closest('[data-complete-subject]');
    if (subjectButton) {
      event.preventDefault();
      event.stopPropagation();
      toggleSubject(subjectButton.dataset.completeSubject);
      return;
    }

    if (event.target.closest('.subject-summary')) {
      event.preventDefault();
    }
  });

  $('#batchModal').addEventListener('close', () => {
    if (!pendingBatch) return;
    const mode = $('#batchModal').returnValue;
    if (mode === 'single' || mode === 'batch') resolveBatch(mode);
    else pendingBatch = null;
  });

  $('#confirmModal').addEventListener('close', () => {
    const action = pendingConfirmAction;
    pendingConfirmAction = null;
    if ($('#confirmModal').returnValue === 'confirm' && typeof action === 'function') action();
  });

  $('#completeAllButton').addEventListener('click', markEverythingComplete);
  $('#resetProgressButton').addEventListener('click', resetProgress);
  $('#timerToggle').addEventListener('click', toggleTimer);
  $('#timerReset').addEventListener('click', resetTimer);

  renderTimer();
  if (timerState.running) startTimerInterval();
  initializeData();
})();
