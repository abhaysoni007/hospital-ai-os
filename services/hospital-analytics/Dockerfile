# Multi-stage / lightweight standalone Dockerfile for Hospital Analytics Service
FROM python:3.12-slim AS base

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8001

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Copy project definition, readme, source, and examples
COPY pyproject.toml README.md ./
COPY src/ ./src/
COPY examples/ ./examples/

# Upgrade pip and install package
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# Create non-root user for security compliance in healthcare environments
RUN useradd -u 10001 -m -s /bin/bash analytics && \
    chown -R analytics:analytics /app

USER analytics

EXPOSE 8001

# Healthcheck to verify service availability
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

ENTRYPOINT ["uvicorn", "hospital_analytics.api.app:app", "--host", "0.0.0.0", "--port", "8001"]
