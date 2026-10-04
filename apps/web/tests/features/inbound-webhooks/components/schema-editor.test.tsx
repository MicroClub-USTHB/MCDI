import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SchemaEditor } from '@/features/inbound-webhooks/components/schema-editor';

const doc = (field: Record<string, unknown>) =>
  JSON.stringify({ version: 1, steps: [{ key: 's', fields: [field] }] }, null, 2);

describe('SchemaEditor', () => {
  it('shows the document in the editor', () => {
    render(
      <SchemaEditor value={doc({ key: 'a', type: 'string', required: true })} onChange={() => {}} />
    );

    expect(screen.getByLabelText('Schema JSON')).toHaveTextContent('"type": "string"');
    expect(screen.getByText('No problems found.')).toBeInTheDocument();
  });

  it('lists an unknown property with its line and a suggestion', () => {
    render(
      <SchemaEditor
        value={doc({ key: 'a', type: 'string', required: true, maxLenght: 5 })}
        onChange={() => {}}
      />
    );

    expect(screen.getByText(/"maxLenght" is not a property of a string field/)).toBeInTheDocument();
    expect(screen.getByText(/Did you mean "maxLength"/)).toBeInTheDocument();
    expect(screen.getByText(/^Line \d+$/)).toBeInTheDocument();
    expect(screen.getByText('1 error, 0 warnings')).toBeInTheDocument();
  });

  it('places the API’s problems in the text by their path', () => {
    render(
      <SchemaEditor
        value={doc({ key: 'a', type: 'array', required: true })}
        serverProblems={[
          {
            path: 'steps[0].fields[0]',
            code: 'MISSING_MAX_ITEMS',
            message: 'array needs maxItems',
          },
        ]}
        onChange={() => {}}
      />
    );

    expect(screen.getByText('array needs maxItems')).toBeInTheDocument();
    expect(screen.getByText('1 error, 0 warnings')).toBeInTheDocument();
  });

  it('warns about a required file field without calling it an error', () => {
    render(
      <SchemaEditor value={doc({ key: 'cv', type: 'file', required: true })} onChange={() => {}} />
    );

    expect(screen.getByText('0 errors, 1 warning')).toBeInTheDocument();
  });

  it('follows a new value from outside, as when a template is picked', () => {
    const { rerender } = render(
      <SchemaEditor value={doc({ key: 'a', type: 'string', required: true })} onChange={() => {}} />
    );

    rerender(
      <SchemaEditor
        value={doc({ key: 'b', type: 'boolean', required: true })}
        onChange={() => {}}
      />
    );

    expect(screen.getByLabelText('Schema JSON')).toHaveTextContent('"type": "boolean"');
  });
});
