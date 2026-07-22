import type { Action } from '@/domain/action/action.schema';
import type { Category } from '@/domain/action/action.schema';
import {
  createActionId,
  createCategoryId,
  now,
  type ActionId,
  type CategoryId,
} from '@/domain/shared/ids';

const CATEGORY_IDS = {
  languages: 'cat_languages' as CategoryId,
  writing: 'cat_writing' as CategoryId,
  programming: 'cat_programming' as CategoryId,
  research: 'cat_research' as CategoryId,
  productivity: 'cat_productivity' as CategoryId,
  education: 'cat_education' as CategoryId,
  ai: 'cat_ai' as CategoryId,
} as const;

function action(
  id: string,
  name: string,
  icon: string,
  categoryId: CategoryId,
  prompt: string,
  order: number,
  outputMode: Action['outputMode'] = 'popup',
): Action {
  const timestamp = now();
  return {
    id: id as ActionId,
    name,
    icon,
    categoryId,
    prompt,
    temperature: 0.7,
    streaming: true,
    outputMode,
    isBuiltIn: true,
    isEnabled: true,
    order,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: CATEGORY_IDS.languages, name: 'Languages', icon: '🌍', order: 0, isBuiltIn: true, createdAt: now(), updatedAt: now() },
  { id: CATEGORY_IDS.writing, name: 'Writing', icon: '✍️', order: 1, isBuiltIn: true, createdAt: now(), updatedAt: now() },
  { id: CATEGORY_IDS.programming, name: 'Programming', icon: '💻', order: 2, isBuiltIn: true, createdAt: now(), updatedAt: now() },
  { id: CATEGORY_IDS.research, name: 'Research', icon: '🔬', order: 3, isBuiltIn: true, createdAt: now(), updatedAt: now() },
  { id: CATEGORY_IDS.productivity, name: 'Productivity', icon: '⚡', order: 4, isBuiltIn: true, createdAt: now(), updatedAt: now() },
  { id: CATEGORY_IDS.education, name: 'Education', icon: '📖', order: 5, isBuiltIn: true, createdAt: now(), updatedAt: now() },
  { id: CATEGORY_IDS.ai, name: 'AI', icon: '🧠', order: 6, isBuiltIn: true, createdAt: now(), updatedAt: now() },
];

export const DEFAULT_ACTIONS: Action[] = [
  // Toolbar defaults (0-5)
  action('act_explain', 'Explain', '🧠', CATEGORY_IDS.education,
    'Explain the following text clearly and concisely:\n\n{{selection}}', 0),
  action('act_translate', 'Translate', '🌍', CATEGORY_IDS.languages,
    'Translate the following text to {{language}}. Only output the translation:\n\n{{selection}}', 1),
  action('act_ask', 'Ask', '💬', CATEGORY_IDS.ai,
    'Context from page "{{page_title}}" ({{url}}):\n\n{{selection}}\n\nAnswer the user question about this context.', 2, 'chat'),
  action('act_rewrite', 'Rewrite', '✍️', CATEGORY_IDS.writing,
    'Rewrite the following text to improve clarity and flow while preserving meaning:\n\n{{selection}}', 3),
  action('act_summarize', 'Summarize', '📖', CATEGORY_IDS.productivity,
    'Summarize the following text in 3-5 bullet points:\n\n{{selection}}', 4),
  action('act_code_review', 'Code Review', '💻', CATEGORY_IDS.programming,
    'Review the following code. Identify bugs, security issues, and suggest improvements:\n\n```\n{{selection}}\n```', 5),

  // Writing (6-10)
  action('act_grammar', 'Grammar', '✅', CATEGORY_IDS.writing,
    'Fix grammar and spelling in the following text. Only output the corrected version:\n\n{{selection}}', 6),
  action('act_tone_formal', 'Formal Tone', '🎩', CATEGORY_IDS.writing,
    'Rewrite the following text in a formal, professional tone:\n\n{{selection}}', 7),
  action('act_tone_casual', 'Casual Tone', '😊', CATEGORY_IDS.writing,
    'Rewrite the following text in a casual, friendly tone:\n\n{{selection}}', 8),
  action('act_expand', 'Expand', '📝', CATEGORY_IDS.writing,
    'Expand the following text with more detail and examples:\n\n{{selection}}', 9),
  action('act_shorten', 'Shorten', '✂️', CATEGORY_IDS.writing,
    'Make the following text more concise without losing key information:\n\n{{selection}}', 10),

  // Languages (11-14)
  action('act_detect_lang', 'Detect Language', '🔍', CATEGORY_IDS.languages,
    'Detect the language of the following text and explain:\n\n{{selection}}', 11),
  action('act_ipa', 'IPA', '🔤', CATEGORY_IDS.languages,
    'Provide IPA pronunciation for the following word or phrase:\n\n{{selection}}', 12),
  action('act_etymology', 'Etymology', '📜', CATEGORY_IDS.languages,
    'Explain the etymology and origin of:\n\n{{selection}}', 13),
  action('act_examples', 'Usage Examples', '💡', CATEGORY_IDS.languages,
    'Provide 5 usage examples for the word or phrase:\n\n{{selection}}', 14),

  // Programming (15-20)
  action('act_explain_code', 'Explain Code', '📖', CATEGORY_IDS.programming,
    'Explain what the following code does step by step:\n\n```\n{{selection}}\n```', 15),
  action('act_refactor', 'Refactor', '🔧', CATEGORY_IDS.programming,
    'Refactor the following code for readability and best practices. Explain changes:\n\n```\n{{selection}}\n```', 16),
  action('act_debug', 'Debug', '🐛', CATEGORY_IDS.programming,
    'Find and explain bugs in the following code. Suggest fixes:\n\n```\n{{selection}}\n```', 17),
  action('act_gen_tests', 'Generate Tests', '🧪', CATEGORY_IDS.programming,
    'Generate unit tests for the following code:\n\n```\n{{selection}}\n```', 18),
  action('act_optimize', 'Optimize', '⚡', CATEGORY_IDS.programming,
    'Optimize the following code for performance. Explain improvements:\n\n```\n{{selection}}\n```', 19),
  action('act_add_docs', 'Add Docs', '📋', CATEGORY_IDS.programming,
    'Add documentation comments to the following code:\n\n```\n{{selection}}\n```', 20),

  // Education (21-24)
  action('act_simple', 'Simple Words', '🎓', CATEGORY_IDS.education,
    'Explain the following as if to a 10-year-old:\n\n{{selection}}', 21),
  action('act_quiz', 'Quiz Me', '❓', CATEGORY_IDS.education,
    'Create 5 quiz questions based on the following content:\n\n{{selection}}', 22, 'chat'),
  action('act_flashcard', 'Flashcard', '🃏', CATEGORY_IDS.education,
    'Create a flashcard (front/back) for:\n\n{{selection}}', 23),
  action('act_key_concepts', 'Key Concepts', '🎯', CATEGORY_IDS.education,
    'Extract and explain the key concepts from:\n\n{{selection}}', 24),

  // Research (25-27)
  action('act_pros_cons', 'Pros & Cons', '⚖️', CATEGORY_IDS.research,
    'List pros and cons of the following topic:\n\n{{selection}}', 25),
  action('act_fact_check', 'Fact Check', '🔎', CATEGORY_IDS.research,
    'Analyze the following claim for accuracy. Note what can and cannot be verified:\n\n{{selection}}', 26),
  action('act_compare', 'Compare', '🔄', CATEGORY_IDS.research,
    'Compare and contrast the following items or concepts:\n\n{{selection}}', 27),

  // Productivity (28-29)
  action('act_action_items', 'Action Items', '☑️', CATEGORY_IDS.productivity,
    'Extract actionable tasks from the following text as a checklist:\n\n{{selection}}', 28),
  action('act_email', 'Draft Email', '📧', CATEGORY_IDS.productivity,
    'Draft a professional email based on the following notes:\n\n{{selection}}', 29),
];

export const DEFAULT_TOOLBAR_ACTION_IDS: ActionId[] = [
  'act_explain' as ActionId,
  'act_translate' as ActionId,
  'act_ask' as ActionId,
  'act_rewrite' as ActionId,
  'act_summarize' as ActionId,
  'act_code_review' as ActionId,
];

export function getDefaultToolbarActions(): Action[] {
  const byId = new Map(DEFAULT_ACTIONS.map((action) => [action.id, action]));
  return DEFAULT_TOOLBAR_ACTION_IDS.map((id) => byId.get(id)).filter(
    (action): action is Action => !!action && action.isEnabled,
  );
}

export { createActionId, createCategoryId };
