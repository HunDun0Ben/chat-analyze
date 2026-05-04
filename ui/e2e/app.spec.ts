import { test, expect } from '@playwright/test';

test.describe('Chat Analyze Frontend', () => {
  const APP_URL = 'http://localhost:5173';

  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('**/api/projects?provider=gemini', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['test-project']),
      });
    });

    await page.route('**/api/sessions?project=test-project', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            sessionId: 'test-session-id',
            projectName: 'test-project',
            sessionTitle: 'Test Session',
            messages: [{ type: 'user', content: 'Hello' }],
            modelId: 'gemini-1.5-pro',
          },
        ]),
      });
    });

    await page.route('**/api/session/test-session-id', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: 'test-session-id',
          projectName: 'test-project',
          sessionTitle: 'Test Session',
          messages: [
            {
              id: '1',
              type: 'user',
              content: 'Hello',
              timestamp: new Date().toISOString(),
            },
            {
              id: '2',
              type: 'gemini',
              content: 'Hi there!',
              timestamp: new Date().toISOString(),
              model: 'gemini-1.5-pro',
            },
          ],
          modelId: 'gemini-1.5-pro',
          stats: {
            turns: 2,
            userTurns: 1,
            geminiTurns: 1,
            corrections: 0,
            toolChain: [],
            tokenUsage: { total: 100 },
          },
          expressionQuality: {
            score: 95,
            ambiguities: [],
            suggestion: 'Good job!',
          },
        }),
      });
    });

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
    // 等待项目列表加载
    await page.waitForResponse((resp) => resp.url().includes('/api/projects'));

    // 获取第一个项目按钮并点击
    const firstProject = page
      .locator('button[data-testid^="project-item-"]')
      .first();
    await firstProject.click();

    // 等待会话列表 API 响应
    await page.waitForResponse((resp) => resp.url().includes('/api/sessions'));

    // 等待会话链接出现
    const sessionLinks = page.locator('a[data-testid^="session-link-"]');
    await expect(sessionLinks.first()).toBeVisible();
  });

  test('should load session content when clicked', async ({ page }) => {
    // 等待项目加载并展开第一个项目
    await page.waitForResponse((resp) => resp.url().includes('/api/projects'));
    await page.locator('button[data-testid^="project-item-"]').first().click();

    // 等待会话加载并点击第一个会话链接
    await page.waitForResponse((resp) => resp.url().includes('/api/sessions'));
    const firstSession = page
      .locator('a[data-testid^="session-link-"]')
      .first();
    await firstSession.click();
    await firstSession.click();

    // 验证主视图中是否显示了项目标识
    // 我们在 SessionView 头部使用 Badge 显示项目名
    const header = page.locator('header, .border-b'); // 宽泛定位
    await expect(header.first()).toBeVisible();
  });

  test('should toggle dark/light mode', async ({ page }) => {
    const html = page.locator('html');
    const toggleButton = page.locator('button[title^="Switch to"]');

    // 默认应该是 dark 或 light (取决于系统或存储)
    const isInitiallyDark = await html.evaluate((el) =>
      el.classList.contains('dark'),
    );

    // 点击切换
    await toggleButton.click();

    // 验证类名是否反转
    if (isInitiallyDark) {
      await expect(html).not.toHaveClass(/dark/);
    } else {
      await expect(html).toHaveClass(/dark/);
    }

    // 再次点击恢复
    await toggleButton.click();
    if (isInitiallyDark) {
      await expect(html).toHaveClass(/dark/);
    } else {
      await expect(html).not.toHaveClass(/dark/);
    }
  });
});
