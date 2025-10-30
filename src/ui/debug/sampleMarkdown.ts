/**
 * Sample markdown demonstrating InkMarkdown rendering capabilities
 *
 * For development and debugging purposes only.
 * See InkMarkdown.tsx for current format limitations and supported features.
 */
export const SAMPLE_MARKDOWN = `# Heading 1
## Heading 2

This is a **bold** text and this is *italic* text.

### Code Examples

Here is an inline code: \`const x = 1;\`

And here is a code block:
\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

### Lists

Unordered list:
- Item 1
- Item 2
- Item 3

Ordered list:
1. First item
2. Second item
3. Third item

### Complex Styled Lists

Here's an example of complex list styling:

1. **Important feature**: Added \`newFunction()\` for better performance
2. **Bug fixes**: Fixed \`calculateTotal()\` to handle edge cases
3. **UI improvements**: Updated \`Button\` component with new styles
4. **Documentation**: Added examples for \`useEffect\` hook
5. **Testing**: Created tests for \`validateInput()\` function

### Links

Visit [OpenAI](https://openai.com) for more information.

### Blockquote

> This is a blockquote.
> It can span multiple lines.

### Combined Formatting

You can combine **bold and *italic*** text, or use \`inline code\` in sentences.

### Horizontal Rule

Content above the separator

---

Content below the separator

### Long Text Wrapping Test

This is a very long paragraph that should test text wrapping capabilities in the InkMarkdown component. It contains multiple sentences with various formatting elements like **bold text**, *italic text*, and \`inline code\` to see how they interact with line wrapping. The purpose is to observe how the component handles long continuous text that exceeds the terminal width, and whether it properly breaks lines at appropriate points while maintaining the formatting integrity.

Another long paragraph with different content to further test the wrapping behavior. This text includes some technical terms like \`React component\`, \`TypeScript interface\`, and \`JavaScript function\` to see how code spans are handled within wrapped text. We also want to test if **bold formatting** and *italic emphasis* work correctly when they span across multiple lines due to wrapping.

Finally, let's add one more paragraph with a mix of regular text and formatted elements to ensure comprehensive testing of the text wrapping functionality in various scenarios and edge cases.
`;
