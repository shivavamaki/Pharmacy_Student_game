import {test,expect} from '@playwright/test';

// This preview deliberately has NO connected multiplayer Worker. It must fail closed
// on desktop and Android-sized screens instead of claiming six players are online.
test('new JRPG lobby is accessible with six empty seats and disabled online controls',async({page})=>{
 await page.goto('http://127.0.0.1:8070/jrpg/lobby/');
 await expect(page.getByRole('heading',{name:/Party Lobby/})).toBeVisible();
 await expect(page.locator('#roster .seat')).toHaveCount(6);
 await expect(page.locator('#service-warning')).toContainText('not deployed or configured');
 await expect(page.locator('#connect')).toBeDisabled();
 await expect(page.locator('#start-battle')).toBeDisabled();
 await expect(page.locator('#transfer')).toBeHidden();
 await expect(page.locator('#vote-status')).toContainText('Waiting for party battle');
 await expect(page.locator('#world-map .tile-path').first()).toBeVisible();
 await expect(page.getByRole('link',{name:/Assignments/}).first()).toHaveAttribute('href','/#guild-content');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
 expect(overflow).toBe(false);
});
test('follower map interaction is inert without a validated room connection',async({page})=>{
 await page.goto('http://127.0.0.1:8070/jrpg/lobby/');
 await page.locator('#world-map').click({position:{x:130,y:95}});
 await expect(page.locator('#travel-status')).toHaveText('Waiting for party connection');
 await expect(page.locator('#world-location')).toHaveText('X:– Y:–');
 for(const b of await page.locator('button.destination').all())await expect(b).toBeDisabled();
});
