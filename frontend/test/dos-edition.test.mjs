import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=path=>readFileSync(resolve(root,path),'utf8');
test('login and game mount IDs are preserved',()=>{
  const html=read('frontend/index.html');
  for(const id of ['login','logout','retry','welcome','message','name','role','game','enrollment','session-note'])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/\/app\.mjs/);assert.match(html,/\/dos\.css/);assert.match(html,/viewport-fit=cover/);
});
test('DOS theme respects mobile and keyboard access',()=>{
  const css=read('frontend/dos.css');
  assert.match(css,/image-rendering:pixelated/);assert.match(css,/focus-visible/);
  assert.match(css,/@media\(max-width:760px\)/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('GAS runtime is not part of DOS branch',()=>{
  for(const name of ['Code.gs','Index.html','AdventureRecap.html','MERGE-NOTES.md','SETUP-STEP13.txt'])assert.equal(existsSync(resolve(root,name)),false,name);
  assert.doesNotMatch(read('frontend/index.html'),/google\.script/);
});
test('manifest references an existing local icon',()=>{
  const m=JSON.parse(read('frontend/manifest.webmanifest'));
  assert.equal(m.display,'standalone');assert.equal(m.start_url,'/');
  assert.equal(m.icons[0].src,'/assets/guild-crest.svg');
});
