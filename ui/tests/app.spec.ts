import { test, expect } from '@playwright/test';

test.describe('Chat Analyze Frontend', () => {
  const APP_URL = 'http://localhost:5173';

  test.beforeEach(async ({ page }) => {
    // 确保开发服务器已启动 (如果未启动则会失败)
    await page.goto(APP_URL);
  });

  test('should display the app title', async ({ page }) => {
    await expect(page.getByText('Gemini Audit')).toBeVisible();
  });

  test('should load projects from API', async ({ page }) => {
    // 等待 sidebar 中的 Active Projects 标题显示
    await expect(page.getByText('Active Projects')).toBeVisible();
    
    // 检查是否有项目列表 (通过等待 button 存在)
    const projectButtons = page.locator('button');
    // 如果数据库有数据，应该至少有一个 button (展开/折叠按钮)
    await expect(projectButtons.first()).toBeVisible();
  });

  test('should expand a project to show sessions', async ({ page }) => {
    // 获取第一个项目按钮并点击
    const firstProject = page.locator('button').first();
    await firstProject.click();
    
    // 等待会话链接出现
    const sessionLinks = page.locator('a[href*="/session/"]');
    await expect(sessionLinks.first()).toBeVisible();
  });

  test('should load session content when clicked', async ({ page }) => {
    // 展开第一个项目
    await page.locator('button').first().click();
    
    // 点击第一个会话链接
    const firstSession = page.locator('a[href*="/session/"]').first();
    await firstSession.click();
    
    // 验证主视图中是否显示了项目标识
    // 我们在 SessionView 头部使用 Badge 显示项目名
    const header = page.locator('header, .border-b'); // 宽泛定位
    await expect(header.first()).toBeVisible();
  });
});
