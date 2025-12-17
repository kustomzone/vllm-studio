FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml README.md ./
COPY vllmstudio ./vllmstudio
COPY vllmstudio_controller ./vllmstudio_controller
RUN pip install --no-cache-dir -e .

ENV PYTHONPATH=/app

EXPOSE 8080
CMD ["python", "-m", "vllmstudio_controller.cli", "--config", "/config/controller.json"]
