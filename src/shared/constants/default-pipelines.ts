import type { Pipeline } from '@/domain/provider/provider.schema';
import type { PipelineId, PipelineStepId } from '@/domain/shared/ids';
import { now } from '@/domain/shared/ids';

function step(
  id: string,
  order: number,
  prompt: string,
  passOutputAs = 'prev_output',
): Pipeline['steps'][0] {
  return {
    id: id as PipelineStepId,
    prompt,
    passOutputAs,
    order,
  };
}

export const DEFAULT_PIPELINES: Pipeline[] = [
  {
    id: 'pipe_language_learning' as PipelineId,
    name: 'Language Learning',
    isBuiltIn: true,
    finalOutputMode: 'popup',
    steps: [
      step('step_ll_1', 0, 'Translate the following to English:\n\n{{selection}}'),
      step('step_ll_2', 1, 'Provide IPA pronunciation for:\n\n{{prev_output}}'),
      step('step_ll_3', 2, 'Explain the etymology of:\n\n{{prev_output}}'),
      step('step_ll_4', 3, 'Give 5 usage examples for:\n\n{{prev_output}}'),
      step(
        'step_ll_5',
        4,
        'Create a flashcard (Front/Back format) for learning:\n\nWord: {{selection}}\nTranslation: {{prev_output}}',
      ),
    ],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'pipe_code_review' as PipelineId,
    name: 'Code Review',
    isBuiltIn: true,
    finalOutputMode: 'chat',
    steps: [
      step('step_cr_1', 0, 'Explain what this code does step by step:\n\n```\n{{selection}}\n```'),
      step(
        'step_cr_2',
        1,
        'Find bugs and security issues in this code:\n\n```\n{{selection}}\n```\n\nPrevious analysis:\n{{prev_output}}',
      ),
      step(
        'step_cr_3',
        2,
        'Suggest optimizations for:\n\n```\n{{selection}}\n```\n\nIssues found:\n{{prev_output}}',
      ),
      step(
        'step_cr_4',
        3,
        'Generate unit tests for:\n\n```\n{{selection}}\n```\n\nOptimized approach:\n{{prev_output}}',
      ),
    ],
    createdAt: now(),
    updatedAt: now(),
  },
];
