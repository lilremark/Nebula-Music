// Pinned upstream assets and extracted checksums from assets.lock.json.
export const DJ_DOWNLOADS = [
  {
    "url": "https://huggingface.co/ggml-org/SmolLM3-3B-GGUF/resolve/4965cb60b150737b68a0408c36aeefb65078f894/SmolLM3-Q4_K_M.gguf",
    "sha256": "8334b850b7bd46238c16b0c550df2138f0889bf433809008cc17a8b05761863e",
    "file": "SmolLM3-Q4_K_M.gguf",
    "kind": "model",
    "size": 1915305312
  },
  {
    "url": "https://huggingface.co/echogarden/echogarden-packages/resolve/556a19e0572ecde3eb5dc062b8731625a6f6351e/kokoro-82m-v1.0-quantized-20250209.tar.gz",
    "sha256": "891018d4ca451560a4ce3e53a6d2813a50004c602d8df8776594659a29fae329",
    "file": "kokoro-82m-v1.0-quantized-20250209.tar.gz",
    "kind": "archive",
    "size": 61534972
  },
  {
    "url": "https://huggingface.co/echogarden/echogarden-packages/resolve/556a19e0572ecde3eb5dc062b8731625a6f6351e/kokoro-82m-v1.0-voices-20250209.tar.gz",
    "sha256": "f9df3840a97592e054271d2667698334f4ed7ad4cbf8d8c6fd190cd7dba3c958",
    "file": "kokoro-82m-v1.0-voices-20250209.tar.gz",
    "kind": "archive",
    "size": 25982190
  },
  {
    "url": "https://huggingface.co/echogarden/echogarden-packages/resolve/556a19e0572ecde3eb5dc062b8731625a6f6351e/espeak-ng-emscripten-20260722.tar.gz",
    "sha256": "7ed410082ce795097fc64ad46946fa26747fc1966fd5ba43117ba5b533a3a4ec",
    "file": "espeak-ng-emscripten-20260722.tar.gz",
    "kind": "archive",
    "size": 9921102
  }
] as const;
export const DJ_MODEL_FILES = [
  {
    "file": "SmolLM3-Q4_K_M.gguf",
    "size": 1915305312,
    "sha256": "8334b850b7bd46238c16b0c550df2138f0889bf433809008cc17a8b05761863e"
  },
  {
    "file": "packages/espeak-ng-emscripten-20260722/COPYING",
    "sha256": "8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903",
    "size": 35147
  },
  {
    "file": "packages/espeak-ng-emscripten-20260722/espeak-ng.data",
    "sha256": "34d8d90d112acd35f6b7cdf3da16125444aeeebc4b68bee87cd55d6f7e4dd3a0",
    "size": 19099765
  },
  {
    "file": "packages/espeak-ng-emscripten-20260722/espeak-ng.js",
    "sha256": "ba2b5f80f00a782a467c2072df2afe277124e328083ef6fb1aeed7d40205342a",
    "size": 603777
  },
  {
    "file": "packages/espeak-ng-emscripten-20260722/package.json",
    "sha256": "5b7be7a296ec6722ace433271f38045f26b6086fdf298c21311939ed72ae4b49",
    "size": 590
  },
  {
    "file": "packages/espeak-ng-emscripten-20260722/README.md",
    "sha256": "8b1a524a57d2a44459fd322c3bcdaa998dc839a71b4b136ce0d5676a5d5db2da",
    "size": 1131
  },
  {
    "file": "packages/kokoro-82m-v1.0-quantized-20250209/model_quantized.onnx",
    "sha256": "fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478",
    "size": 92361116
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/af_alloy.bin",
    "sha256": "c4a6b876047fd7fb472edf4ebd63cfac7c3b958a7cae7c106e8f038ca6308c45",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/af_aoede.bin",
    "sha256": "4a004c33430762e2461eedb2013fad808ef4ab3121f5300f554476caf58d8361",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/af_bella.bin",
    "sha256": "f69d836209b78eb8c66e75e3cda491e26ea838a3674257e9d4e5703cbaf55c8b",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/af_heart.bin",
    "sha256": "d583ccff3cdca2f7fae535cb998ac07e9fcb90f09737b9a41fa2734ec44a8f0b",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/af_jessica.bin",
    "sha256": "a240a5e3c15b43563d6e923bdca8ef5613a23471d9b77653694012435df23bd8",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/af_kore.bin",
    "sha256": "9be5221b6a941c04b561959b8ff0b06e809444dcc4ab7e75a7b23606f691819e",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/af_nicole.bin",
    "sha256": "cd2191ab31b914ed7b318416b0e4440fdf392ddad9106a060819aa600a64f59a",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/af_nova.bin",
    "sha256": "18778272caa0d0eebaea251c35fd635f038434f9eee5e691d02a174bd328414f",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/af_river.bin",
    "sha256": "00a2bcf82b1d86e8f19902ede58c65ccf6c0e43b44b7d74fad54e5d8933c9c30",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/af_sarah.bin",
    "sha256": "4409fbc125afabacc615d94db5398d847006a737b0247d6892b7a9a0007a2f0a",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/af_sky.bin",
    "sha256": "4435255c9744f3f31659e0d714ab7689bf65d9e77ec1cce060f083912614f0b9",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/am_adam.bin",
    "sha256": "162b035ed91cfc48b6046982184c645f72edcdd1b82843347f605d7bf7b15716",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/am_echo.bin",
    "sha256": "3968b92c3c4cd1c4416dbded36c13eaa388a90d5788d02a13e4d781f5f8cf3c3",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/am_eric.bin",
    "sha256": "e8b5be17edd1e3636901ce7598baafe2dc8dd8ff707a0c23bf9e461add7e2832",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/am_fenrir.bin",
    "sha256": "c27989f741f7ee34d273a39d8a595cc0837d35f5ced9a29b7cc162614616df43",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/am_liam.bin",
    "sha256": "52403be32fd047c6a44517cb0bcd6b134f2a18baa73e70ef41651e0eab921ade",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/am_michael.bin",
    "sha256": "1d1f21dd8da39c30705cd4c75d039d265e9bc4a2a93ed09bc9e1b1225eb95ba1",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/am_onyx.bin",
    "sha256": "da5d135b424164916d75a68ffb4c2abce3d7d5ccc82dd1ee6cf447ce286145e6",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/am_puck.bin",
    "sha256": "fcf73c989033e9233e0b98713eca600c8c74dcc1614b37009d5450ff4a2274a0",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/am_santa.bin",
    "sha256": "61150cf726ab6c5ed7a99f90a304f91f5a72c00c592e89ec94e5df11c319227a",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/bf_alice.bin",
    "sha256": "08afa6ba24da61ea5e8efa139e5aadc938d83f0a6da5a900adaf763ac1da5573",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/bf_emma.bin",
    "sha256": "669fe0647f9dd04fcab92f1439a40eeb4c8b4ab1f82e4996fe3d918ce4a63b73",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/bf_isabella.bin",
    "sha256": "3754352c4aaa46d17f27654ab7518d65b62ad6163a0f55a5f4330c2da2c4e94f",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/bf_lily.bin",
    "sha256": "5e0ee32ebe64a467124976b14e69590746f1c4ce41a12b587a50c862edfea335",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/bm_daniel.bin",
    "sha256": "6b3194bbceffb746733cbc22c8f593dd44e401a71d53895a2dca891bc595a1e8",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/bm_fable.bin",
    "sha256": "f889083196807b4adb15e9204252165f503b8d33d3982e681c52443c49d798f1",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/bm_george.bin",
    "sha256": "c4b235a4c1f2cd3b939fed08b899ce9385638b763f7b73a59616c4fc9bd6c9bc",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/bm_lewis.bin",
    "sha256": "b8f671cef828c30e66fdf0b0756a76bba58f6bb3398cbbf27058642acbcedb97",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/ef_dora.bin",
    "sha256": "f66ec66bd295acb18372e37008533a9a3228483ccd294e7538d5d9294ac9a532",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/em_alex.bin",
    "sha256": "27809e9eafdcbcfff90a3016c697568676531de2a2c39cee29c96c7bd6b83e95",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/em_santa.bin",
    "sha256": "ad43b774e1ca24d05c6161297d8aeb770ac3d29bb95daf516727af5f7d543683",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/ff_siwis.bin",
    "sha256": "a35f5675ad08948e326ae75fd0ea16ba5d0042e4f76b5f3d1df77d0a48c54861",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/hf_alpha.bin",
    "sha256": "040be6a4425411cc01fda5fd06693c76bfa78572632852bc8cda9c99232ffb56",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/hf_beta.bin",
    "sha256": "cd83ae0bb9b2e4e4fb92b4973bd8d1822ca0036d3c498bf4fc89aa8e33917cc7",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/hm_omega.bin",
    "sha256": "b02d9222d9ed00ce26b302173a862c2c93f96cc40b5c422b8d14910b9ff34137",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/hm_psi.bin",
    "sha256": "644daf88ba8aeb7bd08950bbdcd4453bb280864e49dc4df93fabc6be32e03f37",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/if_sara.bin",
    "sha256": "409b69248798fcdc2542330c76953d230710f19b057e59cb82fdc3c4cf71265c",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/im_nicola.bin",
    "sha256": "bc578e510d52a96d6940d46f12e96d7b3df00905dbea075113226d100e6e1ab0",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/jf_alpha.bin",
    "sha256": "56b479360aad9f367aeb8cef908f9201cf48b4555e488c5f4590c9dfcd978bb6",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/jf_gongitsune.bin",
    "sha256": "0f1181f3772d27b7c12aaf4bcd71e31b186c4146e330d074a3dc64ee392af396",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/jf_nezumi.bin",
    "sha256": "13cb71eebb0b48739d444558322aa35a8c9a489b80e1e631f14d2e6aea93026b",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/jf_tebukuro.bin",
    "sha256": "29c6c0561b4288d59639677bebe7533c919743d5ea68d0d2ae992644beea6696",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/jm_kumo.bin",
    "sha256": "09e959d239724c734d65661f06f14cdabcddfd476bfaaad905a937099ae9e64f",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/pf_dora.bin",
    "sha256": "3da7b5b2d91847ebf5646f57631af6ececae3c29a89cd300f06edf9aa6cfe9ee",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/pm_alex.bin",
    "sha256": "0175c753f59c54e7fd5a995bedef0c5ff2fb67e0043dd3dcb2ae74ec2acbeb2a",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/pm_santa.bin",
    "sha256": "8b012db3185778afe2e45a62cbad69db73021774fe68dda634bcc748a982eede",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/zf_xiaobei.bin",
    "sha256": "5dde6e1c9c4f12c8b327bc29c0cee361a23b52b952c04636858ba637ec66e640",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/zf_xiaoni.bin",
    "sha256": "08892b62a39af0a615cd0581238db7e19e44c578e8fa0bfd0e586e93327d9cba",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/zf_xiaoxiao.bin",
    "sha256": "03adb5d5e3ddd88b047954e974e651cb0a4b524c985057e5d872e962c7be1169",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/zf_xiaoyi.bin",
    "sha256": "bc1555c5c486099196ac254bae5e0bb543c121952a3092f50b7d8724f1bc36b3",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/zm_yunjian.bin",
    "sha256": "de48a00bdbf3649f07162269a2b6e0513604389bfac8a2e6c75cb34b323ad6fa",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/zm_yunxi.bin",
    "sha256": "7243892fb4e560d47014090ddf010f8b8b790f3c6b029ff82b2ac06aa4e27c8b",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/zm_yunxia.bin",
    "sha256": "6b2b8fc15b3df19a368daebe5c581c7fabf433ee5b8a17ffd6b3d723cff8936d",
    "size": 522240
  },
  {
    "file": "packages/kokoro-82m-v1.0-voices-20250209/zm_yunyang.bin",
    "sha256": "261e2c89470534dbbcb8fd98b8fdc495ec94063d9bb6c8277f7be43cccba3f42",
    "size": 522240
  }
] as const;
