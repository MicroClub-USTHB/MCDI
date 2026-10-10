export type SchemaTemplate = 'minimal' | 'recruitment';

export const minimalSchema = {
  version: 1,
  steps: [{ key: 'default', fields: [{ key: 'example', type: 'string', required: true, maxLength: 80 }] }],
};

export const templates: Record<Exclude<SchemaTemplate, 'minimal'>, unknown> = {
  recruitment: {
    version: 1,
    steps: [
      {
        key: 'identity', title: 'Who are you?', fields: [
          { key: 'firstname', type: 'string', required: true, maxLength: 80, trim: true },
          { key: 'name', type: 'string', required: true, maxLength: 80, trim: true },
          { key: 'email', type: 'email', required: true },
          { key: 'status', type: 'enum', required: true, options: [{ value: 'student' }, { value: 'professional' }] },
        ],
      },
      {
        key: 'background', fields: [
          { key: 'university', type: 'string', required: true, condition: { op: 'eq', field: 'identity.status', value: 'student' } },
          { key: 'experience', type: 'array', required: false, maxItems: 10, item: {
            key: 'entry', type: 'object', required: true, fields: [
              { key: 'company', type: 'string', required: true },
              { key: 'years', type: 'number', required: true, min: 0, max: 60 },
            ],
          } },
        ],
      },
      {
        key: 'documents', fields: [
          { key: 'cv', type: 'file', required: true, accept: ['application/pdf'], maxSizeBytes: 5242880 },
          { key: 'portfolio', type: 'files', required: false, accept: ['image/png', 'image/jpeg'], maxSizeBytes: 2097152, maxCount: 5 },
        ],
      },
    ],
  },
};

export function getSchemaTemplate(name: string): unknown | undefined {
  return name === 'minimal' ? minimalSchema : templates[name as keyof typeof templates];
}
