
// FocusFlow — Habit & Mood Tracker (offline-first, Excel backup, edit/reorder, theme, reminders)
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const today = new Date();
const todayStr = formatDate(today);

let state = {
  habits: [],
  moodLog: [],
  settings: { theme: 'dark', reminderEnabled: false, reminderTime: '20:00' },
  createdAt: todayStr,
  version: 2
};

function loadState() {
  try {
    const raw = localStorage.getItem('focusflow');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && typeof data === 'object') {
      state = Object.assign(state, data);
      state.settings = Object.assign({ theme: 'dark', reminderEnabled: false, reminderTime: '20:00' }, data.settings || {});
    }
  } catch (e) {
    console.error("Failed to load state", e);
  }
}

function saveState() {
  try {
    localStorage.setItem('focusflow', JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state", e);
  }
}

// ----- Utils -----
function formatDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

function computeStreak(datesCompleted) {
  let streak = 0;
  const set = new Set(datesCompleted);
  for (let i = 0; ; i++) {
    const d = daysAgo(i);
    if (set.has(d)) streak++;
    else break;
  }
  return streak;
}

// ----- Rendering -----
function render() {
  document.documentElement.classList.toggle('light', state.settings.theme === 'light');
  $('#todayLabel').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  renderHabits();
  renderMood();
  renderChart();
  renderSettings();
}

function renderHabits() {
  const list = $('#habitList');
  list.innerHTML = '';
  state.habits.forEach((h, idx) => {
    const li = document.createElement('li');
    li.className = 'item';
    li.draggable = true;
    li.dataset.id = h.id;
    li.dataset.index = idx;

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = h.name;

    const streak = document.createElement('div');
    streak.className = 'streak';
    streak.textContent = `🔥 ${computeStreak(h.datesCompleted)} day streak`;

    const btnDone = document.createElement('button');
    btnDone.className = 'btn done';
    const doneToday = h.datesCompleted.includes(todayStr);
    if (doneToday) btnDone.classList.add('doneToday');
    btnDone.textContent = doneToday ? 'Done ✓' : 'Mark done';
    btnDone.addEventListener('click', () => toggleToday(h.id));

    const btnEdit = document.createElement('button');
    btnEdit.className = 'icon';
    btnEdit.title = 'Rename';
    btnEdit.textContent = '✏️';
    btnEdit.addEventListener('click', () => renameHabit(h.id));

    const btnDelete = document.createElement('button');
    btnDelete.className = 'icon';
    btnDelete.title = 'Delete';
    btnDelete.style.color = 'var(--danger)';
    btnDelete.textContent = '🗑️';
    btnDelete.addEventListener('click', () => {
      if (confirm(`Delete "${h.name}"?`)) {
        state.habits = state.habits.filter(x => x.id !== h.id);
        saveState(); render();
      }
    });

    const left = document.createElement('div');
    left.style.display = 'grid';
    left.style.gap = '.25rem';
    left.append(name, streak);

    li.append(left, btnDone, btnEdit, btnDelete);
    list.appendChild(li);

    // Drag & drop events
    li.addEventListener('dragstart', () => li.classList.add('dragging'));
    li.addEventListener('dragend', () => li.classList.remove('dragging'));
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragging = list.querySelector('.dragging');
      if (!dragging) return;
      const items = [...list.querySelectorAll('.item:not(.dragging)')];
      const after = items.find(item => e.clientY <= item.getBoundingClientRect().top + item.getBoundingClientRect().height/2);
      if (after == null) list.appendChild(dragging);
      else list.insertBefore(dragging, after);
    });
  });

  // Persist new order after drag
  list.addEventListener('drop', () => {
    const ids = $$('#habitList .item').map(li => li.dataset.id);
    state.habits.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    saveState(); render(); // re-render to refresh indices
  }, { once: true });
}

function renameHabit(id) {
  const h = state.habits.find(x => x.id === id);
  if (!h) return;
  const newName = prompt('New name:', h.name);
  if (newName == null) return;
  const name = newName.trim();
  if (!name) return;
  h.name = name;
  saveState(); render();
}

function renderMood() {
  const log = state.moodLog.find(m => m.date === todayStr);
  const buttons = $$('#moodButtons button');
  buttons.forEach(b => b.classList.remove('active'));
  if (log) {
    const active = buttons.find(b => Number(b.dataset.mood) === log.mood);
    if (active) active.classList.add('active');
    $('#moodStatus').textContent = `Logged today: ${['😞','☹️','😐','🙂','😄'][log.mood-1]} (${log.mood}/5)`;
  } else {
    $('#moodStatus').textContent = 'No mood logged yet today.';
  }
}

let chart;
function renderChart() {
  const ctx = document.getElementById('historyChart');
  const labels = [];
  const counts = [];
  for (let i = 29; i >= 0; i--) {
    const d = daysAgo(i);
    labels.push(d.slice(5)); // MM-DD
    let count = 0;
    state.habits.forEach(h => {
      if (h.datesCompleted.includes(d)) count++;
    });
    counts.push(count);
  }
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Habits done', data: counts }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, title: { display: false } },
      scales: { x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } }, y: { beginAtZero: true, precision: 0 } }
    }
  });
}

// ----- Actions -----
function addHabit(name) {
  name = name.trim();
  if (!name) return;
  const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  state.habits.push({ id, name, createdAt: todayStr, datesCompleted: [] });
  saveState();
  $('#habitName').value = '';
  render();
}

function toggleToday(id) {
  const h = state.habits.find(x => x.id === id);
  if (!h) return;
  const idx = h.datesCompleted.indexOf(todayStr);
  if (idx >= 0) h.datesCompleted.splice(idx, 1);
  else h.datesCompleted.push(todayStr);
  saveState();
  render();
}

function setMood(mood) {
  let entry = state.moodLog.find(m => m.date === todayStr);
  if (!entry) state.moodLog.push({ date: todayStr, mood });
  else entry.mood = mood;
  saveState(); renderMood();
}

// ----- Excel Export / Import -----
function exportExcel() {
  const habitsRows = state.habits.map(h => ({
    id: h.id, name: h.name, createdAt: h.createdAt, datesCompleted: (h.datesCompleted || []).join(',')
  }));
  const moodRows = state.moodLog.map(m => ({ date: m.date, mood: m.mood }));
  const metaRows = [{ key: 'createdAt', value: state.createdAt }, { key: 'version', value: state.version }, { key: 'exportedAt', value: new Date().toISOString() }];

  const wb = XLSX.utils.book_new();
  const wsHabits = XLSX.utils.json_to_sheet(habitsRows);
  const wsMood = XLSX.utils.json_to_sheet(moodRows);
  const wsMeta = XLSX.utils.json_to_sheet(metaRows);

  XLSX.utils.book_append_sheet(wb, wsHabits, 'Habits');
  XLSX.utils.book_append_sheet(wb, wsMood, 'Mood');
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Meta');

  XLSX.writeFile(wb, 'focusflow-backup.xlsx');
}

function importExcel(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const toJSON = (sheetName) => XLSX.utils.sheet_to_json(wb.Sheets[sheetName] || {});

      const habitsRows = toJSON('Habits');
      const moodRows = toJSON('Mood');

      const habits = (habitsRows || []).map(r => ({
        id: r.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
        name: String(r.name || 'Untitled'),
        createdAt: r.createdAt || todayStr,
        datesCompleted: String(r.datesCompleted || '').split(',').map(s => s.trim()).filter(Boolean)
      }));

      const moodLog = (moodRows || []).map(r => ({ date: r.date, mood: Number(r.mood) || 3 }))
        .filter(m => m.date);

      if (!Array.isArray(habits)) throw new Error('Invalid Habits sheet');
      state.habits = habits;
      state.moodLog = moodLog;
      saveState(); render();
      alert('Import successful!');
    } catch (err) {
      console.error(err);
      alert('Import failed: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ----- Settings (theme, reminders) -----
function renderSettings() {
  $('#reminderEnabled').checked = !!state.settings.reminderEnabled;
  $('#reminderTime').value = state.settings.reminderTime || '20:00';
}

function toggleTheme() {
  state.settings.theme = (state.settings.theme === 'dark') ? 'light' : 'dark';
  saveState(); render();
}

async function askNotificationPermission() {
  try {
    const res = await Notification.requestPermission();
    alert('Notification permission: ' + res);
  } catch (e) {
    alert('Your browser does not support notifications.');
  }
}

// Poll for reminder while app is open
let reminderTimer = null;
function startReminderLoop() {
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = setInterval(checkReminder, 30000); // every 30s
}
function checkReminder() {
  if (!state.settings.reminderEnabled) return;
  const t = state.settings.reminderTime || '20:00';
  const [hh, mm] = t.split(':').map(Number);
  const now = new Date();
  if (now.getHours() === hh && now.getMinutes() === mm) {
    const key = 'reminded-' + formatDate(now);
    if (sessionStorage.getItem(key)) return; // once per day per session
    sessionStorage.setItem(key, '1');
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      navigator.serviceWorker?.getRegistration()?.then(reg => {
        reg?.showNotification('FocusFlow reminder', {
          body: 'Mark your habits and mood for today.',
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png'
        });
      });
    } else {
      alert('Reminder: Mark your habits and mood for today.');
    }
  }
}

// ----- PWA install prompt -----
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('#installPrompt').classList.remove('hidden');
});
$('#btnInstall')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  $('#installPrompt').classList.add('hidden');
  deferredPrompt = null;
});

// ----- Event bindings -----
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  render();
  startReminderLoop();

  $('#btnAdd').addEventListener('click', () => addHabit($('#habitName').value));
  $('#habitName').addEventListener('keydown', (e) => { if (e.key === 'Enter') addHabit($('#habitName').value); });

  $('#btnExportXLSX').addEventListener('click', exportExcel);
  $('#fileImportXLSX').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (file) importExcel(file); e.target.value='';
  });

  $$('#moodButtons button').forEach(btn => btn.addEventListener('click', () => setMood(Number(btn.dataset.mood))));

  $('#btnTheme').addEventListener('click', toggleTheme);
  $('#reminderEnabled').addEventListener('change', (e) => { state.settings.reminderEnabled = e.target.checked; saveState(); });
  $('#reminderTime').addEventListener('change', (e) => { state.settings.reminderTime = e.target.value || '20:00'; saveState(); });
  $('#btnAskNotification').addEventListener('click', askNotificationPermission);
});
