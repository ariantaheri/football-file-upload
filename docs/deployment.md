# Deployment notes

## Static demo

The front end is static and can be hosted by GitHub Pages or any static web host. The repository includes a GitHub Actions workflow that deploys the project when manually dispatched after GitHub Pages is configured to use GitHub Actions.

A static host can demonstrate the interaction, but it cannot store uploaded files on its own. The default static configuration is demo-only.

## Real uploads with the Express example

The optional Express example serves both the front end and `/api/upload`. When served through this example, it dynamically configures the client to upload to `/api/upload`; no edit to `src/config.js` is needed.

```bash
cd examples/server
npm install
npm start
```

For deployment, set environment variables using your platform's secret/configuration settings. See [`examples/server/.env.example`](../examples/server/.env.example) for supported names. Do not commit secrets or production environment files.

## Docker

Build the full-stack example from the repository root:

```bash
docker build -t football-file-upload .
docker run --rm -p 3000:3000 -v football_upload_data:/data football-file-upload
```

Open `http://localhost:3000`. The named Docker volume persists uploaded files under `/data`; the server does not expose that directory as a public static path.

Configure a reverse proxy with HTTPS before exposing the service. Add authentication and authorization, rate limiting, file-signature/content validation, malware scanning where appropriate, storage quotas, retention and deletion rules, and monitoring. The sample server is an integration starter, not a hardened production storage platform.

## Real upload requirements

1. Accept `POST multipart/form-data` with a field named `file`.
2. Validate the request and file content on the server.
3. Store the file in private object storage or another controlled location.
4. Return a successful `2xx` response only after storage is complete.
5. Configure CORS and credentials deliberately if the front end and API use different origins.

See [the upload API contract](upload-api.md) and [the security policy](../SECURITY.md).
