import {test,expect} from '@playwright/test';
test('walk into range, speak to Guild Master and complete fictional training battle',async ({page},testInfo)=>{
 await page.goto('/jrpg/walk/');
 await expect(page.locator('#game canvas')).toBeVisible();
 await expect(page.locator('#status')).toContainText('Explore the Guild');
 await expect(page.locator('#coords')).toContainText('X:9 Y:9');
 if(testInfo.project.name==='android-touch-emulation'){
   await page.locator('#move-up').tap();
 }else{
   await page.keyboard.press('ArrowUp');
 }
 await expect(page.locator('#coords')).toContainText('X:9 Y:8');
 await page.locator('#interact').click();
 await expect(page.locator('#dialogue')).toBeVisible();
 await expect(page.locator('#dialogue-text')).toContainText('ผู้ฝึกเภสัชกร');
 await page.locator('#dialogue-battle').click();
 await expect(page.locator('#battle-overlay')).toBeVisible();
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
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
 expect(overflow).toBe(false);
});
test('world loads at desktop/mobile layout with an accessible touch D-pad',async ({page})=>{
 await page.goto('/jrpg/walk/');
 await expect(page.getByRole('button',{name:'Move up'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Move right'})).toBeVisible();
 await expect(page.locator('#game canvas')).toBeVisible();
 await expect(page.locator('.safety')).toContainText('ไม่มีการเข้าสู่ระบบ');
});
