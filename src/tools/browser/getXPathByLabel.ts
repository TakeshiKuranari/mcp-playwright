import type { Page } from 'playwright';
import type { ToolContext } from '../common/types.js';
import { BrowserToolBase } from './base.js';
import { createErrorResponse, ToolResponse } from '../common/types.js';

/**
 * GetXPathByLabelTool - 根据字段标签获取控件XPath的工具
 */
// 超时时间常量（毫秒）
const TIMEOUT_MS = 100;

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
    // 默认策略执行顺序 - 优化后的顺序
    const strategies = [
      // 策略1: 基于锚点的稳定定位策略（新增）
      this.findByAnchorElement.bind(this),
      // 策略2: 查找标签后的兄弟元素中的控件
      this.findBySiblingElement.bind(this),
      // 策略3: 查找标签祖先节点下的控件元素
      this.findByAncestorElement.bind(this),
      // 策略4: 查找与标签关联的控件 (通过for属性和id属性关联)
      this.findByForAttribute.bind(this),
      // 策略5: 查找标签内的子元素中的控件
      this.findByChildElement.bind(this),
      // 策略6: 查找标签附近的控件 (使用CSS选择器查找相邻元素)
      this.findByNearbyElement.bind(this),
      // 策略7: 直接查找包含标签文本的控件元素
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
   * 根据控件类型构建关联控件的XPath表达式 - 增强版
   * 组合使用多重属性以增强稳定性，避免依赖易变的属性
   * @param controlType 控件类型
   * @returns 控件的XPath表达式
   */
  private getControlXPath(controlType?: string): string {
    switch (controlType) {
      case '输入框':
        // 避免依赖易变的class属性，优先使用更稳定的属性
        return "self::input[not(@type='hidden' or @type='submit' or @type='button' or @type='reset') and not(contains(@style, 'display: none'))] | self::textarea[not(contains(@style, 'display: none'))]";
      case '下拉框':
        return "self::select[not(contains(@style, 'display: none'))]";
      case '复选框':
        return "self::input[@type='checkbox' and not(contains(@style, 'display: none'))]";
      case '单选按钮':
        return "self::input[@type='radio' and not(contains(@style, 'display: none'))]";
      case '按钮':
        // 更严格的按钮匹配，只匹配真正的按钮元素，不匹配按钮样式的链接
        return "self::button[not(contains(@style, 'display: none'))] | self::input[@type='button' or @type='submit' or @type='reset'] | self::*[@role='button' and not(contains(@style, 'display: none'))]";
      default:
        // 默认情况下，返回更稳定的控件表达式
        return "self::input[not(@type='hidden') and not(contains(@style, 'display: none'))] | self::textarea[not(contains(@style, 'display: none'))] | self::select[not(contains(@style, 'display: none'))] | self::button[not(contains(@style, 'display: none'))] | self::*[@role='button' and not(contains(@style, 'display: none'))] | self::*[@role='combobox' and not(contains(@style, 'display: none'))]";
    }
  }

  /**
   * 标准标签元素的XPath表达式 - 增强版
   * 结合多种稳定属性以增强稳定性
   */
  private getLabelXPaths(label: string): string[] {
    return [
      // 优先全匹配
      `//label[text()='${label}']`,
      `//*[text()='${label}' and (@id or self::label)]`,
      // 再模糊匹配
      `//label[contains(text(), '${label}')]`,
      `//*[contains(text(), '${label}') and (@id or self::label)]`,
      // 使用结构性定位
      `//*[text()='${label}' or @*[.='${label}']]`,
      // 更宽松的匹配
      `//*[contains(., '${label}') and (self::label or @id)]`,
      // 通用匹配
      `//*[text()='${label}']`,
      `//*[contains(text(), '${label}')]`,
    ];
  }

  /**
   * 策略4: 查找与标签关联的控件 (通过id属性关联) - 增强版
   * 增强稳定性，提供更多查找方式
   */
  private async findByForAttribute(page: Page, label: string, controlType?: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[findByForAttribute] 策略4: 查找与标签关联的控件 (通过id属性关联)（增强版）`);

    // 标准标签元素的XPath表达式
    const labelXPaths = this.getLabelXPaths(label);

    // 根据控件类型构建关联控件的XPath表达式
    const controlXPath = this.getControlXPath(controlType);

    // 尝试多种标签XPath表达式
    for (const labelXPath of labelXPaths) {
      try {
        log(`[findByForAttribute] 等待标签元素出现: ${labelXPath}`);
        // 先等待元素出现，设置超时
        await page.waitForSelector(`xpath=${labelXPath}`, { timeout: TIMEOUT_MS });

        // 策略1: 查找标签元素的id属性
        const labelId = await page.locator(`xpath=${labelXPath}`).first().getAttribute('id');
        log(`[findByForAttribute] 获取标签元素的id属性: ${labelId}`);
        if (labelId) {
          // 构建控件XPath，查找aria-labelledby属性等于标签id的控件
          const elementXPath = `//*[@aria-labelledby='${labelId}'][${controlXPath}]`;
          log(`[findByForAttribute] 检查关联控件是否存在: ${elementXPath}`);
          if (await this.elementExists(page, elementXPath, log)) {
            log(`[findByForAttribute] 找到关联控件，返回定位XPath: ${elementXPath}`);
            return { xpath: elementXPath, debugInfo };
          }

          // 如果上面的方式没找到，尝试更宽松的匹配
          const fallbackXPath = `//*[@aria-labelledby='${labelId}']`;
          log(`[findByForAttribute] 尝试宽松匹配: ${fallbackXPath}`);
          if (await this.elementExists(page, fallbackXPath, log)) {
            log(`[findByForAttribute] 找到关联控件(宽松匹配)，返回定位XPath: ${fallbackXPath}`);
            return { xpath: fallbackXPath, debugInfo };
          }
        }

        // 策略2: 查找标签文本与控件value属性匹配的控件
        const textControlXPath = `//*[@value='${label}'][${controlXPath}]`;
        log(`[findByForAttribute] 查找value属性匹配的控件: ${textControlXPath}`);
        if (await this.elementExists(page, textControlXPath, log)) {
          log(`[findByForAttribute] 找到value属性匹配的控件，返回定位XPath: ${textControlXPath}`);
          return { xpath: textControlXPath, debugInfo };
        }

        // 策略3: 查找标签文本与控件aria-label属性匹配的控件
        const ariaLabelXPath = `//*[@aria-label='${label}'][${controlXPath}]`;
        log(`[findByForAttribute] 查找aria-label属性匹配的控件: ${ariaLabelXPath}`);
        if (await this.elementExists(page, ariaLabelXPath, log)) {
          log(`[findByForAttribute] 找到aria-label属性匹配的控件，返回定位XPath: ${ariaLabelXPath}`);
          return { xpath: ariaLabelXPath, debugInfo };
        }
      } catch (e) {
        // 提示错误，继续尝试其他方法
        log(`[findByForAttribute] 获取标签属性时出错: ${e}`);
        continue;
      }
    }

    return { xpath: null, debugInfo };
  }

  /**
   * 策略1: 查找标签后的兄弟元素中的控件 - 增强版
   * 使用结构性下标而非具体文本值，增强稳定性
   */
  private async findBySiblingElement(page: Page, label: string, controlType?: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[findBySiblingElement] 策略2: 查找标签后的兄弟元素中的控件（增强版）`);

    // 标准标签元素的XPath表达式
    const labelXPaths = this.getLabelXPaths(label);

    // 根据控件类型构建关联控件的XPath表达式
    const controlXPath = this.getControlXPath(controlType);

    // 查找标签后的兄弟元素中的控件
    log(`[findBySiblingElement] 查找标签后的兄弟元素中的控件`);
    for (const labelXPath of labelXPaths) {
      // 策略1: 查找标签后紧邻的兄弟元素中的控件
      let siblingXPath = `${labelXPath}/following-sibling::*[1]//*[${controlXPath}]`;
      log(`[findBySiblingElement] 检查标签后紧邻兄弟元素中的控件: ${siblingXPath}`);
      if (await this.elementExists(page, siblingXPath, log)) {
        log(`[findBySiblingElement] 找到标签后紧邻兄弟元素中的控件，返回定位XPath: ${siblingXPath}`);
        return { xpath: siblingXPath, debugInfo };
      }

      // 策略2: 查找标签后几个兄弟元素中的控件（增强容错性）
      siblingXPath = `${labelXPath}/following-sibling::*[position()<=3]//*[${controlXPath}][1]`;
      log(`[findBySiblingElement] 检查标签后多个兄弟元素中的控件: ${siblingXPath}`);
      if (await this.elementExists(page, siblingXPath, log)) {
        log(`[findBySiblingElement] 找到标签后多个兄弟元素中的控件，返回定位XPath: ${siblingXPath}`);
        return { xpath: siblingXPath, debugInfo };
      }

      // 策略3: 查找标签后兄弟元素中的直接控件
      siblingXPath = `${labelXPath}/following-sibling::*[position()<=2][${controlXPath}]`;
      log(`[findBySiblingElement] 检查标签后兄弟元素中的直接控件: ${siblingXPath}`);
      if (await this.elementExists(page, siblingXPath, log)) {
        log(`[findBySiblingElement] 找到标签后兄弟元素中的直接控件，返回定位XPath: ${siblingXPath}`);
        return { xpath: siblingXPath, debugInfo };
      }
    }

    return { xpath: null, debugInfo };
  }

  /**
   * 策略3: 查找标签内的子元素中的控件 - 增强版
   * 增强对嵌套结构的适应性
   */
  private async findByChildElement(page: Page, label: string, controlType?: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[findByChildElement] 策略5: 查找标签内的子元素中的控件（增强版）`);

    // 标准标签元素的XPath表达式
    const labelXPaths = this.getLabelXPaths(label);

    // 根据控件类型构建关联控件的XPath表达式
    const controlXPath = this.getControlXPath(controlType);

    // 查找标签内的子元素中的控件
    log(`[findByChildElement] 查找标签内的子元素中的控件`);
    for (const labelXPath of labelXPaths) {
      try {
        log(`[findByChildElement] 等待标签元素出现: ${labelXPath}`);
        await page.waitForSelector(`xpath=${labelXPath}`, { timeout: TIMEOUT_MS });

        // 策略1: 查找标签内的直接子元素控件
        let childXPath = `${labelXPath}/*[${controlXPath}]`;
        log(`[findByChildElement] 检查标签内直接子元素控件: ${childXPath}`);
        if (await this.elementExists(page, childXPath, log)) {
          log(`[findByChildElement] 标签内直接子元素控件存在，返回定位XPath: ${childXPath}`);
          return { xpath: childXPath, debugInfo };
        }

        // 策略2: 查找标签内的后代元素控件
        childXPath = `${labelXPath}//*[${controlXPath} and not(self::label)]`;
        log(`[findByChildElement] 检查标签内后代元素控件: ${childXPath}`);
        if (await this.elementExists(page, childXPath, log)) {
          log(`[findByChildElement] 标签内后代元素控件存在，返回定位XPath: ${childXPath}`);
          return { xpath: childXPath, debugInfo };
        }

        // 策略3: 使用更灵活的匹配方式
        childXPath = `${labelXPath}//*[${controlXPath}]`;
        log(`[findByChildElement] 检查标签内任意子元素控件: ${childXPath}`);
        if (await this.elementExists(page, childXPath, log)) {
          log(`[findByChildElement] 标签内任意子元素控件存在，返回定位XPath: ${childXPath}`);
          return { xpath: childXPath, debugInfo };
        }

        // 策略4: 对于按钮类型控件的特殊处理
        if (controlType === '按钮') {
          // 查找标签内的按钮元素，不依赖具体文本
          childXPath = `${labelXPath}//*[(@value or @aria-label or text() or @title) and (${controlXPath})]`;
          log(`[findByChildElement] 检查标签内按钮元素: ${childXPath}`);
          if (await this.elementExists(page, childXPath, log)) {
            log(`[findByChildElement] 标签内按钮元素存在，返回定位XPath: ${childXPath}`);
            return { xpath: childXPath, debugInfo };
          }
        }
      } catch (e) {
        log(`[findByChildElement] 查找标签内子元素时出错: ${e}`);
        continue;
      }
    }

    return { xpath: null, debugInfo };
  }

  /**
   * 策略4: 查找标签附近的控件 (使用CSS选择器查找相邻元素) - 增强版
   * 增强容错性和查找能力
   */
  private async findByNearbyElement(page: Page, label: string, controlType?: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[findByNearbyElement] 策略6: 查找标签附近的控件 (使用CSS选择器查找相邻元素)（增强版）`);

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

        // 策略1: 查找标签父元素下的控件（改进版）
        const parentControlXPath = `${labelXPath}/parent::*//*[${controlXPath} and not(ancestor::*[self::label or self::*[text()='${label}']])][position()<=5]`;
        log(`[findByNearbyElement] 检查父元素下的控件(改进版): ${parentControlXPath}`);
        if (await this.elementExists(page, parentControlXPath, log)) {
          log(`[findByNearbyElement] 父元素下的控件存在，返回定位XPath: ${parentControlXPath}`);
          return { xpath: parentControlXPath, debugInfo };
        }

        // 策略2: 查找标签祖父元素下的控件
        const grandParentControlXPath = `${labelXPath}/parent::*/parent::*//*[${controlXPath} and not(ancestor::*[self::label or self::*[text()='${label}']])][position()<=10]`;
        log(`[findByNearbyElement] 检查祖父元素下的控件: ${grandParentControlXPath}`);
        if (await this.elementExists(page, grandParentControlXPath, log)) {
          log(`[findByNearbyElement] 祖父元素下的控件存在，返回定位XPath: ${grandParentControlXPath}`);
          return { xpath: grandParentControlXPath, debugInfo };
        }

        // 策略3: 查找标签容器元素下的控件（更宽松的匹配）
        const containerControlXPath = `${labelXPath}/ancestor::*[position()<=3]//*[${controlXPath} and not(self::label)][position()<=10]`;
        log(`[findByNearbyElement] 检查容器元素下的控件: ${containerControlXPath}`);
        if (await this.elementExists(page, containerControlXPath, log)) {
          log(`[findByNearbyElement] 容器元素下的控件存在，返回定位XPath: ${containerControlXPath}`);
          return { xpath: containerControlXPath, debugInfo };
        }

        // 策略4: 使用结构性定位查找附近的控件
        const nearbyControlXPath = `${labelXPath}/following::*[${controlXPath}][position()<=5] | ${labelXPath}/preceding::*[${controlXPath}][position()<=5]`;
        log(`[findByNearbyElement] 检查附近元素中的控件: ${nearbyControlXPath}`);
        if (await this.elementExists(page, nearbyControlXPath, log)) {
          log(`[findByNearbyElement] 附近元素中的控件存在，返回定位XPath: ${nearbyControlXPath}`);
          return { xpath: nearbyControlXPath, debugInfo };
        }
      } catch (e) {
        log(`[findByNearbyElement] 查找标签附近控件时出错: ${labelXPath}，继续尝试下一个XPath`);
        // 如果找不到标签元素，继续尝试下一个XPath
        continue;
      }
    }

    return { xpath: null, debugInfo };
  }

  /**
   * 策略2: 查找标签祖先节点下的控件元素 - 增强版
   * 使用ancestor轴和descendant轴进行更精确的查找
   */
  private async findByAncestorElement(page: Page, label: string, controlType?: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[findByAncestorElement] 策略3: 查找标签祖先节点下的控件元素（增强版）`);

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

        // 策略1: 查找标签后的兄弟元素中的控件（更精确的定位）
        const followingSiblingXPath = `${labelXPath}/following-sibling::input[not(@type='hidden' or @type='submit' or @type='button' or @type='reset') and not(contains(@style, 'display: none'))] | ${labelXPath}/following-sibling::textarea[not(contains(@style, 'display: none'))]`;
        log(`[findByAncestorElement] 在标签后查找input/textarea控件: ${followingSiblingXPath}`);
        if (await this.elementExists(page, followingSiblingXPath, log)) {
          log(`[findByAncestorElement] 找到标签后input/textarea控件，返回定位XPath: ${followingSiblingXPath}`);
          return { xpath: followingSiblingXPath, debugInfo };
        }

        // 策略2: 查找标签祖先节点中的控件（使用self::精确匹配）
        const ancestorControlXPath = `${labelXPath}/ancestor::*[position()<=2]//self::input[not(@type='hidden' or @type='submit' or @type='button' or @type='reset') and not(contains(@style, 'display: none'))] | ${labelXPath}/ancestor::*[position()<=2]//self::textarea[not(contains(@style, 'display: none'))]`;
        log(`[findByAncestorElement] 在祖先节点中查找input/textarea控件: ${ancestorControlXPath}`);
        if (await this.elementExists(page, ancestorControlXPath, log)) {
          log(`[findByAncestorElement] 找到祖先节点中的input/textarea控件，返回定位XPath: ${ancestorControlXPath}`);
          return { xpath: ancestorControlXPath, debugInfo };
        }

        // 策略3: 查找标签直接父元素下的控件
        const parentControlXPath = `${labelXPath}/parent::*//*[self::input or self::textarea][not(@type='hidden' or @type='submit' or @type='button' or @type='reset') and not(contains(@style, 'display: none'))]`;
        log(`[findByAncestorElement] 在标签父元素下查找input/textarea控件: ${parentControlXPath}`);
        if (await this.elementExists(page, parentControlXPath, log)) {
          log(`[findByAncestorElement] 找到父元素下的input/textarea控件，返回定位XPath: ${parentControlXPath}`);
          return { xpath: parentControlXPath, debugInfo };
        }

        // 策略4: 查找标签祖先节点中的控件（第一层祖先）
        const ancestorControlXPath1 = `${labelXPath}/ancestor::*[1]//*[self::input or self::textarea][not(@type='hidden' or @type='submit' or @type='button' or @type='reset') and not(contains(@style, 'display: none'))]`;
        log(`[findByAncestorElement] 在标签第一层祖先节点下查找input/textarea控件: ${ancestorControlXPath1}`);
        if (await this.elementExists(page, ancestorControlXPath1, log)) {
          log(`[findByAncestorElement] 找到第一层祖先节点下的input/textarea控件，返回定位XPath: ${ancestorControlXPath1}`);
          return { xpath: ancestorControlXPath1, debugInfo };
        }

        // 策略5: 查找标签祖先节点中的控件（第二层祖先）
        const ancestorControlXPath2 = `${labelXPath}/ancestor::*[2]//*[self::input or self::textarea][not(@type='hidden' or @type='submit' or @type='button' or @type='reset') and not(contains(@style, 'display: none'))]`;
        log(`[findByAncestorElement] 在标签第二层祖先节点下查找input/textarea控件: ${ancestorControlXPath2}`);
        if (await this.elementExists(page, ancestorControlXPath2, log)) {
          log(`[findByAncestorElement] 找到第二层祖先节点下的input/textarea控件，返回定位XPath: ${ancestorControlXPath2}`);
          return { xpath: ancestorControlXPath2, debugInfo };
        }

        // 策略6: 查找标签父元素的直接子元素中的控件
        const parentDirectControlXPath = `${labelXPath}/parent::*/*[self::input or self::textarea][not(@type='hidden' or @type='submit' or @type='button' or @type='reset') and not(contains(@style, 'display: none'))]`;
        log(`[findByAncestorElement] 在标签父元素的直接子元素中查找input/textarea控件: ${parentDirectControlXPath}`);
        if (await this.elementExists(page, parentDirectControlXPath, log)) {
          log(`[findByAncestorElement] 找到父元素直接子元素中的input/textarea控件，返回定位XPath: ${parentDirectControlXPath}`);
          return { xpath: parentDirectControlXPath, debugInfo };
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
   * 策略7: 直接查找包含标签文本的控件元素 - 增强版
   * 使用更灵活的匹配方式，兼容不同HTML结构
   */
  private async findByDirectElement(page: Page, label: string, controlType?: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[findByDirectElement] 策略7: 直接查找包含标签文本的控件元素（增强版）`);

    // 根据控件类型构建关联控件的XPath表达式
    const controlXPath = this.getControlXPath(controlType);

    // 策略1: 查找包含标签文本的控件元素（经典方式）
    log(`[findByDirectElement] 查找包含标签文本的控件元素（经典方式）`);
    let directControlXPath = `//*[contains(text(), '${label}') and (${controlXPath})]`;
    log(`[findByDirectElement] 检查直接查找的XPath: ${directControlXPath}`);
    if (await this.elementExists(page, directControlXPath, log)) {
      log(`[findByDirectElement] 直接查找的元素存在，返回定位XPath: ${directControlXPath}`);
      return { xpath: directControlXPath, debugInfo };
    }

    // 策略2: 查找包含标签文本的控件元素（更宽松的匹配）
    directControlXPath = `//*[contains(., '${label}') and (${controlXPath})]`;
    log(`[findByDirectElement] 检查更宽松匹配的XPath: ${directControlXPath}`);
    if (await this.elementExists(page, directControlXPath, log)) {
      log(`[findByDirectElement] 更宽松匹配的元素存在，返回定位XPath: ${directControlXPath}`);
      return { xpath: directControlXPath, debugInfo };
    }

    // 策略3: 查找包含标签文本的控件元素（在子元素中查找）
    directControlXPath = `//*[contains(text(), '${label}')]//*[${controlXPath}]`;
    log(`[findByDirectElement] 检查标签内子元素中的控件XPath: ${directControlXPath}`);
    if (await this.elementExists(page, directControlXPath, log)) {
      log(`[findByDirectElement] 标签内子元素中的控件存在，返回定位XPath: ${directControlXPath}`);
      return { xpath: directControlXPath, debugInfo };
    }

    // 策略4: 为按钮类型控件使用更灵活的匹配方式
    if (controlType === '按钮') {
      // 查找按钮元素，不依赖具体文本
      const buttonXPath = `//*[(@value='${label}' or @aria-label='${label}' or text()='${label}' or contains(text(), '${label}') or @title='${label}') and (${controlXPath})]`;
      log(`[findByDirectElement] 检查按钮元素的XPath: ${buttonXPath}`);
      if (await this.elementExists(page, buttonXPath, log)) {
        log(`[findByDirectElement] 按钮元素存在，返回定位XPath: ${buttonXPath}`);
        return { xpath: buttonXPath, debugInfo };
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

  /**
   * 策略0: 基于锚点的稳定定位策略（新增）
   * 利用稳定的"锚点"进行相对定位，使用following-sibling::、preceding-sibling::等轴
   */
  private async findByAnchorElement(page: Page, label: string, controlType?: string): Promise<{ xpath: string | null; debugInfo: string }> {
    let debugInfo = '';
    const log = (message: string) => {
      debugInfo += message + '\n';
      console.log(message);
    };

    log(`[findByAnchorElement] 策略0: 基于锚点的稳定定位策略`);

    // 标准标签元素的XPath表达式
    const labelXPaths = this.getLabelXPaths(label);

    // 根据控件类型构建关联控件的XPath表达式
    const controlXPath = this.getControlXPath(controlType);

    // 查找基于锚点的控件
    log(`[findByAnchorElement] 查找基于锚点的控件`);
    for (const labelXPath of labelXPaths) {
      try {
        log(`[findByAnchorElement] 等待标签元素出现: ${labelXPath}`);
        await page.waitForSelector(`xpath=${labelXPath}`, { timeout: TIMEOUT_MS });
        log(`[findByAnchorElement] 标签元素已找到: ${labelXPath}`);

        // 策略1: 查找标签后的兄弟元素中的控件（增强版）
        // 使用结构性下标而非具体文本值
        const followingSiblingXPath = `${labelXPath}/following-sibling::*[position()<=3]//*[${controlXPath}]`;
        log(`[findByAnchorElement] 检查标签后兄弟元素中的控件: ${followingSiblingXPath}`);
        if (await this.elementExists(page, followingSiblingXPath, log)) {
          log(`[findByAnchorElement] 找到标签后兄弟元素中的控件，返回定位XPath: ${followingSiblingXPath}`);
          return { xpath: followingSiblingXPath, debugInfo };
        }

        // 策略2: 查找标签前的兄弟元素中的控件
        const precedingSiblingXPath = `${labelXPath}/preceding-sibling::*[position()<=3]//*[${controlXPath}]`;
        log(`[findByAnchorElement] 检查标签前兄弟元素中的控件: ${precedingSiblingXPath}`);
        if (await this.elementExists(page, precedingSiblingXPath, log)) {
          log(`[findByAnchorElement] 找到标签前兄弟元素中的控件，返回定位XPath: ${precedingSiblingXPath}`);
          return { xpath: precedingSiblingXPath, debugInfo };
        }

        // 策略3: 查找标签父元素下的控件
        const parentControlXPath = `${labelXPath}/parent::*//*[${controlXPath} and not(ancestor::*[self::label or self::*[text()='${label}']])][1]`;
        log(`[findByAnchorElement] 检查父元素下的控件: ${parentControlXPath}`);
        if (await this.elementExists(page, parentControlXPath, log)) {
          log(`[findByAnchorElement] 找到父元素下的控件，返回定位XPath: ${parentControlXPath}`);
          return { xpath: parentControlXPath, debugInfo };
        }

        // 策略4: 查找标签祖先元素下的控件
        const ancestorControlXPath = `${labelXPath}/ancestor::*[position()<=2]//*[${controlXPath} and not(ancestor::*[self::label or self::*[text()='${label}']])]`;
        log(`[findByAnchorElement] 检查祖先元素下的控件: ${ancestorControlXPath}`);
        if (await this.elementExists(page, ancestorControlXPath, log)) {
          log(`[findByAnchorElement] 找到祖先元素下的控件，返回定位XPath: ${ancestorControlXPath}`);
          return { xpath: ancestorControlXPath, debugInfo };
        }
      } catch (e) {
        log(`[findByAnchorElement] 查找基于锚点的控件时出错: ${e}`);
        // 继续尝试下一个标签XPath
        continue;
      }
    }

    return { xpath: null, debugInfo };
  }
}