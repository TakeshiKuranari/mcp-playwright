import { resetBrowserState } from "../../toolHandler.js";
import { ToolContext, ToolResponse, createErrorResponse, createSuccessResponse } from "../common/types.js";
import { BrowserToolBase } from "./base.js";

/**
 * Tool for getting the visible text content of the current page
 */
export class VisibleTextTool extends BrowserToolBase {
  /**
   * Execute the visible text page tool
   */
  async execute(args: any, context: ToolContext): Promise<ToolResponse> {
    // Check if browser is available
    if (!context.browser || !context.browser.isConnected()) {
      // If browser is not connected, we need to reset the state to force recreation
      resetBrowserState();
      return createErrorResponse(
        "Browser is not connected. The connection has been reset - please retry your navigation."
      );
    }

    // Check if page is available and not closed
    if (!context.page || context.page.isClosed()) {
      return createErrorResponse(
        "Page is not available or has been closed. Please retry your navigation."
      );
    }
    return this.safeExecute(context, async (page) => {
      try {
        const visibleText = await page!.evaluate(() => {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: (node) => {
                const style = window.getComputedStyle(node.parentElement!);
                return (style.display !== "none" && style.visibility !== "hidden")
                  ? NodeFilter.FILTER_ACCEPT
                  : NodeFilter.FILTER_REJECT;
              },
            }
          );
          let text = "";
          let node;
          while ((node = walker.nextNode())) {
            const trimmedText = node.textContent?.trim();
            if (trimmedText) {
              text += trimmedText + "\n";
            }
          }
          return text.trim();
        });
        // Truncate logic
        const maxLength = typeof args.maxLength === 'number' ? args.maxLength : 20000;
        let output = visibleText;
        let truncated = false;
        if (output.length > maxLength) {
          output = output.slice(0, maxLength) + '\n[Output truncated due to size limits]';
          truncated = true;
        }
        return createSuccessResponse(`Visible text content:\n${output}`);
      } catch (error) {
        return createErrorResponse(`Failed to get visible text content: ${(error as Error).message}`);
      }
    });
  }
}

/**
 * Tool for getting the visible HTML content of the current page
 */
export class VisibleHtmlTool extends BrowserToolBase {
  /**
   * Execute the visible HTML page tool
   */
  async execute(args: any, context: ToolContext): Promise<ToolResponse> {
    // Check if browser is available
    if (!context.browser || !context.browser.isConnected()) {
      // If browser is not connected, we need to reset the state to force recreation
      resetBrowserState();
      return createErrorResponse(
        "Browser is not connected. The connection has been reset - please retry your navigation."
      );
    }

    // Check if page is available and not closed
    if (!context.page || context.page.isClosed()) {
      return createErrorResponse(
        "Page is not available or has been closed. Please retry your navigation."
      );
    }
    return this.safeExecute(context, async (page) => {
      try {
        const { selector, removeComments, removeStyles, removeMeta, minify, cleanHtml, removeHide, removeBase64, removeSvgPath } = args;
        // Default removeScripts to true unless explicitly set to false
        const removeScripts = args.removeScripts === false ? false : true;
        // Set default values to true for these parameters
        const shouldRemoveComments = removeComments === false ? false : true;
        const shouldRemoveStyles = removeStyles === false ? false : true;
        const shouldRemoveMeta = removeMeta === false ? false : true;
        const shouldMinify = minify === false ? false : true;
        const shouldCleanHtml = cleanHtml === false ? false : true;
        const shouldRemoveHide = removeHide === false ? false : true;
        const shouldRemoveBase64 = removeBase64 === false ? false : true;
        const shouldRemoveSvgPath = removeSvgPath === false ? false : true;

        // Get the HTML content
        let htmlContent: string;

        if (selector) {
          // If a selector is provided, get only the HTML for that element
          const element = await page.$(selector);
          if (!element) {
            return createErrorResponse(`Element with selector "${selector}" not found`);
          }
          htmlContent = await page.evaluate((el) => el.outerHTML, element);
        } else {
          // Otherwise get the full page HTML
          htmlContent = await page.content();
        }

        // Determine if we need to apply filters
        const shouldRemoveScripts = removeScripts || shouldCleanHtml;
        const shouldRemoveCommentsFinal = shouldRemoveComments || shouldCleanHtml;
        const shouldRemoveStylesFinal = shouldRemoveStyles || shouldCleanHtml;
        const shouldRemoveMetaFinal = shouldRemoveMeta || shouldCleanHtml;

        // Apply filters in the browser context
        if (shouldRemoveScripts || shouldRemoveCommentsFinal || shouldRemoveStylesFinal || shouldRemoveMetaFinal || shouldMinify || shouldRemoveHide || shouldRemoveBase64 || shouldRemoveSvgPath) {
          htmlContent = await page.evaluate(
            ({ html, removeScripts, removeComments, removeStyles, removeMeta, minify, removeHide, removeBase64, removeSvgPath }) => {
              // Create a DOM parser to work with the HTML
              const parser = new DOMParser();
              const doc = parser.parseFromString(html, 'text/html');

              // Remove script tags if requested
              if (removeScripts) {
                const scripts = doc.querySelectorAll('script');
                scripts.forEach(script => script.remove());
              }

              // Remove style tags if requested
              if (removeStyles) {
                const styles = doc.querySelectorAll('style');
                styles.forEach(style => style.remove());
              }

              // Remove meta tags if requested
              if (removeMeta) {
                const metaTags = doc.querySelectorAll('meta');
                metaTags.forEach(meta => meta.remove());
              }

              // Remove HTML comments if requested
              if (removeComments) {
                const removeComments = (node) => {
                  const childNodes = node.childNodes;
                  for (let i = childNodes.length - 1; i >= 0; i--) {
                    const child = childNodes[i];
                    if (child.nodeType === 8) { // 8 is for comment nodes
                      node.removeChild(child);
                    } else if (child.nodeType === 1) { // 1 is for element nodes
                      removeComments(child);
                    }
                  }
                };
                removeComments(doc.documentElement);
              }

              // Remove elements with display: none if requested
              if (removeHide) {
                const removeHiddenElements = (node) => {
                  const childNodes = node.childNodes;
                  for (let i = childNodes.length - 1; i >= 0; i--) {
                    const child = childNodes[i];
                    if (child.nodeType === 1) { // 1 is for element nodes
                      const element = child as Element;
                      const style = element.getAttribute('style');
                      if (style && (style.includes('display: none') || style.includes('display:none'))) {
                        node.removeChild(child);
                      } else {
                        removeHiddenElements(child);
                      }
                    }
                  }
                };
                removeHiddenElements(doc.documentElement);
              }

              // Remove base64 data from attributes if requested
              if (removeBase64) {
                const removeBase64FromAttributes = (node) => {
                  if (node.nodeType === 1) { // 1 is for element nodes
                    const element = node as Element;
                    const attributes = element.attributes;
                    
                    // Check all attributes for base64 data
                    for (let i = attributes.length - 1; i >= 0; i--) {
                      const attr = attributes[i];
                      const value = attr.value;
                      
                      // Check if attribute value contains base64 data
                      if (value && (
                        value.includes('data:image/') ||
                        value.includes('data:audio/') ||
                        value.includes('data:video/') ||
                        value.includes('data:application/') ||
                        value.includes('data:text/') ||
                        value.includes('data:font/') ||
                        value.startsWith('data:') ||
                        // Check for base64 encoded strings (long strings with base64 characters)
                        (value.length > 100 && /^[A-Za-z0-9+/=]+$/.test(value))
                      )) {
                        element.removeAttribute(attr.name);
                      }
                    }
                  }
                  
                  // Recursively process child nodes
                  const childNodes = node.childNodes;
                  for (let i = 0; i < childNodes.length; i++) {
                    removeBase64FromAttributes(childNodes[i]);
                  }
                };
                removeBase64FromAttributes(doc.documentElement);
              }

              // Remove SVG path elements if requested
              if (removeSvgPath) {
                const pathElements = doc.querySelectorAll('path');
                pathElements.forEach(path => path.remove());
              }

              // Get the processed HTML
              let result = doc.documentElement.outerHTML;

              // Minify if requested
              if (minify) {
                // Simple minification: remove extra whitespace
                result = result.replace(/>\s+</g, '><').trim();
              }

              return result;
            },
            {
              html: htmlContent,
              removeScripts: shouldRemoveScripts,
              removeComments: shouldRemoveCommentsFinal,
              removeStyles: shouldRemoveStylesFinal,
              removeMeta: shouldRemoveMetaFinal,
              minify: shouldMinify,
              removeHide: shouldRemoveHide,
              removeBase64: shouldRemoveBase64,
              removeSvgPath: shouldRemoveSvgPath
            }
          );
        }

        // Truncate logic
        const maxLength = typeof args.maxLength === 'number' ? args.maxLength : 20000;
        let output = htmlContent;
        if (output.length > maxLength) {
          output = output.slice(0, maxLength) + '\n<!-- Output truncated due to size limits -->';
        }
        return createSuccessResponse(`HTML content:\n${output}`);
      } catch (error) {
        return createErrorResponse(`Failed to get visible HTML content: ${(error as Error).message}`);
      }
    });
  }
}