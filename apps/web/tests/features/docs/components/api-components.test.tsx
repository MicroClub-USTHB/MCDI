import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  INBOUND_FIELD_PROPERTIES,
  INBOUND_FIELD_TYPES,
  INBOUND_WEBHOOK_TEMPLATES,
} from '@mcdi/contracts';

import { InboundContract } from '@/features/docs/components/inbound-contract';
import { Endpoint } from '@/features/docs/components/endpoint';
import { SwaggerLink } from '@/features/docs/components/swagger-link';
import { API_REFERENCE_HREF } from '@/features/docs/links';

describe('Endpoint', () => {
  it('shows the method and the path, as one readable line', () => {
    render(<Endpoint method="POST" path="/api/inbound-webhooks/{id}/submit" />);

    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('/api/inbound-webhooks/{id}/submit')).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'POST /api/inbound-webhooks/{id}/submit' })
    ).toBeInTheDocument();
  });

  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])('copes with %s', (method) => {
    render(<Endpoint method={method} path="/api/x" />);

    expect(screen.getByText(method)).toBeInTheDocument();
  });

  it('keeps a long path inside its box', () => {
    render(<Endpoint method="GET" path="/api/a/very/long/path/{id}/that/keeps/going" />);

    expect(screen.getByText('/api/a/very/long/path/{id}/that/keeps/going')).toHaveClass(
      'break-all'
    );
  });
});

describe('SwaggerLink', () => {
  it('opens the operation in Swagger, in a new tab', () => {
    render(<SwaggerLink tag="Members" operationId="MembersController_list" />);

    const link = screen.getByRole('link', { name: /Open in Swagger/ });
    expect(link).toHaveAttribute('href', `${API_REFERENCE_HREF}#/Members/MembersController_list`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('encodes a group name with spaces the way Swagger expects', () => {
    render(
      <SwaggerLink tag="Inbound Webhooks (Admin)" operationId="InboundWebhooksController_list" />
    );

    expect(screen.getByRole('link', { name: /Open in Swagger/ })).toHaveAttribute(
      'href',
      `${API_REFERENCE_HREF}#/Inbound%20Webhooks%20(Admin)/InboundWebhooksController_list`
    );
  });
});

describe('InboundContract', () => {
  it('lists every field type of the contracts, with its description', () => {
    render(<InboundContract name="field-types" />);

    for (const type of INBOUND_FIELD_TYPES) {
      expect(screen.getByText(type, { selector: 'code' })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('row')).toHaveLength(INBOUND_FIELD_TYPES.length + 1);
  });

  it('lists every property of every field type', () => {
    render(<InboundContract name="field-properties" />);

    const total = INBOUND_FIELD_TYPES.reduce(
      (sum, type) => sum + INBOUND_FIELD_PROPERTIES[type].length,
      0
    );
    expect(screen.getAllByRole('row')).toHaveLength(total + 1);
    expect(screen.getByText('maxItems', { selector: 'code' })).toBeInTheDocument();
  });

  it('lists every template', () => {
    render(<InboundContract name="templates" />);

    for (const template of INBOUND_WEBHOOK_TEMPLATES) {
      expect(screen.getByText(template.id, { selector: 'code' })).toBeInTheDocument();
    }
  });

  it('renders the condition operators and schema properties', () => {
    const { unmount } = render(<InboundContract name="condition-operators" />);
    expect(screen.getByText('contains', { selector: 'code' })).toBeInTheDocument();
    unmount();

    render(<InboundContract name="schema-properties" />);
    expect(screen.getByText('steps', { selector: 'code' })).toBeInTheDocument();
    expect(screen.getByText('fields', { selector: 'code' })).toBeInTheDocument();
  });

  it('refuses a table name it does not know', () => {
    expect(() => render(<InboundContract name={'nope' as never} />)).toThrow(/unknown table/);
  });
});
