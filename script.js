import { createClient } from '@supabase/supabase-js';
import Chart from 'chart.js/auto';
import '@fortawesome/fontawesome-free/css/all.min.css';

// ─── SETUP ────────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || '';

let db = null;
let dbReady = false;
let currentUser = null;
let repayLoanId = null;
let adminChart = null;
let loanChart = null;
let limitDoughnut = null;

try {
  if(SUPABASE_URL && SUPABASE_KEY) {
    db = createClient(SUPABASE_URL, SUPABASE_KEY);
    dbReady = true;
  }
} catch(e) { console.warn('Supabase init failed', e); }

// ─── LOCAL CACHE ──────────────────────────────────────────────────────
let localData = { users:[], loans:[], repayments:[], notifications:[] };

async function syncAll() {
  if(!dbReady) return;
  const [u, l, r, n] = await Promise.all([
    db.from('users').select('*'),
    db.from('loans').select('*'),
    db.from('repayments').select('*'),
    db.from('notifications').select('*')
  ]);
  localData.users        = u.data || [];
  localData.loans        = l.data || [];
  localData.repayments   = r.data || [];
  localData.notifications= n.data || [];
}

// ─── HELPERS ──────────────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
}
function showLoader(){ document.getElementById('loader').classList.remove('hidden'); }
function hideLoader(){ document.getElementById('loader').classList.add('hidden'); }

function toast(msg, type='info', dur=3500) {
  const t = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = {success:'fa-circle-check',error:'fa-circle-exclamation',info:'fa-circle-info'};
  el.innerHTML = `<i class="fa-solid ${icons[type]||icons.info}"></i> ${msg}`;
  t.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(20px)'; el.style.transition='.3s'; setTimeout(()=>el.remove(),300); }, dur);
}

function fmt(n){ return '₱'+Number(n).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtDate(d){ if(!d) return '—'; return new Date(d).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}); }
function fmtDateTime(d){ if(!d) return '—'; return new Date(d).toLocaleString('en-PH',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function addDays(date,days){ const d=new Date(date); d.setDate(d.getDate()+days); return d.toISOString(); }

function showAlert(id,msg){ const el=document.getElementById(id); el.classList.add('show'); if(msg) el.querySelector('span').textContent=msg; }
function hideAlert(id){ document.getElementById(id)?.classList.remove('show'); }
function toggleSidebar(id){
  const sidebar = document.getElementById(id);
  sidebar.classList.toggle('open');
  // Toggle overlay
  const overlayId = id === 'adminSidebar' ? 'adminOverlay' : 'userOverlay';
  const overlay = document.getElementById(overlayId);
  if(overlay) overlay.classList.toggle('show', sidebar.classList.contains('open'));
}

function toggleCollapse(id){
  const sidebar = document.getElementById(id);
  sidebar.classList.toggle('collapsed');
  fixDashLayout();
}function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
function toggleNotifPanel(id){
  document.querySelectorAll('.notif-panel').forEach(p=>{ if(p.id!==id) p.classList.remove('open'); });
  document.getElementById(id).classList.toggle('open');
}
function closeNotif(id){ document.getElementById(id).classList.remove('open'); }

function togglePass(id, el) {
  const inp = document.getElementById(id);
  const span = el.closest('.pass-toggle') || el;
  const icon = span.querySelector('i') || span;
  if(inp.type==='password'){
    inp.type='text';
    icon.className='fa-solid fa-eye-slash';
  } else {
    inp.type='password';
    icon.className='fa-solid fa-eye';
  }
}

// Event delegation for all password toggles — more reliable than inline onclick
document.addEventListener('click', (e) => {
  const toggle = e.target.closest('.pass-toggle');
  if(!toggle) return;
  const inputId = toggle.dataset.target;
  if(!inputId) return;
  const inp = document.getElementById(inputId);
  const icon = toggle.querySelector('i');
  if(!inp || !icon) return;
  if(inp.type==='password'){ inp.type='text'; icon.className='fa-solid fa-eye-slash'; }
  else { inp.type='password'; icon.className='fa-solid fa-eye'; }
});

function statusBadge(s) {
  const map = { approved:'badge-success',active:'badge-success',disbursed:'badge-info',pending:'badge-warning',declined:'badge-danger',rejected:'badge-danger',overdue:'badge-danger',paid:'badge-muted' };
  const icons = { approved:'fa-check',active:'fa-circle-dot',disbursed:'fa-money-bill-transfer',pending:'fa-clock',declined:'fa-xmark',rejected:'fa-xmark',overdue:'fa-triangle-exclamation',paid:'fa-check-double' };
  return `<span class="badge ${map[s]||'badge-muted'}"><i class="fa-solid ${icons[s]||'fa-circle'}"></i> ${s?.charAt(0).toUpperCase()+s?.slice(1)}</span>`;
}

function detail(label,val){
  return `<div class="glass2" style="padding:12px 16px;border-radius:10px">
    <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:3px">${label}</div>
    <div style="font-size:.88rem">${val||'—'}</div>
  </div>`;
}

// ─── SCROLL ANIMATION ─────────────────────────────────────────────────
const nav = document.getElementById('mainNav');
window.addEventListener('scroll',()=>{
  nav.classList.toggle('scrolled', window.scrollY>60);
  document.querySelectorAll('.fade-up').forEach(el=>{ if(el.getBoundingClientRect().top<window.innerHeight-60) el.classList.add('visible'); });
});
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{ document.querySelectorAll('.fade-up').forEach(el=>{ if(el.getBoundingClientRect().top<window.innerHeight-60) el.classList.add('visible'); }); },100);
});

// ─── BRUTE FORCE ──────────────────────────────────────────────────────
const MAX_ATTEMPTS = 3;
const LOCK_MS = 60000;

function getBF(email){ try{ return JSON.parse(localStorage.getItem(`bf_${email}`))||{attempts:0,lockUntil:null}; }catch{ return {attempts:0,lockUntil:null}; } }
function setBF(email,s){ localStorage.setItem(`bf_${email}`,JSON.stringify(s)); }
function resetBF(email){ localStorage.removeItem(`bf_${email}`); }
function isLocked(email){
  const s=getBF(email);
  if(s.lockUntil && Date.now()<s.lockUntil) return s.lockUntil;
  if(s.lockUntil && Date.now()>=s.lockUntil) resetBF(email);
  return false;
}
function recordFail(email){
  const s=getBF(email);
  s.attempts=(s.attempts||0)+1;
  if(s.attempts>=MAX_ATTEMPTS) s.lockUntil=Date.now()+LOCK_MS;
  setBF(email,s); return s;
}
function startCountdown(email){
  const span=document.querySelector('#loginError span');
  const iv=setInterval(()=>{
    const lu=getBF(email)?.lockUntil;
    if(!lu||Date.now()>=lu){ clearInterval(iv); resetBF(email); hideAlert('loginError'); return; }
    const secs=Math.ceil((lu-Date.now())/1000);
    if(span) span.textContent=`Too many attempts. Try again after ${secs} seconds.`;
  },1000);
}

// ─── SESSION ──────────────────────────────────────────────────────────
function saveSession(user){ localStorage.setItem('ds_session', JSON.stringify(user)); }
function loadSession(){ try{ return JSON.parse(localStorage.getItem('ds_session')); }catch{ return null; } }
function clearSession(){ localStorage.removeItem('ds_session'); }

// ─── LOGIN ────────────────────────────────────────────────────────────
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass  = document.getElementById('loginPassword').value;
  hideAlert('loginError'); hideAlert('loginSuccess');
  if(!email||!pass){ showAlert('loginError','Please fill in all fields'); return; }

  const lockUntil = isLocked(email);
  if(lockUntil){
    const secs=Math.ceil((lockUntil-Date.now())/1000);
    showAlert('loginError',`Too many attempts. Try again after ${secs} seconds.`);
    startCountdown(email); return;
  }

  const btn=document.getElementById('loginBtn');
  btn.disabled=true; btn.innerHTML='<div class="spinner"></div> Signing in...';

  if(!dbReady){
    btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-right-to-bracket"></i> Sign In';
    showAlert('loginError','Database not configured.'); return;
  }

  const { data: profile, error } = await db.from('users').select('*').eq('email',email).maybeSingle();
  btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-right-to-bracket"></i> Sign In';

  if(error||!profile||profile.password!==pass){
    const s=recordFail(email);
    const rem=MAX_ATTEMPTS-s.attempts;
    if(s.lockUntil){ showAlert('loginError','Too many attempts. Try again after 60 seconds.'); startCountdown(email); }
    else { showAlert('loginError',`Incorrect email or password. ${rem} attempt${rem===1?'':'s'} remaining.`); }
    return;
  }

  if(profile.status==='pending'){ showAlert('loginError','Your account is waiting for admin approval.'); return; }
  if(profile.status==='rejected'||profile.status==='declined'){ showAlert('loginError','Your account has been rejected. Contact admin.'); return; }
  if(profile.status!=='approved'){ showAlert('loginError','Your account is not active. Contact admin.'); return; }

  resetBF(email);
  currentUser = profile;
  saveSession(profile);

  if(profile.role==='admin'){
    showPage('adminDash');
    await loadAdminDashboard();
    fixDashLayout();
    toast(`Welcome back, ${profile.first_name}!`,'success');
  } else {
    afterUserLogin(profile);
    await loadUserDashboard();
  }
}

function afterUserLogin(user){
  document.getElementById('sidebarUserName').textContent=`${user.first_name} ${user.last_name}`;
  document.getElementById('sidebarUserEmail').textContent=user.email;
  document.getElementById('userAvatarInitial').textContent=(user.first_name||'U')[0].toUpperCase();
  document.getElementById('pendingApprovalAlert').style.display='none';
  showPage('userDash');
  fixDashLayout();
  toast(`Welcome back, ${user.first_name}!`,'success');
}

function handleLogout(){
  currentUser=null; clearSession();
  showPage('landing');
  toast('Logged out successfully','info');
}

function guardDashboard(){
  const active=document.querySelector('.page.active')?.id;
  if((active==='userDash'||active==='adminDash')&&!currentUser) showPage('login');
}

function fixDashLayout(){
  // Force correct margin on all dash-main elements
  document.querySelectorAll('.dash-main').forEach(main => {
    const sidebar = main.previousElementSibling;
    if(sidebar && sidebar.classList.contains('sidebar')){
      const w = sidebar.classList.contains('collapsed') ? '72px' : '240px';
      main.style.marginLeft = w;
      main.style.width = `calc(100% - ${w})`;
    }
  });
}

// ─── REGISTER ─────────────────────────────────────────────────────────
let currentStep=1;

function nextStep(from){ if(!validateStep(from)) return; goToStep(from+1); }
function prevStep(from){ goToStep(from-1); }

function goToStep(n){
  document.getElementById(`stepContent${currentStep}`).classList.remove('active');
  document.getElementById(`stepContent${n}`).classList.add('active');
  document.querySelectorAll('.step').forEach(s=>{
    const sn=parseInt(s.dataset.step);
    s.classList.remove('active','done');
    if(sn<n) s.classList.add('done');
    else if(sn===n) s.classList.add('active');
  });
  currentStep=n; hideAlert('regError');
}

function validateStep(n){
  hideAlert('regError');
  if(n===1){
    const f=id=>document.getElementById(id).value.trim();
    if(!f('regFirstName')||!f('regLastName')||!f('regGender')||!f('regContact')||!f('regEmail')||!f('regAddress')){
      showAlert('regError','Please fill in all required fields'); return false;
    }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f('regEmail'))){
      showAlert('regError','Please enter a valid email address'); return false;
    }
    const pw=document.getElementById('regPassword').value;
    if(pw.length<8){ showAlert('regError','Password must be at least 8 characters'); return false; }
    if(!/[A-Z]/.test(pw)||!/[0-9]/.test(pw)){ showAlert('regError','Password must contain at least one uppercase letter and one number'); return false; }
    if(pw!==document.getElementById('regConfirmPassword').value){ showAlert('regError','Passwords do not match'); return false; }
  }
  if(n===2){
    if(!document.getElementById('regJobType').value||!document.getElementById('regSalary').value){
      showAlert('regError','Please fill in job type and monthly salary'); return false;
    }
  }
  if(n===3){
    if(!document.getElementById('regIdType').value){ showAlert('regError','Please select a valid ID type'); return false; }
  }
  return true;
}

function handleFileUpload(input,zoneId,hiddenId){
  const zone=document.getElementById(zoneId); const file=input.files[0];
  if(file){
    document.getElementById(hiddenId).value=file.name;
    zone.classList.add('has-file');
    zone.querySelector('p').textContent=`✓ ${file.name}`;
    zone.querySelector('i').className='fa-solid fa-circle-check';
  }
}

async function submitRegistration(){
  if(!validateStep(3)) return;
  const btn=document.getElementById('sendOtpBtn');
  btn.disabled=true; btn.innerHTML='<div class="spinner"></div> Submitting...';

  if(!dbReady){ showAlert('regError','Database not configured.'); btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-paper-plane"></i> Submit Application'; return; }

  const email=document.getElementById('regEmail').value.trim().toLowerCase();
  const { data: existing }=await db.from('users').select('id').eq('email',email).maybeSingle();
  if(existing){ showAlert('regError','An account with this email already exists.'); btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-paper-plane"></i> Submit Application'; return; }

  // Upload files to Supabase Storage
  const userId = uid();
  let idFrontUrl='', idBackUrl='', payslipUrl='';

  const idFrontInput = document.querySelector('#idFrontZone input[type=file]');
  const idBackInput  = document.querySelector('#idBackZone input[type=file]');
  const payslipInput = document.querySelector('#payslipZone input[type=file]');

  async function uploadFile(file, path){
    if(!file) return '';
    const { data, error } = await db.storage.from('user-documents').upload(path, file, {upsert:true});
    if(error){ console.warn('Upload error:', error); return ''; }
    return db.storage.from('user-documents').getPublicUrl(path).data.publicUrl;
  }

  btn.innerHTML='<div class="spinner"></div> Uploading documents...';
  if(idFrontInput?.files[0]) idFrontUrl = await uploadFile(idFrontInput.files[0], `${userId}/id-front`);
  if(idBackInput?.files[0])  idBackUrl  = await uploadFile(idBackInput.files[0],  `${userId}/id-back`);
  if(payslipInput?.files[0]) payslipUrl = await uploadFile(payslipInput.files[0], `${userId}/payslip`);

  btn.innerHTML='<div class="spinner"></div> Saving profile...';

  const newUser={
    id: userId,
    first_name: document.getElementById('regFirstName').value.trim(),
    last_name:  document.getElementById('regLastName').value.trim(),
    middle_name:document.getElementById('regMiddleName').value.trim(),
    gender:     document.getElementById('regGender').value,
    contact:    document.getElementById('regContact').value.trim(),
    email,
    address:    document.getElementById('regAddress').value.trim(),
    password:   document.getElementById('regPassword').value,
    job_type:   document.getElementById('regJobType').value,
    employer:   document.getElementById('regEmployer').value.trim(),
    salary:     document.getElementById('regSalary').value,
    id_type:    document.getElementById('regIdType').value,
    id_front_url: idFrontUrl,
    id_back_url:  idBackUrl,
    payslip_url:  payslipUrl,
    status:     'pending',
    role:       'user',
    created_at: new Date().toISOString()
  };

  const { error }=await db.from('users').insert([newUser]);
  if(error){ showAlert('regError', error.message||'Failed to save profile.'); btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-paper-plane"></i> Submit Application'; return; }

  await db.from('notifications').insert([{ id:uid(), target:'admin', message:`New application: ${newUser.first_name} ${newUser.last_name} (${email})`, created_at:new Date().toISOString(), read:false }]);

  btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-paper-plane"></i> Submit Application';
  toast('Application submitted! Please wait for admin approval before logging in.','success',6000);
  setTimeout(()=>showPage('login'),2500);
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────
function adminView(view,el){
  ['dashboard','users','loans','active','overdue','repayments','settings'].forEach(v=>{
    const vEl=document.getElementById(`adminView-${v}`);
    if(vEl) vEl.style.display=v===view?'block':'none';
  });
  document.querySelectorAll('#adminSidebar .sidebar-nav a').forEach(a=>a.classList.remove('active'));
  if(el) el.classList.add('active');
  const titles={dashboard:'Dashboard',users:'User Management',loans:'Loan Requests',active:'Active Loans',overdue:'Overdue Loans',repayments:'Repayments',settings:'Payment Settings'};
  document.getElementById('adminTopTitle').textContent=titles[view]||view;
  if(view==='users') renderAdminUsers();
  else if(view==='loans') renderAdminLoans();
  else if(view==='active') renderAdminActive();
  else if(view==='overdue') renderAdminOverdue();
  else if(view==='repayments') renderAdminRepayments();
  else if(view==='settings') loadSettingsForm();
}

async function loadAdminDashboard(){
  await syncAll();
  const users=localData.users.filter(u=>u.role!=='admin');
  const loans=localData.loans;
  const total=users.length;
  const approved=users.filter(u=>u.status==='approved').length;
  const declined=users.filter(u=>u.status==='rejected'||u.status==='declined').length;
  const pending=users.filter(u=>u.status==='pending').length;
  const loanReqs=loans.filter(l=>l.status==='pending').length;

  document.getElementById('stat-total').textContent=total;
  document.getElementById('stat-approved').textContent=approved;
  document.getElementById('stat-declined').textContent=declined;
  document.getElementById('stat-pending').textContent=pending;
  document.getElementById('stat-loanreqs').textContent=loanReqs;
  document.getElementById('adminNotifDot').style.display=(pending>0||loanReqs>0)?'block':'none';

  renderAdminNotifications();
  renderRecentLoans();
  renderAdminCharts(approved,declined,pending);
}

function renderAdminCharts(approved,declined,pending){
  const c1=document.getElementById('adminChart');
  const c2=document.getElementById('loanChart');
  if(adminChart) adminChart.destroy();
  if(loanChart) loanChart.destroy();
  adminChart=new Chart(c1,{type:'bar',data:{labels:['Approved','Declined','Pending'],datasets:[{data:[approved,declined,pending],backgroundColor:['rgba(0,229,160,.7)','rgba(255,77,109,.7)','rgba(255,184,0,.7)'],borderColor:['rgba(0,229,160,1)','rgba(255,77,109,1)','rgba(255,184,0,1)'],borderWidth:1.5,borderRadius:6}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#7baac8',font:{size:11}}},x:{grid:{display:false},ticks:{color:'#7baac8',font:{size:11}}}}}});
  const loans=localData.loans;
  loanChart=new Chart(c2,{type:'doughnut',data:{labels:['Active','Disbursed','Overdue','Pending'],datasets:[{data:[loans.filter(l=>l.status==='active').length,loans.filter(l=>l.status==='disbursed').length,loans.filter(l=>l.status==='overdue').length,loans.filter(l=>l.status==='pending').length],backgroundColor:['rgba(0,212,255,.7)','rgba(0,229,160,.7)','rgba(255,77,109,.7)','rgba(255,184,0,.7)'],borderColor:'rgba(0,0,0,0)',hoverOffset:8}]},options:{responsive:true,cutout:'65%',plugins:{legend:{position:'bottom',labels:{color:'#7baac8',font:{size:11},padding:14}}}}});
}

function renderRecentLoans(){
  const body=document.getElementById('recentLoansBody');
  const loans=localData.loans.slice(-8).reverse();
  if(!loans.length){ body.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">No loan requests yet</td></tr>'; return; }
  body.innerHTML=loans.map(l=>{
    const user=localData.users.find(u=>u.id===l.user_id)||{first_name:'Unknown',last_name:''};
    return `<tr><td><strong>${user.first_name} ${user.last_name}</strong></td><td>${fmt(l.amount)}</td><td>${fmtDate(l.created_at)}</td><td>${statusBadge(l.status)}</td>
    <td>${l.status==='pending'?`<button class="btn btn-success btn-xs" style="margin-right:4px" onclick="approveLoan('${l.id}')">Approve</button><button class="btn btn-danger btn-xs" onclick="declineLoan('${l.id}')">Decline</button>`:'—'}</td></tr>`;
  }).join('');
}

function renderAdminNotifications(){
  const list=document.getElementById('adminNotifList');
  const notifs=localData.notifications.filter(n=>n.target==='admin').slice(-10).reverse();
  if(!notifs.length){ list.innerHTML='<div style="padding:20px;text-align:center;font-size:.82rem;color:var(--text-muted)">No notifications</div>'; return; }
  list.innerHTML=notifs.map(n=>`<div class="notif-item"><div class="notif-ico" style="background:rgba(0,212,255,.1);color:var(--neon)"><i class="fa-solid fa-bell"></i></div><div class="notif-txt"><p>${n.message}</p><small>${fmtDate(n.created_at)}</small></div></div>`).join('');
}

function renderAdminUsers(){
  const body=document.getElementById('adminUsersBody');
  const users=localData.users.filter(u=>u.role!=='admin');
  document.getElementById('userCountBadge').textContent=`${users.length} Users`;
  if(!users.length){ body.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px">No registered users</td></tr>'; return; }
  body.innerHTML=users.map(u=>`<tr>
    <td><strong>${u.first_name} ${u.last_name}</strong><div style="font-size:.72rem;color:var(--text-muted)">${u.gender||''}</div></td>
    <td class="hide-mobile">${u.email}</td>
    <td class="hide-mobile">${u.contact||'—'}</td>
    <td class="hide-tablet" style="font-size:.82rem">${u.job_type||'—'}</td>
    <td class="hide-tablet">${u.salary?fmt(u.salary):'—'}</td>
    <td>${statusBadge(u.status)}</td>
    <td>
      <button class="btn btn-ghost btn-xs" style="margin-right:4px" onclick="viewUserDetail('${u.id}')">View</button>
      ${u.status==='pending'?`<button class="btn btn-success btn-xs" style="margin-right:4px" onclick="approveUser('${u.id}')">Approve</button><button class="btn btn-danger btn-xs" onclick="declineUser('${u.id}')">Reject</button>`:''}
    </td>
  </tr>`).join('');
}

function renderAdminLoans(){
  const body=document.getElementById('adminLoansBody');
  const loans=[...localData.loans].reverse();
  if(!loans.length){ body.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px">No loan requests</td></tr>'; return; }
  body.innerHTML=loans.map(l=>{
    const user=localData.users.find(u=>u.id===l.user_id)||{first_name:'Unknown',last_name:''};
    const withdrawal = l.withdrawal_method ? `
      <div style="margin-top:4px;font-size:.72rem;padding:4px 8px;background:rgba(0,212,255,.08);border-radius:6px;border:1px solid rgba(0,212,255,.15);display:inline-block">
        <i class="fa-solid fa-money-bill-transfer" style="color:var(--neon)"></i>
        <strong style="color:var(--neon)">${l.withdrawal_method}</strong>
        ${l.withdrawal_account !== 'N/A' ? `· ${l.withdrawal_account} · ${l.withdrawal_name}` : ''}
      </div>` : '';
    return `<tr>
      <td><strong>${user.first_name} ${user.last_name}</strong>${withdrawal}</td>
      <td>${fmt(l.amount)}</td><td>${fmt(l.interest)}</td>
      <td><strong style="color:var(--neon)">${fmt(l.total)}</strong></td>
      <td style="font-size:.75rem;color:var(--text-muted)">
        <div>Requested: <span style="color:var(--text-secondary)">${fmtDateTime(l.created_at)}</span></div>
        ${l.approved_at?`<div>Approved: <span style="color:var(--success)">${fmtDateTime(l.approved_at)}</span></div>`:''}
        ${l.declined_at?`<div>Declined: <span style="color:var(--danger)">${fmtDateTime(l.declined_at)}</span></div>`:''}
      </td>
      <td>${statusBadge(l.status)}</td>
      <td>${l.status==='pending'?`<button class="btn btn-success btn-xs" style="margin-right:4px" onclick="approveLoan('${l.id}')">Approve</button><button class="btn btn-danger btn-xs" onclick="declineLoan('${l.id}')">Decline</button>`:'—'}</td>
    </tr>`;
  }).join('');
}

function renderAdminActive(){
  const body=document.getElementById('adminActiveBody');
  const loans=localData.loans.filter(l=>l.status==='active'||l.status==='disbursed');
  if(!loans.length){ body.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">No active loans</td></tr>'; return; }
  body.innerHTML=loans.map(l=>{
    const user=localData.users.find(u=>u.id===l.user_id)||{first_name:'Unknown',last_name:''};
    return `<tr><td><strong>${user.first_name} ${user.last_name}</strong></td><td>${fmt(l.amount)}</td><td>${fmt(l.interest)}</td><td><strong>${fmt(l.total)}</strong></td>
    <td style="font-size:.75rem;color:var(--text-muted)">
      <div>Approved: <span style="color:var(--success)">${fmtDateTime(l.approved_at||l.disbursed_at)}</span></div>
    </td>
    <td style="font-size:.82rem;color:var(--warning)">${fmtDate(l.due_date)}</td>
    <td>${statusBadge(l.status)}</td></tr>`;
  }).join('');
}

function renderAdminOverdue(){
  const body=document.getElementById('adminOverdueBody');
  const loans=localData.loans.filter(l=>l.status==='overdue');
  if(!loans.length){ body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">No overdue loans</td></tr>'; return; }
  body.innerHTML=loans.map(l=>{
    const user=localData.users.find(u=>u.id===l.user_id)||{first_name:'Unknown',last_name:''};
    const penalty=l.amount*0.05; const totalDue=l.total+penalty;
    const daysDue=Math.floor((Date.now()-new Date(l.due_date))/86400000);
    return `<tr><td><strong>${user.first_name} ${user.last_name}</strong></td><td>${fmt(l.amount)}</td><td>${fmt(l.interest)}</td><td style="color:var(--danger)">${fmt(penalty)}</td><td><strong style="color:var(--danger)">${fmt(totalDue)}</strong></td><td><span class="badge badge-danger">${daysDue}d overdue</span></td></tr>`;
  }).join('');
}

// ─── ADMIN ACTIONS ────────────────────────────────────────────────────
async function approveUser(id){
  const now=new Date().toISOString();
  const { data, error } = await db.from('users').update({status:'approved'}).eq('id',id).select();
  console.log('approveUser result:', {data, error, id});
  if(error){ toast('Failed: '+error.message,'error'); return; }
  if(!data || data.length===0){ 
    toast('No rows updated — check if id matches','error'); 
    console.warn('No rows updated for id:', id);
    return; 
  }
  await db.from('notifications').insert([{id:uid(),target:id,message:'Your account has been approved! You can now apply for a loan.',created_at:now,read:false}]);
  toast('User approved!','success');
  await syncAll();
  renderAdminUsers();
  await loadAdminDashboard();
}

async function declineUser(id){
  const now=new Date().toISOString();
  const { data, error } = await db.from('users').update({status:'rejected'}).eq('id',id).select();
  console.log('declineUser result:', {data, error, id});
  if(error){ toast('Failed: '+error.message,'error'); return; }
  if(!data || data.length===0){ 
    toast('No rows updated — check if id matches','error'); 
    return; 
  }
  await db.from('notifications').insert([{id:uid(),target:id,message:'Your account application was rejected. Please contact support.',created_at:now,read:false}]);
  toast('User rejected.','error');
  await syncAll();
  renderAdminUsers();
  await loadAdminDashboard();
}

function viewUserDetail(id){
  const u=localData.users.find(u=>u.id===id); if(!u) return;
  document.getElementById('modalUserTitle').textContent=`${u.first_name} ${u.last_name}`;

  const imgStyle='width:100%;border-radius:10px;border:1px solid var(--border-soft);margin-top:6px;cursor:pointer;';
  const imgSection = (u.id_front_url||u.id_back_url||u.payslip_url) ? `
    <div style="margin-top:16px">
      <div style="font-size:.72rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Uploaded Documents</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${u.id_front_url?`<div><div style="font-size:.72rem;color:var(--text-muted);margin-bottom:4px">ID Front</div><a href="${u.id_front_url}" target="_blank"><img src="${u.id_front_url}" alt="ID Front" style="${imgStyle}"></a></div>`:''}
        ${u.id_back_url?`<div><div style="font-size:.72rem;color:var(--text-muted);margin-bottom:4px">ID Back</div><a href="${u.id_back_url}" target="_blank"><img src="${u.id_back_url}" alt="ID Back" style="${imgStyle}"></a></div>`:''}
      </div>
      ${u.payslip_url?`<div style="margin-top:10px"><div style="font-size:.72rem;color:var(--text-muted);margin-bottom:4px">Payslip</div><a href="${u.payslip_url}" target="_blank"><img src="${u.payslip_url}" alt="Payslip" style="${imgStyle}" onerror="this.style.display='none';this.nextSibling.style.display='flex'"><div style="display:none;align-items:center;gap:8px;padding:12px;background:rgba(0,212,255,.06);border-radius:8px;border:1px solid var(--border-soft)"><i class='fa-solid fa-file-pdf' style='color:var(--neon)'></i><a href='${u.payslip_url}' target='_blank' style='color:var(--neon);font-size:.85rem'>View Payslip PDF</a></div></a></div>`:''}
    </div>` : '';

  document.getElementById('modalUserContent').innerHTML=`
    <div class="form-row" style="margin-bottom:16px">
      <div class="glass2" style="padding:16px;border-radius:12px"><div style="font-size:.72rem;color:var(--text-muted)">Status</div><div style="margin-top:6px">${statusBadge(u.status)}</div></div>
      <div class="glass2" style="padding:16px;border-radius:12px"><div style="font-size:.72rem;color:var(--text-muted)">Registered</div><div style="font-size:.88rem;margin-top:6px">${fmtDate(u.created_at)}</div></div>
    </div>
    <div style="display:grid;gap:10px">
      ${detail('Email',u.email)}${detail('Contact',u.contact)}${detail('Gender',u.gender)}
      ${detail('Address',u.address)}${detail('Job Type',u.job_type)}${detail('Employer',u.employer||'—')}
      ${detail('Monthly Salary',u.salary?fmt(u.salary):'—')}${detail('ID Type',u.id_type||'—')}
    </div>
    ${imgSection}
    ${u.status==='pending'?`<div style="display:flex;gap:10px;margin-top:20px">
      <button class="btn btn-success" style="flex:1;justify-content:center" onclick="approveUser('${u.id}');closeModal('userDetailModal')">Approve</button>
      <button class="btn btn-danger" style="flex:1;justify-content:center" onclick="declineUser('${u.id}');closeModal('userDetailModal')">Reject</button>
    </div>`:''}`;
  openModal('userDetailModal');
}

async function approveLoan(lid){
  const now=new Date().toISOString();
  const dueDate=addDays(new Date(),30);
  const { data, error } = await db.from('loans')
    .update({status:'active', disbursed_at:now, due_date:dueDate})
    .eq('id',lid).select();
  console.log('approveLoan:', {data, error, lid});
  if(error){ toast('Failed: '+error.message,'error'); return; }
  if(!data||data.length===0){ toast('No rows updated — RLS may be blocking update','error'); return; }
  const l=localData.loans.find(l=>l.id===lid);
  if(l) await db.from('notifications').insert([{id:uid(),target:l.user_id,message:`Your loan of ${fmt(l.amount)} has been approved and is now active!`,created_at:now,read:false}]);
  toast('Loan approved!','success');
  await syncAll();
  renderAdminLoans();
  await loadAdminDashboard();
}

async function declineLoan(lid){
  const now=new Date().toISOString();
  const { data, error } = await db.from('loans')
    .update({status:'declined'})
    .eq('id',lid).select();
  if(error){ toast('Failed: '+error.message,'error'); return; }
  const l=localData.loans.find(l=>l.id===lid);
  if(l) await db.from('notifications').insert([{id:uid(),target:l.user_id,message:`Your loan request of ${fmt(l.amount)} was declined.`,created_at:now,read:false}]);
  toast('Loan declined.','error');
  await syncAll();
  renderAdminLoans();
  await loadAdminDashboard();
}

function renderAdminRepayments(){
  const body=document.getElementById('adminRepaymentsBody');
  const reps=[...localData.repayments].reverse();
  if(!reps.length){ body.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px">No repayments yet</td></tr>'; return; }
  body.innerHTML=reps.map(r=>{
    const user=localData.users.find(u=>u.id===r.user_id)||{first_name:'Unknown',last_name:''};
    const isPending=r.payment_status==='pending_verification';
    const proofBtn = r.proof_url ? `<a href="${r.proof_url}" target="_blank" class="btn btn-ghost btn-xs"><i class="fa-solid fa-image"></i> View</a>` : 'N/A';
    const statusCol = isPending ? `<span class="badge badge-warning"><i class="fa-solid fa-clock"></i> Pending</span>` : statusBadge('paid');
    const actionCol = isPending ? `<button class="btn btn-success btn-xs" onclick="verifyRepayment('${r.id}','${r.loan_id}')">Verify</button>` : 'N/A';
    return `<tr>
      <td><strong>${user.first_name} ${user.last_name}</strong></td>
      <td><strong style="color:var(--success)">${fmt(r.amount)}</strong></td>
      <td>${r.method||'N/A'}</td>
      <td style="font-size:.82rem">${r.reference_number||'N/A'}</td>
      <td style="font-size:.78rem;color:var(--text-muted)">${fmtDateTime(r.created_at)}</td>
      <td>${proofBtn}</td>
      <td>${statusCol}</td>
      <td>${actionCol}</td>
    </tr>`;
  }).join('');
}

async function verifyRepayment(repId, loanId){
  await db.from('repayments').update({payment_status:'verified'}).eq('id',repId);
  await db.from('loans').update({status:'paid'}).eq('id',loanId);
  const r=localData.repayments.find(r=>r.id===repId);
  if(r) await db.from('notifications').insert([{id:uid(),target:r.user_id,message:`Your payment of ${fmt(r.amount)} has been verified. Loan marked as paid!`,created_at:new Date().toISOString(),read:false}]);
  toast('Payment verified!','success');
  await syncAll(); renderAdminRepayments();
}

async function loadSettingsForm(){
  if(!dbReady) return;
  const { data }=await db.from('settings').select('*');
  if(!data) return;
  const s=Object.fromEntries(data.map(r=>[r.key,r.value]));
  document.getElementById('set-gcash-number').value      = s.gcash_number||'';
  document.getElementById('set-gcash-name').value        = s.gcash_name||'';
  document.getElementById('set-bank-name').value         = s.bank_name||'';
  document.getElementById('set-bank-account').value      = s.bank_account||'';
  document.getElementById('set-bank-account-name').value = s.bank_account_name||'';
}

async function savePaymentSettings(){
  const updates=[
    {key:'gcash_number',      value:document.getElementById('set-gcash-number').value.trim()},
    {key:'gcash_name',        value:document.getElementById('set-gcash-name').value.trim()},
    {key:'bank_name',         value:document.getElementById('set-bank-name').value.trim()},
    {key:'bank_account',      value:document.getElementById('set-bank-account').value.trim()},
    {key:'bank_account_name', value:document.getElementById('set-bank-account-name').value.trim()},
  ];
  for(const u of updates){ await db.from('settings').upsert({key:u.key,value:u.value,updated_at:new Date().toISOString()}); }
  toast('Payment settings saved!','success');
}

function filterAdminTable(){
  document.querySelectorAll('#adminUsersBody tr, #adminLoansBody tr').forEach(row=>{
    row.style.display=row.textContent.toLowerCase().includes(q)?'':'none';
  });
}

// ─── USER DASHBOARD ───────────────────────────────────────────────────
function userView(view,el){
  ['overview','request','disbursed','active','overdue','repayment'].forEach(v=>{
    const vEl=document.getElementById(`userView-${v}`);
    if(vEl) vEl.style.display=v===view?'block':'none';
  });
  document.querySelectorAll('#userSidebar .sidebar-nav a').forEach(a=>a.classList.remove('active'));
  if(el) el.classList.add('active');
  const titles={overview:'Overview',request:'Request a Loan',disbursed:'Disbursed Loans',active:'Active Loans',overdue:'Overdue Loans',repayment:'Repayment History'};
  document.getElementById('userTopTitle').textContent=titles[view]||view;
  if(view==='disbursed') renderDisbursed();
  if(view==='active') renderActive();
  if(view==='overdue') renderOverdue();
  if(view==='repayment') renderRepayments();
  if(view==='request') updateMaxLoan();
}

async function loadUserDashboard(){
  if(!currentUser) return;
  await syncAll();
  updateLimitDisplay();
  renderUserLoans();
  renderUserNotifications();
  renderLimitChart();
}

function getUserLoans(){ return localData.loans.filter(l=>l.user_id===currentUser.id); }
function getUsedLimit(){ return getUserLoans().filter(l=>['active','disbursed','overdue'].includes(l.status)).reduce((s,l)=>s+Number(l.amount),0); }

function updateLimitDisplay(){
  const used=getUsedLimit(); const remain=Math.max(0,15000-used); const pct=Math.round(used/150);
  document.getElementById('usedLimit').textContent=fmt(used);
  document.getElementById('remainLimit').textContent=fmt(remain);
  document.getElementById('totalLoansCount').textContent=getUserLoans().length;
  document.getElementById('limitUsedDetail').textContent=fmt(used);
  document.getElementById('limitAvailDetail').textContent=fmt(remain);
  document.getElementById('limitPct').textContent=pct+'%';
}

function renderLimitChart(){
  const used=getUsedLimit(); const remain=Math.max(0,15000-used);
  const ctx=document.getElementById('limitDoughnut').getContext('2d');
  if(limitDoughnut) limitDoughnut.destroy();
  limitDoughnut=new Chart(ctx,{type:'doughnut',data:{labels:['Used','Available'],datasets:[{data:[used,remain],backgroundColor:['rgba(255,77,109,.7)','rgba(0,212,255,.2)'],borderColor:['rgba(255,77,109,1)','rgba(0,212,255,.4)'],borderWidth:1.5}]},options:{responsive:true,cutout:'72%',plugins:{legend:{display:false}},animation:{duration:600}}});
}

function renderUserLoans(){
  const body=document.getElementById('userLoansBody');
  const loans=getUserLoans().slice(-5).reverse();
  if(!loans.length){ body.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;font-size:.85rem">No loans yet. <a href="#" onclick="userView(\'request\',null)" style="color:var(--neon)">Apply now →</a></td></tr>'; return; }
  body.innerHTML=loans.map(l=>`<tr>
    <td>${fmt(l.amount)}</td>
    <td><strong style="color:var(--neon)">${fmt(l.total)}</strong></td>
    <td style="font-size:.78rem;color:var(--text-muted)">${fmtDateTime(l.created_at)}</td>
    <td style="font-size:.8rem">${fmtDate(l.due_date)||'—'}</td>
    <td>${statusBadge(l.status)}</td>
  </tr>`).join('');
}

function renderUserNotifications(){
  const list=document.getElementById('userNotifList');
  const notifs=localData.notifications.filter(n=>n.target===currentUser.id).slice(-10).reverse();
  document.getElementById('userNotifDot').style.display=notifs.length?'block':'none';
  if(!notifs.length){ list.innerHTML='<div style="padding:20px;text-align:center;font-size:.82rem;color:var(--text-muted)">No notifications</div>'; return; }
  list.innerHTML=notifs.map(n=>{
    const isGood=n.message.includes('approved');
    return `<div class="notif-item"><div class="notif-ico" style="background:${isGood?'rgba(0,229,160,.1)':'rgba(255,77,109,.1)'};color:${isGood?'var(--success)':'var(--danger)'}"><i class="fa-solid ${isGood?'fa-circle-check':'fa-circle-exclamation'}"></i></div><div class="notif-txt"><p style="font-size:.82rem">${n.message}</p><small>${fmtDate(n.created_at)}</small></div></div>`;
  }).join('');
}

function calcLoanPreview(){
  const amt=parseFloat(document.getElementById('loanAmount').value)||0;
  const interest=amt*0.20; const total=amt+interest;
  document.getElementById('prev-principal').textContent=fmt(amt);
  document.getElementById('prev-interest').textContent=fmt(interest);
  document.getElementById('prev-total').textContent=fmt(total);
}

function updateMaxLoan(){
  const remain=Math.max(0,15000-getUsedLimit());
  document.getElementById('maxLoanDisplay').textContent=fmt(remain);
  document.getElementById('loanAmount').max=remain;
}

function toggleWithdrawalDetails(){
  const method = document.getElementById('withdrawalMethod').value;
  const details = document.getElementById('withdrawalDetails');
  const label = document.getElementById('withdrawalAccountLabel');
  if(!method || method === 'Cash Pickup'){
    details.style.display = 'none'; return;
  }
  details.style.display = 'block';
  const ewallet = ['GCash','Maya (PayMaya)','ShopeePay','GrabPay'];
  label.textContent = ewallet.includes(method)
    ? 'Mobile Number *'
    : 'Account Number *';
}

async function submitLoanRequest(){
  const amt = parseFloat(document.getElementById('loanAmount').value)||0;
  const purpose = document.getElementById('loanPurpose').value.trim();
  const withdrawalMethod = document.getElementById('withdrawalMethod').value;
  const withdrawalAccount = document.getElementById('withdrawalAccount')?.value.trim();
  const withdrawalName = document.getElementById('withdrawalName')?.value.trim();
  const maxAllowed = Math.max(0, 15000 - getUsedLimit());
  const errEl = document.getElementById('loanReqError');
  errEl.style.display = 'none';

  if(!currentUser){ toast('Please log in again','error'); return; }
  if(currentUser.status !== 'approved'){
    errEl.style.display='flex'; document.getElementById('loanReqErrorMsg').textContent='Your account must be approved before requesting a loan.'; return;
  }
  if(amt < 500){
    errEl.style.display='flex'; document.getElementById('loanReqErrorMsg').textContent='Minimum loan amount is ₱500'; return;
  }
  if(amt > maxAllowed){
    errEl.style.display='flex'; document.getElementById('loanReqErrorMsg').textContent=`Maximum allowed is ${fmt(maxAllowed)}`; return;
  }
  if(!withdrawalMethod){
    errEl.style.display='flex'; document.getElementById('loanReqErrorMsg').textContent='Please select a withdrawal method'; return;
  }
  if(withdrawalMethod !== 'Cash Pickup' && (!withdrawalAccount || !withdrawalName)){
    errEl.style.display='flex'; document.getElementById('loanReqErrorMsg').textContent='Please fill in your account details'; return;
  }

  const btn = document.getElementById('submitLoanBtn');
  btn.disabled=true; btn.innerHTML='<div class="spinner"></div> Submitting...';

  const interest = amt * 0.20; const total = amt + interest;
  const loan = {
    id: uid(), user_id: currentUser.id, amount: amt,
    interest, total, purpose, status: 'pending',
    withdrawal_method: withdrawalMethod,
    withdrawal_account: withdrawalAccount || 'N/A',
    withdrawal_name: withdrawalName || 'N/A',
    created_at: new Date().toISOString(), due_date: null, disbursed_at: null
  };

  const { error } = await db.from('loans').insert([loan]);
  if(error){ toast('Failed to submit loan request.','error'); btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-paper-plane"></i> Submit Loan Request'; return; }

  await db.from('notifications').insert([{
    id: uid(), target: 'admin',
    message: `New loan request from ${currentUser.first_name} ${currentUser.last_name}: ${fmt(amt)} via ${withdrawalMethod}`,
    created_at: new Date().toISOString(), read: false
  }]);

  btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-paper-plane"></i> Submit Loan Request';
  toast('Loan request submitted! Waiting for admin approval.','success');
  document.getElementById('loanAmount').value='';
  document.getElementById('loanPurpose').value='';
  document.getElementById('withdrawalMethod').value='';
  document.getElementById('withdrawalDetails').style.display='none';
  calcLoanPreview();
  await loadUserDashboard();
}

function renderDisbursed(){
  const body=document.getElementById('disbursedBody');
  const loans=getUserLoans().filter(l=>l.status==='disbursed'||l.status==='active'||l.status==='overdue');
  if(!loans.length){ body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">No disbursed loans yet</td></tr>'; return; }
  body.innerHTML=loans.map(l=>`<tr><td>${fmt(l.amount)}</td><td>${fmt(l.interest)}</td><td><strong>${fmt(l.total)}</strong></td><td style="font-size:.8rem">${fmtDate(l.disbursed_at)||'—'}</td><td style="font-size:.8rem;color:var(--warning)">${fmtDate(l.due_date)||'—'}</td><td>${statusBadge(l.status)}</td></tr>`).join('');
}

function renderActive(){
  const body=document.getElementById('activeBody');
  const loans=getUserLoans().filter(l=>l.status==='active');
  if(!loans.length){ body.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">No active loans</td></tr>'; return; }
  body.innerHTML=loans.map(l=>`<tr><td>${fmt(l.amount)}</td><td>${fmt(l.interest)}</td><td><strong style="color:var(--neon)">${fmt(l.total)}</strong></td><td style="font-size:.8rem;color:var(--warning)">${fmtDate(l.due_date)}</td><td><button class="btn btn-primary btn-xs" onclick="openRepayModal('${l.id}')">Repay</button></td></tr>`).join('');
}

function renderOverdue(){
  const now=Date.now();
  const body=document.getElementById('overdueBody');
  const loans=getUserLoans().filter(l=>l.status==='overdue');
  if(!loans.length){ body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">No overdue loans 🎉</td></tr>'; return; }
  body.innerHTML=loans.map(l=>{
    const penalty=l.amount*0.05; const totalDue=l.total+penalty;
    const daysDue=Math.floor((now-new Date(l.due_date))/86400000);
    return `<tr><td>${fmt(l.amount)}</td><td>${fmt(l.interest)}</td><td style="color:var(--danger)">${fmt(penalty)}</td><td><strong style="color:var(--danger)">${fmt(totalDue)}</strong></td><td><span class="badge badge-danger">${daysDue}d</span></td><td><button class="btn btn-danger btn-xs" onclick="openRepayModal('${l.id}')">Pay Now</button></td></tr>`;
  }).join('');
}

function renderRepayments(){
  const body=document.getElementById('repaymentBody');
  const reps=localData.repayments.filter(r=>r.user_id===currentUser.id).reverse();
  if(!reps.length){ body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">No repayments recorded yet</td></tr>'; return; }
  body.innerHTML=reps.map(r=>`<tr>
    <td style="font-size:.8rem;color:var(--text-muted)">${r.loan_id?.slice(-6)||'—'}</td>
    <td><strong style="color:var(--success)">${fmt(r.amount)}</strong></td>
    <td style="font-size:.78rem;color:var(--text-muted)">${fmtDateTime(r.created_at)}</td>
    <td>${r.method||'—'}</td>
    <td style="font-size:.78rem">${r.reference_number||'—'}</td>
    <td>
      ${r.proof_url?`<a href="${r.proof_url}" target="_blank" class="btn btn-ghost btn-xs"><i class="fa-solid fa-image"></i> View</a>`:'—'}
    </td>
    <td>
      ${r.payment_status==='pending_verification'
        ? `<span class="badge badge-warning"><i class="fa-solid fa-clock"></i> Verifying</span>`
        : statusBadge('paid')}
    </td>
  </tr>`).join('');
}

function handleProofUpload(input){
  const zone = document.getElementById('proofZone');
  const file = input.files[0];
  if(file){
    document.getElementById('proofFile').value = file.name;
    zone.classList.add('has-file');
    zone.querySelector('p').textContent = `✓ ${file.name}`;
    zone.querySelector('i').className = 'fa-solid fa-circle-check';
  }
}

async function loadPaymentDetails(){
  if(!dbReady) return;
  const { data } = await db.from('settings').select('*');
  if(!data) return;
  const s = Object.fromEntries(data.map(r=>[r.key, r.value]));
  document.getElementById('pd-gcash-number').textContent = s.gcash_number || '—';
  document.getElementById('pd-gcash-name').textContent   = s.gcash_name   || '';
  document.getElementById('pd-bank-name').textContent    = s.bank_name    || 'Bank';
  document.getElementById('pd-bank-account').textContent = s.bank_account || '—';
  document.getElementById('pd-bank-account-name').textContent = s.bank_account_name || '';
}

function openRepayModal(lid){
  repayLoanId=lid;
  const loan=localData.loans.find(l=>l.id===lid); if(!loan) return;
  const penalty=loan.status==='overdue'?loan.amount*0.05:0;
  document.getElementById('repayAmount').value=(loan.total+penalty).toFixed(2);
  // Reset form
  document.getElementById('repayMethod').value='';
  document.getElementById('repayReference').value='';
  document.getElementById('proofFile').value='';
  document.getElementById('repayError').style.display='none';
  const zone=document.getElementById('proofZone');
  zone.classList.remove('has-file');
  zone.querySelector('p').textContent='Click to upload screenshot of payment';
  zone.querySelector('i').className='fa-solid fa-camera';
  loadPaymentDetails();
  openModal('repayModal');
}

async function submitRepayment(){
  const amt    = parseFloat(document.getElementById('repayAmount').value)||0;
  const method = document.getElementById('repayMethod').value;
  const ref    = document.getElementById('repayReference').value.trim();
  const proofInput = document.querySelector('#proofZone input[type=file]');
  const errEl  = document.getElementById('repayError');
  errEl.style.display='none';

  if(!method){ errEl.style.display='flex'; document.getElementById('repayErrorMsg').textContent='Please select a payment method'; return; }
  if(!ref){ errEl.style.display='flex'; document.getElementById('repayErrorMsg').textContent='Please enter the reference number'; return; }
  if(!proofInput?.files[0]){ errEl.style.display='flex'; document.getElementById('repayErrorMsg').textContent='Please upload payment screenshot'; return; }
  if(!amt||!repayLoanId){ toast('Invalid repayment','error'); return; }

  const btn = document.querySelector('#repayModal .btn-primary');
  btn.disabled=true; btn.innerHTML='<div class="spinner"></div> Submitting...';

  // Upload proof image
  let proofUrl='';
  const proofFile = proofInput.files[0];
  const proofPath = `${currentUser.id}/proof-${Date.now()}`;
  const { data: uploadData, error: uploadError } = await db.storage.from('user-documents').upload(proofPath, proofFile, {upsert:true});
  if(!uploadError) proofUrl = db.storage.from('user-documents').getPublicUrl(proofPath).data.publicUrl;

  const rep={
    id:uid(), loan_id:repayLoanId, user_id:currentUser.id,
    amount:amt, method, reference_number:ref,
    proof_url:proofUrl, payment_status:'pending_verification',
    created_at:new Date().toISOString()
  };

  const { error } = await db.from('repayments').insert([rep]);
  if(error){ toast('Failed to submit: '+error.message,'error'); btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-paper-plane"></i> Submit Payment'; return; }

  // Notify admin
  await db.from('notifications').insert([{
    id:uid(), target:'admin',
    message:`Payment submitted by ${currentUser.first_name} ${currentUser.last_name} — ${fmt(amt)} via ${method} (Ref: ${ref})`,
    created_at:new Date().toISOString(), read:false
  }]);

  btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-paper-plane"></i> Submit Payment';
  closeModal('repayModal');
  toast(`Payment of ${fmt(amt)} submitted for verification!`,'success');
  await loadUserDashboard();
}

// ─── INIT ─────────────────────────────────────────────────────────────
window.addEventListener('load', async () => {
  await new Promise(r=>setTimeout(r,1200));
  hideLoader();

  // Register service worker for PWA
  if('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/loanapp/sw.js').catch(()=>{});
  }

  // Restore session
  const saved=loadSession();
  if(saved){
    currentUser=saved;
    if(saved.role==='admin'){
      showPage('adminDash');
      await loadAdminDashboard();
      fixDashLayout();
    } else {
      afterUserLogin(saved);
      await loadUserDashboard();
    }
  } else {
    guardDashboard();
  }
});

document.addEventListener('click',(e)=>{
  if(!e.target.closest('.notif-panel')&&!e.target.closest('.notif-btn'))
    document.querySelectorAll('.notif-panel').forEach(p=>p.classList.remove('open'));
  if(!e.target.closest('.sidebar')&&!e.target.closest('.mobile-toggle-inline')&&!e.target.closest('.sidebar-overlay')){
    document.querySelectorAll('.sidebar').forEach(s=>s.classList.remove('open'));
    document.querySelectorAll('.sidebar-overlay').forEach(o=>o.classList.remove('show'));
  }

  // Ripple on sidebar nav links
  const navItem = e.target.closest('.sidebar-nav a, .sidebar-nav button');
  if(navItem){
    const ripple = document.createElement('span');
    const rect = navItem.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.className = 'ripple';
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
    navItem.appendChild(ripple);
    setTimeout(()=>ripple.remove(), 500);
  }
});

// ─── GLOBAL EXPORTS ───────────────────────────────────────────────────
Object.assign(window, {
  showPage, togglePass, handleLogin, handleLogout,
  nextStep, prevStep, handleFileUpload, submitRegistration,
  adminView, toggleSidebar, toggleCollapse, toggleNotifPanel, closeNotif,
  filterAdminTable, approveUser, declineUser, viewUserDetail,
  approveLoan, declineLoan, verifyRepayment, savePaymentSettings,
  userView, calcLoanPreview, toggleWithdrawalDetails, submitLoanRequest,
  openRepayModal, closeModal, submitRepayment, handleProofUpload,
});
