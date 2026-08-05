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


class UploadValidationError(ValueError):
    pass


class UploadedObjectNotFoundError(LookupError):
    pass


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
        self._require_configuration()
        self._validate_upload(filename, content_type, size_bytes)
        extension = CONTENT_TYPE_EXTENSIONS[content_type]
        image_key = f"waste-images/{owner}/{uuid4()}{extension}"
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
        self._require_configuration()
        expected_prefix = f"waste-images/{owner}/"
        if not image_key.startswith(expected_prefix):
            raise UploadValidationError("Image key does not belong to the user")
        try:
            response = self._s3.head_object(
                Bucket=self._bucket_name,
                Key=image_key,
            )
        except Exception as error:
            code = str(
                getattr(error, "response", {}).get("Error", {}).get("Code", "")
            )
            if code in {"404", "NoSuchKey", "NotFound"}:
                raise UploadedObjectNotFoundError("Uploaded image was not found") from error
            raise

        content_length = int(response.get("ContentLength", 0))
        content_type = str(response.get("ContentType", ""))
        if content_length <= 0 or content_length > self._max_bytes:
            raise UploadValidationError("Uploaded image size is invalid")
        if content_type not in CONTENT_TYPE_EXTENSIONS:
            raise UploadValidationError("Uploaded image type is not supported")

    def _require_configuration(self) -> None:
        if not self._bucket_name:
            raise RuntimeError("IMAGE_BUCKET_NAME is not configured")

    def _validate_upload(
        self, filename: str, content_type: str, size_bytes: int
    ) -> None:
        if size_bytes > self._max_bytes:
            raise UploadValidationError("Image file is too large")
        allowed_suffixes = VALID_SUFFIXES_BY_CONTENT_TYPE.get(content_type)
        if allowed_suffixes is None:
            raise UploadValidationError("Unsupported image format")
        suffix = Path(filename).suffix.lower()
        if suffix not in allowed_suffixes:
            raise UploadValidationError("Filename and content type do not match")
