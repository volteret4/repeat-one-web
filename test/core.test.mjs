// node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {bookmarkletSource, cleanDate, counts, filterReleases, isUserId, mergeReleases, normalizeRelease, parseImport, restoreBackup} from '../dieta-sonora/core.js';

const M1 = '11111111-1111-4111-8111-111111111111', M2 = '22222222-2222-4222-8222-222222222222';
const api = (mbid, name = 'Disco', date = '2026-11-01') => ({mbid, name, date, type: 'Album', artist: {name: 'Artista', mbid: M2}});

test('fechas', () => {
  assert.equal(cleanDate('2026-11-05T00:00:00'), '2026-11-05');
  assert.equal(cleanDate('2026'), '2026');
  assert.equal(cleanDate('<script>'), '');
  assert.equal(cleanDate(null), '');
});

test('ID de usuario', () => {
  assert.ok(isUserId('a'.repeat(30)));
  assert.ok(!isUserId('a'.repeat(29)));
  assert.ok(!isUserId('../../etc/passwdaaaaaaaaaaaaaaaaa'));
});

test('rechaza filas externas malas y descarta campos extra', () => {
  assert.equal(normalizeRelease({mbid: 'x', name: 'a', artist: {name: 'b'}}), null);
  assert.equal(normalizeRelease({mbid: M1, name: '', artist: {name: 'b'}}), null);
  assert.equal(normalizeRelease(null), null);
  const r = normalizeRelease({...api(M1), state: 'owned', evil: 1});
  assert.deepEqual(Object.keys(r).sort(), ['artist', 'artistMbid', 'date', 'mbid', 'name', 'type']);
});

test('importar otra vez conserva tu estado', () => {
  const first = mergeReleases([], [api(M1), api(M1)], 5);
  assert.equal(first.added, 1);
  const saved = {...first.rows[0], state: 'listened'};
  const again = mergeReleases([saved], [api(M1, 'Disco (corregido)', '')], 9);
  assert.equal(again.added, 0);
  assert.equal(again.updated, 1);
  assert.equal(again.rows[0].state, 'listened');
  assert.equal(again.rows[0].addedAt, 5);
  assert.equal(again.rows[0].name, 'Disco (corregido)');
  assert.equal(again.rows[0].date, '2026-11-01', 'una fecha vacía no borra la buena');
  assert.equal(mergeReleases([saved], [api(M1)]).updated, 0, 'sin cambios no reescribe');
});

test('importa JSON y rechaza formatos desconocidos', () => {
  assert.equal(parseImport(JSON.stringify([api(M1)])).length, 1);
  assert.equal(parseImport(JSON.stringify({releases: [api(M1)]})).length, 1);
  assert.throws(() => parseImport('hola'), /no es JSON/);
  assert.throws(() => parseImport('{"a":1}'), /lista/);
});

test('filtra y ordena', () => {
  const rows = [
    {mbid: M1, artist: 'Zeta', name: 'Uno', type: 'EP', date: '2025-01-01', state: 'pending'},
    {mbid: M2, artist: 'Alfa', name: 'Dos', type: 'Album', date: '2026-01-01', state: 'pending'},
    {mbid: 'x', artist: 'Beta', name: 'Tres', type: 'Album', date: '2026-02-01', state: 'owned'},
  ];
  assert.deepEqual(filterReleases(rows, {}).map(r => r.artist), ['Alfa', 'Zeta']);
  assert.deepEqual(filterReleases(rows, {q: 'uno'}).map(r => r.artist), ['Zeta']);
  assert.deepEqual(filterReleases(rows, {type: 'EP'}).map(r => r.artist), ['Zeta']);
  assert.deepEqual(filterReleases(rows, {year: '2026'}).map(r => r.artist), ['Alfa']);
  assert.deepEqual(counts(rows), {pending: 2, owned: 1, listened: 0, dismissed: 0});
});

test('una copia manipulada no introduce estados ni campos', () => {
  const rows = restoreBackup({releases: [{...api(M1), state: 'hack', addedAt: 'x', evil: 1}, {mbid: 'mal'}]});
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, 'pending');
  assert.ok(!('evil' in rows[0]));
  assert.throws(() => restoreBackup({}), /copia/);
});

test('el marcador solo envía al destino indicado y sobrevive a minificar la URL', () => {
  const href = bookmarkletSource('https://x.example/ds/', 'https://x.example');
  assert.ok(href.startsWith('javascript:'));
  const src = decodeURIComponent(href.slice(11));
  assert.ok(src.includes('"https://x.example/ds/"'));
  assert.ok(src.includes('"https://x.example"'));
  assert.ok(!src.includes('TARGET') && !src.includes('ORIGIN'));
  assert.ok(!src.includes(', "*"') && !src.includes(",'*'"), 'nunca a cualquier origen');
  new Function(src); // sintaxis válida
});
