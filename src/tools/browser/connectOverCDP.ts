import { BrowserToolBase } from './base.js';
import { ToolResponse, createSuccessResponse, createErrorResponse } from '../common/types.js';
import { chromium } from 'playwright';
import { registerConsoleMessage, setGlobalPage } from '../../toolHandler.js';

export class ConnectOverCDPTool extends BrowserToolBase {
  async execute(args: any): Promise<ToolResponse> {
    const cdpEndpoint = args.cdpEndpoint || "http://localhost:9222";
    const windowTitle = args.windowTitle;
    try {
      // 连接CDP
      const browser = await chromium.connectOverCDP(cdpEndpoint);
      const contextObj = browser.contexts()[0] || await browser.newContext();
      
      let page;
      
      // 如果指定了窗口标题，查找匹配标题的页面
      if (windowTitle) {
        const pages = contextObj.pages();
        // 并发获取所有页面标题
        const pageTitlePairs = await Promise.all(
          pages.map(async (p) => {
            try {
              const title = (await p.title()).trim();
              return { page: p, title };
            } catch {
              return { page: p, title: '<无法获取标题>' };
            }
          })
        );
        // 查找第一个匹配的页面
        const match = pageTitlePairs.find(pair =>
          pair.title.toLowerCase().includes(windowTitle.trim().toLowerCase())
        );
        if (match) {
          page = match.page;
          await page.bringToFront();
        } else {
          return createErrorResponse(
            `当前浏览器中的窗口有: ${pageTitlePairs.map(pair => pair.title).join(', ')}，未找到标题包含 "${windowTitle}" 的窗口`
          );
        }
      } else {
        // 如果没有指定标题，使用原有逻辑
        // 通过CDP协议获取当前激活的targetId
        const cdpSession = await contextObj.newCDPSession(contextObj.pages()[0] || await contextObj.newPage());
        const { targetInfos } = await cdpSession.send('Target.getTargets');
        // 找到当前激活的页面（type为'page'且active为true）
        const activeTarget = targetInfos.find((t: any) => t.type === 'page' && t.attached && t.focused);
        
        if (activeTarget) {
          // 通过targetId找到对应的page
          page = contextObj.pages().find(p => (p as any)._targetId === activeTarget.targetId);
        }
        if (!page) {
          // fallback: 取第一个页面
          page = contextObj.pages()[0] || await contextObj.newPage();
        }
      }
      
      await registerConsoleMessage(page);
      setGlobalPage(page);
      // 设置全局 browser 和 page，确保后续工具可用
      (global as any).browser = browser;
      (global as any).page = page;

      const pageTitle = await page.title();
      const pageUrl = await page.url();
      const message = windowTitle 
        ? `已通过CDP连接到浏览器并切换到标题为 "${pageTitle}" 的窗口，URL: ${pageUrl}`
        : `已通过CDP连接到浏览器，当前激活页面URL: ${pageUrl}`;
      
      return createSuccessResponse(message);
    } catch (error) {
      return createErrorResponse(`CDP连接失败: ${(error as Error).message}`);
    }
  }
} 