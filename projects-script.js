/* ================================================================
   PROJECTS + WEBSITE ORDER — projects-script.js  v2 (Firebase)
   ✅ Zero changes to existing HTML/CSS/JS
   ✅ Firebase Firestore for projects + order requests
   ✅ Admin panel with password protection
   ================================================================ */
(function(){
'use strict';

/* ── Firebase config ─────────────────────────────────────────
   REPLACE these values with your own Firebase project config.
   Get them from: Firebase Console → Project Settings → Web App
────────────────────────────────────────────────────────────── */
var FB_CONFIG = {
  apiKey:            "AIzaSyDEMO_REPLACE_WITH_YOUR_KEY",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "000000000000",
  appId:             "1:000000000000:web:0000000000000000"
};

/* ── Admin password (change this!) ─────────────────────────── */
var ADMIN_PASS = 'zypher2024';

/* ── State ──────────────────────────────────────────────────── */
var db           = null;
var isAdmin      = false;
var activeFilter = 'All';
var searchQuery  = '';
var editingId    = null;
var activeProj   = null;
var fbLoaded     = false;

/* ── localStorage session ───────────────────────────────────── */
function checkAdminSession(){
  isAdmin = sessionStorage.getItem('pj_admin') === 'yes';
}
function setAdminSession(){
  sessionStorage.setItem('pj_admin','yes');
  isAdmin = true;
}
function clearAdminSession(){
  sessionStorage.removeItem('pj_admin');
  isAdmin = false;
}

/* ── Load Firebase SDK ──────────────────────────────────────── */
function loadFirebase(cb){
  if(fbLoaded){ cb(); return; }
  var s1 = document.createElement('script');
  s1.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
  s1.onload = function(){
    var s2 = document.createElement('script');
    s2.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js';
    s2.onload = function(){
      try{
        if(!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
        db = firebase.firestore();
        fbLoaded = true;
        cb();
      } catch(e){ cb(e); }
    };
    s2.onerror = function(){ cb(new Error('Firestore load failed')); };
    document.head.appendChild(s2);
  };
  s1.onerror = function(){ cb(new Error('Firebase app load failed')); };
  document.head.appendChild(s1);
}

/* ── Helpers ────────────────────────────────────────────────── */
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toast(msg){
  var t = document.getElementById('pjToast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('pj-show');
  clearTimeout(t._t);
  t._t = setTimeout(function(){ t.classList.remove('pj-show'); }, 3600);
}
function showStatus(el,cls,msg){
  el.className = 'pj-status-msg ' + cls;
  el.textContent = msg;
}

/* ── Scroll reveal ──────────────────────────────────────────── */
function observeCards(){
  if(!window.IntersectionObserver){
    document.querySelectorAll('.pj-card').forEach(function(c){ c.classList.add('pj-visible'); });
    return;
  }
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add('pj-visible'); obs.unobserve(e.target); }
    });
  },{ threshold:0.1, rootMargin:'0px 0px -40px 0px' });
  document.querySelectorAll('.pj-card').forEach(function(c){ obs.observe(c); });
}

/* ── Gradient presets ───────────────────────────────────────── */
var GRADIENTS = [
  'linear-gradient(135deg,#1e3a8a,#2563eb)',
  'linear-gradient(135deg,#7c3aed,#2563eb)',
  'linear-gradient(135deg,#16a34a,#22c55e)',
  'linear-gradient(135deg,#f97316,#fb923c)',
  'linear-gradient(135deg,#0f172a,#1e3a8a)',
  'linear-gradient(135deg,#d97706,#fbbf24)',
];
function getGradient(i){ return GRADIENTS[i % GRADIENTS.length]; }

/* ── Card HTML ──────────────────────────────────────────────── */
function cardHTML(p, idx){
  var grad = p.gradient || getGradient(idx);
  var thumb = p.imageUrl
    ? '<img class="pj-thumb-img" src="'+esc(p.imageUrl)+'" alt="'+esc(p.title)+'" loading="lazy">'
    : '<div class="pj-thumb-placeholder" style="background:'+grad+'">'+esc(p.emoji||'🚀')+'</div>';
  var featured = p.featured ? '<span class="pj-featured-star">⭐</span>' : '';
  var tech = (p.tech||[]).map(function(t){ return '<span class="pj-tech-tag">'+esc(t)+'</span>'; }).join('');
  var viewBtn = p.demoUrl
    ? '<a class="pj-btn-view" href="'+esc(p.demoUrl)+'" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i> View Project</a>'
    : '<button class="pj-btn-view" onclick="PJ.openDetail(\''+esc(p.id)+'\')"><i class="fas fa-eye"></i> View Project</button>';
  return '<div class="pj-card" data-pj-id="'+esc(p.id)+'">'
    +'<div class="pj-thumb">'+thumb+'<span class="pj-category-badge">'+esc(p.category||'Web')+'</span>'+featured+'</div>'
    +'<div class="pj-body"><h3 class="pj-card-title">'+esc(p.title)+'</h3>'
    +'<p class="pj-card-desc">'+esc(p.desc)+'</p>'
    +'<div class="pj-tech-row">'+tech+'</div></div>'
    +'<div class="pj-card-footer">'+viewBtn
    +'<button class="pj-btn-details" onclick="PJ.openDetail(\''+esc(p.id)+'\')"><i class="fas fa-info-circle"></i> View Details</button>'
    +'</div></div>';
}

/* ── Render grid ────────────────────────────────────────────── */
function renderGrid(projects){
  var grid = document.getElementById('pjGrid');
  if(!grid) return;
  var list = projects.filter(function(p){
    var mc = activeFilter==='All' || p.category===activeFilter;
    var q  = searchQuery.toLowerCase();
    var ms = !q || p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
              || (p.tech||[]).some(function(t){ return t.toLowerCase().includes(q); });
    return mc && ms;
  });
  if(!list.length){
    grid.innerHTML = '<div class="pj-empty"><i class="fas fa-search"></i><h4>No projects found</h4><p>Try a different filter or search.</p></div>';
    return;
  }
  grid.innerHTML = list.map(function(p,i){ return cardHTML(p,i); }).join('');
  observeCards();
}

/* ── Load projects ──────────────────────────────────────────── */
var allProjects = [];
function loadProjects(){
  var grid = document.getElementById('pjGrid');
  if(grid) grid.innerHTML = '<div class="pj-loading"><div class="pj-spinner"></div>Loading projects…</div>';

  loadFirebase(function(err){
    if(err || !db){
      // Fallback: show demo projects
      allProjects = getDemoProjects();
      renderGrid(allProjects);
      return;
    }
    db.collection('projects').orderBy('createdAt','desc').get().then(function(snap){
      allProjects = [];
      snap.forEach(function(doc){
        var d = doc.data();
        d.id = doc.id;
        allProjects.push(d);
      });
      if(!allProjects.length) allProjects = getDemoProjects();
      renderGrid(allProjects);
    }).catch(function(){
      allProjects = getDemoProjects();
      renderGrid(allProjects);
    });
  });
}

/* ── Demo projects (shown when Firebase not configured) ─────── */
function getDemoProjects(){
  return [
    {id:'demo1',title:'Zypher Code Website',desc:'A full-featured programming education platform with tutorials, community, and course management.',emoji:'🌐',category:'Web',tech:['HTML','CSS','JavaScript'],demoUrl:'#',codeUrl:'#',featured:true,gradient:'linear-gradient(135deg,#1e3a8a,#2563eb)'},
    {id:'demo2',title:'Learning Dashboard',desc:'Mobile-first course dashboard with UPI payment unlock, star ratings, and comment system.',emoji:'📱',category:'App',tech:['HTML','CSS','JavaScript','UPI'],demoUrl:'#',codeUrl:'#',featured:true,gradient:'linear-gradient(135deg,#7c3aed,#2563eb)'},
    {id:'demo3',title:'UPI QR Payment System',desc:'Lightweight video lock + UPI QR code payment unlock system for web-based course platforms.',emoji:'💳',category:'Tools',tech:['JavaScript','QRCode.js'],demoUrl:'#',codeUrl:'#',featured:false,gradient:'linear-gradient(135deg,#16a34a,#22c55e)'},
  ];
}

/* ── Detail modal ───────────────────────────────────────────── */
function openDetail(id){
  var p = allProjects.find(function(x){ return x.id===id; });
  if(!p) return;
  activeProj = p;
  var grad = p.gradient || getGradient(0);
  var hero = p.imageUrl
    ? '<img class="pj-detail-hero-bg" src="'+esc(p.imageUrl)+'" alt="'+esc(p.title)+'">'
    : '<div class="pj-detail-hero-placeholder" style="background:'+grad+'">'+esc(p.emoji||'🚀')+'</div>';
  var tech = (p.tech||[]).map(function(t){ return '<span class="pj-detail-tech-tag">'+esc(t)+'</span>'; }).join('');
  var demoBtn = p.demoUrl ? '<a class="pj-detail-btn-demo" href="'+esc(p.demoUrl)+'" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i> Live Demo</a>' : '';
  var codeBtn = p.codeUrl ? '<a class="pj-detail-btn-code" href="'+esc(p.codeUrl)+'" target="_blank" rel="noopener"><i class="fab fa-github"></i> View Code</a>' : '';
  var adminRow = isAdmin
    ? '<div class="pj-detail-admin-row">'
      +'<button class="pj-btn-edit-proj" onclick="PJ.editProject(\''+esc(id)+'\')"><i class="fas fa-edit"></i> Edit</button>'
      +'<button class="pj-btn-del-proj" onclick="PJ.deleteProject(\''+esc(id)+'\')"><i class="fas fa-trash"></i> Delete</button>'
      +'</div>' : '';
  document.getElementById('pjDetailInner').innerHTML =
    '<div class="pj-detail-hero">'+hero
    +'<button class="pj-detail-close" onclick="PJ.closeDetail()">✕</button></div>'
    +'<div class="pj-detail-body">'
    +'<span class="pj-detail-cat">'+esc(p.category||'Web')+'</span>'
    +'<h2 class="pj-detail-title">'+esc(p.title)+'</h2>'
    +'<p class="pj-detail-desc">'+esc(p.longDesc||p.desc)+'</p>'
    +'<p class="pj-detail-tech-lbl">Tech Stack</p>'
    +'<div class="pj-detail-tech-row">'+tech+'</div>'
    +'<div class="pj-detail-actions">'+demoBtn+codeBtn+'</div>'
    +adminRow+'</div>';
  document.getElementById('pjOverlay').classList.add('pj-open');
  document.body.style.overflow='hidden';
}
function closeDetail(){
  document.getElementById('pjOverlay').classList.remove('pj-open');
  document.body.style.overflow='';
  activeProj = null;
}

/* ── Admin panel: login / logout ────────────────────────────── */
function showAdminForm(){
  document.getElementById('pjAdminLoginWrap').style.display='none';
  document.getElementById('pjAdminFormWrap').style.display='block';
  clearAdminForm();
}
function showAdminLogin(){
  document.getElementById('pjAdminLoginWrap').style.display='block';
  document.getElementById('pjAdminFormWrap').style.display='none';
}
function toggleAdminPanel(){
  var panel = document.getElementById('pjAdminPanel');
  panel.classList.toggle('pj-admin-open');
  if(panel.classList.contains('pj-admin-open')){
    checkAdminSession();
    if(isAdmin){ showAdminForm(); }
    else        { showAdminLogin(); }
  }
}
function adminLogin(){
  var pw = document.getElementById('pjAdminPw');
  if(!pw) return;
  if(pw.value===ADMIN_PASS){
    setAdminSession();
    pw.value='';
    showAdminForm();
    toast('✅ Admin access granted');
  } else {
    toast('❌ Incorrect password');
    pw.value='';
  }
}
function adminLogout(){
  clearAdminSession();
  showAdminLogin();
  document.getElementById('pjAdminPanel').classList.remove('pj-admin-open');
  toast('👋 Logged out');
}

/* ── Admin: clear form ──────────────────────────────────────── */
function clearAdminForm(){
  editingId = null;
  var fields = ['pjFTitle','pjFDesc','pjFLongDesc','pjFTech','pjFDemo','pjFCode','pjFEmoji','pjFImage'];
  fields.forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.value='';
  });
  var cat = document.getElementById('pjFCat'); if(cat) cat.value='Web';
  var feat= document.getElementById('pjFFeat'); if(feat) feat.checked=false;
  var prev= document.getElementById('pjImgPreview');
  if(prev) prev.innerHTML='<span>Image preview</span>';
  var saveBtn = document.getElementById('pjSaveBtn');
  if(saveBtn) saveBtn.innerHTML='<i class="fas fa-plus"></i> Add Project';
  var st = document.getElementById('pjAdminStatus');
  if(st){ st.className='pj-status-msg'; st.textContent=''; }
}

/* ── Admin: save project ────────────────────────────────────── */
function saveProject(){
  if(!isAdmin){ toast('⛔ Not authorised'); return; }
  var title    = (document.getElementById('pjFTitle')||{}).value||'';
  var desc     = (document.getElementById('pjFDesc')||{}).value||'';
  var longDesc = (document.getElementById('pjFLongDesc')||{}).value||'';
  var techRaw  = (document.getElementById('pjFTech')||{}).value||'';
  var demo     = (document.getElementById('pjFDemo')||{}).value||'';
  var code     = (document.getElementById('pjFCode')||{}).value||'';
  var emoji    = (document.getElementById('pjFEmoji')||{}).value||'🚀';
  var imageUrl = (document.getElementById('pjFImage')||{}).value||'';
  var cat      = (document.getElementById('pjFCat')||{}).value||'Web';
  var featured = (document.getElementById('pjFFeat')||{}).checked||false;
  var st       = document.getElementById('pjAdminStatus');
  var saveBtn  = document.getElementById('pjSaveBtn');

  if(!title.trim()){ showStatus(st,'pj-err','⚠️ Title is required.'); return; }
  if(!desc.trim()) { showStatus(st,'pj-err','⚠️ Description is required.'); return; }

  var tech = techRaw.split(',').map(function(t){ return t.trim(); }).filter(Boolean);
  var data = {
    title:title.trim(), desc:desc.trim(), longDesc:longDesc.trim()||desc.trim(),
    tech:tech, demoUrl:demo.trim(), codeUrl:code.trim(),
    emoji:emoji.trim()||'🚀', imageUrl:imageUrl.trim(),
    category:cat, featured:featured,
    createdAt: firebase && firebase.firestore ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
  };

  if(saveBtn){ saveBtn.disabled=true; saveBtn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving…'; }

  function onSuccess(id){
    if(editingId){
      var i = allProjects.findIndex(function(p){ return p.id===editingId; });
      if(i>-1){ data.id=editingId; allProjects[i]=data; }
      toast('✏️ Project updated!');
    } else {
      data.id = id || ('local_'+Date.now());
      allProjects.unshift(data);
      toast('🎉 Project added!');
    }
    renderGrid(allProjects);
    clearAdminForm();
    if(saveBtn){ saveBtn.disabled=false; saveBtn.innerHTML='<i class="fas fa-plus"></i> Add Project'; }
    showStatus(st,'pj-ok','✅ Saved successfully!');
  }

  if(!db){
    // localStorage fallback
    onSuccess('local_'+Date.now());
    return;
  }

  if(editingId){
    db.collection('projects').doc(editingId).update(data)
      .then(function(){ onSuccess(editingId); })
      .catch(function(e){ showStatus(st,'pj-err','❌ '+e.message);
        if(saveBtn){ saveBtn.disabled=false; saveBtn.innerHTML='<i class="fas fa-plus"></i> Add Project'; } });
  } else {
    db.collection('projects').add(data)
      .then(function(ref){ onSuccess(ref.id); })
      .catch(function(e){ showStatus(st,'pj-err','❌ '+e.message);
        if(saveBtn){ saveBtn.disabled=false; saveBtn.innerHTML='<i class="fas fa-plus"></i> Add Project'; } });
  }
}

/* ── Admin: edit / delete ───────────────────────────────────── */
function editProject(id){
  if(!isAdmin) return;
  var p = allProjects.find(function(x){ return x.id===id; });
  if(!p) return;
  closeDetail();
  var panel = document.getElementById('pjAdminPanel');
  panel.classList.add('pj-admin-open');
  showAdminForm();
  editingId = id;
  setTimeout(function(){
    var set = function(elId, val){ var el=document.getElementById(elId); if(el) el.value=val||''; };
    set('pjFTitle',   p.title);
    set('pjFDesc',    p.desc);
    set('pjFLongDesc',p.longDesc||'');
    set('pjFTech',    (p.tech||[]).join(', '));
    set('pjFDemo',    p.demoUrl||'');
    set('pjFCode',    p.codeUrl||'');
    set('pjFEmoji',   p.emoji||'🚀');
    set('pjFImage',   p.imageUrl||'');
    var cat = document.getElementById('pjFCat'); if(cat) cat.value = p.category||'Web';
    var feat= document.getElementById('pjFFeat'); if(feat) feat.checked = !!p.featured;
    if(p.imageUrl){
      var prev = document.getElementById('pjImgPreview');
      if(prev) prev.innerHTML='<img src="'+esc(p.imageUrl)+'" alt="preview">';
    }
    var saveBtn = document.getElementById('pjSaveBtn');
    if(saveBtn) saveBtn.innerHTML='<i class="fas fa-save"></i> Update Project';
    panel.scrollIntoView({behavior:'smooth',block:'start'});
  },100);
}

function deleteProject(id){
  if(!isAdmin) return;
  if(!confirm('Delete this project? This cannot be undone.')) return;
  closeDetail();
  allProjects = allProjects.filter(function(p){ return p.id!==id; });
  renderGrid(allProjects);
  if(db){
    db.collection('projects').doc(id).delete()
      .then(function(){ toast('🗑️ Project deleted'); })
      .catch(function(){ toast('⚠️ Deleted locally; DB error'); });
  } else {
    toast('🗑️ Project removed');
  }
}

/* ── Website order form ─────────────────────────────────────── */
function submitOrder(e){
  if(e) e.preventDefault();
  var get = function(id){ var el=document.getElementById(id); return el?el.value.trim():''; };
  var name    = get('wbName');
  var email   = get('wbEmail');
  var phone   = get('wbPhone');
  var wtype   = get('wbType');
  var purpose = get('wbPurpose');
  var style   = get('wbStyle');
  var budget  = get('wbBudget');
  var deadline= get('wbDeadline');
  var message = get('wbMessage');
  var status  = document.getElementById('wbStatus');
  var btn     = document.getElementById('wbSubmitBtn');

  // Collect checked features
  var feats = [];
  document.querySelectorAll('.wb-feat-check:checked').forEach(function(cb){ feats.push(cb.value); });

  if(!name||!email||!phone||!wtype||!purpose){
    status.className='wb-status wb-err';
    status.textContent='⚠️ Please fill in all required fields.';
    return;
  }

  if(btn){ btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Opening WhatsApp…'; }

  var orderData = {
    name:name, email:email, phone:phone, websiteType:wtype,
    purpose:purpose, designStyle:style, features:feats,
    budget:budget, deadline:deadline, message:message,
    submittedAt: Date.now()
  };

  /* ── Build WhatsApp message ─────────────────────────────────
     Readable, line-by-line format sent as pre-filled WA text
  ─────────────────────────────────────────────────────────── */
  function buildWAMessage(){
    var lines = [];
    lines.push('👋 Hello! I want to build a website.');
    lines.push('');
    lines.push('📋 *WEBSITE BUILD REQUEST*');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('👤 *Name:* '        + name);
    lines.push('📧 *Email:* '       + email);
    lines.push('📱 *Phone:* '       + phone);
    lines.push('🌐 *Website Type:* '+ wtype);
    lines.push('🎯 *Purpose:* '     + purpose);
    lines.push('🎨 *Design Style:* '+ (style   || 'Not specified'));
    lines.push('⚙️ *Features:* '    + (feats.length ? feats.join(', ') : 'Not specified'));
    lines.push('💰 *Budget:* '      + (budget   || 'Not specified'));
    lines.push('📅 *Deadline:* '    + (deadline || 'Flexible'));
    lines.push('💬 *Message:* '     + (message  || 'No extra message'));
    lines.push('━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('_Sent via Zypher Code website_');
    return lines.join('\n');
  }

  /* ── Open WhatsApp ─────────────────────────────────────────── */
  function openWhatsApp(){
    var WA_NUMBERS = ['917053088525', '919718697831']; // both owners
    var text       = encodeURIComponent(buildWAMessage());
    WA_NUMBERS.forEach(function(num, i){
      setTimeout(function(){
        window.open('https://wa.me/' + num + '?text=' + text, '_blank');
      }, i * 700); // 700ms gap so browser allows both popups
    });
  }

  function onSuccess(){
    status.className='wb-status wb-ok';
    status.textContent='✅ WhatsApp is opening — please send the pre-filled message!';
    if(btn){ btn.disabled=false; btn.innerHTML='<i class="fab fa-whatsapp"></i> Submit Website Request'; }
    document.getElementById('wbOrderForm').reset();
    toast('💬 Redirecting to WhatsApp…');
  }

  function onError(msg){
    status.className='wb-status wb-err';
    status.textContent='⚠️ '+msg;
    if(btn){ btn.disabled=false; btn.innerHTML='<i class="fab fa-whatsapp"></i> Submit Website Request'; }
  }

  // Save to Firebase if available, then always open WhatsApp
  if(db){
    db.collection('orders').add(orderData)
      .then(function(){ onSuccess(); openWhatsApp(); })
      .catch(function(){ onSuccess(); openWhatsApp(); });
  } else {
    onSuccess();
    openWhatsApp();
  }
}

/* ── Build Projects section HTML ────────────────────────────── */
function buildProjectsSection(){
  if(document.getElementById('projects-section')) return;
  var sec = document.createElement('section');
  sec.id = 'projects-section';
  sec.setAttribute('aria-label','Projects');
  sec.innerHTML =
    '<div class="pj-container">'
    +'<div class="pj-header">'
    +'<span class="pj-eyebrow">💼 Portfolio</span>'
    +'<h2 class="pj-title">🚀 My <span>Projects</span></h2>'
    +'<p class="pj-subtitle">Real projects built with passion — web, apps, and tools.</p>'
    +'</div>'

    // Admin toggle
    +'<div class="pj-admin-toggle-row">'
    +'<button class="pj-admin-toggle-btn" onclick="PJ.toggleAdmin()"><i class="fas fa-shield-alt"></i> Admin Panel</button>'
    +'</div>'

    // Admin panel
    +'<div class="pj-admin-panel" id="pjAdminPanel">'
    +'<h3><i class="fas fa-cog"></i> Project Admin</h3>'
    // Login wrap
    +'<div id="pjAdminLoginWrap" class="pj-admin-login-wrap">'
    +'<p>Enter admin password to manage projects.</p>'
    +'<input class="pj-admin-input" type="password" id="pjAdminPw" placeholder="Password…" style="margin-bottom:.7rem;max-width:240px;">'
    +'<br><button class="pj-btn-save-proj" onclick="PJ.adminLogin()" style="margin:0 auto;display:inline-flex;"><i class="fas fa-unlock"></i> Login</button>'
    +'</div>'
    // Form wrap
    +'<div id="pjAdminFormWrap" style="display:none;">'
    +'<div class="pj-admin-form-grid">'
    +'<div><label class="pj-admin-label">Project Title *</label><input class="pj-admin-input" id="pjFTitle" placeholder="My Awesome Project"></div>'
    +'<div><label class="pj-admin-label">Category</label>'
    +'<select class="pj-admin-select" id="pjFCat"><option>Web</option><option>App</option><option>AI</option><option>Tools</option></select></div>'
    +'<div class="pj-admin-form-full"><label class="pj-admin-label">Short Description *</label><input class="pj-admin-input" id="pjFDesc" placeholder="What this project does…"></div>'
    +'<div class="pj-admin-form-full"><label class="pj-admin-label">Detailed Description</label><textarea class="pj-admin-textarea" id="pjFLongDesc" placeholder="Full project description…"></textarea></div>'
    +'<div><label class="pj-admin-label">Technologies (comma-separated)</label><input class="pj-admin-input" id="pjFTech" placeholder="HTML, CSS, JavaScript"></div>'
    +'<div><label class="pj-admin-label">Emoji (if no image)</label><input class="pj-admin-input" id="pjFEmoji" placeholder="🚀" maxlength="4"></div>'
    +'<div><label class="pj-admin-label">Demo URL</label><input class="pj-admin-input" id="pjFDemo" placeholder="https://…" type="url"></div>'
    +'<div><label class="pj-admin-label">Code / GitHub URL</label><input class="pj-admin-input" id="pjFCode" placeholder="https://github.com/…" type="url"></div>'
    +'<div class="pj-admin-form-full"><label class="pj-admin-label">Thumbnail Image URL</label><input class="pj-admin-input" id="pjFImage" placeholder="https://…" oninput="PJ.previewImg(this.value)"><div class="pj-img-preview" id="pjImgPreview"><span>Image preview</span></div></div>'
    +'<div class="pj-admin-form-full" style="display:flex;align-items:center;gap:.5rem;"><input type="checkbox" id="pjFFeat" style="accent-color:#2563EB;width:16px;height:16px;"><label class="pj-admin-label" for="pjFFeat" style="margin:0;cursor:pointer;">Mark as Featured ⭐</label></div>'
    +'</div>'
    +'<div id="pjAdminStatus" class="pj-status-msg"></div>'
    +'<div class="pj-admin-actions">'
    +'<button class="pj-btn-save-proj" id="pjSaveBtn" onclick="PJ.saveProject()"><i class="fas fa-plus"></i> Add Project</button>'
    +'<button class="pj-btn-cancel-proj" onclick="PJ.clearForm()">Clear</button>'
    +'<button class="pj-btn-cancel-proj" onclick="PJ.adminLogout()" style="margin-left:auto;border-color:#fca5a5;color:#ef4444;">Logout</button>'
    +'</div></div>'
    +'</div>'

    // Filters + search
    +'<div class="pj-search-wrap"><div class="pj-search-box"><i class="fas fa-search"></i><input class="pj-search-input" id="pjSearch" type="text" placeholder="Search projects…"></div></div>'
    +'<div class="pj-filters" id="pjFilters">'
    +'<button class="pj-filter-btn pj-active" data-cat="All">🗂 All</button>'
    +'<button class="pj-filter-btn" data-cat="Web">🌐 Web</button>'
    +'<button class="pj-filter-btn" data-cat="App">📱 App</button>'
    +'<button class="pj-filter-btn" data-cat="AI">🤖 AI</button>'
    +'<button class="pj-filter-btn" data-cat="Tools">🔧 Tools</button>'
    +'</div>'
    +'<div class="pj-grid" id="pjGrid"><div class="pj-loading"><div class="pj-spinner"></div>Loading…</div></div>'
    +'</div>'

    // Detail modal
    +'<div class="pj-overlay" id="pjOverlay" role="dialog" aria-modal="true">'
    +'<div class="pj-detail-modal"><div id="pjDetailInner"></div></div></div>'

    // Toast
    +'<div class="pj-toast" id="pjToast"></div>';

  var footer = document.querySelector('footer') || document.querySelector('.footer');
  if(footer){ footer.parentNode.insertBefore(sec,footer); }
  else { document.body.appendChild(sec); }

  // Events
  document.getElementById('pjFilters').addEventListener('click',function(e){
    var btn=e.target.closest('.pj-filter-btn'); if(!btn) return;
    document.querySelectorAll('.pj-filter-btn').forEach(function(b){ b.classList.remove('pj-active'); });
    btn.classList.add('pj-active');
    activeFilter=btn.dataset.cat;
    renderGrid(allProjects);
  });
  document.getElementById('pjSearch').addEventListener('input',function(){ searchQuery=this.value; renderGrid(allProjects); });
  document.getElementById('pjOverlay').addEventListener('click',function(e){ if(e.target===this) closeDetail(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeDetail(); });

  // Enter on admin password
  var pw = document.getElementById('pjAdminPw');
  if(pw) pw.addEventListener('keydown',function(e){ if(e.key==='Enter') PJ.adminLogin(); });

  loadProjects();
}

/* ── Build Website Order section HTML ───────────────────────── */
function buildOrderSection(){
  if(document.getElementById('website-order-section')) return;
  var sec = document.createElement('section');
  sec.id = 'website-order-section';
  sec.setAttribute('aria-label','Build Your Website');
  sec.innerHTML =
    '<div class="wb-container">'
    +'<div class="wb-header">'
    +'<span class="wb-eyebrow">🌐 Custom Development</span>'
    +'<h2 class="wb-title">Build Your <span>Website</span></h2>'
    +'<p class="wb-subtitle">Tell me about your dream website and I\'ll bring it to life.</p>'
    +'</div>'
    +'<div class="wb-card">'
    +'<form id="wbOrderForm" onsubmit="PJ.submitOrder(event)">'
    +'<div class="wb-grid">'
    +'<div><label class="wb-label">Full Name <span class="wb-required">*</span></label><input class="wb-input" id="wbName" placeholder="Your full name" required></div>'
    +'<div><label class="wb-label">Email Address <span class="wb-required">*</span></label><input class="wb-input" id="wbEmail" type="email" placeholder="your@email.com" required></div>'
    +'<div><label class="wb-label">Phone Number <span class="wb-required">*</span></label><input class="wb-input" id="wbPhone" placeholder="+91 XXXXXXXXXX" required></div>'
    +'<div><label class="wb-label">Website Type <span class="wb-required">*</span></label>'
    +'<select class="wb-select" id="wbType" required><option value="">Select type…</option>'
    +'<option>Portfolio</option><option>Business</option><option>E-commerce</option><option>Blog</option><option>Custom</option></select></div>'
    +'<div class="wb-full"><label class="wb-label">Website Purpose <span class="wb-required">*</span></label>'
    +'<input class="wb-input" id="wbPurpose" placeholder="What is this website for?" required></div>'
    +'<div><label class="wb-label">Design Style</label>'
    +'<select class="wb-select" id="wbStyle"><option value="">Select style…</option>'
    +'<option>Simple</option><option>Modern</option><option>Premium</option></select></div>'
    +'<div><label class="wb-label">Budget Range</label>'
    +'<select class="wb-select" id="wbBudget"><option value="">Select budget…</option>'
    +'<option>Under ₹5,000</option><option>₹5,000 – ₹15,000</option><option>₹15,000 – ₹30,000</option><option>₹30,000+</option></select></div>'
    +'<div><label class="wb-label">Deadline (optional)</label><input class="wb-input" id="wbDeadline" type="date"></div>'
    +'<div class="wb-full"><label class="wb-label">Features Required</label>'
    +'<div class="wb-check-group">'
    +['Login System','Payment System','Admin Panel','Blog','Gallery','Contact Form','WhatsApp Chat','SEO Optimisation','Multi-language','Custom Domain Setup']
      .map(function(f){ return '<label class="wb-check-item"><input type="checkbox" class="wb-feat-check" value="'+f+'"><span>'+f+'</span></label>'; }).join('')
    +'</div></div>'
    +'<div class="wb-full"><label class="wb-label">Message / Extra Requirements</label>'
    +'<textarea class="wb-textarea" id="wbMessage" placeholder="Any other details…"></textarea></div>'
    +'</div>'
    +'<div id="wbStatus" class="wb-status"></div>'
    +'<div class="wb-submit-row"><button class="wb-submit-btn" id="wbSubmitBtn" type="submit"><i class="fas fa-paper-plane"></i> Submit Website Request</button></div>'
    +'</form></div></div>';

  var footer = document.querySelector('footer') || document.querySelector('.footer');
  var projSec= document.getElementById('projects-section');
  var insertBefore = (projSec && projSec.nextSibling) ? projSec.nextSibling : footer;
  if(insertBefore && insertBefore.parentNode){ insertBefore.parentNode.insertBefore(sec,insertBefore); }
  else if(footer){ footer.parentNode.insertBefore(sec,footer); }
  else { document.body.appendChild(sec); }
}

/* ── Public API ─────────────────────────────────────────────── */
window.PJ = {
  openDetail:   openDetail,
  closeDetail:  closeDetail,
  toggleAdmin:  toggleAdminPanel,
  adminLogin:   adminLogin,
  adminLogout:  adminLogout,
  saveProject:  saveProject,
  editProject:  editProject,
  deleteProject:deleteProject,
  clearForm:    clearAdminForm,
  submitOrder:  submitOrder,
  previewImg: function(url){
    var prev = document.getElementById('pjImgPreview');
    if(!prev) return;
    if(url){ prev.innerHTML='<img src="'+esc(url)+'" alt="preview">'; }
    else    { prev.innerHTML='<span>Image preview</span>'; }
  }
};

/* ── Init ─────────────────────────────────────────────────────*/
function init(){
  checkAdminSession();
  buildProjectsSection();
  buildOrderSection();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
