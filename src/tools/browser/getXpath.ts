import { ToolHandler, ToolContext, ToolResponse, createSuccessResponse, createErrorResponse } from '../common/types.js';
import { getXpathFromExtension } from '../../httpServer.js';
/**
 * Tool for getting XPath of an element on the page
 */
export class GetXpathTool implements ToolHandler {
  /**
   * Execute the get xpath tool
   */
  async execute(args: any, context: ToolContext): Promise<ToolResponse> {
    try {
      // 模拟等待5秒
      // await new Promise(resolve => setTimeout(resolve, 5000));

      // 返回一个模拟的XPath值
      // const xpath = "//div[@class='example-element']";
      let xpath = ''
      try {
        xpath = await getXpathFromExtension()
      } catch (e) {
        console.log('从插件获取xpath失败', e)
      }

     

      return createSuccessResponse(`XPath: ${xpath}`);
    } catch (error) {
      return createErrorResponse(`Failed to get XPath: ${(error as Error).message}`);
    }
  }
}

