#!/usr/bin/env node
/**
 * Очищает data/submissions.json после meta.purge_after (GitHub Actions, hourly).
 */
import fs from "fs";

const FILE = "data/submissions.json";

function writeGithubOutput(changed) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) fs.appendFileSync(out, `changed=${changed ? "true" : "false"}\n`);
}

let raw;
try {
  raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch {
  console.log("submissions.json missing or invalid — skip");
  writeGithubOutput(false);
  process.exit(0);
}

const purgeAfter = raw?.meta?.purge_after;
if (!purgeAfter) {
  console.log("no purge_after — skip");
  writeGithubOutput(false);
  process.exit(0);
}

const deadline = new Date(purgeAfter).getTime();
if (!Number.isFinite(deadline)) {
  console.log("invalid purge_after — skip");
  writeGithubOutput(false);
  process.exit(0);
}

if (Date.now() < deadline) {
  console.log(`retention until ${purgeAfter} — skip`);
  writeGithubOutput(false);
  process.exit(0);
}

const next = {
  updated_at: new Date().toISOString(),
  submissions: {},
  meta: {
    purged_at: new Date().toISOString(),
    previous_all_submitted_at: raw.meta?.all_submitted_at || null,
    previous_purge_after: purgeAfter,
  },
};

fs.writeFileSync(FILE, `${JSON.stringify(next, null, 2)}\n`);
console.log("purged submissions.json after retention");
writeGithubOutput(true);
