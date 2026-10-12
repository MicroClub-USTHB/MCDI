# Writing a backend schema

An MCDI Inbound Webhook is a backend you don't have to code. Instead of writing a
server, a database table and validation logic for a form, you write one JSON
file, the **schema**, and MCDI does the rest. This page shows how that file is
built, piece by piece, and what each piece adds to the backend.

## What the schema gives a project

From the schema alone, MCDI:

- **checks every submission** against it, and refuses bad data with a precise
  error per field (HTTP 422), so the project never stores a malformed entry;
- **shapes the stored data**: a submission is stored with exactly the steps and
  fields the schema declares, with defaults filled in and conditional fields
  dropped when they don't apply;
- **bounds every input**: lengths, counts and sizes are capped, so a submission
  can't be arbitrarily large;
- **documents the backend**: the integration guide (Markdown) and the OpenAPI
  spec that MCDI generates for a webhook come straight from the schema, using its
  `title`, `label` and `description` texts.

mcdi-cli's part is to help you write that file and catch mistakes before MCDI
sees it:

```bash
mcdi-cli schema init form.json            # start from a template
mcdi-cli schema validate form.json        # offline pre-check, no network call
mcdi-cli webhook create form.json --name "Club signup" \
  --project $PROJECT_ID --roles $ROLE_ID --profile prod   # MCDI checks it again and goes live
```

`--roles` takes at least one Discord role id: the roles allowed to read the
submissions. `--project` is optional: without it, mcdi-cli asks you to pick a
project. To change a live backend later, edit the file and run
`mcdi-cli webhook update <id> --schema form.json --profile prod`.

## Build a schema, step by step

The running example is a sign-up form for the club. Each stage adds to the
file; every stage below passes `mcdi-cli schema validate`.

### 1. The skeleton

```json
{
  "version": 1,
  "steps": [
    {
      "key": "identity",
      "fields": [
        { "key": "firstname", "type": "string", "required": true }
      ]
    }
  ]
}
```

- `version` is always `1`.
- `steps` splits the form into parts. Each step has a `key` and its `fields`.
- Each field has a `key` (its name in the data), a `type`, and `required`, which
  must always be written out as `true` or `false`.

**What it adds:** the backend now accepts submissions shaped like this, and
refuses one without a first name:

```json
{ "identity": { "firstname": "Amina" } }
```

```json
{ "path": "identity.firstname", "code": "REQUIRED", "message": "Field is required" }
```

Keys start with a letter or `_` and use letters, digits and `_` only
(`firstname`, `github_url`), at most 64 characters, unique within their step.

### 2. Limits and a second field

```json
{
  "key": "identity",
  "title": "Who are you?",
  "fields": [
    { "key": "firstname", "type": "string", "required": true, "label": "First name", "maxLength": 80, "trim": true },
    { "key": "email", "type": "email", "required": true }
  ]
}
```

- `maxLength` caps the text; `trim` strips surrounding spaces before checking.
- `type: "email"` makes MCDI check the address format.
- `title` and `label` are human-friendly names. They change nothing in the
  data; they appear in the integration docs MCDI generates.

**What it adds:** a name over 80 characters gives
`TOO_LONG` ("Must be at most 80 characters"), and a bad address gives
`INVALID_EMAIL` ("Not a valid email address").

### 3. A fixed list of choices

```json
{
  "key": "status",
  "type": "enum",
  "required": true,
  "options": [
    { "value": "student", "label": "Student" },
    { "value": "professional", "label": "Professional" }
  ]
}
```

- `enum` accepts exactly one of the `options`. The submission sends the
  `value`; the `label` is for the docs.

**What it adds:** `"status": "student"` is accepted; `"status": "alien"` gives
`NOT_AN_OPTION` ("\"alien\" is not one of the accepted values").

### 4. A second step, shown only to students

```json
{
  "key": "background",
  "title": "Your background",
  "fields": [
    {
      "key": "university",
      "type": "string",
      "required": true,
      "maxLength": 120,
      "condition": { "op": "eq", "field": "identity.status", "value": "student" }
    }
  ]
}
```

- A `condition` makes a field apply only when something earlier in the form
  holds. Here `identity.status` (step `identity`, field `status`) must equal
  `student`.

**What it adds:** a student must give a university. For a professional the
field doesn't apply: it isn't required, and if one is sent anyway MCDI drops it
and doesn't store it. The logic lives in the backend, not in each project's
code.

```json
{ "identity": { "firstname": "Yacine", "email": "y@example.com", "status": "professional" }, "background": {} }
```

### 5. Several choices, and a default

```json
{
  "key": "skills",
  "type": "multi_enum",
  "required": true,
  "maxSelected": 3,
  "options": [
    { "value": "web", "label": "Web" },
    { "value": "mobile", "label": "Mobile" },
    { "value": "ai", "label": "AI" },
    { "value": "design", "label": "Design" }
  ]
},
{ "key": "wantsMentor", "type": "boolean", "required": false, "default": false }
```

- `multi_enum` accepts several options as a list: `"skills": ["web", "ai"]`.
  `maxSelected` caps how many.
- `default` is the value used when none is sent.

**What it adds:** four skills give `TOO_MANY_SELECTED` ("Select at most 3").
A submission without `wantsMentor` is stored with `"wantsMentor": false`, so
every stored entry has the field.

### 6. A repeated group

```json
{
  "key": "projects",
  "type": "array",
  "required": false,
  "maxItems": 3,
  "item": {
    "key": "project",
    "type": "object",
    "required": true,
    "fields": [
      { "key": "name", "type": "string", "required": true, "maxLength": 80 },
      { "key": "url", "type": "url", "required": false, "allowedSchemes": ["https"] }
    ]
  }
}
```

- `object` groups fields; `array` repeats one `item`. An array **must** have
  `maxItems`, so a submission can't hold an unbounded list.
- `allowedSchemes: ["https"]` refuses `http://` links.

**What it adds:** up to three projects, each with a name and an optional link:

```json
"projects": [
  { "name": "mcdi-cli", "url": "https://github.com/MicroClub-USTHB/mcdi-cli" },
  { "name": "Club site" }
]
```

A fourth gives `TOO_MANY_ITEMS` ("At most 3 items are allowed"); an `http://`
link gives `SCHEME_NOT_ALLOWED`. Errors inside a list point at the entry, as in
`background.projects[0].url`.

### The finished file

```json
{
  "version": 1,
  "steps": [
    {
      "key": "identity",
      "title": "Who are you?",
      "fields": [
        { "key": "firstname", "type": "string", "required": true, "label": "First name", "maxLength": 80, "trim": true },
        { "key": "email", "type": "email", "required": true },
        {
          "key": "status",
          "type": "enum",
          "required": true,
          "options": [
            { "value": "student", "label": "Student" },
            { "value": "professional", "label": "Professional" }
          ]
        }
      ]
    },
    {
      "key": "background",
      "title": "Your background",
      "fields": [
        {
          "key": "university",
          "type": "string",
          "required": true,
          "maxLength": 120,
          "condition": { "op": "eq", "field": "identity.status", "value": "student" }
        },
        {
          "key": "skills",
          "type": "multi_enum",
          "required": true,
          "maxSelected": 3,
          "options": [
            { "value": "web", "label": "Web" },
            { "value": "mobile", "label": "Mobile" },
            { "value": "ai", "label": "AI" },
            { "value": "design", "label": "Design" }
          ]
        },
        {
          "key": "projects",
          "type": "array",
          "required": false,
          "maxItems": 3,
          "item": {
            "key": "project",
            "type": "object",
            "required": true,
            "fields": [
              { "key": "name", "type": "string", "required": true, "maxLength": 80 },
              { "key": "url", "type": "url", "required": false, "allowedSchemes": ["https"] }
            ]
          }
        },
        { "key": "wantsMentor", "type": "boolean", "required": false, "default": false }
      ]
    }
  ]
}
```

And a submission it accepts:

```json
{
  "identity": { "firstname": "Amina", "email": "amina@usthb.dz", "status": "student" },
  "background": {
    "university": "USTHB",
    "skills": ["web", "ai"],
    "projects": [{ "name": "mcdi-cli", "url": "https://github.com/MicroClub-USTHB/mcdi-cli" }]
  }
}
```

MCDI stores it with `"wantsMentor": false` added. A key the schema doesn't
declare is refused with `UNKNOWN_FIELD` (or `UNKNOWN_STEP` at the top level),
unless the webhook was set to allow unknown fields.

## Reference

### Field types

Every field can have `key`, `type`, `required` (all three mandatory), `label`,
`description`, `condition` and `default`. Anything else must belong to its
type, or the pre-check reports `UNKNOWN_PROPERTY`, which catches typos like
`maxlength`.

| Type | Value sent | Type-specific properties |
|---|---|---|
| `string` | short text | `minLength`, `maxLength`, `pattern` (regular expression, at most 200 characters), `trim` |
| `text` | long text | `maxLength` |
| `number` | number | `min`, `max`, `integer` (`true` for whole numbers only) |
| `boolean` | `true` / `false` | none |
| `email` | email address | `allowedDomains` (non-empty list, e.g. `["usthb.dz"]`) |
| `url` | web address | `allowedSchemes` (`"http"` and/or `"https"`) |
| `phone` | phone number | `region` (country code) |
| `date` | `YYYY-MM-DD` | `min`, `max` (same format) |
| `datetime` | ISO 8601 with a timezone, e.g. `2026-01-31T09:00:00Z` | `min`, `max` (same format) |
| `enum` | one option's `value` | `options` (**required**) |
| `multi_enum` | a list of option values | `options` (**required**), `minSelected`, `maxSelected` |
| `object` | a group of fields | `fields` (**required**) |
| `array` | a list of entries | `item` (**required**), `maxItems` (**required**), `minItems` |
| `file` | one file | `accept` (**required**, MIME types), `maxSizeBytes` (**required**) |
| `files` | several files | `accept`, `maxSizeBytes` (per file) and `maxCount` (all **required**), `minCount` |
| `json` | free-form JSON | `maxBytes` (**required**) |

A minimum can't exceed its maximum (`INVALID_RANGE`).

> **Files aren't usable yet.** MCDI accepts `file` and `files` fields in a
> schema, but has no upload endpoint yet (MCDI issue #136), so a webhook with a
> **required** file field can't receive any submission. Make file fields
> optional, or leave them out, until uploads ship.

### Conditions

| `op` | Holds when the field... | Needs |
|---|---|---|
| `eq` / `ne` | equals / doesn't equal `value` | `field`, `value` |
| `gt` / `lt` / `gte` / `lte` | compares to `value` | `field`, `value` |
| `in` | is one of the values in `value` | `field`, `value` (a list) |
| `contains` | contains `value` | `field`, `value` |
| `exists` | has been given a value | `field` |
| `and` / `or` | all / any of the conditions in `of` hold | `of` (a list of conditions) |
| `not` | the condition in `of` doesn't hold | `of` (one condition) |

`field` is the path of a field declared **earlier**: `step.field`, or
`step.object.field` inside an object. A whole step can have a `condition` too.

Inside an array item, a path starting with `./` reads a field of the **same
entry**, declared earlier in the item. Here each project asks for a `url` only
when it is open source:

```json
"fields": [
  { "key": "openSource", "type": "boolean", "required": true },
  {
    "key": "url",
    "type": "url",
    "required": true,
    "condition": { "op": "eq", "field": "./openSource", "value": true }
  }
]
```

### Limits

| Limit | Value | Pre-check error |
|---|---|---|
| Steps | 20 | `TOO_MANY_STEPS` |
| Fields in the whole schema, nested ones included | 200 | `TOO_MANY_NODES` |
| Nesting of objects, arrays and conditions | 5 levels | `TOO_DEEP`, `CONDITION_TOO_DEEP` |
| Key length | 64 characters | `KEY_TOO_LONG` |
| `pattern` length | 200 characters | `PATTERN_TOO_LONG` |
| Submission size (on MCDI) | 512 KB | |

### Pre-check errors

`mcdi-cli schema validate` lists every problem at once, then exits with code 1:

```
✗ 2 validation errors (source: local)
  steps[0].fields[1].required  MISSING_REQUIRED_FLAG  `required` must be a boolean
  steps[1].fields[0].condition.field  FORWARD_REFERENCE  Condition references "identity.status", which is not declared in an earlier step
```

`steps[0].fields[1]` is the second field of the first step.

| Code | Fix |
|---|---|
| `MISSING_REQUIRED_FLAG` | Write `"required": true` or `false` on the field. |
| `UNKNOWN_PROPERTY` | Remove or correct the property; it doesn't exist for this type. |
| `INVALID_CONSTRAINT` | Give the property the right kind of value, e.g. `80`, not `"80"`. |
| `INVALID_RANGE` | Make the minimum no greater than the maximum. |
| `UNKNOWN_TYPE` | Use one of the 16 types above. |
| `INVALID_KEY`, `KEY_TOO_LONG`, `DUPLICATE_KEY` | Rename the key: letters, digits and `_`, at most 64, unique. |
| `NO_OPTIONS`, `INVALID_OPTION`, `DUPLICATE_OPTION` | Give `options`, each with a unique string `value`. |
| `MISSING_ITEM`, `MISSING_MAX_ITEMS` | Give the `array` its `item` and `maxItems`. |
| `NO_ACCEPT`, `MISSING_MAX_SIZE`, `MISSING_MAX_COUNT` | Give the `file`/`files` field `accept`, `maxSizeBytes` and (for `files`) `maxCount`. |
| `MISSING_MAX_BYTES` | Give the `json` field `maxBytes`. |
| `NO_STEPS`, `NO_FIELDS` | Add at least one step, and at least one field to each step and object. |
| `FORWARD_REFERENCE` | Point the condition at a field declared earlier, with its full path. |
| `UNRESOLVABLE_REFERENCE` | A full path can't reach into an array item; from inside the item, use `./field`. |
| `RELATIVE_REFERENCE_OUTSIDE_ITEM` | Use `./` only on a field inside an array of objects. |
| `UNKNOWN_OPERATOR`, `INVALID_CONDITION`, `MISSING_VALUE`, `INVALID_VALUE` | Fix the condition: a known `op`, a `field`, a `value` (a list for `in`). |
| `INVALID_PATTERN`, `PATTERN_TOO_LONG` | Fix the regular expression, or shorten it under 200 characters. |
| `UNSUPPORTED_VERSION`, `NOT_AN_OBJECT` | Use `"version": 1`, and objects where objects are expected. |
| `TOO_MANY_STEPS`, `TOO_MANY_NODES`, `TOO_DEEP`, `CONDITION_TOO_DEEP` | Split or flatten the schema to fit the limits. |

House rules your team adds report their own ids on top of these; see
[`custom-rules.md`](custom-rules.md).

### Templates

`mcdi-cli schema init [path] --template <name>` writes one of the templates the
admin panel's schema editor offers (`packages/contracts`): `blank` (the
default, one step with one field), `recruitment`, `workshop`, `event` and
`project-event`.

## Where the rules come from

The pre-check runs `@mcdi/form-schema`, the validator MCDI itself runs when a
webhook is created or updated, so a schema that passes `mcdi-cli schema
validate` (without custom rules) passes MCDI's schema check too. MCDI's own
reference for the schema language is
`apps/web/src/content/docs/integrate/inbound-webhooks/schemas.mdx`.
