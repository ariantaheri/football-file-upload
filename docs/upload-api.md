# Upload API contract

The game client sends one request when the file token crosses the goal line and a non-empty `uploadEndpoint` is configured.

## Request

- Method: `POST`
- Body: `multipart/form-data`
- File field: `file`
- Filename: the original client filename is sent as multipart metadata.
- Authentication: not added by the demo automatically. Add the mechanism required by your application.

Example request construction:

```js
const form = new FormData();
form.append('file', selectedFile, selectedFile.name);

const response = await fetch('/api/upload', {
  method: 'POST',
  body: form
});
```

Do not manually set the `Content-Type` header when sending `FormData`; the browser must add the multipart boundary.

## Response

Any `2xx` status is treated as success. A non-`2xx` status is treated as failure.

Example success response:

```json
{
  "message": "Upload received",
  "fileId": "generated-server-side-id",
  "size": 12345
}
```

The client does not currently consume the response body. You can extend the UI to display a file URL, identifier, or other server metadata when your product requires it.

## Server-side requirements

The browser's size check is only a usability feature. The API must independently enforce file-size limits and validate uploaded content. Never trust the multipart filename, extension, or client-provided MIME type. Generate server-side storage names, keep files private by default, and apply authentication, authorization, rate limiting, malware scanning, retention, and deletion policies appropriate to your use case.
