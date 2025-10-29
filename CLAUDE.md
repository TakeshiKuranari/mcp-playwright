# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server implementation for Playwright, enabling LLMs to interact with web browsers and perform browser automation tasks. The server provides tools for browser automation, API testing, and test code generation.

## Key Features

- Browser automation using Playwright (Chromium, Firefox, WebKit)
- API testing capabilities (GET, POST, PUT, PATCH, DELETE)
- Test code generation and recording
- Screenshot capture and console log retrieval
- Multiple browser engine support
- Code generation session recording

## Development Commands

### Building
```bash
npm run build
```
Compiles TypeScript code to JavaScript in the `dist` directory.

### Testing
```bash
npm test
```
Run all tests using Jest.

```bash
npm run test:coverage
```
Run tests with coverage reporting.

```bash
npm run test:custom
```
Run tests using the custom test script with coverage.

### Running
```bash
npm start
```
Start the MCP server (if defined in package.json).

## Architecture Overview

### Core Components

1. **Main Server (`src/index.ts`)**
   - Entry point that initializes the MCP server
   - Sets up request handlers and tool definitions
   - Handles graceful shutdown

2. **Request Handler (`src/requestHandler.ts`)**
   - Routes MCP requests to appropriate handlers
   - Manages resources (console logs, screenshots)
   - Handles tool calls

3. **Tool Handler (`src/toolHandler.ts`)**
   - Central dispatcher for all tool executions
   - Manages browser lifecycle and state
   - Handles browser initialization and cleanup

4. **Tool Definitions (`src/tools.ts`)**
   - Defines all available tools and their schemas
   - Categorizes tools (browser, API, codegen)
   - Maintains tool metadata

### Tool Categories

1. **Browser Tools** - Web page interaction and navigation
   - Navigation (`playwright_navigate`)
   - Element interaction (`playwright_click`, `playwright_fill`, etc.)
   - Page content retrieval (`playwright_get_visible_text`, `playwright_get_visible_html`)
   - Screenshots (`playwright_screenshot`)
   - Browser management (`playwright_close`)

2. **API Tools** - HTTP request operations
   - REST operations (`playwright_get`, `playwright_post`, etc.)
   - Response validation (`playwright_expect_response`, `playwright_assert_response`)

3. **Code Generation Tools** - Test code recording and generation
   - Session management (`start_codegen_session`, `end_codegen_session`)
   - Code retrieval (`playwright_read_generated_code`)

### Key Design Patterns

1. **Tool Abstraction** - Each tool is implemented as a class with an `execute` method
2. **Context Management** - Tools receive a context object with browser, page, and server references
3. **Error Handling** - Comprehensive error handling with specific error messages for common issues
4. **State Management** - Global browser state management with automatic cleanup
5. **Resource Management** - Proper cleanup of browser instances and resources

### Testing Structure

Tests are organized in `src/__tests__` with subdirectories for different tool categories:
- Browser tools tests
- API tools tests
- Code generation tests

Tests use Jest with mocking for Playwright objects and follow a consistent pattern of:
1. Mocking dependencies
2. Setting up test context
3. Executing tool methods
4. Verifying results and side effects

## Important Implementation Details

1. **Browser State Management** - The system maintains global browser and page references with automatic cleanup when browsers disconnect
2. **Tool Recording** - Actions can be recorded in code generation sessions for test creation
3. **Resource Handling** - Console logs and screenshots are exposed as MCP resources
4. **Error Recovery** - The system handles browser disconnections and attempts to recover gracefully
5. **Cross-browser Support** - Tools support Chromium, Firefox, and WebKit browsers

## Common Development Tasks

1. **Adding New Tools**
   - Create tool implementation in appropriate directory under `src/tools/`
   - Add tool definition to `src/tools.ts`
   - Add tool to appropriate category array (BROWSER_TOOLS, API_TOOLS, etc.)
   - Add tool tests in `src/__tests__/`

2. **Modifying Existing Tools**
   - Locate tool implementation in `src/tools/` directory
   - Update tool schema in `src/tools.ts` if parameters change
   - Update tests to reflect changes

3. **Testing Changes**
   - Run specific test files with `npm run test:single <test-file>`
   - Run all tests with `npm test`
   - Check coverage with `npm run test:coverage`