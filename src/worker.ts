import { handle } from '@astrojs/cloudflare/handler';
import type { Env } from './lib/types';
import { runJobs } from './lib/server/jobs';
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return handle(request, env, ctx);
  },
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runJobs(env));
  },
};
