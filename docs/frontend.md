# Frontend 작업 가이드

## 현재 구조

`frontend/`은 Vercel에 배포되는 Next.js App Router 앱임. 브라우저는 동일 origin의 `/api/*`만 호출하고, 사진 파일은 서버가 발급한 Supabase Storage signed-upload token으로 직접 업로드함.

## 환경 변수

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=waste-images
```

`NEXT_PUBLIC_*`에는 공개값만 둠. service role key, OpenAI key, worker secret은 절대 넣지 않음.

## 배포·검증

Vercel Root Directory는 `frontend`임. Build Command는 `npm run build`.

```powershell
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
```
