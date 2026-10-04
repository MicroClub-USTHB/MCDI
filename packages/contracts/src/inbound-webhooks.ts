/**
 * What an inbound webhook's form schema may contain, as data.
 *
 * The admin schema editor suggests and checks names from here, and the API's
 * own tests assert this catalog matches the validator it enforces, so the
 * editor's hints can never drift from what the API accepts. The API remains
 * the source of truth: a name missing here only weakens a hint.
 */

export const INBOUND_FIELD_TYPES = [
  "string",
  "text",
  "number",
  "boolean",
  "email",
  "url",
  "phone",
  "date",
  "datetime",
  "enum",
  "multi_enum",
  "object",
  "array",
  "file",
  "files",
  "json",
] as const;

export type InboundFieldType = (typeof INBOUND_FIELD_TYPES)[number];

export interface InboundSchemaProperty {
  name: string;
  /** One line, shown next to the suggestion. */
  description: string;
}

export const INBOUND_FIELD_TYPE_DESCRIPTIONS: Record<InboundFieldType, string> =
  {
    string: "short text, with optional length, pattern and trimming",
    text: "long free text",
    number: "a number, optionally whole and within a range",
    boolean: "true or false",
    email: "a validated address, optionally limited to some domains",
    url: "a validated web address",
    phone: "a phone number",
    date: "a calendar date, YYYY-MM-DD",
    datetime: "an ISO 8601 date and time with a timezone",
    enum: "one value from a list of options",
    multi_enum: "several values from a list of options",
    object: "a group of fields",
    array: "a repeatable item, needs maxItems",
    file: "one uploaded file",
    files: "several uploaded files, needs maxCount",
    json: "any JSON value, needs maxBytes",
  };

/** Properties every field may carry, whatever its type. */
export const INBOUND_BASE_FIELD_PROPERTIES: InboundSchemaProperty[] = [
  { name: "key", description: "the name of this field in the payload" },
  { name: "type", description: "what kind of value this field holds" },
  { name: "required", description: "true if a value must be sent" },
  { name: "label", description: "human-friendly name, shown in the docs" },
  { name: "description", description: "help text, shown in the docs" },
  {
    name: "condition",
    description: "only ask for this field when the condition holds",
  },
  { name: "default", description: "value used when none is sent" },
];

/** Properties specific to one field type, on top of the base ones. */
export const INBOUND_FIELD_PROPERTIES: Record<
  InboundFieldType,
  InboundSchemaProperty[]
> = {
  string: [
    { name: "minLength", description: "fewest characters allowed" },
    { name: "maxLength", description: "most characters allowed" },
    { name: "pattern", description: "regular expression the value must match" },
    { name: "trim", description: "strip spaces around the value first" },
  ],
  text: [{ name: "maxLength", description: "most characters allowed" }],
  number: [
    { name: "min", description: "smallest value allowed" },
    { name: "max", description: "largest value allowed" },
    { name: "integer", description: "true to allow whole numbers only" },
  ],
  boolean: [],
  email: [
    {
      name: "allowedDomains",
      description: "list of domains the address must belong to",
    },
  ],
  url: [
    {
      name: "allowedSchemes",
      description: 'list of allowed schemes: "http", "https"',
    },
  ],
  phone: [{ name: "region", description: "country code the number is for" }],
  date: [
    { name: "min", description: "earliest date, YYYY-MM-DD" },
    { name: "max", description: "latest date, YYYY-MM-DD" },
  ],
  datetime: [
    { name: "min", description: "earliest moment, ISO 8601 with timezone" },
    { name: "max", description: "latest moment, ISO 8601 with timezone" },
  ],
  enum: [{ name: "options", description: "list of { value, label } choices" }],
  multi_enum: [
    { name: "options", description: "list of { value, label } choices" },
    { name: "minSelected", description: "fewest choices to select" },
    { name: "maxSelected", description: "most choices to select" },
  ],
  object: [{ name: "fields", description: "the fields of the group" }],
  array: [
    { name: "item", description: "the field repeated for each entry" },
    { name: "minItems", description: "fewest entries allowed" },
    { name: "maxItems", description: "most entries allowed (required)" },
  ],
  file: [
    { name: "accept", description: "list of allowed MIME types" },
    { name: "maxSizeBytes", description: "largest file size in bytes" },
  ],
  files: [
    { name: "accept", description: "list of allowed MIME types" },
    { name: "maxSizeBytes", description: "largest size of each file in bytes" },
    { name: "minCount", description: "fewest files allowed" },
    { name: "maxCount", description: "most files allowed (required)" },
  ],
  json: [{ name: "maxBytes", description: "largest size in bytes" }],
};

/** The top level of a schema. */
export const INBOUND_SCHEMA_PROPERTIES: InboundSchemaProperty[] = [
  { name: "version", description: "schema format version, currently 1" },
  { name: "steps", description: "the steps of the form, in order" },
];

export const INBOUND_STEP_PROPERTIES: InboundSchemaProperty[] = [
  { name: "key", description: "the name of this step in the payload" },
  { name: "fields", description: "the fields of this step" },
  { name: "title", description: "human-friendly name, shown in the docs" },
  { name: "description", description: "help text, shown in the docs" },
  {
    name: "condition",
    description: "skip this whole step unless the condition holds",
  },
];

export const INBOUND_OPTION_PROPERTIES: InboundSchemaProperty[] = [
  { name: "value", description: "the value sent in the payload" },
  { name: "label", description: "human-friendly name, shown in the docs" },
];

/** Operators of a condition, comparisons first, then the combinators. */
export const INBOUND_CONDITION_OPERATORS: {
  name: string;
  description: string;
}[] = [
  { name: "eq", description: "equals the value" },
  { name: "ne", description: "does not equal the value" },
  { name: "gt", description: "greater than the value" },
  { name: "lt", description: "less than the value" },
  { name: "gte", description: "greater than or equal to the value" },
  { name: "lte", description: "less than or equal to the value" },
  { name: "in", description: "is one of the values in a list" },
  { name: "contains", description: "contains the value" },
  { name: "exists", description: "has been given a value" },
  { name: "and", description: "all of the conditions in `of` hold" },
  { name: "or", description: "any of the conditions in `of` holds" },
  { name: "not", description: "the condition in `of` does not hold" },
];

export const INBOUND_CONDITION_PROPERTIES: InboundSchemaProperty[] = [
  { name: "op", description: "how to compare" },
  {
    name: "field",
    description:
      'path of the field to read, e.g. "identity.status", or "./role" for the same list entry',
  },
  { name: "value", description: "what to compare it with" },
  { name: "of", description: "the conditions combined by and / or / not" },
];

export interface InboundWebhookTemplate {
  id: string;
  label: string;
  description: string;
  /** A FormSchema; kept loose so contracts needs no dependency on the API. */
  schema: Record<string, unknown>;
}

export const INBOUND_WEBHOOK_TEMPLATES: InboundWebhookTemplate[] = [
  {
    id: "recruitment",
    label: "Recruitment",
    description:
      "Three steps: identity, a background that depends on the status, and motivation.",
    schema: {
      version: 1,
      steps: [
        {
          key: "identity",
          title: "Who are you?",
          fields: [
            {
              key: "firstname",
              type: "string",
              required: true,
              maxLength: 80,
              trim: true,
            },
            {
              key: "lastname",
              type: "string",
              required: true,
              maxLength: 80,
              trim: true,
            },
            { key: "email", type: "email", required: true },
            {
              key: "status",
              type: "enum",
              required: true,
              options: [
                { value: "student", label: "Student" },
                { value: "professional", label: "Professional" },
              ],
            },
          ],
        },
        {
          key: "background",
          title: "Your background",
          fields: [
            {
              key: "university",
              type: "string",
              required: true,
              maxLength: 120,
              condition: {
                op: "eq",
                field: "identity.status",
                value: "student",
              },
            },
            {
              key: "company",
              type: "string",
              required: true,
              maxLength: 120,
              condition: {
                op: "eq",
                field: "identity.status",
                value: "professional",
              },
            },
            {
              key: "experience",
              type: "array",
              required: false,
              maxItems: 5,
              item: {
                key: "entry",
                type: "object",
                required: true,
                fields: [
                  { key: "organisation", type: "string", required: true },
                  {
                    key: "years",
                    type: "number",
                    required: true,
                    integer: true,
                    min: 0,
                    max: 60,
                  },
                ],
              },
            },
          ],
        },
        {
          key: "motivation",
          title: "Why join?",
          fields: [
            { key: "why", type: "text", required: true, maxLength: 1500 },
            {
              key: "availability",
              type: "multi_enum",
              required: false,
              options: [
                { value: "weekdays", label: "Weekdays" },
                { value: "weekends", label: "Weekends" },
                { value: "evenings", label: "Evenings" },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "workshop",
    label: "Workshop sign-up",
    description:
      "One step: who is coming, their level and topics, and consent.",
    schema: {
      version: 1,
      steps: [
        {
          key: "participant",
          title: "Sign up",
          fields: [
            {
              key: "fullname",
              type: "string",
              required: true,
              maxLength: 120,
              trim: true,
            },
            { key: "email", type: "email", required: true },
            { key: "phone", type: "phone", required: false },
            {
              key: "level",
              type: "enum",
              required: true,
              options: [
                { value: "beginner", label: "Beginner" },
                { value: "intermediate", label: "Intermediate" },
                { value: "advanced", label: "Advanced" },
              ],
            },
            {
              key: "topics",
              type: "multi_enum",
              required: false,
              maxSelected: 3,
              options: [
                { value: "web", label: "Web" },
                { value: "mobile", label: "Mobile" },
                { value: "ai", label: "AI" },
                { value: "security", label: "Security" },
              ],
            },
            {
              key: "accessibility",
              type: "text",
              required: false,
              maxLength: 500,
            },
            { key: "consent", type: "boolean", required: true },
          ],
        },
      ],
    },
  },
  {
    id: "event",
    label: "Event registration",
    description:
      "Attendee details plus a list of guests, where a guest can be a member.",
    schema: {
      version: 1,
      steps: [
        {
          key: "attendee",
          title: "Attendee",
          fields: [
            {
              key: "name",
              type: "string",
              required: true,
              maxLength: 120,
              trim: true,
            },
            { key: "email", type: "email", required: true },
            {
              key: "tickets",
              type: "number",
              required: true,
              integer: true,
              min: 1,
              max: 10,
            },
          ],
        },
        {
          key: "guests",
          title: "Guests",
          fields: [
            {
              key: "list",
              type: "array",
              required: false,
              maxItems: 9,
              item: {
                key: "guest",
                type: "object",
                required: true,
                fields: [
                  {
                    key: "name",
                    type: "string",
                    required: true,
                    maxLength: 120,
                  },
                  { key: "is_member", type: "boolean", required: true },
                  {
                    key: "member_id",
                    type: "string",
                    required: true,
                    maxLength: 40,
                    condition: { op: "eq", field: "./is_member", value: true },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  },
  {
    id: "blank",
    label: "Blank",
    description: "One step with one field, to start from.",
    schema: {
      version: 1,
      steps: [
        {
          key: "step1",
          title: "Step 1",
          fields: [{ key: "field1", type: "string", required: true }],
        },
      ],
    },
  },
];
