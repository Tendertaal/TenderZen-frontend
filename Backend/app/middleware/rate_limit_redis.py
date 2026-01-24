"""
Redis-backed rate limiter middleware (asyncio)
Simple fixed-window limiter using Redis INCR + EXPIRE.

Configuration via `app.config.settings.redis_url` and existing `rate_limit_window_minutes`/`rate_limit_max_requests`.

This is a scaffold suitable for production usage with a shared Redis instance.
"""
from typing import Optional
from fastapi import Request, HTTPException, status
import asyncio
import json

try:
    import redis.asyncio as aioredis
except Exception:
    aioredis = None

from app.config import settings


class RedisRateLimiter:
    """Redis-backed fixed-window rate limiter."""

    def __init__(self, redis_url: str, max_requests: int, window_seconds: int):
        if aioredis is None:
            raise RuntimeError("redis.asyncio is required for RedisRateLimiter. Install 'redis' package.")

        self.redis = aioredis.from_url(redis_url, encoding="utf-8", decode_responses=True)
        self.max_requests = int(max_requests)
        self.window_seconds = int(window_seconds)

    async def is_allowed(self, identifier: str) -> bool:
        """Return True if request is allowed for identifier (e.g. IP or user_id)."""
        key = f"rate:{identifier}:{int(asyncio.time.time()) // self.window_seconds}"

        # Use INCR and set EXPIRE if new
        try:
            current = await self.redis.incr(key)
            if current == 1:
                # first request in this window; set expiry
                await self.redis.expire(key, self.window_seconds)

            return current <= self.max_requests
        except Exception as e:
            # If Redis fails, be conservative and allow (fail-open) or choose fail-closed.
            print(f"⚠️ RedisRateLimiter error: {e} — allowing request by fail-open policy")
            return True


async def redis_rate_limit_middleware(request: Request, call_next):
    """FastAPI middleware wrapper that reads identifier from request and enforces Redis rate limit."""
    # Choose identifier: prefer authenticated user ID, else client IP
    identifier = None

    try:
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            # Don't decode token here; use client's IP as fallback identifier to avoid blocking
            # token-based identifier could be user id but decoding here is not ideal.
            identifier = request.client.host
        else:
            identifier = request.client.host
    except Exception:
        identifier = request.client.host if request.client else "unknown"

    # Lazy create limiter on first call
    if not hasattr(request.app.state, "redis_rate_limiter"):
        if not settings.redis_url:
            # No redis_url configured; allow through
            return await call_next(request)
        try:
            limiter = RedisRateLimiter(
                settings.redis_url,
                settings.rate_limit_max_requests,
                settings.rate_limit_window_seconds
            )
            request.app.state.redis_rate_limiter = limiter
        except Exception as e:
            print(f"⚠️ Could not initialize RedisRateLimiter: {e}")
            return await call_next(request)

    limiter: RedisRateLimiter = request.app.state.redis_rate_limiter

    allowed = await limiter.is_allowed(identifier)
    if not allowed:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")

    response = await call_next(request)
    return response
