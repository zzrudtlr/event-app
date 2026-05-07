// =====================================================
// firebase-config.js
// Firebase 설정 - 여기에 Firebase 콘솔의 config 값을 붙여넣으세요
// =====================================================
//
// 설정 방법:
// 1. https://console.firebase.google.com 접속
// 2. 프로젝트 선택 > 프로젝트 설정 (⚙️)
// 3. "내 앱" 섹션에서 웹 앱 선택
// 4. "SDK 설정 및 구성" > firebaseConfig 값 복사
// 5. 아래 YOUR_* 부분을 실제 값으로 교체
//
// ⚠️ API Key는 공개되어도 되지만, 반드시 Firestore 보안 규칙을 설정하세요.
// 보안 규칙 예시는 README.md 또는 파일 하단 주석을 참고하세요.
// =====================================================

const firebaseConfig = {
apiKey: "AIzaSyDYqBT-O2OuditfSHzz8T0CqRR4yWLMxw8",
  authDomain: "event-app-660e5.firebaseapp.com",
  projectId: "event-app-660e5",
  storageBucket: "event-app-660e5.firebasestorage.app",
  messagingSenderId: "278493461466",
  appId: "1:278493461466:web:6d0a07dd1d7ad699611ee3",
  measurementId: "G-EPTEPQR82Q"
};

// =====================================================
// Firebase 초기화
// =====================================================
let db = null;
let auth = null;
let firebaseEnabled = false;

function initFirebase() {
  try {
    // config에 실제 값이 입력됐는지 확인
    if (firebaseConfig.apiKey === "YOUR_API_KEY" || !firebaseConfig.projectId) {
      console.warn("⚠️ Firebase 미설정: firebase-config.js에 실제 config 값을 입력해주세요.");
      return false;
    }

    // Firebase 앱이 이미 초기화된 경우 재사용
    if (firebase.apps && firebase.apps.length > 0) {
      db = firebase.firestore();
      firebaseEnabled = true;
      return true;
    }

    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    firebaseEnabled = true;
    console.log("✅ Firebase 초기화 성공");
    return true;
  } catch (e) {
    console.error("Firebase 초기화 실패:", e);
    return false;
  }
}

// =====================================================
// Auth 헬퍼
// =====================================================
function getCurrentUser() {
  return auth?.currentUser || null;
}

async function authSignUp(email, password) {
  return await auth.createUserWithEmailAndPassword(email, password);
}

async function authSignIn(email, password) {
  return await auth.signInWithEmailAndPassword(email, password);
}

async function authSignOut() {
  return await auth.signOut();
}

// =====================================================
// Firestore 보안 규칙 예시 (Firebase 콘솔 > Firestore > 규칙 탭에 붙여넣기)
//
// [1] 테스트용 규칙 (개발 중에만 사용, 실서비스 절대 금지)
// ------------------------------------------------------
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /{document=**} {
//       allow read, write: if true;
//     }
//   }
// }
//
// [2] 로그인 사용자만 허용하는 규칙 (실서비스 권장)
// ------------------------------------------------------
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /events/{eventId} {
//       allow read, write: if request.auth != null;
//
//       match /participants/{participantId} {
//         allow read, write: if request.auth != null;
//       }
//       match /sponsors/{sponsorId} {
//         allow read, write: if request.auth != null;
//       }
//       match /sponsorItems/{itemId} {
//         allow read, write: if request.auth != null;
//       }
//       match /staff/{staffId} {
//         allow read, write: if request.auth != null;
//       }
//     }
//   }
// }
// =====================================================
