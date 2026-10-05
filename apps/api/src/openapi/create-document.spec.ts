import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';

import { applyApiPrefix, createOpenApiDocument } from './create-document';

class CreateThingDto {
  @ApiProperty()
  @IsString()
  name!: string;
}

@ApiTags('Things')
@Controller('things')
class ThingsController {
  @Get()
  list() {
    return [];
  }

  @Post()
  create(@Body() _dto: CreateThingDto) {
    return {};
  }
}

describe('createOpenApiDocument', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ThingsController],
    }).compile();
    app = moduleRef.createNestApplication();
    applyApiPrefix(app, 'api');
  });

  afterAll(() => app.close());

  it('puts the routes under the API prefix, as the server serves them', () => {
    const document = createOpenApiDocument(app, 'http://localhost:3000');

    expect(Object.keys(document.paths)).toEqual(['/api/things']);
  });

  it('names the server it is given, as the root only', () => {
    const document = createOpenApiDocument(app, 'https://mcdi.example.org');

    expect(document.servers).toEqual([
      { url: 'https://mcdi.example.org', description: 'API Server' },
    ]);
  });

  it('forbids extra properties on a request schema, because the server answers 400 to them', () => {
    const document = createOpenApiDocument(app, 'http://localhost:3000');

    expect(document.components?.schemas?.CreateThingDto).toMatchObject({
      type: 'object',
      additionalProperties: false,
    });
  });

  it('declares both ways of authenticating', () => {
    const document = createOpenApiDocument(app, 'http://localhost:3000');

    expect(
      Object.keys(document.components?.securitySchemes ?? {}).sort(),
    ).toEqual(['api-key', 'session-token']);
  });
});
