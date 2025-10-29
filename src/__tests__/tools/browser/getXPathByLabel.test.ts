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

  test('should find button element by text', async () => {
    // Mock waitForSelector to resolve successfully for button
    const mockElementHandle: any = {
      evaluate: jest.fn().mockResolvedValue('<button type="button">确认</button>'),
    };

    (mockPage.waitForSelector as jest.Mock).mockImplementation((selector: string) => {
      // For button elements, return a mock element handle
      if (selector.includes('button') || selector.includes('确认')) {
        return Promise.resolve(mockElementHandle);
      }
      // For element existence checks, also return the mock element handle
      return Promise.resolve(mockElementHandle);
    });

    // Test with button control type
    const result = await tool.execute({
      label: '确认',
      controlType: '按钮'
    }, mockContext);

    expect(result.isError).toBe(false);
    const response = JSON.parse(result.content[0].text as string);
    expect(response).toHaveProperty('xpath');
  });

  test('should find input button element by value', async () => {
    // Mock waitForSelector to resolve successfully for input button
    const mockElementHandle: any = {
      evaluate: jest.fn().mockResolvedValue('<input type="button" value="取消">'),
    };

    (mockPage.waitForSelector as jest.Mock).mockImplementation((selector: string) => {
      // For input button elements, return a mock element handle
      if (selector.includes('input') || selector.includes('取消')) {
        return Promise.resolve(mockElementHandle);
      }
      // For element existence checks, also return the mock element handle
      return Promise.resolve(mockElementHandle);
    });

    // Test with button control type
    const result = await tool.execute({
      label: '取消',
      controlType: '按钮'
    }, mockContext);

    expect(result.isError).toBe(false);
    const response = JSON.parse(result.content[0].text as string);
    expect(response).toHaveProperty('xpath');
  });

  test('should find button with nested text element', async () => {
    // Mock waitForSelector to resolve successfully for button with nested text
    const mockElementHandle: any = {
      evaluate: jest.fn().mockResolvedValue('<button type="button"><span>查询</span></button>'),
    };

    (mockPage.waitForSelector as jest.Mock).mockImplementation((selector: string) => {
      // For button elements with nested text, return a mock element handle
      if (selector.includes('button') || selector.includes('查询')) {
        return Promise.resolve(mockElementHandle);
      }
      // For element existence checks, also return the mock element handle
      return Promise.resolve(mockElementHandle);
    });

    // Test with button control type
    const result = await tool.execute({
      label: '查询',
      controlType: '按钮'
    }, mockContext);

    expect(result.isError).toBe(false);
    const response = JSON.parse(result.content[0].text as string);
    expect(response).toHaveProperty('xpath');
  });

  test('should find element in complex nested structure like table', async () => {
    // Mock waitForSelector to resolve successfully for complex structure
    const mockElementHandle: any = {
      evaluate: jest.fn().mockResolvedValue('<input type="text" id="regionCode" name="regionCode" class="x-form-text x-form-field">'),
    };

    (mockPage.waitForSelector as jest.Mock).mockImplementation((selector: string) => {
      // For complex structure elements, return a mock element handle
      if (selector.includes('网格地址') || selector.includes('regionCode')) {
        return Promise.resolve(mockElementHandle);
      }
      // For element existence checks, also return the mock element handle
      return Promise.resolve(mockElementHandle);
    });

    // Test with complex nested structure
    const result = await tool.execute({
      label: '网格地址',
      controlType: '输入框'
    }, mockContext);

    expect(result.isError).toBe(false);
    const response = JSON.parse(result.content[0].text as string);
    expect(response).toHaveProperty('xpath');
  });

  test('should find element in table structure with multiple labels', async () => {
    // Mock waitForSelector to resolve successfully for table structure
    const mockElementHandle: any = {
      evaluate: jest.fn().mockResolvedValue('<input type="text" id="ext-comp-1178" name="regionCode" class="x-form-text x-form-field">'),
    };

    (mockPage.waitForSelector as jest.Mock).mockImplementation((selector: string) => {
      // For table structure elements, return a mock element handle
      if (selector.includes('网格地址') || selector.includes('ext-comp-1178')) {
        return Promise.resolve(mockElementHandle);
      }
      // For element existence checks, also return the mock element handle
      return Promise.resolve(mockElementHandle);
    });

    // Test with table structure containing multiple labels
    const result = await tool.execute({
      label: '网格地址',
      controlType: '输入框'
    }, mockContext);

    expect(result.isError).toBe(false);
    const response = JSON.parse(result.content[0].text as string);
    expect(response).toHaveProperty('xpath');
  });

  test('should find correct element when label is followed by another label in table', async () => {
    // 模拟用户的实际场景：表格中有两个字段，"网格地址"和"现住址"
    // 需要确保定位"现住址"时找到的是正确的输入框（name="homePlace"），而不是前面"网格地址"的输入框（name="regionCode"）

    // 当查找"现住址"标签时，返回homePlace输入框
    const homePlaceElementHandle: any = {
      evaluate: jest.fn().mockResolvedValue('<input type="text" name="homePlace" id="homePlace_8IHTF" class="input_btline" readonly="true">'),
    };

    // 当查找"网格地址"标签时，返回regionCode输入框
    const regionCodeElementHandle: any = {
      evaluate: jest.fn().mockResolvedValue('<input type="text" name="regionCode" id="ext-comp-1178" class="x-form-text x-form-field">'),
    };

    (mockPage.waitForSelector as jest.Mock).mockImplementation((selector: string) => {
      // 对于"现住址"相关的查找，返回homePlace元素
      if (selector.includes('现住址')) {
        return Promise.resolve(homePlaceElementHandle);
      }
      // 对于"网格地址"相关的查找，返回regionCode元素
      if (selector.includes('网格地址')) {
        return Promise.resolve(regionCodeElementHandle);
      }
      // 对于元素存在性检查，检查是否是following-sibling相关的XPath
      // 如果是following-sibling，且是后续的td，返回homePlace
      if (selector.includes('following-sibling')) {
        // following-sibling通常表示查找后续的td，应该返回homePlace
        return Promise.resolve(homePlaceElementHandle);
      }
      // 对于元素存在性检查，根据XPath判断返回哪个元素
      if (selector.includes('homePlace')) {
        return Promise.resolve(homePlaceElementHandle);
      }
      if (selector.includes('regionCode')) {
        return Promise.resolve(regionCodeElementHandle);
      }
      // 默认返回regionCode元素（模拟实际情况中前面的元素）
      return Promise.resolve(regionCodeElementHandle);
    });

    // 测试定位"现住址"对应的输入框
    const result = await tool.execute({
      label: '现住址',
      controlType: '输入框'
    }, mockContext);

    expect(result.isError).toBe(false);
    const response = JSON.parse(result.content[0].text as string);
    expect(response).toHaveProperty('xpath');

    // 验证返回的元素是homePlace输入框，而不是regionCode输入框
    const element = response.element;
    expect(element).toContain('homePlace');
    expect(element).not.toContain('regionCode');
  });
});