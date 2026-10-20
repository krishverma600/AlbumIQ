"""Manual broker connectivity check: python test_redis.py."""
import os
import redis
from dotenv import load_dotenv

if __name__ == "__main__":
    load_dotenv()
    client = redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    print("Redis ping:", client.ping())
