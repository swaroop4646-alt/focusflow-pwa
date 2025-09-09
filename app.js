// FocusFlow Premium — robust client-only PWA
const APP_KEY='focusflow_v5';
const SNAPSHOT_KEY='focusflow_snapshots_v2';
const CURRENT_VERSION=5;

let state={
  version:CURRENT_VERSION,
  createdAt:new Date().toISOString(),
  settings:{theme:'light', reminderEnabled:false, reminderTime:'20:00', hasOnboarded:false},
  habits:[],
  moodLog:[]
};

const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const todayStr=()=>new Date().toISOString().slice(0,10);
const uid=()=> (crypto.randomUUID?crypto.randomUUID(): 'id_'+Date.now()+Math.random().toString(16).slice(2));
const safeParse=(s,f)=>{try{return JSON.parse(s)}catch(e){return f}};

function loadState(){
  const raw=localStorage.getItem(APP_KEY);
  if(!raw){ saveState(); return state; }
  const parsed=safeParse(raw,null);
  if(!parsed){ saveState(); return state; }
  state={...state, ...parsed};
  if(!state.version || state.version<CURRENT_VERSION) migrateState(state.version||1);
  return state;
}
function migrateState(){
  state.habits = Array.isArray(state.habits)? state.habits.map(h=>({
    id: h.id||uid(),
    name: h.name||'Untitled',
    createdAt: h.createdAt || todayStr(),
    datesCompleted: Array.isArray(h.datesCompleted)? h.datesCompleted : (h.dates||[])
  })) : [];
  state.moodLog = Array.isArray(state.moodLog)? state.moodLog.map(m=>({date:m.date, mood:Number(m.mood)||3})) : [];
  state.settings = {...{theme:'light',reminderEnabled:false,reminderTime:'20:00',hasOnboarded:false}, ...(state.settings||{})};
  state.version = CURRENT_VERSION;
  saveState();
}
function saveState(){
  try{ localStorage.setItem(APP_KEY, JSON.stringify(state)); }catch(e){ console.error('Save failed',e); }
}

// Snapshots
function saveSnapshot(){
  const snaps=safeParse(localStorage.getItem(SNAPSHOT_KEY),[]);
  snaps.push({createdAt:new Date().toISOString(),snapshot:state});
  while(snaps.length>10) snaps.shift();
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snaps));
  toast('Snapshot saved locally.');
}
function downloadLastSnapshot(){
  const snaps=safeParse(localStorage.getItem(SNAPSHOT_KEY),[]);
  if(!snaps.length) return toast('No snapshot yet.');
  const last=snaps[snaps.length-1];
  const blob=new Blob([JSON.stringify(last,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='focusflow-snapshot-'+last.createdAt.replace(/[:.]/g,'-')+'.json';
  a.click();
  toast('Downloaded snapshot.');
}

// Export / Import
function exportExcel(){
  try{
    const wb=XLSX.utils.book_new();
    const habitsRows=state.habits.map(h=>({id:h.id,name:h.name,createdAt:h.createdAt,datesCompleted:(h.datesCompleted||[]).join(',')}));
    const moodRows=state.moodLog.map(m=>({date:m.date,mood:m.mood}));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(habitsRows), 'Habits');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(moodRows), 'Mood');
    XLSX.writeFile(wb,'focusflow-backup.xlsx');
  }catch(e){ toast('Export failed: '+(e.message||e)); }
}
function exportJSON(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='focusflow-backup.json';
  a.click();
  toast('Exported JSON.');
}
function importExcel(file){
  const reader=new FileReader();
  reader.onload=(e)=>{
    try{
      const data=new Uint8Array(e.target.result);
      const wb=XLSX.read(data,{type:'array'});
      const rowsHabits=XLSX.utils.sheet_to_json(wb.Sheets['Habits']||{});
      const rowsMood=XLSX.utils.sheet_to_json(wb.Sheets['Mood']||{});
      const byId=Object.fromEntries(state.habits.map(h=>[h.id,h]));
      const byName=Object.fromEntries(state.habits.map(h=>[h.name.toLowerCase(),h]));
      for(const r of rowsHabits){
        const name=String(r.name||'Untitled');
        const dates=String(r.datesCompleted||'').split(',').map(s=>s.trim()).filter(Boolean);
        let target=(r.id && byId[r.id])? byId[r.id] : byName[name.toLowerCase()];
        if(target){
          const merged=new Set([...(target.datesCompleted||[]), ...dates]);
          target.datesCompleted=Array.from(merged);
        }else{
          state.habits.push({id:r.id||uid(), name, createdAt:r.createdAt||todayStr(), datesCompleted:dates});
        }
      }
      const moodMap=Object.fromEntries(state.moodLog.map(m=>[m.date,m]));
      for(const m of rowsMood){ if(m.date) moodMap[m.date]={date:m.date, mood:Number(m.mood)||3}; }
      state.moodLog=Object.values(moodMap).sort((a,b)=>a.date.localeCompare(b.date));
      saveState(); render(); toast('Import merged.');
    }catch(err){ toast('Import error: '+(err.message||err)); }
  };
  reader.readAsArrayBuffer(file);
}

// UI helpers
let toastTimer=null;
function toast(msg){
  const t=$('#toast');
  t.textContent=msg;
  t.hidden=false;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.hidden=true, 2500);
}

// Habits
function computeStreak(dates){
  const set=new Set(dates||[]);
  let streak=0;
  for(let i=0;;i++){
    const d=new Date(); d.setDate(d.getDate()-i);
    const s=d.toISOString().slice(0,10);
    if(set.has(s)) streak++; else break;
  }
  return streak;
}
function renderHabits(){
  const list=$('#habitList'); list.innerHTML='';
  state.habits.forEach(h=>{
    const li=document.createElement('li'); li.className='item'; li.draggable=true; li.dataset.id=h.id;

    const left=document.createElement('div'); left.style.display='grid'; left.style.gap='.2rem';
    const name=document.createElement('div'); name.className='name'; name.textContent=h.name;
    const streak=document.createElement('div'); streak.className='streak'; streak.textContent='🔥 '+computeStreak(h.datesCompleted)+' day streak';
    left.append(name,streak);

    const btnDone=document.createElement('button'); btnDone.className='done';
    const doneToday=(h.datesCompleted||[]).includes(todayStr());
    btnDone.innerHTML='<img src="icons/check.svg" alt="done"> '+(doneToday?'Done':'Mark');
    btnDone.addEventListener('click',()=>toggleToday(h.id));

    const btnEdit=document.createElement('button'); btnEdit.innerHTML='<img src="icons/edit.svg" alt="edit">';
    btnEdit.addEventListener('click',()=>{ const n=prompt('Rename habit', h.name); if(n){ h.name=n.trim(); saveState(); render(); }});

    const btnDel=document.createElement('button'); btnDel.innerHTML='<img src="icons/trash.svg" alt="delete">';
    btnDel.addEventListener('click',()=>deleteHabit(h.id, h.name));

    li.append(left, btnDone, btnEdit, btnDel);
    list.appendChild(li);

    li.addEventListener('dragstart',()=>li.classList.add('dragging'));
    li.addEventListener('dragend',()=>li.classList.remove('dragging'));
    li.addEventListener('dragover',(e)=>{
      e.preventDefault();
      const dragging=list.querySelector('.dragging');
      if(!dragging) return;
      const items=Array.from(list.querySelectorAll('.item:not(.dragging)'));
      const after=items.find(item=> e.clientY <= item.getBoundingClientRect().top + item.getBoundingClientRect().height/2);
      if(!after) list.appendChild(dragging); else list.insertBefore(dragging, after);
    });
  });
  list.addEventListener('drop',()=>{
    const ids=[...document.querySelectorAll('#habitList .item')].map(li=>li.dataset.id);
    state.habits.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));
    saveState(); render();
  }, {once:true});
}
function deleteHabit(id, name){
  const removed=state.habits.find(h=>h.id===id);
  state.habits=state.habits.filter(x=>x.id!==id);
  saveState(); render();
  toast('Deleted "'+name+'". Tap to undo.');
  const t=$('#toast');
  t.onclick=()=>{ if(removed){ state.habits.push(removed); saveState(); render(); toast('Restored.'); t.onclick=null; } };
}
function toggleToday(id){
  const h=state.habits.find(x=>x.id===id); if(!h) return;
  const s=todayStr();
  const idx=(h.datesCompleted||[]).indexOf(s);
  if(idx>=0) h.datesCompleted.splice(idx,1); else h.datesCompleted.push(s);
  saveState(); render();
}
function addHabit(name){
  name=(name||'').trim(); if(!name) return;
  state.habits.push({id:uid(), name, createdAt:todayStr(), datesCompleted:[]});
  saveState(); render();
}

// Chart
let chart=null;
function renderChart(){
  const ctx=document.getElementById('historyChart');
  const labels=[]; const data=[];
  for(let i=29;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const s=d.toISOString().slice(0,10);
    labels.push(s.slice(5));
    let c=0; state.habits.forEach(h=>{ if((h.datesCompleted||[]).includes(s)) c++; });
    data.push(c);
  }
  if(chart) chart.destroy();
  chart=new Chart(ctx,{
    type:'bar',
    data:{ labels, datasets:[{ label:'Completed habits', data, backgroundColor:'#a5b4fc' }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false }}, scales:{ y:{ beginAtZero:true, ticks:{ precision:0 }}}}
  });
}

// Mood
function renderMood(){
  const log=state.moodLog.find(m=>m.date===todayStr());
  $$('#moodButtons button').forEach(b=>b.classList.remove('active'));
  if(log){
    const b=document.querySelector('#moodButtons button[data-mood="'+log.mood+'"]');
    if(b) b.classList.add('active');
    $('#moodStatus').textContent='Logged: '+['😞','☹️','😐','🙂','😄'][log.mood-1]+' ('+log.mood+'/5)';
  }else{
    $('#moodStatus').textContent='No mood logged yet today.';
  }
}

// Settings
function renderSettings(){
  $('#reminderEnabled').checked=!!state.settings.reminderEnabled;
  $('#reminderTime').value=state.settings.reminderTime||'20:00';
}

// Overall render
function render(){
  document.documentElement.classList.toggle('dark', state.settings.theme==='dark');
  $('#todayLabel').textContent=new Date().toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric'});
  renderHabits();
  renderChart();
  renderMood();
  renderSettings();
}

// Reminders
let reminderTimer=null;
function startReminderLoop(){ if(reminderTimer) clearInterval(reminderTimer); reminderTimer=setInterval(checkReminder, 30000); }
function checkReminder(){
  if(!state.settings.reminderEnabled) return;
  const [hh,mm]=(state.settings.reminderTime||'20:00').split(':').map(Number);
  const n=new Date();
  if(n.getHours()===hh && n.getMinutes()===mm){
    const key='reminded_'+todayStr();
    if(sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key,'1');
    if(Notification && Notification.permission==='granted'){
      navigator.serviceWorker.getRegistration().then(reg=>reg?.showNotification('FocusFlow reminder', { body:'Mark your habits & mood today.', icon:'./icons/icon-192.png' }));
    }else toast('Reminder: mark your habits & mood today.');
  }
}

// Network status
function updateOfflineBadge(){ $('#offlineBadge').hidden = navigator.onLine; }

// About / Onboarding
function maybeShowOnboarding(){ if(!state.settings.hasOnboarded){ $('#onboarding').showModal(); } }

// Events
document.addEventListener('DOMContentLoaded',()=>{
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
  window.addEventListener('online', updateOfflineBadge);
  window.addEventListener('offline', updateOfflineBadge);
  updateOfflineBadge();

  loadState(); render(); startReminderLoop();
  maybeShowOnboarding();

  $('#btnAdd').addEventListener('click',()=>{ addHabit($('#habitName').value); $('#habitName').value=''; });
  $('#habitName').addEventListener('keydown',e=>{ if(e.key==='Enter'){ addHabit($('#habitName').value); $('#habitName').value=''; } });

  $$('#moodButtons button').forEach(b=> b.addEventListener('click', ()=>{
    state.moodLog = state.moodLog.filter(m=>m.date!==todayStr());
    state.moodLog.push({date:todayStr(), mood:Number(b.dataset.mood)});
    saveState(); renderMood(); toast('Mood saved.');
  }));

  $('#btnTheme').addEventListener('click',()=>{ state.settings.theme = state.settings.theme==='dark'?'light':'dark'; saveState(); render(); });

  $('#btnAskNotification').addEventListener('click', async ()=>{
    try{ const r=await Notification.requestPermission(); toast('Permission: '+r); } catch(_){ toast('Notifications not supported'); }
  });
  $('#reminderEnabled').addEventListener('change', e=>{ state.settings.reminderEnabled=e.target.checked; saveState(); });
  $('#reminderTime').addEventListener('change', e=>{ state.settings.reminderTime=e.target.value||'20:00'; saveState(); });

  $('#btnExportXLSX').addEventListener('click', exportExcel);
  $('#btnExportJSON').addEventListener('click', exportJSON);
  $('#fileImportXLSX').addEventListener('change', e=>{ const f=e.target.files[0]; if(f) importExcel(f); e.target.value=''; });
  $('#btnSnapshot').addEventListener('click', saveSnapshot);
  $('#btnDownloadSnapshot').addEventListener('click', downloadLastSnapshot);

  let deferredPrompt=null;
  window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredPrompt=e; $('#btnInstall').disabled=false; });
  $('#btnInstall').addEventListener('click', async ()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $('#btnInstall').disabled=true; });

  $('#btnAbout').addEventListener('click', ()=> $('#onboarding').showModal() );
  $('#onboarding').addEventListener('close', ()=>{ state.settings.hasOnboarded=true; saveState(); });
});

