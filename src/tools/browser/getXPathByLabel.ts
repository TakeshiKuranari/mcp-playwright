import type { Page } from 'playwright';
import type { ToolContext } from '../common/types.js';
import { BrowserToolBase } from './base.js';
import { createErrorResponse, ToolResponse } from '../common/types.js';

/**
 * GetXPathByLabelTool - 根据字段标签获取控件XPath的工具
 */
// 超时时间常量（毫秒）
const TIMEOUT_MS = 200;

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
    // 默认策略执行顺序
    const strategies = [
      // 策略1: 查找与标签关联的控件 (通过for属性和id属性关联)：没什么用的
      // this.findByForAttribute.bind(this),
      // 策略2: 查找标签后的兄弟元素中的控件
      this.findBySiblingElement.bind(this),
      // 策略3: 查找标签内的子元素中的控件：在大多数表单结构中会失败，因为输入框通常不在 label 内部。
      // this.findByChildElement.bind(this),
      // 策略4: 查找标签附近的控件 (使用CSS选择器查找相邻元素)
      this.findByNearbyElement.bind(this),
      // 策略5: 查找标签祖先节点下的控件元素
      this.findByAncestorElement.bind(this),
      // 策略6: 直接查找包含标签文本的控件元素
      this.findByDirectElement.bind(this)
    ];

    return this.executeStrategies(page, label, controlType, strategies);
  }

  /**
   * 执行策略方法，支持自定义策略顺序
   * @param page Playwright页面对象
   * @param label 字段标签名称
   * @param controlType 控件类型(可选)
   * @param strategies 策略执行顺序数组
   * @returns 控件的XPath或null
   */
  private async executeStrategies(
    page: Page,
    label: string,
    controlType: string | undefined,
    strategies: Array<(page: Page, label: string, controlType?: string) => Promise<{ xpath: string | null; debugInfo: string }>>
  ): Promise<{ xpath: string | null; debugInfo: string }> {
    let combinedDebugInfo = '';

    // 执行策略
    for (const strategy of strategies) {
      const result = await strategy(page, label, controlType);
      // 收集调试信息
      combinedDebugInfo += result.debugInfo + '\n';
      if (result.xpath) {
        return { xpath: result.xpath, debugInfo: combinedDebugInfo };
      }
    }

    return { xpath: null, debugInfo: combinedDebugInfo + '未能找到标签对应的控件' };
  }

  /**
   * 根据控件类型构建关联控件的XPath表达式
   * @param controlType 控件类型
   * @returns 控件的XPath表达式
   */
  private getControlXPath(controlType?: string): string {
    switch (controlType) {
      case '输入框':
        return "//input | //textarea";
      case '下拉框':
        return "//select";
      case '复选框':
        return "//input[@type='checkbox']";
      case '单选按钮':
        return "//input[@type='radio']";
      default:
        return "//input | //textarea | //select | //button | //*[@role='button'] | //*[@role='combobox']";
    }
  }

  /**
   * 标准标签元素的XPath表达式
   */
  private getLabelXPaths(label: string): string[] {
    return [
      // 优先全匹配
      `//label[text()='${label}']`,
      `//*[text()='${label}']`,
      // 再模糊匹配
      `//label[contains(text(), '${label}')]`,
      `//*[contains(text(), '${label}')]`,
    ];
  }

  /**
   * 策略1: 查找与标签关联的控件 (通过for属性和id属性关联)
   */
  private async findByForAttribute(page: Page, label: string, controlType?: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[findByForAttribute] 策略1: 查找与标签关联的控件 (通过for属性和id属性关联)`);

    // 标准标签元素的XPath表达式
    const labelXPaths = this.getLabelXPaths(label);

    // 根据控件类型构建关联控件的XPath表达式
    const controlXPath = this.getControlXPath(controlType);

    const forAttributeXPath = `${labelXPaths[0]}/@for`;
    try {
      log(`[findByForAttribute] 等待标签元素出现并获取for属性: ${forAttributeXPath}`);
      // 先等待元素出现，设置超时
      await page.waitForSelector(`xpath=${labelXPaths[0]}`, { timeout: TIMEOUT_MS });
      // 然后获取for属性，增加超时保护
      const forId = await Promise.race([
        page.locator(forAttributeXPath).first().getAttribute('for'),
        new Promise<null>(resolve => setTimeout(() => resolve(null), TIMEOUT_MS))
      ]);
      log(`[findByForAttribute] 获取到的for属性值: ${forId}`);
      if (forId) {
        const elementXPath = `//*[@id='${forId}']`;
        log(`[findByForAttribute] 检查元素是否存在: ${elementXPath}`);
        if (await this.elementExists(page, elementXPath, log)) {
          log(`[findByForAttribute] 找到元素XPath，返回定位XPath: ${elementXPath}`);
          // 直接返回定位XPath
          return { xpath: elementXPath, debugInfo };
        }
      }
    } catch (e) {
      // 提示错误，继续尝试其他方法
      log(`Error getting XPath by label: forAttributeXPath: ${forAttributeXPath}, error: ${e}`);
    }

    return { xpath: null, debugInfo };
  }

  /**
   * 策略2: 查找标签后的兄弟元素中的控件
   */
  private async findBySiblingElement(page: Page, label: string, controlType?: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[findBySiblingElement] 策略2: 查找标签后的兄弟元素中的控件`);

    // 标准标签元素的XPath表达式
    const labelXPaths = this.getLabelXPaths(label);

    // 根据控件类型构建关联控件的XPath表达式
    const controlXPath = this.getControlXPath(controlType);

    // 查找标签后的兄弟元素中的控件
    log(`[findBySiblingElement] 查找标签后的兄弟元素中的控件`);
    for (const labelXPath of labelXPaths) {
      // 构建更准确的兄弟元素XPath
      let siblingXPath = '';
      if (controlType) {
        // 如果指定了控件类型，构建更具体的XPath
        const controlTag = controlXPath.split(' | ')[0].replace('//', '').split('[')[0];
        siblingXPath = `${labelXPath}/following-sibling::*[1]/${controlTag}`;
      } else {
        // 如果未指定控件类型，使用通用的XPath
        siblingXPath = `${labelXPath}/following-sibling::*[1]`;
      }

      log(`[findBySiblingElement] 检查兄弟元素XPath: ${siblingXPath}`);
      if (await this.elementExists(page, siblingXPath, log)) {
        log(`[findBySiblingElement] 兄弟元素存在，返回定位XPath: ${siblingXPath}`);
        // 直接返回定位XPath，而不是获取完整XPath
        return { xpath: siblingXPath, debugInfo };
      }
    }

    return { xpath: null, debugInfo };
  }

  /**
   * 策略3: 查找标签内的子元素中的控件
   */
  private async findByChildElement(page: Page, label: string, controlType?: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[findByChildElement] 策略3: 查找标签内的子元素中的控件`);

    // 标准标签元素的XPath表达式
    const labelXPaths = this.getLabelXPaths(label);

    // 根据控件类型构建关联控件的XPath表达式
    const controlXPath = this.getControlXPath(controlType);

    // 查找标签内的子元素中的控件
    log(`[findByChildElement] 查找标签内的子元素中的控件`);
    for (const labelXPath of labelXPaths) {
      // 构建更准确的子元素XPath
      let childXPath = '';
      if (controlType) {
        // 如果指定了控件类型，构建更具体的XPath
        const controlSelectors = controlXPath.replace(/\/\//g, '').split(' | ');
        const conditions = controlSelectors.map(selector => `self::${selector.split('[')[0]}`).join(' or ');
        childXPath = `${labelXPath}//*[${conditions}]`;
      } else {
        // 如果未指定控件类型，使用原始的XPath
        childXPath = `${labelXPath}//*[${controlXPath.replace(/\/\//g, '').replace(' | ', ' | self::')}]`;
      }

      log(`[findByChildElement] 检查子元素XPath: ${childXPath}`);
      if (await this.elementExists(page, childXPath, log)) {
        log(`[findByChildElement] 子元素存在，返回定位XPath: ${childXPath}`);
        // 直接返回定位XPath，而不是获取完整XPath
        return { xpath: childXPath, debugInfo };
      }
    }

    return { xpath: null, debugInfo };
  }

  /**
   * 策略4: 查找标签附近的控件 (使用CSS选择器查找相邻元素)
   */
  private async findByNearbyElement(page: Page, label: string, controlType?: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[findByNearbyElement] 策略4: 查找标签附近的控件 (使用CSS选择器查找相邻元素)`);

    // 标准标签元素的XPath表达式
    const labelXPaths = this.getLabelXPaths(label);

    // 根据控件类型构建关联控件的XPath表达式
    const controlXPath = this.getControlXPath(controlType);

    // 查找标签附近的控件 (使用CSS选择器查找相邻元素)
    log(`[findByNearbyElement] 查找标签附近的控件 (使用CSS选择器查找相邻元素)`);
    for (const labelXPath of labelXPaths) {
      // 查找标签元素
      try {
        log(`[findByNearbyElement] 等待标签元素出现: ${labelXPath}`);
        await page.waitForSelector(`xpath=${labelXPath}`, { timeout: TIMEOUT_MS });
        log(`[findByNearbyElement] 标签元素已找到: ${labelXPath}`);
        // 尝试获取标签元素的XPath
        const labelElementXPath = await this.getElementXPath(page, labelXPath, log);
        log(`[findByNearbyElement] 获取到标签元素XPath: ${labelElementXPath}`);
        if (labelElementXPath) {
          // 查找标签后的控件元素
          const parentXPath = labelElementXPath.substring(0, labelElementXPath.lastIndexOf('/'));
          log(`[findByNearbyElement] 标签元素父路径: ${parentXPath}`);

          // 尝试查找父元素下的控件
          const possibleControlXPath = `${parentXPath}//*[${controlXPath.replace(/\/\//g, '')}]`;
          log(`[findByNearbyElement] 检查父元素下的控件: ${possibleControlXPath}`);
          if (await this.elementExists(page, possibleControlXPath, log)) {
            log(`[findByNearbyElement] 父元素下的控件存在，返回定位XPath: ${possibleControlXPath}`);
            // 直接返回定位XPath，而不是获取完整XPath
            return { xpath: possibleControlXPath, debugInfo };
          }
        }
      } catch (e) {
        log(`[findByNearbyElement] 未找到标签元素: ${labelXPath}，继续尝试下一个XPath`);
        // 如果找不到标签元素，继续尝试下一个XPath
        continue;
      }
    }

    return { xpath: null, debugInfo };
  }

  /**
   * 策略5: 查找标签祖先节点下的控件元素
   */
  private async findByAncestorElement(page: Page, label: string, controlType?: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[findByAncestorElement] 策略5: 查找标签祖先节点下的控件元素`);

    // 标准标签元素的XPath表达式
    const labelXPaths = this.getLabelXPaths(label);

    // 根据控件类型构建关联控件的XPath表达式
    const controlXPath = this.getControlXPath(controlType);

    // 查找标签祖先节点下的控件元素
    log(`[findByAncestorElement] 查找标签祖先节点下的控件元素`);
    for (const labelXPath of labelXPaths) {
      try {
        log(`[findByAncestorElement] 等待标签元素出现: ${labelXPath}`);
        await page.waitForSelector(`xpath=${labelXPath}`, { timeout: TIMEOUT_MS });
        log(`[findByAncestorElement] 标签元素已找到: ${labelXPath}`);

        // 使用XPath的ancestor轴来查找祖先节点下的控件元素
        // 查找标签元素的祖先节点中的控件元素
        const ancestorControlXPath = `${labelXPath}//ancestor::*[1]//*[${controlXPath.replace(/\/\//g, '')}]`;
        log(`[findByAncestorElement] 在标签祖先节点下查找控件: ${ancestorControlXPath}`);

        if (await this.elementExists(page, ancestorControlXPath, log)) {
          log(`[findByAncestorElement] 找到祖先节点下的控件XPath，返回定位XPath: ${ancestorControlXPath}`);
          // 直接返回定位XPath，而不是获取完整XPath
          return { xpath: ancestorControlXPath, debugInfo };
        }

        // 也可以尝试查找更上层的祖先节点
        const ancestorControlXPath2 = `${labelXPath}//ancestor::*[2]//*[${controlXPath.replace(/\/\//g, '')}]`;
        log(`[findByAncestorElement] 在标签更上层祖先节点下查找控件: ${ancestorControlXPath2}`);

        if (await this.elementExists(page, ancestorControlXPath2, log)) {
          log(`[findByAncestorElement] 找到更上层祖先节点下的控件XPath，返回定位XPath: ${ancestorControlXPath2}`);
          // 直接返回定位XPath，而不是获取完整XPath
          return { xpath: ancestorControlXPath2, debugInfo };
        }
      } catch (e) {
        log(`[findByAncestorElement] 查找标签祖先节点下的控件时出错: ${e}`);
        // 继续尝试下一个标签XPath
        continue;
      }
    }

    return { xpath: null, debugInfo };
  }

  /**
   * 策略6: 直接查找包含标签文本的控件元素
   */
  private async findByDirectElement(page: Page, label: string, controlType?: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[findByDirectElement] 策略6: 直接查找包含标签文本的控件元素`);

    // 根据控件类型构建关联控件的XPath表达式
    const controlXPath = this.getControlXPath(controlType);

    // 最后，直接查找包含标签文本的控件元素
    log(`[findByDirectElement] 最后，直接查找包含标签文本的控件元素`);
    let directControlXPath = '';
    if (controlType) {
      // 如果指定了控件类型，构建更具体的XPath
      const controlSelectors = controlXPath.replace(/\/\//g, '').split(' | ');
      const conditions = controlSelectors.map(selector => {
        const tagName = selector.split('[')[0];
        return `self::${tagName}`;
      }).join(' or ');
      directControlXPath = `//*[contains(text(), '${label}') and (${conditions})]`;
    } else {
      // 如果未指定控件类型，使用原始的XPath
      directControlXPath = `//*[contains(text(), '${label}') and (${controlXPath.replace(/\/\//g, '')})]`;
    }

    log(`[findByDirectElement] 检查直接查找的XPath: ${directControlXPath}`);
    if (await this.elementExists(page, directControlXPath, log)) {
      log(`[findByDirectElement] 直接查找的元素存在，返回定位XPath: ${directControlXPath}`);
      // 直接返回定位XPath，而不是获取完整XPath
      return { xpath: directControlXPath, debugInfo };
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

      // 获取实际的字符串值
      const xpathValue = await fullXPath.jsonValue();
      log(`[getElementXPath] 获取到的完整XPath: ${xpathValue}`);
      return xpathValue as string;
    } catch (e) {
      log(`[getElementXPath] 获取元素XPath时出错: ${e}`);
      // 捕获超时或其他错误，但不抛出异常
      return null;
    }
  }
}