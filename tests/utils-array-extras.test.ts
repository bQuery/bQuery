import { describe, expect, it } from 'bun:test';
import {
  chunkBy,
  difference,
  drop,
  first,
  flattenDeep,
  groupBy,
  intersection,
  keyBy,
  last,
  move,
  partition,
  range,
  sample,
  shuffle,
  sortBy,
  take,
  uniqueBy,
  zip,
} from '../src/core/utils/array';

describe('utils/array extras', () => {
  it('groupBy supports both key and function selectors', () => {
    expect(groupBy([{ k: 'a' }, { k: 'b' }, { k: 'a' }], 'k')).toEqual({
      a: [{ k: 'a' }, { k: 'a' }],
      b: [{ k: 'b' }],
    } as Record<string, { k: string }[]>);
    expect(groupBy([1, 2, 3, 4], (n) => (n % 2 === 0 ? 'even' : 'odd'))).toEqual({
      odd: [1, 3],
      even: [2, 4],
    });
  });

  it('keyBy indexes items by selector', () => {
    expect(keyBy([{ id: 1 }, { id: 2 }], 'id')).toEqual({ 1: { id: 1 }, 2: { id: 2 } });
  });

  it('groupBy and keyBy preserve symbol selector keys', () => {
    const odd = Symbol('odd');
    const even = Symbol('even');

    const grouped = groupBy([1, 2, 3, 4], (n) => (n % 2 === 0 ? even : odd));
    const keyed = keyBy([{ id: 1 }, { id: 2 }], (item) => (item.id === 1 ? odd : even));

    expect(grouped[odd]).toEqual([1, 3]);
    expect(grouped[even]).toEqual([2, 4]);
    expect(keyed[odd]).toEqual({ id: 1 });
    expect(keyed[even]).toEqual({ id: 2 });
  });

  it('partition splits items by predicate', () => {
    expect(partition([1, 2, 3, 4], (n) => n % 2 === 0)).toEqual([
      [2, 4],
      [1, 3],
    ]);
  });

  it('zip truncates to the shortest input', () => {
    expect(zip([1, 2, 3], ['a', 'b'])).toEqual([
      [1, 'a'],
      [2, 'b'],
    ]);
  });

  it('range handles ascending, descending, and step=0', () => {
    expect(range(0, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(range(2, 10, 2)).toEqual([2, 4, 6, 8]);
    expect(range(5, 0, -1)).toEqual([5, 4, 3, 2, 1]);
    expect(range(0, 5, 0)).toEqual([]);
  });

  it('first/last/take/drop behave on bounds', () => {
    expect(first([])).toBeUndefined();
    expect(last([])).toBeUndefined();
    expect(first([1, 2])).toBe(1);
    expect(last([1, 2])).toBe(2);
    expect(take([1, 2, 3], 2)).toEqual([1, 2]);
    expect(take([1, 2], 0)).toEqual([]);
    expect(drop([1, 2, 3], 2)).toEqual([3]);
    expect(drop([1, 2], 0)).toEqual([1, 2]);
  });

  it('sample returns one of the items, undefined when empty', () => {
    expect(sample([])).toBeUndefined();
    const arr = [1, 2, 3];
    const value = sample(arr);
    expect(arr.includes(value as number)).toBe(true);
  });

  it('shuffle returns a permutation', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled.slice().sort()).toEqual(arr);
  });

  it('uniqueBy keeps first occurrence per key', () => {
    expect(uniqueBy([{ id: 1 }, { id: 2 }, { id: 1 }], (o) => o.id)).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });

  it('sortBy accepts single and multiple selectors', () => {
    const items = [
      { k: 'b', n: 2 },
      { k: 'a', n: 3 },
      { k: 'a', n: 1 },
    ];
    expect(sortBy(items, (i) => i.k).map((i) => i.k)).toEqual(['a', 'a', 'b']);
    expect(
      sortBy(items, [(i): string | number => i.k, (i): string | number => i.n]).map((i) => i.n)
    ).toEqual([1, 3, 2]);
  });

  it('intersection and difference operate as expected', () => {
    expect(intersection([1, 2, 3], [2, 3, 4])).toEqual([2, 3]);
    expect(difference([1, 2, 3], [2, 3, 4])).toEqual([1]);
  });

  it('flattenDeep recurses to arbitrary depth', () => {
    expect(flattenDeep([1, [2, [3, [4, [5]]]]])).toEqual([1, 2, 3, 4, 5]);
  });

  it('move repositions elements and clamps out-of-range indices', () => {
    expect(move([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(move([1, 2], 10, -5)).toEqual([2, 1]); // clamped
    expect(move([], 0, 0)).toEqual([]);
  });

  it('chunkBy splits at predicate boundaries', () => {
    expect(chunkBy([1, 1, 2, 2, 3], (a, b) => a === b)).toEqual([[1, 1], [2, 2], [3]]);
  });
});
