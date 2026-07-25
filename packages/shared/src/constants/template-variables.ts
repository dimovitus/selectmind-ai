export const TEMPLATE_VARIABLES = [
  { name: 'selection', description: 'Currently selected text' },
  { name: 'page_title', description: 'Page title' },
  { name: 'url', description: 'Page URL' },
  { name: 'hostname', description: 'Page hostname' },
  { name: 'page_text', description: 'Extracted page text' },
  { name: 'clipboard', description: 'Clipboard content' },
  { name: 'language', description: 'Browser language' },
  { name: 'date', description: 'Current date' },
  { name: 'time', description: 'Current time' },
  { name: 'screenshot_ocr', description: 'OCR text from captured screenshot' },
] as const;

export const OUTPUT_MODES = [
  { value: 'popup', label: 'Quick Popup' },
  { value: 'chat', label: 'Chat Popup' },
  { value: 'workspace', label: 'Side Panel' },
  { value: 'clipboard', label: 'Copy to Clipboard' },
] as const;
