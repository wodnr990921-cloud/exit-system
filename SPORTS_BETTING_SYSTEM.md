# 스포츠 배팅 통합 시스템

The Odds API 실시간 배당률 + 완전한 배팅 관리 시스템

## 🎯 주요 기능

### 1. **실시간 배당률 업데이트**
- The Odds API 연동으로 최신 배당률 자동 반영
- K리그1 및 주요 리그 지원
- 30초마다 자동 새로고침

### 2. **배팅 관리**
```
┌─────────────────────────────────────┐
│  배팅 가능 → 마감 → 경기 진행 → 정산  │
└─────────────────────────────────────┘
```

#### 배당 마감
- 경기 시작 전 배팅 마감
- 현재 배팅 통계 확인
- 마감 후 추가 배팅 불가

#### 경기 정산
- 자동 결과 인식 (The Odds API)
- 당첨자 자동 계산
- 포인트 자동 지급

### 3. **자동 메시지 시스템** ✨

#### 당첨 알림
```
🎉 축하합니다!

[수원삼성 vs 울산현대]
배팅금: 10,000P
당첨금: 25,000P

포인트가 자동 지급되었습니다.
```

#### 발송 시점
- 정산 완료 즉시
- 당첨자 전원에게 자동 발송
- 실시간 알림 (웹/모바일)

### 4. **일괄 처리**

#### 일괄 정산
1. 완료된 경기 복수 선택
2. "일괄 정산" 버튼 클릭
3. 모든 경기 자동 정산
4. 당첨자 일괄 메시지 발송

#### 처리 결과
```
성공: 15건
실패: 0건
총 당첨자: 127명
총 지급액: 3,450,000P
```

### 5. **배팅 현황 대시보드**

#### 실시간 통계
- 진행 중 경기 수
- 총 배팅 건수 / 금액
- 예상 당첨금 (위험도)
- 완료 경기 수

#### 경기별 상세
- 배팅 건수 및 금액
- 선택별 분포 (홈승/무/원정승)
- 배당률 변동 추적
- 회원별 배팅 내역

## 📊 화면 구성

### 탭 메뉴

#### 1. 진행 중
- 현재 배팅 가능한 경기
- 실시간 배당률 표시
- 배팅 현황 확인
- 배당 마감 기능

#### 2. 배팅 가능
- 24시간 이내 시작 예정 경기
- 최신 배당률
- 빠른 마감 기능

#### 3. 완료
- 종료된 경기 목록
- 최종 스코어
- 정산 대기 경기
- 일괄 정산 가능

### 경기 상세 정보

```
┌──────────────────────────────────┐
│ 수원삼성 vs 울산현대                │
│                                  │
│ 종목: K리그1                      │
│ 시간: 2026-01-20 19:00 (KST)     │
│                                  │
│ 배당률                            │
│ 홈승: 2.50 | 무: 3.20 | 원정: 2.80 │
│                                  │
│ 배팅 현황                         │
│ - 총 배팅: 35건                   │
│ - 총 금액: 450,000P              │
│ - 예상 지급: 987,000P            │
│                                  │
│ [마감] [상세보기]                 │
└──────────────────────────────────┘
```

## 🔄 워크플로우

### 배팅 → 정산 프로세스

```
1. 경기 등록 (자동)
   ↓
   The Odds API 동기화
   ↓
   배당률 자동 업데이트

2. 배팅 접수
   ↓
   회원이 배팅 등록
   ↓
   실시간 통계 업데이트

3. 배당 마감
   ↓
   경기 시작 전 수동 마감
   ↓
   추가 배팅 차단

4. 경기 진행
   ↓
   자동으로 결과 수집
   ↓
   sports_matches 업데이트

5. 정산 처리
   ↓
   "정산" 버튼 클릭
   ↓
   당첨자 자동 계산
   ↓
   포인트 자동 지급
   ↓
   메시지 자동 발송

6. 완료
   ↓
   정산 결과 확인
   ↓
   수익률 분석
```

## 💰 정산 시스템

### 자동 정산 로직

```typescript
// 승패 판정
const winner = homeScore > awayScore ? 'home' : 
               awayScore > homeScore ? 'away' : 'draw'

// 당첨자 필터링
const winningBets = bets.filter(bet => bet.choice === winner)

// 포인트 지급
for (const bet of winningBets) {
  const payout = bet.amount * bet.odds
  await givePoints(bet.customer_id, payout)
  await sendMessage(bet.customer_id, winMessage)
}
```

### 정산 결과

```json
{
  "matchName": "수원삼성 vs 울산현대",
  "result": "2:1",
  "totalBets": 450000,
  "totalPayout": 325000,
  "profit": 125000,
  "profitRate": "27.78%",
  "winCount": 12,
  "loseCount": 23,
  "winners": [
    {
      "customerName": "홍길동",
      "memberNumber": "M001",
      "amount": 10000,
      "payout": 25000
    }
    // ...
  ]
}
```

## 🔔 자동 메시지 시스템

### 메시지 타입

#### 1. 당첨 알림
```
🎉 축하합니다!

[경기명]
배팅금: XXX,XXXP
당첨금: XXX,XXXP

포인트가 자동 지급되었습니다.
```

#### 2. 배당 마감 알림 (선택사항)
```
⚠️ 배당 마감

[경기명]
마감 시간: YYYY-MM-DD HH:MM

더 이상 배팅할 수 없습니다.
```

#### 3. 경기 시작 알림 (선택사항)
```
⚽ 경기 시작

[경기명]
배팅 내역: X건, XXX,XXXP

경기를 시청하세요!
```

### 발송 채널

- 시스템 알림 (notifications 테이블)
- 웹 푸시 알림
- 모바일 푸시 (FCM)
- SMS (선택사항)

## 📱 API 엔드포인트

### 1. 배당 업데이트
```
GET /api/sync-sports
```
The Odds API에서 최신 배당률 가져오기

### 2. 배당 마감
```
POST /api/sports/close-betting
{
  "matchId": "abc123..."
}
```

### 3. 경기 정산
```
POST /api/sports/settle
{
  "matchId": "abc123...",
  "winner": "home|away|draw",
  "homeScore": 2,
  "awayScore": 1
}
```

### 4. 자동 메시지
```
POST /api/notifications/send
{
  "memberNumber": "M001",
  "message": "당첨 축하 메시지",
  "type": "betting_win"
}
```

## 🎨 UI 컴포넌트

### 배당률 표시
```tsx
<div className="flex gap-2">
  <Badge className="bg-green-50">
    <span className="text-xs">승</span>
    <span className="font-bold">2.50</span>
  </Badge>
  <Badge className="bg-gray-50">
    <span className="text-xs">무</span>
    <span className="font-bold">3.20</span>
  </Badge>
  <Badge className="bg-blue-50">
    <span className="text-xs">패</span>
    <span className="font-bold">2.80</span>
  </Badge>
</div>
```

### 배팅 통계 카드
```tsx
<Card>
  <CardHeader>
    <CardTitle>35건</CardTitle>
    <CardDescription>배팅 건수</CardDescription>
  </CardHeader>
  <CardContent>
    <p>450,000P</p>
    <p className="text-sm text-gray-500">
      예상 지급: 987,000P
    </p>
  </CardContent>
</Card>
```

## 🔐 권한 관리

### 접근 권한
- **Operator**: 전체 접근
- **CEO**: 전체 접근
- **Admin**: 전체 접근
- **Staff**: 조회만 가능 (설정 시)

### 기능별 권한
```typescript
// 배당 마감
if (role === 'operator' || role === 'ceo' || role === 'admin') {
  // 허용
}

// 정산 처리
if (role === 'operator' || role === 'ceo') {
  // 허용
}
```

## 📈 통계 및 리포트

### 일일 리포트
- 총 경기 수
- 총 배팅 건수 / 금액
- 총 지급액
- 순수익
- 수익률

### 경기별 분석
- 배당률 변동
- 선택 분포
- 당첨률
- 수익률

### 회원별 분석
- 총 배팅 금액
- 총 당첨 금액
- 당첨률
- ROI

## 🚀 사용 방법

### 1. 초기 설정

```sql
-- Supabase에서 실행
-- schema_migration_sports_v2.sql
```

### 2. 환경 변수

```.env.local
ODDS_API_KEY=your-api-key-here
```

### 3. 데이터 동기화

```powershell
# PowerShell
.\sync-sports.ps1

# 또는 브라우저
http://localhost:3000/api/sync-sports
```

### 4. 대시보드 접속

```
http://localhost:3000/dashboard/sports
```

## 💡 주요 개선사항

### 기존 시스템
- ❌ 수동 배당률 입력
- ❌ 수동 결과 입력
- ❌ 수동 정산
- ❌ 수동 메시지 발송

### 새로운 통합 시스템
- ✅ 자동 배당률 업데이트 (The Odds API)
- ✅ 자동 결과 수집
- ✅ 자동 정산 + 포인트 지급
- ✅ 자동 메시지 발송
- ✅ 일괄 처리 기능
- ✅ 실시간 통계
- ✅ 깔끔한 UI/UX

## 🎯 다음 단계

### Phase 1 (완료)
- [x] The Odds API 연동
- [x] 실시간 배당률
- [x] 경기 정산
- [x] 자동 메시지
- [x] 일괄 처리

### Phase 2 (예정)
- [ ] 라이브 베팅 (경기 중 배팅)
- [ ] 배당률 변동 그래프
- [ ] AI 예측 시스템
- [ ] 모바일 앱 연동
- [ ] 실시간 채팅

### Phase 3 (예정)
- [ ] 다중 배팅 (조합 배팅)
- [ ] 캐시백 시스템
- [ ] VIP 회원 특별 배당
- [ ] 리그별 프로모션
- [ ] 통계 AI 분석

---

**마지막 업데이트**: 2026-01-14
**버전**: 2.0.0
