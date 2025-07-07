import { handleToolCall } from '../../../toolHandler.js';
import { jest } from '@jest/globals';

// Mock Playwright
jest.mock('playwright', () => {
  const mockOn = jest.fn();
  const mockIsClosed = jest.fn(() => false);
  const mockGoto = jest.fn(() => Promise.resolve());
  const mockPage = {
    goto: mockGoto,
    on: mockOn,
    isClosed: mockIsClosed,
    addInitScript: jest.fn(),
    url: jest.fn(() => Promise.resolve('about:blank'))
  };
  const mockNewPage = jest.fn(() => Promise.resolve(mockPage));
  const mockContexts = jest.fn(() => []);
  const mockContext = {
    newPage: mockNewPage,
    pages: jest.fn(() => [mockPage])
  };
  const mockNewContext = jest.fn(() => Promise.resolve(mockContext));
  const mockBrowser = {
    newContext: mockNewContext,
    contexts: jest.fn(() => [mockContext]),
    on: mockOn,
    isConnected: jest.fn(() => true)
  };
  return {
    chromium: {
      connectOverCDP: jest.fn(() => Promise.resolve(mockBrowser)),
      launch: jest.fn(() => Promise.resolve(mockBrowser))
    }
  };
});

const mockServer = {
  sendMessage: jest.fn(),
  notification: jest.fn()
};

describe('playwright_connect_over_cdp', () => {
  it('should connect to browser via CDP (default endpoint)', async () => {
    const result = await handleToolCall('playwright_connect_over_cdp', {}, mockServer);
    expect(result).toBeDefined();
    expect(Array.isArray((result as any).content)).toBe(true);
    expect(
      (result as any).content[0].text.includes('已通过CDP连接到浏览器')
    ).toBe(true);
  });

  it('should connect to browser via CDP (custom endpoint)', async () => {
    const result = await handleToolCall('playwright_connect_over_cdp', { cdpEndpoint: 'http://localhost:9222' }, mockServer);
    expect(result).toBeDefined();
    expect(Array.isArray((result as any).content)).toBe(true);
    expect(
      (result as any).content[0].text.includes('已通过CDP连接到浏览器')
    ).toBe(true);
  });
}); 