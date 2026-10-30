# AIFFEL Campus Agent Code Review Templete
- 개발자 : 이성진
- 리뷰어 : 전재문

> **리뷰 대상**: `Quest_03` — ORBIT Scheduler (개인 일정·할 일·프로젝트 + 승인형 고객 예약)
> **리뷰 방법**
> - 레포지토리 fork → clone 후 `README.md`, `PRD.pdf`, `ORBIT-Scheduler.exe`를 확인했습니다.
> - 레포에는 소스 코드 없이 실행파일만 있어서, exe를 **실행하지 않고** 안에 묶인 ZIP 리소스(앱 소스 151개 항목)를 추출해 코드를 읽었습니다.
> - 아래 코드 경로는 exe 내부 기준(`ORBIT-Scheduler/app/...`)입니다.
> - 실행 화면 근거는 개발자 시연을 보며 `Quest_03/review-evidence/`에 캡처를 추가할 예정입니다. 해당 칸은 `📷 캡처 추가 예정`으로 표시했습니다.

---

# ART(Agent Review Template)

[O]  **1. 원하는 기능이 의도한 대로 동작하나요?**
- 요청(프롬프트)한 기능이 정상적으로 구현되었는지? - 개발자(상대방이 요청한 프롬프트는 확인 불가), PRD 등을 통해 확인해야할듯
- 실제 실행 화면/결과물을 캡처하여 근거로 첨부

**PRD 요구사항 대비 구현 확인 (코드 기준)**

| PRD 항목 | 구현 여부 | 근거 |
|---|---|---|
| FR-02 Todo CRUD·완료·마감일 | O | `apps/api/src/application/scheduler.mjs` `mutate()` — 생성(POST)·수정(PATCH)·삭제(DELETE), `completed`, `dueDate` 처리 |
| FR-02 빈 제목 거부 | O | `packages/domain/src/index.mjs` `title()` — 공백 제거 후 1~160자가 아니면 400 |
| FR-17 재시작 후 유지 (SQLite) | O | `persistence/sqlite/index.mjs` — `node:sqlite` + WAL, 마이그레이션 `0001~0003` |
| FR-03 일정 + 시간 충돌 검사 | O | `scheduler.mjs` `check()` — 겹치면 409 `SLOT_CONFLICT` |
| FR-09/10 빈 시간·고객 신청(pending) | O | `domain/index.mjs` `slots()` (2시간 전~30일, 버퍼 반영), `scheduler.mjs` `request()` |
| FR-12 승인 시 재검사 + 원자적 확정 | O | `decide()` — 하나의 `BEGIN IMMEDIATE` 트랜잭션 안에서 만료→슬롯→충돌 재검사 → event 저장 + 상태 변경 + 감사 기록 |
| 7.4 멱등성 / 동시 수정 | O | `idem()` (키 해시 + body 해시 비교), `version()` (`expectedVersion` 불일치 시 409) |
| FR-15 상태 조회 링크 | O | 32바이트 랜덤 `statusCapability`는 해시로만 저장. 응답에는 상태·시간만 담김 |
| FR-05 3D 보기 | △ | PRD는 Three.js 3D였으나 실제로는 2D `three-day`(어제/오늘/내일) 브리핑과 월간 달력으로 바뀐 것으로 보임 |
| FR-17/18 Supabase 전환·RLS | X | `database/supabase/migrations`·`policies`에는 README만 있음. 클라우드 쪽은 Supabase 대신 Cloudflare Worker/D1 중계로 바뀐 것으로 보임 (`Readme.txt`) |
| AC-08 두 계정 격리 | X | `ownerId='local-owner'` 1인 고정 구조. `database/seeds/scenarios.json` 상태가 `"fixture-plan-not-loaded"` |

**근거 코드 1 — Todo 생성/수정/삭제와 입력 검증** (`apps/api/src/application/scheduler.mjs`)
```js
mutate(owner,kind,method,id,body) { return repo.transaction(()=>{
  const old=id?get(owner,kind,id):null;
  if(old) version(old,body);                       // 낙관적 잠금 (expectedVersion)
  if(method==='DELETE') { ... repo.remove(owner,kind,id);repo.audit(owner,id,'delete',clock());return {ok:true};}
  let e={id:old?.id||randomUUID(),title:title(body.title),version:(old?.version||0)+1, ...};
  ...
  else if(kind==='task') {requireValue(body.completed===undefined||typeof body.completed==='boolean','완료 값을 확인하세요.');
    e.completed=body.completed??old?.completed??false;e.dueDate=localDate(...);}
```

**근거 코드 2 — 승인 시 재검사 후 원자적 확정** (`scheduler.mjs` `decide()`)
```js
decide(owner,id,action,body,key) {return repo.transaction(()=>idem(`decision:${owner}:${id}:${action}`,key,body,()=>{
  ...
  if(action==='approve') {
    requireValue(b.expiresAt>clock(),'만료된 요청입니다.',410,'REQUEST_EXPIRED');
    const slot=validSlot(owner,b.startsAt, ...);       // 공개 규칙 재검사
    check(owner,Date.parse(b.startsAt),Date.parse(b.endsAt),b.buffer);   // 충돌 재검사
    repo.save(owner,'event',{id:b.id, ..., requestId:b.id});
  }
```
→ PRD 5.3(승인 순간 재검사)과 7.1(pending은 시간을 점유하지 않음)이 코드에 그대로 반영되어 있습니다.

**실행 화면 근거**
- 📷 로그인(초기 비밀번호 설정) 화면 — `review-evidence/01-setup.png` (캡처 추가 예정)
- 📷 할 일 추가 → 완료 체크 → 수정 → 삭제 — `review-evidence/02-todo-crud.png` (캡처 추가 예정)
- 📷 프로그램 종료 후 재실행 시 데이터 유지 — `review-evidence/03-persist.png` (캡처 추가 예정)
- 📷 고객 신청 → 승인함 승인 → 일정 반영 — `review-evidence/04-booking.png` (캡처 추가 예정)

---

[O]  **2. 보안 검토를 수행했나요?**
- API 키, 비밀번호 등 민감 정보가 코드에 하드코딩되지 않았는지
- 사용자 입력값 검증 등 기본 보안 사항 확인
- 외부 데이터/의존성 사용 시 출처와 위험 검토했는지

**(1) 민감 정보 하드코딩 — API 키·비밀번호 없음**
- 전체 소스에서 `sk-`, `AIza`, `eyJ`(JWT), `client_secret`, `api_key` 패턴을 검색한 결과 하드코딩된 키는 없었습니다.
- Google OAuth 클라이언트 ID·시크릿은 앱 화면에서 입력받습니다. 입력값은 DB에 **AES-256-GCM으로 암호화**해 저장합니다.
  ```js
  // persistence/sqlite/index.mjs
  if(!existsSync(keyPath)) writeFileSync(keyPath,randomBytes(32),{mode:0o600,flag:'wx'});
  function seal(value) { const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv); ... }
  saveConfig(owner,name,value) { ... seal(JSON.stringify(value)) }
  ```
- ⚠️ 다만 **개인 연락처가 코드에 들어 있습니다** → 개선 제안 1 참고.
  - `scheduler.mjs` 6행의 기본 설정값 `senderPhone:'010-****-6269'` (실제 번호, 리뷰에서는 가림)
  - 번들 `Readme.txt`의 Google 계정 이메일

**(2) 인증·세션**
```js
// infrastructure/auth/password.mjs — scrypt + salt, timingSafeEqual, 6회 실패 시 15분 잠금
const result=await derive(password.slice(0,128),salt,64);
const ok=!!stored&&timingSafeEqual(result,Buffer.from(stored.hash,'hex'));
if(!ok){if(++failures>=6){lockedUntil=Date.now()+15*60000;failures=0;} ...}
```
```js
// bootstrap/server.mjs — HttpOnly + SameSite=Strict 쿠키, 12시간 만료
res.setHeader('Set-Cookie',`orbit=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`);
```
- 초기 비밀번호 설정(`/auth/setup`)에는 실행 창에서만 받을 수 있는 `launchToken`이 필요합니다. 그래서 다른 사람이 먼저 비밀번호를 정해버리는 문제를 막습니다.

**(3) 입력·요청 방어** (`bootstrap/server.mjs`)
| 방어 | 코드 |
|---|---|
| 외부 접근 차단 | `127.0.0.1` 바인딩 + Host 헤더 `^(127\.0\.0\.1\|localhost):\d+$` 검사 (DNS rebinding 방어) |
| CSRF | 쓰기 요청 시 `Origin` 일치 확인 + `Content-Type: application/json`만 허용 |
| 요청 제한 | IP별 분당 300회 → 429 |
| 크기 제한 | 본문 256KB (업로드만 12MB), 파일 8MB, 텍스트 10만 자 |
| XSS | CSP `default-src 'self'; script-src 'self'`, 화면 출력 시 `escape()` 사용 |
| 경로 탐색 | 정적 파일 `resolve()` 후 `web+sep`로 시작하는지 + 확장자 허용 목록 |
| SQL Injection | 모든 쿼리가 `db.prepare(...).run(?,?)` 파라미터 바인딩 |
| 오류 노출 | 500 오류는 `'처리하지 못했습니다'`로만 응답 (스택 트레이스 미노출) |

**(4) 외부 데이터·의존성**
- npm 의존성 없이 Node 내장 모듈(`node:sqlite`, `node:crypto`, `node:http`)만 사용해 공급망 위험이 작습니다. 런타임 `node.exe`와 `NODE-LICENSE.txt`를 함께 넣어 출처를 밝혔습니다.
- 외부 예약 중계 주소는 허용 목록으로 고정되어 있습니다(`https:` + 지정 호스트만). 중계 요청은 AES-GCM으로 암호화되며, 경로도 정규식 허용 목록으로 제한합니다.
  ```js
  // owner-relay.mjs
  if(!/^\/api\/v1\/(owner\/|auth\/(session|login|logout|change-password)$)/.test(p)||p.includes('..')||p.includes('://'))throw new Error('invalid path');
  ```
- ⚠️ 이 중계 기능 때문에, 로컬 전용(127.0.0.1)으로 설계한 관리자 API를 **인터넷에서 비밀번호 하나로** 쓸 수 있습니다. 위험과 대응은 개선 제안 3 참고.

---

[X]  **3. 에러가 난 부분을 디버깅하여 "문제를 해결한 기록"을 남겼나요?**
- 에이전트가 만든 코드의 오류를 어떻게 발견하고 수정했는지
- 새로운 시도 및 추가 실험이 기록되어 있는지

**확인한 내용**
- 레포의 `Quest_03` 커밋은 2개입니다(`Create Quest_03`, `Add Quest_03 README, standalone Windows executable and PRD PDF`). 소스 코드와 개발 과정 커밋은 올라와 있지 않습니다.
  ```
  $ git log --oneline -- Quest_03
  2c8898b Add Quest_03 README, standalone Windows executable and PRD PDF
  e2b225a Create Quest_03
  ```
- 디버깅 로그, 트러블슈팅 문서, 테스트 코드는 레포와 exe 번들 어디에도 없습니다.

**기록으로 볼 수 있는 흔적 (참고)**
- 번들 `Readme.txt`에 버전별 변경 이력이 있습니다. 예: "업데이트: 로그인 팝업은 오늘만, 메인 화면은 어제/오늘/내일 1:4:1 폭", "업데이트 후 프로그램을 재시작하세요".
- 검증하지 못한 부분을 숨기지 않고 적어 둔 점은 좋습니다. 예: "실제 휴대폰/Google 계정의 종단간 연동은 아직 검증하지 않았습니다. APK는 개발 서명판입니다."
- `AGENTS.md`(api/web/database)에 에이전트 작업 규칙이 정리되어 있습니다. 예: owner_id 신뢰 금지, 로그에 쿠키·연락처 금지, RLS는 익명·A·B 계정으로 실제 검사.
- 다만 "어떤 오류가 났고 어떻게 고쳤는지"를 보여주는 기록은 없어서 **X**로 표기했습니다. 개발자 설명에서 디버깅 사례가 나오면 근거를 추가하고 O로 바꾸겠습니다.

---

# 참고 링크 및 코드 개선

## 1.리뷰 시 참고한 링크가 있다면 링크와 간략한 설명을 첨부합니다.
- [Node.js `node:sqlite` 문서](https://nodejs.org/api/sqlite.html) — 외부 패키지 없이 쓰는 내장 SQLite(`DatabaseSync`) 사용법 확인
- [Node.js `crypto.scrypt` 문서](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback) — 비밀번호 해시 방식과 기본 파라미터 확인
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) — scrypt 권장 파라미터(N=2^17 이상) 비교
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) — Origin 검사 + SameSite 쿠키 조합이 적절한지 확인
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — PRD의 FR-18(RLS) 요구사항과 현재 구현 비교

## 2.리뷰를 통해 개선을 제안할 부분이 있다면 내용과 간략한 설명을 첨부합니다.

**① 코드와 문서에서 개인 연락처 제거** (우선순위 높음)
- `scheduler.mjs` 기본값의 실제 휴대폰 번호와 `Readme.txt`의 개인 이메일이 공개 레포 exe 안에 들어 있습니다.
- 기본값은 `senderPhone:''`로 두고 첫 설정 화면에서 입력받는 방식을 제안합니다. 문서의 계정은 "본인 Google 계정"처럼 일반 표현으로 바꾸면 좋겠습니다.

**② 소스 코드를 레포에 함께 올리기**
- 지금은 37MB짜리 exe만 있어서, 리뷰어나 사용자가 코드를 보려면 바이너리를 직접 풀어야 합니다.
- 서명되지 않은 exe라 Windows SmartScreen 경고도 뜹니다.
- `app/` 소스를 커밋하고 exe는 GitHub Releases로 배포하면, 코드 리뷰도 쉬워지고 레포 용량도 줄어듭니다.

**③ 외부 중계(Worker) 경로의 인증 강화**
- `owner-relay.mjs`를 거치면 인터넷에서 PC의 관리자 API에 접근할 수 있습니다. 이때 방어선은 비밀번호 하나입니다.
- 로그인 실패 잠금이 IP별이 아니라 전역 카운터(`failures`)라서, 외부에서 6번 틀리면 PC 사용자도 15분 동안 잠깁니다(서비스 방해 가능).
- 제안: 중계 경로에 TOTP 같은 2단계 인증 추가, 잠금 카운터를 출처별로 분리, scrypt 비용(N)을 기본값 2^14에서 2^17 수준으로 상향

**④ PRD와 실제 구현 차이를 문서에 반영**
- PRD는 "Three.js 3D, Supabase + RLS, 두 계정 격리"를 P0로 잡았습니다.
- 실제 구현은 "2D 3일 브리핑, Cloudflare D1 중계, 1인 소유자"로 바뀐 것으로 보입니다.
- 과제 평가 항목인 "로컬·클라우드 저장과 보안 (30점)"에 맞추려면 두 가지가 필요합니다.
  - 바뀐 이유를 PRD나 README에 한 줄로 남기기
  - 클라우드 저장 + 접근 제한 검증 결과를 `evidence/` 폴더에 남기기

**⑤ 테스트·디버깅 기록 추가**
- `database/seeds/scenarios.json`에 경쟁 승인, 만료, DST 같은 좋은 시나리오가 정의되어 있지만, 상태가 `fixture-plan-not-loaded`입니다.
- 제안: PRD 13장의 AC-01(재시작 유지), AC-04(동시 승인), AC-05(멱등성)를 `node --test`로 자동화하고, 실패→수정 과정을 `TROUBLESHOOTING.md`에 남기기. ART 3번 항목의 근거로도 쓸 수 있습니다.

**⑥ 작은 사용성 개선**
- 할 일 수정이 브라우저 `prompt()` 창으로 열립니다(`features/tasks/index.mjs`). 같은 앱의 다른 편집 화면처럼 인라인 폼으로 바꾸면 일관성이 좋아집니다.
- 할 일 삭제에 확인 단계나 실행 취소가 없습니다.

---

# 총평

Todo 앱 과제를 **"고객 예약을 직접 승인하는 개인 일정 서비스"** 로 확장한 야심 찬 프로젝트입니다.

- **PRD 완성도**: 14쪽 PRD가 상태 전이, 동시성, 멱등성, 개인정보 공개 범위, 수용 시나리오까지 실무 수준으로 정리되어 있습니다. "아직 검증하지 않은 항목은 체크하지 않는다"는 원칙을 문서 전체에서 지킨 점이 인상적이었습니다.
- **코드 품질**: 핵심 로직이 PRD 설계를 충실히 따릅니다. 승인 시 재검사 + 단일 트랜잭션 확정, 버전 기반 동시 수정 방지, 멱등성 키, 해시로만 저장하는 상태 조회 토큰이 그 예입니다. 보안 기본기도 탄탄합니다. scrypt, HttpOnly/SameSite 쿠키, Origin 검사, CSP, Host 검사, 파라미터 바인딩, 비밀값 AES-GCM 암호화를 모두 적용했습니다. 외부 npm 의존성이 없는 점도 좋았습니다.
- **아쉬운 점**:
  - 소스가 레포에 없고 exe만 있어서 리뷰하기 어렵습니다.
  - 코드에 실제 연락처가 들어 있습니다.
  - PRD의 Supabase·RLS·계정 격리가 실제 구현과 다릅니다.
  - 디버깅·테스트 기록이 남아 있지 않습니다.

위 개선 제안 ①·②만 반영해도 공개 레포로서 완성도가 크게 올라갈 것 같습니다. 고생 많으셨습니다! 🙌
