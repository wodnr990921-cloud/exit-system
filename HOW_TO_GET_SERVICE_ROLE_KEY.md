# Service Role Key 찾는 방법

## Supabase 프로젝트가 있는 경우

### 1단계: Supabase 대시보드 접속
- https://supabase.com 접속
- 로그인

### 2단계: 프로젝트 선택
- 왼쪽 상단에서 프로젝트 선택
- 프로젝트 이름: "exit system" 또는 사용 중인 프로젝트

### 3단계: API 설정 페이지
1. 왼쪽 메뉴에서 **Settings** (⚙️) 클릭
2. **API** 클릭

### 4단계: Service Role Key 복사
- "Project API keys" 섹션에서
- `service_role` 항목 찾기
- 눈 아이콘(👁️) 클릭하여 키 표시
- 복사 버튼 클릭

**예시:**
```
service_role: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5단계: .env.local에 추가
```env
SUPABASE_SERVICE_ROLE_KEY=여기에붙여넣기
```

---

## Supabase 프로젝트가 없는 경우

로컬 개발만 하는 경우 **방법 2**를 사용하세요 (아래 참고).

---

## 확인 방법

PowerShell에서:
```powershell
cd "c:\Users\User\exit system"
Get-Content .env.local | Select-String "SERVICE_ROLE"
```

결과가 나와야 함:
```
SUPABASE_SERVICE_ROLE_KEY=eyJhb...
```
