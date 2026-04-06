import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const validReleaseTypes = new Set(["patch", "minor", "major"]);

function bumpVersion(version, releaseType) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  const next = match.slice(1).map(value => Number(value));
  if (releaseType === "patch") {
    next[2] += 1;
  }
  else if (releaseType === "minor") {
    next[1] += 1;
    next[2] = 0;
  }
  else if (releaseType === "major") {
    next[0] += 1;
    next[1] = 0;
    next[2] = 0;
  }
  else {
    throw new Error(`Unsupported release type: ${releaseType}`);
  }

  return next.join(".");
}

async function main() {
  const releaseType = process.argv[2];
  if (!validReleaseTypes.has(releaseType)) {
    throw new Error("Usage: node scripts/bump-version.mjs <patch|minor|major>");
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const packagePath = path.resolve(scriptDir, "..", "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  const nextVersion = bumpVersion(packageJson.version, releaseType);

  packageJson.version = nextVersion;
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  process.stdout.write(`${nextVersion}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
