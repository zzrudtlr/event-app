// =====================================================
// app.js - 이벤트 관리 시스템 메인 로직
// =====================================================

// ---- 앱 상태 ----
const App = {
  view: 'list',       // 'list' | 'detail'
  eventId: null,
  tab: 'info',        // 'info' | 'participants' | 'sponsors' | 'sponsorItems' | 'staff' | 'schedule' | 'preview'
  events: [],
  participants: [],
  sponsors: [],
  sponsorItems: [],
  staff: [],
  schedules: [],
  editingId: null,    // 현재 수정 중인 항목 ID
  sponsorSearch: '',  // 찬조자 검색어
  currentUser: null,
  previewSections: { participants: true, sponsors: true, sponsorItems: true, staff: true, grouping: true, schedule: true },
};

// =====================================================
// 초기화
// =====================================================
async function appInit() {
  const fbOk = initFirebase();
  firebaseEnabled = fbOk;
  showFirebaseBanner(fbOk);

  if (fbOk && auth) {
    auth.onAuthStateChanged(async (user) => {
      App.currentUser = user;
      if (user) {
        updateHeaderUser(user);
        document.getElementById('view-auth').classList.add('hidden');
        await loadEventList();
        showView('list');
      } else {
        updateHeaderUser(null);
        document.getElementById('view-list').classList.add('hidden');
        document.getElementById('view-detail').classList.add('hidden');
        document.getElementById('view-auth').classList.remove('hidden');
      }
    });
  } else {
    // Firebase 미설정: 인증 없이 바로 앱 진입
    await loadEventList();
    showView('list');
  }
}

// =====================================================
// 인증 UI 헬퍼
// =====================================================
function updateHeaderUser(user) {
  const emailEl = document.getElementById('header-user-email');
  const logoutBtn = document.getElementById('btn-logout');
  if (user) {
    emailEl.textContent = user.email;
    logoutBtn.classList.remove('hidden');
  } else {
    emailEl.textContent = '';
    logoutBtn.classList.add('hidden');
  }
}

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('auth-form-login').classList.toggle('hidden', !isLogin);
  document.getElementById('auth-form-signup').classList.toggle('hidden', isLogin);
  document.getElementById('auth-tab-login').classList.toggle('active', isLogin);
  document.getElementById('auth-tab-signup').classList.toggle('active', !isLogin);
  document.getElementById('auth-error-login').textContent = '';
  document.getElementById('auth-error-signup').textContent = '';
}

function getAuthErrorMsg(code) {
  const map = {
    'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
    'auth/invalid-email': '올바른 이메일 형식이 아닙니다.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
    'auth/user-not-found': '등록된 계정이 없습니다.',
    'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/too-many-requests': '너무 많은 시도가 있었습니다. 잠시 후 다시 시도하세요.',
  };
  return map[code] || '오류가 발생했습니다. 다시 시도하세요.';
}

async function handleLogin() {
  const email = document.getElementById('auth-login-email').value.trim();
  const pw = document.getElementById('auth-login-pw').value;
  const errEl = document.getElementById('auth-error-login');
  errEl.textContent = '';
  if (!email || !pw) { errEl.textContent = '이메일과 비밀번호를 입력하세요.'; return; }
  setBtnLoading('btn-login', true);
  try {
    await authSignIn(email, pw);
    // onAuthStateChanged 가 자동으로 메인 앱으로 전환
  } catch (e) {
    errEl.textContent = getAuthErrorMsg(e.code);
  }
  setBtnLoading('btn-login', false);
}

async function handleSignup() {
  const email = document.getElementById('auth-signup-email').value.trim();
  const pw = document.getElementById('auth-signup-pw').value;
  const pw2 = document.getElementById('auth-signup-pw2').value;
  const errEl = document.getElementById('auth-error-signup');
  errEl.textContent = '';
  if (!email || !pw || !pw2) { errEl.textContent = '모든 항목을 입력하세요.'; return; }
  if (pw !== pw2) { errEl.textContent = '비밀번호가 일치하지 않습니다.'; return; }
  if (pw.length < 6) { errEl.textContent = '비밀번호는 6자 이상이어야 합니다.'; return; }
  setBtnLoading('btn-signup', true);
  try {
    await authSignUp(email, pw);
    showToast('회원가입이 완료되었습니다!', 'success');
    // onAuthStateChanged 가 자동으로 메인 앱으로 전환
  } catch (e) {
    errEl.textContent = getAuthErrorMsg(e.code);
  }
  setBtnLoading('btn-signup', false);
}

async function handleLogout() {
  if (!confirm('로그아웃 하시겠습니까?')) return;
  try {
    await authSignOut();
    App.events = [];
    App.currentUser = null;
  } catch (e) {
    showToast('로그아웃 실패: ' + e.message, 'error');
  }
}

function showFirebaseBanner(enabled) {
  const banner = document.getElementById('firebase-banner');
  if (!banner) return;
  if (enabled) {
    banner.className = 'firebase-banner success';
    banner.innerHTML = '✅ Firebase Firestore에 연결되었습니다. 데이터가 클라우드에 저장됩니다.';
  } else {
    banner.className = 'firebase-banner';
    banner.innerHTML = '⚠️ Firebase 미설정 상태입니다. 데이터가 브라우저(localStorage)에 임시 저장됩니다. <a href="#" onclick="document.getElementById(\'firebase-guide\').classList.toggle(\'hidden\')" style="color:#92400e;text-decoration:underline">설정 방법 보기</a>';
  }
}

// =====================================================
// 뷰 전환
// =====================================================
function showView(view) {
  App.view = view;
  document.getElementById('view-list').classList.toggle('hidden', view !== 'list');
  document.getElementById('view-detail').classList.toggle('hidden', view !== 'detail');
  document.getElementById('header-back').classList.toggle('hidden', view !== 'detail');
  document.getElementById('header-title').textContent = view === 'list' ? '이벤트 관리' : (App.events.find(e => e.id === App.eventId)?.title || '이벤트 상세');
}

function goBack() {
  showView('list');
  loadEventList();
}

function copyAttendLink() {
  const url = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}attend.html?event=${App.eventId}`;
  navigator.clipboard.writeText(url).then(() => showToast('참석 신청 링크가 복사되었습니다.', 'success'));
}

// =====================================================
// 이벤트 목록
// =====================================================
async function loadEventList() {
  try {
    App.events = await getEvents();
    renderEventList();
  } catch (e) {
    showToast('이벤트 목록 로드 실패: ' + e.message, 'error');
  }
}

function renderEventList() {
  const container = document.getElementById('event-list-container');
  if (!App.events.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📅</div><p>이벤트가 없습니다.<br>새 이벤트를 만들어보세요!</p></div>`;
    return;
  }
  container.innerHTML = App.events.map(event => `
    <div class="event-card" onclick="navigateToDetail('${event.id}')">
      <div class="event-card-title">${esc(event.title)}</div>
      <div class="event-card-meta">
        <span>📅 ${event.eventDate || '-'}</span>
        <span>📍 ${esc(event.location || '-')}</span>
        <span>🏢 ${esc(event.organizer || '-')}</span>
        <span style="margin-left:auto;color:#94a3b8;font-size:.75rem">수정: ${formatDateTime(event.updatedAt)}</span>
      </div>
      <div class="event-card-actions" onclick="event.stopPropagation()">
        <button class="btn btn-primary btn-sm" onclick="navigateToDetail('${event.id}')">📂 상세 관리</button>
        <button class="btn btn-secondary btn-sm" onclick="openEventModal('${event.id}')">✏️ 수정</button>
        <button class="btn btn-secondary btn-sm" onclick="handleDuplicateEvent('${event.id}')">📋 복사</button>
        <button class="btn btn-danger btn-sm" onclick="handleDeleteEvent('${event.id}')">🗑 삭제</button>
      </div>
    </div>
  `).join('');
}

async function navigateToDetail(eventId) {
  App.eventId = eventId;
  App.tab = 'info';
  showView('detail');
  document.getElementById('header-title').textContent = App.events.find(e => e.id === eventId)?.title || '이벤트 상세';
  await loadDetailData();
}

async function loadDetailData() {
  try {
    const [p, s, si, st, ev, sch] = await Promise.all([
      getParticipants(App.eventId),
      getSponsors(App.eventId),
      getSponsorItems(App.eventId),
      getStaff(App.eventId),
      getEvent(App.eventId),
      getSchedules(App.eventId),
    ]);
    App.participants = p;
    App.sponsors = s;
    App.sponsorItems = si;
    App.staff = st;
    App.schedules = sch;
    if (ev) App.events = App.events.map(e => e.id === ev.id ? ev : e);
    switchTab(App.tab);
  } catch (e) {
    showToast('데이터 로드 실패: ' + e.message, 'error');
  }
}

// =====================================================
// 이벤트 CRUD
// =====================================================
function openEventModal(eventId = null) {
  App.editingId = eventId;
  const event = eventId ? App.events.find(e => e.id === eventId) : null;
  document.getElementById('event-modal-title').textContent = eventId ? '이벤트 수정' : '새 이벤트 만들기';
  setVal('event-title', event?.title || '');
  setVal('event-content', event?.content || '');
  setVal('event-purpose', event?.purpose || '');
  setVal('event-date', event?.eventDate || '');
  setVal('event-location', event?.location || '');
  setVal('event-organizer', event?.organizer || '');
  setVal('event-notice', event?.notice || '');
  const opts = event?.attendOptions || [];
  document.getElementById('opt-exercise').checked = opts.includes('운동');
  document.getElementById('opt-both').checked     = opts.includes('운동+회식');
  document.getElementById('opt-dinner').checked   = opts.includes('회식');
  updateTemplateSelect();
  openModal('modal-event');
}

async function handleSaveEvent() {
  const title = getVal('event-title').trim();
  if (!title) { showToast('이벤트 제목을 입력하세요.', 'error'); return; }

  const data = {
    title,
    content: getVal('event-content').trim(),
    purpose: getVal('event-purpose').trim(),
    eventDate: getVal('event-date'),
    location: getVal('event-location').trim(),
    organizer: getVal('event-organizer').trim(),
    notice: getVal('event-notice').trim(),
    attendOptions: ['opt-exercise','opt-both','opt-dinner']
      .filter(id => document.getElementById(id).checked)
      .map(id => document.getElementById(id).value),
  };

  setBtnLoading('btn-save-event', true);
  try {
    if (App.editingId) {
      await updateEvent(App.editingId, data);
      showToast('이벤트가 수정되었습니다.', 'success');
    } else {
      await createEvent(data);
      showToast('이벤트가 생성되었습니다.', 'success');
    }
    closeModal('modal-event');
    await loadEventList();
  } catch (e) {
    showToast('저장 실패: ' + e.message, 'error');
  }
  setBtnLoading('btn-save-event', false);
}

async function handleDeleteEvent(eventId) {
  const ev = App.events.find(e => e.id === eventId);
  if (!confirm(`"${ev?.title}" 이벤트를 삭제하시겠습니까?\n이벤트의 모든 데이터(참가자, 찬조자 등)가 함께 삭제됩니다.`)) return;
  try {
    await deleteEvent(eventId);
    showToast('이벤트가 삭제되었습니다.', 'success');
    if (App.eventId === eventId) showView('list');
    await loadEventList();
  } catch (e) {
    showToast('삭제 실패: ' + e.message, 'error');
  }
}

async function handleDuplicateEvent(eventId) {
  try {
    await duplicateEvent(eventId);
    showToast('이벤트가 복사되었습니다.', 'success');
    await loadEventList();
  } catch (e) {
    showToast('복사 실패: ' + e.message, 'error');
  }
}

// =====================================================
// 탭 전환
// =====================================================
function switchTab(tab) {
  App.tab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.tab !== tab);
  });
  if (tab === 'info') renderInfoTab();
  if (tab === 'participants') renderParticipants();
  if (tab === 'sponsors') renderSponsors();
  if (tab === 'staff') renderStaff();
  if (tab === 'schedule') renderScheduleTab();
  if (tab === 'preview') renderPreviewTab();
  if (tab === 'grouping') renderGroupingTab();
}

// =====================================================
// 기본정보 탭
// =====================================================
function renderInfoTab() {
  const ev = App.events.find(e => e.id === App.eventId);
  if (!ev) return;
  const panel = document.getElementById('panel-info');
  panel.innerHTML = `
    <div class="section-card">
      <div class="section-header">
        <span class="section-title">📋 기본 정보</span>
        <button class="btn btn-outline btn-sm" onclick="openEventModal('${ev.id}')">✏️ 수정</button>
      </div>
      <div class="info-grid">
        <div class="info-item"><label>이벤트 제목</label><p>${esc(ev.title)}</p></div>
        <div class="info-item"><label>이벤트 내용</label><p>${esc(ev.content || '-')}</p></div>
        <div class="info-item"><label>이벤트 목적</label><p>${esc(ev.purpose || '-')}</p></div>
        <div class="info-item"><label>일자</label><p>${ev.eventDate || '-'}</p></div>
        <div class="info-item"><label>장소</label><p>${esc(ev.location || '-')}</p></div>
        <div class="info-item"><label>주최/주관</label><p>${esc(ev.organizer || '-')}</p></div>
        <div class="info-item"><label>생성일</label><p>${formatDateTime(ev.createdAt)}</p></div>
        <div class="info-item"><label>수정일</label><p>${formatDateTime(ev.updatedAt)}</p></div>
      </div>
      ${ev.notice ? `<div style="margin-top:16px"><label style="font-size:.75rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">안내사항</label><div style="margin-top:6px;background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 14px;border-radius:0 8px 8px 0;font-size:.9rem;white-space:pre-wrap">${esc(ev.notice)}</div></div>` : ''}
      <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
        <span class="badge badge-blue">참가자 ${App.participants.length}명</span>
        <span class="badge badge-green">찬조자 ${App.sponsors.length}명</span>
        <span class="badge badge-gray">운영진 ${App.staff.length}명</span>
      </div>
      ${(() => {
        if (!ev.attendOptions || !ev.attendOptions.length) return '';
        const url = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}attend.html?event=${ev.id}`;
        App._attendUrl = url;
        return `
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #f1f5f9">
          <div style="font-size:.75rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">참석 신청 링크</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
            <div style="flex:1;min-width:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:.78rem;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${url}</div>
            <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText(App._attendUrl).then(()=>showToast('링크가 복사되었습니다.','success'))">🔗 복사</button>
            <a href="${url}" target="_blank" class="btn btn-outline btn-sm">↗ 열기</a>
          </div>
          <div style="font-size:.8rem;color:#64748b">참석 옵션: ${ev.attendOptions.map(o=>`<span class="badge badge-blue" style="font-size:.72rem;margin-right:3px">${esc(o)}</span>`).join('')}</div>
        </div>`;
      })()}
    </div>`;
}

// =====================================================
// 참가자 탭
// =====================================================
function renderParticipants() {
  const panel = document.getElementById('panel-participants');
  const ev    = App.events.find(e => e.id === App.eventId);
  const opts  = ev?.attendOptions?.length ? ev.attendOptions : [];

  // 참석구분 설정이 있으면 그룹 뷰, 없으면 단일 테이블
  const hasGroups = opts.length > 0 || App.participants.some(p => p.attendType);

  function makeRow(p, i) {
    return `<tr>
      <td>${i}</td>
      <td><strong>${esc(p.name)}</strong></td>
      <td>${esc(p.grade || '-')}</td>
      <td>${p.age || '-'}</td>
      <td>${p.career ? p.career + '년' : '-'}</td>
      <td>${esc(p.gender || '-')}</td>
      <td>${esc(p.affiliation || '-')}</td>
      <td>${esc(p.phone || '-')}</td>
      <td>${esc(p.memo || '-')}</td>
      <td>
        <button class="btn btn-secondary btn-sm btn-icon" onclick="openParticipantModal('${p.id}')">✏️</button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="handleDeleteParticipant('${p.id}')">🗑</button>
      </td>
    </tr>`;
  }

  const thead = `<thead><tr><th>#</th><th>이름</th><th>급수</th><th>나이</th><th>경력</th><th>성별</th><th>소속</th><th>연락처</th><th>비고</th><th>관리</th></tr></thead>`;

  let tableHTML = '';
  if (!App.participants.length) {
    tableHTML = `<table class="data-table">${thead}<tbody><tr><td colspan="10"><div class="empty-state"><div class="icon">👥</div><p>참가자가 없습니다.</p></div></td></tr></tbody></table>`;
  } else if (hasGroups) {
    // 그룹 순서: attendOptions 순 → 미설정
    const groupOrder = [...opts];
    App.participants.forEach(p => {
      if (p.attendType && !groupOrder.includes(p.attendType)) groupOrder.push(p.attendType);
    });
    groupOrder.push(''); // 미설정

    const icons = { '운동': '🏃', '운동+회식': '🏃🍽', '회식': '🍽', '': '👤' };
    let seq = 1;
    tableHTML = `<table class="data-table">${thead}<tbody>`;
    groupOrder.forEach(key => {
      const members = App.participants.filter(p => (p.attendType || '') === key);
      if (!members.length) return;
      const label = key || '미설정';
      const icon  = icons[key] ?? '👤';
      tableHTML += `<tr style="background:#f1f5f9">
        <td colspan="10" style="padding:8px 12px;font-weight:700;color:#1e293b;font-size:.875rem;border-bottom:2px solid #e2e8f0">
          ${icon} ${label} <span style="font-weight:400;color:#64748b;font-size:.8rem">${members.length}명</span>
        </td></tr>`;
      members.forEach(p => { tableHTML += makeRow(p, seq++); });
    });
    tableHTML += `</tbody></table>`;
  } else {
    const rows = App.participants.map((p, i) => makeRow(p, i + 1)).join('');
    tableHTML = `<table class="data-table">${thead}<tbody>${rows}</tbody></table>`;
  }

  panel.innerHTML = `
    <div class="section-card">
      <div class="section-header">
        <span class="section-title">👥 참가자 목록 (${App.participants.length}명)</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="openParticipantModal()">+ 직접 추가</button>
          <button class="btn btn-secondary btn-sm" onclick="openPasteModal()">📋 텍스트 붙여넣기</button>
          <button class="btn btn-secondary btn-sm" onclick="openFileUploadModal()">📁 파일 업로드</button>
          <button class="btn btn-secondary btn-sm" onclick="copyAttendLink()">🔗 참석 링크 복사</button>
          ${App.participants.length ? `<button class="btn btn-secondary btn-sm" onclick="exportParticipantsCSV(App.events.find(e=>e.id===App.eventId), App.participants)">⬇ CSV</button>` : ''}
          ${App.participants.length ? `<button class="btn btn-danger btn-sm" onclick="handleClearAllParticipants()">🗑 전체 초기화</button>` : ''}
        </div>
      </div>
      <div class="table-wrap">${tableHTML}</div>
    </div>`;

  panel.innerHTML = renderParticipantStats(App.participants) + panel.innerHTML;
}

function openParticipantModal(participantId = null) {
  App.editingId = participantId;
  const p = participantId ? App.participants.find(p => p.id === participantId) : null;
  document.getElementById('participant-modal-title').textContent = participantId ? '참가자 수정' : '참가자 추가';
  setVal('p-name', p?.name || '');
  setVal('p-grade', p?.grade || '');
  setVal('p-age', p?.age || '');
  setVal('p-career', p?.career || '');
  setVal('p-gender', p?.gender || '');
  setVal('p-affiliation', p?.affiliation || '');
  setVal('p-phone', p?.phone || '');
  setVal('p-memo', p?.memo || '');

  const ev = App.events.find(e => e.id === App.eventId);
  const opts = ev?.attendOptions?.length ? ev.attendOptions : ['운동', '운동+회식', '회식'];
  const sel = document.getElementById('p-attend-type');
  const defaultType = p?.attendType ?? (opts.includes('운동') ? '운동' : opts[0] ?? '');
  sel.innerHTML = `<option value="">선택 안 함</option>` +
    opts.map(o => `<option value="${o}" ${o === defaultType ? 'selected' : ''}>${o}</option>`).join('');

  openModal('modal-participant');
}

async function handleSaveParticipant() {
  const name = getVal('p-name').trim();
  if (!name) { showToast('이름을 입력하세요.', 'error'); return; }

  // 중복 감지
  const phone = getVal('p-phone').trim();
  const dups = App.participants.filter(p => {
    if (App.editingId && p.id === App.editingId) return false;
    return p.name === name || (phone && p.phone && p.phone === phone);
  });
  if (dups.length) {
    const info = dups.map(p => `${p.name}${p.phone ? ' (' + p.phone + ')' : ''}`).join('\n');
    if (!confirm(`이미 등록된 참가자와 중복됩니다:\n${info}\n\n계속 추가하시겠습니까?`)) return;
  }

  const data = {
    name, grade: getVal('p-grade').trim(),
    age: Number(getVal('p-age')) || '',
    career: Number(getVal('p-career')) || '',
    gender: getVal('p-gender'),
    affiliation: getVal('p-affiliation').trim(),
    phone: getVal('p-phone').trim(),
    memo: getVal('p-memo').trim(),
    attendType: getVal('p-attend-type'),
  };
  setBtnLoading('btn-save-participant', true);
  try {
    if (App.editingId) {
      await updateParticipant(App.eventId, App.editingId, data);
      App.participants = App.participants.map(p => p.id === App.editingId ? { ...p, ...data } : p);
    } else {
      const id = await addParticipant(App.eventId, data);
      App.participants.push({ id, ...data });
    }
    showToast('저장되었습니다.', 'success');
    closeModal('modal-participant');
    renderParticipants();
  } catch (e) {
    showToast('저장 실패: ' + e.message, 'error');
  }
  setBtnLoading('btn-save-participant', false);
}

async function handleDeleteParticipant(participantId) {
  if (!confirm('이 참가자를 삭제하시겠습니까?')) return;
  try {
    await deleteParticipant(App.eventId, participantId);
    App.participants = App.participants.filter(p => p.id !== participantId);
    showToast('삭제되었습니다.', 'success');
    renderParticipants();
  } catch (e) {
    showToast('삭제 실패: ' + e.message, 'error');
  }
}

// ---- 참가자 전체 초기화 ----
async function handleClearAllParticipants() {
  if (!App.participants.length) return;
  if (!confirm(`참가자 전체(${App.participants.length}명)를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
  try {
    for (const p of App.participants) await deleteParticipant(App.eventId, p.id);
    App.participants = [];
    showToast('참가자 전체가 초기화되었습니다.', 'success');
    renderParticipants();
  } catch (e) {
    showToast('초기화 실패: ' + e.message, 'error');
  }
}

// ---- 참가자 텍스트 복사 ----
function copyParticipantsText() {
  if (!App.participants.length) { showToast('참가자가 없습니다.', 'error'); return; }
  const ev   = App.events.find(e => e.id === App.eventId);
  const opts = ev?.attendOptions?.length ? ev.attendOptions : [];
  const hasGroups = opts.length > 0 || App.participants.some(p => p.attendType);
  const icons = { '운동': '🏃', '운동+회식': '🏃🍽', '회식': '🍽', '': '👤' };

  const lines = [];
  const metaParts = [ev?.eventDate, ev?.location, ev?.organizer].filter(Boolean);
  lines.push(`=== ${ev?.title || '참가자 명단'} ===`);
  if (metaParts.length) lines.push(metaParts.join(' · '));
  lines.push(`총 ${App.participants.length}명`);
  lines.push('');

  if (hasGroups) {
    const groupOrder = [...opts];
    App.participants.forEach(p => { if (p.attendType && !groupOrder.includes(p.attendType)) groupOrder.push(p.attendType); });
    groupOrder.push('');
    groupOrder.forEach(key => {
      const members = App.participants.filter(p => (p.attendType || '') === key);
      if (!members.length) return;
      const label = key || '미설정';
      lines.push(`${icons[key] ?? '👤'} ${label} (${members.length}명)`);
      members.forEach((p, i) => {
        const parts = [p.grade, p.gender, p.age ? p.age + '세' : null, p.career ? p.career + '년' : null].filter(Boolean);
        lines.push(`  ${i + 1}. ${p.name}${parts.length ? ' | ' + parts.join(' | ') : ''}`);
      });
      lines.push('');
    });
  } else {
    App.participants.forEach((p, i) => {
      const parts = [p.grade, p.gender, p.age ? p.age + '세' : null, p.career ? p.career + '년' : null].filter(Boolean);
      lines.push(`${i + 1}. ${p.name}${parts.length ? ' | ' + parts.join(' | ') : ''}`);
    });
  }

  navigator.clipboard.writeText(lines.join('\n')).then(
    () => showToast('참가자 명단이 복사되었습니다.', 'success'),
    () => showToast('복사에 실패했습니다.', 'error')
  );
}

// ---- 참가자 이미지 다운로드 ----
async function downloadParticipantsImage() {
  if (!App.participants.length) { showToast('참가자가 없습니다.', 'error'); return; }
  if (typeof html2canvas === 'undefined') { showToast('이미지 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도하세요.', 'error'); return; }

  const ev   = App.events.find(e => e.id === App.eventId);
  const opts = ev?.attendOptions?.length ? ev.attendOptions : [];
  const hasGroups = opts.length > 0 || App.participants.some(p => p.attendType);
  const icons = { '운동': '🏃', '운동+회식': '🏃🍽', '회식': '🍽', '': '👤' };

  const s = (t) => String(t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function makeTable(members, startSeq) {
    const rows = members.map((p, i) => `
      <tr style="background:${i % 2 ? '#f8fafc' : 'white'}">
        <td style="padding:7px 10px;color:#94a3b8;font-size:.8rem;width:30px">${startSeq + i}</td>
        <td style="padding:7px 10px;font-weight:600">${s(p.name)}</td>
        <td style="padding:7px 10px;color:#4f46e5;font-size:.85rem">${s(p.grade || '-')}</td>
        <td style="padding:7px 10px;color:${p.gender==='남'?'#2563eb':'#db2777'};font-size:.85rem">${s(p.gender || '-')}</td>
        <td style="padding:7px 10px;color:#64748b;font-size:.85rem">${p.age ? p.age + '세' : '-'}</td>
        <td style="padding:7px 10px;color:#64748b;font-size:.85rem">${p.career ? p.career + '년' : '-'}</td>
      </tr>`).join('');
    return `<table style="width:100%;border-collapse:collapse;font-family:'Noto Sans KR',sans-serif">
      <thead><tr style="background:#f1f5f9">
        <th style="padding:7px 10px;text-align:left;font-size:.75rem;color:#64748b;font-weight:600">#</th>
        <th style="padding:7px 10px;text-align:left;font-size:.75rem;color:#64748b;font-weight:600">이름</th>
        <th style="padding:7px 10px;text-align:left;font-size:.75rem;color:#64748b;font-weight:600">급수</th>
        <th style="padding:7px 10px;text-align:left;font-size:.75rem;color:#64748b;font-weight:600">성별</th>
        <th style="padding:7px 10px;text-align:left;font-size:.75rem;color:#64748b;font-weight:600">나이</th>
        <th style="padding:7px 10px;text-align:left;font-size:.75rem;color:#64748b;font-weight:600">경력</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  let bodyHTML = '';
  if (hasGroups) {
    const groupOrder = [...opts];
    App.participants.forEach(p => { if (p.attendType && !groupOrder.includes(p.attendType)) groupOrder.push(p.attendType); });
    groupOrder.push('');
    let seq = 1;
    groupOrder.forEach(key => {
      const members = App.participants.filter(p => (p.attendType || '') === key);
      if (!members.length) return;
      bodyHTML += `
        <div style="margin-bottom:18px">
          <div style="background:#1d4ed8;color:white;padding:8px 14px;border-radius:8px 8px 0 0;font-weight:700;font-size:.9rem">
            ${icons[key] ?? '👤'} ${s(key || '미설정')} <span style="font-weight:400;opacity:.8">${members.length}명</span>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;overflow:hidden">
            ${makeTable(members, seq)}
          </div>
        </div>`;
      seq += members.length;
    });
  } else {
    bodyHTML = `<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">${makeTable(App.participants, 1)}</div>`;
  }

  const metaParts = [ev?.eventDate, ev?.location, ev?.organizer].filter(Boolean).join(' · ');
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:680px;background:white;padding:28px;box-sizing:border-box;font-family:Noto Sans KR,sans-serif';
  wrap.innerHTML = `
    <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #1d4ed8">
      <div style="font-size:1.2rem;font-weight:700;color:#1e293b;margin-bottom:4px">${s(ev?.title || '참가자 명단')}</div>
      ${metaParts ? `<div style="font-size:.85rem;color:#64748b">${s(metaParts)}</div>` : ''}
      <div style="margin-top:6px;font-size:.8rem;color:#94a3b8">총 ${App.participants.length}명 · ${new Date().toLocaleDateString('ko-KR')} 출력</div>
    </div>
    ${bodyHTML}
  `;
  document.body.appendChild(wrap);

  try {
    const canvas = await html2canvas(wrap, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.download = `${(ev?.title || '참가자명단').replace(/[\\/:*?"<>|]/g, '_')}_참가자.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('이미지로 저장되었습니다.', 'success');
  } catch (e) {
    showToast('이미지 생성 실패: ' + e.message, 'error');
  }
  document.body.removeChild(wrap);
}

// ---- 이벤트 기본 attendType 헬퍼 ----
function getDefaultAttendType() {
  const ev = App.events.find(e => e.id === App.eventId);
  const opts = ev?.attendOptions?.length ? ev.attendOptions : ['운동', '운동+회식', '회식'];
  return opts.includes('운동') ? '운동' : (opts[0] || '운동');
}

// ---- paste 모달 열기 ----
function openPasteModal() {
  const ev = App.events.find(e => e.id === App.eventId);
  const opts = ev?.attendOptions?.length ? ev.attendOptions : ['운동', '운동+회식', '회식'];
  const def  = getDefaultAttendType();
  document.getElementById('paste-attend-type').innerHTML =
    opts.map(o => `<option value="${o}" ${o === def ? 'selected' : ''}>${o}</option>`).join('');
  openModal('modal-paste');
}

// ---- 텍스트 붙여넣기 파싱 ----
async function handlePasteImport() {
  const text = getVal('paste-text').trim();
  if (!text) { showToast('텍스트를 입력하세요.', 'error'); return; }
  const attendType = getVal('paste-attend-type') || getDefaultAttendType();
  const parsed = parseParticipantText(text).map(p => ({ ...p, attendType }));
  if (!parsed.length) { showToast('파싱된 참가자가 없습니다. 형식을 확인해주세요.', 'warning'); return; }
  const dupNamesPaste = parsed
    .filter(p => App.participants.some(ep => ep.name === p.name || (p.phone && ep.phone && ep.phone === p.phone)))
    .map(p => p.name);
  if (dupNamesPaste.length && !confirm(`다음 참가자가 이미 등록되어 있습니다:\n${dupNamesPaste.join(', ')}\n\n중복 포함하여 모두 추가하시겠습니까?`)) return;
  setBtnLoading('btn-paste-import', true);
  try {
    await addParticipantsBatch(App.eventId, parsed);
    App.participants = await getParticipants(App.eventId);
    showToast(`${parsed.length}명 추가되었습니다.`, 'success');
    closeModal('modal-paste');
    setVal('paste-text', '');
    renderParticipants();
  } catch (e) {
    showToast('저장 실패: ' + e.message, 'error');
  }
  setBtnLoading('btn-paste-import', false);
}

function parseParticipantText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const results = [];
  const delimiters = /[\t,|]/;
  const genderMap = { '남': '남', '여': '여', 'm': '남', 'f': '여', 'male': '남', 'female': '여' };

  for (const line of lines) {
    if (/^[#번호이름name]/i.test(line)) continue; // 헤더 행 스킵
    const cols = line.split(delimiters).map(c => c.trim());
    if (!cols[0]) continue;

    // 컬럼 순서: 이름, 급수, 나이, 경력, 성별, 소속, 연락처, 비고
    const p = {
      name: cols[0] || '',
      grade: cols[1] || '',
      age: Number(cols[2]) || '',
      career: Number(cols[3]) || '',
      gender: genderMap[(cols[4] || '').toLowerCase()] || cols[4] || '',
      affiliation: cols[5] || '',
      phone: cols[6] || '',
      memo: cols[7] || '',
    };
    if (p.name) results.push(p);
  }
  return results;
}

// ---- 파일 업로드 모달 ----
function openFileUploadModal() {
  const ev   = App.events.find(e => e.id === App.eventId);
  const opts = ev?.attendOptions?.length ? ev.attendOptions : ['운동', '운동+회식', '회식'];
  const def  = getDefaultAttendType();
  document.getElementById('file-attend-type').innerHTML =
    opts.map(o => `<option value="${o}" ${o === def ? 'selected' : ''}>${o}</option>`).join('');
  document.getElementById('file-upload-input').value = '';
  document.getElementById('file-upload-name').textContent = '파일을 선택하세요';
  openModal('modal-file-upload');
}

function onFileSelected(input) {
  const name = input.files[0]?.name || '파일을 선택하세요';
  document.getElementById('file-upload-name').textContent = name;
}

// ---- 파일 업로드 파싱 ----
async function handleFileUpload() {
  const input = document.getElementById('file-upload-input');
  const file  = input.files[0];
  if (!file) { showToast('파일을 선택하세요.', 'error'); return; }
  const attendType = document.getElementById('file-attend-type').value || getDefaultAttendType();
  const ext = file.name.split('.').pop().toLowerCase();
  setBtnLoading('btn-file-upload', true);
  try {
    let participants = [];
    if (ext === 'csv' || ext === 'txt') {
      participants = parseParticipantText(await file.text());
    } else if (ext === 'xlsx' || ext === 'xls') {
      participants = await parseExcelFile(file);
    } else {
      showToast('지원하지 않는 파일 형식입니다. (csv, txt, xlsx, xls)', 'error');
      setBtnLoading('btn-file-upload', false);
      return;
    }
    if (!participants.length) {
      showToast('파싱된 참가자가 없습니다.', 'warning');
      setBtnLoading('btn-file-upload', false);
      return;
    }
    participants = participants.map(p => ({ ...p, attendType }));
    const dupNamesFile = participants
      .filter(p => App.participants.some(ep => ep.name === p.name || (p.phone && ep.phone && ep.phone === p.phone)))
      .map(p => p.name);
    if (dupNamesFile.length && !confirm(`다음 참가자가 이미 등록되어 있습니다:\n${dupNamesFile.join(', ')}\n\n중복 포함하여 모두 추가하시겠습니까?`)) {
      setBtnLoading('btn-file-upload', false);
      return;
    }
    await addParticipantsBatch(App.eventId, participants);
    App.participants = await getParticipants(App.eventId);
    showToast(`${participants.length}명 추가되었습니다.`, 'success');
    closeModal('modal-file-upload');
    renderParticipants();
  } catch (e) {
    showToast('파일 처리 실패: ' + e.message, 'error');
  }
  setBtnLoading('btn-file-upload', false);
}

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    if (typeof XLSX === 'undefined') {
      reject(new Error('SheetJS 라이브러리가 로드되지 않았습니다.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const genderMap = { '남': '남', '여': '여', 'm': '남', 'f': '여' };
        const results = [];
        let startRow = 0;
        // 헤더 행 감지
        if (rows.length && /이름|name/i.test(String(rows[0][0] || ''))) startRow = 1;
        for (let i = startRow; i < rows.length; i++) {
          const cols = rows[i].map(c => String(c || '').trim());
          if (!cols[0]) continue;
          results.push({
            name: cols[0],
            grade: cols[1] || '',
            age: Number(cols[2]) || '',
            career: Number(cols[3]) || '',
            gender: genderMap[(cols[4] || '').toLowerCase()] || cols[4] || '',
            affiliation: cols[5] || '',
            phone: cols[6] || '',
            memo: cols[7] || '',
          });
        }
        resolve(results);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsArrayBuffer(file);
  });
}

// =====================================================
// 참가자 통계 차트
// =====================================================
function toggleStats() {
  const b = document.getElementById('stats-body');
  const i = document.getElementById('stats-icon');
  if (!b) return;
  const hidden = b.style.display === 'none';
  b.style.display = hidden ? '' : 'none';
  if (i) i.textContent = hidden ? '▲' : '▼';
}

function renderParticipantStats(participants) {
  if (!participants.length) return '';
  const total = participants.length;

  const count = (arr, key, fallback = '미설정') => {
    const m = {};
    arr.forEach(p => { const v = (p[key] || '').trim() || fallback; m[v] = (m[v] || 0) + 1; });
    return m;
  };

  const genderMap  = count(participants, 'gender');
  const gradeRaw   = count(participants, 'grade');
  const attendMap  = participants.some(p => p.attendType) ? count(participants, 'attendType') : {};

  const gradeOrder = ['S','A','B','C','D','초보','미설정'];
  const sortedGrades = Object.entries(gradeRaw).sort((a, b) => {
    const ai = gradeOrder.indexOf(a[0]), bi = gradeOrder.indexOf(b[0]);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });

  const genderColors = { '남':'#3b82f6', '여':'#ec4899', '미설정':'#94a3b8' };
  const gradeColors  = { S:'#d97706', A:'#16a34a', B:'#2563eb', C:'#9333ea', D:'#dc2626', '초보':'#64748b', '미설정':'#94a3b8' };

  const bar = (label, val, color) => {
    const pct = Math.round((val / total) * 100);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
      <div style="width:52px;font-size:.75rem;color:#475569;text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(label)}">${esc(label)}</div>
      <div style="flex:1;background:#f1f5f9;border-radius:3px;height:16px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:3px"></div>
      </div>
      <div style="width:62px;font-size:.72rem;color:#64748b;flex-shrink:0">${val}명 (${pct}%)</div>
    </div>`;
  };

  const hasGrade  = Object.keys(gradeRaw).some(g => g !== '미설정');
  const hasAttend = Object.keys(attendMap).length > 0;

  return `
    <div class="section-card" style="margin-bottom:16px">
      <div class="section-header" style="cursor:pointer;margin-bottom:0" onclick="toggleStats()">
        <span class="section-title">📊 참가자 통계 <span style="font-size:.8rem;font-weight:400;color:#64748b">총 ${total}명</span></span>
        <span id="stats-icon" style="font-size:.85rem;color:#94a3b8">▲</span>
      </div>
      <div id="stats-body" style="margin-top:14px">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px">
          <div>
            <div style="font-size:.72rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">성별</div>
            ${Object.entries(genderMap).map(([k,v]) => bar(k, v, genderColors[k]||'#94a3b8')).join('')}
          </div>
          ${hasGrade ? `<div>
            <div style="font-size:.72rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">급수</div>
            ${sortedGrades.map(([k,v]) => bar(k, v, gradeColors[k]||'#64748b')).join('')}
          </div>` : ''}
          ${hasAttend ? `<div>
            <div style="font-size:.72rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">참석 구분</div>
            ${Object.entries(attendMap).map(([k,v]) => bar(k, v, '#1d4ed8')).join('')}
          </div>` : ''}
        </div>
      </div>
    </div>`;
}

// =====================================================
// 찬조 탭 (찬조자 + 찬조물품 통합)
// =====================================================
function renderSponsors() {
  // ---- 찬조자 ----
  const q = App.sponsorSearch.toLowerCase();
  const filtered = q ? App.sponsors.filter(s =>
    (s.name || '').toLowerCase().includes(q) ||
    (s.affiliation || '').toLowerCase().includes(q)
  ) : App.sponsors;

  const sponsorRows = filtered.length
    ? filtered.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${esc(s.name)}</strong></td>
        <td>${esc(s.phone || '-')}</td>
        <td>${esc(s.affiliation || '-')}</td>
        <td><span class="badge badge-blue">${esc(s.type || '-')}</span></td>
        <td>${esc(s.memo || '-')}</td>
        <td>
          <button class="btn btn-secondary btn-sm btn-icon" onclick="openSponsorModal('${s.id}')">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="handleDeleteSponsor('${s.id}')">🗑</button>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="7"><div class="empty-state"><div class="icon">🤝</div><p>찬조자가 없습니다.</p></div></td></tr>`;

  // ---- 찬조물품 ----
  const itemRows = App.sponsorItems.length
    ? App.sponsorItems.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${esc(item.itemName)}</strong></td>
        <td>${item.quantity || '-'}</td>
        <td><span class="badge badge-green">${esc(item.sponsorName || '-')}</span></td>
      </tr>`).join('')
    : `<tr><td colspan="4"><div class="empty-state"><div class="icon">🎁</div><p>찬조물품이 없습니다.</p></div></td></tr>`;

  document.getElementById('panel-sponsors').innerHTML = `
    <div class="section-card" style="margin-bottom:16px">
      <div class="section-header">
        <span class="section-title">🤝 찬조자 목록 (${App.sponsors.length}명)</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <input class="search-input" type="text" placeholder="이름/소속 검색" value="${esc(App.sponsorSearch)}" oninput="App.sponsorSearch=this.value;renderSponsors()">
          <button class="btn btn-primary btn-sm" onclick="openSponsorModal()">+ 추가</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>#</th><th>찬조자명</th><th>연락처</th><th>소속</th><th>찬조구분</th><th>메모</th><th>관리</th></tr></thead>
          <tbody>${sponsorRows}</tbody>
        </table>
      </div>
    </div>
    <div class="section-card">
      <div class="section-header">
        <span class="section-title">🎁 찬조물품 목록 (${App.sponsorItems.length}건)</span>
        ${App.sponsorItems.length ? `<button class="btn btn-secondary btn-sm" onclick="exportSponsorItemsCSV(App.events.find(e=>e.id===App.eventId), App.sponsorItems)">⬇ CSV</button>` : ''}
      </div>
<div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>#</th><th>물품명</th><th>수량</th><th>찬조자</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>
    </div>`;
}

function sponsorAddItemRow(name = '', qty = '') {
  const row = document.createElement('div');
  row.className = 'sponsor-item-row';
  row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px';
  row.innerHTML = `
    <input class="form-input s-item-name" type="text" placeholder="물품명" style="flex:2" value="${esc(name)}">
    <input class="form-input s-item-qty" type="number" placeholder="수량" min="1" style="flex:1;min-width:70px" value="${qty}">
    <button type="button" class="btn btn-secondary btn-sm btn-icon" onclick="this.closest('.sponsor-item-row').remove()">✕</button>
  `;
  document.getElementById('s-items-list').appendChild(row);
}

function openSponsorModal(sponsorId = null) {
  App.editingId = sponsorId;
  const s = sponsorId ? App.sponsors.find(s => s.id === sponsorId) : null;
  document.getElementById('sponsor-modal-title').textContent = sponsorId ? '찬조자 수정' : '찬조자 추가';
  setVal('s-name', s?.name || '');
  setVal('s-phone', s?.phone || '');
  setVal('s-affiliation', s?.affiliation || '');
  setVal('s-type', s?.type || '물품');
  setVal('s-memo', s?.memo || '');

  const list = document.getElementById('s-items-list');
  list.innerHTML = '';
  if (sponsorId) {
    App.sponsorItems.filter(i => i.sponsorId === sponsorId)
      .forEach(i => sponsorAddItemRow(i.itemName, i.quantity));
  }

  openModal('modal-sponsor');
}

async function handleSaveSponsor() {
  const name = getVal('s-name').trim();
  if (!name) { showToast('찬조자명을 입력하세요.', 'error'); return; }
  const data = {
    name, phone: getVal('s-phone').trim(),
    affiliation: getVal('s-affiliation').trim(),
    type: getVal('s-type'),
    memo: getVal('s-memo').trim(),
  };

  const newItems = [...document.querySelectorAll('#s-items-list .sponsor-item-row')]
    .map(row => ({
      itemName: row.querySelector('.s-item-name').value.trim(),
      quantity: Number(row.querySelector('.s-item-qty').value) || '',
    }))
    .filter(i => i.itemName);

  setBtnLoading('btn-save-sponsor', true);
  try {
    let sponsorId;
    if (App.editingId) {
      await updateSponsor(App.eventId, App.editingId, data);
      App.sponsors = App.sponsors.map(s => s.id === App.editingId ? { ...s, ...data } : s);
      sponsorId = App.editingId;
      // 기존 연결 물품 삭제 후 재등록
      const oldItems = App.sponsorItems.filter(i => i.sponsorId === sponsorId);
      for (const item of oldItems) await deleteSponsorItem(App.eventId, item.id);
      App.sponsorItems = App.sponsorItems.filter(i => i.sponsorId !== sponsorId);
    } else {
      sponsorId = await addSponsor(App.eventId, data);
      App.sponsors.push({ id: sponsorId, ...data });
    }
    for (const item of newItems) {
      const itemData = { ...item, sponsorId, sponsorName: name };
      const id = await addSponsorItem(App.eventId, itemData);
      App.sponsorItems.push({ id, ...itemData });
    }
    showToast('저장되었습니다.', 'success');
    closeModal('modal-sponsor');
    renderSponsors();
  } catch (e) {
    showToast('저장 실패: ' + e.message, 'error');
  }
  setBtnLoading('btn-save-sponsor', false);
}

async function handleDeleteSponsor(sponsorId) {
  if (!confirm('이 찬조자를 삭제하시겠습니까?')) return;
  try {
    await deleteSponsor(App.eventId, sponsorId);
    App.sponsors = App.sponsors.filter(s => s.id !== sponsorId);
    showToast('삭제되었습니다.', 'success');
    renderSponsors();
  } catch (e) {
    showToast('삭제 실패: ' + e.message, 'error');
  }
}


function openSponsorItemModal(itemId = null) {
  App.editingId = itemId;
  const item = itemId ? App.sponsorItems.find(i => i.id === itemId) : null;
  document.getElementById('si-modal-title').textContent = itemId ? '찬조물품 수정' : '찬조물품 추가';
  setVal('si-name', item?.itemName || '');
  setVal('si-quantity', item?.quantity || '');
  setVal('si-amount', item?.amount || '');
  setVal('si-usage', item?.usage || '');
  setVal('si-memo', item?.memo || '');

  // 찬조자 선택 드롭다운 채우기
  const select = document.getElementById('si-sponsor-select');
  select.innerHTML = `<option value="">직접 입력</option>` +
    App.sponsors.map(s => `<option value="${s.id}" data-name="${esc(s.name)}" ${item?.sponsorId === s.id ? 'selected' : ''}>${esc(s.name)}${s.affiliation ? ' (' + esc(s.affiliation) + ')' : ''}</option>`).join('');
  setVal('si-sponsor-name', item?.sponsorName || '');

  // 선택된 찬조자가 있으면 이름 자동 채우기
  select.onchange = () => {
    const opt = select.options[select.selectedIndex];
    if (opt.value) setVal('si-sponsor-name', opt.dataset.name || '');
    else setVal('si-sponsor-name', '');
  };

  openModal('modal-sponsor-item');
}

async function handleSaveSponsorItem() {
  const itemName = getVal('si-name').trim();
  if (!itemName) { showToast('물품명을 입력하세요.', 'error'); return; }
  const select = document.getElementById('si-sponsor-select');
  const sponsorId = select.value || '';
  const sponsorName = getVal('si-sponsor-name').trim();
  const data = {
    itemName, quantity: Number(getVal('si-quantity')) || '',
    amount: Number(getVal('si-amount')) || '',
    sponsorId, sponsorName,
    usage: getVal('si-usage').trim(),
    memo: getVal('si-memo').trim(),
  };
  setBtnLoading('btn-save-si', true);
  try {
    if (App.editingId) {
      await updateSponsorItem(App.eventId, App.editingId, data);
      App.sponsorItems = App.sponsorItems.map(i => i.id === App.editingId ? { ...i, ...data } : i);
    } else {
      const id = await addSponsorItem(App.eventId, data);
      App.sponsorItems.push({ id, ...data });
    }
    showToast('저장되었습니다.', 'success');
    closeModal('modal-sponsor-item');
    renderSponsors();
  } catch (e) {
    showToast('저장 실패: ' + e.message, 'error');
  }
  setBtnLoading('btn-save-si', false);
}

async function handleDeleteSponsorItem(itemId) {
  if (!confirm('이 찬조물품을 삭제하시겠습니까?')) return;
  try {
    await deleteSponsorItem(App.eventId, itemId);
    App.sponsorItems = App.sponsorItems.filter(i => i.id !== itemId);
    showToast('삭제되었습니다.', 'success');
    renderSponsors();
  } catch (e) {
    showToast('삭제 실패: ' + e.message, 'error');
  }
}

// =====================================================
// 운영진 탭
// =====================================================
const STAFF_ROLES = ['총괄', '진행', '경기 운영', '접수', '회계', '촬영', '안내', '기타'];

function renderStaff() {
  const rows = App.staff.length
    ? App.staff.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${esc(s.name)}</strong></td>
        <td><span class="badge badge-blue">${esc(s.role || '-')}</span></td>
        <td>${esc(s.phone || '-')}</td>
        <td>${esc(s.task || '-')}</td>
        <td>${esc(s.memo || '-')}</td>
        <td>
          <button class="btn btn-secondary btn-sm btn-icon" onclick="openStaffModal('${s.id}')">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="handleDeleteStaff('${s.id}')">🗑</button>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="7"><div class="empty-state"><div class="icon">🛠</div><p>운영진이 없습니다.</p></div></td></tr>`;

  document.getElementById('panel-staff').innerHTML = `
    <div class="section-card">
      <div class="section-header">
        <span class="section-title">🛠 운영진 목록 (${App.staff.length}명)</span>
        <button class="btn btn-primary btn-sm" onclick="openStaffModal()">+ 추가</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>#</th><th>이름</th><th>역할</th><th>연락처</th><th>담당업무</th><th>비고</th><th>관리</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function openStaffModal(staffId = null) {
  App.editingId = staffId;
  const s = staffId ? App.staff.find(s => s.id === staffId) : null;
  document.getElementById('st-modal-title').textContent = staffId ? '운영진 수정' : '운영진 추가';
  setVal('st-name', s?.name || '');
  setVal('st-role', s?.role || '총괄');
  setVal('st-phone', s?.phone || '');
  setVal('st-task', s?.task || '');
  setVal('st-memo', s?.memo || '');
  openModal('modal-staff');
}

async function handleSaveStaff() {
  const name = getVal('st-name').trim();
  if (!name) { showToast('이름을 입력하세요.', 'error'); return; }
  const data = {
    name, role: getVal('st-role'),
    phone: getVal('st-phone').trim(),
    task: getVal('st-task').trim(),
    memo: getVal('st-memo').trim(),
  };
  setBtnLoading('btn-save-staff', true);
  try {
    if (App.editingId) {
      await updateStaff(App.eventId, App.editingId, data);
      App.staff = App.staff.map(s => s.id === App.editingId ? { ...s, ...data } : s);
    } else {
      const id = await addStaff(App.eventId, data);
      App.staff.push({ id, ...data });
    }
    showToast('저장되었습니다.', 'success');
    closeModal('modal-staff');
    renderStaff();
  } catch (e) {
    showToast('저장 실패: ' + e.message, 'error');
  }
  setBtnLoading('btn-save-staff', false);
}

async function handleDeleteStaff(staffId) {
  if (!confirm('이 운영진을 삭제하시겠습니까?')) return;
  try {
    await deleteStaff(App.eventId, staffId);
    App.staff = App.staff.filter(s => s.id !== staffId);
    showToast('삭제되었습니다.', 'success');
    renderStaff();
  } catch (e) {
    showToast('삭제 실패: ' + e.message, 'error');
  }
}

// =====================================================
// 스케줄 탭
// =====================================================
function getSortedSchedules() {
  return [...App.schedules].sort((a, b) => {
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.startTime) return -1;
    if (b.startTime) return 1;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

function renderScheduleTab() {
  const sorted = getSortedSchedules();
  const rows = sorted.length
    ? sorted.map((s, i) => {
        const timeRange = s.startTime
          ? (s.endTime ? `${s.startTime} ~ ${s.endTime}` : s.startTime)
          : '-';
        return `<tr>
          <td style="white-space:nowrap;font-weight:600;color:#1d4ed8">${timeRange}</td>
          <td><strong>${esc(s.title)}</strong></td>
          <td style="max-width:260px;white-space:pre-wrap;word-break:break-word">${esc(s.description || '-')}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-secondary btn-sm btn-icon" onclick="openScheduleModal('${s.id}')">✏️</button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="handleDeleteSchedule('${s.id}')">🗑</button>
          </td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="6"><div class="empty-state"><div class="icon">📅</div><p>등록된 일정이 없습니다.</p></div></td></tr>`;

  document.getElementById('panel-schedule').innerHTML = `
    <div class="section-card">
      <div class="section-header">
        <span class="section-title">📅 이벤트 스케줄 (${sorted.length}건)</span>
        <button class="btn btn-primary btn-sm" onclick="openScheduleModal()">+ 일정 추가</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>시간</th><th>일정 제목</th><th>내용</th><th>관리</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function openScheduleModal(scheduleId = null) {
  App.editingId = scheduleId;
  const s = scheduleId ? App.schedules.find(s => s.id === scheduleId) : null;
  document.getElementById('schedule-modal-title').textContent = scheduleId ? '일정 수정' : '일정 추가';
  setVal('sch-title', s?.title || '');
  setVal('sch-start', s?.startTime || '');
  setVal('sch-end', s?.endTime || '');
  setVal('sch-description', s?.description || '');
  openModal('modal-schedule');
}

async function handleSaveSchedule() {
  const title = getVal('sch-title').trim();
  if (!title) { showToast('일정 제목을 입력하세요.', 'error'); return; }
  const data = {
    title,
    startTime:   getVal('sch-start'),
    endTime:     getVal('sch-end'),
    description: getVal('sch-description').trim(),
  };
  setBtnLoading('btn-save-schedule', true);
  try {
    if (App.editingId) {
      await updateSchedule(App.eventId, App.editingId, data);
      App.schedules = App.schedules.map(s => s.id === App.editingId ? { ...s, ...data } : s);
    } else {
      const id = await addSchedule(App.eventId, data);
      App.schedules.push({ id, ...data });
    }
    showToast('저장되었습니다.', 'success');
    closeModal('modal-schedule');
    renderScheduleTab();
  } catch (e) {
    showToast('저장 실패: ' + e.message, 'error');
  }
  setBtnLoading('btn-save-schedule', false);
}

async function handleDeleteSchedule(scheduleId) {
  if (!confirm('이 일정을 삭제하시겠습니까?')) return;
  try {
    await deleteSchedule(App.eventId, scheduleId);
    App.schedules = App.schedules.filter(s => s.id !== scheduleId);
    showToast('삭제되었습니다.', 'success');
    renderScheduleTab();
  } catch (e) {
    showToast('삭제 실패: ' + e.message, 'error');
  }
}

// =====================================================
// 미리보기 / 내보내기 탭
// =====================================================
function getPreviewData() {
  const sec = App.previewSections;
  return {
    participants: sec.participants ? App.participants : null,
    sponsors:     sec.sponsors     ? App.sponsors     : null,
    sponsorItems: sec.sponsorItems ? App.sponsorItems : null,
    staff:        sec.staff        ? App.staff        : null,
    schedules:    sec.schedule     ? getSortedSchedules() : null,
  };
}

function onPreviewSectionToggle() {
  App.previewSections = {
    participants: document.getElementById('prev-show-participants').checked,
    sponsors:     document.getElementById('prev-show-sponsors').checked,
    sponsorItems: document.getElementById('prev-show-sponsor-items').checked,
    staff:        document.getElementById('prev-show-staff').checked,
    grouping:     document.getElementById('prev-show-grouping').checked,
    schedule:     document.getElementById('prev-show-schedule').checked,
  };
  const ev = App.events.find(e => e.id === App.eventId);
  const d  = getPreviewData();
  const grpHTML = (App.previewSections.grouping && typeof grpBuildPublicHTML === 'function') ? grpBuildPublicHTML() : '';
  const iframe  = document.getElementById('preview-iframe');
  if (iframe) iframe.srcdoc = buildPublicHTML(ev, d.participants, d.sponsors, d.sponsorItems, d.staff, grpHTML, d.schedules);
}

function renderPreviewTab() {
  const ev = App.events.find(e => e.id === App.eventId);
  if (!ev) return;
  const panel = document.getElementById('panel-preview');
  const sec   = App.previewSections;

  const chk = (id, key, label) =>
    `<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.875rem;user-select:none">
      <input type="checkbox" id="${id}" ${sec[key] ? 'checked' : ''} onchange="onPreviewSectionToggle()">
      ${label}
    </label>`;

  panel.innerHTML = `
    <div class="section-card">
      <div class="section-header">
        <span class="section-title">🌐 공개 상세페이지 미리보기</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="handleExportHTML()">⬇ HTML 다운로드</button>
          <button class="btn btn-secondary btn-sm" onclick="copyPreviewText()">📋 텍스트 복사</button>
          <button class="btn btn-secondary btn-sm" onclick="downloadPreviewImage()">🖼 이미지 저장</button>
        </div>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;padding:10px 14px;background:#f8fafc;border-radius:8px;margin-bottom:12px;align-items:center">
        <span style="font-size:.8rem;font-weight:600;color:#64748b">표시 항목:</span>
        ${chk('prev-show-schedule',    'schedule',     '📅 스케줄')}
        ${chk('prev-show-participants', 'participants', '👥 참가자')}
        ${chk('prev-show-sponsors',    'sponsors',     '🤝 찬조자')}
        ${chk('prev-show-sponsor-items','sponsorItems','🎁 찬조물품')}
        ${chk('prev-show-staff',       'staff',        '🛠 운영진')}
        ${chk('prev-show-grouping',    'grouping',     '🏟 조편성')}
      </div>
      <div class="preview-frame">
        <iframe id="preview-iframe" sandbox="allow-same-origin" title="이벤트 미리보기"></iframe>
      </div>
    </div>`;

  const d       = getPreviewData();
  const grpHTML = (sec.grouping && typeof grpBuildPublicHTML === 'function') ? grpBuildPublicHTML() : '';
  const html    = buildPublicHTML(ev, d.participants, d.sponsors, d.sponsorItems, d.staff, grpHTML, d.schedules);
  const iframe  = document.getElementById('preview-iframe');
  iframe.srcdoc = html;
  iframe.style.height = '700px';
}

function copyPreviewText() {
  const ev   = App.events.find(e => e.id === App.eventId);
  if (!ev) return;
  const opts  = ev?.attendOptions?.length ? ev.attendOptions : [];
  const icons = { '운동': '🏃', '운동+회식': '🏃🍽', '회식': '🍽', '': '👤' };

  const lines = [];
  lines.push(`${'='.repeat(40)}`);
  lines.push(`  ${ev.title}`);
  const metaParts = [ev.eventDate, ev.location, ev.organizer].filter(Boolean);
  if (metaParts.length) lines.push(`  ${metaParts.join(' · ')}`);
  lines.push(`${'='.repeat(40)}`);

  if (ev.content) lines.push(`\n📌 내용\n${ev.content}`);
  if (ev.purpose) lines.push(`\n🎯 목적\n${ev.purpose}`);
  if (ev.notice)  lines.push(`\n📢 안내사항\n${ev.notice}`);

  const d = getPreviewData();

  if (d.participants !== null && d.participants.length) {
    lines.push(`\n👥 참가자 (${d.participants.length}명)`);
    const hasGroups = opts.length > 0 || d.participants.some(p => p.attendType);
    if (hasGroups) {
      const groupOrder = [...opts];
      d.participants.forEach(p => { if (p.attendType && !groupOrder.includes(p.attendType)) groupOrder.push(p.attendType); });
      groupOrder.push('');
      groupOrder.forEach(key => {
        const members = d.participants.filter(p => (p.attendType || '') === key);
        if (!members.length) return;
        lines.push(`\n  ${icons[key] ?? '👤'} ${key || '미설정'} (${members.length}명)`);
        members.forEach((p, i) => {
          const parts = [p.grade, p.gender, p.age ? p.age + '세' : null, p.career ? p.career + '년' : null].filter(Boolean);
          lines.push(`    ${i + 1}. ${p.name}${parts.length ? ' | ' + parts.join(' · ') : ''}`);
        });
      });
    } else {
      d.participants.forEach((p, i) => {
        const parts = [p.grade, p.gender, p.age ? p.age + '세' : null, p.career ? p.career + '년' : null].filter(Boolean);
        lines.push(`  ${i + 1}. ${p.name}${parts.length ? ' | ' + parts.join(' · ') : ''}`);
      });
    }
  }

  if (d.sponsors !== null && d.sponsors.length) {
    lines.push(`\n🤝 찬조자 (${d.sponsors.length}명)`);
    d.sponsors.forEach((s, i) => {
      lines.push(`  ${i + 1}. ${s.name}${s.affiliation ? ' (' + s.affiliation + ')' : ''}${s.type ? ' [' + s.type + ']' : ''}`);
    });
  }

  if (d.sponsorItems !== null && d.sponsorItems.length) {
    lines.push(`\n🎁 찬조물품 (${d.sponsorItems.length}건)`);
    d.sponsorItems.forEach((item, i) => {
      lines.push(`  ${i + 1}. ${item.itemName}${item.quantity ? ' × ' + item.quantity : ''}${item.sponsorName ? ' — ' + item.sponsorName : ''}`);
    });
  }

  if (d.schedules !== null && d.schedules.length) {
    lines.push(`\n📅 스케줄 (${d.schedules.length}건)`);
    d.schedules.forEach(s => {
      const time = s.startTime ? (s.endTime ? `${s.startTime}~${s.endTime}` : s.startTime) : '';
      lines.push(`  ${time ? '[' + time + '] ' : ''}${s.title}${s.description ? ' — ' + s.description : ''}`);
    });
  }

  if (d.staff !== null && d.staff.length) {
    lines.push(`\n🛠 운영진 (${d.staff.length}명)`);
    d.staff.forEach((s, i) => {
      lines.push(`  ${i + 1}. ${s.name}${s.role ? ' [' + s.role + ']' : ''}${s.task ? ' — ' + s.task : ''}`);
    });
  }

  if (App.previewSections.grouping && typeof grpBuildTXT === 'function' && GRP.results) {
    lines.push(`\n🏟 조편성 결과`);
    lines.push(grpBuildTXT());
  }

  lines.push(`\n${'='.repeat(40)}`);
  lines.push(`출력: ${new Date().toLocaleDateString('ko-KR')}`);

  navigator.clipboard.writeText(lines.join('\n')).then(
    () => showToast('미리보기 텍스트가 복사되었습니다.', 'success'),
    () => showToast('복사에 실패했습니다.', 'error')
  );
}

async function downloadPreviewImage() {
  if (typeof html2canvas === 'undefined') {
    showToast('이미지 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도하세요.', 'error');
    return;
  }
  const iframe = document.getElementById('preview-iframe');
  if (!iframe) { showToast('미리보기를 먼저 열어주세요.', 'error'); return; }
  const ev = App.events.find(e => e.id === App.eventId);

  showToast('이미지 생성 중...', 'default');
  try {
    const target = iframe.contentDocument?.body || iframe.contentWindow?.document?.body;
    if (!target) throw new Error('미리보기 내용을 찾을 수 없습니다.');

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      windowWidth: target.scrollWidth,
      windowHeight: target.scrollHeight,
    });
    const link = document.createElement('a');
    link.download = `${(ev?.title || '미리보기').replace(/[\\/:*?"<>|]/g, '_')}_미리보기.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('이미지로 저장되었습니다.', 'success');
  } catch (e) {
    showToast('이미지 생성 실패: ' + e.message, 'error');
  }
}

function handleExportHTML() {
  const ev = App.events.find(e => e.id === App.eventId);
  const d  = getPreviewData();
  const grpHTML = (App.previewSections.grouping && typeof grpBuildPublicHTML === 'function') ? grpBuildPublicHTML() : '';
  exportAsHTML(ev, d.participants, d.sponsors, d.sponsorItems, d.staff, grpHTML, d.schedules);
}
function handleExportJSON() {
  const ev = App.events.find(e => e.id === App.eventId);
  exportAsJSON(ev, App.participants, App.sponsors, App.sponsorItems, App.staff);
}
function handleExportParticipantsCSV() {
  const ev = App.events.find(e => e.id === App.eventId);
  exportParticipantsCSV(ev, App.participants);
}
function handlePrint() {
  const ev = App.events.find(e => e.id === App.eventId);
  const d  = getPreviewData();
  const grpHTML = (App.previewSections.grouping && typeof grpBuildPublicHTML === 'function') ? grpBuildPublicHTML() : '';
  printPreview(ev, d.participants, d.sponsors, d.sponsorItems, d.staff, grpHTML, d.schedules);
}

// =====================================================
// 이벤트 템플릿 (localStorage)
// =====================================================
function getTemplates() {
  try { return JSON.parse(localStorage.getItem('eventTemplates') || '[]'); } catch { return []; }
}

function updateTemplateSelect() {
  const sel = document.getElementById('template-select');
  if (!sel) return;
  const templates = getTemplates();
  sel.innerHTML = '<option value="">— 저장된 템플릿 불러오기 —</option>' +
    templates.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join('');
  const delBtn = document.getElementById('btn-delete-template');
  if (delBtn) delBtn.classList.add('hidden');
  sel.onchange = () => { if (delBtn) delBtn.classList.toggle('hidden', !sel.value); };
}

function loadTemplate() {
  const sel = document.getElementById('template-select');
  const idx = parseInt(sel?.value);
  if (isNaN(idx)) { showToast('불러올 템플릿을 선택하세요.', 'warning'); return; }
  const t = getTemplates()[idx];
  if (!t) return;
  if (t.organizer !== undefined) setVal('event-organizer', t.organizer);
  if (t.notice    !== undefined) setVal('event-notice',    t.notice);
  if (t.content   !== undefined) setVal('event-content',  t.content);
  if (t.purpose   !== undefined) setVal('event-purpose',  t.purpose);
  const opts = t.attendOptions || [];
  document.getElementById('opt-exercise').checked = opts.includes('운동');
  document.getElementById('opt-both').checked     = opts.includes('운동+회식');
  document.getElementById('opt-dinner').checked   = opts.includes('회식');
  showToast(`"${t.name}" 템플릿을 불러왔습니다.`, 'success');
}

function saveCurrentAsTemplate() {
  const name = prompt('템플릿 이름을 입력하세요:', getVal('event-title') || '');
  if (!name?.trim()) return;
  const attendOptions = ['opt-exercise','opt-both','opt-dinner']
    .filter(id => document.getElementById(id)?.checked)
    .map(id => document.getElementById(id).value);
  const t = {
    name: name.trim(),
    organizer:    getVal('event-organizer'),
    notice:       getVal('event-notice'),
    content:      getVal('event-content'),
    purpose:      getVal('event-purpose'),
    attendOptions,
    savedAt: new Date().toISOString(),
  };
  const templates = getTemplates();
  templates.push(t);
  localStorage.setItem('eventTemplates', JSON.stringify(templates));
  updateTemplateSelect();
  showToast(`"${t.name}" 템플릿이 저장되었습니다.`, 'success');
}

function deleteSelectedTemplate() {
  const sel = document.getElementById('template-select');
  const idx = parseInt(sel?.value);
  if (isNaN(idx)) return;
  const templates = getTemplates();
  const t = templates[idx];
  if (!t || !confirm(`"${t.name}" 템플릿을 삭제하시겠습니까?`)) return;
  templates.splice(idx, 1);
  localStorage.setItem('eventTemplates', JSON.stringify(templates));
  updateTemplateSelect();
  showToast('템플릿이 삭제되었습니다.', 'success');
}

// =====================================================
// 유틸리티
// =====================================================
function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function getVal(id) { return (document.getElementById(id)?.value ?? ''); }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }

function formatDateTime(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  } catch { return '-'; }
}

function openModal(id) {
  const el = document.getElementById(id);
  el?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  const el = document.getElementById(id);
  el?.classList.remove('open');
  document.body.style.overflow = '';
}

// 모달 외부 클릭 시 닫기
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      m.classList.remove('open');
      document.body.style.overflow = '';
    });
  }
});

function showToast(msg, type = 'default') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function setBtnLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) {
    btn._origText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn._origText || '저장';
    btn.disabled = false;
  }
}

// 앱 시작
window.addEventListener('DOMContentLoaded', appInit);
