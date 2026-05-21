import { describe, expect, it } from 'bun:test';
import {
  lines,
  pad,
  padEnd,
  padStart,
  randomString,
  stripHtml,
  template,
  toPascalCase,
  toSnakeCase,
  toTitleCase,
  wordCount,
} from '../src/core/utils/string';

describe('utils/string extras', () => {
  it('toSnakeCase / toPascalCase / toTitleCase', () => {
    expect(toSnakeCase('myVariableName')).toBe('my_variable_name');
    expect(toSnakeCase('MyVariableName')).toBe('my_variable_name');
    expect(toPascalCase('my-variable-name')).toBe('MyVariableName');
    expect(toPascalCase('hello world')).toBe('HelloWorld');
    expect(toTitleCase('hello world from bquery')).toBe('Hello World From Bquery');
  });

  it('pad / padStart / padEnd', () => {
    expect(pad('hi', 6, '*')).toBe('**hi**');
    expect(pad('already long', 4)).toBe('already long');
    expect(padStart('5', 3, '0')).toBe('005');
    expect(padEnd('5', 3, '0')).toBe('500');
  });

  it('wordCount counts whitespace-separated words', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('   ')).toBe(0);
    expect(wordCount('hello world')).toBe(2);
    expect(wordCount('a   b\tc\nd')).toBe(4);
  });

  it('template safely interpolates variables', () => {
    expect(template('Hello ${name}!', { name: 'world' })).toBe('Hello world!');
    expect(template('Total: ${count}', { count: 0 })).toBe('Total: 0');
    expect(template('Missing ${m}', {})).toBe('Missing ');
    // Template substitution only resolves known keys; unknown placeholders drop out.
    expect(template('${alert(1)}', {})).toBe('');
  });

  it('stripHtml removes tags and script/style content', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
    expect(stripHtml('<script>alert(1)</script>ok')).toBe('ok');
    expect(stripHtml('<style>.a{}</style>after')).toBe('after');
    // Tolerates whitespace and trailing attributes inside the closing tag.
    expect(stripHtml('<script>x</script\t\n bar>tail')).toBe('tail');
    expect(stripHtml('<style>.x{}</style >done')).toBe('done');
  });

  it('randomString returns a string of the requested length', () => {
    expect(randomString(0)).toBe('');
    const s = randomString(16);
    expect(s).toHaveLength(16);
    expect(/^[A-Za-z0-9]+$/.test(s)).toBe(true);
    const s2 = randomString(8, 'abc');
    expect(/^[abc]+$/.test(s2)).toBe(true);
  });

  it('lines preserves empty lines across universal terminators', () => {
    expect(lines('a\r\nb\n\nc')).toEqual(['a', 'b', '', 'c']);
  });
});
