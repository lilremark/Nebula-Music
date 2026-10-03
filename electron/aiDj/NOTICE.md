# Bundled AI DJ resources

Nebula's local DJ uses SmolLM3-3B (HuggingFaceTB), Kokoro-82M v1.0
(hexgrad), llama.cpp (ggml-org), Echogarden, ONNX Runtime and eSpeak NG.

SmolLM3 and Kokoro are distributed under Apache License 2.0. The license
text is in notices/Apache-2.0.txt. Model attribution and pinned revisions
are recorded in the application's source, electron/aiDj/assets.lock.json.
The shipped Q3_K_S model is generated from the pinned original FP16 GGUF
using the pinned llama.cpp b11366 quantizer, not from an already quantized model.

llama.cpp is MIT licensed; see notices/llama-LICENSE. Its CPU helper includes
LLVM OpenMP; see llama/LICENSE-LLVM-OpenMP. Echogarden and ONNX Runtime
license files and Echogarden source are included in the application's
node_modules resources. Nebula modifies Echogarden's PackageManager to
resolve bundled resources and prohibit model downloads; the modification
is recorded in scripts/patchEchogarden.mjs in Nebula's source.

The eSpeak NG Emscripten phonemizer is GPL-3.0 licensed. Its full COPYING
and build README are in packages/espeak-ng-emscripten-20260722. Corresponding
source and the Emscripten build script are included in
notices/espeak-ng-source-9a550bef.tar.gz, from Echogarden's eSpeak NG fork
commit 9a550bef455f03b459f51796e3482833aab7fbc0 (2026-07-22).
Extract that archive and follow its build-emscripten.sh and package README
to rebuild the phonemizer. Compilation requires the Emscripten toolchain
and standard Linux build tools described by that README.

Upstream sources:
- https://huggingface.co/HuggingFaceTB/SmolLM3-3B
- https://huggingface.co/hexgrad/Kokoro-82M
- https://github.com/ggml-org/llama.cpp
- https://github.com/echogarden-project/echogarden
- https://github.com/echogarden-project/espeak-ng/tree/9a550bef455f03b459f51796e3482833aab7fbc0
- https://github.com/microsoft/onnxruntime
- https://github.com/lilremark/Nebula-Music

Inference is local. No bundled model or voice may be downloaded at runtime.
