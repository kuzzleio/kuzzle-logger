## [1.6.0](https://github.com/kuzzleio/kuzzle-logger/compare/v1.5.0...v1.6.0) (2026-10-05)

### Features

* **browser:** flush during backoff, idempotent capture, Vue handler options ([08571ea](https://github.com/kuzzleio/kuzzle-logger/commit/08571eadc4d19431abcf67813ea7a743bd74eba3))
* **browser:** limit batch size in bytes (maxBatchBytes) ([fbfbff9](https://github.com/kuzzleio/kuzzle-logger/commit/fbfbff9fbed05808324245469f40ae23765eaccc)), closes [#50](https://github.com/kuzzleio/kuzzle-logger/issues/50)
* **ingestion:** harden anonymous ingestion ([2dacf04](https://github.com/kuzzleio/kuzzle-logger/commit/2dacf04499e8db4445c3b22af7e4caad0deb65f9))
* **types:** export TransportConfig ([75cf7f7](https://github.com/kuzzleio/kuzzle-logger/commit/75cf7f70e7a0592506e9d461d41b3cbeed21ee47)), closes [#59](https://github.com/kuzzleio/kuzzle-logger/issues/59)

### Bug Fixes

* **browser:** never throw when getMergingObject throws ([7f05ef9](https://github.com/kuzzleio/kuzzle-logger/commit/7f05ef99f1b1e166a166576c2f4c3aea94d4a9ee)), closes [#47](https://github.com/kuzzleio/kuzzle-logger/issues/47)
* **browser:** no re-entrant flush or request loop on failing batches ([afc7fca](https://github.com/kuzzleio/kuzzle-logger/commit/afc7fca018ad80a9a8c4ba3493cdc6740b707969)), closes [#48](https://github.com/kuzzleio/kuzzle-logger/issues/48)
* **browser:** send every pending batch on pagehide, without waiting ([d325c50](https://github.com/kuzzleio/kuzzle-logger/commit/d325c508144a9ca7f432cce8fd5bc052ee9195cc)), closes [#49](https://github.com/kuzzleio/kuzzle-logger/issues/49)
* child loggers follow the parent level ([e64bf81](https://github.com/kuzzleio/kuzzle-logger/commit/e64bf81e1d2949069ecc1e103b22d0bea32fe1c2)), closes [#55](https://github.com/kuzzleio/kuzzle-logger/issues/55)
* flush() no longer calls resolve() after reject() ([ebd5d3f](https://github.com/kuzzleio/kuzzle-logger/commit/ebd5d3fdf0595ff2f1803a40be7d09c20f12f638)), closes [#59](https://github.com/kuzzleio/kuzzle-logger/issues/59)
* **protocol:** denylist no longer redacts structural entry fields ([e62de3b](https://github.com/kuzzleio/kuzzle-logger/commit/e62de3b1f6bca01aeb107eec13f33170dc342dc5)), closes [#52](https://github.com/kuzzleio/kuzzle-logger/issues/52)
* **protocol:** keep error fingerprints stable across deploys ([e749959](https://github.com/kuzzleio/kuzzle-logger/commit/e749959ab9790e40192a5dee4eadc46004986e58)), closes [#54](https://github.com/kuzzleio/kuzzle-logger/issues/54)
* **protocol:** normalize namespaces and truncate deep values instead of rejecting ([c8445dd](https://github.com/kuzzleio/kuzzle-logger/commit/c8445dd62681dc5ff3fc85c53df9f302099948a6)), closes [#51](https://github.com/kuzzleio/kuzzle-logger/issues/51)
* **protocol:** redact more sensitive parameters in strings ([b7416c3](https://github.com/kuzzleio/kuzzle-logger/commit/b7416c3314ada9dbd6b17ed1494228119767a965)), closes [#53](https://github.com/kuzzleio/kuzzle-logger/issues/53)
* resolve extensionless deep imports again ([aa34635](https://github.com/kuzzleio/kuzzle-logger/commit/aa346353b65c61b89bf2abc9a5003b0ce4629d19)), closes [#56](https://github.com/kuzzleio/kuzzle-logger/issues/56)

## [1.5.0](https://github.com/kuzzleio/kuzzle-logger/compare/v1.4.0...v1.5.0) (2026-10-02)

### Features

* **browser:** batching transport with kuzzle and http senders ([9490175](https://github.com/kuzzleio/kuzzle-logger/commit/9490175a500052a079ae6f23b964a98671a3d46e)), closes [#15](https://github.com/kuzzleio/kuzzle-logger/issues/15) [#19](https://github.com/kuzzleio/kuzzle-logger/issues/19) [#16](https://github.com/kuzzleio/kuzzle-logger/issues/16)
* **browser:** browser KuzzleLogger with Node API parity and console mirroring ([b4591dc](https://github.com/kuzzleio/kuzzle-logger/commit/b4591dc180edda8f9fdc2d5d3bd0ed1edef19016)), closes [#15](https://github.com/kuzzleio/kuzzle-logger/issues/15)
* **browser:** opt-in global error capture and Vue error handler ([5d44661](https://github.com/kuzzleio/kuzzle-logger/commit/5d446619cd99cdbc60a68b2a9065976f818d19bf)), closes [#17](https://github.com/kuzzleio/kuzzle-logger/issues/17)
* **ingestion:** createBrowserLogsController for Kuzzle applications ([2c03907](https://github.com/kuzzleio/kuzzle-logger/commit/2c03907ade101315ea8c74aa8fd94cd2d6f814cf)), closes [#14](https://github.com/kuzzleio/kuzzle-logger/issues/14) [#18](https://github.com/kuzzleio/kuzzle-logger/issues/18) [#19](https://github.com/kuzzleio/kuzzle-logger/issues/19)
* **protocol:** browser logs payload v1 schema, validation, sanitization and fingerprint ([9e42bdf](https://github.com/kuzzleio/kuzzle-logger/commit/9e42bdf3c15f61072b582ef6ce6267430cb34693)), closes [#18](https://github.com/kuzzleio/kuzzle-logger/issues/18)

### Bug Fixes

* **browser:** ignore the "undefined" file name Safari gives for console code ([0a54072](https://github.com/kuzzleio/kuzzle-logger/commit/0a540721e8556c37033696ab19c02515e9183416))
* **ci:** support npm trusted publishing in the release process ([c19df9a](https://github.com/kuzzleio/kuzzle-logger/commit/c19df9ad07b3146b238176a80fe43ca5ca1ea904))
* **logger:** resolve the parent merging object lazily in child loggers ([5201fdf](https://github.com/kuzzleio/kuzzle-logger/commit/5201fdfc1743810b686b83c3c2df19f314988412)), closes [#22](https://github.com/kuzzleio/kuzzle-logger/issues/22)
* **logger:** serialize errors and always apply the merging object ([7cfce13](https://github.com/kuzzleio/kuzzle-logger/commit/7cfce13d0254e5371e80546cebfd6259ee0dcaa5)), closes [#21](https://github.com/kuzzleio/kuzzle-logger/issues/21)
* **logger:** spread trace() arguments and share the level implementation ([52f1453](https://github.com/kuzzleio/kuzzle-logger/commit/52f1453a8a843a651ba6d2010aaea23f47dba931)), closes [#23](https://github.com/kuzzleio/kuzzle-logger/issues/23)
* **presets:** peer dependencies, public typings and preset options robustness ([07410c2](https://github.com/kuzzleio/kuzzle-logger/commit/07410c2c6566fb2376b5b05bbff52656a7daea24)), closes [#24](https://github.com/kuzzleio/kuzzle-logger/issues/24)

## [1.4.0](https://github.com/kuzzleio/kuzzle-logger/compare/v1.3.0...v1.4.0) (2025-09-15)


### Features

* **loki:** allow to use the propsToLabels option on loki preset ([84d2593](https://github.com/kuzzleio/kuzzle-logger/commit/84d25938c99fb1acaa7c4cec7c47786ad59d4acb))

## [1.3.0](https://github.com/kuzzleio/kuzzle-logger/compare/v1.2.0...v1.3.0) (2025-07-10)


### Features

* add file preset to log directly into a file or a file descriptor ([fa51b6e](https://github.com/kuzzleio/kuzzle-logger/commit/fa51b6e9148af8cbca0849588630ddee6c5ca4f2))


### Bug Fixes

* apply linting requested changes ([8927ef4](https://github.com/kuzzleio/kuzzle-logger/commit/8927ef4224a40eca373b7056f6c0a2e2e9baee27))

## [1.3.0-dev.1](https://github.com/kuzzleio/kuzzle-logger/compare/v1.2.0...v1.3.0-dev.1) (2025-07-10)


### Features

* add file preset to log directly into a file or a file descriptor ([fa51b6e](https://github.com/kuzzleio/kuzzle-logger/commit/fa51b6e9148af8cbca0849588630ddee6c5ca4f2))


### Bug Fixes

* apply linting requested changes ([8927ef4](https://github.com/kuzzleio/kuzzle-logger/commit/8927ef4224a40eca373b7056f6c0a2e2e9baee27))

## [1.2.0](https://github.com/kuzzleio/kuzzle-logger/compare/v1.1.0...v1.2.0) (2025-03-19)


### Features

* **logger:** add level to options ([15fa159](https://github.com/kuzzleio/kuzzle-logger/commit/15fa1593b950114cb108e1020087267a94842365))


### Bug Fixes

* **logger:** set default log level to info to avoid exception if undefined ([12c9da9](https://github.com/kuzzleio/kuzzle-logger/commit/12c9da97c07eb66262cdaf3deb0a08a51a8d1e73))

## [1.2.0-dev.2](https://github.com/kuzzleio/kuzzle-logger/compare/v1.2.0-dev.1...v1.2.0-dev.2) (2025-03-19)


### Bug Fixes

* **logger:** set default log level to info to avoid exception if undefined ([12c9da9](https://github.com/kuzzleio/kuzzle-logger/commit/12c9da97c07eb66262cdaf3deb0a08a51a8d1e73))

## [1.2.0-dev.1](https://github.com/kuzzleio/kuzzle-logger/compare/v1.1.0...v1.2.0-dev.1) (2025-03-12)


### Features

* **logger:** add level to options ([15fa159](https://github.com/kuzzleio/kuzzle-logger/commit/15fa1593b950114cb108e1020087267a94842365))

## [1.1.0](https://github.com/kuzzleio/kuzzle-logger/compare/v1.0.1...v1.1.0) (2025-03-11)


### Features

* **logger:** add child logger creation ([c71419e](https://github.com/kuzzleio/kuzzle-logger/commit/c71419e9cedde3a9bc93b4ee08376d8f7aa4d0c3))
* **logger:** add flush ([bc500c7](https://github.com/kuzzleio/kuzzle-logger/commit/bc500c75b74f04fc95f9093a5c937b8b391ea39c))


### Bug Fixes

* **presets:** add missing level in stdout preset ([bbc7c2b](https://github.com/kuzzleio/kuzzle-logger/commit/bbc7c2b19b9db19b1d34d2997a8008f1901f60a2))

## [1.1.0-dev.2](https://github.com/kuzzleio/kuzzle-logger/compare/v1.1.0-dev.1...v1.1.0-dev.2) (2025-03-11)


### Features

* **logger:** add child logger creation ([d321b77](https://github.com/kuzzleio/kuzzle-logger/commit/d321b773fd19c40fb7e56f21cabd08e3b3e73ded))

## [1.1.0-dev.1](https://github.com/kuzzleio/kuzzle-logger/compare/v1.0.1-dev.1...v1.1.0-dev.1) (2025-03-07)

### Features

- **logger:** add flush ([2125a1f](https://github.com/kuzzleio/kuzzle-logger/commit/2125a1f09053faba911bca10d5612e5e76d13716))

### Bug Fixes

- **presets:** add missing level in stdout preset ([197ab19](https://github.com/kuzzleio/kuzzle-logger/commit/197ab192f7ff2c1c4b89ec857c3785234c1d5515))

## [1.0.1](https://github.com/kuzzleio/kuzzle-logger/compare/v1.0.0...v1.0.1) (2025-03-04)

### Bug Fixes

- **presets:** fix default interval value for loki preset ([7645cb8](https://github.com/kuzzleio/kuzzle-logger/commit/7645cb8bd91fe9099282dad0cbee660e4e701dae))

## [1.0.1-dev.1](https://github.com/kuzzleio/kuzzle-logger/compare/v1.0.0...v1.0.1-dev.1) (2025-03-04)

### Bug Fixes

- **presets:** fix default interval value for loki preset ([7645cb8](https://github.com/kuzzleio/kuzzle-logger/commit/7645cb8bd91fe9099282dad0cbee660e4e701dae))

## 1.0.0 (2025-02-27)

### Features

- **logger:** add service name parameter, add loki preset ([46c63a7](https://github.com/kuzzleio/kuzzle-logger/commit/46c63a78f0d514db86a18012fd5847f8f4592f51))
- **logger:** allow passing additional objects and args to log functions ([213f770](https://github.com/kuzzleio/kuzzle-logger/commit/213f7703cfb1d7b43344b47fc1baf4ea6155295d))
- **logger:** expose level getter and setter ([f9ad710](https://github.com/kuzzleio/kuzzle-logger/commit/f9ad710ecc5d2382f238b8c53b4b4d71c10ee239))
- **logger:** initial implementation with all tooling ([b484c3d](https://github.com/kuzzleio/kuzzle-logger/commit/b484c3d4a83feff0bfd4349aa91f9f39bbc9100e))
- **presets:** add level to presets ([eddd0c3](https://github.com/kuzzleio/kuzzle-logger/commit/eddd0c302cf3d9748ecbc6ec9942e41e8aff14d1))

### Bug Fixes

- **logger:** fix handling of error objects ([fdd2f95](https://github.com/kuzzleio/kuzzle-logger/commit/fdd2f9561dfe87eb8cb6c9c064d4269d7f07e330))
- **npm:** remove extraneous files from released package ([623a02f](https://github.com/kuzzleio/kuzzle-logger/commit/623a02f6091fe7aaf69a3cfa79aa97bf7bc17c27))
- **presets:** fix kuzzle-elasticsearch preset timestamps not being dynamic ([ec6cd69](https://github.com/kuzzleio/kuzzle-logger/commit/ec6cd69012615d5c3071d957ed363f8213af3245))
- **presets:** set pino-pretty minimum level to 'trace' ([70a1c42](https://github.com/kuzzleio/kuzzle-logger/commit/70a1c426aac11ba98c0c5de191361e244014f2f8))

## [1.0.0-dev.10](https://github.com/kuzzleio/kuzzle-logger/compare/v1.0.0-dev.9...v1.0.0-dev.10) (2025-02-27)

### Bug Fixes

- **presets:** fix kuzzle-elasticsearch preset timestamps not being dynamic ([ec6cd69](https://github.com/kuzzleio/kuzzle-logger/commit/ec6cd69012615d5c3071d957ed363f8213af3245))

## [1.0.0-dev.9](https://github.com/kuzzleio/kuzzle-logger/compare/v1.0.0-dev.8...v1.0.0-dev.9) (2025-02-19)

### Features

- **presets:** add level to presets ([eddd0c3](https://github.com/kuzzleio/kuzzle-logger/commit/eddd0c302cf3d9748ecbc6ec9942e41e8aff14d1))

## [1.0.0-dev.8](https://github.com/kuzzleio/kuzzle-logger/compare/v1.0.0-dev.7...v1.0.0-dev.8) (2025-02-19)

### Features

- **logger:** add service name parameter, add loki preset ([46c63a7](https://github.com/kuzzleio/kuzzle-logger/commit/46c63a78f0d514db86a18012fd5847f8f4592f51))

## [1.0.0-dev.7](https://github.com/kuzzleio/kuzzle-logger/compare/v1.0.0-dev.6...v1.0.0-dev.7) (2025-02-14)

### Features

- **logger:** expose level getter and setter ([f9ad710](https://github.com/kuzzleio/kuzzle-logger/commit/f9ad710ecc5d2382f238b8c53b4b4d71c10ee239))

## [1.0.0-dev.6](https://github.com/kuzzleio/kuzzle-logger/compare/v1.0.0-dev.5...v1.0.0-dev.6) (2025-02-14)

### Bug Fixes

- **presets:** set pino-pretty minimum level to 'trace' ([70a1c42](https://github.com/kuzzleio/kuzzle-logger/commit/70a1c426aac11ba98c0c5de191361e244014f2f8))

### Reverts

- Revert "feat(logger): allow getting a pino child logger" ([60ac5d3](https://github.com/kuzzleio/kuzzle-logger/commit/60ac5d34ab3699ee854d35654643ac03c642d6f7))

## [1.0.0-dev.5](https://github.com/kuzzleio/kuzzle-logger/compare/v1.0.0-dev.4...v1.0.0-dev.5) (2025-02-14)

### Features

- **logger:** allow getting a pino child logger ([985c09c](https://github.com/kuzzleio/kuzzle-logger/commit/985c09cc58091026eac0a2f4b5c99806d4217dc6))

## [1.0.0-dev.4](https://github.com/kuzzleio/kuzzle-logger/compare/v1.0.0-dev.3...v1.0.0-dev.4) (2025-02-14)

### Bug Fixes

- **logger:** fix handling of error objects ([fdd2f95](https://github.com/kuzzleio/kuzzle-logger/commit/fdd2f9561dfe87eb8cb6c9c064d4269d7f07e330))

## [1.0.0-dev.3](https://github.com/kuzzleio/kuzzle-logger/compare/v1.0.0-dev.2...v1.0.0-dev.3) (2025-02-14)

### Features

- **logger:** allow passing additional objects and args to log functions ([213f770](https://github.com/kuzzleio/kuzzle-logger/commit/213f7703cfb1d7b43344b47fc1baf4ea6155295d))

## [1.0.0-dev.2](https://github.com/kuzzleio/kuzzle-logger/compare/v1.0.0-dev.1...v1.0.0-dev.2) (2025-02-14)

### Bug Fixes

- **npm:** remove extraneous files from released package ([623a02f](https://github.com/kuzzleio/kuzzle-logger/commit/623a02f6091fe7aaf69a3cfa79aa97bf7bc17c27))

## 1.0.0-dev.1 (2025-02-14)

### Features

- **logger:** initial implementation with all tooling ([b484c3d](https://github.com/kuzzleio/kuzzle-logger/commit/b484c3d4a83feff0bfd4349aa91f9f39bbc9100e))
