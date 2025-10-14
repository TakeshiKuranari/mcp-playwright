import type { Page } from 'playwright';
import type { ToolContext } from '../common/types.js';
import { BrowserToolBase } from './base.js';
import { createErrorResponse, ToolResponse } from '../common/types.js';

/**
 * GetXPathByLabelTool - 根据字段标签获取控件XPath的工具
 */
// 超时时间常量（毫秒）
const TIMEOUT_MS = 300;

export class GetXPathByLabelTool extends BrowserToolBase {
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
      label: string; // 字段标签名称(如:姓名, 性别, 年龄等)
      controlType?: string; // 控件类型(可选,如:输入框, 下拉框, 复选框, 单选按钮等)
    },
    context: ToolContext
  ): Promise<ToolResponse> {
    return this.safeExecute(context, async (page) => {
      const { label, controlType } = args;

      if (!label) {
        return createErrorResponse("Label is required");
      }

      // 获取控件的XPath
      const result = await this.getXPathByLabel(page, label, controlType);

      // 如果找到了XPath，返回XPath
      if (result.xpath) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ xpath: result.xpath }),
          }],
          isError: false,
        };
      }

      // 如果没有找到XPath，返回调试信息
      return {
        content: [{
          type: "text",
          text: `未能找到标签为 【${label}】 的控件\n调试信息:\n${result.debugInfo}`,
        }],
        isError: false,
      };
    });
  }

  /**
   * 根据标签获取控件的XPath
   * @param page Playwright页面对象
   * @param label 字段标签名称
   * @param controlType 控件类型(可选)
   * @returns 控件的XPath或null
   */
  private async getXPathByLabel(page: Page, label: string, controlType?: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[GetXPathByLabel] 开始查找标签 "${label}" 的控件XPath，控件类型: ${controlType || '未指定'}`);

    // 构建XPath查询表达式
    let xpathExpression = '';

    // 标准标签元素的XPath表达式
    const labelXPaths = [
      `//label[contains(text(), '${label}')]`,
      `//span[contains(text(), '${label}')]`,
      `//div[contains(text(), '${label}')]`,
      `//*[contains(@label, '${label}')]`,
      `//*[contains(@placeholder, '${label}')]`,
      `//*[contains(@aria-label, '${label}')]`,
      `//*[contains(@title, '${label}')]`,
      `//*[contains(text(), '${label}')]`,
    ];

    // 根据控件类型构建关联控件的XPath表达式
    let controlXPath = '';
    switch (controlType) {
      case '输入框':
        controlXPath = "//input | //textarea";
        break;
      case '下拉框':
        controlXPath = "//select";
        break;
      case '复选框':
        controlXPath = "//input[@type='checkbox']";
        break;
      case '单选按钮':
        controlXPath = "//input[@type='radio']";
        break;
      default:
        controlXPath = "//input | //textarea | //select | //button | //*[@role='button'] | //*[@role='combobox']";
        break;
    }

    log(`[GetXPathByLabel] 构建的控件XPath表达式: ${controlXPath}`);

    // 尝试不同的查找策略
    // 1. 查找与标签关联的控件 (通过for属性和id属性关联)
    log(`[GetXPathByLabel] 策略1: 查找与标签关联的控件 (通过for属性和id属性关联)`);
    const forAttributeXPath = `${labelXPaths[0]}/@for`;
    try {
      log(`[GetXPathByLabel] 等待标签元素出现并获取for属性: ${forAttributeXPath}`);
      // 先等待元素出现，设置超时
      await page.waitForSelector(`xpath=${labelXPaths[0]}`, { timeout: TIMEOUT_MS });
      // 然后获取for属性，增加超时保护
      const forId = await Promise.race([
        page.locator(forAttributeXPath).first().getAttribute('for'),
        new Promise<null>(resolve => setTimeout(() => resolve(null), TIMEOUT_MS))
      ]);
      log(`[GetXPathByLabel] 获取到的for属性值: ${forId}`);
      if (forId) {
        const elementXPath = `//*[@id='${forId}']`;
        log(`[GetXPathByLabel] 检查元素是否存在: ${elementXPath}`);
        if (await this.elementExists(page, elementXPath, log)) {
          log(`[GetXPathByLabel] 找到元素XPath: ${elementXPath}`);
          return { xpath: elementXPath, debugInfo };
        }
      }
    } catch (e) {
      // 提示错误，继续尝试其他方法
      log(`Error getting XPath by label: forAttributeXPath: ${forAttributeXPath}, error: ${e}`);
    }

    // 2. 查找标签后的兄弟元素中的控件
    log(`[GetXPathByLabel] 策略2: 查找标签后的兄弟元素中的控件`);
    for (const labelXPath of labelXPaths) {
      // 构建更准确的兄弟元素XPath
      let siblingXPath = '';
      if (controlType) {
        // 如果指定了控件类型，构建更具体的XPath
        const controlTag = controlXPath.split(' | ')[0].replace('//', '').split('[')[0];
        siblingXPath = `${labelXPath}/following-sibling::*[1][self::${controlTag}]`;
      } else {
        // 如果未指定控件类型，使用通用的XPath
        siblingXPath = `${labelXPath}/following-sibling::*[1]`;
      }

      log(`[GetXPathByLabel] 检查兄弟元素XPath: ${siblingXPath}`);
      if (await this.elementExists(page, siblingXPath, log)) {
        log(`[GetXPathByLabel] 兄弟元素存在，获取完整XPath: ${siblingXPath}`);
        const fullXPath = await this.getElementXPath(page, siblingXPath, log);
        if (fullXPath) {
          log(`[GetXPathByLabel] 找到兄弟元素XPath: ${fullXPath}`);
          return { xpath: fullXPath, debugInfo };
        }
      }
    }

    // 3. 查找标签内的子元素中的控件
    log(`[GetXPathByLabel] 策略3: 查找标签内的子元素中的控件`);
    for (const labelXPath of labelXPaths) {
      // 构建更准确的子元素XPath
      let childXPath = '';
      if (controlType) {
        // 如果指定了控件类型，构建更具体的XPath
        const controlSelectors = controlXPath.replace('//', '').split(' | ');
        const conditions = controlSelectors.map(selector => `self::${selector.split('[')[0]}`).join(' or ');
        childXPath = `${labelXPath}//*[${conditions}]`;
      } else {
        // 如果未指定控件类型，使用原始的XPath
        childXPath = `${labelXPath}//*[${controlXPath.replace('//', '').replace(' | ', ' | self::')}]`;
      }

      log(`[GetXPathByLabel] 检查子元素XPath: ${childXPath}`);
      if (await this.elementExists(page, childXPath, log)) {
        log(`[GetXPathByLabel] 子元素存在，获取完整XPath: ${childXPath}`);
        const fullXPath = await this.getElementXPath(page, childXPath, log);
        if (fullXPath) {
          log(`[GetXPathByLabel] 找到子元素XPath: ${fullXPath}`);
          return { xpath: fullXPath, debugInfo };
        }
      }
    }

    // 4. 查找标签附近的控件 (使用CSS选择器查找相邻元素)
    log(`[GetXPathByLabel] 策略4: 查找标签附近的控件 (使用CSS选择器查找相邻元素)`);
    for (const labelXPath of labelXPaths) {
      // 查找标签元素
      try {
        log(`[GetXPathByLabel] 等待标签元素出现: ${labelXPath}`);
        await page.waitForSelector(`xpath=${labelXPath}`, { timeout: TIMEOUT_MS });
        log(`[GetXPathByLabel] 标签元素已找到: ${labelXPath}`);
        // 尝试获取标签元素的XPath
        const labelElementXPath = await this.getElementXPath(page, labelXPath, log);
        log(`[GetXPathByLabel] 获取到标签元素XPath: ${labelElementXPath}`);
        if (labelElementXPath) {
          // 查找标签后的控件元素
          const parentXPath = labelElementXPath.substring(0, labelElementXPath.lastIndexOf('/'));
          log(`[GetXPathByLabel] 标签元素父路径: ${parentXPath}`);

          // 尝试查找父元素下的控件
          const possibleControlXPath = `${parentXPath}//*[${controlXPath.replace('//', '')}]`;
          log(`[GetXPathByLabel] 检查父元素下的控件: ${possibleControlXPath}`);
          if (await this.elementExists(page, possibleControlXPath, log)) {
            log(`[GetXPathByLabel] 父元素下的控件存在，获取完整XPath: ${possibleControlXPath}`);
            const fullXPath = await this.getElementXPath(page, possibleControlXPath, log);
            if (fullXPath) {
              log(`[GetXPathByLabel] 找到父元素下的控件XPath: ${fullXPath}`);
              return { xpath: fullXPath, debugInfo };
            }
          }
        }
      } catch (e) {
        log(`[GetXPathByLabel] 未找到标签元素: ${labelXPath}，继续尝试下一个XPath`);
        // 如果找不到标签元素，继续尝试下一个XPath
        continue;
      }
    }

    // 5. 最后，直接查找包含标签文本的控件元素
    log(`[GetXPathByLabel] 策略5: 直接查找包含标签文本的控件元素`);
    let directControlXPath = '';
    if (controlType) {
      // 如果指定了控件类型，构建更具体的XPath
      const controlSelectors = controlXPath.replace('//', '').split(' | ');
      const conditions = controlSelectors.map(selector => {
        const tagName = selector.split('[')[0];
        return `self::${tagName}`;
      }).join(' or ');
      directControlXPath = `//*[contains(text(), '${label}') and (${conditions})]`;
    } else {
      // 如果未指定控件类型，使用原始的XPath
      directControlXPath = `//*[contains(text(), '${label}') and (${controlXPath.replace('//', '')})]`;
    }

    log(`[GetXPathByLabel] 检查直接查找的XPath: ${directControlXPath}`);
    if (await this.elementExists(page, directControlXPath, log)) {
      log(`[GetXPathByLabel] 直接查找的元素存在，获取完整XPath: ${directControlXPath}`);
      const fullXPath = await this.getElementXPath(page, directControlXPath, log);
      if (fullXPath) {
        log(`[GetXPathByLabel] 找到直接查找的元素XPath: ${fullXPath}`);
        return { xpath: fullXPath, debugInfo };
      }
    }

    log(`[GetXPathByLabel] 未能找到标签 "${label}" 的控件XPath`);
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

  /**
   * 获取元素的完整XPath
   * @param page Playwright页面对象
   * @param xpath XPath表达式
   * @param log 日志函数
   * @returns 完整的XPath或null
   */
  private async getElementXPath(page: Page, xpath: string, log: (message: string) => void): Promise<string | null> {
    try {
      log(`[getElementXPath] 获取元素的完整XPath: ${xpath}`);
      // 使用JavaScript函数获取元素的XPath
      const fullXPath = await page.waitForFunction((xpath) => {
        const element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (!element) return null;

        // 构建完整的XPath
        const getPathTo = (element: Node): string => {
          if (element.nodeType === Node.DOCUMENT_NODE) return '';
          if (element.nodeType === Node.ATTRIBUTE_NODE) {
            const attr = element as Attr;
            return getPathTo(attr.ownerElement!) + '/@' + attr.name;
          }

          if (element.parentNode == null) return '';

          let count = 1;
          let sibling = element.previousSibling;
          const tagName = (element as Element).tagName.toLowerCase();

          while (sibling) {
            if (sibling.nodeType === Node.ELEMENT_NODE && (sibling as Element).tagName.toLowerCase() === tagName) {
              count++;
            }
            sibling = sibling.previousSibling;
          }

          const path = getPathTo(element.parentNode) + '/' + tagName + (count > 1 ? '[' + count + ']' : '');
          return path;
        };

        return getPathTo(element);
      }, xpath, { timeout: TIMEOUT_MS });

      log(`[getElementXPath] 获取到的完整XPath: ${fullXPath}`);
      return fullXPath as any;
    } catch (e) {
      log(`[getElementXPath] 获取元素XPath时出错: ${e}`);
      // 捕获超时或其他错误，但不抛出异常
      return null;
    }
  }
}