/**
 * Monorepo, protected `main`: no npm publish, no direct commits to main.
 * Creates Git tag + GitHub Release only (release notes from commits).
 * @type {import("semantic-release").GlobalConfig}
 */
module.exports = {
  branches: ["main"],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/github",
  ],
};
