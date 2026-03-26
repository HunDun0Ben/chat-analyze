import { test } from '@playwright/test';

test('capture navigation crash', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // 1. 进入首页
  await page.goto('http://localhost:5173');
  await page.waitForSelector('button');

  // 2. 点击第一个项目展开 (如果没展开)
  const projectBtn = page.locator('button').first();
  await projectBtn.click();

  // 3. 点击第一个会话并观察
  const sessionLink = page.locator('a[href*="/session/"]').first();
  console.log('Clicking session link...');
  await sessionLink.click();

  // 4. 等待一段时间看是否崩溃
  await page.waitForTimeout(3000);

  console.log('--- Crash Report ---');
  console.log('URL after click:', page.url());
  if (errors.length > 0) {
    console.log('DETECTED ERRORS:');
    errors.forEach((err, i) => console.log(`${i + 1}: ${err}`));
  } else {
    console.log('No direct console errors detected, but check visibility.');
  }

  // 检查主体内容是否为空
  const bodyContent = await page.innerHTML('body');
  console.log('Body empty?', bodyContent.includes('id="root"'));

  await page.screenshot({ path: 'crash_debug.png' });
});
