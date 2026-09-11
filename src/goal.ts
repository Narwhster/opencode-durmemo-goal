import { Data, type Schema } from "effect";

export const GOAL_PLUGIN_ID = "opencode-durmemo-goal";
export const GOAL_TOPIC = "goal";
export const GOAL_DESCRIPTION_KEY = "description";
export const GOAL_STATUS_KEY = "status";
export const GOAL_APPLIED_KEY = "applied";

export const GOAL_STATUS_SCHEMA = {
  type: "string",
  enum: ["ongoing", "paused"],
} as const;

export type GoalStatus = "ongoing" | "paused";

export class DurmemoUnavailable extends Data.TaggedError("DurmemoUnavailable")<{
  readonly message: string;
}> {}

export class NoGoal extends Data.TaggedError("NoGoal")<{
  readonly message: string;
}> {}

export type GoalError = DurmemoUnavailable | NoGoal;

export const unknownMessage = (error: unknown): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return String(error);
};

export interface GoalSnapshot {
  readonly description: string | null;
  readonly status: GoalStatus;
  readonly applied: ReadonlyArray<Schema.Json> | null;
}

export const describeInput = (value: Schema.Json): string =>
  typeof value === "string" ? value : (JSON.stringify(value) ?? "null");

export type TagApply =
  | { readonly kind: "apply"; readonly description: string; readonly status: GoalStatus }
  | { readonly kind: "missing" }
  | { readonly kind: "none" };

export const resolveTagApply = (args: {
  readonly tagInputs: ReadonlyArray<Schema.Json> | null;
  readonly applied: ReadonlyArray<Schema.Json> | null;
}): TagApply => {
  if (args.tagInputs === null) return { kind: "none" };
  if (args.applied !== null && JSON.stringify(args.tagInputs) === JSON.stringify(args.applied)) {
    return { kind: "none" };
  }
  if (args.tagInputs.length === 0) return { kind: "missing" };
  if (args.tagInputs.length > 2) return { kind: "missing" };
  const [first, second] = args.tagInputs;
  if (first === undefined) return { kind: "missing" };
  if (second !== undefined && second !== "ongoing" && second !== "paused") {
    return { kind: "missing" };
  }
  return {
    kind: "apply",
    description: describeInput(first),
    status: second ?? "ongoing",
  };
};

export const MISSING_GOAL_LINE =
  "the user added a goal but forgot to specify a description, ask them if it was a mistake and set the goal with the set_goal tool";

export const ongoingGoalLine = (description: string): string =>
  `the current goal is \`${description}\`. keep chasing it! You can change it with set_goal, pause it with pause_goal, resume with resume_goal, and stop it with stop_goal`;

export const pausedGoalLine = (description: string): string =>
  `the current goal is paused: \`${description}\`. do not chase it until it is resumed. You can resume it with resume_goal, change it with set_goal, or stop it with stop_goal`;

export const goalSystemLine = (args: {
  readonly description: string | null;
  readonly status: GoalStatus;
  readonly showMissing: boolean;
}): string | null => {
  if (args.description !== null) {
    return args.status === "paused"
      ? pausedGoalLine(args.description)
      : ongoingGoalLine(args.description);
  }
  if (args.showMissing) return MISSING_GOAL_LINE;
  return null;
};
