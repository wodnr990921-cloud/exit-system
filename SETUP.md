# 프로젝트 설정 가이드

## 1. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase 설정값 찾기

1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. 프로젝트 선택
3. Settings > API 메뉴로 이동
4. 다음 값들을 복사:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 1-1. 구글 로그인 설정 (선택사항)

### Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 프로젝트 생성 또는 선택
3. **APIs & Services > Credentials** 메뉴로 이동
4. **Create Credentials > OAuth client ID** 선택
5. Application type: **Web application**
6. Authorized redirect URIs 추가:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```
   (Supabase Dashboard > Settings > API에서 Project URL 확인)
7. Client ID와 Client Secret 복사

### Supabase에서 Google OAuth 활성화

1. Supabase Dashboard > **Authentication > Providers** 메뉴로 이동
2. **Google** 항목 찾아서 활성화
3. 방금 복사한 **Client ID**와 **Client Secret** 입력
4. **Save** 클릭

### Redirect URL 확인

Supabase Dashboard > Authentication > URL Configuration에서:
- **Redirect URLs**에 다음이 포함되어 있는지 확인:
  ```
  http://localhost:3000/auth/callback
  ```
  (프로덕션 환경에서는 실제 도메인으로 변경)

## 2. Supabase Storage 설정

1. Supabase Dashboard에서 **Storage** 메뉴로 이동
2. **New bucket** 클릭
3. Bucket 이름: `letters` (또는 원하는 이름)
4. Public bucket: ✅ 체크 (또는 필요한 권한 설정)
5. File size limit: 최대 10MB (또는 원하는 크기)

### Storage 정책 설정

RLS (Row Level Security) 정책을 설정하여 사용자만 자신의 파일에 접근할 수 있도록 설정하는 것을 권장합니다:

```sql
-- Storage 정책 예시 (Supabase SQL Editor에서 실행)
-- 사용자는 자신의 파일만 업로드/다운로드 가능
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'letters' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
USING (bucket_id = 'letters' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## 3. 데이터베이스 설정

`schema.sql` 파일의 내용을 Supabase SQL Editor에서 실행하세요.

1. Supabase Dashboard에서 **SQL Editor** 메뉴로 이동
2. **New query** 클릭
3. `schema.sql` 파일의 모든 내용을 복사하여 붙여넣기
4. **Run** 클릭하여 실행

## 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 5. 기능 사용

### 로그인
- 첫 접속 시 로그인 페이지가 표시됩니다
- Supabase Auth에 등록된 이메일/비밀번호로 로그인

### 편지 업로드 및 OCR 처리
1. 대시보드에서 "OCR 편지 업로드" 섹션으로 이동
2. 편지 이미지 파일 선택 (JPG, PNG 등)
3. "업로드 및 OCR 처리" 버튼 클릭
4. 업로드 진행 상황 확인
5. OCR 인식 결과 확인

## 6. 기술 스택

- **Framework**: Next.js 16 (App Router)
- **UI**: Shadcn UI + Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Authentication**: Supabase Auth
- **OCR**: Tesseract.js (한국어 + 영어 지원)

## 7. 트러블슈팅

### OCR 처리 속도가 느린 경우
- Tesseract.js는 첫 실행 시 모델 파일을 다운로드합니다
- 이후 실행부터는 더 빠르게 처리됩니다

### 파일 업로드 실패
- Supabase Storage의 버킷 이름이 `letters`인지 확인
- Storage 정책이 올바르게 설정되어 있는지 확인
- 파일 크기가 10MB 이하인지 확인

### 인증 오류
- `.env.local` 파일의 환경 변수가 올바른지 확인
- Supabase 프로젝트의 Auth 설정을 확인
