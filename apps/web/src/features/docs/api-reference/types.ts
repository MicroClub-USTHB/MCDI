/** The parts of an OpenAPI 3 document the generator reads. Loose on purpose: the spec comes from Nest. */
export interface Schema {
  $ref?: string;
  type?: string;
  format?: string;
  description?: string;
  enum?: unknown[];
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  nullable?: boolean;
  additionalProperties?: boolean | Schema;
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  default?: unknown;
}

export interface Parameter {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: Schema;
}

export interface Operation {
  operationId: string;
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  parameters?: Parameter[];
  requestBody?: { required?: boolean; content?: Record<string, { schema?: Schema }> };
  responses?: Record<
    string,
    { description?: string; content?: Record<string, { schema?: Schema }> }
  >;
  security?: Record<string, string[]>[];
}

export interface OpenApiSpec {
  tags?: { name: string; description?: string }[];
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, Schema> };
}

export interface ApiPage {
  /** The Swagger group, as it is named in the API. */
  group: string;
  /** The file name below `src/content/docs/api-reference`, without `.mdx`. */
  slug: string;
  content: string;
}
