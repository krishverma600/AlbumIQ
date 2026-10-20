FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
        libgl1 \
        libglib2.0-0 \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-ai-deepface.txt ./
RUN pip install --upgrade pip \
    && pip install -r requirements.txt -r requirements-ai-deepface.txt

COPY . .

