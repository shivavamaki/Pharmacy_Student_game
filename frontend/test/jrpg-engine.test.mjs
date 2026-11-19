import test from 'node:test';
import assert from 'node:assert/strict';
import {chapters,jobs,chapterById} from '../jrpg/data.mjs';
import {startBattle,applyAction,ACTIONS} from '../jrpg/engine.mjs';
test('JRPG retains canonical educational quest IDs',()=>{
 const ids=new Set(chapters.map(c=>c.questId));
 for(const id of ['main-week-01','main-week-02','main-week-03','main-week-04','boss-mini-projects','boss-mini-academic','boss-soap-presentation','main-week-05'])assert.ok(ids.has(id),id);
 assert.equal(jobs.length,6);
 assert.equal(new Set(chapters.map(c=>c.id)).size,chapters.length);
 assert.ok(chapters.every(c=>c.choices.length===3 && Number.isInteger(c.correct) && c.correct>=0 && c.correct<3));
 assert.equal(chapterById('none'),null);
});
test('a fictional case cannot be resolved without S/O/A/P',()=>{
 const ch=chapters[0];let s=startBattle(ch);
 s=applyAction(s,ch,'plan');assert.equal(s.foeHp,ch.fog);
 s=applyAction(s,ch,'listen');assert.ok(s.seals.includes('S'));
 s=applyAction(s,ch,'verify');assert.ok(s.seals.includes('O'));
 s=applyAction(s,ch,'assess');assert.equal(s.foeHp,ch.fog-2);
 s=applyAction(s,ch,'case-right');assert.equal(s.caseResolved,true);
 s=applyAction(s,ch,'assess');assert.ok(s.seals.includes('A'));
 s=applyAction(s,ch,'plan');assert.equal(s.status,'won');
 assert.deepEqual([...s.seals].sort(),['A','O','P','S']);
});
test('wrong case has feedback and does not unlock assess',()=>{
 const ch=chapters[1];let s=startBattle(ch);
 s=applyAction(s,ch,'listen');s=applyAction(s,ch,'verify');
 const prior=s.playerHp;s=applyAction(s,ch,'case-wrong');
 assert.equal(s.playerHp,prior-2);
 assert.equal(s.caseResolved,false);
 s=applyAction(s,ch,'assess');assert.equal(s.seals.includes('A'),false);
});
test('SOAP finisher needs all four seals and focus',()=>{
 const ch=chapters.find(c=>c.boss);let s=startBattle(ch);
 s=applyAction(s,ch,'seal');assert.equal(s.foeHp,ch.fog);
 for(const action of ['listen','verify','case-right','assess','plan','guard','seal'])s=applyAction(s,ch,action);
 assert.ok(s.foeHp<ch.fog);assert.ok(s.seals.includes('P'));
});
test('invalid actions cannot create official awards',()=>{
 const ch=chapters[0];let s=startBattle(ch);
 s=applyAction(s,ch,'invalid');assert.equal(s.foeHp,ch.fog);
 assert.equal(Object.hasOwn(s,'xp'),false);assert.equal(Object.hasOwn(s,'gold'),false);
 assert.equal(ACTIONS.length,7);
});
