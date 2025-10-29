import { GetTableByHeaderKeywordTool } from '../../../tools/browser/getTableByHeaderKeyword.js';
import type { ToolContext } from '../../../tools/common/types.js';
import type { Page } from 'playwright';

// Mock the Playwright page object
const mockPage = {
  waitForSelector: jest.fn(),
  locator: jest.fn(),
  evaluate: jest.fn(),
} as unknown as Page;

// Mock server object
const mockServer = {
  // Add any server methods that might be needed
};

// Tool context
const context: ToolContext = {
  server: mockServer,
  page: mockPage,
};

describe('GetTableByHeaderKeywordTool', () => {
  let tool: GetTableByHeaderKeywordTool;

  beforeEach(() => {
    tool = new GetTableByHeaderKeywordTool(mockServer);
    jest.clearAllMocks();
  });

  it('should return an error when keyword is not provided', async () => {
    const result = await tool.execute({ keyword: '' }, context);

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as any).text).toBe('Keyword is required');
  });

  it('should return an error when keyword is null', async () => {
    const result = await tool.execute({ keyword: null as any }, context);

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as any).text).toBe('Keyword is required');
  });

  it('should return an error when keyword is undefined', async () => {
    const result = await tool.execute({ keyword: undefined as any }, context);

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as any).text).toBe('Keyword is required');
  });

  it('should find table by header keyword successfully', async () => {
    // Mock the waitForSelector to resolve successfully
    (mockPage.waitForSelector as jest.Mock).mockResolvedValueOnce({});

    // Mock the element handle for getting outerHTML
    const mockElementHandle = {
      evaluate: jest.fn().mockResolvedValue('<table id="test-table"><thead><tr><th>Name</th></tr></thead></table>')
    };

    // Mock the waitForSelector for the table element
    (mockPage.waitForSelector as jest.Mock).mockResolvedValueOnce(mockElementHandle);

    const result = await tool.execute({ keyword: 'Name' }, context);

    expect(result.isError).toBe(false);
    expect(result.content[0].type).toBe('text');

    const resultText = (result.content[0] as any).text;
    const parsedResult = JSON.parse(resultText);

    expect(parsedResult.xpath).toBeDefined();
    expect(parsedResult.element).toContain('table');
  });

  it('should return debug information when table is not found', async () => {
    // Mock the waitForSelector to reject (element not found)
    (mockPage.waitForSelector as jest.Mock).mockRejectedValue(new Error('Element not found'));

    const result = await tool.execute({ keyword: 'NonExistentKeyword' }, context);

    expect(result.isError).toBe(false);
    expect(result.content[0].type).toBe('text');

    const resultText = (result.content[0] as any).text;
    expect(resultText).toContain('未能找到包含关键词 【NonExistentKeyword】 的表格');
    expect(resultText).toContain('调试信息');
  });

  it('should handle errors when getting element information', async () => {
    // Mock the waitForSelector for the header to resolve
    (mockPage.waitForSelector as jest.Mock).mockResolvedValueOnce({});

    // Mock the waitForSelector for the table element to resolve
    (mockPage.waitForSelector as jest.Mock).mockResolvedValueOnce({});

    // Mock the element handle to throw an error
    const mockElementHandle = {
      evaluate: jest.fn().mockRejectedValue(new Error('Failed to get element info'))
    };

    // Mock the waitForSelector for the table element
    (mockPage.waitForSelector as jest.Mock).mockResolvedValueOnce(mockElementHandle);

    const result = await tool.execute({ keyword: 'Name' }, context);

    expect(result.isError).toBe(false);
    expect(result.content[0].type).toBe('text');

    const resultText = (result.content[0] as any).text;
    const parsedResult = JSON.parse(resultText);

    expect(parsedResult.xpath).toBeDefined();
    expect(parsedResult.element).toBe('无法获取元素详细信息');
  });

  it('should try multiple strategies to find table', async () => {
    // Mock the waitForSelector to reject for the first few attempts (strategies)
    (mockPage.waitForSelector as jest.Mock)
      .mockRejectedValueOnce(new Error('Element not found')) // First strategy fails
      .mockRejectedValueOnce(new Error('Element not found')) // Second strategy fails
      .mockResolvedValueOnce({}); // Third strategy succeeds

    // Mock the element handle for getting outerHTML
    const mockElementHandle = {
      evaluate: jest.fn().mockResolvedValue('<table><tr><th>Name</th></tr></table>')
    };

    // Mock the waitForSelector for the table element
    (mockPage.waitForSelector as jest.Mock).mockResolvedValueOnce(mockElementHandle);

    const result = await tool.execute({ keyword: 'Name' }, context);

    expect(result.isError).toBe(false);
    expect(mockPage.waitForSelector).toHaveBeenCalledTimes(4); // 3 strategies + 1 for element info
  });
});