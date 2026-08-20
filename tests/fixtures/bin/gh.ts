#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
if (args[0] !== "attestation" || args[1] !== "verify" || !args[2]) {
  process.exit(2);
}
const bundleIndex = args.indexOf("--bundle");
const sourceRefIndex = args.indexOf("--source-ref");
const bundle = bundleIndex >= 0 ? args[bundleIndex + 1] : undefined;
const sourceRef = sourceRefIndex >= 0 ? args[sourceRefIndex + 1] : undefined;
if (
  !existsSync(args[2]) ||
  !bundle ||
  !existsSync(bundle) ||
  readFileSync(bundle, "utf-8").trim() !== "aidlc-test-release-provenance" ||
  !sourceRef?.startsWith("refs/tags/v")
) {
  process.exit(1);
}
