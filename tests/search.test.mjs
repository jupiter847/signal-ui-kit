import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCommands } from '../signal-ui.js';

const commands = [
  {
    id: 'workspace',
    label: 'New workspace',
    description: 'Create a project for your team',
    keywords: ['onboarding', 'collaboration'],
  },
  {
    id: 'activity',
    label: 'View activity',
    description: 'Review recent team changes',
    keywords: ['history'],
  },
  {
    id: 'resume',
    label: 'Résumé café',
    description: 'Continue your draft',
    keywords: ['profile'],
  },
  { id: 'messages', label: 'Žinutės', keywords: ['inbox'] },
  {
    id: 'settings',
    label: 'Team settings',
    description: 'Manage workspace access',
    disabled: true,
  },
  { id: 'help', label: 'Help' },
];

const ids = (matches) => matches.map(({ id }) => id);

test('every query word can match a different command field', () => {
  assert.deepEqual(ids(filterCommands(commands, 'new project onboarding')), ['workspace']);
  assert.deepEqual(ids(filterCommands(commands, 'onboarding new project')), ['workspace']);
  assert.deepEqual(filterCommands(commands, 'new project billing'), []);
});

test('matching ignores case and diacritics in labels and query words', () => {
  assert.deepEqual(ids(filterCommands(commands, 'RESUME CAFE')), ['resume']);
  assert.deepEqual(ids(filterCommands(commands, 'zinutes')), ['messages']);
  assert.deepEqual(ids(filterCommands(commands, 'PRÓFILE')), ['resume']);
});

test('leading, trailing and mixed whitespace do not change query words', () => {
  assert.deepEqual(
    ids(filterCommands(commands, ' \n NEW\t project\r\n  onboarding\u00a0 ')),
    ['workspace'],
  );
});

test('empty, omitted and undefined queries return all commands in a fresh array', () => {
  const results = [
    filterCommands(commands),
    filterCommands(commands, undefined),
    filterCommands(commands, ''),
    filterCommands(commands, ' \t\n '),
  ];

  for (const result of results) {
    assert.deepEqual(result, commands);
    assert.notStrictEqual(result, commands);
  }
  assert.notStrictEqual(results[0], results[1]);
});

test('filtered results retain source order and original command identities', () => {
  const result = filterCommands(commands, 'team');

  assert.deepEqual(ids(result), ['workspace', 'activity', 'settings']);
  assert.notStrictEqual(result, commands);
  assert.strictEqual(result[0], commands[0]);
  assert.strictEqual(result[1], commands[1]);
  assert.strictEqual(result[2], commands[4]);
});

test('filtering does not mutate the input array, command objects or keyword arrays', () => {
  const source = structuredClone(commands);
  const original = structuredClone(source);
  for (const command of source) {
    if (command.keywords) Object.freeze(command.keywords);
    Object.freeze(command);
  }
  Object.freeze(source);

  const result = filterCommands(source, 'workspace');
  assert.deepEqual(ids(result), ['workspace', 'settings']);
  result.reverse();
  assert.deepEqual(source, original);
});

test('disabled commands remain available to matching searches', () => {
  const result = filterCommands(commands, 'settings access');

  assert.deepEqual(ids(result), ['settings']);
  assert.strictEqual(result[0], commands[4]);
  assert.equal(result[0].disabled, true);
});

test('label-only commands can be searched without optional fields', () => {
  assert.deepEqual(ids(filterCommands(commands, 'help')), ['help']);
});

test('queries with no match and empty command lists return an empty array', () => {
  assert.deepEqual(filterCommands(commands, 'unavailable command'), []);
  const empty = [];
  const result = filterCommands(empty, 'workspace');
  assert.deepEqual(result, []);
  assert.notStrictEqual(result, empty);
});

test('a non-array command collection throws a clear TypeError', () => {
  for (const invalid of [undefined, null, {}, 'commands', 42, new Set(commands)]) {
    assert.throws(
      () => filterCommands(invalid, 'team'),
      { name: 'TypeError', message: /commands must be an array/i },
    );
  }
});
