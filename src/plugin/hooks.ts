import type { Plugin } from "@opencode-ai/plugin/effect";
import { Effect } from "effect";
import {
  GOAL_APPLIED_KEY,
  GOAL_DESCRIPTION_KEY,
  GOAL_STATUS_KEY,
  GOAL_STATUS_SCHEMA,
  goalSystemLine,
  resolveTagApply,
} from "../goal.ts";
import { durmemoClient, listGoalTag, readGoalSnapshot, writeGoalValue } from "./durmemo.ts";

type Context = Parameters<Parameters<typeof Plugin.define>[0]["effect"]>[0];

export const registerGoalHooks = (ctx: Context) => {
  const client = durmemoClient(ctx);
  return ctx.session.hook("context", (event) =>
    Effect.gen(function* () {
      const sessionID = event.sessionID;
      const tag = yield* listGoalTag(client, sessionID);
      const snapshot = yield* readGoalSnapshot(client, sessionID);
      const decision = resolveTagApply({
        tagInputs: tag === null ? null : tag.inputs,
        applied: snapshot.applied,
      });
      let description = snapshot.description;
      let status = snapshot.status;
      if (decision.kind === "apply") {
        yield* writeGoalValue(client, sessionID, GOAL_DESCRIPTION_KEY, decision.description);
        yield* writeGoalValue(
          client,
          sessionID,
          GOAL_STATUS_KEY,
          decision.status,
          GOAL_STATUS_SCHEMA,
        );
        yield* writeGoalValue(
          client,
          sessionID,
          GOAL_APPLIED_KEY,
          tag === null ? [] : [...tag.inputs],
        );
        description = decision.description;
        status = decision.status;
      }
      const line = goalSystemLine({
        description,
        status,
        showMissing: tag !== null && decision.kind === "missing",
      });
      if (line !== null) {
        event.system.push({ type: "text" as const, text: line });
      }
    }).pipe(Effect.orElseSucceed(() => undefined)),
  );
};
