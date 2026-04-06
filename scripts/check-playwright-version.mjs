import fs from "node:fs/promises";

const [auditEnginePackageRaw, workerDockerfileRaw] = await Promise.all([
  fs.readFile(new URL("../packages/audit-engine/package.json", import.meta.url), "utf8"),
  fs.readFile(new URL("../Dockerfile.worker", import.meta.url), "utf8"),
]);

const auditEnginePackage = JSON.parse(auditEnginePackageRaw);
const packageVersion = auditEnginePackage.dependencies?.playwright;

if (typeof packageVersion !== "string") {
  console.error("Missing playwright dependency in packages/audit-engine/package.json");
  process.exit(1);
}

const dockerMatch = workerDockerfileRaw.match(/mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-/);

if (!dockerMatch) {
  console.error("Could not find Playwright base image version in Dockerfile.worker");
  process.exit(1);
}

const dockerVersion = dockerMatch[1];

if (packageVersion !== dockerVersion) {
  console.error(
    [
      "Playwright version mismatch detected.",
      `package.json: ${packageVersion}`,
      `Dockerfile.worker image: ${dockerVersion}`,
      "Update both to the same exact version.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`Playwright versions match: ${packageVersion}`);
