import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoBallot,castDemoVote,tallyDemoBallot,DEMO_SEATS} from '../src/voting-demo.mjs';
test('local party vote simulator accepts one vote per seat and rejects duplicates',()=>{
 let b=createDemoBallot();
 assert.equal(b.seats.length,6);
 b=castDemoVote(b,'p1','listen');
 assert.throws(()=>castDemoVote(b,'p1','guard'),/already_voted/);
 assert.throws(()=>castDemoVote(b,'p9','guard'),/invalid_demo_voter/);
 assert.throws(()=>tallyDemoBallot(b),/votes_pending/);
});
test('most-voted action wins, leader has no veto',()=>{
 let b=createDemoBallot();
 for(const [i,id] of DEMO_SEATS.entries()) b=castDemoVote(b,id,i<4?'verify':'guard');
 const result=tallyDemoBallot(b);
 assert.equal(result.winner,'verify');
 assert.deepEqual(result.counts,{verify:4,guard:2});
});
test('leader breaks tie only by voting for tied option',()=>{
 let b=createDemoBallot();
 for(const [i,id] of DEMO_SEATS.entries())b=castDemoVote(b,id,i<3?'listen':'guard');
 assert.equal(tallyDemoBallot(b).winner,'listen');
 let alternative=createDemoBallot(['p1','p2','p3','p4'],'p1');
 for(const [id,kind] of [['p1','guard'],['p2','listen'],['p3','listen'],['p4','guard']]){
  alternative=castDemoVote(alternative,id,kind);
 }
 assert.equal(tallyDemoBallot(alternative).winner,'guard');
});
test('case-choice votes distinguish different options',()=>{
 let b=createDemoBallot(['p1','p2','p3'],'p1');
 b=castDemoVote(b,'p1','case-choice',0);
 b=castDemoVote(b,'p2','case-choice',1);
 b=castDemoVote(b,'p3','case-choice',1);
 const v=tallyDemoBallot(b);
 assert.equal(v.winner,'case-choice:1');
 assert.deepEqual(v.counts,{'case-choice:0':1,'case-choice:1':2});
});
