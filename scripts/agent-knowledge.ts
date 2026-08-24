// Compatibility shim for build-time imports. The implementation ships with
// every harness so plugin authors and the repository packager use one source.
export {
  absorbReviewerKnowledge,
  agentNameFromPath,
  reviewerAgentSet,
} from "../core/tools/aidlc-plugin-author.ts";
