# 배포 디버깅 가이드

## 문제 상황
- ✅ Vercel 빌드 완료
- ✅ Git 푸시 완료
- ✅ 커밋 71e4088 확인됨
- ❌ 브라우저에서 변경사항 안 보임

## 즉시 확인할 것들

### 1. 정확한 URL 확인

**현재 접속 중인 URL이 무엇인가요?**

확인 방법:
1. 브라우저 주소창 복사
2. 정확히 어느 URL인지 확인

예상 가능한 URL들:
- `https://exit-system.vercel.app/dashboard/mailroom` ✅ (프로덕션)
- `https://exit-system-XXXXX.vercel.app/dashboard/mailroom` ✅ (특정 배포)
- `http://localhost:3000/dashboard/mailroom` ❌ (로컬)
- 다른 URL? ❌

### 2. Service Worker 확인

**F12 → Application 탭 → Service Workers**

확인할 것:
- Service Worker가 활성화되어 있는가?
- 옛날 버전을 캐시하고 있는가?

해결 방법:
1. F12 열기
2. Application 탭
3. Service Workers 섹션
4. "Unregister" 클릭
5. 페이지 새로고침

### 3. 캐시 완전 삭제

**Chrome 예시:**

```
1. F12 (개발자 도구)
2. Network 탭
3. "Disable cache" 체크박스 체크
4. F12를 열어둔 채로 페이지 새로고침
```

또는:

```
1. Chrome 설정 (⋮)
2. 도구 더보기 → 인터넷 사용 기록 삭제
3. "캐시된 이미지 및 파일" 체크
4. "전체 기간" 선택
5. 데이터 삭제
6. Chrome 완전 종료 (모든 창 닫기)
7. Chrome 재시작
8. 사이트 접속
```

### 4. Vercel CDN 캐시 무효화

**쿼리 파라미터로 강제 갱신:**

```
https://exit-system.vercel.app/dashboard/mailroom?v=202601201930
```

(현재 시간을 추가하여 캐시 우회)

### 5. 최신 배포 URL 직접 접속

**방금 배포된 정확한 URL:**

```
https://exit-system-m1ie1k62z-sojaeuks-projects.vercel.app/dashboard/mailroom
```

이 URL로 직접 접속해보세요!

### 6. JavaScript 파일 버전 확인

**F12 → Sources 탭**

1. F12 열기
2. Sources 탭
3. Page 섹션 펼치기
4. mailroom-client 파일 찾기
5. 파일 열어서 "답변 일괄 출력" 텍스트 검색 (Ctrl+F)
6. 있으면 → 최신 버전 ✅
7. 없으면 → 캐시 문제 ❌

### 7. 콘솔에서 직접 확인

**F12 → Console 탭에서 실행:**

```javascript
// 현재 페이지의 HTML에 "답변 일괄 출력"이 있는지 확인
document.body.innerHTML.includes('답변 일괄 출력')

// 또는
document.querySelector('button')?.outerHTML
```

결과:
- `true` → 코드는 있음, UI 문제
- `false` → 캐시 문제

## 근본 해결 방법

### 옵션 A: 완전히 새로운 브라우저

1. 다른 브라우저 설치 (Chrome → Edge, Firefox 등)
2. 첫 접속으로 캐시 없음
3. 바로 최신 버전 확인 가능

### 옵션 B: Chrome 프로필 새로 만들기

1. Chrome 우측 상단 프로필 아이콘
2. "추가" → 새 프로필 생성
3. 새 프로필로 사이트 접속
4. 캐시 없이 깨끗한 상태

### 옵션 C: 모바일로 확인

1. 스마트폰에서 접속
2. 모바일은 별도 캐시
3. 최신 버전 확인 가능

## 즉시 실행할 명령어

### Vercel에서 최신 배포 확인:

```bash
vercel ls --limit 1
```

### 특정 배포 확인:

```bash
vercel inspect exit-system-m1ie1k62z-sojaeuks-projects.vercel.app
```

### 현재 프로덕션 URL 확인:

```bash
curl -I https://exit-system.vercel.app/dashboard/mailroom
```

## 최종 체크리스트

- [ ] Service Worker 해제했나?
- [ ] F12 Network 탭에서 "Disable cache" 체크했나?
- [ ] Chrome 완전 종료 후 재시작했나?
- [ ] 시크릿 모드에서도 안 보이나?
- [ ] 다른 브라우저에서도 안 보이나?
- [ ] 모바일에서도 안 보이나?
- [ ] 최신 배포 URL로 직접 접속했나?
  `https://exit-system-m1ie1k62z-sojaeuks-projects.vercel.app/dashboard/mailroom`

## 추가 정보 필요

다음을 알려주시면 더 정확히 도와드릴 수 있습니다:

1. **현재 접속 중인 정확한 URL**: (주소창 복사)
2. **사용 중인 브라우저**: Chrome? Edge? Safari?
3. **F12 Console에서 다음 실행 결과**:
   ```javascript
   document.body.innerHTML.includes('답변 일괄 출력')
   ```
4. **시크릿 모드에서도 안 보이나요?**: 예/아니오
5. **다른 브라우저에서는?**: 시도 안 함/시도했는데 안 됨

이 정보를 주시면 정확한 원인을 찾을 수 있습니다!
