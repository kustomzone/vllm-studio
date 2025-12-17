FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml README.md ./
COPY vllmstudio ./vllmstudio
COPY proxy ./proxy
COPY parsers ./parsers
COPY formatters ./formatters
RUN pip install --no-cache-dir -e .

ENV PYTHONPATH=/app

EXPOSE 8001
CMD ["python", "-m", "uvicorn", "proxy.main:app", "--host", "0.0.0.0", "--port", "8001"]
