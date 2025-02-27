import type { UserConfig } from '@commitlint/types';

const Configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  ignores: [(message) => message.includes('chore(release)')],
};

export default Configuration;
