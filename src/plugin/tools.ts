import type { Plugin } from "@opencode-ai/plugin/effect";
import { Error as ToolError } from "@opencode-ai/plugin/promise/tool";
import { Effect, Schema } from "effect";
import { type DurmemoClient } from "opencode-durmemo/rpc";
import {
  GOAL_APPLIED_KEY,
  GOAL_DESCRIPTION_KEY,
  GOAL_STATUS_KEY,
  GOAL_STATUS_SCHEMA,
  NoGoal,
  type GoalError,
} from "../goal.ts";
import {
  durmemoClient,
  ensureGoalTag,
  listGoalTag,
  readGoalSnapshot,
  removeGoalValue,
  writeGoalValue,
} from "./durmemo.ts";

type Context = Parameters<Parameters<typeof Plugin.define>[0]["effect"]>[0];

export const TOOL_NAMESPACE = "goal";
export const TOOL_SET = "set_goal";
export const TOOL_GET = "get_goal";
export const TOOL_PAUSE = "pause_goal";
export const TOOL_RESUME = "resume_goal";
export const TOOL_STOP = "stop_goal";

const SetGoalInput = Schema.Struct({ description: Schema.String });
const EmptyInput = Schema.Struct({});
const GoalOutput = Schema.Struct({ description: Schema.String, status: Schema.String });
const GetGoalOutput = Schema.Struct({
  description: Schema.NullOr(Schema.String),
  status: Schema.NullOr(Schema.String),
});
const StopGoalOutput = Schema.Struct({ removed: Schema.Boolean });

const toToolError = (error: GoalError): ToolError =>
  new ToolError({
    message: error.message,
    metadata: { code: error._tag === "NoGoal" ? "no_goal" : "durmemo_unavailable" },
  });

const setStatus = (
  client: DurmemoClient,
  sessionID: string,
  description: string,
  status: "ongoing" | "paused",
  verb: string,
) =>
  Effect.gen(function* () {
    yield* writeGoalValue(client, sessionID, GOAL_STATUS_KEY, status, GOAL_STATUS_SCHEMA);
    return {
      output: { description, status },
      content: `${verb} session goal: ${description}`,
    };
  });

export const registerGoalTools = (ctx: Context) => {
  const client = durmemoClient(ctx);
  return ctx.tool.transform((editor) => {
    editor.add({
      name: TOOL_SET,
      description: "Set the session goal description. Marks it ongoing.",
      input: SetGoalInput,
      output: GoalOutput,
      options: { namespace: TOOL_NAMESPACE },
      execute: (input, toolCtx) =>
        Effect.gen(function* () {
          yield* ensureGoalTag(client, toolCtx.sessionID);
          yield* writeGoalValue(client, toolCtx.sessionID, GOAL_DESCRIPTION_KEY, input.description);
          return yield* setStatus(client, toolCtx.sessionID, input.description, "ongoing", "Set");
        }).pipe(Effect.mapError(toToolError)),
    });
    editor.add({
      name: TOOL_GET,
      description: "Read the current session goal description and status.",
      input: EmptyInput,
      output: GetGoalOutput,
      options: { namespace: TOOL_NAMESPACE },
      execute: (_input, toolCtx) =>
        Effect.gen(function* () {
          const snapshot = yield* readGoalSnapshot(client, toolCtx.sessionID);
          const status = snapshot.description === null ? null : snapshot.status;
          return {
            output: { description: snapshot.description, status },
            content: JSON.stringify({ description: snapshot.description, status }),
          };
        }).pipe(Effect.mapError(toToolError)),
    });
    const requireDescription = (
      sessionID: string,
      verb: string,
    ): Effect.Effect<string, GoalError> =>
      Effect.gen(function* () {
        const snapshot = yield* readGoalSnapshot(client, sessionID);
        if (snapshot.description === null) {
          return yield* Effect.fail(new NoGoal({ message: `No session goal to ${verb}.` }));
        }
        return snapshot.description;
      });
    editor.add({
      name: TOOL_PAUSE,
      description: "Pause the current session goal.",
      input: EmptyInput,
      output: GoalOutput,
      options: { namespace: TOOL_NAMESPACE },
      execute: (_input, toolCtx) =>
        Effect.gen(function* () {
          const description = yield* requireDescription(toolCtx.sessionID, "pause");
          return yield* setStatus(client, toolCtx.sessionID, description, "paused", "Paused");
        }).pipe(Effect.mapError(toToolError)),
    });
    editor.add({
      name: TOOL_RESUME,
      description: "Resume the paused session goal.",
      input: EmptyInput,
      output: GoalOutput,
      options: { namespace: TOOL_NAMESPACE },
      execute: (_input, toolCtx) =>
        Effect.gen(function* () {
          const description = yield* requireDescription(toolCtx.sessionID, "resume");
          return yield* setStatus(client, toolCtx.sessionID, description, "ongoing", "Resumed");
        }).pipe(Effect.mapError(toToolError)),
    });
    editor.add({
      name: TOOL_STOP,
      description: "Stop and clear the current session goal.",
      input: EmptyInput,
      output: StopGoalOutput,
      options: { namespace: TOOL_NAMESPACE },
      execute: (_input, toolCtx) =>
        Effect.gen(function* () {
          const tag = yield* listGoalTag(client, toolCtx.sessionID);
          yield* removeGoalValue(client, toolCtx.sessionID, GOAL_DESCRIPTION_KEY);
          yield* removeGoalValue(client, toolCtx.sessionID, GOAL_STATUS_KEY);
          if (tag === null) {
            yield* removeGoalValue(client, toolCtx.sessionID, GOAL_APPLIED_KEY);
          } else {
            yield* writeGoalValue(client, toolCtx.sessionID, GOAL_APPLIED_KEY, [...tag.inputs]);
          }
          return { output: { removed: true }, content: "Stopped session goal." };
        }).pipe(Effect.mapError(toToolError)),
    });
  });
};
