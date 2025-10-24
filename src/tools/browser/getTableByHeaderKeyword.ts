import type { Page } from 'playwright';
import type { ToolContext } from '../common/types.js';
import { BrowserToolBase } from './base.js';
import { createErrorResponse, ToolResponse } from '../common/types.js';

/**
 * GetTableByHeaderKeywordTool - 根据表单第一行关键词获取表格顶层元素及XPath的工具
 */
// 超时时间常量（毫秒）
const TIMEOUT_MS = 100;

export class GetTableByHeaderKeywordTool extends BrowserToolBase {
  constructor(server: any) {
    super(server);
  }

  /**
   * 执行工具
   * @param args 工具参数
   * @param context 上下文
   * @returns 工具执行结果
   */
  async execute(
    args: {
      keyword: string; // 表格第一行中的关键词
    },
    context: ToolContext
  ): Promise<ToolResponse> {
    return this.safeExecute(context, async (page) => {
      const { keyword } = args;

      if (!keyword) {
        return createErrorResponse("Keyword is required");
      }

      // 获取表格元素的XPath
      const result = await this.getTableByHeaderKeyword(page, keyword);

      // 如果找到了XPath，返回XPath和元素信息
      if (result.xpath) {
        // 获取元素的HTML信息
        let elementInfo = '';
        try {
          const elementHandle = await page.waitForSelector(`xpath=${result.xpath}`, { timeout: TIMEOUT_MS });
          const elementHtml = await elementHandle.evaluate(el => el.outerHTML);
          elementInfo = elementHtml;
        } catch (e) {
          elementInfo = '无法获取元素详细信息';
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              xpath: result.xpath,
              element: elementInfo
            }),
          }],
          isError: false,
        };
      }

      // 如果没有找到XPath，返回调试信息
      return {
        content: [{
          type: "text",
          text: `未能找到包含关键词 【${keyword}】 的表格\n调试信息:\n${result.debugInfo}`,
        }],
        isError: false,
      };
    });
  }

  /**
   * 根据表头关键词获取表格元素
   * @param page Playwright页面对象
   * @param keyword 表格第一行中的关键词
   * @returns 表格元素的XPath或null
   */
  private async getTableByHeaderKeyword(page: Page, keyword: string): Promise<{ xpath: string | null; debugInfo: string }> {
    // 默认策略执行顺序
    const strategies = [
      // 策略1: 查找包含关键词的表头，然后定位到表格顶层元素
      this.findByHeaderKeyword.bind(this),
      // 策略2: 查找包含关键词的th元素，然后定位到表格顶层元素
      this.findByThKeyword.bind(this),
      // 策略3: 直接查找包含关键词的表格元素
      this.findByTableKeyword.bind(this)
    ];

    return this.executeStrategies(page, keyword, strategies);
  }

  /**
   * 执行策略方法，支持自定义策略顺序
   * @param page Playwright页面对象
   * @param keyword 表格第一行中的关键词
   * @param strategies 策略执行顺序数组
   * @returns 表格元素的XPath或null
   */
  private async executeStrategies(
    page: Page,
    keyword: string,
    strategies: Array<(page: Page, keyword: string) => Promise<{ xpath: string | null; debugInfo: string }>>
  ): Promise<{ xpath: string | null; debugInfo: string }> {
    let combinedDebugInfo = '';

    // 执行策略
    for (const strategy of strategies) {
      const result = await strategy(page, keyword);
      // 收集调试信息
      combinedDebugInfo += result.debugInfo + '\n';
      if (result.xpath) {
        return { xpath: result.xpath, debugInfo: combinedDebugInfo };
      }
    }

    return { xpath: null, debugInfo: combinedDebugInfo + '未能找到关键词对应的表格' };
  }

  /**
   * 策略1: 查找包含关键词的表头，然后定位到表格顶层元素
   */
  private async findByHeaderKeyword(page: Page, keyword: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[findByHeaderKeyword] 策略1: 查找包含关键词的表头，然后定位到表格顶层元素`);

    // 表头元素的XPath表达式
    const headerXPaths = [
      `//thead/tr/th[normalize-space(.) = '${keyword}']`,
      `//tr/th[normalize-space(.) = '${keyword}']`,
      `//*[@role='columnheader' or contains(@class,'header')]/th[normalize-space(.) = '${keyword}']`,
      `//*[contains(text(), '${keyword}') and (self::th or self::td)]`
    ];

    // 查找表头元素
    for (const headerXPath of headerXPaths) {
      try {
        log(`[findByHeaderKeyword] 等待表头元素出现: ${headerXPath}`);
        await page.waitForSelector(`xpath=${headerXPath}`, { timeout: TIMEOUT_MS });

        // 查找表头所在的表格顶层元素
        const tableXPath = `${headerXPath}/ancestor::table[1]`;
        log(`[findByHeaderKeyword] 检查表格顶层元素是否存在: ${tableXPath}`);
        if (await this.elementExists(page, tableXPath, log)) {
          log(`[findByHeaderKeyword] 找到表格顶层元素，返回定位XPath: ${tableXPath}`);
          return { xpath: tableXPath, debugInfo };
        }
      } catch (e) {
        log(`[findByHeaderKeyword] 查找表头元素时出错: ${e}`);
        continue;
      }
    }

    return { xpath: null, debugInfo };
  }

  /**
   * 策略2: 查找包含关键词的th元素，然后定位到表格顶层元素
   */
  private async findByThKeyword(page: Page, keyword: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[findByThKeyword] 策略2: 查找包含关键词的th元素，然后定位到表格顶层元素`);

    // th元素的XPath表达式
    const thXPaths = [
      `//th[contains(text(), '${keyword}')]`,
      `//*[self::th and normalize-space(.) = '${keyword}']`,
      `//*[@role='columnheader' or contains(@class,'header')][normalize-space(.) = '${keyword}']`
    ];

    // 查找th元素
    for (const thXPath of thXPaths) {
      try {
        log(`[findByThKeyword] 等待th元素出现: ${thXPath}`);
        await page.waitForSelector(`xpath=${thXPath}`, { timeout: TIMEOUT_MS });

        // 查找th所在的表格顶层元素
        const tableXPath = `${thXPath}/ancestor::table[1]`;
        log(`[findByThKeyword] 检查表格顶层元素是否存在: ${tableXPath}`);
        if (await this.elementExists(page, tableXPath, log)) {
          log(`[findByThKeyword] 找到表格顶层元素，返回定位XPath: ${tableXPath}`);
          return { xpath: tableXPath, debugInfo };
        }
      } catch (e) {
        log(`[findByThKeyword] 查找th元素时出错: ${e}`);
        continue;
      }
    }

    return { xpath: null, debugInfo };
  }

  /**
   * 策略3: 直接查找包含关键词的表格元素
   */
  private async findByTableKeyword(page: Page, keyword: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[findByTableKeyword] 策略3: 直接查找包含关键词的表格元素`);

    // 表格元素的XPath表达式
    const tableXPaths = [
      `//table[contains(., '${keyword}')]`,
      `//*[self::table and contains(., '${keyword}')]`,
      `//*[contains(@id, 'table') or contains(@class, 'table')][contains(., '${keyword}')]`
    ];

    // 查找表格元素
    for (const tableXPath of tableXPaths) {
      try {
        log(`[findByTableKeyword] 检查表格元素是否存在: ${tableXPath}`);
        if (await this.elementExists(page, tableXPath, log)) {
          log(`[findByTableKeyword] 找到表格元素，返回定位XPath: ${tableXPath}`);
          return { xpath: tableXPath, debugInfo };
        }
      } catch (e) {
        log(`[findByTableKeyword] 查找表格元素时出错: ${e}`);
        continue;
      }
    }

    return { xpath: null, debugInfo };
  }

  /**
   * 检查元素是否存在
   * @param page Playwright页面对象
   * @param xpath XPath表达式
   * @param log 日志函数
   * @returns 元素是否存在
   */
  private async elementExists(page: Page, xpath: string, log: (message: string) => void): Promise<boolean> {
    try {
      log(`[elementExists] 检查元素是否存在: ${xpath}`);
      // 使用waitForSelector来设置超时
      await page.waitForSelector(`xpath=${xpath}`, { timeout: TIMEOUT_MS });
      log(`[elementExists] 元素存在: ${xpath}`);
      return true;
    } catch (e) {
      log(`[elementExists] 元素不存在或超时: ${xpath}`);
      // 捕获超时或其他错误，但不抛出异常
      return false;
    }
  }
}