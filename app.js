(() => {
  'use strict';

  const DATA = Array.isArray(window.STUDY_DATA) ? window.STUDY_DATA : [];
  const STORAGE_KEY = 'estudos-dashboard-state-v1';
  const TIMER_SECONDS = 25 * 60;

  const dayMap = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const state = loadState();
  let currentView = 'dashboard';
  let timerRemaining = TIMER_SECONDS;
  let timerRunning = false;
  let timerId = null;
  let modalContext = null;
  let lastModalTrigger = null;
  let toastTimer = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const els = {
    currentDate: $('#currentDate'),
    todayList: $('#todayList'),
    todayCount: $('#todayCount'),
    generalDonut: $('#generalDonut'),
    generalPercent: $('#generalPercent'),
    disciplineCount: $('#disciplineCount'),
    lessonCount: $('#lessonCount'),
    completedCount: $('#completedCount'),
    disciplineGrid: $('#disciplineGrid'),
    timerDisplay: $('#timerDisplay'),
    timerToggle: $('#timerToggle'),
    timerReset: $('#timerReset'),
    menuButton: $('#menuButton'),
    closeDrawerButton: $('#closeDrawerButton'),
    drawer: $('#appDrawer'),
    drawerBackdrop: $('#drawerBackdrop'),
    pageLabel: $('#pageLabel'),
    navItems: $$('.nav-item'),
    updatesView: $('#updatesView'),
    dashboardView: $('#dashboardView'),
    updatesList: $('#updatesList'),
    disciplineSearch: $('#disciplineSearch'),
    updateSummary: $('#updateSummary'),
    updatesEmpty: $('#updatesEmpty'),
    markEverythingButton: $('#markEverythingButton'),
    modal: $('#sequenceModal'),
    modalBackdrop: $('#modalBackdrop'),
    modalDescription: $('#modalDescription'),
    modalMarkRange: $('#modalMarkRange'),
    modalMarkSingle: $('#modalMarkSingle'),
    modalCancel: $('#modalCancel'),
    modalCloseButton: $('#modalCloseButton'),
    toast: $('#toast')
  };

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      showToast('Não foi possível salvar o progresso neste navegador.');
    }
  }

  function ensureDisciplineState(id) {
    if (!state[id] || !Array.isArray(state[id].completed)) state[id] = { completed: [] };
    state[id].completed = [...new Set(state[id].completed.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
    return state[id];
  }

  function completedSet(id) {
    return new Set(ensureDisciplineState(id).completed);
  }

  function getCompletedCount(discipline) {
    const valid = ensureDisciplineState(discipline.id).completed.filter(n => n >= 1 && n <= discipline.totalLessons);
    return valid.length;
  }

  function getPercent(discipline) {
    if (!discipline.totalLessons) return 0;
    return Math.round((getCompletedCount(discipline) / discipline.totalLessons) * 100);
  }

  function getLessonTitle(discipline, lessonNumber) {
    const explicit = discipline.lessonTitles?.[lessonNumber - 1];
    return explicit && String(explicit).trim() ? explicit : `Aula ${lessonNumber}`;
  }

  function getNextLesson(discipline) {
    const completed = ensureDisciplineState(discipline.id).completed;
    if (!completed.length) return { number: 1, title: getLessonTitle(discipline, 1) };
    const last = Math.max(...completed);
    const next = last + 1;
    if (next > discipline.totalLessons) return null;
    return { number: next, title: getLessonTitle(discipline, next) };
  }

  function totals() {
    const totalLessons = DATA.reduce((sum, d) => sum + Number(d.totalLessons || 0), 0);
    const completed = DATA.reduce((sum, d) => sum + getCompletedCount(d), 0);
    return {
      disciplines: DATA.length,
      totalLessons,
      completed,
      percent: totalLessons ? Math.round((completed / totalLessons) * 100) : 0
    };
  }

  function formatCurrentDate() {
    const d = new Date();
    return `${dayMap[d.getDay()]}, ${d.getDate()} De ${monthNames[d.getMonth()]}`;
  }

  function renderDashboard() {
    els.currentDate.textContent = formatCurrentDate();
    renderToday();
    renderGeneralProgress();
    renderDisciplineCards();
  }

  function renderToday() {
    const today = dayMap[new Date().getDay()];
    const todayDisciplines = DATA.filter(d => String(d.day).trim() === today);
    els.todayCount.textContent = String(todayDisciplines.length);
    els.todayList.innerHTML = '';

    if (!todayDisciplines.length) {
      els.todayList.innerHTML = '<p class="empty-inline">Nenhuma disciplina programada para hoje.</p>';
      return;
    }

    const frag = document.createDocumentFragment();
    todayDisciplines.forEach(discipline => {
      const next = getNextLesson(discipline);
      const row = document.createElement('div');
      row.className = 'today-item';
      const lessonText = next ? next.title : 'Todas as aulas concluídas';
      row.innerHTML = `
        <span class="today-item__bar" aria-hidden="true"></span>
        <div>
          <strong class="today-item__title">${escapeHtml(discipline.name)}</strong>
          <span class="today-item__lesson">${escapeHtml(lessonText)}</span>
        </div>
        <span class="today-item__progress">${getCompletedCount(discipline)}/${discipline.totalLessons}</span>
      `;
      frag.appendChild(row);
    });
    els.todayList.appendChild(frag);
  }

  function renderGeneralProgress() {
    const t = totals();
    setDonut(els.generalDonut, t.percent);
    els.generalPercent.textContent = `${t.percent}%`;
    els.generalDonut.setAttribute('aria-label', `${t.percent}% do total concluído`);
    els.disciplineCount.textContent = String(t.disciplines);
    els.lessonCount.textContent = formatNumber(t.totalLessons);
    els.completedCount.textContent = formatNumber(t.completed);
    els.updateSummary.textContent = `${formatNumber(t.completed)} de ${formatNumber(t.totalLessons)} aulas concluídas`;
  }

  function renderDisciplineCards() {
    const sorted = [...DATA].sort((a, b) => {
      const diff = getPercent(b) - getPercent(a);
      return diff || a.name.localeCompare(b.name, 'pt-BR');
    });

    els.disciplineGrid.innerHTML = '';
    const frag = document.createDocumentFragment();
    sorted.forEach(discipline => {
      const percent = getPercent(discipline);
      const completed = getCompletedCount(discipline);
      const card = document.createElement('article');
      card.className = 'discipline-card';
      card.innerHTML = `
        <header class="discipline-card__header">
          <h3 class="discipline-card__title">${escapeHtml(discipline.name)}</h3>
          <span class="discipline-card__institution">${escapeHtml(discipline.institution)}</span>
        </header>
        <div class="discipline-card__chart">
          <div class="donut" style="--p:${percent}" role="img" aria-label="${percent}% concluído em ${escapeAttr(discipline.name)}">
            <div class="donut__center"><strong>${percent}%</strong><span>concluído</span></div>
          </div>
        </div>
        <footer class="discipline-card__footer">
          <span>${completed} de ${discipline.totalLessons} aulas</span>
          <span>${escapeHtml(String(discipline.day).trim())}</span>
        </footer>
      `;
      frag.appendChild(card);
    });
    els.disciplineGrid.appendChild(frag);
  }

  function renderUpdates(filter = '') {
    const q = normalize(filter);
    const filtered = DATA.filter(d => !q || normalize(`${d.name} ${d.institution} ${d.day}`).includes(q));
    els.updatesList.innerHTML = '';
    els.updatesEmpty.hidden = filtered.length !== 0;

    const frag = document.createDocumentFragment();
    filtered.forEach(discipline => frag.appendChild(buildUpdateDiscipline(discipline)));
    els.updatesList.appendChild(frag);
    renderGeneralProgress();
  }

  function buildUpdateDiscipline(discipline) {
    const details = document.createElement('details');
    details.className = 'update-discipline';
    details.dataset.disciplineId = discipline.id;

    const completed = getCompletedCount(discipline);
    const percent = getPercent(discipline);

    const summary = document.createElement('summary');
    summary.innerHTML = `
      <div>
        <div class="update-discipline__title">${escapeHtml(discipline.name)}</div>
        <div class="update-discipline__meta">${escapeHtml(discipline.institution)} · ${escapeHtml(String(discipline.day).trim())}</div>
      </div>
      <div class="mini-progress"><strong>${percent}%</strong><span>${completed}/${discipline.totalLessons} aulas</span></div>
      <span class="chevron" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 9l5 5 5-5"/></svg></span>
    `;

    const body = document.createElement('div');
    body.className = 'update-discipline__body';
    body.innerHTML = `
      <div class="update-discipline__actions">
        <button class="button button--secondary js-mark-all" type="button">${completed === discipline.totalLessons ? 'Desmarcar todas' : 'Marcar todas'}</button>
      </div>
      <div class="lessons-list"></div>
    `;

    const lessonsList = $('.lessons-list', body);
    const checked = completedSet(discipline.id);
    for (let n = 1; n <= discipline.totalLessons; n += 1) {
      const label = document.createElement('label');
      label.className = `lesson-row${checked.has(n) ? ' is-complete' : ''}`;
      const title = getLessonTitle(discipline, n);
      label.innerHTML = `
        <input type="checkbox" data-lesson="${n}" ${checked.has(n) ? 'checked' : ''} aria-label="Marcar ${escapeAttr(title)} como concluída">
        <span class="lesson-row__title">${escapeHtml(title)}</span>
        <span class="lesson-row__number">${n}/${discipline.totalLessons}</span>
      `;
      const checkbox = $('input', label);
      checkbox.addEventListener('change', (event) => onLessonToggle(event, discipline, n, label));
      lessonsList.appendChild(label);
    }

    $('.js-mark-all', body).addEventListener('click', () => {
      const ds = ensureDisciplineState(discipline.id);
      if (getCompletedCount(discipline) === discipline.totalLessons) {
        ds.completed = [];
        showToast(`${discipline.name}: aulas desmarcadas.`);
      } else {
        ds.completed = Array.from({ length: discipline.totalLessons }, (_, i) => i + 1);
        showToast(`${discipline.name}: todas as aulas concluídas.`);
      }
      saveState();
      refreshAfterProgressChange(discipline.id, true);
    });

    details.append(summary, body);
    return details;
  }

  function onLessonToggle(event, discipline, lessonNumber, label) {
    const checkbox = event.currentTarget;
    const ds = ensureDisciplineState(discipline.id);

    if (!checkbox.checked) {
      ds.completed = ds.completed.filter(n => n !== lessonNumber);
      label.classList.remove('is-complete');
      saveState();
      refreshAfterProgressChange(discipline.id, true);
      return;
    }

    const checked = completedSet(discipline.id);
    const hasEarlierGaps = lessonNumber > 1 && Array.from({ length: lessonNumber - 1 }, (_, i) => i + 1).some(n => !checked.has(n));

    if (hasEarlierGaps) {
      checkbox.checked = false;
      lastModalTrigger = checkbox;
      modalContext = { discipline, lessonNumber };
      els.modalDescription.textContent = `Você marcou ${getLessonTitle(discipline, lessonNumber)}. Deseja marcar também as aulas 1 a ${lessonNumber} como concluídas?`;
      openModal();
      return;
    }

    ds.completed = [...new Set([...ds.completed, lessonNumber])].sort((a, b) => a - b);
    label.classList.add('is-complete');
    saveState();
    refreshAfterProgressChange(discipline.id, true);
  }

  function refreshAfterProgressChange(openDisciplineId = null, preserveScroll = false) {
    const y = preserveScroll ? window.scrollY : 0;
    const filter = els.disciplineSearch.value;
    renderDashboard();
    if (currentView === 'updates') {
      renderUpdates(filter);
      if (openDisciplineId) {
        const target = els.updatesList.querySelector(`[data-discipline-id="${CSS.escape(openDisciplineId)}"]`);
        if (target) target.open = true;
      }
    }
    if (preserveScroll) requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
  }

  function openModal() {
    els.modal.hidden = false;
    els.modalBackdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => els.modalMarkRange.focus());
  }

  function closeModal({ restoreFocus = true } = {}) {
    els.modal.hidden = true;
    els.modalBackdrop.hidden = true;
    document.body.style.overflow = '';
    modalContext = null;
    if (restoreFocus && lastModalTrigger) lastModalTrigger.focus();
    lastModalTrigger = null;
  }

  function commitModal(mode) {
    if (!modalContext) return;
    const { discipline, lessonNumber } = modalContext;
    const ds = ensureDisciplineState(discipline.id);

    if (mode === 'range') {
      const range = Array.from({ length: lessonNumber }, (_, i) => i + 1);
      ds.completed = [...new Set([...ds.completed, ...range])].sort((a, b) => a - b);
      showToast(`${discipline.name}: aulas 1 a ${lessonNumber} concluídas.`);
    } else if (mode === 'single') {
      ds.completed = [...new Set([...ds.completed, lessonNumber])].sort((a, b) => a - b);
      showToast(`${getLessonTitle(discipline, lessonNumber)} marcada como concluída.`);
    }

    saveState();
    const id = discipline.id;
    closeModal({ restoreFocus: false });
    refreshAfterProgressChange(id, true);
  }

  function openDrawer() {
    els.drawer.classList.add('is-open');
    els.drawer.setAttribute('aria-hidden', 'false');
    els.drawerBackdrop.hidden = false;
    els.menuButton.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => els.closeDrawerButton.focus());
  }

  function closeDrawer() {
    els.drawer.classList.remove('is-open');
    els.drawer.setAttribute('aria-hidden', 'true');
    els.drawerBackdrop.hidden = true;
    els.menuButton.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    els.menuButton.focus({ preventScroll: true });
  }

  function switchView(view) {
    if (!['dashboard', 'updates'].includes(view)) return;
    currentView = view;
    const dashboard = view === 'dashboard';
    els.dashboardView.hidden = !dashboard;
    els.updatesView.hidden = dashboard;
    els.dashboardView.classList.toggle('is-active', dashboard);
    els.updatesView.classList.toggle('is-active', !dashboard);
    els.pageLabel.textContent = dashboard ? 'Dashboard' : 'Atualização das aulas';
    els.navItems.forEach(item => item.classList.toggle('is-active', item.dataset.view === view));
    if (!dashboard) renderUpdates(els.disciplineSearch.value);
    else renderDashboard();
    window.scrollTo({ top: 0, behavior: 'instant' });
    closeDrawer();
  }

  function updateTimerDisplay() {
    const minutes = Math.floor(timerRemaining / 60);
    const seconds = timerRemaining % 60;
    els.timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    els.timerToggle.textContent = 'Pausar';
    const endAt = Date.now() + timerRemaining * 1000;
    timerId = window.setInterval(() => {
      timerRemaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      updateTimerDisplay();
      if (timerRemaining <= 0) {
        pauseTimer();
        els.timerToggle.textContent = 'Iniciar novamente';
        showToast('Ciclo de foco concluído.');
      }
    }, 250);
  }

  function pauseTimer() {
    timerRunning = false;
    if (timerId) window.clearInterval(timerId);
    timerId = null;
    els.timerToggle.textContent = timerRemaining === 0 ? 'Iniciar novamente' : 'Iniciar';
  }

  function resetTimer() {
    pauseTimer();
    timerRemaining = TIMER_SECONDS;
    updateTimerDisplay();
    els.timerToggle.textContent = 'Iniciar';
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => els.toast.classList.remove('is-visible'), 2600);
  }

  function markEverything() {
    const t = totals();
    const allDone = t.completed === t.totalLessons && t.totalLessons > 0;
    const action = allDone ? 'desmarcar todas as aulas' : 'marcar todas as aulas como concluídas';
    if (!window.confirm(`Deseja ${action}?`)) return;
    DATA.forEach(d => {
      ensureDisciplineState(d.id).completed = allDone ? [] : Array.from({ length: d.totalLessons }, (_, i) => i + 1);
    });
    saveState();
    renderDashboard();
    renderUpdates(els.disciplineSearch.value);
    showToast(allDone ? 'Todas as aulas foram desmarcadas.' : 'Todas as aulas foram marcadas como concluídas.');
  }

  function setDonut(el, percent) {
    el.style.setProperty('--p', String(Math.max(0, Math.min(100, percent))));
  }

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function formatNumber(n) {
    return new Intl.NumberFormat('pt-BR').format(n);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  els.menuButton.addEventListener('click', openDrawer);
  els.closeDrawerButton.addEventListener('click', closeDrawer);
  els.drawerBackdrop.addEventListener('click', closeDrawer);
  els.navItems.forEach(item => item.addEventListener('click', () => switchView(item.dataset.view)));

  els.timerToggle.addEventListener('click', () => {
    if (timerRemaining === 0) resetTimer();
    timerRunning ? pauseTimer() : startTimer();
  });
  els.timerReset.addEventListener('click', resetTimer);

  els.disciplineSearch.addEventListener('input', (e) => renderUpdates(e.currentTarget.value));
  els.markEverythingButton.addEventListener('click', markEverything);

  els.modalMarkRange.addEventListener('click', () => commitModal('range'));
  els.modalMarkSingle.addEventListener('click', () => commitModal('single'));
  els.modalCancel.addEventListener('click', () => closeModal());
  els.modalCloseButton.addEventListener('click', () => closeModal());
  els.modalBackdrop.addEventListener('click', () => closeModal());

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!els.modal.hidden) closeModal();
    else if (els.drawer.classList.contains('is-open')) closeDrawer();
  });

  DATA.forEach(d => ensureDisciplineState(d.id));
  renderDashboard();
  updateTimerDisplay();
})();
