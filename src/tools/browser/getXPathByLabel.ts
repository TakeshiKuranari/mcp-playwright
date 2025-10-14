import type { Page } from 'playwright';
import type { ToolContext } from '../common/types.js';
import { BrowserToolBase } from './base.js';
import { createErrorResponse, ToolResponse } from '../common/types.js';

/**
 * GetXPathByLabelTool - 根据字段标签获取控件XPath的工具
 */
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
      const xpath = await this.getXPathByLabel(page, label, controlType);

      if (!xpath) {
        return {
          content: [{
            type: "text",
            text: `未能找到标签为 "${label}" 的控件`,
          }],
          isError: false,
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ xpath }),
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
  private async getXPathByLabel(page: Page, label: string, controlType?: string): Promise<string | null> {
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
      `//*[contains(@title, '${label}')]`
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

    // 尝试不同的查找策略
    // 1. 查找与标签关联的控件 (通过for属性和id属性关联)
    const forAttributeXPath = `${labelXPaths[0]}/@for`;
    try {
      const forId = await page.locator(forAttributeXPath).first().getAttribute('for');
      if (forId) {
        const elementXPath = `//*[@id='${forId}']`;
        if (await this.elementExists(page, elementXPath)) {
          return elementXPath;
        }
      }
    } catch (e) {
      // 提示错误，继续尝试其他方法
      console.warn('Error getting XPath by label: forAttributeXPath:', forAttributeXPath, 'error:', e);
    }

    // 2. 查找标签后的兄弟元素中的控件
    for (const labelXPath of labelXPaths) {
      const siblingXPath = `${labelXPath}/following-sibling::*[1]${controlType ? `[self::${controlXPath.split(' | ')[0].replace('//', '').split('[')[0]}]` : ''}`;
      if (await this.elementExists(page, siblingXPath)) {
        const fullXPath = await this.getElementXPath(page, siblingXPath);
        if (fullXPath) return fullXPath;
      }
    }

    // 3. 查找标签内的子元素中的控件
    for (const labelXPath of labelXPaths) {
      const childXPath = `${labelXPath}//*[${controlXPath.replace('//', '').replace(' | ', ' | self::')}]`;
      if (await this.elementExists(page, childXPath)) {
        const fullXPath = await this.getElementXPath(page, childXPath);
        if (fullXPath) return fullXPath;
      }
    }

    // 4. 查找标签附近的控件 (使用CSS选择器查找相邻元素)
    for (const labelXPath of labelXPaths) {
      // 查找标签元素
      const labelElement = page.locator(labelXPath).first();
      if (await labelElement.count() > 0) {
        // 尝试获取标签元素的XPath
        const labelElementXPath = await this.getElementXPath(page, labelXPath);
        if (labelElementXPath) {
          // 查找标签后的控件元素
          const parentXPath = labelElementXPath.substring(0, labelElementXPath.lastIndexOf('/'));
          const index = labelElementXPath.substring(labelElementXPath.lastIndexOf('/') + 1);

          // 尝试查找父元素下的控件
          const possibleControlXPath = `${parentXPath}/*[${controlXPath.replace('//', '')}]`;
          if (await this.elementExists(page, possibleControlXPath)) {
            const fullXPath = await this.getElementXPath(page, possibleControlXPath);
            if (fullXPath) return fullXPath;
          }
        }
      }
    }

    // 5. 最后，直接查找包含标签文本的控件元素
    const directControlXPath = `//*[contains(text(), '${label}') and (${controlXPath.replace('//', '')})]`;
    if (await this.elementExists(page, directControlXPath)) {
      const fullXPath = await this.getElementXPath(page, directControlXPath);
      if (fullXPath) return fullXPath;
    }

    return null;
  }

  /**
   * 检查元素是否存在
   * @param page Playwright页面对象
   * @param xpath XPath表达式
   * @returns 元素是否存在
   */
  private async elementExists(page: Page, xpath: string): Promise<boolean> {
    try {
      const element = page.locator(`xpath=${xpath}`);
      return await element.count() > 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * 获取元素的完整XPath
   * @param page Playwright页面对象
   * @param xpath XPath表达式
   * @returns 完整的XPath或null
   */
  private async getElementXPath(page: Page, xpath: string): Promise<string | null> {
    try {
      // 使用JavaScript函数获取元素的XPath
      const fullXPath = await page.evaluate((xpath) => {
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
      }, xpath);

      return fullXPath;
    } catch (e) {
      return null;
    }
  }
}