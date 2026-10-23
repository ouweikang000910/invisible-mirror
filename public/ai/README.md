# Self-hosted AI assets

These files are served from the same origin as the app. The application supplies
all runtime paths explicitly: worker, WebAssembly core, language data, and object
detection weights. Preparation downloads public model files; image inference
runs in the user's browser.

## Runtime configuration

```js
const detector = await cocoSsd.load({
  base: 'lite_mobilenet_v2',
  modelUrl: '/ai/coco/model.json',
});
const worker = await createWorker(['eng', 'chi_sim'], 1, {
  workerPath: '/ai/tesseract/worker.min.js',
  langPath: '/ai/tesseract/lang',
  corePath: '/ai/tesseract/core',
  workerBlobURL: false,
});
```

OEM `1` selects the LSTM engine. The language files are the official Tesseract.js
`4.0.0_best_int` English and Simplified Chinese data. Tesseract automatically picks
the SIMD/non-SIMD LSTM core variant according to browser capability. The other two
core variants and separate `.wasm` binaries are included for completeness; the
`.wasm.js` files contain their own embedded WASM binary.

## Sources and licenses

- **COCO-SSD lite MobileNet v2**, loaded by `@tensorflow-models/coco-ssd@2.2.3`:
  [official TensorFlow.js model repository](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd),
  [official Google-hosted model](https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/model.json).
  Apache License 2.0 is included in `coco/LICENSE-APACHE-2.0.txt`.
- **Tesseract.js 6.0.1**, browser worker copied from the pinned npm package:
  [official repository](https://github.com/naptha/tesseract.js).
  Apache License 2.0 and worker third-party notices are included.
- **Tesseract.js Core 6.1.2**, copied from the installed dependency pinned by the
  package lock: [official repository](https://github.com/naptha/tesseract.js-core).
  Apache License 2.0 is included in `tesseract/LICENSE-TESSERACT-CORE.txt`.
- **English and Simplified Chinese language data**:
  [official Tesseract.js language-data repository](https://github.com/naptha/tessdata/tree/gh-pages/4.0.0_best_int),
  derived from [Tesseract tessdata_best](https://github.com/tesseract-ocr/tessdata_best).
  Apache License 2.0 and the source README are included in `tesseract/lang/`.

`asset-manifest.json` records the source URL, byte count, and SHA-256 checksum of
every runtime asset and downloaded license. To reproduce after `npm ci`, run
`node scripts/prepare-models.mjs`. To verify the committed assets without network
access, run `node scripts/prepare-models.mjs --verify`.
