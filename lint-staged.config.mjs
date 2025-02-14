/**
 * @type {import('lint-staged').Configuration}
 */
export default {
  '*.md': 'prettier --write',
  '*.{js,ts}': 'eslint --fix',
};
