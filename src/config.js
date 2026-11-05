/*
 * Front-end configuration.
 * Keep uploadEndpoint empty to run the visual demo without sending files.
 * For a real upload, point it to an endpoint that accepts multipart/form-data
 * with a field named "file" and returns a successful 2xx HTTP status.
 */
window.FILE_UPLOAD_CONFIG = Object.freeze({
  uploadEndpoint: '',
  maxFileSizeBytes: 25 * 1024 * 1024,
  uploadTimeoutMs: 60_000
});
