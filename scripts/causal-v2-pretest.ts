/** Offline audit of the preserved interrupted v2 comprehension ladder. No provider calls. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { auditV2PretestArtifact } from "../lib/research/causalResponseV2";

const canonicalArtifact = "results/causal-v2-pretest.json";
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const gitFile = (commit: string, path: string) => execFileSync("git", ["show", `${commit}:${path}`]);

function replay(path: string) {
  assert.equal(path, canonicalArtifact, "Only the canonical preserved artifact may be replayed");
  const bytes = readFileSync(path), artifact = JSON.parse(bytes.toString("utf8"));
  assert.equal(artifact.artifactVersion, "causal-v2-pretest-v1");
  execFileSync("git", ["cat-file", "-e", `${artifact.sourceCommit}^{commit}`]);
  const manifestBytes = gitFile(artifact.sourceCommit, artifact.manifestPath);
  assert.equal(artifact.manifestSha256, sha256(manifestBytes), "Artifact manifest SHA does not match its source commit");
  const protocol = JSON.parse(manifestBytes.toString("utf8"));
  const implementation = {
    runner: sha256(gitFile(artifact.sourceCommit, "scripts/causal-v2-pretest.ts")),
    library: sha256(gitFile(artifact.sourceCommit, "lib/research/causalResponseV2.ts")),
  };
  const audit = auditV2PretestArtifact(artifact, protocol);
  assert.deepEqual(audit.issues, []);
  assert.equal(audit.complete, false);
  assert.equal(audit.selectedModel, null);
  console.log(JSON.stringify({ artifact: path, artifactSha256: sha256(bytes), sourceCommit: artifact.sourceCommit,
    sourceManifestSha256: sha256(manifestBytes), sourceImplementationSha256: implementation, ...audit,
    inferenceCalls: 0, note: "Offline replay only; no provider endpoint is present in this script." }, null, 2));
}

const [mode, suppliedPath] = process.argv.slice(2);
if (mode === "replay") replay(suppliedPath ?? canonicalArtifact);
else throw new Error("The v2 ladder is sealed after interruption. Only `replay` is available; no further model calls are authorized.");
