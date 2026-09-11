import type { Plugin } from "@opencode-ai/plugin/effect";
import { Effect, type Schema } from "effect";
import { DurmemoRpc } from "opencode-durmemo/rpc";
import {
  describeInput,
  DurmemoUnavailable,
  GOAL_APPLIED_KEY,
  GOAL_DESCRIPTION_KEY,
  GOAL_PLUGIN_ID,
  GOAL_STATUS_KEY,
  GOAL_TOPIC,
  unknownMessage,
  type GoalError,
  type GoalSnapshot,
} from "../goal.ts";

type Context = Parameters<Parameters<typeof Plugin.define>[0]["effect"]>[0];

export const durmemoClient = (ctx: Context) => ctx.rpc(DurmemoRpc);

export type DurmemoClient = ReturnType<typeof durmemoClient>;

const toGoalError = (error: unknown): GoalError =>
  new DurmemoUnavailable({ message: unknownMessage(error) });

export interface GoalTag {
  readonly inputs: ReadonlyArray<Schema.Json>;
}

export const listGoalTag = (
  client: DurmemoClient,
  sessionID: string,
): Effect.Effect<GoalTag | null, GoalError> =>
  client["topics.list"]({ sessionID, includeUndiscoverable: true }).pipe(
    Effect.map(({ topics }) => {
      const tag = topics.find((t) => t.name === GOAL_TOPIC);
      if (tag === undefined) return null;
      return { inputs: tag.inputs ?? [] };
    }),
    Effect.mapError(toGoalError),
  );

export const readGoalValue = (
  client: DurmemoClient,
  sessionID: string,
  key: string,
): Effect.Effect<Schema.Json | undefined, GoalError> =>
  client["keys.readExact"]({ topic: GOAL_TOPIC, key, scope: "session", owner: sessionID }).pipe(
    Effect.map(({ found, entry }) => (found && entry !== undefined ? entry.value : undefined)),
    Effect.mapError(toGoalError),
  );

export const writeGoalValue = (
  client: DurmemoClient,
  sessionID: string,
  key: string,
  value: Schema.Json,
  schema?: Schema.Json,
): Effect.Effect<void, GoalError> =>
  client["keys.upsert"]({
    topic: GOAL_TOPIC,
    key,
    scope: "session",
    owner: sessionID,
    value,
    ...(schema === undefined ? {} : { schema }),
    pluginId: GOAL_PLUGIN_ID,
  }).pipe(Effect.asVoid, Effect.mapError(toGoalError));

export const removeGoalValue = (
  client: DurmemoClient,
  sessionID: string,
  key: string,
): Effect.Effect<void, GoalError> =>
  client["keys.remove"]({
    topic: GOAL_TOPIC,
    key,
    scope: "session",
    owner: sessionID,
    pluginId: GOAL_PLUGIN_ID,
  }).pipe(Effect.asVoid, Effect.mapError(toGoalError));

export const ensureGoalTag = (
  client: DurmemoClient,
  sessionID: string,
): Effect.Effect<void, GoalError> =>
  client["topics.tag"]({ sessionID, topic: GOAL_TOPIC }).pipe(
    Effect.asVoid,
    Effect.mapError(toGoalError),
  );

export const readGoalSnapshot = (
  client: DurmemoClient,
  sessionID: string,
): Effect.Effect<GoalSnapshot, GoalError> =>
  Effect.all(
    {
      description: readGoalValue(client, sessionID, GOAL_DESCRIPTION_KEY),
      status: readGoalValue(client, sessionID, GOAL_STATUS_KEY),
      applied: readGoalValue(client, sessionID, GOAL_APPLIED_KEY),
    },
    { concurrency: 3 },
  ).pipe(
    Effect.map(({ description, status, applied }) => ({
      description: description === undefined ? null : describeInput(description),
      status: status === "paused" ? ("paused" as const) : ("ongoing" as const),
      applied: applied !== undefined && Array.isArray(applied) ? [...applied] : null,
    })),
  );
