/* eslint-disable max-len */
/**
 * @file The upstream project rarely publishes releases,
 * so this serves as a mechanism to allow us to have
 * npm packages that are up-to-date with upstream, and
 * that contain any changes we've made locally.
 *
 * We'll use a manually-specified base version with
 * the prerelease tag `bscotch`, e.g. `1.0.0-bscotch.0`.
 */
import { ok } from "assert";
import { execSync } from "child_process";
import fs from "fs";
import semver from "semver";

// Ensure we're in a clean repo
const gitStatus = run("git status --porcelain");
ok(gitStatus[0] === "", "Repo is not clean");
// Ensure we have all tags
run("git pull --rebase --tags");
// Install/build/etc
run(["rm -rf node_modules dist", "yarn --frozen-lockfile", "yarn build"]);

// Get the latest bscotch release
const baseVersion = getPackageJsonVersion();
let latestTag = getMaxMatchingTag("v*-bscotch.*");
if (!latestTag || !latestTag.startsWith(`v${baseVersion}-`)) {
    latestTag = `v${baseVersion}-bscotch.0`;
}

// Increment the custom prerelease count
const nextVersion = semver.inc(latestTag, "prerelease", "bscotch");
const nextTag = `v${nextVersion}`;

// Package the new version
setPackageJsonVersion(nextVersion);
run("npm pack");
const packagePath = `${getPackageName()}-${nextVersion}.tgz`;
ok(fs.existsSync(packagePath), `${packagePath} does not exist`);

// Tag & publish to the releases
const globalLatestTag = getMaxMatchingTag("v*");
run(`git tag -a ${nextTag} -m "Release ${nextVersion}"`);
run("git push --tags");
const title = `Release ${nextTag}`;
const packageUrl = `https://github.com/bscotch/ts-json-schema-generator/releases/download/${nextTag}/ts-json-schema-generator-${nextVersion}.tgz`;
const diffUrl = `https://github.com/bscotch/ts-json-schema-generator/compare/${globalLatestTag}..${nextTag}`;
const notes = `## Changelog\n\n${diffUrl}\n\n## Installation\n\n- \`npm install ${packageUrl}\`\n- \`pnpm add ${packageUrl}\`\n \`yarn add ${packageUrl}\``;
fs.writeFileSync("NOTES.md", notes);

run(
    `gh release create ${nextTag} ${packagePath}#package -t "${title}" --target origin/release --repo bscotch/ts-json-schema-generator --notes-file NOTES.md --prerelease`
);

// Reset the package.json
run("git checkout package.json");

// UTILITIES

/**
 * @param {string} pattern
 * @returns {string[]}
 */
function getMatchingTags(pattern) {
    return run("git tag --list " + pattern)[0].split("\n");
}

/**
 *
 * @param {string[]} versions
 * @returns {string}
 */
function maxVersion(versions) {
    return versions.sort(semver.compare)[versions.length - 1];
}

/**
 *
 * @param {string} pattern
 * @returns {string}
 */
function getMaxMatchingTag(pattern) {
    return maxVersion(getMatchingTags(pattern));
}

/**
 * @returns {{version:string, name:string}}
 */
function readPackageJson() {
    return JSON.parse(fs.readFileSync("package.json", "utf-8"));
}

function setPackageJsonVersion(version) {
    const pkg = readPackageJson();
    pkg.version = version;
    fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2));
}

function getPackageJsonVersion() {
    return readPackageJson().version;
}

function getPackageName() {
    return readPackageJson().name;
}

/**
 * Run a command, returning stdout as a string.
 * @param {string[]|string} cmds
 */
function run(cmds) {
    cmds = Array.isArray(cmds) ? cmds : [cmds];
    /** @type {string[]} */
    const out = [];
    for (const cmd of cmds) {
        console.log("Running:", cmd);
        out.push(execSync(cmd).toString().trim());
    }
    return out;
}
