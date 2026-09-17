# ---- Frontend build ----
FROM node:20-alpine AS frontend
WORKDIR /build
COPY web/frontend/package.json web/frontend/package-lock.json* ./
RUN npm install --no-fund --no-audit
COPY web/frontend .
RUN npm run build

# ---- Backend ----
FROM python:3.12-slim
WORKDIR /app
COPY web/backend/requirements.txt web/backend/
RUN pip install --no-cache-dir -r web/backend/requirements.txt
COPY web/backend web/backend
COPY app/bridge.py app/bridge.py
COPY upstream/service/scripts upstream/service/scripts
COPY --from=frontend /build/dist web/frontend/dist
WORKDIR /app/web/backend
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
