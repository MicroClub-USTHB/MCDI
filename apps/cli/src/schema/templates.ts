export type SchemaTemplate = 'minimal' | 'recruitment';

export const minimalSchema = {
  version: 1,
  steps: [{ key: 'default', fields: [{ key: 'example', type: 'string', required: true, maxLength: 80 }] }],
};

// UNVERIFIED PLACEHOLDER: MCDI PRD §6.5's worked example is unavailable here.
// Replace this with that example before claiming parity with the PRD.
export const templates: Record<Exclude<SchemaTemplate, 'minimal'>, unknown> = {
  recruitment: {
    version: 1,
    steps: [
      {
        key: 'applicant', title: 'Applicant information', fields: [
          { key: 'full_name', type: 'string', required: true, label: 'Full name', maxLength: 120 },
          { key: 'email', type: 'email', required: true, label: 'Email address' },
          { key: 'motivation', type: 'text', required: true, label: 'Why do you want to join?', maxLength: 2000 },
          { key: 'cv', type: 'file', required: false, label: 'CV', maxSizeBytes: 5242880, accept: ['application/pdf'] },
        ],
      },
    ],
  },
};

export function getSchemaTemplate(name: string): unknown | undefined {
  return name === 'minimal' ? minimalSchema : templates[name as keyof typeof templates];
}
