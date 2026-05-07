// =====================================================
// grouping.js — 조편성 탭
// tournament-app/app.js 로직을 event-app에 통합
// =====================================================

const GRADE_SCORES_G = { S: 6, A: 5, B: 4, C: 3, D: 2, '초보': 1 };
const TEAM_CLS_G = ['grp-team-1', 'grp-team-2', 'grp-team-3', 'grp-team-4'];

const GRP = {
  results: null,
  doublesType: 'none',
  groupSize: 4,
  groupMode: 'balanced',
  teamMode: 'fixed',
  dragState: null,
  groupAddTargetIdx: -1,
  roundSwaps: {},
  roundEditMode: null,
  longPressTimer: null,
  _eventId: null,
};

function grpSportParticipants() {
  return App.participants.filter(p => !p.attendType || p.attendType !== '회식');
}

async function grpClearResults() {
  if (!confirm('조편성 결과를 초기화하시겠습니까?')) return;
  GRP.results = null;
  GRP.roundSwaps = {};
  GRP.roundEditMode = null;
  try {
    await updateEvent(App.eventId, { groupingData: '' });
    const idx = App.events.findIndex(e => e.id === App.eventId);
    if (idx !== -1) App.events[idx].groupingData = '';
  } catch (e) {
    showToast('초기화 저장 실패: ' + e.message, 'error');
  }
  renderGroupingTab();
  showToast('조편성이 초기화되었습니다.', 'success');
}

async function saveGroupingData() {
  if (!App.eventId || !GRP.results) return;
  const data = JSON.stringify({
    results:     GRP.results,
    doublesType: GRP.doublesType,
    groupSize:   GRP.groupSize,
    groupMode:   GRP.groupMode,
    teamMode:    GRP.teamMode,
    roundSwaps:  GRP.roundSwaps,
  });
  try {
    await updateEvent(App.eventId, { groupingData: data });
    const idx = App.events.findIndex(e => e.id === App.eventId);
    if (idx !== -1) App.events[idx].groupingData = data;
  } catch (e) {
    showToast('조편성 저장 실패: ' + e.message, 'error');
  }
}

function loadGroupingData() {
  const ev = App.events.find(e => e.id === App.eventId);
  if (!ev?.groupingData) return;
  if (ev.groupingData === '') return;
  try {
    const data = JSON.parse(ev.groupingData);
    GRP.results     = data.results     ?? null;
    GRP.doublesType = data.doublesType ?? GRP.doublesType;
    GRP.groupSize   = data.groupSize   ?? GRP.groupSize;
    GRP.groupMode   = data.groupMode   ?? GRP.groupMode;
    GRP.teamMode    = data.teamMode    ?? GRP.teamMode;
    GRP.roundSwaps  = data.roundSwaps  ?? {};
  } catch (_) {}
}

function grpScore(p) {
  const g = String(p.grade || '').trim();
  return GRADE_SCORES_G[g] || GRADE_SCORES_G[g.toUpperCase()] || 1;
}

function grpEnriched(list) {
  return list.map(p => ({ ...p, score: grpScore(p) }));
}

// =====================================================
// 탭 렌더링
// =====================================================
function renderGroupingTab() {
  if (GRP._eventId && GRP._eventId !== App.eventId) {
    GRP.results = null;
    GRP.roundSwaps = {};
    GRP.roundEditMode = null;
  }
  GRP._eventId = App.eventId;

  if (!GRP.results) loadGroupingData();

  const panel = document.getElementById('panel-grouping');
  if (!panel) return;

  const sportP  = grpSportParticipants();
  const total   = sportP.length;
  const maleN   = sportP.filter(p => p.gender === '남').length;
  const femaleN = sportP.filter(p => p.gender === '여').length;

  if (total === 0) {
    panel.innerHTML = `<div class="empty-state"><div class="icon">👥</div><p>참가자 탭에서 먼저 참가자를 등록해주세요.</p></div>`;
    return;
  }

  panel.innerHTML = `
    <div class="section-card" style="margin-bottom:16px">
      <div class="section-header">
        <span class="section-title">🏟 조편성 설정</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span class="badge badge-blue">전체 ${total}명</span>
          <span class="badge badge-blue">남 ${maleN}명</span>
          <span class="badge" style="background:#fce7f3;color:#9d174d">여 ${femaleN}명</span>
        </div>
      </div>

      <div class="form-row" style="margin-bottom:12px">
        <div class="form-group">
          <label class="form-label">복식 종목</label>
          <select id="grp-doubles" class="form-select" onchange="grpOnDoublesChange()">
            <option value="none"  ${GRP.doublesType==='none'  ?'selected':''}>없음 (단식 / 자유)</option>
            <option value="men"   ${GRP.doublesType==='men'   ?'selected':''}>🟦 남복 (남자 복식)</option>
            <option value="women" ${GRP.doublesType==='women' ?'selected':''}>🟥 여복 (여자 복식)</option>
            <option value="mixed" ${GRP.doublesType==='mixed' ?'selected':''}>🟨 혼복 (혼합 복식)</option>
            <option value="both"  ${GRP.doublesType==='both'  ?'selected':''}>🟦🟥 남복+여복</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">조당 인원수</label>
          <input id="grp-size" type="number" class="form-input" value="${GRP.groupSize}" min="2" max="200">
        </div>
      </div>

      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:14px">
        <div>
          <label class="form-label" style="margin-bottom:6px">조 구성 방식</label>
          <div style="display:flex;gap:14px">
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.875rem">
              <input type="radio" name="grp-group-mode" value="balanced" ${GRP.groupMode==='balanced'?'checked':''}
                onchange="GRP.groupMode='balanced'">
              <span><strong>균형</strong> <span style="color:#64748b;font-size:.78rem">(스네이크)</span></span>
            </label>
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.875rem">
              <input type="radio" name="grp-group-mode" value="level" ${GRP.groupMode==='level'?'checked':''}
                onchange="GRP.groupMode='level'">
              <span><strong>급수별</strong> <span style="color:#64748b;font-size:.78rem">(동급끼리)</span></span>
            </label>
          </div>
        </div>
        <div>
          <label class="form-label" style="margin-bottom:6px">팀 구성 방식</label>
          <div style="display:flex;gap:14px">
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.875rem">
              <input type="radio" name="grp-team-mode" value="fixed" ${GRP.teamMode==='fixed'?'checked':''}
                onchange="GRP.teamMode='fixed'">
              <span><strong>고정</strong> <span style="color:#64748b;font-size:.78rem">(팀 고정)</span></span>
            </label>
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.875rem">
              <input type="radio" name="grp-team-mode" value="fluid" ${GRP.teamMode==='fluid'?'checked':''}
                onchange="GRP.teamMode='fluid'">
              <span><strong>유동</strong> <span style="color:#64748b;font-size:.78rem">(라운드마다)</span></span>
            </label>
          </div>
        </div>
      </div>

      <div id="grp-info-box" class="hidden" style="border-radius:8px;padding:10px 14px;font-size:.85rem;margin-bottom:12px"></div>

      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" style="flex:1;padding:12px" onclick="grpGenerate()">
          🎯 조편성 생성
        </button>
        ${GRP.results ? `<button class="btn btn-danger" style="padding:12px 16px" onclick="grpClearResults()">🗑 초기화</button>` : ''}
      </div>
    </div>

    <div id="grp-results-area"></div>
  `;

  grpOnDoublesChange();
  if (GRP.results) grpRenderResults();
}

// ---- 복식 유형 변경 ----
function grpOnDoublesChange() {
  const el = document.getElementById('grp-doubles');
  if (!el) return;
  GRP.doublesType = el.value;
  const box = document.getElementById('grp-info-box');
  if (!box) return;

  const sportP2 = grpSportParticipants();
  const maleN   = sportP2.filter(p => p.gender === '남').length;
  const femaleN = sportP2.filter(p => p.gender === '여').length;

  const infoMap = {
    none:  null,
    men:   { bg:'#eff6ff', border:'#bfdbfe', color:'#1e40af', html:`🟦 <strong>남복</strong> — 남자 참가자만 사용. 현재 남자: <strong>${maleN}명</strong>` },
    women: { bg:'#fdf2f8', border:'#fbcfe8', color:'#9d174d', html:`🟥 <strong>여복</strong> — 여자 참가자만 사용. 현재 여자: <strong>${femaleN}명</strong>` },
    mixed: { bg:'#fffbeb', border:'#fde68a', color:'#78350f', html:`🟨 <strong>혼복</strong> — 남자+여자 한 팀. 현재 남 <strong>${maleN}명</strong> / 여 <strong>${femaleN}명</strong>` },
    both:  { bg:'#f5f3ff', border:'#ddd6fe', color:'#4c1d95', html:`🟦🟥 <strong>남복+여복</strong> — 남복 ${Math.floor(maleN/2)}팀 + 여복 ${Math.floor(femaleN/2)}팀 동시 생성` },
  };

  const info = infoMap[GRP.doublesType];
  if (!info) { box.classList.add('hidden'); return; }
  box.style.cssText = `background:${info.bg};border:1px solid ${info.border};color:${info.color};border-radius:8px;padding:10px 14px;font-size:.85rem;margin-bottom:12px`;
  box.innerHTML = info.html;
  box.classList.remove('hidden');
}

// =====================================================
// 조편성 생성
// =====================================================
function grpGenerate() {
  GRP.doublesType    = document.getElementById('grp-doubles')?.value || 'none';
  GRP.groupSize      = parseInt(document.getElementById('grp-size')?.value) || 4;
  GRP.groupMode      = document.querySelector('input[name="grp-group-mode"]:checked')?.value || 'balanced';
  GRP.teamMode       = document.querySelector('input[name="grp-team-mode"]:checked')?.value || 'fixed';
  GRP.roundSwaps     = {};
  GRP.roundEditMode  = null;

  const sportPool = grpSportParticipants();
  if (sportPool.length < 2) {
    showToast('최소 2명 이상의 참가자가 필요합니다.', 'error');
    return;
  }

  if (GRP.doublesType === 'both') {
    const men   = grpEnriched(sportPool.filter(p => p.gender === '남'));
    const women = grpEnriched(sportPool.filter(p => p.gender === '여'));
    if (men.length < 2)   { showToast('남복 생성을 위해 남자 참가자가 최소 2명 필요합니다.', 'error'); return; }
    if (women.length < 2) { showToast('여복 생성을 위해 여자 참가자가 최소 2명 필요합니다.', 'error'); return; }
    GRP.results = {
      doublesType: 'both',
      sections: [grpBuildSection('men', men), grpBuildSection('women', women)],
      groups: null,
    };
  } else {
    const pool = grpGetPool(GRP.doublesType, sportPool);
    if (typeof pool === 'string') { showToast(pool, 'error'); return; }
    GRP.results = {
      doublesType: GRP.doublesType,
      groups: grpFormGroups(grpEnriched(pool)),
      sections: null,
    };
  }

  grpRenderResults();
  document.getElementById('grp-results-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('조편성이 완료되었습니다.', 'success');
  saveGroupingData();
}

function grpBuildSection(type, pool) {
  return { type, label: type === 'men' ? '남복' : '여복', groups: grpFormGroups(pool, type) };
}

function grpGetPool(doublesType, p) {
  if (!p) p = grpSportParticipants();
  if (doublesType === 'men') {
    const m = p.filter(x => x.gender === '남');
    if (m.length < 2) return `남복 선택 시 남자 참가자가 최소 2명 필요합니다. (현재 ${m.length}명)`;
    return m;
  }
  if (doublesType === 'women') {
    const f = p.filter(x => x.gender === '여');
    if (f.length < 2) return `여복 선택 시 여자 참가자가 최소 2명 필요합니다. (현재 ${f.length}명)`;
    return f;
  }
  if (doublesType === 'mixed') {
    const m = p.filter(x => x.gender === '남'), f = p.filter(x => x.gender === '여');
    if (m.length < 1) return '혼복 선택 시 남자 참가자가 최소 1명 필요합니다.';
    if (f.length < 1) return '혼복 선택 시 여자 참가자가 최소 1명 필요합니다.';
    if (m.length + f.length < 4) return '혼복 선택 시 합산 최소 4명(남 2명+여 2명)이 필요합니다.';
    return [...p];
  }
  return [...p];
}

function grpFormGroups(pool, doublesTypeOverride) {
  const dt = doublesTypeOverride || GRP.doublesType;
  let rawGroups;
  if (dt === 'mixed') {
    rawGroups = grpFormMixedGroups(pool, GRP.groupSize);
  } else if (GRP.groupMode === 'level') {
    rawGroups = grpFormHomogeneousGroups(pool, GRP.groupSize);
  } else {
    rawGroups = grpFormBalancedGroups(pool, GRP.groupSize);
  }
  const isFluid = GRP.teamMode === 'fluid';
  const suffix  = GRP.groupMode === 'level' ? '그룹' : '조';
  return rawGroups.map((members, i) => {
    const name       = String.fromCharCode(65 + i) + suffix;
    const totalScore = members.reduce((s, p) => s + p.score, 0);
    const base = { name, members, totalScore, avgScore: +(totalScore / members.length).toFixed(2) };
    if (isFluid) {
      return { ...base, teams: null, rounds: dt === 'mixed' ? grpMixedFluidRounds(members) : grpFluidRounds(members) };
    }
    return { ...base, teams: dt === 'mixed' ? grpPairMixedTeams(members) : grpPairTeams(members), rounds: null };
  });
}

// =====================================================
// 조 편성 알고리즘 (tournament/app.js 에서 직접 포팅)
// =====================================================
function grpFormBalancedGroups(pool, groupSize) {
  const sorted     = [...pool].sort((a, b) => b.score - a.score);
  const fullGroups = Math.floor(sorted.length / groupSize);
  const remainder  = sorted.length % groupSize;
  const numGroups  = fullGroups + (remainder > 0 ? 1 : 0);
  const groups     = Array.from({ length: numGroups }, () => []);
  const fullCount  = fullGroups * groupSize;
  let dir = 1, gi = 0;
  for (let i = 0; i < fullCount; i++) {
    groups[gi].push({ ...sorted[i] });
    gi += dir;
    if (gi >= fullGroups) { dir = -1; gi = fullGroups - 1; }
    else if (gi < 0)      { dir =  1; gi = 0; }
  }
  for (let i = fullCount; i < sorted.length; i++) groups[numGroups - 1].push({ ...sorted[i] });
  grpReduceConflicts(groups);
  return groups;
}

function grpFormHomogeneousGroups(pool, groupSize) {
  const sorted    = [...pool].sort((a, b) => b.score - a.score || (b.career || 0) - (a.career || 0));
  const numGroups = Math.ceil(sorted.length / groupSize);
  const groups    = Array.from({ length: numGroups }, () => []);
  sorted.forEach((p, i) => groups[Math.floor(i / groupSize)].push({ ...p }));
  return groups;
}

function grpFormMixedGroups(pool, groupSize) {
  const males   = pool.filter(p => p.gender === '남').sort((a, b) => b.score - a.score);
  const females = pool.filter(p => p.gender === '여').sort((a, b) => b.score - a.score);
  const pairs   = Math.min(males.length, females.length);
  if (pairs < 1) return [];
  const ppg      = Math.max(1, Math.floor(groupSize / 2));
  const fullG    = Math.floor(pairs / ppg);
  const numG     = fullG + (pairs % ppg > 0 ? 1 : 0);
  const groups   = Array.from({ length: numG }, () => []);
  const fullC    = fullG * ppg;
  let dir = 1, gi = 0;
  for (let i = 0; i < fullC; i++) {
    groups[gi].push({ ...males[i] });
    gi += dir;
    if (gi >= fullG) { dir = -1; gi = fullG - 1; } else if (gi < 0) { dir = 1; gi = 0; }
  }
  for (let i = fullC; i < pairs; i++) groups[numG - 1].push({ ...males[i] });
  dir = 1; gi = 0;
  for (let i = 0; i < fullC; i++) {
    groups[gi].push({ ...females[i] });
    gi += dir;
    if (gi >= fullG) { dir = -1; gi = fullG - 1; } else if (gi < 0) { dir = 1; gi = 0; }
  }
  for (let i = fullC; i < pairs; i++) groups[numG - 1].push({ ...females[i] });
  grpReduceMixedConflicts(groups);
  return groups;
}

function grpFindConflict(group) {
  const affs = group.map(p => p.affiliation).filter(Boolean);
  for (let i = 0; i < group.length; i++) {
    const a = group[i].affiliation;
    if (a && affs.indexOf(a) !== affs.lastIndexOf(a)) return i;
  }
  return -1;
}
function grpCountConflicts(group) {
  const affs = group.map(p => p.affiliation).filter(Boolean);
  return affs.filter((a, i) => affs.indexOf(a) !== i).length;
}
function grpReduceConflicts(groups) {
  for (let iter = 0; iter < 80; iter++) {
    let improved = false;
    for (let gi = 0; gi < groups.length; gi++) {
      const cf = grpFindConflict(groups[gi]); if (cf === -1) continue;
      const mb = groups[gi][cf];
      outer: for (let gj = 0; gj < groups.length; gj++) {
        if (gi === gj) continue;
        for (let mj = 0; mj < groups[gj].length; mj++) {
          const ot = groups[gj][mj];
          if (ot.affiliation === mb.affiliation || Math.abs(mb.score - ot.score) > 2) continue;
          const b = grpCountConflicts(groups[gi]) + grpCountConflicts(groups[gj]);
          groups[gi][cf] = ot; groups[gj][mj] = mb;
          if (grpCountConflicts(groups[gi]) + grpCountConflicts(groups[gj]) < b) { improved = true; break outer; }
          groups[gi][cf] = mb; groups[gj][mj] = ot;
        }
      }
    }
    if (!improved) break;
  }
}
function grpReduceMixedConflicts(groups) {
  for (let iter = 0; iter < 80; iter++) {
    let improved = false;
    for (let gi = 0; gi < groups.length; gi++) {
      const cf = grpFindConflict(groups[gi]); if (cf === -1) continue;
      const mb = groups[gi][cf];
      outer: for (let gj = 0; gj < groups.length; gj++) {
        if (gi === gj) continue;
        for (let mj = 0; mj < groups[gj].length; mj++) {
          const ot = groups[gj][mj];
          if (ot.gender !== mb.gender || ot.affiliation === mb.affiliation || Math.abs(mb.score - ot.score) > 2) continue;
          const b = grpCountConflicts(groups[gi]) + grpCountConflicts(groups[gj]);
          groups[gi][cf] = ot; groups[gj][mj] = mb;
          if (grpCountConflicts(groups[gi]) + grpCountConflicts(groups[gj]) < b) { improved = true; break outer; }
          groups[gi][cf] = mb; groups[gj][mj] = ot;
        }
      }
    }
    if (!improved) break;
  }
}

// =====================================================
// 팀 페어링
// =====================================================
function grpPairTeams(members) {
  const sorted = [...members].sort((a, b) => b.score - a.score);
  const teams = []; const n = sorted.length, half = Math.floor(n / 2);
  for (let i = 0; i < half; i++) teams.push([sorted[i], sorted[n - 1 - i]]);
  if (n % 2 === 1) teams.push([sorted[half]]);
  return teams;
}
function grpPairMixedTeams(members) {
  const males   = [...members].filter(p => p.gender === '남').sort((a, b) => b.score - a.score);
  const females = [...members].filter(p => p.gender === '여').sort((a, b) => b.score - a.score);
  const pairs   = Math.min(males.length, females.length);
  const teams   = [];
  for (let i = 0; i < pairs; i++) teams.push([males[i], females[pairs - 1 - i]]);
  for (let i = pairs; i < males.length; i++)   teams.push([males[i]]);
  for (let i = pairs; i < females.length; i++) teams.push([females[i]]);
  return teams;
}

// =====================================================
// 유동 라운드
// =====================================================
function grpFluidRounds(members) {
  const sorted  = [...members].sort((a, b) => b.score - a.score);
  const n       = sorted.length;
  const players = n % 2 === 0 ? [...sorted] : [null, ...sorted];
  const m       = players.length;
  const circle  = players.slice(1);
  const rounds  = [];
  for (let r = 0; r < m - 1; r++) {
    const arr = [players[0], ...circle];
    const completePairs = []; let soloBye = null;
    for (let i = 0; i < m / 2; i++) {
      const p1 = arr[i], p2 = arr[m - 1 - i];
      if (p1 === null) soloBye = p2; else if (p2 === null) soloBye = p1; else completePairs.push([p1, p2]);
    }
    const matches = [];
    for (let i = 0; i + 1 < completePairs.length; i += 2) matches.push({ team1: completePairs[i], team2: completePairs[i + 1] });
    if (completePairs.length % 2 === 1) matches.push({ team1: completePairs[completePairs.length - 1], team2: null });
    rounds.push({ round: r + 1, pairs: completePairs, matches, soloBye });
    circle.push(circle.shift());
  }
  return rounds;
}
function grpMixedFluidRounds(members) {
  const males   = [...members].filter(p => p.gender === '남').sort((a, b) => b.score - a.score);
  const females = [...members].filter(p => p.gender === '여').sort((a, b) => b.score - a.score);
  const n = Math.min(males.length, females.length);
  if (n === 0) return grpFluidRounds(members);
  const rounds = [];
  for (let r = 0; r < n; r++) {
    const pairs = [];
    for (let i = 0; i < n; i++) pairs.push([males[i], females[(i + r) % n]]);
    const matches = [];
    for (let i = 0; i + 1 < pairs.length; i += 2) matches.push({ team1: pairs[i], team2: pairs[i + 1] });
    if (pairs.length % 2 === 1) matches.push({ team1: pairs[pairs.length - 1], team2: null });
    rounds.push({ round: r + 1, pairs, matches });
  }
  return rounds;
}

// =====================================================
// 라운드 로빈 스케줄
// =====================================================
function grpRoundRobinSchedule(teams) {
  const n = teams.length; if (n < 2) return [];
  const arr    = n % 2 === 1 ? [null, ...teams.map((_, i) => i)] : teams.map((_, i) => i);
  const m      = arr.length;
  const circle = arr.slice(1);
  const rounds = [];
  for (let r = 0; r < m - 1; r++) {
    const cur = [arr[0], ...circle]; const matches = []; let byeTeam = null;
    for (let k = 0; k < m / 2; k++) {
      const a = cur[k], b = cur[m - 1 - k];
      if (a === null) { byeTeam = teams[b]; continue; }
      if (b === null) { byeTeam = teams[a]; continue; }
      matches.push({ ti: Math.min(a, b), tj: Math.max(a, b), team1: teams[a], team2: teams[b] });
    }
    rounds.push({ round: r + 1, matches, bye: byeTeam });
    circle.push(circle.shift());
  }
  return rounds;
}

// =====================================================
// 결과 렌더링
// =====================================================
function grpRenderResults() {
  const area = document.getElementById('grp-results-area');
  if (!area || !GRP.results) return;

  if (GRP.results.doublesType === 'both') {
    let fo = 0;
    area.innerHTML = GRP.results.sections.map(s => {
      const html = grpRenderSection(s, fo);
      fo += s.groups.length;
      return html;
    }).join('');
    return;
  }

  const groups = GRP.results.groups || [];
  if (!groups.length) { area.innerHTML = '<div class="empty-state"><p>조편성 결과가 없습니다.</p></div>'; return; }

  const scores = groups.map(g => g.totalScore);
  const dev    = Math.max(...scores) - Math.min(...scores);
  const devCol = dev <= 2 ? '#059669' : dev <= 4 ? '#d97706' : '#dc2626';

  area.innerHTML = `
    <div class="section-card" style="margin-bottom:12px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:.85rem;align-items:center">
        <span>총 <strong>${groups.length}개 조</strong></span>
        <span>최고조점: <strong>${Math.max(...scores)}</strong></span>
        <span>최저조점: <strong>${Math.min(...scores)}</strong></span>
        <span>점수편차: <strong style="color:${devCol}">${dev}</strong></span>
        <div style="margin-left:auto;display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="grpCopyText()">📋 복사</button>
          <button class="btn btn-secondary btn-sm" onclick="grpDownloadTXT()">⬇ TXT</button>
          <button class="btn btn-secondary btn-sm" onclick="grpDownloadCSV()">⬇ CSV</button>
        </div>
      </div>
    </div>
    <div class="grp-grid">${groups.map((g, i) => grpRenderGroupCard(g, i)).join('')}</div>
  `;
}

function grpRenderSection(section, flatOffset) {
  const groups  = section.groups || [];
  const scores  = groups.map(g => g.totalScore);
  const dev     = Math.max(...scores) - Math.min(...scores);
  const devCol  = dev <= 2 ? '#059669' : dev <= 4 ? '#d97706' : '#dc2626';
  const icon    = section.type === 'men' ? '🟦' : '🟥';
  const hdrBg   = section.type === 'men' ? '#dbeafe;color:#1e40af' : '#fce7f3;color:#9d174d';
  return `
    <div class="section-card" style="margin-bottom:16px">
      <div style="background:${hdrBg};border-radius:8px;padding:8px 12px;margin-bottom:10px;font-weight:700;font-size:.9rem">
        ${icon} ${section.label} — ${groups.reduce((s,g)=>s+g.members.length,0)}명
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:.85rem;padding:0 0 12px;align-items:center">
        <span>총 <strong>${groups.length}개 조</strong></span>
        <span>점수편차: <strong style="color:${devCol}">${dev}</strong></span>
      </div>
      <div class="grp-grid">${groups.map((g, i) => grpRenderGroupCard(g, flatOffset + i)).join('')}</div>
    </div>
  `;
}

function grpRenderGroupCard(group, groupIdx) {
  const isMixed = GRP.results.doublesType === 'mixed';
  const isFluid = !!group.rounds;
  const pct     = Math.round((group.totalScore / Math.max(group.members.length * 6, 1)) * 100);

  const memberRows = group.members.map(m => {
    const gTag = (isMixed || m.gender)
      ? `<td style="padding:5px 3px"><span class="grp-gender-${m.gender||''}">${m.gender||''}</span></td>`
      : '<td></td>';
    return `
      <tr class="grp-member-row" draggable="true" data-mid="${m.id}"
        ondragstart="grpOnDragStart(event,${groupIdx},this.dataset.mid)"
        ondragend="grpOnDragEnd(event)"
        ontouchstart="grpOnTouchStart(event,${groupIdx},this.dataset.mid)"
        ontouchend="grpOnTouchEnd()" ontouchmove="grpOnTouchMove()"
        oncontextmenu="return false">
        <td style="padding:5px 2px;color:#cbd5e1;font-size:.7rem;width:14px">⠿</td>
        <td style="padding:5px 4px;font-weight:600;font-size:.875rem">${esc(m.name)}</td>
        <td style="padding:5px 3px"><span class="grp-grade-${m.grade}">${m.grade}</span></td>
        ${gTag}
        <td style="padding:5px 3px;font-size:.75rem;color:#94a3b8;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.affiliation||'-')}</td>
        <td style="padding:5px 2px;text-align:right;font-weight:700;color:#4f46e5;font-size:.75rem">${m.score}pt</td>
      </tr>`;
  }).join('');

  const content = isFluid
    ? grpRenderFluidRounds(group.rounds, group.name, groupIdx)
    : grpRenderFixedTeams(group.teams, group.name, isMixed);

  return `
    <div class="grp-group-card" id="grp-card-${groupIdx}"
      ondragover="grpOnDragOver(event,${groupIdx})"
      ondragenter="grpOnDragEnter(event,${groupIdx})"
      ondragleave="grpOnDragLeave(event)"
      ondrop="grpOnDrop(event,${groupIdx})">
      <div class="grp-group-header">
        <h3 style="font-weight:700;font-size:1rem">${esc(group.name)}</h3>
        <div style="font-size:.75rem;opacity:.85">총점 ${group.totalScore} · 평균 ${group.avgScore}</div>
      </div>
      <div style="padding:12px">
        <div class="grp-balance-bar-wrap"><div class="grp-balance-bar" style="width:${pct}%"></div></div>
        <p style="font-size:.7rem;font-weight:600;color:#94a3b8;text-transform:uppercase;margin:8px 0 5px">
          참가자 (${group.members.length}명) <span style="color:#e2e8f0;font-weight:400;text-transform:none">↔ 드래그 이동</span>
        </p>
        <div class="table-wrap" style="margin-bottom:10px">
          <table style="width:100%;border-collapse:collapse"><tbody>${memberRows}</tbody></table>
        </div>
        ${content}
        <div style="display:flex;gap:6px;margin-top:10px">
          <button onclick="grpOpenAddModal(${groupIdx})"
            style="flex:1;font-size:.78rem;padding:6px 4px;background:#eff6ff;border:none;border-radius:6px;color:#1d4ed8;cursor:pointer;font-weight:500">
            ＋ 참가자 추가
          </button>
          <button onclick="grpRegenerateAt(${groupIdx})"
            style="flex:1;font-size:.78rem;padding:6px 4px;background:#f8fafc;border:none;border-radius:6px;color:#374151;cursor:pointer;font-weight:500">
            ↻ 재생성
          </button>
        </div>
      </div>
    </div>
  `;
}

function grpRenderFixedTeams(teams, groupName, isMixed) {
  if (!teams || !teams.length) return '';
  const teamsHTML = teams.map((team, ti) => {
    const members = team.map(p => {
      const gTag = isMixed && p.gender ? `<span class="grp-gender-${p.gender}" style="font-size:.72rem">${p.gender}</span>` : '';
      return `${esc(p.name)}<span style="color:#94a3b8;font-size:.72rem">(${p.grade})</span>${gTag}`;
    }).join(' <span style="color:#e2e8f0">+</span> ');
    return `
      <div class="${TEAM_CLS_G[ti % TEAM_CLS_G.length]} grp-team-block">
        <div style="font-size:.7rem;font-weight:600;color:#64748b;margin-bottom:3px">${esc(groupName)} ${ti + 1}팀</div>
        <div style="font-size:.85rem;display:flex;align-items:center;flex-wrap:wrap;gap:3px">${members}</div>
      </div>`;
  }).join('');

  const sched = grpRoundRobinSchedule(teams);
  const schedHTML = sched.length ? `
    <p style="font-size:.7rem;font-weight:600;color:#94a3b8;text-transform:uppercase;margin:10px 0 5px">🔄 대진 (${sched.length}라운드)</p>
    ${sched.map(r => `
      <div style="background:#f8fafc;border-radius:8px;padding:7px 8px;margin-bottom:5px">
        <div style="font-size:.7rem;font-weight:700;color:#4f46e5;margin-bottom:3px">라운드 ${r.round}</div>
        ${r.matches.map(m => {
          const t1 = m.team1.map(p => esc(p.name)).join('+');
          const t2 = m.team2.map(p => esc(p.name)).join('+');
          return `<div class="grp-match-block">⚔️ ${t1} vs ${t2}</div>`;
        }).join('')}
        ${r.bye ? `<div style="font-size:.7rem;color:#94a3b8;text-align:center;margin-top:3px">⏸ 대기: ${r.bye.map(p=>esc(p.name)).join('+')}</div>` : ''}
      </div>`).join('')}
  ` : '';

  return `
    <p style="font-size:.7rem;font-weight:600;color:#94a3b8;text-transform:uppercase;margin-bottom:6px">팀 구성</p>
    ${teamsHTML}${schedHTML}
  `;
}

function grpRenderFluidRounds(rounds, groupName, groupIdx) {
  if (!rounds || !rounds.length) return '';
  return `
    <p style="font-size:.7rem;font-weight:600;color:#94a3b8;text-transform:uppercase;margin-bottom:5px">🔄 유동 대진 (${rounds.length}라운드)</p>
    ${rounds.map((r, ri) => {
      const key      = `${groupIdx}_${ri}`;
      const hasSwap  = !!GRP.roundSwaps[key];
      const inEdit   = GRP.roundEditMode === key;
      const curM     = hasSwap ? GRP.roundSwaps[key].matches : r.matches;
      const curBye   = hasSwap ? GRP.roundSwaps[key].soloBye : r.soloBye;
      const matchesH = curM.filter(m => m.team2 !== null).map((m, mi) => {
        if (inEdit) {
          const t1 = m.team1.map((p, pi) =>
            `<button onclick="grpSwapBye(${groupIdx},${ri},${mi},${pi},true)" class="grp-swap-btn">${esc(p.name)}(${p.grade})</button>`
          ).join('+');
          const t2 = m.team2.map((p, pi) =>
            `<button onclick="grpSwapBye(${groupIdx},${ri},${mi},${pi},false)" class="grp-swap-btn">${esc(p.name)}(${p.grade})</button>`
          ).join('+');
          return `<div class="grp-match-block">⚔️ ${mi+1}: ${t1} vs ${t2}</div>`;
        }
        const t1 = m.team1.map(p => `<strong>${esc(p.name)}</strong><span style="color:#94a3b8;font-size:.7rem">(${p.grade})</span>`).join('+');
        const t2 = m.team2.map(p => `<strong>${esc(p.name)}</strong><span style="color:#94a3b8;font-size:.7rem">(${p.grade})</span>`).join('+');
        return `<div class="grp-match-block">⚔️ ${mi+1}: ${t1} vs ${t2}</div>`;
      }).join('');
      return `
        <div style="background:#f8fafc;border-radius:8px;padding:7px 8px;margin-bottom:5px${inEdit?';outline:2px solid #fbbf24':''}">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
            <div style="font-size:.7rem;font-weight:700;color:#4f46e5">라운드 ${r.round}</div>
            ${curBye ? `<div style="display:flex;gap:3px">
              ${inEdit
                ? `<button onclick="grpCancelEdit()" class="grp-ctrl-btn">취소</button>`
                : `<button onclick="grpEnterEdit('${key}')" class="grp-ctrl-btn grp-ctrl-edit">✏️ 교체</button>`}
              ${hasSwap ? `<button onclick="grpResetSwap(${groupIdx},${ri})" class="grp-ctrl-btn grp-ctrl-reset">↩</button>` : ''}
            </div>` : ''}
          </div>
          ${inEdit && curBye ? `<div style="background:#fffbeb;border-left:3px solid #fbbf24;padding:3px 7px;margin-bottom:5px;font-size:.72rem;color:#78350f">
            ↕️ <strong>${esc(curBye.name)}</strong>(${curBye.grade}) 대기 → 교체할 선수 클릭
          </div>` : ''}
          ${matchesH}
          ${curBye ? `<div style="font-size:.7rem;color:${inEdit?'#b45309':'#94a3b8'};text-align:center;margin-top:3px">⏸ 대기: <strong>${esc(curBye.name)}</strong></div>` : ''}
        </div>`;
    }).join('')}
  `;
}

// =====================================================
// 라운드 교체
// =====================================================
function grpEnterEdit(key) { GRP.roundEditMode = GRP.roundEditMode === key ? null : key; grpRenderResults(); }
function grpCancelEdit()    { GRP.roundEditMode = null; grpRenderResults(); }
function grpResetSwap(gi, ri) { delete GRP.roundSwaps[`${gi}_${ri}`]; GRP.roundEditMode = null; grpRenderResults(); }

function grpSwapBye(groupIdx, roundIdx, matchIdx, playerSlot, inTeam1) {
  const g = grpFlatGroups()[groupIdx]; if (!g?.rounds) return;
  const key    = `${groupIdx}_${roundIdx}`;
  const origR  = g.rounds[roundIdx];
  const cur    = GRP.roundSwaps[key]
    ? JSON.parse(JSON.stringify(GRP.roundSwaps[key]))
    : { round: origR.round, matches: origR.matches.map(m => ({ team1:[...m.team1], team2: m.team2?[...m.team2]:null })), soloBye: origR.soloBye };
  if (!cur.soloBye) return;
  const team = inTeam1 ? cur.matches[matchIdx].team1 : cur.matches[matchIdx].team2;
  if (!team || playerSlot >= team.length) return;
  const out = team[playerSlot]; team[playerSlot] = cur.soloBye; cur.soloBye = out;
  GRP.roundSwaps[key] = cur; GRP.roundEditMode = null; grpRenderResults();
  saveGroupingData();
}

// =====================================================
// Drag-and-Drop
// =====================================================
function grpOnDragStart(e, groupIdx, memberId) {
  GRP.dragState = { groupIdx, memberId };
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('grp-member-dragging');
}
function grpOnDragEnd(e) {
  e.currentTarget.classList.remove('grp-member-dragging');
  document.querySelectorAll('.grp-group-card.grp-drag-target').forEach(el => el.classList.remove('grp-drag-target'));
}
function grpOnDragOver(e, tgtIdx) {
  if (!GRP.dragState || GRP.dragState.groupIdx === tgtIdx) return;
  e.preventDefault();
}
function grpOnDragEnter(e, tgtIdx) {
  if (!GRP.dragState || GRP.dragState.groupIdx === tgtIdx) return;
  e.currentTarget.closest('.grp-group-card')?.classList.add('grp-drag-target');
}
function grpOnDragLeave(e) {
  const card = e.currentTarget.closest('.grp-group-card');
  if (card && !card.contains(e.relatedTarget)) card.classList.remove('grp-drag-target');
}
function grpOnDrop(e, tgtIdx) {
  e.preventDefault();
  e.currentTarget.closest('.grp-group-card')?.classList.remove('grp-drag-target');
  if (!GRP.dragState || GRP.dragState.groupIdx === tgtIdx) { GRP.dragState = null; return; }
  const { groupIdx: srcIdx, memberId } = GRP.dragState; GRP.dragState = null;
  grpMoveMember(srcIdx, memberId, tgtIdx);
}

// ---- 터치 (모바일 꾹누르기) ----
function grpOnTouchStart(e, groupIdx, memberId) {
  GRP.longPressTimer = setTimeout(() => {
    GRP.longPressTimer = null;
    if (navigator.vibrate) navigator.vibrate(40);
    grpOpenMoveModal(groupIdx, memberId);
  }, 500);
}
function grpOnTouchEnd()  { if (GRP.longPressTimer) { clearTimeout(GRP.longPressTimer); GRP.longPressTimer = null; } }
function grpOnTouchMove() { if (GRP.longPressTimer) { clearTimeout(GRP.longPressTimer); GRP.longPressTimer = null; } }

// ---- 실제 이동 ----
function grpMoveMember(srcIdx, memberId, tgtIdx) {
  const flat = grpFlatGroups(); const src = flat[srcIdx]; const tgt = flat[tgtIdx];
  if (!src || !tgt) return;
  if (src.members.length <= 1) { showToast('그룹의 마지막 참가자는 이동할 수 없습니다.', 'error'); return; }
  const idx = src.members.findIndex(m => String(m.id) === String(memberId));
  if (idx === -1) return;
  const member = src.members.splice(idx, 1)[0];
  tgt.members.push(member);
  grpRegenerateAt(srcIdx);
  grpRegenerateAt(tgtIdx);
  showToast(`${member.name} → ${tgt.name} 이동`, 'success');
  saveGroupingData();
}

// ---- Move Modal (모바일) ----
function grpOpenMoveModal(groupIdx, memberId) {
  const flat   = grpFlatGroups();
  const member = flat[groupIdx]?.members.find(m => String(m.id) === String(memberId));
  if (!member) return;
  document.getElementById('grp-move-title').textContent = `${member.name} — 그룹 이동`;
  const list = document.getElementById('grp-move-list');
  list.innerHTML = flat.map((g, gi) => {
    if (gi === groupIdx) return '';
    return `<button onclick="grpMoveFromModal(${groupIdx},'${memberId}',${gi})"
      style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;margin-bottom:6px;font-size:.875rem">
      <span style="font-weight:600">${esc(g.name)}</span>
      <span style="color:#4f46e5">→</span>
    </button>`;
  }).join('');
  openModal('grp-modal-move');
}
function grpMoveFromModal(srcIdx, memberId, tgtIdx) {
  closeModal('grp-modal-move');
  grpMoveMember(srcIdx, memberId, tgtIdx);
}

// =====================================================
// 참가자 추가 모달
// =====================================================
function grpOpenAddModal(groupIdx) {
  const g = grpFlatGroups()[groupIdx]; if (!g) return;
  GRP.groupAddTargetIdx = groupIdx;
  document.getElementById('grp-add-title').textContent = `${g.name}에 참가자 추가`;
  document.getElementById('grp-add-search').value = '';
  grpRenderAddList();
  openModal('grp-modal-add');
  setTimeout(() => document.getElementById('grp-add-search')?.focus(), 50);
}

function grpRenderAddList() {
  const g       = grpFlatGroups()[GRP.groupAddTargetIdx];
  const inGroup = new Set((g?.members || []).map(m => String(m.id)));
  const query   = (document.getElementById('grp-add-search')?.value || '').toLowerCase();
  const list    = document.getElementById('grp-add-list');
  const empty   = document.getElementById('grp-add-empty');
  const filtered = grpSportParticipants().filter(p => !query || (p.name||'').toLowerCase().includes(query));

  if (!filtered.length) { list.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  list.innerHTML = filtered.map(p => {
    const already = inGroup.has(String(p.id));
    const gTag    = p.gender ? `<span class="grp-gender-${p.gender}" style="font-size:.72rem">${p.gender}</span>` : '';
    return `
      <label style="display:flex;align-items:center;gap:8px;padding:8px;border:1.5px solid #e2e8f0;border-radius:8px;cursor:${already?'default':'pointer'};margin-bottom:5px;opacity:${already?'0.5':'1'}"
        onclick="grpToggleAddItem(this)">
        <input type="checkbox" value="${p.id}" ${already?'disabled':''} style="flex-shrink:0">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:.875rem">${esc(p.name)}</div>
          <div style="display:flex;align-items:center;gap:4px;margin-top:2px;flex-wrap:wrap">
            <span class="grp-grade-${p.grade}">${p.grade}</span>
            ${gTag}
            <span style="font-size:.75rem;color:#64748b">${grpScore(p)}점</span>
            ${p.affiliation ? `<span style="font-size:.75rem;color:#94a3b8">${esc(p.affiliation)}</span>` : ''}
          </div>
        </div>
        ${already ? '<span style="font-size:.72rem;color:#94a3b8;flex-shrink:0">이미 포함</span>' : ''}
      </label>`;
  }).join('');
}

function grpToggleAddItem(label) {
  const cb = label.querySelector('input[type="checkbox"]');
  if (cb.disabled) return;
  cb.checked = !cb.checked;
  label.style.borderColor = cb.checked ? '#3b82f6' : '#e2e8f0';
  label.style.background  = cb.checked ? '#eff6ff' : '';
}

function grpSubmitAdd() {
  if (GRP.groupAddTargetIdx < 0) return;
  const checked = Array.from(document.querySelectorAll('#grp-add-list input:checked'));
  if (!checked.length) { showToast('추가할 참가자를 선택해주세요.', 'error'); return; }
  const ids  = new Set(checked.map(cb => String(cb.value)));
  const flat = grpFlatGroups();
  const toAdd = grpSportParticipants()
    .filter(p => ids.has(String(p.id)))
    .map(p => ({ ...p, score: grpScore(p) }));
  toAdd.forEach(p => flat[GRP.groupAddTargetIdx].members.push(p));
  grpRegenerateAt(GRP.groupAddTargetIdx);
  closeModal('grp-modal-add');
  showToast(`${toAdd.map(p => p.name).join(', ')} 추가됨`, 'success');
  saveGroupingData();
}

// =====================================================
// 조 재생성
// =====================================================
function grpFlatGroups() {
  if (GRP.results?.doublesType === 'both') return (GRP.results.sections || []).flatMap(s => s.groups || []);
  return GRP.results?.groups || [];
}

function grpRegenerateAt(groupIdx) {
  const flat = grpFlatGroups(); const g = flat[groupIdx]; if (!g) return;
  const members = g.members; const isFluid = GRP.teamMode === 'fluid';
  const isMixed = GRP.results.doublesType === 'mixed';
  const total   = members.reduce((s, p) => s + p.score, 0);
  g.totalScore = total; g.avgScore = +(total / members.length).toFixed(2);
  if (isFluid) { g.rounds = isMixed ? grpMixedFluidRounds(members) : grpFluidRounds(members); g.teams = null; }
  else         { g.teams  = isMixed ? grpPairMixedTeams(members)   : grpPairTeams(members);   g.rounds = null; }
  const oldCard = document.getElementById(`grp-card-${groupIdx}`);
  if (oldCard) { const tmp = document.createElement('div'); tmp.innerHTML = grpRenderGroupCard(g, groupIdx); oldCard.replaceWith(tmp.firstElementChild); }
  else grpRenderResults();
}

// =====================================================
// 다운로드 / 복사
// =====================================================
function grpBuildTXT() {
  const ev    = App.events.find(e => e.id === App.eventId);
  const lines = [`${'='.repeat(48)}`, `  조편성 결과 — ${ev?.title || '이벤트'}`, `  생성: ${new Date().toLocaleString('ko-KR')}`, `${'='.repeat(48)}`];

  function appendGrp(g, gi) {
    lines.push(`\n─ ${g.name}  (총점:${g.totalScore} / 평균:${g.avgScore})`);
    g.members.forEach((m, i) => {
      const gs = m.gender ? ` [${m.gender}]` : '';
      lines.push(`  ${i+1}. ${m.name}(${m.grade})${gs} | 나이:${m.age||'-'} 경력:${m.career||'-'}년 소속:${m.affiliation||'-'} [${m.score}점]`);
    });
    if (g.rounds) {
      lines.push('  [유동 라운드]');
      g.rounds.forEach((r, ri) => {
        const swap = GRP.roundSwaps[`${gi}_${ri}`];
        const curM = swap ? swap.matches : r.matches;
        lines.push(`    라운드 ${r.round}:`);
        curM.forEach((m, mi) => {
          if (!m.team2) return;
          lines.push(`      경기 ${mi+1}: ${m.team1.map(p=>`${p.name}(${p.grade})`).join('+')} vs ${m.team2.map(p=>`${p.name}(${p.grade})`).join('+')}`);
        });
      });
    } else if (g.teams) {
      lines.push('  [팀 구성]');
      g.teams.forEach((team, ti) => lines.push(`    ${g.name} ${ti+1}팀: ${team.map(p=>`${p.name}(${p.grade})`).join(' + ')}`));
      lines.push('  [대진]');
      grpRoundRobinSchedule(g.teams).forEach(r => {
        lines.push(`    라운드 ${r.round}:`);
        r.matches.forEach(m => lines.push(`      ${m.team1.map(p=>p.name).join('+')} vs ${m.team2.map(p=>p.name).join('+')}`));
      });
    }
  }

  if (GRP.results.doublesType === 'both') {
    GRP.results.sections.forEach((s, si) => {
      lines.push(`\n══ ${s.type==='men'?'🟦':'🟥'} ${s.label} ══`);
      const offset = si === 0 ? 0 : (GRP.results.sections[0].groups?.length || 0);
      s.groups.forEach((g, i) => appendGrp(g, offset + i));
    });
  } else {
    grpFlatGroups().forEach((g, i) => appendGrp(g, i));
  }
  return lines.join('\n').trim();
}

function grpBuildCSV() {
  const rows = [['조', '팀', '이름', '급수', '성별', '나이', '경력', '소속', '점수']];
  grpFlatGroups().forEach(g => {
    if (g.teams) {
      g.teams.forEach((team, ti) => team.forEach(m => rows.push([g.name, `${g.name} ${ti+1}팀`, m.name, m.grade, m.gender||'', m.age||'', m.career||'', m.affiliation||'', m.score])));
    } else {
      g.members.forEach(m => rows.push([g.name, '', m.name, m.grade, m.gender||'', m.age||'', m.career||'', m.affiliation||'', m.score]));
    }
  });
  return rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
}

function grpDownloadTXT() {
  if (!GRP.results) return;
  const ev = App.events.find(e => e.id === App.eventId);
  const fn = `${(ev?.title||'조편성').replace(/[\\/:*?"<>|]/g,'_')}_조편성.txt`;
  const blob = new Blob([grpBuildTXT()], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href:url, download:fn, onclick: e => { document.body.appendChild(e.target); setTimeout(()=>{ document.body.removeChild(e.target); URL.revokeObjectURL(url); }, 100); } }).click();
}

function grpDownloadCSV() {
  if (!GRP.results) return;
  const ev = App.events.find(e => e.id === App.eventId);
  const fn = `${(ev?.title||'조편성').replace(/[\\/:*?"<>|]/g,'_')}_조편성.csv`;
  const blob = new Blob(['﻿' + grpBuildCSV()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href:url, download:fn });
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

async function grpCopyText() {
  if (!GRP.results) return;
  try {
    await navigator.clipboard.writeText(grpBuildTXT());
    showToast('클립보드에 복사되었습니다.', 'success');
  } catch (_) {
    showToast('복사에 실패했습니다. 브라우저 권한을 확인해주세요.', 'error');
  }
}

// =====================================================
// 미리보기/내보내기용 HTML 스니펫 생성
// =====================================================
function grpBuildPublicHTML() {
  if (!GRP.results) return '';
  const safe = v => String(v || '-').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const gradeColor = { S:'#854d0e', A:'#166534', B:'#1e40af', C:'#6b21a8', D:'#991b1b', '초보':'#475569' };
  const gradeBg    = { S:'#fef9c3', A:'#dcfce7', B:'#dbeafe', C:'#f3e8ff', D:'#fee2e2', '초보':'#f1f5f9' };

  function gradeBadge(grade) {
    const g = String(grade || '');
    const bg = gradeBg[g] || '#f1f5f9', c = gradeColor[g] || '#475569';
    return `<span style="background:${bg};color:${c};padding:1px 6px;border-radius:4px;font-size:.75rem;font-weight:700">${safe(g) || '-'}</span>`;
  }

  function memberTable(members) {
    const rows = members.map((m, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${safe(m.name)}</strong></td>
        <td>${gradeBadge(m.grade)}</td>
        <td>${m.gender === '남' ? '<span style="color:#2563eb;font-weight:600">남</span>' : m.gender === '여' ? '<span style="color:#db2777;font-weight:600">여</span>' : '-'}</td>
        <td>${safe(m.age)}</td>
        <td>${safe(m.career)}</td>
        <td>${safe(m.affiliation)}</td>
        <td>${m.score}점</td>
      </tr>`).join('');
    return `<div style="overflow-x:auto"><table>
      <thead><tr><th>#</th><th>이름</th><th>급수</th><th>성별</th><th>나이</th><th>경력</th><th>소속</th><th>점수</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function teamsHTML(teams, groupName) {
    if (!teams) return '';
    const teamColors = ['#3b82f6','#f97316','#22c55e','#a855f7'];
    const items = teams.map((team, ti) =>
      `<span style="display:inline-block;background:#f8fafc;border-left:3px solid ${teamColors[ti % teamColors.length]};padding:4px 10px;border-radius:0 6px 6px 0;margin:2px 4px 2px 0;font-size:.85rem">
        <strong>${groupName} ${ti + 1}팀</strong>: ${team.map(p => safe(p.name)).join(' + ')}
      </span>`).join('');
    return `<div style="margin:8px 0">${items}</div>`;
  }

  function roundsHTML(rounds) {
    if (!rounds) return '';
    return rounds.map(r => {
      const matches = r.matches.filter(m => m.team2).map((m, mi) =>
        `<div style="padding:3px 0;font-size:.85rem">경기 ${mi + 1}: <strong>${m.team1.map(p => safe(p.name)).join('+')}</strong> vs <strong>${m.team2.map(p => safe(p.name)).join('+')}</strong></div>`
      ).join('');
      return matches ? `<div style="margin-bottom:6px"><span style="font-size:.8rem;font-weight:600;color:#64748b">라운드 ${r.round}</span>${matches}</div>` : '';
    }).join('');
  }

  function groupCard(g) {
    return `
      <div style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <span style="font-size:1rem;font-weight:700;color:#1e40af">${safe(g.name)}</span>
          <span style="font-size:.8rem;color:#64748b">${g.members.length}명 · 평균 ${g.avgScore}점</span>
        </div>
        ${g.teams ? teamsHTML(g.teams, g.name) : ''}
        ${g.rounds ? `<div style="margin-bottom:8px">${roundsHTML(g.rounds)}</div>` : ''}
        ${memberTable(g.members)}
      </div>`;
  }

  if (GRP.results.doublesType === 'both') {
    return GRP.results.sections.map(section => {
      const icon = section.type === 'men' ? '🟦' : '🟥';
      return `<h3 style="font-size:1rem;font-weight:700;color:#1e293b;margin:16px 0 10px">${icon} ${safe(section.label)}</h3>
        ${section.groups.map(g => groupCard(g)).join('')}`;
    }).join('');
  }
  return GRP.results.groups.map(g => groupCard(g)).join('');
}
