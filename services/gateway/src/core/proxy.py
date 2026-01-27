"""Generic proxy utilities for forwarding requests to microservices."""

from typing import Any

import httpx
from fastapi import HTTPException, status

from src.core.config import settings
from src.core.logging import logger


async def proxy_request(
    *,
    base_url: str,
    internal_token: str,
    method: str,
    path: str,
    user_id: str | None = None,
    user_role: str | None = None,
    json: dict | None = None,
    params: dict | None = None,
    files: dict | None = None,
    data: dict | None = None,
    timeout: float | None = None,
) -> Any:
    """
    Proxy a request to a microservice.

    Args:
        base_url: Base URL of the target microservice
        internal_token: Internal token for authentication
        method: HTTP method (GET, POST, PUT, DELETE, PATCH)
        path: Path to append to base URL
        user_id: User ID to pass in X-User-Id header
        user_role: User role to pass in X-User-Role header
        json: JSON body for POST/PUT/PATCH requests
        params: Query parameters
        files: Files for multipart uploads
        data: Form data for multipart uploads
        timeout: Request timeout (defaults to settings.UPSTREAM_TIMEOUT_S)

    Returns:
        Response JSON or None for 204 responses
    """
    url = f"{base_url.rstrip('/')}{path}"
    headers: dict[str, str] = {"X-Internal-Token": internal_token}

    if user_id:
        headers["X-User-Id"] = user_id
    if user_role:
        headers["X-User-Role"] = user_role

    request_timeout = timeout or settings.UPSTREAM_TIMEOUT_S

    try:
        async with httpx.AsyncClient(timeout=request_timeout) as client:
            if method == "GET":
                resp = await client.get(url, headers=headers, params=params)
            elif method == "POST":
                if files:
                    resp = await client.post(url, headers=headers, files=files, data=data)
                else:
                    resp = await client.post(url, headers=headers, json=json, params=params)
            elif method == "PUT":
                resp = await client.put(url, headers=headers, json=json, params=params)
            elif method == "PATCH":
                resp = await client.patch(url, headers=headers, json=json, params=params)
            elif method == "DELETE":
                resp = await client.delete(url, headers=headers, params=params)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

    except httpx.TimeoutException:
        logger.error(f"Timeout calling {url}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Tempo limite ao aguardar resposta do serviço",
        )
    except httpx.RequestError as e:
        logger.error(f"Request error calling {url}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Erro de conexão com o serviço",
        )

    # Handle 204 No Content
    if resp.status_code == 204:
        return None

    # Handle error responses
    if resp.status_code >= 400:
        try:
            error_data = resp.json()
            detail = error_data.get("detail", "Erro no serviço")
        except Exception:
            detail = "Erro no serviço"

        raise HTTPException(status_code=resp.status_code, detail=detail)

    # Return JSON response
    try:
        return resp.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Resposta inválida do serviço",
        )
