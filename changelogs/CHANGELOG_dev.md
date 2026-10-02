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
