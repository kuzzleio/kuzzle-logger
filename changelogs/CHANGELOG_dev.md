## [1.6.0-beta.2](https://github.com/kuzzleio/kuzzle-logger/compare/v1.6.0-beta.1...v1.6.0-beta.2) (2026-10-05)

### Features

* **ingestion:** harden anonymous ingestion ([2dacf04](https://github.com/kuzzleio/kuzzle-logger/commit/2dacf04499e8db4445c3b22af7e4caad0deb65f9))
* **types:** export TransportConfig ([75cf7f7](https://github.com/kuzzleio/kuzzle-logger/commit/75cf7f70e7a0592506e9d461d41b3cbeed21ee47)), closes [#59](https://github.com/kuzzleio/kuzzle-logger/issues/59)

### Bug Fixes

* flush() no longer calls resolve() after reject() ([ebd5d3f](https://github.com/kuzzleio/kuzzle-logger/commit/ebd5d3fdf0595ff2f1803a40be7d09c20f12f638)), closes [#59](https://github.com/kuzzleio/kuzzle-logger/issues/59)

## [1.6.0-beta.1](https://github.com/kuzzleio/kuzzle-logger/compare/v1.5.0...v1.6.0-beta.1) (2026-10-03)

### Features

* **browser:** limit batch size in bytes (maxBatchBytes) ([fbfbff9](https://github.com/kuzzleio/kuzzle-logger/commit/fbfbff9fbed05808324245469f40ae23765eaccc)), closes [#50](https://github.com/kuzzleio/kuzzle-logger/issues/50)

### Bug Fixes

* **browser:** never throw when getMergingObject throws ([7f05ef9](https://github.com/kuzzleio/kuzzle-logger/commit/7f05ef99f1b1e166a166576c2f4c3aea94d4a9ee)), closes [#47](https://github.com/kuzzleio/kuzzle-logger/issues/47)
* **browser:** no re-entrant flush or request loop on failing batches ([afc7fca](https://github.com/kuzzleio/kuzzle-logger/commit/afc7fca018ad80a9a8c4ba3493cdc6740b707969)), closes [#48](https://github.com/kuzzleio/kuzzle-logger/issues/48)
* **browser:** send every pending batch on pagehide, without waiting ([d325c50](https://github.com/kuzzleio/kuzzle-logger/commit/d325c508144a9ca7f432cce8fd5bc052ee9195cc)), closes [#49](https://github.com/kuzzleio/kuzzle-logger/issues/49)
* child loggers follow the parent level ([e64bf81](https://github.com/kuzzleio/kuzzle-logger/commit/e64bf81e1d2949069ecc1e103b22d0bea32fe1c2)), closes [#55](https://github.com/kuzzleio/kuzzle-logger/issues/55)
* **protocol:** denylist no longer redacts structural entry fields ([e62de3b](https://github.com/kuzzleio/kuzzle-logger/commit/e62de3b1f6bca01aeb107eec13f33170dc342dc5)), closes [#52](https://github.com/kuzzleio/kuzzle-logger/issues/52)
* **protocol:** keep error fingerprints stable across deploys ([e749959](https://github.com/kuzzleio/kuzzle-logger/commit/e749959ab9790e40192a5dee4eadc46004986e58)), closes [#54](https://github.com/kuzzleio/kuzzle-logger/issues/54)
* **protocol:** normalize namespaces and truncate deep values instead of rejecting ([c8445dd](https://github.com/kuzzleio/kuzzle-logger/commit/c8445dd62681dc5ff3fc85c53df9f302099948a6)), closes [#51](https://github.com/kuzzleio/kuzzle-logger/issues/51)
* **protocol:** redact more sensitive parameters in strings ([b7416c3](https://github.com/kuzzleio/kuzzle-logger/commit/b7416c3314ada9dbd6b17ed1494228119767a965)), closes [#53](https://github.com/kuzzleio/kuzzle-logger/issues/53)
* resolve extensionless deep imports again ([aa34635](https://github.com/kuzzleio/kuzzle-logger/commit/aa346353b65c61b89bf2abc9a5003b0ce4629d19)), closes [#56](https://github.com/kuzzleio/kuzzle-logger/issues/56)

## [1.5.0-beta.2](https://github.com/kuzzleio/kuzzle-logger/compare/v1.5.0-beta.1...v1.5.0-beta.2) (2026-10-02)

### Bug Fixes

* **browser:** ignore the "undefined" file name Safari gives for console code ([0a54072](https://github.com/kuzzleio/kuzzle-logger/commit/0a540721e8556c37033696ab19c02515e9183416))

## [1.5.0-beta.1](https://github.com/kuzzleio/kuzzle-logger/compare/v1.4.0...v1.5.0-beta.1) (2026-10-02)

### Features

* **browser:** batching transport with kuzzle and http senders ([9490175](https://github.com/kuzzleio/kuzzle-logger/commit/9490175a500052a079ae6f23b964a98671a3d46e)), closes [#15](https://github.com/kuzzleio/kuzzle-logger/issues/15) [#19](https://github.com/kuzzleio/kuzzle-logger/issues/19) [#16](https://github.com/kuzzleio/kuzzle-logger/issues/16)
* **browser:** browser KuzzleLogger with Node API parity and console mirroring ([b4591dc](https://github.com/kuzzleio/kuzzle-logger/commit/b4591dc180edda8f9fdc2d5d3bd0ed1edef19016)), closes [#15](https://github.com/kuzzleio/kuzzle-logger/issues/15)
* **browser:** opt-in global error capture and Vue error handler ([5d44661](https://github.com/kuzzleio/kuzzle-logger/commit/5d446619cd99cdbc60a68b2a9065976f818d19bf)), closes [#17](https://github.com/kuzzleio/kuzzle-logger/issues/17)
* **ingestion:** createBrowserLogsController for Kuzzle applications ([2c03907](https://github.com/kuzzleio/kuzzle-logger/commit/2c03907ade101315ea8c74aa8fd94cd2d6f814cf)), closes [#14](https://github.com/kuzzleio/kuzzle-logger/issues/14) [#18](https://github.com/kuzzleio/kuzzle-logger/issues/18) [#19](https://github.com/kuzzleio/kuzzle-logger/issues/19)
* **protocol:** browser logs payload v1 schema, validation, sanitization and fingerprint ([9e42bdf](https://github.com/kuzzleio/kuzzle-logger/commit/9e42bdf3c15f61072b582ef6ce6267430cb34693)), closes [#18](https://github.com/kuzzleio/kuzzle-logger/issues/18)

### Bug Fixes

* **ci:** support npm trusted publishing in the release process ([c19df9a](https://github.com/kuzzleio/kuzzle-logger/commit/c19df9ad07b3146b238176a80fe43ca5ca1ea904))
* **logger:** resolve the parent merging object lazily in child loggers ([5201fdf](https://github.com/kuzzleio/kuzzle-logger/commit/5201fdfc1743810b686b83c3c2df19f314988412)), closes [#22](https://github.com/kuzzleio/kuzzle-logger/issues/22)
* **logger:** serialize errors and always apply the merging object ([7cfce13](https://github.com/kuzzleio/kuzzle-logger/commit/7cfce13d0254e5371e80546cebfd6259ee0dcaa5)), closes [#21](https://github.com/kuzzleio/kuzzle-logger/issues/21)
* **logger:** spread trace() arguments and share the level implementation ([52f1453](https://github.com/kuzzleio/kuzzle-logger/commit/52f1453a8a843a651ba6d2010aaea23f47dba931)), closes [#23](https://github.com/kuzzleio/kuzzle-logger/issues/23)
* **presets:** peer dependencies, public typings and preset options robustness ([07410c2](https://github.com/kuzzleio/kuzzle-logger/commit/07410c2c6566fb2376b5b05bbff52656a7daea24)), closes [#24](https://github.com/kuzzleio/kuzzle-logger/issues/24)
