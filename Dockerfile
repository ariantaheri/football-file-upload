FROM node:24-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/data \
    MAX_FILE_SIZE_BYTES=26214400 \
    UPLOAD_TIMEOUT_MS=60000

WORKDIR /app

COPY examples/server/package.json ./examples/server/package.json
RUN cd examples/server \
    && npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force

COPY index.html favicon.svg ./
COPY src ./src
COPY assets ./assets
COPY examples/server/server.js ./examples/server/server.js

RUN mkdir -p /data \
    && chown -R node:node /app /data

USER node
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "examples/server/server.js"]
