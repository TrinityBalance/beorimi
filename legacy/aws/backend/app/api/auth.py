"""API Gateway 가 검증을 마친 JWT claims 에서 사용자를 꺼낸다.

토큰 서명 검증은 이 코드가 하지 않는다. API Gateway 의 Cognito JWT authorizer 가
이미 끝낸 뒤 claims 만 이벤트에 실어 보내므로, 여기서는 sub 를 읽기만 한다.
"""

from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, Request


@dataclass(frozen=True)
class AuthenticatedUser:
    sub: str
    claims: dict[str, Any]


def get_current_user(request: Request) -> AuthenticatedUser:
    # AIDEV-NOTE: claims 는 Mangum 이 넣어주는 `aws.event` 에만 존재한다. 로컬 uvicorn 으로 직접
    #             띄우면 이 값이 없어 보호 경로가 항상 401 이 된다 — 버그가 아니라 구조상 그렇다.
    event = request.scope.get("aws.event", {})
    request_context = event.get("requestContext", {})
    authorizer = request_context.get("authorizer", {})
    claims = authorizer.get("jwt", {}).get("claims", {})
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise HTTPException(status_code=401, detail="Authentication required")
    return AuthenticatedUser(sub=subject, claims=claims)
