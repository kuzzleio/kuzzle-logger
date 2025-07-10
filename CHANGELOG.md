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
