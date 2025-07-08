import { BrowserToolBase } from './base.js';
import type { ToolContext, ToolResponse } from '../common/types.js';
import { createSuccessResponse, createErrorResponse } from '../common/types.js';

interface SaveStorageStateArgs {
  path: string;
}

/**
 * Tool for saving browser storage state (e.g. 登录状态) to a file
 */
export class SaveStorageStateTool extends BrowserToolBase {
  async execute(args: SaveStorageStateArgs, context: ToolContext): Promise<ToolResponse> {
    return this.safeExecute(context, async (page) => {
      if (!args.path) {
        return createErrorResponse('缺少参数：path');
      }
      try {
        await page.context().storageState({ path: args.path });
        return createSuccessResponse(`登录状态已保存到文件: ${args.path}`);
      } catch (error) {
        return createErrorResponse(`保存登录状态失败: ${(error as Error).message}`);
      }
    });
  }
} 