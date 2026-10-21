import { beforeEach, describe, expect, it } from 'bun:test';
import { effect } from '@bquery/bquery/reactive';
import { flushEffects } from '@bquery/bquery/testing';
import { todos } from '../src/stores/todos';

beforeEach(() => todos.$reset());

describe('todos store', () => {
  it('ignores blank todos and trims the rest', () => {
    todos.add('   ');
    todos.add('  Ship it  ');
    expect(todos.items.map((todo) => todo.text)).toEqual(['Ship it']);
  });

  it('derives the remaining count reactively', () => {
    const seen: number[] = [];
    const stop = effect(() => {
      seen.push(todos.remaining);
    });

    todos.add('One');
    todos.add('Two');
    todos.toggle(todos.items[0].id);
    flushEffects();

    expect(seen.at(-1)).toBe(1);
    expect(seen).toContain(2);
    stop();
  });
});
