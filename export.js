// =====================================================
// export.js
// 이벤트 데이터 내보내기 (HTML, JSON, CSV, 인쇄)
// =====================================================

// HTML 파일로 내보내기 (공유용 상세 페이지)
function exportAsHTML(event, participants, sponsors, sponsorItems, staff, groupingHTML) {
  const html = buildPublicHTML(event, participants, sponsors, sponsorItems, staff, groupingHTML);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(event.title)}_상세페이지.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// JSON 백업 다운로드
function exportAsJSON(event, participants, sponsors, sponsorItems, staff) {
  const data = { event, participants, sponsors, sponsorItems, staff, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(event.title)}_백업.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// 참가자 CSV 다운로드
function exportParticipantsCSV(event, participants) {
  const headers = ['번호', '이름', '급수', '나이', '경력', '성별', '소속', '연락처', '비고'];
  const rows = participants.map((p, i) => [
    i + 1, p.name || '', p.grade || '', p.age || '', p.career || '',
    p.gender || '', p.affiliation || '', p.phone || '', p.memo || ''
  ]);
  downloadCSV([headers, ...rows], `${sanitizeFilename(event.title)}_참가자목록`);
}

// 찬조물품 CSV 다운로드
function exportSponsorItemsCSV(event, sponsorItems) {
  const headers = ['번호', '물품명', '수량', '금액', '찬조자', '사용처', '비고'];
  const rows = sponsorItems.map((item, i) => [
    i + 1, item.itemName || '', item.quantity || '', item.amount || '',
    item.sponsorName || '', item.usage || '', item.memo || ''
  ]);
  downloadCSV([headers, ...rows], `${sanitizeFilename(event.title)}_찬조물품`);
}

function downloadCSV(rows, filename) {
  const bom = '﻿'; // Excel에서 한글 깨짐 방지
  const csv = bom + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// 인쇄
function printPreview(event, participants, sponsors, sponsorItems, staff, groupingHTML) {
  const html = buildPublicHTML(event, participants, sponsors, sponsorItems, staff, groupingHTML);
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 500);
}

function sanitizeFilename(name) {
  return (name || 'event').replace(/[\\/:*?"<>|]/g, '_').trim();
}

// =====================================================
// 공개용 HTML 생성
// =====================================================
function buildPublicHTML(event, participants, sponsors, sponsorItems, staff, groupingHTML) {
  const formatDate = (d) => d ? d.replace(/-/g, '.') : '-';
  const safe = (v) => String(v || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const participantRows = participants.length
    ? participants.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${safe(p.name)}</strong></td>
        <td>${safe(p.grade)}</td>
        <td>${safe(p.age)}</td>
        <td>${safe(p.career)}</td>
        <td>${safe(p.gender)}</td>
        <td>${safe(p.affiliation)}</td>
        <td>${safe(p.memo)}</td>
      </tr>`).join('')
    : `<tr><td colspan="8" class="empty">참가자 없음</td></tr>`;

  const sponsorRows = sponsors.length
    ? sponsors.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${safe(s.name)}</strong></td>
        <td>${safe(s.affiliation)}</td>
        <td>${safe(s.type)}</td>
        <td>${safe(s.phone)}</td>
        <td>${safe(s.memo)}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" class="empty">찬조자 없음</td></tr>`;

  const sponsorItemRows = sponsorItems.length
    ? sponsorItems.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${safe(item.itemName)}</strong></td>
        <td>${safe(item.quantity)}</td>
        <td>${item.amount ? Number(item.amount).toLocaleString() + '원' : '-'}</td>
        <td>${safe(item.sponsorName)}</td>
        <td>${safe(item.usage)}</td>
        <td>${safe(item.memo)}</td>
      </tr>`).join('')
    : `<tr><td colspan="7" class="empty">찬조물품 없음</td></tr>`;

  const staffRows = staff.length
    ? staff.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${safe(s.name)}</strong></td>
        <td>${safe(s.role)}</td>
        <td>${safe(s.phone)}</td>
        <td>${safe(s.task)}</td>
        <td>${safe(s.memo)}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" class="empty">운영진 없음</td></tr>`;

  const totalAmount = sponsorItems.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safe(event.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Noto Sans KR', -apple-system, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
    .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border-radius: 16px; padding: 32px; margin-bottom: 24px; }
    .header h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 8px; }
    .header .meta { opacity: 0.85; font-size: 0.95rem; }
    .header .meta span { margin-right: 20px; }
    .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .card h2 { font-size: 1.1rem; font-weight: 700; color: #1e40af; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e0e7ff; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .info-item label { font-size: 0.8rem; color: #64748b; font-weight: 600; display: block; margin-bottom: 4px; }
    .info-item p { font-size: 0.95rem; color: #1e293b; }
    .notice-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 0.9rem; white-space: pre-wrap; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
    td { padding: 9px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f8fafc; }
    td.empty { text-align: center; color: #94a3b8; padding: 20px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; background: #e0e7ff; color: #3730a3; }
    .summary { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px; padding-top: 12px; border-top: 1px solid #f1f5f9; }
    .summary-item { background: #f8fafc; border-radius: 8px; padding: 8px 16px; text-align: center; }
    .summary-item .num { font-size: 1.3rem; font-weight: 700; color: #1d4ed8; }
    .summary-item .lbl { font-size: 0.75rem; color: #64748b; }
    .footer { text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 24px 0; }
    @media (max-width: 600px) {
      .header h1 { font-size: 1.4rem; }
      .info-grid { grid-template-columns: 1fr 1fr; }
      table { font-size: 0.8rem; }
      th, td { padding: 7px 5px; }
    }
    @media print {
      body { background: white; }
      .container { max-width: 100%; padding: 0; }
      .card { box-shadow: none; border: 1px solid #e2e8f0; page-break-inside: avoid; }
      .header { background: #1e40af !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${safe(event.title)}</h1>
    <div class="meta">
      <span>📅 ${formatDate(event.eventDate)}</span>
      <span>📍 ${safe(event.location)}</span>
      <span>🏢 ${safe(event.organizer)}</span>
    </div>
  </div>

  <div class="card">
    <h2>📋 이벤트 정보</h2>
    <div class="info-grid">
      <div class="info-item"><label>이벤트 내용</label><p>${safe(event.content)}</p></div>
      <div class="info-item"><label>이벤트 목적</label><p>${safe(event.purpose)}</p></div>
      <div class="info-item"><label>일자</label><p>${formatDate(event.eventDate)}</p></div>
      <div class="info-item"><label>장소</label><p>${safe(event.location)}</p></div>
      <div class="info-item"><label>주최/주관</label><p>${safe(event.organizer)}</p></div>
    </div>
    ${event.notice ? `<div style="margin-top:16px"><label style="font-size:.8rem;color:#64748b;font-weight:600;display:block;margin-bottom:6px">안내사항</label><div class="notice-box">${safe(event.notice)}</div></div>` : ''}
  </div>

  <div class="card">
    <h2>👥 참가자 목록 (총 ${participants.length}명)</h2>
    <div style="overflow-x:auto">
      <table>
        <thead><tr><th>#</th><th>이름</th><th>급수</th><th>나이</th><th>경력</th><th>성별</th><th>소속</th><th>비고</th></tr></thead>
        <tbody>${participantRows}</tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <h2>🤝 찬조자 목록 (총 ${sponsors.length}명)</h2>
    <div style="overflow-x:auto">
      <table>
        <thead><tr><th>#</th><th>찬조자명</th><th>소속</th><th>찬조구분</th><th>연락처</th><th>메모</th></tr></thead>
        <tbody>${sponsorRows}</tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <h2>🎁 찬조물품 목록 (총 ${sponsorItems.length}건)</h2>
    <div style="overflow-x:auto">
      <table>
        <thead><tr><th>#</th><th>물품명</th><th>수량</th><th>금액</th><th>찬조자</th><th>사용처</th><th>비고</th></tr></thead>
        <tbody>${sponsorItemRows}</tbody>
      </table>
    </div>
    ${totalAmount > 0 ? `<div class="summary"><div class="summary-item"><div class="num">${totalAmount.toLocaleString()}원</div><div class="lbl">총 찬조금액</div></div><div class="summary-item"><div class="num">${sponsorItems.length}건</div><div class="lbl">총 물품 수</div></div></div>` : ''}
  </div>

  <div class="card">
    <h2>🛠 운영진 목록 (총 ${staff.length}명)</h2>
    <div style="overflow-x:auto">
      <table>
        <thead><tr><th>#</th><th>이름</th><th>역할</th><th>연락처</th><th>담당업무</th><th>비고</th></tr></thead>
        <tbody>${staffRows}</tbody>
      </table>
    </div>
  </div>

  ${groupingHTML ? `
  <div class="card">
    <h2>🏟 조편성 결과</h2>
    ${groupingHTML}
  </div>` : ''}

  <div class="footer">생성일: ${new Date().toLocaleDateString('ko-KR')} · 이벤트 관리 시스템</div>
</div>
</body>
</html>`;
}
