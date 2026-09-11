# opencode-goal

One goal per OpenCode session, kept in [durmemo](https://github.com/narwhster/durmemo). The goal is injected into the session context so the agent keeps chasing it.

Needs `opencode-durmemo` installed alongside it.

## Install

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-durmemo", "opencode-goal"]
}
```

Order matters. List durmemo first.

## Use as a human

Set the goal from the prompt with a tag:

```
#goal[Ship the login page]
```

You can also pass a status: `#goal[Ship the login page, paused]`.

Or tell the agent to use the tools below.

## Use as an agent

Five tools under the `goal` namespace:

- `goal_set_goal` sets the description. Marks it ongoing.
- `goal_get_goal` reads the description and status.
- `goal_pause_goal` pauses it. The context line tells you not to chase it until resumed.
- `goal_resume_goal` marks it ongoing again.
- `goal_stop_goal` clears it.

The goal is stored per session under the `goal` topic, so normal durmemo tagging rules apply. `goal_set_goal` tags the topic for you.
