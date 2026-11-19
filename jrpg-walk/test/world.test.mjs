import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_WIDTH,WORLD_HEIGHT,PLAYER_START,GUILD_MASTER,TRAINING_PORTAL,tileAt,nextTile,isWalkable,canEnter,canInteract,isReachable} from '../src/world.mjs';
import {chapters} from '../../frontend/jrpg/data.mjs';
import {ACTIONS,startBattle,applyAction} from '../../frontend/jrpg/engine.mjs';
test('guild map boundaries, obstacles and hero origin',()=>{
 assert.equal(tileAt(0,0),'wall');
 assert.equal(tileAt(-1,4),'void');
 assert.equal(tileAt(WORLD_WIDTH,WORLD_HEIGHT),'void');
 assert.equal(tileAt(4,4),'roof');
 assert.equal(tileAt(18,4),'water');
 assert.equal(isWalkable(PLAYER_START.x,PLAYER_START.y),true);
 assert.equal(canEnter(GUILD_MASTER.x,GUILD_MASTER.y),false);
 assert.equal(canEnter(TRAINING_PORTAL.x,TRAINING_PORTAL.y),false);
});
test('movement stops at walls, NPC and encounter portal',()=>{
 assert.deepEqual(nextTile({x:1,y:1},-1,0),{x:1,y:1});
 assert.deepEqual(nextTile(PLAYER_START,0,-1),{x:9,y:8});
 assert.deepEqual(nextTile({x:9,y:8},0,-1),{x:9,y:8});
 assert.deepEqual(nextTile({x:16,y:10},1,0),{x:16,y:10});
 assert.equal(nextTile(PLAYER_START,0,0),PLAYER_START);
});
test('NPC and portal reachable without walking through blocking tiles',()=>{
 assert.equal(canInteract(PLAYER_START,GUILD_MASTER),false);
 assert.equal(canInteract({x:9,y:8},GUILD_MASTER),true);
 assert.equal(isReachable(PLAYER_START,GUILD_MASTER),true);
 assert.equal(isReachable(PLAYER_START,TRAINING_PORTAL),true);
});
test('training battle reuses pure S/O/A/P and never issues official XP',()=>{
 const training=chapters.find(ch=>ch.id==='training');
 assert.ok(training);assert.equal(training.questId,'main-week-01');
 let battle=startBattle(training);
 for(const cmd of ['listen','verify','case-right','assess','plan'])battle=applyAction(battle,training,cmd);
 assert.equal(battle.status,'won');
 assert.equal(Object.hasOwn(battle,'xp'),false);
 assert.equal(Object.hasOwn(battle,'gold'),false);
 assert.ok(ACTIONS.length>=6);
});
