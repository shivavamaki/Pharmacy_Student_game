import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
const sql=readFileSync(new URL('../migrations/0001_foundation.sql',import.meta.url),'utf8');
function db(){
  const d=new DatabaseSync(':memory:'); d.exec(sql);
  d.exec("INSERT INTO profiles(id,display_name) VALUES ('u','Demo'),('g','Reviewer'); INSERT INTO parties(id,name) VALUES ('p','Demo party'); INSERT INTO quests(id,name) VALUES ('q','Demo quest'); INSERT INTO assignments(id,quest_id,party_id) VALUES ('a','q','p');");
  return d;
}
test('schema contains no credential columns',()=>{
 const d=db();for(const table of ['profiles','recap_responses','audit_events'])
 assert.ok(!d.prepare('PRAGMA table_info('+table+')').all().some(c=>/password|token/i.test(c.name)));d.close();
});
test('dangling memberships are rejected',()=>{const d=db();assert.throws(()=>d.exec("INSERT INTO party_members VALUES ('p','missing')"),/FOREIGN KEY/);d.close()});
test('invalid role and progress are rejected',()=>{const d=db();assert.throws(()=>d.exec("UPDATE profiles SET role='owner' WHERE id='u'"),/CHECK/);assert.throws(()=>d.exec("UPDATE assignments SET progress=101 WHERE id='a'"),/CHECK/);d.close()});
test('duplicate XP award is rejected',()=>{const d=db();d.exec("INSERT INTO xp_awards(id,assignment_id,profile_id,xp,approved_by) VALUES ('x','a','u',10,'g')");assert.throws(()=>d.exec("INSERT INTO xp_awards(id,assignment_id,profile_id,xp,approved_by) VALUES ('y','a','u',10,'g')"),/UNIQUE/);d.close()});
test('retry key prevents duplicate recap responses for same user',()=>{const d=db();d.exec("INSERT INTO recap_responses(id,profile_id,idempotency_key,answers_json) VALUES ('r','u','retry','{}')");assert.throws(()=>d.exec("INSERT INTO recap_responses(id,profile_id,idempotency_key,answers_json) VALUES ('s','u','retry','{}')"),/UNIQUE/);d.close()});
test('invalid answer JSON is rejected',()=>{const d=db();assert.throws(()=>d.exec("INSERT INTO recap_responses(id,profile_id,idempotency_key,answers_json) VALUES ('r','u','retry','invalid')"),/CHECK/);d.close()});
