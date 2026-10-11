import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createWorker } from '../src/worker.mjs';
import { getPartyAssignments } from '../../frontend/api-client.mjs';
function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0001_foundation.sql',import.meta.url),'utf8'));
  sql.exec(`INSERT INTO profiles(id,firebase_uid,display_name,role,status) VALUES
    ('admin','admin','Admin','admin','active'),('gm','gm','GM','gm','active'),
    ('one','one','One','student','active'),('two','two','Two','student','active');
    INSERT INTO parties(id,name,gm_profile_id) VALUES ('a','A','gm'),('b','B',NULL);
    INSERT INTO party_members VALUES ('a','one'),('b','two');
    INSERT INTO quests(id,name,objective,xp_reward,status) VALUES ('q','Quest','Objective',100,'available'),('old','Old','Old',10,'archived');
    INSERT INTO assignments(id,quest_id,party_id,status,progress) VALUES
    ('aa','q','a','in_progress',25),('bb','q','b','in_progress',10),
    ('archive','q','a','archived',0),('oldquest','old','a','in_progress',0);`);
  function prepare(query,values=[]) {
    return {bind(...v){return prepare(query,v);},async first(){return sql.prepare(query).get(...values)||null;},async all(){return {results:sql.prepare(query).all(...values)};}};
  }
  const env={FIREBASE_PROJECT_ID:'test',DB:{prepare}};
  const worker=createWorker(async t=>t);
  const request=(uid,party='a',method='GET')=>worker.fetch(new Request('https://api.test/api/parties/'+party+'/assignments?role=admin',
    {method,headers:uid?{Authorization:'Bearer '+uid}:{}}),env);
  return {sql,request};
}
test('assignment reads allow admin, assigned GM and party members only',async()=>{
  const f=fixture();
  try{
    for(const uid of ['admin','gm','one']){
      const response=await f.request(uid);assert.equal(response.status,200);
      const data=await response.json();
      assert.deepEqual(data.assignments.map(a=>a.id),['aa']);
      assert.equal(data.assignments[0].xpReward,100);
      assert.equal(data.assignments[0].progress,25);
    }
    assert.equal((await f.request('two')).status,404);
    assert.equal((await f.request('one','b')).status,404);
    assert.equal((await f.request('gm','b')).status,404);
    assert.equal((await f.request('admin','b')).status,200);
  }finally{f.sql.close();}
});
test('unknown and archived parties have the same denial as unauthorized parties',async()=>{
  const f=fixture();
  try{
    assert.deepEqual(await (await f.request('one','missing')).json(),{error:'not_found'});
    f.sql.exec("UPDATE parties SET status='archived' WHERE id='a'");
    assert.equal((await f.request('admin')).status,404);
  }finally{f.sql.close();}
});
test('removed membership and inactive account revoke subsequent assignment reads',async()=>{
  const f=fixture();
  try{
    f.sql.exec("DELETE FROM party_members WHERE profile_id='one'");
    assert.equal((await f.request('one')).status,404);
    f.sql.exec("UPDATE profiles SET status='inactive' WHERE id='gm'");
    assert.equal((await f.request('gm')).status,403);
    assert.equal((await f.request(null)).status,401);
    assert.equal((await f.request('unknown')).status,403);
  }finally{f.sql.close();}
});
test('assignment read rejects writes and database errors fail safely',async()=>{
  const f=fixture();
  try{
    assert.equal((await f.request('admin','a','POST')).status,405);
    f.sql.exec('DROP TABLE assignments');
    const response=await f.request('one');
    assert.equal(response.status,503);
    assert.deepEqual(await response.json(),{error:'data_unavailable'});
  }finally{f.sql.close();}
});
test('assignment list is bounded and indicates additional rows',async()=>{
  const f=fixture();
  try{
    for(let i=0;i<101;i++)f.sql.prepare("INSERT INTO assignments(id,quest_id,party_id) VALUES(?,'q','a')").run('extra-'+i);
    const body=await(await f.request('one')).json();
    assert.equal(body.assignments.length,100);assert.equal(body.hasMore,true);
  }finally{f.sql.close();}
});
test('Pages assignment client encodes the selected party and sends only its ID token',async()=>{
  const user={getIdToken:async()=>'id-token'};
  const data=await getPartyAssignments(user,'a/b',{fetcher:async(url,opts)=>{
    assert.ok(url.endsWith('/parties/a%2Fb/assignments'));
    assert.equal(opts.headers.Authorization,'Bearer id-token');
    assert.equal(opts.credentials,'omit');
    return Response.json({assignments:[],hasMore:false});
  }});
  assert.deepEqual(data,{assignments:[],hasMore:false});
  await assert.rejects(()=>getPartyAssignments(user,'a',{fetcher:async()=>Response.json({error:'not_found'},{status:404})}),{code:'not_found'});
  await assert.rejects(()=>getPartyAssignments(user,'a',{fetcher:async()=>Response.json({assignments:[{id:'x'}],hasMore:false})}),{code:'invalid_response'});
});

test('student legacy assignment endpoint also excludes locked campaign quests',async()=>{const f=fixture();try{f.sql.exec("INSERT INTO quests(id,name,status) VALUES('boss-soap-presentation','Spoiler','available');INSERT INTO assignments(id,quest_id,party_id) VALUES('future','boss-soap-presentation','a')");assert.deepEqual((await(await f.request('one')).json()).assignments.map(a=>a.id),['aa']);assert.ok((await(await f.request('gm')).json()).assignments.some(a=>a.id==='future'));}finally{f.sql.close();}});
