import kuzzlePlugin from "eslint-plugin-kuzzle";

export default [
  {
    ignores: ["dist/", "tests/scenarios/migrated/**"],
  },
  ...kuzzlePlugin.configs.default,
  ...kuzzlePlugin.configs.node,
  ...kuzzlePlugin.configs.typescript,
];
