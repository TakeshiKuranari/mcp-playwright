import { BrowserToolBase } from './base.js';
import { ToolResponse, createSuccessResponse, createErrorResponse } from '../common/types.js';
import { chromium } from 'playwright';
import { registerConsoleMessage, setGlobalPage } from '../../toolHandler.js';

export class ConnectOverCDPTool extends BrowserToolBase {
  async execute(args: any): Promise<ToolResponse> {
    const cdpEndpoint = args.cdpEndpoint || "http://localhost:9222";
    try {
      // 连接CDP
      const browser = await chromium.connectOverCDP(cdpEndpoint);
      const contextObj = browser.contexts()[0] || await browser.newContext();
      // 通过CDP协议获取当前激活的targetId
      const cdpSession = await contextObj.newCDPSession(contextObj.pages()[0] || await contextObj.newPage());
      const { targetInfos } = await cdpSession.send('Target.getTargets');
      // 找到当前激活的页面（type为'page'且active为true）
      const activeTarget = targetInfos.find((t: any) => t.type === 'page' && t.attached && t.focused);
      let page;
      if (activeTarget) {
        // 通过targetId找到对应的page
        page = contextObj.pages().find(p => (p as any)._targetId === activeTarget.targetId);
      }
      if (!page) {
        // fallback: 取第一个页面
        page = contextObj.pages()[0] || await contextObj.newPage();
      }
      await registerConsoleMessage(page);
      setGlobalPage(page);
      // 设置全局 browser 和 page，确保后续工具可用
      (global as any).browser = browser;
      (global as any).page = page;

      return createSuccessResponse(`已通过CDP连接到浏览器，当前激活页面URL: ${await page.url()}`);
    } catch (error) {
      return createErrorResponse(`CDP连接失败: ${(error as Error).message}`);
    }
  }
} 