import { GetXPathByLabelTool } from '../../../tools/browser/getXPathByLabel';
import type { ToolContext } from '../../../tools/common/types';
import type { Page, Locator } from 'playwright';

// Mock the base class and Playwright
jest.mock('../../../tools/browser/base');

describe('GetXPathByLabelTool', () => {
  let tool: GetXPathByLabelTool;
  let mockPage: Page;
  let mockContext: ToolContext;

  beforeEach(() => {
    // Create mock server
    const mockServer: any = {};

    // Initialize the tool
    tool = new GetXPathByLabelTool(mockServer);

    // Create mock page
    mockPage = {
      waitForSelector: jest.fn(),
      locator: jest.fn(),
    } as unknown as Page;

    // Create mock context
    mockContext = {
      browser: {
        pages: jest.fn().mockResolvedValue([mockPage]),
      },
      page: mockPage,
      server: mockServer,
    } as unknown as ToolContext;
  });

  test('should require label parameter', async () => {
    const result = await tool.execute({ label: '' }, mockContext);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Label is required');
  });

  test('should return error when no XPath is found', async () => {
    // Mock waitForSelector to throw an error (element not found)
    (mockPage.waitForSelector as jest.Mock).mockImplementation(() => {
      throw new Error('Element not found');
    });

    const result = await tool.execute({ label: 'Address' }, mockContext);
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('未能找到标签为 【Address】 的控件');
  });

  test('should return XPath when element is found', async () => {
    // Mock waitForSelector to resolve successfully
    const mockElementHandle: any = {
      evaluate: jest.fn().mockResolvedValue('<input id="address" name="address">'),
    };

    (mockPage.waitForSelector as jest.Mock).mockImplementation((selector: string) => {
      if (selector.includes('Address')) {
        return Promise.resolve(mockElementHandle);
      }
      throw new Error('Element not found');
    });

    const result = await tool.execute({ label: 'Address' }, mockContext);
    expect(result.isError).toBe(false);

    // Parse the JSON response
    const response = JSON.parse(result.content[0].text as string);
    expect(response).toHaveProperty('xpath');
    expect(response).toHaveProperty('element');
  });

  test('should handle different control types', async () => {
    // Mock waitForSelector to resolve successfully
    const mockElementHandle: any = {
      evaluate: jest.fn().mockResolvedValue('<input type="text" id="name">'),
    };

    (mockPage.waitForSelector as jest.Mock).mockImplementation((selector: string) => {
      if (selector.includes('Name')) {
        return Promise.resolve(mockElementHandle);
      }
      throw new Error('Element not found');
    });

    // Test with input control type
    const result = await tool.execute({
      label: 'Name',
      controlType: '输入框'
    }, mockContext);

    expect(result.isError).toBe(false);
    const response = JSON.parse(result.content[0].text as string);
    expect(response).toHaveProperty('xpath');
  });
});