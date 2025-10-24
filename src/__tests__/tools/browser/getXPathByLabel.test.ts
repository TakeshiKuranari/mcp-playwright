import { GetXPathByLabelTool } from '../../../tools/browser/getXPathByLabel';
import type { ToolContext } from '../../../tools/common/types';
import type { Page, Locator } from 'playwright';


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
      locator: jest.fn().mockReturnValue({
        first: () => ({
          getAttribute: jest.fn().mockResolvedValue(null),
        }),
      }),
      waitForFunction: jest.fn(),
      isClosed: jest.fn().mockReturnValue(false),
    } as unknown as Page;

    // Create mock context
    mockContext = {
      browser: {
        pages: jest.fn().mockResolvedValue([mockPage]),
        isConnected: jest.fn().mockReturnValue(true),
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
    (mockPage.waitForSelector as jest.Mock).mockImplementation((selector: string) => {
      // For label elements, throw an error to simulate not found
      if (selector.includes('label') || selector.includes('Label') || selector.includes('Address')) {
        throw new Error('Element not found');
      }
      // For other elements, also throw an error
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
      // For label elements, return a mock element handle
      if (selector.includes('label') || selector.includes('Label') || selector.includes('Address')) {
        return Promise.resolve(mockElementHandle);
      }
      // For element existence checks, also return the mock element handle
      return Promise.resolve(mockElementHandle);
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
      // For label elements, return a mock element handle
      if (selector.includes('label') || selector.includes('Label') || selector.includes('Name')) {
        return Promise.resolve(mockElementHandle);
      }
      // For element existence checks, also return the mock element handle
      return Promise.resolve(mockElementHandle);
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

  test('should find element by placeholder attribute', async () => {
    // Mock waitForSelector to resolve successfully for placeholder
    const mockElementHandle: any = {
      evaluate: jest.fn().mockResolvedValue('<input type="text" id="email" placeholder="请输入邮箱地址">'),
    };

    (mockPage.waitForSelector as jest.Mock).mockImplementation((selector: string) => {
      // For placeholder elements, return a mock element handle
      if (selector.includes('placeholder') || selector.includes('邮箱')) {
        return Promise.resolve(mockElementHandle);
      }
      // For element existence checks, also return the mock element handle
      return Promise.resolve(mockElementHandle);
    });

    // Test with placeholder value
    const result = await tool.execute({
      label: '请输入邮箱地址',
      controlType: '输入框'
    }, mockContext);

    expect(result.isError).toBe(false);
    const response = JSON.parse(result.content[0].text as string);
    expect(response).toHaveProperty('xpath');
  });

  test('should find element by placeholder with partial match', async () => {
    // Mock waitForSelector to resolve successfully for placeholder
    const mockElementHandle: any = {
      evaluate: jest.fn().mockResolvedValue('<input type="text" id="phone" placeholder="手机号码">'),
    };

    (mockPage.waitForSelector as jest.Mock).mockImplementation((selector: string) => {
      // For placeholder elements, return a mock element handle
      if (selector.includes('placeholder') || selector.includes('手机号')) {
        return Promise.resolve(mockElementHandle);
      }
      // For element existence checks, also return the mock element handle
      return Promise.resolve(mockElementHandle);
    });

    // Test with partial placeholder value
    const result = await tool.execute({
      label: '手机号',
      controlType: '输入框'
    }, mockContext);

    expect(result.isError).toBe(false);
    const response = JSON.parse(result.content[0].text as string);
    expect(response).toHaveProperty('xpath');
  });
});