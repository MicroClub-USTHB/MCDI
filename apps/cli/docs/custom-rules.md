# Custom validation rules

House rules a team adds on top of MCDI's own schema checks — e.g. "every field
needs a `label`", "field keys must be `snake_case`". They run as part of the
local pre-check in `mcdi-cli schema validate`, `mcdi-cli webhook create`, and
`mcdi-cli webhook update --schema`, so a schema that breaks a house rule is
stopped before anything is sent to MCDI.

Custom rules can only make the pre-check **stricter**: they add errors on top of
the built-in (MCDI Layer 1) checks and can never disable or relax one.

## Where rule files live

| Scope | Location |
|---|---|
| Project | the nearest `.mcdi-cli/rules/*.json`, looking from the current directory upwards (like `.git`) |
| Global | `~/.mcdi-cli/rules/*.json` |

Both are loaded, global first. A project rule with the same `id` as a global one
replaces it, so a project can tune a team-wide rule. Files are read in file-name
order; the same `id` twice in one directory is an error.

## File format

```json
{
  "rules": [
    {
      "id": "require-label",
      "type": "require-present",
      "appliesTo": "*",
      "field": "label",
      "message": "Every field must declare a human-readable label"
    },
    {
      "id": "snake-case-keys",
      "type": "key-pattern",
      "appliesTo": "*",
      "pattern": "^[a-z][a-z0-9_]*$",
      "message": "Field keys must be snake_case"
    },
    {
      "id": "max-text-length",
      "type": "max-value",
      "appliesTo": ["string", "text"],
      "field": "maxLength",
      "max": 2000,
      "message": "maxLength must not exceed 2000"
    },
    {
      "id": "no-angle-brackets",
      "type": "forbid-pattern",
      "appliesTo": ["string", "text"],
      "field": "default",
      "pattern": "[<>]",
      "message": "Field defaults must not contain '<' or '>'"
    }
  ]
}
```

Every rule has:

| Property | |
|---|---|
| `id` | 1-64 lowercase letters, digits, or dashes. Becomes the error code: `require-label` → `REQUIRE_LABEL`. |
| `type` | one of the four types below |
| `appliesTo` | `"*"`, or a non-empty list of field types (`string`, `text`, `number`, `boolean`, `email`, `url`, `phone`, `date`, `datetime`, `enum`, `multi_enum`, `object`, `array`, `file`, `files`, `json`) |
| `message` | shown when the rule fails |

## Rule types

| Type | Extra properties | Fails when |
|---|---|---|
| `require-present` | `field` | the field property is missing, `null`, blank, or an empty list |
| `key-pattern` | `pattern` | the field's `key` doesn't match `pattern` |
| `max-value` | `field`, `max` | the property is a number greater than `max` (a missing property passes; pair with `require-present` if it must exist) |
| `forbid-pattern` | `field`, `pattern` | the property (a string, or any string in a list) matches `pattern` |

Rules apply to every field whose type matches `appliesTo`, including fields
nested in `object` fields and `array` items.

## Errors

Rule failures use the same `path` / `code` / `message` layout as the built-in
checks, tagged `source: local`:

```
✗ 2 validation errors (source: local)
  steps[0].fields[0].key  SNAKE_CASE_KEYS  Field keys must be snake_case
  steps[0].fields[1].label  REQUIRE_LABEL  Every field must declare a human-readable label
```

A broken rule file stops the pre-check (exit `1`) and names the file and rule —
it is never silently skipped:

```
✗ Could not load custom rules (source: local)
  /repo/.mcdi-cli/rules/team.json  INVALID_RULE  rules[0] ("require-label"): "type" must be one of forbid-pattern, require-present, max-value, key-pattern
```

## Safety

- Rule files are parsed as JSON and checked against this closed set of types and
  properties; nothing in them is executed, and unknown properties are rejected.
- `pattern` is limited to 200 characters and must compile, the same limits MCDI
  puts on schema patterns.
- Each pattern test runs under a 100 ms budget. A pattern that backtracks
  catastrophically (e.g. `(a+)+$`) fails with an error naming the rule instead of
  hanging the CLI.
