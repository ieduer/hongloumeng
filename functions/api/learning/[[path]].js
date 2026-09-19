import { handleLearningEvidenceRequest } from '../../_shared/learning-evidence-proxy.js';
import manifest from '../../_shared/learning-manifest.js';
export function onRequest(context) {
  const env = { ...context.env, ASSETS: { fetch: async () => Response.json(manifest) } };
  return handleLearningEvidenceRequest(context.request, env, new URL(context.request.url).pathname);
}
