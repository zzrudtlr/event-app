// =====================================================
// firebase-service.js
// Firestore CRUD 함수 모음 (localStorage fallback 포함)
// =====================================================

// ---- 로컬 스토리지 헬퍼 ----
function localGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}
function localSet(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}
function localId() {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
function nowISO() { return new Date().toISOString(); }
function serverTs() {
  return firebaseEnabled ? firebase.firestore.FieldValue.serverTimestamp() : null;
}

// =====================================================
// EVENTS
// =====================================================

async function getEvents() {
  const currentUser = getCurrentUser();
  if (firebaseEnabled && db) {
    let query = db.collection('events');
    if (currentUser) query = query.where('userId', '==', currentUser.uid);
    const snap = await query.get();
    const events = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
    }));
    return events.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
  const events = localGet('events');
  if (currentUser) {
    return events.filter(e => e.userId === currentUser.uid).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
  return events.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function getEvent(eventId) {
  if (firebaseEnabled && db) {
    const doc = await db.collection('events').doc(eventId).get();
    if (!doc.exists) return null;
    const d = doc.data();
    return {
      id: doc.id, ...d,
      createdAt: d.createdAt?.toDate?.()?.toISOString() || d.createdAt,
      updatedAt: d.updatedAt?.toDate?.()?.toISOString() || d.updatedAt,
    };
  }
  return localGet('events').find(e => e.id === eventId) || null;
}

async function createEvent(data) {
  const ts = nowISO();
  const currentUser = getCurrentUser();
  const eventData = { ...data };
  if (currentUser) eventData.userId = currentUser.uid;
  if (firebaseEnabled && db) {
    const ref = await db.collection('events').add({
      ...eventData,
      createdAt: serverTs(),
      updatedAt: serverTs(),
    });
    return ref.id;
  }
  const id = localId();
  const events = localGet('events');
  events.push({ id, ...eventData, createdAt: ts, updatedAt: ts });
  localSet('events', events);
  return id;
}

async function updateEvent(eventId, data) {
  const ts = nowISO();
  if (firebaseEnabled && db) {
    await db.collection('events').doc(eventId).update({
      ...data,
      updatedAt: serverTs(),
    });
    return;
  }
  const events = localGet('events');
  const idx = events.findIndex(e => e.id === eventId);
  if (idx !== -1) events[idx] = { ...events[idx], ...data, updatedAt: ts };
  localSet('events', events);
}

async function deleteEvent(eventId) {
  if (firebaseEnabled && db) {
    // 서브컬렉션은 Firestore에서 자동 삭제 안 됨 → 직접 삭제
    await deleteSubcollection(eventId, 'participants');
    await deleteSubcollection(eventId, 'sponsors');
    await deleteSubcollection(eventId, 'sponsorItems');
    await deleteSubcollection(eventId, 'staff');
    await deleteSubcollection(eventId, 'schedules');
    await db.collection('events').doc(eventId).delete();
    return;
  }
  let events = localGet('events');
  localSet('events', events.filter(e => e.id !== eventId));
  localStorage.removeItem(`participants_${eventId}`);
  localStorage.removeItem(`sponsors_${eventId}`);
  localStorage.removeItem(`sponsorItems_${eventId}`);
  localStorage.removeItem(`staff_${eventId}`);
  localStorage.removeItem(`schedules_${eventId}`);
}

async function duplicateEvent(eventId) {
  const original = await getEvent(eventId);
  if (!original) throw new Error('이벤트를 찾을 수 없습니다.');
  const { id, createdAt, updatedAt, ...data } = original;
  data.title = `[복사] ${data.title}`;
  return await createEvent(data);
}

// Firestore 서브컬렉션 일괄 삭제 헬퍼
async function deleteSubcollection(eventId, subcollection) {
  if (!firebaseEnabled || !db) return;
  const snap = await db.collection('events').doc(eventId).collection(subcollection).get();
  const batch = db.batch();
  snap.docs.forEach(doc => batch.delete(doc.ref));
  if (snap.docs.length > 0) await batch.commit();
}

// =====================================================
// PARTICIPANTS
// =====================================================

async function getParticipants(eventId) {
  if (firebaseEnabled && db) {
    const snap = await db.collection('events').doc(eventId)
      .collection('participants').orderBy('createdAt', 'asc').get();
    return snap.docs.map(doc => ({
      id: doc.id, ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
    }));
  }
  return localGet(`participants_${eventId}`);
}

async function addParticipant(eventId, data) {
  const ts = nowISO();
  if (firebaseEnabled && db) {
    const ref = await db.collection('events').doc(eventId)
      .collection('participants').add({ ...data, createdAt: serverTs() });
    return ref.id;
  }
  const id = localId();
  const list = localGet(`participants_${eventId}`);
  list.push({ id, ...data, createdAt: ts });
  localSet(`participants_${eventId}`, list);
  return id;
}

async function updateParticipant(eventId, participantId, data) {
  if (firebaseEnabled && db) {
    await db.collection('events').doc(eventId)
      .collection('participants').doc(participantId).update(data);
    return;
  }
  const list = localGet(`participants_${eventId}`);
  const idx = list.findIndex(p => p.id === participantId);
  if (idx !== -1) list[idx] = { ...list[idx], ...data };
  localSet(`participants_${eventId}`, list);
}

async function deleteParticipant(eventId, participantId) {
  if (firebaseEnabled && db) {
    await db.collection('events').doc(eventId)
      .collection('participants').doc(participantId).delete();
    return;
  }
  let list = localGet(`participants_${eventId}`);
  localSet(`participants_${eventId}`, list.filter(p => p.id !== participantId));
}

async function addParticipantsBatch(eventId, participants) {
  if (firebaseEnabled && db) {
    const col = db.collection('events').doc(eventId).collection('participants');
    const batch = db.batch();
    participants.forEach(p => {
      const ref = col.doc();
      batch.set(ref, { ...p, createdAt: serverTs() });
    });
    await batch.commit();
    return;
  }
  const ts = nowISO();
  const list = localGet(`participants_${eventId}`);
  participants.forEach(p => list.push({ id: localId(), ...p, createdAt: ts }));
  localSet(`participants_${eventId}`, list);
}

// =====================================================
// SPONSORS
// =====================================================

async function getSponsors(eventId) {
  if (firebaseEnabled && db) {
    const snap = await db.collection('events').doc(eventId)
      .collection('sponsors').orderBy('createdAt', 'asc').get();
    return snap.docs.map(doc => ({
      id: doc.id, ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
    }));
  }
  return localGet(`sponsors_${eventId}`);
}

async function addSponsor(eventId, data) {
  const ts = nowISO();
  if (firebaseEnabled && db) {
    const ref = await db.collection('events').doc(eventId)
      .collection('sponsors').add({ ...data, createdAt: serverTs() });
    return ref.id;
  }
  const id = localId();
  const list = localGet(`sponsors_${eventId}`);
  list.push({ id, ...data, createdAt: ts });
  localSet(`sponsors_${eventId}`, list);
  return id;
}

async function updateSponsor(eventId, sponsorId, data) {
  if (firebaseEnabled && db) {
    await db.collection('events').doc(eventId)
      .collection('sponsors').doc(sponsorId).update(data);
    return;
  }
  const list = localGet(`sponsors_${eventId}`);
  const idx = list.findIndex(s => s.id === sponsorId);
  if (idx !== -1) list[idx] = { ...list[idx], ...data };
  localSet(`sponsors_${eventId}`, list);
}

async function deleteSponsor(eventId, sponsorId) {
  if (firebaseEnabled && db) {
    await db.collection('events').doc(eventId)
      .collection('sponsors').doc(sponsorId).delete();
    return;
  }
  let list = localGet(`sponsors_${eventId}`);
  localSet(`sponsors_${eventId}`, list.filter(s => s.id !== sponsorId));
}

// =====================================================
// SPONSOR ITEMS
// =====================================================

async function getSponsorItems(eventId) {
  if (firebaseEnabled && db) {
    const snap = await db.collection('events').doc(eventId)
      .collection('sponsorItems').orderBy('createdAt', 'asc').get();
    return snap.docs.map(doc => ({
      id: doc.id, ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
    }));
  }
  return localGet(`sponsorItems_${eventId}`);
}

async function addSponsorItem(eventId, data) {
  const ts = nowISO();
  if (firebaseEnabled && db) {
    const ref = await db.collection('events').doc(eventId)
      .collection('sponsorItems').add({ ...data, createdAt: serverTs() });
    return ref.id;
  }
  const id = localId();
  const list = localGet(`sponsorItems_${eventId}`);
  list.push({ id, ...data, createdAt: ts });
  localSet(`sponsorItems_${eventId}`, list);
  return id;
}

async function updateSponsorItem(eventId, itemId, data) {
  if (firebaseEnabled && db) {
    await db.collection('events').doc(eventId)
      .collection('sponsorItems').doc(itemId).update(data);
    return;
  }
  const list = localGet(`sponsorItems_${eventId}`);
  const idx = list.findIndex(i => i.id === itemId);
  if (idx !== -1) list[idx] = { ...list[idx], ...data };
  localSet(`sponsorItems_${eventId}`, list);
}

async function deleteSponsorItem(eventId, itemId) {
  if (firebaseEnabled && db) {
    await db.collection('events').doc(eventId)
      .collection('sponsorItems').doc(itemId).delete();
    return;
  }
  let list = localGet(`sponsorItems_${eventId}`);
  localSet(`sponsorItems_${eventId}`, list.filter(i => i.id !== itemId));
}

// =====================================================
// STAFF
// =====================================================

async function getStaff(eventId) {
  if (firebaseEnabled && db) {
    const snap = await db.collection('events').doc(eventId)
      .collection('staff').orderBy('createdAt', 'asc').get();
    return snap.docs.map(doc => ({
      id: doc.id, ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
    }));
  }
  return localGet(`staff_${eventId}`);
}

async function addStaff(eventId, data) {
  const ts = nowISO();
  if (firebaseEnabled && db) {
    const ref = await db.collection('events').doc(eventId)
      .collection('staff').add({ ...data, createdAt: serverTs() });
    return ref.id;
  }
  const id = localId();
  const list = localGet(`staff_${eventId}`);
  list.push({ id, ...data, createdAt: ts });
  localSet(`staff_${eventId}`, list);
  return id;
}

async function updateStaff(eventId, staffId, data) {
  if (firebaseEnabled && db) {
    await db.collection('events').doc(eventId)
      .collection('staff').doc(staffId).update(data);
    return;
  }
  const list = localGet(`staff_${eventId}`);
  const idx = list.findIndex(s => s.id === staffId);
  if (idx !== -1) list[idx] = { ...list[idx], ...data };
  localSet(`staff_${eventId}`, list);
}

async function deleteStaff(eventId, staffId) {
  if (firebaseEnabled && db) {
    await db.collection('events').doc(eventId)
      .collection('staff').doc(staffId).delete();
    return;
  }
  let list = localGet(`staff_${eventId}`);
  localSet(`staff_${eventId}`, list.filter(s => s.id !== staffId));
}

// =====================================================
// SCHEDULES
// =====================================================

async function getSchedules(eventId) {
  if (firebaseEnabled && db) {
    const snap = await db.collection('events').doc(eventId)
      .collection('schedules').orderBy('createdAt', 'asc').get();
    return snap.docs.map(doc => ({
      id: doc.id, ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
    }));
  }
  return localGet(`schedules_${eventId}`);
}

async function addSchedule(eventId, data) {
  const ts = nowISO();
  if (firebaseEnabled && db) {
    const ref = await db.collection('events').doc(eventId)
      .collection('schedules').add({ ...data, createdAt: serverTs() });
    return ref.id;
  }
  const id = localId();
  const list = localGet(`schedules_${eventId}`);
  list.push({ id, ...data, createdAt: ts });
  localSet(`schedules_${eventId}`, list);
  return id;
}

async function updateSchedule(eventId, scheduleId, data) {
  if (firebaseEnabled && db) {
    await db.collection('events').doc(eventId)
      .collection('schedules').doc(scheduleId).update(data);
    return;
  }
  const list = localGet(`schedules_${eventId}`);
  const idx = list.findIndex(s => s.id === scheduleId);
  if (idx !== -1) list[idx] = { ...list[idx], ...data };
  localSet(`schedules_${eventId}`, list);
}

async function deleteSchedule(eventId, scheduleId) {
  if (firebaseEnabled && db) {
    await db.collection('events').doc(eventId)
      .collection('schedules').doc(scheduleId).delete();
    return;
  }
  let list = localGet(`schedules_${eventId}`);
  localSet(`schedules_${eventId}`, list.filter(s => s.id !== scheduleId));
}
