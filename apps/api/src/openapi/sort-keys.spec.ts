import { sortKeys } from './sort-keys';

describe('sortKeys', () => {
  it('puts the keys of every object in alphabetical order, at any depth', () => {
    const sorted = sortKeys({ b: { z: 1, a: 2 }, a: [{ y: 1, x: 2 }] });

    expect(Object.keys(sorted)).toEqual(['a', 'b']);
    expect(Object.keys(sorted.b)).toEqual(['a', 'z']);
    expect(Object.keys(sorted.a[0])).toEqual(['x', 'y']);
  });

  it('keeps the order of an array, since that order means something', () => {
    expect(sortKeys({ tags: ['b', 'a', 'c'] }).tags).toEqual(['b', 'a', 'c']);
  });

  it('leaves values that are not objects alone', () => {
    expect(sortKeys(null)).toBeNull();
    expect(sortKeys(3)).toBe(3);
    expect(sortKeys('x')).toBe('x');
    expect(sortKeys(true)).toBe(true);
  });

  it('does not change the input', () => {
    const input = { b: 1, a: 2 };

    sortKeys(input);

    expect(Object.keys(input)).toEqual(['b', 'a']);
  });
});
