import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import {createClient} from '@supabase/supabase-js';
import {ownedRealtimeChannel} from '../lib/realtimeChannel.ts';

// Resolve precisely the transitive implementations used by Next and Supabase.
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json'));
const sdkRequire = createRequire(require.resolve('@supabase/supabase-js'));
const realtimeRequire = createRequire(sdkRequire.resolve('@supabase/realtime-js'));
const postcss = nextRequire('postcss');
const sharp = nextRequire('sharp');
const {WebSocketServer} = realtimeRequire('ws');

test('Next PostCSS override preserves transforms and source-map round trips', async () => {
  const css = '.card { color: red; }';
  const result = await postcss([{
    postcssPlugin: 'local-smoke',
    Declaration(decl) { if (decl.prop === 'color') decl.value = 'blue'; },
  }]).process(css, {from: '/virtual/card.css', to: '/virtual/card.out.css', map: {inline: false}});
  assert.match(result.css, /color: blue/);
  const map = result.map.toJSON();
  assert.deepEqual(map.sourcesContent, [css]);
  assert.ok(map.mappings.length > 0);
  const again = await postcss([]).process(result.css, {
    from: '/virtual/card.out.css', to: '/virtual/final.css',
    map: {prev: result.map, inline: false},
  });
  assert.deepEqual(again.map.toJSON().sourcesContent, [css]);
});

test('Next sharp override decodes and resizes JPEG/PNG to WebP in memory', async () => {
  for (const format of ['jpeg', 'png']) {
    const source = await sharp({create: {width: 40, height: 20, channels: 3, background: '#227799'}})
      .toFormat(format).toBuffer();
    const output = await sharp(source).resize({width: 10}).webp().toBuffer();
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 10);
    assert.equal(metadata.height, 5);
  }
});

test('Supabase Realtime joins, maps postgres payloads and unsubscribes over local ws', {timeout: 10000}, async t => {
  // A minimal protocol peer, NOT hosted Supabase/Realtime or a PostgreSQL stream.
  const server = new WebSocketServer({host: '127.0.0.1', port: 0});
  await once(server, 'listening');
  let client;
  t.after(async () => {
    client?.realtime.disconnect();
    for (const socket of server.clients) socket.terminate();
    await new Promise(resolve => server.close(resolve));
  });
  const frames = [];
  let receiveLeave;
  const left = new Promise(resolve => {receiveLeave = resolve;});
  server.on('connection', socket => socket.on('message', bytes => {
    const frame = JSON.parse(bytes.toString());
    frames.push(frame);
    if (frame.event === 'phx_leave') receiveLeave();
    if (!['phx_join', 'phx_leave', 'heartbeat'].includes(frame.event)) return;
    const bindings = frame.payload.config?.postgres_changes ?? [];
    socket.send(JSON.stringify({topic: frame.topic, event: 'phx_reply', ref: frame.ref,
      payload: {status: 'ok', response: frame.event === 'phx_join'
        ? {postgres_changes: bindings.map((filter, i) => ({...filter, id: i + 1}))} : {}}}));
    if (frame.event === 'phx_join') socket.send(JSON.stringify({
      topic: frame.topic, event: 'postgres_changes', payload: {ids: [1], data: {
        schema: 'public', table: 'items', type: 'INSERT', commit_timestamp: '2026-09-12T12:00:00Z',
        columns: [{name: 'id', type: 'int8'}, {name: 'title', type: 'text'}],
        record: {id: '42', title: 'Local fixture'}, old_record: {}, errors: [],
      }},
    }));
  }));
  client = createClient(`http://127.0.0.1:${server.address().port}`, 'local-test-only', {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
  });
  let receive;
  const received = new Promise(resolve => {receive = resolve;});
  const channel = ownedRealtimeChannel(client, 'items-global')
    .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'items'}, receive);
  await new Promise((resolve, reject) => channel.subscribe(status => {
    if (status === 'SUBSCRIBED') resolve();
    if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) reject(new Error(status));
  }));
  const payload = await received;
  assert.equal(payload.eventType, 'INSERT');
  assert.deepEqual(payload.new, {id: 42, title: 'Local fixture'});
  assert.equal(payload.table, 'items');
  let receiveAfterCleanup;
  const afterCleanup = new Promise(resolve => {receiveAfterCleanup = resolve;});
  const sibling = ownedRealtimeChannel(client, 'items-global')
    .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'items'}, payload => {
      if (payload.new.id === 43) receiveAfterCleanup(payload);
    });
  assert.notEqual(sibling, channel);
  await new Promise((resolve, reject) => sibling.subscribe(status => {
    if (status === 'SUBSCRIBED') resolve();
    if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) reject(new Error(status));
  }));
  assert.equal(await client.removeChannel(channel), 'ok');
  await left;
  assert.deepEqual(client.getChannels(), [sibling]);
  assert.equal(sibling.state, 'joined');
  for (const socket of server.clients) socket.send(JSON.stringify({
    topic: sibling.topic, event: 'postgres_changes', payload: {ids: [1], data: {
      schema: 'public', table: 'items', type: 'INSERT', commit_timestamp: '2026-09-12T12:01:00Z',
      columns: [{name: 'id', type: 'int8'}], record: {id: '43'}, old_record: {}, errors: [],
    }},
  }));
  assert.equal((await afterCleanup).new.id, 43);
  assert.equal(await client.removeChannel(sibling), 'ok');
  assert.equal(client.getChannels().length, 0);
  assert.ok(frames.some(frame => frame.event === 'phx_leave'));
});
