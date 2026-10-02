import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListSubmissionsDto } from './list-submissions.dto';

const check = async (query: Record<string, string>) => {
  const dto = plainToInstance(ListSubmissionsDto, query);
  return { dto, errors: await validate(dto) };
};

describe('ListSubmissionsDto', () => {
  it('turns a date filter into a Date', async () => {
    const { dto, errors } = await check({
      dateFrom: '2026-01-01T00:00:00Z',
      dateTo: '2026-01-31',
    });

    expect(errors).toEqual([]);
    expect(dto.dateFrom).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(dto.dateTo).toEqual(new Date('2026-01-31T00:00:00Z'));
  });

  // Each of these reached the query as an Invalid Date and surfaced as a 500.
  it.each(['foo', '2026-W05', '20260131', '2026-031'])(
    'rejects %s, which cannot be read as a date',
    async (value) => {
      for (const key of ['dateFrom', 'dateTo']) {
        const { errors } = await check({ [key]: value });
        expect(errors.map((e) => e.property)).toEqual([key]);
      }
    },
  );
});
