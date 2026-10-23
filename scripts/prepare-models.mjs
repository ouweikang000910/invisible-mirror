/**
 * Self-host all browser AI assets. Run after `npm ci`:
 *   node scripts/prepare-models.mjs
 *   node scripts/prepare-models.mjs --verify
 *
 * Downloads happen at preparation time only. Browser inference uses /ai/*.
 * Existing assets are checked against public/ai/asset-manifest.json when present.
 */
import { readFile, writeFile, mkdir, copyFile, rename, rm, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ai = resolve(root, 'public/ai');
const verifyOnly = process.argv.includes('--verify');
const modelBase = 'https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/';
const languageSource = (lang) => `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}@1.0.0/4.0.0_best_int/${lang}.traineddata.gz`;
const manifestPath = resolve(ai, 'asset-manifest.json');
let previous = { assets: [] };
try { previous = JSON.parse(await readFile(manifestPath, 'utf8')); } catch {}
const expected = new Map(previous.assets.map((asset) => [asset.path, asset.sha256]));
const records = [];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function saveAsset(path, source, copySource) {
  const destination = resolve(ai, path);
  await mkdir(dirname(destination), { recursive: true });
  let bytes = await exists(destination) ? await readFile(destination) : null;
  const knownHash = expected.get(path);
  if (bytes && knownHash && sha(bytes) !== knownHash) {
    if (verifyOnly) throw new Error(`SHA-256 mismatch: ${path}`);
    bytes = null;
  }
  if (!bytes) {
    if (verifyOnly) throw new Error(`Missing local asset: ${path}`);
    const temporary = `${destination}.download`;
    try {
      if (copySource) {
        await copyFile(resolve(root, copySource), temporary);
      } else {
        await run('curl', ['--fail', '--location', '--silent', '--show-error',
          '--retry', '2', '--connect-timeout', '25', '--max-time', '180',
          '--output', temporary, source], { maxBuffer: 1024 * 1024 });
      }
      bytes = await readFile(temporary);
      if (!bytes.length) throw new Error(`Empty download: ${path}`);
      if (knownHash && sha(bytes) !== knownHash) throw new Error(`Source changed: ${path}`);
      await rename(temporary, destination);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  records.push({ path, bytes: bytes.length, sha256: sha(bytes), source });
  console.log(`${verifyOnly ? 'verified' : 'ready'} ${path} (${bytes.length} bytes)`);
  return bytes;
}

await mkdir(ai, { recursive: true });
const modelBytes = await saveAsset('coco/model.json', `${modelBase}model.json`);
const model = JSON.parse(modelBytes.toString('utf8'));
if (!model.modelTopology || !Array.isArray(model.weightsManifest)) throw new Error('Invalid COCO graph model');
for (const group of model.weightsManifest) {
  const shards = await Promise.all(group.paths.map((path) => {
    if (path.includes('..') || path.includes('://') || path.startsWith('/')) throw new Error('Unsafe shard path');
    return saveAsset(`coco/${path}`, new URL(path, modelBase).href);
  }));
  const byteWidths = { float32: 4, int32: 4, bool: 1, complex64: 8, uint8: 1, uint16: 2 };
  const expectedBytes = group.weights.reduce((total, weight) => {
    const width = byteWidths[weight.quantization?.dtype || weight.dtype];
    if (!width) throw new Error(`Unsupported model weight type: ${weight.dtype}`);
    return total + width * weight.shape.reduce((size, dimension) => size * dimension, 1);
  }, 0);
  const actualBytes = shards.reduce((sum, bytes) => sum + bytes.length, 0);
  if (actualBytes !== expectedBytes) throw new Error(`COCO shard size mismatch: ${actualBytes} vs ${expectedBytes}`);
}

const packages = [
  ['tesseract.js', '6.0.1'],
  ['tesseract.js-core', '6.1.2'],
];
for (const [name, version] of packages) {
  const installed = JSON.parse(await readFile(resolve(root, 'node_modules', name, 'package.json'), 'utf8'));
  if (installed.version !== version) throw new Error(`Expected ${name}@${version}, found ${installed.version}`);
}
const localFiles = [
  ['tesseract/worker.min.js', 'tesseract.js', 'dist/worker.min.js', '6.0.1'],
  ['tesseract/worker.min.js.LICENSE.txt', 'tesseract.js', 'dist/worker.min.js.LICENSE.txt', '6.0.1'],
  ['tesseract/LICENSE-TESSERACT-JS.md', 'tesseract.js', 'LICENSE.md', '6.0.1'],
  ['tesseract/LICENSE-TESSERACT-CORE.txt', 'tesseract.js-core', 'LICENSE', '6.1.2'],
];
for (const variant of ['', '-lstm', '-simd', '-simd-lstm']) {
  for (const extension of ['wasm.js', 'wasm']) {
    const filename = `tesseract-core${variant}.${extension}`;
    localFiles.push([`tesseract/core/${filename}`, 'tesseract.js-core', filename, '6.1.2']);
  }
}
for (const [path, pkg, file, version] of localFiles) {
  await saveAsset(path, `npm:${pkg}@${version}/${file}`, `node_modules/${pkg}/${file}`);
}

await Promise.all(['eng', 'chi_sim'].map(async (lang) => {
  const bytes = await saveAsset(`tesseract/lang/${lang}.traineddata.gz`, languageSource(lang));
  const unpacked = gunzipSync(bytes);
  if (unpacked.length < 100000) throw new Error(`Invalid language model: ${lang}`);
}));
await saveAsset('coco/LICENSE-APACHE-2.0.txt', 'https://cdn.jsdelivr.net/gh/tensorflow/tfjs-models@master/LICENSE');
await saveAsset('tesseract/lang/LICENSE-APACHE-2.0.txt', 'https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_best@main/LICENSE');
await saveAsset('tesseract/lang/SOURCE-README.md', 'https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/README.md');

records.sort((a, b) => a.path.localeCompare(b.path));
const manifest = {
  schemaVersion: 1,
  description: 'Self-hosted AI assets; all image processing stays in the browser.',
  runtime: { cocoSsd: '2.2.3', tesseractJs: '6.0.1', tesseractCore: '6.1.2', languages: ['eng', 'chi_sim'], languageSet: '4.0.0_best_int', oem: 1 },
  assets: records,
};
if (!verifyOnly) await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`${records.length} assets; ${(records.reduce((sum, file) => sum + file.bytes, 0) / 1024 / 1024).toFixed(1)} MiB verified in ${relative(root, ai)}.`);
