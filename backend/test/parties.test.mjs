import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createWorker } from '../src/worker.mjs';
import { getMyParties } from '../../frontend/api-client.mjs';
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_foundation.sql', import.meta.url), 'utf8'));
  for (const [id, role] of [['admin','admin'],['gm-a','gm'],['gm-b','gm'],['student-a','student'],['student-b','student'],['preceptor','preceptor']])
    sqlite.prepare("INSERT INTO profiles(id, firebase_uid, display_name, role, status) VALUES(?,?,?,?, 'active')").run(id, id, id, role);
  sqlite.exec(`INSERT INTO parties(id,name,gm_profile_id,status) VALUES
    ('a','Party A','gm-a','active'), ('b','Party B','gm-b','active'),
    ('archived','Party C','gm-a','archived'), ('d','Party D','student-a','active');
    INSERT INTO party_members VALUES ('a','student-a'),('b','student-b'),('a','preceptor'),
      ('b','gm-a'),('archived','student-a');`);
  function statement(sql, values = []) {
    return { bind(...params) { return statement(sql, params); },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; } };
  }
  const env = { FIREBASE_PROJECT_ID: 'test', DB: { prepare: statement } };
  const worker = createWorker(async token => token);
  async function get(uid, suffix = '', method = 'GET') {
    return worker.fetch(new Request('https://api.test/api/parties' + suffix,
      { method, headers: uid ? { Authorization: 'Bearer ' + uid } : {} }), env);
  }
  return { sqlite, get, env, worker };
}
test('party visibility is scoped to current D1 role and membership', async () => {
  const f = fixture();
  try {
    for (const [id, expected] of [['admin',['a','b','d']],['gm-a',['a','b']],['gm-b',['b']],['student-a',['a']],['student-b',['b']],['preceptor',['a']]]) {
      const response = await f.get(id);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body.parties.map(p=>p.id), expected);
      assert.equal(body.hasMore, false);
      assert.ok(body.parties.every(p => Object.keys(p).sort().join(',') === 'gmName,id,name,rotation'));
    }
  } finally { f.sqlite.close(); }
});
test('client role and profile query parameters cannot broaden party access', async () => {
  const f = fixture();
  try {
    const body = await (await f.get('student-a', '?role=admin&profile_id=admin&party_id=b')).json();
    assert.deepEqual(body.parties.map(p=>p.id), ['a']);
  } finally { f.sqlite.close(); }
});
test('membership removal and inactive status apply on the next request', async () => {
  const f = fixture();
  try {
    f.sqlite.exec("DELETE FROM party_members WHERE profile_id='student-a'");
    assert.deepEqual((await (await f.get('student-a')).json()).parties, []);
    f.sqlite.exec("UPDATE profiles SET status='inactive' WHERE id='gm-a'");
    const response = await f.get('gm-a');
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'account_not_active' });
  } finally { f.sqlite.close(); }
});
test('party endpoint requires identity and rejects writes', async () => {
  const f = fixture();
  try {
    assert.equal((await f.get(null)).status, 401);
    assert.equal((await f.get('unregistered')).status, 403);
    assert.equal((await f.get('admin', '', 'POST')).status, 405);
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM parties').get().n, 4);
  } finally { f.sqlite.close(); }
});
test('party list is bounded and indicates additional results', async () => {
  const f = fixture();
  try {
    for(let i=0;i<101;i++) f.sqlite.prepare('INSERT INTO parties(id,name) VALUES (?,?)').run('extra-'+i,'Extra '+i);
    const body = await (await f.get('admin')).json();
    assert.equal(body.parties.length,100);
    assert.equal(body.hasMore,true);
  } finally { f.sqlite.close(); }
});
test('party database failure returns a safe error', async () => {
  const f = fixture();
  try {
    f.sqlite.exec('DROP TABLE party_members');
    const response = await f.get('student-a');
    assert.equal(response.status,503);
    assert.deepEqual(await response.json(), { error: 'data_unavailable' });
  } finally { f.sqlite.close(); }
});
test('Pages party client sends token and accepts a real empty result', async () => {
  const data = await getMyParties({ getIdToken: async()=> 'test-token' }, {
    fetcher: async(url, options)=>{
      assert.equal(url,'https://pharmacy-guild-api-dev.shivavamaki.workers.dev/api/parties');
      assert.equal(options.headers.Authorization,'Bearer test-token');
      return Response.json({parties:[],hasMore:false});
    }
  });
  assert.deepEqual(data,{parties:[],hasMore:false});
});
test('Pages party client preserves denials and rejects invalid shapes', async () => {
  const user = {getIdToken:async()=> 'test-token'};
  await assert.rejects(()=>getMyParties(user,{fetcher:async()=>Response.json({error:'account_not_active'},{status:403})}),{code:'account_not_active'});
  await assert.rejects(()=>getMyParties(user,{fetcher:async()=>Response.json({parties:[{id:'x'}],hasMore:false})}),{code:'invalid_response'});
});
