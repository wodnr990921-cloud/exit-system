# 배팅 티켓 시스템 통합 가이드

티켓 시스템과 스포츠 배팅을 완벽하게 통합했습니다.

## 🎯 통합 개요

### 기존 시스템
```
티켓 (tasks)
  ├─ 도서 아이템 (task_items: category='book')
  ├─ 경기 아이템 (task_items: category='game')
  └─ 물품 아이템 (task_items: category='goods')
```

### 통합 후
```
티켓 (tasks)
  ├─ 도서 아이템 (task_items: category='book')
  ├─ 경기 아이템 (task_items: category='game')
  ├─ 물품 아이템 (task_items: category='goods')
  └─ 배팅 아이템 (task_items: category='betting') ✨ NEW
```

## 📊 데이터 구조

### task_items 테이블 (배팅 관련 컬럼 추가)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| match_id | TEXT | sports_matches 참조 |
| betting_choice | TEXT | 선택 (home/draw/away) |
| betting_odds | FLOAT | 배당률 |
| potential_win | INTEGER | 예상 당첨금 (자동 계산) |
| settled_at | TIMESTAMPTZ | 정산 시각 |
| match_result | TEXT | 경기 결과 스냅샷 |

### 배팅 아이템 예시

```json
{
  "task_id": "uuid...",
  "category": "betting",
  "description": "수원삼성 vs 울산현대 - 홈승",
  "amount": 10000,
  "match_id": "abc123...",
  "betting_choice": "home",
  "betting_odds": 2.50,
  "potential_win": 25000,
  "status": "pending"
}
```

## 🔄 워크플로우

### 1. 배팅 티켓 생성

```typescript
// API 호출
POST /api/betting/create-ticket
{
  "memberId": "uuid...",
  "bets": [
    {
      "matchId": "abc123...",
      "choice": "home",
      "amount": 10000
    },
    {
      "matchId": "def456...",
      "choice": "away",
      "amount": 20000
    }
  ]
}

// 응답
{
  "success": true,
  "ticketNo": "BET-1705XXXX-ABC123",
  "taskId": "uuid...",
  "totalAmount": 30000,
  "totalPotentialWin": 73000,
  "betCount": 2
}
```

### 2. 배팅 티켓 조회

```sql
-- 특정 회원의 배팅 티켓 조회
SELECT 
  t.ticket_no,
  t.total_amount,
  t.created_at,
  COUNT(ti.id) as bet_count,
  SUM(ti.potential_win) as total_potential_win
FROM tasks t
JOIN task_items ti ON ti.task_id = t.id
WHERE t.member_id = 'uuid...'
  AND ti.category = 'betting'
GROUP BY t.id;
```

### 3. 경기별 배팅 통계

```sql
-- betting_stats 뷰 사용
SELECT 
  home_team,
  away_team,
  bet_count,
  total_bet_amount,
  total_potential_win
FROM betting_stats
WHERE match_id = 'abc123...';
```

### 4. 배팅 정산

```typescript
// 정산 API
POST /api/sports/settle
{
  "matchId": "abc123...",
  "winner": "home",
  "homeScore": 2,
  "awayScore": 1
}

// 자동 처리:
// 1. task_items의 status 업데이트 (won/lost)
// 2. settled_at 시각 기록
// 3. match_result 스냅샷 저장
// 4. 당첨자 포인트 지급
// 5. 자동 메시지 발송
```

## 🎨 UI 통합

### 배팅 티켓 생성 화면

```tsx
// 회원 선택
<MemberSearch onSelect={(member) => setMember(member)} />

// 경기 선택 및 배팅
<MatchList>
  {matches.map(match => (
    <MatchCard>
      <MatchInfo>
        {match.homeTeam} vs {match.awayTeam}
      </MatchInfo>
      <BettingOptions>
        <Button onClick={() => addBet(match.id, 'home', match.oddsHome)}>
          홈승 {match.oddsHome}
        </Button>
        <Button onClick={() => addBet(match.id, 'draw', match.oddsDraw)}>
          무승부 {match.oddsDraw}
        </Button>
        <Button onClick={() => addBet(match.id, 'away', match.oddsAway)}>
          원정승 {match.oddsAway}
        </Button>
      </BettingOptions>
      <Input 
        placeholder="배팅 금액"
        onChange={(e) => setBetAmount(match.id, e.target.value)}
      />
    </MatchCard>
  ))}
</MatchList>

// 배팅 요약
<BettingSummary>
  <div>총 배팅: {totalAmount.toLocaleString()}P</div>
  <div>예상 당첨: {totalPotentialWin.toLocaleString()}P</div>
  <Button onClick={createTicket}>티켓 생성</Button>
</BettingSummary>
```

### 배팅 내역 조회

```tsx
<BettingHistory memberId={memberId}>
  {tickets.map(ticket => (
    <TicketCard>
      <TicketHeader>
        <span>{ticket.ticketNo}</span>
        <Badge>{ticket.status}</Badge>
      </TicketHeader>
      <BetItems>
        {ticket.items.map(item => (
          <BetItem>
            <MatchInfo>
              {item.homeTeam} vs {item.awayTeam}
            </MatchInfo>
            <BetInfo>
              <span>{item.choice === 'home' ? '홈승' : item.choice === 'away' ? '원정승' : '무승부'}</span>
              <span>{item.odds}</span>
            </BetInfo>
            <AmountInfo>
              <span>배팅: {item.amount.toLocaleString()}P</span>
              <span className={item.status === 'won' ? 'text-green-600' : ''}>
                {item.status === 'won' ? `당첨: ${item.potentialWin.toLocaleString()}P` : '대기 중'}
              </span>
            </AmountInfo>
          </BetItem>
        ))}
      </BetItems>
    </TicketCard>
  ))}
</BettingHistory>
```

## 📋 마이그레이션 순서

### 1. 데이터베이스 마이그레이션

```bash
# Supabase SQL Editor에서 실행

# 1단계: 스포츠 테이블 생성
schema_migration_sports_SAFE.sql

# 2단계: 배팅 통합
schema_migration_betting_integration.sql
```

### 2. 환경 변수 확인

```.env.local
ODDS_API_KEY=your-api-key-here
```

### 3. API 테스트

```bash
# 경기 일정 조회
curl http://localhost:3000/api/sports/schedule

# 배팅 티켓 생성 테스트
curl -X POST http://localhost:3000/api/betting/create-ticket \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "uuid...",
    "bets": [
      {
        "matchId": "abc123",
        "choice": "home",
        "amount": 10000
      }
    ]
  }'
```

## 🔍 배팅 아이템 조회 쿼리

### 회원별 배팅 내역

```sql
SELECT 
  ti.id,
  t.ticket_no,
  c.member_number,
  c.name,
  sm.home_team || ' vs ' || sm.away_team as match_name,
  ti.betting_choice,
  ti.betting_odds,
  ti.amount,
  ti.potential_win,
  ti.status,
  ti.settled_at,
  sm.is_finished,
  sm.home_score,
  sm.away_score
FROM task_items ti
JOIN tasks t ON t.id = ti.task_id
JOIN customers c ON c.id = t.member_id
LEFT JOIN sports_matches sm ON sm.id = ti.match_id
WHERE ti.category = 'betting'
  AND c.member_number = 'M001'
ORDER BY ti.created_at DESC;
```

### 경기별 배팅 분포

```sql
SELECT 
  sm.home_team,
  sm.away_team,
  ti.betting_choice,
  COUNT(*) as bet_count,
  SUM(ti.amount) as total_amount,
  SUM(ti.potential_win) as total_potential_win
FROM task_items ti
JOIN sports_matches sm ON sm.id = ti.match_id
WHERE ti.category = 'betting'
  AND sm.id = 'abc123...'
GROUP BY sm.home_team, sm.away_team, ti.betting_choice;
```

### 정산 대기 배팅

```sql
SELECT 
  sm.id,
  sm.home_team || ' vs ' || sm.away_team as match_name,
  sm.home_score || ':' || sm.away_score as result,
  COUNT(ti.id) as pending_bets,
  SUM(ti.amount) as total_bet_amount
FROM sports_matches sm
JOIN task_items ti ON ti.match_id = sm.id AND ti.category = 'betting'
WHERE sm.is_finished = true
  AND ti.status = 'pending'
GROUP BY sm.id, sm.home_team, sm.away_team, sm.home_score, sm.away_score;
```

## 💰 정산 프로세스

### 자동 정산 흐름

```typescript
// 1. 경기 결과 확인
const match = await getMatch(matchId)
const winner = match.homeScore > match.awayScore ? 'home' : 
               match.awayScore > match.homeScore ? 'away' : 'draw'

// 2. 해당 경기의 배팅 아이템 조회
const bettingItems = await supabase
  .from('task_items')
  .select('*, tasks(member_id, customers(*))')
  .eq('match_id', matchId)
  .eq('category', 'betting')
  .eq('status', 'pending')

// 3. 당첨/낙첨 판정
for (const item of bettingItems) {
  const isWon = item.betting_choice === winner
  
  await supabase
    .from('task_items')
    .update({
      status: isWon ? 'won' : 'lost',
      settled_at: new Date().toISOString(),
      match_result: `${match.homeScore}:${match.awayScore}`
    })
    .eq('id', item.id)
  
  // 4. 당첨자 포인트 지급
  if (isWon) {
    await givePoints(item.tasks.member_id, item.potential_win)
    await sendMessage(item.tasks.member_id, winMessage)
  }
}
```

## 🎁 추가 기능

### 조합 배팅 (멀티 베팅)

한 티켓에 여러 경기를 담아 배당률이 곱해지는 시스템:

```typescript
// 3경기 조합
const bets = [
  { matchId: 'abc', choice: 'home', odds: 2.0 },
  { matchId: 'def', choice: 'away', odds: 1.8 },
  { matchId: 'ghi', choice: 'draw', odds: 3.2 }
]

// 총 배당률: 2.0 × 1.8 × 3.2 = 11.52
// 배팅액: 10,000P
// 예상 당첨금: 115,200P
// 단, 모든 경기를 맞춰야 당첨
```

### 배팅 히스토리 통계

```sql
-- 회원별 배팅 통계
SELECT 
  c.member_number,
  c.name,
  COUNT(CASE WHEN ti.status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN ti.status = 'won' THEN 1 END) as won_count,
  COUNT(CASE WHEN ti.status = 'lost' THEN 1 END) as lost_count,
  SUM(ti.amount) as total_bet,
  SUM(CASE WHEN ti.status = 'won' THEN ti.potential_win ELSE 0 END) as total_won,
  ROUND(
    COUNT(CASE WHEN ti.status = 'won' THEN 1 END)::numeric / 
    NULLIF(COUNT(CASE WHEN ti.status IN ('won', 'lost') THEN 1 END), 0) * 100,
    2
  ) as win_rate
FROM customers c
JOIN tasks t ON t.member_id = c.id
JOIN task_items ti ON ti.task_id = t.id
WHERE ti.category = 'betting'
GROUP BY c.id, c.member_number, c.name;
```

## 🚀 다음 단계

### Phase 1 (완료)
- [x] 배팅 티켓 생성
- [x] 경기 일정 조회
- [x] 티켓 시스템 통합
- [x] 자동 정산
- [x] 자동 메시지

### Phase 2 (예정)
- [ ] 조합 배팅 (멀티)
- [ ] 배팅 취소 기능
- [ ] 배팅 히스토리 UI
- [ ] 회원별 배팅 통계
- [ ] 라이브 배팅

### Phase 3 (예정)
- [ ] 배팅 분석 대시보드
- [ ] AI 예측 시스템
- [ ] VIP 특별 배당
- [ ] 캐시백 시스템

---

**마지막 업데이트**: 2026-01-14
**버전**: 1.0.0
