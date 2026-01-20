# ⚙️ GitHub Actions 자동 동기화 시스템

## 📋 개요

Vercel Hobby 플랜의 Cron Job 제한(하루 1회)을 우회하기 위해, **GitHub Actions를 활용한 무료 자동 동기화 시스템**을 구현했습니다.

---

## 🎯 작동 방식

```
GitHub Actions (무료 스케줄러)
    ↓ HTTP Request
Vercel API Routes (서버리스 함수)
    ↓ 데이터 처리
Supabase (데이터베이스)
```

---

## 📁 Workflow 파일 구조

### 1. **해외 리그 동기화** (`sync-odds-api.yml`)

```yaml
스케줄: 4시간마다 (0, 4, 8, 12, 16, 20시)
대상: EPL, 라리가, 세리에A, 분데스리가, 리그앙, 챔피언스리그 등
엔드포인트: /api/sync-odds-api
```

### 2. **국내 리그 동기화** (`sync-domestic.yml`)

```yaml
스케줄: 6시간마다 (0, 6, 12, 18시)
대상: KOVO, KBL, WKBL, K-League
엔드포인트: /api/sync-domestic
```

### 3. **K-League 집중 동기화** (`sync-sports.yml`)

```yaml
스케줄: 하루 3회 (0, 5, 12시)
대상: K-League 1
엔드포인트: /api/sync-sports
```

---

## 🚀 사용 방법

### ✅ 자동 실행 (설정 완료됨)

GitHub에 푸시하면 자동으로 스케줄에 따라 실행됩니다.

```bash
git push origin master
```

### 🖱️ 수동 실행

1. **GitHub 웹사이트에서:**
   ```
   Repository → Actions 탭
   → 원하는 Workflow 선택
   → "Run workflow" 버튼 클릭
   ```

2. **GitHub CLI로:**
   ```bash
   gh workflow run "동기화 - 해외 리그 (The Odds API)"
   gh workflow run "동기화 - 국내 리그 (KOVO, KBL, K-League)"
   gh workflow run "동기화 - K-League 집중 동기화"
   ```

---

## 📊 실행 로그 확인

### GitHub 웹사이트:
```
Repository → Actions 탭
→ 최근 실행 기록 클릭
→ 각 Step별 로그 확인
```

### 로그 예시:
```
🔄 해외 리그 동기화 시작...
HTTP Status: 200
Response: {"success":true,"leagues":17,"total":245}
✅ 동기화 성공!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 동기화 완료 시간: 2026-01-20 02:30:15 UTC
🌍 대상: EPL, 라리가, 세리에A, 분데스리가 등
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🔧 스케줄 수정

각 workflow 파일의 `cron` 값을 수정하면 됩니다.

### 예시:

```yaml
# 2시간마다 실행
- cron: '0 */2 * * *'

# 매일 오전 9시 (KST)
- cron: '0 0 * * *'  # UTC 00:00 = KST 09:00

# 평일 오후 6시 (KST)
- cron: '0 9 * * 1-5'  # UTC 09:00 = KST 18:00, 월~금
```

**Cron 표현식 도구:** https://crontab.guru/

---

## 💰 비용

```
✅ GitHub Actions: 완전 무료 (Public Repo)
   - 월 2,000분 무료 (Private Repo도 무료)
   - 각 workflow 실행: ~10초
   - 예상 월 사용량: ~50분

✅ Vercel Hobby: 무료
   - Serverless 함수 실행: 무료
   - 대역폭: 100GB/월 무료

✅ Supabase Free: 무료
   - 500MB 데이터베이스
   - API 요청: 무제한
```

**총 비용: $0 / 월** 🎉

---

## 🆚 Vercel Cron vs GitHub Actions

| 항목 | Vercel Hobby | GitHub Actions |
|------|--------------|----------------|
| **비용** | 무료 | 무료 |
| **Cron 제한** | 하루 1회 | 무제한 |
| **실행 로그** | Vercel 대시보드 | GitHub Actions 탭 |
| **수동 실행** | CLI 필요 | 웹에서 클릭 1번 |
| **설정** | vercel.json | .github/workflows/*.yml |
| **신뢰성** | 높음 | 매우 높음 |

---

## 🔒 보안

### 현재 설정 (Public API):
```
✅ API는 공개 접근 가능
✅ RLS (Row Level Security)로 데이터 보호
✅ 환경 변수는 Vercel에서 안전하게 관리
```

### 추가 보안이 필요하다면:

1. **API 키 추가:**
   ```typescript
   // src/app/api/sync-sports/route.ts
   const apiKey = request.headers.get('x-api-key');
   if (apiKey !== process.env.INTERNAL_API_KEY) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   ```

2. **GitHub Secrets 설정:**
   ```
   Repository → Settings → Secrets → New repository secret
   이름: API_KEY
   값: your-secret-key
   ```

3. **Workflow 수정:**
   ```yaml
   - name: 동기화
     env:
       API_KEY: ${{ secrets.API_KEY }}
     run: |
       curl -H "x-api-key: $API_KEY" \
         https://exit-system.vercel.app/api/sync-sports
   ```

---

## 🐛 문제 해결

### Workflow가 실행되지 않음:

1. **Actions 활성화 확인:**
   ```
   Repository → Settings → Actions → General
   → "Allow all actions and reusable workflows" 선택
   ```

2. **수동으로 테스트:**
   ```
   Actions 탭 → Run workflow 버튼 클릭
   ```

### API 호출 실패:

1. **로그 확인:**
   ```
   Actions 탭 → 실패한 workflow 클릭 → 에러 메시지 확인
   ```

2. **API 수동 테스트:**
   ```bash
   curl https://exit-system.vercel.app/api/sync-sports
   ```

---

## 📈 모니터링

### GitHub Actions 대시보드:
```
Repository → Insights → Actions
→ 실행 통계, 성공률, 평균 실행 시간 확인
```

### Vercel 로그:
```
Vercel Dashboard → 프로젝트 → Logs
→ 서버리스 함수 실행 로그 확인
```

---

## ✅ 체크리스트

- [x] `.github/workflows/` 디렉토리 생성
- [x] 3개 workflow 파일 작성
- [x] `vercel.json`에서 cron 제거
- [ ] GitHub에 푸시
- [ ] Actions 탭에서 작동 확인
- [ ] 첫 실행 후 로그 확인

---

## 📚 참고 자료

- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [Cron 표현식 가이드](https://crontab.guru/)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)

---

## 🎉 결론

**GitHub Actions + Vercel 조합으로:**

✅ 완전 무료 자동화 시스템 구축  
✅ Cron 제한 없음  
✅ 안정적인 스케줄링  
✅ 상세한 실행 로그  
✅ 웹에서 쉽게 수동 실행  

**이제 배팅 시스템이 24시간 자동으로 최신 데이터를 유지합니다!** 🚀
