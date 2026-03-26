import { createClient } from '@supabase/supabase-js';
import Chart from 'chart.js/auto';
import '@fortawesome/fontawesome-free/css/all.min.css';

// ─── supabaseClient SETUP ──────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'YOUR_SUPABASE_ANON_KEY';

let supabaseClient = null;
let supabaseAvailable = false;
let currentUser = null;
let currentUserData = null;
let repayLoanId = null;
let adminChart = null;
let loanChart = null;
let limitDoughnut = null;

// In-memory data store (used when supabaseClient not configured)
let localData = {
  users: JSON.parse(localStorage.getItem('ls_users') || '[]'),
  loans: JSON.parse(localStorage.getItem('ls_loans') || '[]'),
  repayments: JSON.parse(localStorage.getItem('ls_repayments') || '[]'),
  notifications: JSON.parse(localStorage.getItem('ls_notifications') || '[]')
};

async function syncDataFromSupabase() {
  if(!supabaseAvailable) return;
  const [{ data: users }, { data: loans }, { data: repayments }, { data: notifications }] = await Promise.all([
    supabaseClient.from('users').select('*'),
    supabaseClient.from('loans').select('*'),
    supabaseClient.from('repayments').select('*'),
    supabaseClient.from('notifications').select('*')
  ]);
  localData.users = users || [];
  localData.loans = loans || [];
  localData.repayments = repayments || [];
  localData.notifications = notifications || [];
}

function saveLocal() {
  localStorage.setItem('ls_users', JSON.stringify(localData.users));
  localStorage.setItem('ls_loans', JSON.stringify(localData.loans));
  localStorage.setItem('ls_repayments', JSON.stringify(localData.repayments));
  localStorage.setItem('ls_notifications', JSON.stringify(localData.notifications));
}

// Try initialise supabaseClient
try {
  const hasRealConfig =
    SUPABASE_URL &&
    SUPABASE_KEY &&
    SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
    SUPABASE_KEY !== 'YOUR_SUPABASE_ANON_KEY';

  if (hasRealConfig) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
    supabaseAvailable = true;
  }
} catch(e) { 
  console.warn('supabaseClient not configured, running in demo mode', {
    hasSupabase: !!window.supabase,
    hasSupabaseClient: !!window.supabaseClient,
    supabaseUrlSet: !!SUPABASE_URL && SUPABASE_URL !== 'YOUR_SUPABASE_URL',
    supabaseKeySet: !!SUPABASE_KEY && SUPABASE_KEY !== 'YOUR_SUPABASE_ANON_KEY',
    err: e
  });
}

// ─── PAGE NAVIGATION ────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
}

// ─── LOADER ──────────────────────────────────────────────────────────
function showLoader() { document.getElementById('loader').classList.remove('hidden') }
function hideLoader() { document.getElementById('loader').classList.add('hidden') }

// ─── TOAST ───────────────────────────────────────────────────────────
function toast(msg, type='info', dur=3500) {
  const t = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = {success:'fa-circle-check',error:'fa-circle-exclamation',info:'fa-circle-info'};
  el.innerHTML = `<i class="fa-solid ${icons[type]||icons.info}"></i> ${msg}`;
  t.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateY(20px)'; el.style.transition='.3s'; setTimeout(()=>el.remove(),300); }, dur);
}

// ─── HELPERS ─────────────────────────────────────────────────────────
function fmt(n) { return '₱' + Number(n).toLocaleString('en-PH', {minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtDate(d) { if(!d) return '—'; return new Date(d).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate()+days); return d.toISOString(); }

function togglePass(id, el) {
  const inp = document.getElementById(id);
  const icon = el.tagName === 'SPAN' ? el.querySelector('i') : el;
  if(inp.type==='password'){
    inp.type='text';
    icon.className='fa-solid fa-eye-slash';
  } else {
    inp.type='password';
    icon.className='fa-solid fa-eye';
  }
}

function showAlert(id, msg) { const el=document.getElementById(id); el.classList.add('show'); if(msg) el.querySelector('span').textContent=msg; }
function hideAlert(id) { document.getElementById(id)?.classList.remove('show'); }

function toggleSidebar(id) { document.getElementById(id).classList.toggle('open'); }

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function toggleNotifPanel(id) {
  document.querySelectorAll('.notif-panel').forEach(p=>{ if(p.id!==id) p.classList.remove('open'); });
  document.getElementById(id).classList.toggle('open');
}
function closeNotif(id) { document.getElementById(id).classList.remove('open'); }

// ─── LANDING SCROLL ANIMATION ────────────────────────────────────────
const nav = document.getElementById('mainNav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
  document.querySelectorAll('.fade-up').forEach(el => {
    if(el.getBoundingClientRect().top < window.innerHeight - 60) el.classList.add('visible');
  });
});
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.querySelectorAll('.fade-up').forEach(el => {
      if(el.getBoundingClientRect().top < window.innerHeight - 60) el.classList.add('visible');
    });
  }, 100);
});

// ─── ADMIN HINT ──────────────────────────────────────────────────────
function showAdminLoginHint() {
  document.getElementById('loginEmail').value = 'davenstarr@gmail.com';
  document.getElementById('loginPassword').value = 'davenstarr123!';
  toast('Admin credentials auto-filled. Click Sign In.', 'info');
}

// ─── LOGIN ────────────────────────────────────────────────────────────
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  hideAlert('loginError'); hideAlert('loginSuccess');

  if(!email || !pass) { showAlert('loginError','Please fill in all fields'); return; }

  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Signing in...';

  // Admin check
  if(email === 'davenstarr@gmail.com' && pass === 'davenstarr123!') {
    await new Promise(r=>setTimeout(r,900));
    btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-right-to-bracket"></i> Sign In';
    currentUser = { email, role:'admin' };
    showPage('adminDash');
    await loadAdminDashboard();
    toast('Welcome back, Admin!','success');
    return;
  }

  if(!supabaseAvailable) {
    btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-right-to-bracket"></i> Sign In';
    showAlert('loginError','Supabase is not configured. User login requires Supabase.');
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
  btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-right-to-bracket"></i> Sign In';
  if(error) { showAlert('loginError', error.message); return; }

  // Look up profile by auth user id first (most reliable), then fall back to email
  let finalProfile = null;
  const { data: byId } = await supabaseClient
    .from('users').select('*').eq('id', data.user.id).maybeSingle();
  if(byId) {
    finalProfile = byId;
  } else {
    const { data: byEmail } = await supabaseClient
      .from('users').select('*').eq('email', email).maybeSingle();
    finalProfile = byEmail;
  }

  if(!finalProfile) {
    showAlert('loginError','User profile not found. Please register first or contact support.');
    return;
  }

  currentUser = data.user;
  currentUserData = finalProfile;
  afterUserLogin(finalProfile);
  await loadUserDashboard();
}

function afterUserLogin(user) {
  // Populate sidebar
  document.getElementById('sidebarUserName').textContent = `${user.first_name} ${user.last_name}`;
  document.getElementById('sidebarUserEmail').textContent = user.email;
  document.getElementById('userAvatarInitial').textContent = (user.first_name||'U')[0].toUpperCase();

  if(user.status === 'pending') {
    document.getElementById('pendingApprovalAlert').style.display='flex';
  } else {
    document.getElementById('pendingApprovalAlert').style.display='none';
  }
  showPage('userDash');
  loadUserDashboard();
  toast(`Welcome back, ${user.first_name}!`, 'success');
}

function handleLogout() {
  currentUser = null; currentUserData = null;
  if(supabaseAvailable) supabaseClient.auth.signOut();
  showPage('landing');
  toast('Logged out successfully','info');
}

// ─── REGISTER STEPS ──────────────────────────────────────────────────
let currentStep = 1;
const totalSteps = 4;

function nextStep(from) {
  if(!validateStep(from)) return;
  goToStep(from + 1);
}
function prevStep(from) { goToStep(from - 1); }

function goToStep(n) {
  document.getElementById(`stepContent${currentStep}`).classList.remove('active');
  document.getElementById(`stepContent${n}`).classList.add('active');
  // Update indicators
  document.querySelectorAll('.step').forEach(s => {
    const sn = parseInt(s.dataset.step);
    s.classList.remove('active','done');
    if(sn < n) s.classList.add('done');
    else if(sn === n) s.classList.add('active');
  });
  currentStep = n;
  hideAlert('regError');
}

function validateStep(n) {
  hideAlert('regError');
  if(n===1) {
    const f = id => document.getElementById(id).value.trim();
    if(!f('regFirstName')||!f('regLastName')||!f('regGender')||!f('regContact')||!f('regEmail')||!f('regAddress')) {
      showAlert('regError','Please fill in all required fields'); return false;
    }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f('regEmail'))) {
      showAlert('regError','Please enter a valid email address'); return false;
    }
    if(document.getElementById('regPassword').value.length < 6) {
      showAlert('regError','Password must be at least 6 characters'); return false;
    }
    if(document.getElementById('regPassword').value !== document.getElementById('regConfirmPassword').value) {
      showAlert('regError','Passwords do not match'); return false;
    }
    // Check duplicate email for local data as quick guard
    const email = document.getElementById('regEmail').value.trim();
    if(localData.users.find(u=>u.email===email)) {
      showAlert('regError','An account with this email already exists'); return false;
    }
  }
  if(n===2) {
    if(!document.getElementById('regJobType').value||!document.getElementById('regSalary').value) {
      showAlert('regError','Please fill in job type and monthly salary'); return false;
    }
  }
  if(n===3) {
    if(!document.getElementById('regIdType').value) {
      showAlert('regError','Please select a valid ID type'); return false;
    }
  }
  return true;
}

function handleFileUpload(input, zoneId, hiddenId) {
  const zone = document.getElementById(zoneId);
  const file = input.files[0];
  if(file) {
    document.getElementById(hiddenId).value = file.name;
    zone.classList.add('has-file');
    zone.querySelector('p').textContent = `✓ ${file.name}`;
    zone.querySelector('i').className = 'fa-solid fa-circle-check';
  }
}

// Email verification flow
async function sendVerificationEmailAndNext() {
  if(!validateStep(3)) return;
  const btn = document.getElementById('sendOtpBtn');
  btn.disabled=true; btn.innerHTML='<div class="spinner"></div> Sending verification email...';

  const email = document.getElementById('regEmail').value.trim();
  document.getElementById('otpEmailDisplay').textContent = email;

  if(supabaseAvailable) {
    const { data: existing, error: findError } = await supabaseClient
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if(findError) {
      showAlert('regError', findError.message);
      btn.disabled=false; btn.innerHTML='Send verification email <i class="fa-solid fa-arrow-right"></i>';
      return;
    }
    if(existing) {
      showAlert('regError','An account with this email already exists'); btn.disabled=false; btn.innerHTML='Send verification email <i class="fa-solid fa-arrow-right"></i>'; return;
    }

    const { data, error } = await supabaseClient.auth.signUp({ email, password: document.getElementById('regPassword').value });
    if(error && !error.message.includes('already registered')) {
      showAlert('regError', error.message); btn.disabled=false; btn.innerHTML='Send verification email <i class="fa-solid fa-arrow-right"></i>'; return;
    }

    const authUid = data?.user?.id;
    if(!authUid) {
      showAlert('regError', 'Failed to create auth account. Please try again.');
      btn.disabled=false; btn.innerHTML='Send verification email <i class="fa-solid fa-arrow-right"></i>';
      return;
    }

    // If email confirmation is on, signUp returns no session — set the session manually
    // so the insert goes through as `authenticated` and passes RLS.
    if(data.session) {
      await supabaseClient.auth.setSession(data.session);
    }

    // Insert the profile row immediately so it exists when the user logs in later
    const newUser = {
      id: authUid,
      first_name: document.getElementById('regFirstName').value.trim(),
      last_name: document.getElementById('regLastName').value.trim(),
      middle_name: document.getElementById('regMiddleName').value.trim(),
      gender: document.getElementById('regGender').value,
      contact: document.getElementById('regContact').value.trim(),
      email,
      address: document.getElementById('regAddress').value.trim(),
      password: document.getElementById('regPassword').value,
      job_type: document.getElementById('regJobType').value,
      employer: document.getElementById('regEmployer').value.trim(),
      salary: document.getElementById('regSalary').value,
      id_type: document.getElementById('regIdType').value,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const { error: insertError } = await supabaseClient.from('users').insert([newUser]);
    if(insertError) {
      showAlert('regError', insertError.message || 'Failed to save profile. Please try again.');
      btn.disabled=false; btn.innerHTML='Send verification email <i class="fa-solid fa-arrow-right"></i>';
      return;
    }

    await supabaseClient.from('notifications').insert([{
      id: uid(), target: 'admin',
      message: `New user registered: ${newUser.first_name} ${newUser.last_name}`,
      created_at: new Date().toISOString(), read: false
    }]);

    localStorage.setItem('ls_pending_auth_uid', authUid);
  }

  await new Promise(r=>setTimeout(r,1200));
  btn.disabled=false; btn.innerHTML='Send verification email <i class="fa-solid fa-arrow-right"></i>';

  goToStep(4);
  toast(`Verification email should arrive shortly at ${email}. Please click the email link to confirm your address, then click Confirm below.`, 'info', 8000);
}

async function verifyEmailAndRegister() {
  const btn = document.getElementById('verifyOtpBtn');
  btn.disabled=true; btn.innerHTML='<div class="spinner"></div> Verifying...';

  if(!supabaseAvailable) {
    showAlert('regError','Supabase is not configured. User accounts must be stored in Supabase.');
    btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-circle-check"></i> Confirm verification';
    return;
  }

  // Profile was already inserted during sendVerificationEmailAndNext — just redirect.
  const pendingAuthUid = localStorage.getItem('ls_pending_auth_uid');
  if(!pendingAuthUid) {
    showAlert('regError','Registration session expired. Please start over.');
    btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-circle-check"></i> Confirm verification';
    return;
  }

  localStorage.removeItem('ls_pending_auth_uid');
  btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-circle-check"></i> Confirm verification';
  toast('Account submitted! Waiting for admin approval.', 'success', 5000);
  setTimeout(()=> showPage('login'), 2000);
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────
function adminView(view, el) {
  ['dashboard','users','loans','active','overdue'].forEach(v => {
    const vEl = document.getElementById(`adminView-${v}`);
    if(vEl) vEl.style.display = v===view ? 'block' : 'none';
  });
  document.querySelectorAll('#adminSidebar .sidebar-nav a').forEach(a=>a.classList.remove('active'));
  if(el) el.classList.add('active');
  const titles = {dashboard:'Dashboard',users:'User Management',loans:'Loan Requests',active:'Active Loans',overdue:'Overdue Loans'};
  document.getElementById('adminTopTitle').textContent = titles[view]||view;

  if(view==='users') renderAdminUsers();
  else if(view==='loans') renderAdminLoans();
  else if(view==='active') renderAdminActive();
  else if(view==='overdue') renderAdminOverdue();
}

async function loadAdminDashboard() {
  if(supabaseAvailable) await syncDataFromSupabase();
  const users = localData.users;
  const loans = localData.loans;
  const total = users.length;
  const approved = users.filter(u=>u.status==='approved').length;
  const declined = users.filter(u=>u.status==='declined').length;
  const pending = users.filter(u=>u.status==='pending').length;
  const loanReqs = loans.filter(l=>l.status==='pending').length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-approved').textContent = approved;
  document.getElementById('stat-declined').textContent = declined;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-loanreqs').textContent = loanReqs;

  // Dot
  document.getElementById('adminNotifDot').style.display = (pending>0||loanReqs>0)?'block':'none';
  renderAdminNotifications();
  renderRecentLoans();
  renderAdminCharts(approved, declined, pending);
}

function renderAdminCharts(approved, declined, pending) {
  const cfg = {
    type:'bar',
    data:{
      labels:['Approved','Declined','Pending'],
      datasets:[{
        data:[approved, declined, pending],
        backgroundColor:['rgba(0,229,160,.7)','rgba(255,77,109,.7)','rgba(255,184,0,.7)'],
        borderColor:['rgba(0,229,160,1)','rgba(255,77,109,1)','rgba(255,184,0,1)'],
        borderWidth:1.5, borderRadius:6
      }]
    },
    options:{responsive:true,plugins:{legend:{display:false}},scales:{
      y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#7baac8',font:{size:11}}},
      x:{grid:{display:false},ticks:{color:'#7baac8',font:{size:11}}}
    }}
  };

  const loans = localData.loans;
  const lactive = loans.filter(l=>l.status==='active').length;
  const ldis = loans.filter(l=>l.status==='disbursed').length;
  const lover = loans.filter(l=>l.status==='overdue').length;
  const lpend = loans.filter(l=>l.status==='pending').length;

  const cfg2 = {
    type:'doughnut',
    data:{
      labels:['Active','Disbursed','Overdue','Pending'],
      datasets:[{
        data:[lactive,ldis,lover,lpend],
        backgroundColor:['rgba(0,212,255,.7)','rgba(0,229,160,.7)','rgba(255,77,109,.7)','rgba(255,184,0,.7)'],
        borderColor:'rgba(0,0,0,0)', hoverOffset:8
      }]
    },
    options:{responsive:true,cutout:'65%',plugins:{legend:{position:'bottom',labels:{color:'#7baac8',font:{size:11},padding:14}}}}
  };

  const c1 = document.getElementById('adminChart');
  const c2 = document.getElementById('loanChart');
  if(adminChart) adminChart.destroy();
  if(loanChart) loanChart.destroy();
  adminChart = new Chart(c1, cfg);
  loanChart = new Chart(c2, cfg2);
}

function renderRecentLoans() {
  const body = document.getElementById('recentLoansBody');
  const loans = localData.loans.slice(-8).reverse();
  if(!loans.length) { body.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">No loan requests yet</td></tr>'; return; }
  body.innerHTML = loans.map(l => {
    const user = localData.users.find(u=>u.id===l.user_id)||{first_name:'Unknown',last_name:''};
    return `<tr>
      <td><strong>${user.first_name} ${user.last_name}</strong></td>
      <td>${fmt(l.amount)}</td>
      <td>${fmtDate(l.created_at)}</td>
      <td>${statusBadge(l.status)}</td>
      <td>${l.status==='pending'?`<button class="btn btn-success btn-xs" style="margin-right:4px" onclick="approveLoan('${l.id}')">Approve</button><button class="btn btn-danger btn-xs" onclick="declineLoan('${l.id}')">Decline</button>`:'—'}</td>
    </tr>`;
  }).join('');
}

function renderAdminNotifications() {
  const list = document.getElementById('adminNotifList');
  const notifs = localData.notifications.filter(n=>n.target==='admin').slice(-10).reverse();
  if(!notifs.length) { list.innerHTML='<div style="padding:20px;text-align:center;font-size:.82rem;color:var(--text-muted)">No notifications</div>'; return; }
  list.innerHTML = notifs.map(n=>`
    <div class="notif-item">
      <div class="notif-ico" style="background:rgba(0,212,255,.1);color:var(--neon)"><i class="fa-solid fa-bell"></i></div>
      <div class="notif-txt"><p>${n.message}</p><small>${fmtDate(n.created_at)}</small></div>
    </div>
  `).join('');
}

function renderAdminUsers() {
  const body = document.getElementById('adminUsersBody');
  const users = localData.users;
  document.getElementById('userCountBadge').textContent = `${users.length} Users`;
  if(!users.length) { body.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">No registered users</td></tr>'; return; }
  body.innerHTML = users.map(u=>`<tr>
    <td><strong>${u.first_name} ${u.last_name}</strong><div style="font-size:.72rem;color:var(--text-muted)">${u.gender||''}</div></td>
    <td>${u.email}</td>
    <td>${u.contact||'—'}</td>
    <td style="font-size:.82rem">${u.job_type||'—'}</td>
    <td>${u.salary?fmt(u.salary):'—'}</td>
    <td>${statusBadge(u.status)}</td>
    <td>
      <button class="btn btn-ghost btn-xs" style="margin-right:4px" onclick="viewUserDetail('${u.id}')">View</button>
      ${u.status==='pending'?`<button class="btn btn-success btn-xs" style="margin-right:4px" onclick="approveUser('${u.id}')">Approve</button><button class="btn btn-danger btn-xs" onclick="declineUser('${u.id}')">Decline</button>`:''}
    </td>
  </tr>`).join('');
}

function renderAdminLoans() {
  const body = document.getElementById('adminLoansBody');
  const loans = [...localData.loans].reverse();
  if(!loans.length) { body.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">No loan requests</td></tr>'; return; }
  body.innerHTML = loans.map(l=>{
    const user = localData.users.find(u=>u.id===l.user_id)||{first_name:'Unknown',last_name:''};
    return `<tr>
      <td><strong>${user.first_name} ${user.last_name}</strong></td>
      <td>${fmt(l.amount)}</td>
      <td>${fmt(l.interest)}</td>
      <td><strong style="color:var(--neon)">${fmt(l.total)}</strong></td>
      <td style="font-size:.8rem">${fmtDate(l.created_at)}</td>
      <td>${statusBadge(l.status)}</td>
      <td>${l.status==='pending'?`<button class="btn btn-success btn-xs" style="margin-right:4px" onclick="approveLoan('${l.id}')">Approve</button><button class="btn btn-danger btn-xs" onclick="declineLoan('${l.id}')">Decline</button>`:'—'}</td>
    </tr>`;
  }).join('');
}

function renderAdminActive() {
  const body = document.getElementById('adminActiveBody');
  const loans = localData.loans.filter(l=>l.status==='active'||l.status==='disbursed');
  if(!loans.length) { body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">No active loans</td></tr>'; return; }
  body.innerHTML = loans.map(l=>{
    const user = localData.users.find(u=>u.id===l.user_id)||{first_name:'Unknown',last_name:''};
    return `<tr>
      <td><strong>${user.first_name} ${user.last_name}</strong></td>
      <td>${fmt(l.amount)}</td>
      <td>${fmt(l.interest)}</td>
      <td><strong>${fmt(l.total)}</strong></td>
      <td style="font-size:.82rem;color:var(--warning)">${fmtDate(l.due_date)}</td>
      <td>${statusBadge(l.status)}</td>
    </tr>`;
  }).join('');
}

function renderAdminOverdue() {
  const body = document.getElementById('adminOverdueBody');
  const loans = localData.loans.filter(l=>l.status==='overdue');
  if(!loans.length) { body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">No overdue loans</td></tr>'; return; }
  body.innerHTML = loans.map(l=>{
    const user = localData.users.find(u=>u.id===l.user_id)||{first_name:'Unknown',last_name:''};
    const penalty = l.amount * 0.05;
    const totalDue = l.total + penalty;
    const daysDue = Math.floor((Date.now()-new Date(l.due_date))/86400000);
    return `<tr>
      <td><strong>${user.first_name} ${user.last_name}</strong></td>
      <td>${fmt(l.amount)}</td>
      <td>${fmt(l.interest)}</td>
      <td style="color:var(--danger)">${fmt(penalty)}</td>
      <td><strong style="color:var(--danger)">${fmt(totalDue)}</strong></td>
      <td><span class="badge badge-danger">${daysDue}d overdue</span></td>
    </tr>`;
  }).join('');
}

async function approveUser(uid) {
  if(supabaseAvailable) {
    await supabaseClient.from('users').update({ status:'approved' }).eq('id', uid);
    await supabaseClient.from('notifications').insert([{ id: uid+'n', target: uid, message: 'Your account has been approved! You can now apply for a loan.', created_at: new Date().toISOString(), read: false }]);
    toast('User approved!', 'success');
  } else {
    const u = localData.users.find(u=>u.id===uid);
    if(!u) return;
    u.status = 'approved';
    localData.notifications.push({ id: uid+'n', target: u.id, message: 'Your account has been approved! You can now apply for a loan.', created_at: new Date().toISOString(), read: false });
    saveLocal();
    toast(`${u.first_name} approved!`, 'success');
  }
  renderAdminUsers();
  await loadAdminDashboard();
}

async function declineUser(uid) {
  if(supabaseAvailable) {
    await supabaseClient.from('users').update({ status:'declined' }).eq('id', uid);
    await supabaseClient.from('notifications').insert([{ id: uid+'n2', target: uid, message: 'Your account application was declined. Please contact support.', created_at: new Date().toISOString(), read: false }]);
    toast('User declined.', 'error');
  } else {
    const u = localData.users.find(u=>u.id===uid);
    if(!u) return;
    u.status = 'declined';
    localData.notifications.push({ id: uid+'n2', target: u.id, message: 'Your account application was declined. Please contact support.', created_at: new Date().toISOString(), read: false });
    saveLocal();
    toast(`${u.first_name} declined.`, 'error');
  }
  renderAdminUsers();
  await loadAdminDashboard();
}

function viewUserDetail(uid) {
  const u = localData.users.find(u=>u.id===uid);
  if(!u) return;
  document.getElementById('modalUserTitle').textContent = `${u.first_name} ${u.last_name}`;
  document.getElementById('modalUserContent').innerHTML = `
    <div class="form-row" style="margin-bottom:16px">
      <div class="glass2" style="padding:16px;border-radius:12px">
        <div style="font-size:.72rem;color:var(--text-muted)">Status</div>
        <div style="margin-top:6px">${statusBadge(u.status)}</div>
      </div>
      <div class="glass2" style="padding:16px;border-radius:12px">
        <div style="font-size:.72rem;color:var(--text-muted)">Registered</div>
        <div style="font-size:.88rem;margin-top:6px">${fmtDate(u.created_at)}</div>
      </div>
    </div>
    <div style="display:grid;gap:10px">
      ${detail('Email',u.email)} ${detail('Contact',u.contact)} ${detail('Gender',u.gender)}
      ${detail('Address',u.address)} ${detail('Job Type',u.job_type)} ${detail('Employer',u.employer||'—')}
      ${detail('Monthly Salary',u.salary?fmt(u.salary):'—')} ${detail('ID Type',u.id_type||'—')}
    </div>
    ${u.status==='pending'?`<div style="display:flex;gap:10px;margin-top:20px">
      <button class="btn btn-success" style="flex:1;justify-content:center" onclick="approveUser('${u.id}');closeModal('userDetailModal')">Approve Account</button>
      <button class="btn btn-danger" style="flex:1;justify-content:center" onclick="declineUser('${u.id}');closeModal('userDetailModal')">Decline</button>
    </div>`:''}
  `;
  openModal('userDetailModal');
}

function detail(label, val) {
  return `<div class="glass2" style="padding:12px 16px;border-radius:10px">
    <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:3px">${label}</div>
    <div style="font-size:.88rem">${val||'—'}</div>
  </div>`;
}

function approveLoan(lid) {
  const l = localData.loans.find(l=>l.id===lid);
  if(!l) return;
  l.status = 'active';
  l.disbursed_at = new Date().toISOString();
  l.due_date = addDays(new Date(), 30);
  localData.notifications.push({ id: lid+'na', target: l.user_id, message: `Your loan of ${fmt(l.amount)} has been approved and is now active!`, created_at: new Date().toISOString(), read: false });
  saveLocal();
  toast('Loan approved!','success');
  loadAdminDashboard();
  renderAdminLoans();
}

function declineLoan(lid) {
  const l = localData.loans.find(l=>l.id===lid);
  if(!l) return;
  l.status = 'declined';
  localData.notifications.push({ id: lid+'nd', target: l.user_id, message: `Your loan request of ${fmt(l.amount)} was declined.`, created_at: new Date().toISOString(), read: false });
  saveLocal();
  toast('Loan declined.','error');
  loadAdminDashboard();
  renderAdminLoans();
}

function filterAdminTable() {
  const q = document.getElementById('adminSearch').value.toLowerCase();
  document.querySelectorAll('#adminUsersBody tr, #adminLoansBody tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function statusBadge(s) {
  const map = {
    approved: 'badge-success', active: 'badge-success', disbursed: 'badge-info',
    pending: 'badge-warning', declined: 'badge-danger', overdue: 'badge-danger', paid: 'badge-muted'
  };
  const icons = { approved:'fa-check', active:'fa-circle-dot', disbursed:'fa-money-bill-transfer', pending:'fa-clock', declined:'fa-xmark', overdue:'fa-triangle-exclamation', paid:'fa-check-double' };
  const cls = map[s]||'badge-muted';
  return `<span class="badge ${cls}"><i class="fa-solid ${icons[s]||'fa-circle'}"></i> ${s?.charAt(0).toUpperCase()+s?.slice(1)}</span>`;
}

// ─── USER DASHBOARD ──────────────────────────────────────────────────
function userView(view, el) {
  ['overview','request','disbursed','active','overdue','repayment'].forEach(v=>{
    const vEl = document.getElementById(`userView-${v}`);
    if(vEl) vEl.style.display = v===view?'block':'none';
  });
  document.querySelectorAll('#userSidebar .sidebar-nav a').forEach(a=>a.classList.remove('active'));
  if(el) el.classList.add('active');
  const titles = {overview:'Overview',request:'Request a Loan',disbursed:'Disbursed Loans',active:'Active Loans',overdue:'Overdue Loans',repayment:'Repayment History'};
  document.getElementById('userTopTitle').textContent = titles[view]||view;
  if(view==='disbursed') renderDisbursed();
  if(view==='active') renderActive();
  if(view==='overdue') renderOverdue();
  if(view==='repayment') renderRepayments();
  if(view==='request') updateMaxLoan();
}

async function loadUserDashboard() {
  if(!currentUserData) return;
  if(supabaseAvailable) await syncDataFromSupabase();
  updateLimitDisplay();
  renderUserLoans();
  renderUserNotifications();
  if(document.getElementById('limitDoughnut')._chart) document.getElementById('limitDoughnut')._chart.destroy();
  renderLimitChart();
}

function getUserLoans() {
  return localData.loans.filter(l=>l.user_id===currentUserData.id);
}

function getUsedLimit() {
  return getUserLoans().filter(l=>['active','disbursed','overdue'].includes(l.status)).reduce((s,l)=>s+Number(l.amount),0);
}

function updateLimitDisplay() {
  const used = getUsedLimit();
  const remain = Math.max(0, 15000 - used);
  const pct = Math.round(used/150);
  document.getElementById('usedLimit').textContent = fmt(used);
  document.getElementById('remainLimit').textContent = fmt(remain);
  document.getElementById('totalLoansCount').textContent = getUserLoans().length;
  document.getElementById('limitUsedDetail').textContent = fmt(used);
  document.getElementById('limitAvailDetail').textContent = fmt(remain);
  document.getElementById('limitPct').textContent = pct + '%';
}

function renderLimitChart() {
  const used = getUsedLimit();
  const remain = Math.max(0, 15000 - used);
  const ctx = document.getElementById('limitDoughnut').getContext('2d');
  if(limitDoughnut) limitDoughnut.destroy();
  limitDoughnut = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels:['Used','Available'],
      datasets:[{
        data:[used, remain],
        backgroundColor:['rgba(255,77,109,.7)','rgba(0,212,255,.2)'],
        borderColor:['rgba(255,77,109,1)','rgba(0,212,255,.4)'],
        borderWidth:1.5
      }]
    },
    options:{responsive:true,cutout:'72%',plugins:{legend:{display:false}},animation:{duration:600}}
  });
  document.getElementById('limitDoughnut')._chart = limitDoughnut;
}

function renderUserLoans() {
  const body = document.getElementById('userLoansBody');
  const loans = getUserLoans().slice(-5).reverse();
  if(!loans.length) {
    body.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;font-size:.85rem">No loans yet. <a href="#" onclick="userView(\'request\',null)" style="color:var(--neon)">Apply now →</a></td></tr>';
    return;
  }
  body.innerHTML = loans.map(l=>`<tr>
    <td>${fmt(l.amount)}</td>
    <td><strong style="color:var(--neon)">${fmt(l.total)}</strong></td>
    <td style="font-size:.8rem">${fmtDate(l.due_date)||'—'}</td>
    <td>${statusBadge(l.status)}</td>
  </tr>`).join('');
}

function renderUserNotifications() {
  const list = document.getElementById('userNotifList');
  const notifs = localData.notifications.filter(n=>n.target===currentUserData.id).slice(-10).reverse();
  document.getElementById('userNotifDot').style.display = notifs.length ? 'block' : 'none';
  if(!notifs.length) { list.innerHTML='<div style="padding:20px;text-align:center;font-size:.82rem;color:var(--text-muted)">No notifications</div>'; return; }
  const icons = { approve:'fa-check-circle', decline:'fa-times-circle' };
  list.innerHTML = notifs.map(n=>{
    const isGood = n.message.includes('approved');
    return `<div class="notif-item">
      <div class="notif-ico" style="background:${isGood?'rgba(0,229,160,.1)':'rgba(255,77,109,.1)'};color:${isGood?'var(--success)':'var(--danger)'}">
        <i class="fa-solid ${isGood?'fa-circle-check':'fa-circle-exclamation'}"></i>
      </div>
      <div class="notif-txt"><p style="font-size:.82rem">${n.message}</p><small>${fmtDate(n.created_at)}</small></div>
    </div>`;
  }).join('');
}

function calcLoanPreview() {
  const amt = parseFloat(document.getElementById('loanAmount').value)||0;
  const interest = amt * 0.20;
  const total = amt + interest;
  document.getElementById('prev-principal').textContent = fmt(amt);
  document.getElementById('prev-interest').textContent = fmt(interest);
  document.getElementById('prev-total').textContent = fmt(total);
}

function updateMaxLoan() {
  const remain = Math.max(0, 15000 - getUsedLimit());
  document.getElementById('maxLoanDisplay').textContent = fmt(remain);
  document.getElementById('loanAmount').max = remain;
}

async function submitLoanRequest() {
  const amt = parseFloat(document.getElementById('loanAmount').value)||0;
  const purpose = document.getElementById('loanPurpose').value.trim();
  const maxAllowed = Math.max(0, 15000 - getUsedLimit());

  const errEl = document.getElementById('loanReqError');
  errEl.style.display = 'none';

  if(!currentUserData) { toast('Please log in again','error'); return; }
  if(currentUserData.status !== 'approved') {
    errEl.style.display = 'flex';
    document.getElementById('loanReqErrorMsg').textContent = 'Your account must be approved before requesting a loan.';
    return;
  }
  if(amt < 500) {
    errEl.style.display='flex'; document.getElementById('loanReqErrorMsg').textContent='Minimum loan amount is ₱500'; return;
  }
  if(amt > maxAllowed) {
    errEl.style.display='flex'; document.getElementById('loanReqErrorMsg').textContent=`Maximum allowed is ${fmt(maxAllowed)}`; return;
  }

  const btn = document.getElementById('submitLoanBtn');
  btn.disabled=true; btn.innerHTML='<div class="spinner"></div> Submitting...';

  await new Promise(r=>setTimeout(r,800));

  const interest = amt * 0.20;
  const total = amt + interest;
  const loan = {
    id: uid(), user_id: currentUserData.id, amount: amt,
    interest, total, purpose, status:'pending',
    created_at: new Date().toISOString(), due_date: null, disbursed_at: null
  };

  localData.loans.push(loan);
  localData.notifications.push({ id: uid(), target:'admin', message:`New loan request from ${currentUserData.first_name} ${currentUserData.last_name}: ${fmt(amt)}`, created_at: new Date().toISOString(), read: false });
  saveLocal();

  btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-paper-plane"></i> Submit Loan Request';
  toast('Loan request submitted! Waiting for admin approval.','success');
  document.getElementById('loanAmount').value='';
  document.getElementById('loanPurpose').value='';
  calcLoanPreview();
  updateLimitDisplay();
  renderUserLoans();
}

function renderDisbursed() {
  const body = document.getElementById('disbursedBody');
  const loans = getUserLoans().filter(l=>l.status==='disbursed'||l.status==='active'||l.status==='overdue');
  if(!loans.length) { body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">No disbursed loans yet</td></tr>'; return; }
  body.innerHTML = loans.map(l=>`<tr>
    <td>${fmt(l.amount)}</td><td>${fmt(l.interest)}</td>
    <td><strong>${fmt(l.total)}</strong></td>
    <td style="font-size:.8rem">${fmtDate(l.disbursed_at)||'—'}</td>
    <td style="font-size:.8rem;color:var(--warning)">${fmtDate(l.due_date)||'—'}</td>
    <td>${statusBadge(l.status)}</td>
  </tr>`).join('');
}

function renderActive() {
  const body = document.getElementById('activeBody');
  const loans = getUserLoans().filter(l=>l.status==='active');
  if(!loans.length) { body.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">No active loans</td></tr>'; return; }
  body.innerHTML = loans.map(l=>`<tr>
    <td>${fmt(l.amount)}</td><td>${fmt(l.interest)}</td>
    <td><strong style="color:var(--neon)">${fmt(l.total)}</strong></td>
    <td style="font-size:.8rem;color:var(--warning)">${fmtDate(l.due_date)}</td>
    <td><button class="btn btn-primary btn-xs" onclick="openRepayModal('${l.id}')">Repay</button></td>
  </tr>`).join('');
}

function renderOverdue() {
  const now = Date.now();
  // Auto-mark overdue
  getUserLoans().filter(l=>l.status==='active'&&l.due_date&&new Date(l.due_date)<now).forEach(l=>{ l.status='overdue'; });
  saveLocal();

  const body = document.getElementById('overdueBody');
  const loans = getUserLoans().filter(l=>l.status==='overdue');
  if(!loans.length) { body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">No overdue loans 🎉</td></tr>'; return; }
  body.innerHTML = loans.map(l=>{
    const penalty = l.amount * 0.05;
    const totalDue = l.total + penalty;
    const daysDue = Math.floor((now - new Date(l.due_date)) / 86400000);
    return `<tr>
      <td>${fmt(l.amount)}</td><td>${fmt(l.interest)}</td>
      <td style="color:var(--danger)">${fmt(penalty)}</td>
      <td><strong style="color:var(--danger)">${fmt(totalDue)}</strong></td>
      <td><span class="badge badge-danger">${daysDue}d</span></td>
      <td><button class="btn btn-danger btn-xs" onclick="openRepayModal('${l.id}')">Pay Now</button></td>
    </tr>`;
  }).join('');
}

function renderRepayments() {
  const body = document.getElementById('repaymentBody');
  const reps = localData.repayments.filter(r=>r.user_id===currentUserData.id).reverse();
  if(!reps.length) { body.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">No repayments recorded yet</td></tr>'; return; }
  body.innerHTML = reps.map(r=>`<tr>
    <td style="font-size:.8rem;color:var(--text-muted)">${r.loan_id?.slice(-6)||'—'}</td>
    <td><strong style="color:var(--success)">${fmt(r.amount)}</strong></td>
    <td style="font-size:.8rem">${fmtDate(r.created_at)}</td>
    <td>${r.method||'—'}</td>
    <td>${statusBadge('paid')}</td>
  </tr>`).join('');
}

function openRepayModal(lid) {
  repayLoanId = lid;
  const loan = localData.loans.find(l=>l.id===lid);
  if(!loan) return;
  const penalty = loan.status==='overdue' ? loan.amount*0.05 : 0;
  const totalDue = loan.total + penalty;
  document.getElementById('repayAmount').value = totalDue.toFixed(2);
  openModal('repayModal');
}

async function submitRepayment() {
  const amt = parseFloat(document.getElementById('repayAmount').value)||0;
  const method = document.getElementById('repayMethod').value;
  if(!amt || !repayLoanId) { toast('Please enter an amount','error'); return; }

  const loan = localData.loans.find(l=>l.id===repayLoanId);
  if(!loan) return;

  localData.repayments.push({ id:uid(), loan_id:repayLoanId, user_id:currentUserData.id, amount:amt, method, created_at:new Date().toISOString() });
  loan.status = 'paid';
  saveLocal();

  closeModal('repayModal');
  toast(`Payment of ${fmt(amt)} recorded successfully!`,'success');
  updateLimitDisplay();
  renderUserLoans();
  renderLimitChart();
  renderRepayments();
}

// ─── INIT ─────────────────────────────────────────────────────────────
window.addEventListener('load', async () => {
  await new Promise(r => setTimeout(r, 1200));
  hideLoader();

  // Restore session from localStorage
  const savedUser = localStorage.getItem('ls_session');
  if(savedUser) {
    try {
      const u = JSON.parse(savedUser);
      currentUser = u;
      currentUserData = u;
    } catch(e) {}
  }
});

// Close notif on outside click
document.addEventListener('click', (e) => {
  if(!e.target.closest('.notif-panel') && !e.target.closest('.notif-btn')) {
    document.querySelectorAll('.notif-panel').forEach(p=>p.classList.remove('open'));
  }
  if(!e.target.closest('.sidebar') && !e.target.closest('.mobile-toggle')) {
    document.querySelectorAll('.sidebar').forEach(s=>s.classList.remove('open'));
  }
});



// Expose functions to global scope for inline HTML onclick handlers
Object.assign(window, {
  showPage,
  togglePass,
  handleLogin,
  showAdminLoginHint,
  handleLogout,
  nextStep,
  prevStep,
  handleFileUpload,
  sendVerificationEmailAndNext,
  verifyEmailAndRegister,
  adminView,
  toggleSidebar,
  toggleNotifPanel,
  closeNotif,
  filterAdminTable,
  approveUser,
  declineUser,
  viewUserDetail,
  approveLoan,
  declineLoan,
  userView,
  calcLoanPreview,
  submitLoanRequest,
  openRepayModal,
  closeModal,
  submitRepayment,
});
