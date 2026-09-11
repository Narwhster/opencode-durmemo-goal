import { Plugin } from "@opencode-ai/plugin/effect";
import { Effect } from "effect";
import { GOAL_PLUGIN_ID } from "./goal.ts";
import { registerGoalHooks } from "./plugin/hooks.ts";
import { registerGoalTools } from "./plugin/tools.ts";

export default Plugin.define({
  id: GOAL_PLUGIN_ID,
  effect: (ctx) =>
    Effect.gen(function* () {
      yield* registerGoalHooks(ctx);
      yield* registerGoalTools(ctx);
    }),
});
