import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (file) => readFile(new URL(file, root), 'utf8');
const html = await read('index.html');
const game = await read('src/game.js');
const config = await read('src/config.js');
const css = await read('src/styles.css');
const packageJson = JSON.parse(await read('package.json'));
const server = await read('scripts/serve.mjs');

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML contains duplicate IDs');

const referencedIds = [...game.matchAll(/getElementById\('([^']+)'\)/g)].map((match) => match[1]);
for (const id of referencedIds) {
  assert.ok(ids.includes(id), `JavaScript references missing element #${id}`);
}

assert.match(html, /src\/styles\.css/, 'Stylesheet is not linked');
assert.match(html, /src\/config\.js/, 'Configuration file is not linked');
assert.match(html, /src\/game\.js/, 'Game script is not linked');
assert.match(html, /favicon\.svg/, 'Favicon is not linked');
assert.match(html, /og:image/, 'Open Graph preview metadata is missing');
assert.match(html, /aria-describedby="gameInstructions"/, 'Game keyboard instructions are not associated with the canvas');
assert.match(html, /id="gameInstructions"/, 'Accessible game instructions are missing');
assert.match(css, /:focus-visible/, 'Keyboard focus styles are missing');
assert.match(css, /\.sr-only/, 'Screen-reader-only utility is missing');
assert.match(game, /canvas\.focus\(\{ preventScroll: true \}\)/, 'File selection should move focus to the game canvas');
assert.match(config, /uploadEndpoint:\s*''/, 'Demo mode should be the safe default');
assert.match(game, /form\.append\('file', selectedFile/, 'Upload field must be named "file"');
assert.ok(css.length > 1000, 'Stylesheet appears to be empty');
assert.equal(packageJson.private, true, 'The application repository should not be published as an npm package');
assert.equal(packageJson.license, 'MIT', 'Package metadata and repository license should match');
assert.match(server, /allowedFiles/, 'Local server must use an explicit static-file allowlist');
assert.match(server, /405/, 'Local server must reject unsupported HTTP methods');

for (const file of [
  'assets/preview.svg',
  'favicon.svg',
  'LICENSE',
  'CITATION.cff',
  '.github/workflows/ci.yml',
  '.github/workflows/codeql.yml',
  '.github/workflows/pages.yml',
  '.github/dependabot.yml'
]) {
  await access(new URL(file, root));
}

console.log(`Validation passed: ${ids.length} unique HTML IDs, ${referencedIds.length} DOM references, repository metadata, local server safeguards, and required project assets.`);
