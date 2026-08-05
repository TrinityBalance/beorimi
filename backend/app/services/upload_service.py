"""S3 업로드 발급과 업로드된 객체 검증.

원본 이미지는 Backend를 거치지 않는다. 브라우저가 presigned POST 로 S3 에 직접 올리고,
Backend 는 "올릴 자리를 발급하는 일"과 "올라온 것이 규격에 맞는지 확인하는 일"만 한다.

이 모듈의 검증 규칙은 API(`verify_uploaded_object`)와 워커(`workers/analysis.py`) 양쪽에서
쓰이므로, 규칙 자체는 아래 공용 헬퍼에만 두고 예외 타입은 각 호출자가 정한다.
"""

from pathlib import Path
from typing import Any
from uuid import uuid4


CONTENT_TYPE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
VALID_SUFFIXES_BY_CONTENT_TYPE = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
}
# AIDEV-NOTE: 이 prefix 는 IAM 정책(`${ImageBucket.Arn}/waste-images/*`)과 워커의 소유권 검사가
#             함께 의존한다. 바꾸면 infra/backend-secure.yaml 도 같이 바꿔야 한다.
IMAGE_KEY_PREFIX = "waste-images"
MISSING_OBJECT_ERROR_CODES = {"404", "NoSuchKey", "NotFound"}


class UploadValidationError(ValueError):
    pass


class UploadedObjectNotFoundError(LookupError):
    pass


def owner_key_prefix(owner: str) -> str:
    """해당 사용자가 쓸 수 있는 유일한 key 접두사."""
    return f"{IMAGE_KEY_PREFIX}/{owner}/"


def s3_error_code(error: Exception) -> str:
    """botocore ClientError 에서 오류 코드를 꺼낸다. 못 꺼내면 빈 문자열."""
    return str(getattr(error, "response", {}).get("Error", {}).get("Code", ""))


def describe_object_problem(
    content_length: int, content_type: str, max_bytes: int
) -> str | None:
    """S3 객체 메타데이터의 문제 사유를 돌려준다. 이상 없으면 None.

    호출자마다 raise 할 예외 타입이 다르므로(API 는 400, 워커는 영구 실패) 여기서는
    사유 문자열만 만든다.
    """
    if content_length <= 0 or content_length > max_bytes:
        return "Uploaded image size is invalid"
    if content_type not in CONTENT_TYPE_EXTENSIONS:
        return "Uploaded image type is not supported"
    return None


class UploadService:
    def __init__(
        self,
        s3_client: Any,
        bucket_name: str,
        expires_in: int,
        max_bytes: int,
    ) -> None:
        self._s3 = s3_client
        self._bucket_name = bucket_name
        self._expires_in = expires_in
        self._max_bytes = max_bytes

    def create_upload_url(
        self, owner: str, filename: str, content_type: str, size_bytes: int
    ) -> dict[str, Any]:
        """업로드용 presigned POST 폼을 발급한다.

        key 에 owner 를 박아 사용자별 저장 공간을 격리하고, 파일명은 UUID 로 바꿔
        원본 파일명이 그대로 노출되지 않게 한다.
        """
        self._require_configuration()
        self._validate_upload(filename, content_type, size_bytes)
        extension = CONTENT_TYPE_EXTENSIONS[content_type]
        image_key = f"{owner_key_prefix(owner)}{uuid4()}{extension}"
        # AIDEV-NOTE: Conditions 가 실제 강제 수단이다. 요청의 size_bytes 는 클라이언트 자기신고값이라
        #             신뢰할 수 없고, content-length-range 를 넣어야 S3 가 초과 업로드를 거부한다.
        upload_form = self._s3.generate_presigned_post(
            Bucket=self._bucket_name,
            Key=image_key,
            Fields={"Content-Type": content_type},
            Conditions=[
                {"Content-Type": content_type},
                ["content-length-range", 1, self._max_bytes],
            ],
            ExpiresIn=self._expires_in,
        )
        return {
            "upload_url": upload_form["url"],
            "image_key": image_key,
            "expires_in": self._expires_in,
            "form_fields": upload_form["fields"],
        }

    def verify_uploaded_object(self, owner: str, image_key: str) -> None:
        """분석 요청 시점에 S3 객체가 실제로 존재하고 규격에 맞는지 확인한다.

        presigned 폼을 발급했다고 업로드가 성공한 것은 아니므로, 큐에 넣기 전에 한 번 더 본다.
        """
        self._require_configuration()
        if not image_key.startswith(owner_key_prefix(owner)):
            raise UploadValidationError("Image key does not belong to the user")
        try:
            response = self._s3.head_object(
                Bucket=self._bucket_name,
                Key=image_key,
            )
        except Exception as error:
            if s3_error_code(error) in MISSING_OBJECT_ERROR_CODES:
                raise UploadedObjectNotFoundError("Uploaded image was not found") from error
            raise

        problem = describe_object_problem(
            int(response.get("ContentLength", 0)),
            str(response.get("ContentType", "")),
            self._max_bytes,
        )
        if problem is not None:
            raise UploadValidationError(problem)

    def _require_configuration(self) -> None:
        if not self._bucket_name:
            raise RuntimeError("IMAGE_BUCKET_NAME is not configured")

    def _validate_upload(
        self, filename: str, content_type: str, size_bytes: int
    ) -> None:
        """발급 전 요청값 검사. 확장자와 Content-Type 이 서로 맞는지까지 본다."""
        if size_bytes > self._max_bytes:
            raise UploadValidationError("Image file is too large")
        allowed_suffixes = VALID_SUFFIXES_BY_CONTENT_TYPE.get(content_type)
        if allowed_suffixes is None:
            raise UploadValidationError("Unsupported image format")
        suffix = Path(filename).suffix.lower()
        if suffix not in allowed_suffixes:
            raise UploadValidationError("Filename and content type do not match")
