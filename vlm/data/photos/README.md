# VLM 사진 폴더

VLM으로 분석할 사진을 이 폴더에 넣으세요.

지원 형식: `.jpg`, `.jpeg`, `.png`, `.webp`, `.bmp`

프로젝트 루트에서 다음 명령을 실행하면 이 폴더의 사진을 파일명 순서대로 모두 분석합니다.

```powershell
python -m vlm.app.main
```

다른 폴더를 기본값으로 사용하려면 `.env`에 `VLM_IMAGE_DIR`을 설정할 수 있습니다.

```dotenv
VLM_IMAGE_DIR=C:\path\to\photos
```

사진 파일은 개인 정보와 용량 문제를 피하기 위해 Git에서 제외되고, 이 안내 파일만 저장소에 포함됩니다.
