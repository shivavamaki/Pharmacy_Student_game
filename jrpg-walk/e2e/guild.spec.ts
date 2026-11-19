import {test,expect} from '@playwright/test';

test('tap/click map selects a destination; Guild Master dialogue and turn-based battle still work',async ({page},testInfo)=>{
 await page.goto('/jrpg/walk/');
 const canvas=page.locator('#game canvas');
 await expect(canvas).toBeVisible();
 await expect(page.locator('#status')).toContainText('Demo leader controls');
 await expect(page.locator('#coords')).toContainText('X:9 Y:9');
 await expect(page.locator('.team-banner')).toContainText('PARTY LEADER');
 await expect(page.locator('.team-banner')).toContainText('not online players');

 // Click the map one tile right of the hero. Initial camera shows world x=0..22,
 // scrollY is constrained to 16px; world (10,9) maps to local (168,136).
 const bounds=await canvas.boundingBox();
 expect(bounds).not.toBeNull();
 const point={x:bounds!.width*168/352,y:bounds!.height*136/240};
 if(testInfo.project.name==='android-touch-emulation')await canvas.tap({position:point});
 else await canvas.click({position:point});
 await expect(page.locator('#coords')).toContainText('X:10 Y:9');

 // Accessible shortcut uses the same destination routing and auto-interacts at arrival.
 await page.locator('#destination-gm').click();
 await expect(page.locator('#dialogue')).toBeVisible();
 await expect(page.locator('#dialogue-text')).toContainText('ผู้ฝึกเภสัชกร');
 await page.locator('#dialogue-battle').click();
 await expect(page.locator('#battle-overlay')).toBeVisible();
 await expect(page.locator('.combat-party span')).toHaveCount(6);
 await page.getByRole('button',{name:/ฟังเสียง/}).click();
 await page.getByRole('button',{name:/ตรวจสอบ/}).click();
 await expect(page.locator('#battle-case .answer')).toHaveCount(3);
 await page.locator('#battle-case .answer').nth(1).click();
 await page.getByRole('button',{name:/วิเคราะห์/}).click();
 await page.getByRole('button',{name:/วางแผน/}).click();
 await expect(page.locator('#battle-case')).toContainText('VICTORY');
 await expect(page.locator('#journal')).toContainText('GM');
 await page.locator('#battle-return').click();
 await expect(page.locator('#battle-overlay')).toBeHidden();
 await expect(page.locator('#game canvas')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
});

test('tap-to-move buttons support accessible targets and turn-based combat',async ({page})=>{
 await page.goto('/jrpg/walk/');
 await expect(page.getByRole('button',{name:/Guild Master/})).toBeVisible();
 await expect(page.getByRole('button',{name:/Training Portal/})).toBeVisible();
 await expect(page.locator('.travel-instruction')).toContainText('หัวหน้าทีม');
 await expect(page.locator('.student-work')).toContainText('นักศึกษาทุกคน');
 await expect(page.locator('.personal-tasks')).toHaveAttribute('target','_blank');
 await expect(page.locator('#game canvas')).toBeVisible();
 await expect(page.locator('.safety')).toContainText('ไม่ใช่ผู้เล่นออนไลน์จริง');
 await page.locator('#destination-portal').click();
 await expect(page.locator('#battle-overlay')).toBeVisible({timeout:15000});
 await expect(page.locator('#battle-actions button')).toHaveCount(7);
});
