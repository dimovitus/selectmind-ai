export const BUILTIN_ACTIONS_RU: Record<string, { name: string; prompt: string }> = {
  act_explain: {
    name: 'Объяснить',
    prompt: 'Объясни следующий текст ясно и кратко:\n\n{{selection}}',
  },
  act_translate: {
    name: 'Перевод',
    prompt:
      'Переведи следующий текст на {{language}}. Выведи только перевод:\n\n{{selection}}',
  },
  act_ask: {
    name: 'Спросить',
    prompt:
      'Контекст со страницы «{{page_title}}» ({{url}}):\n\n{{selection}}\n\nОтветь на вопрос пользователя об этом контексте.',
  },
  act_rewrite: {
    name: 'Переписать',
    prompt:
      'Перепиши следующий текст, улучшив ясность и связность, сохранив смысл:\n\n{{selection}}',
  },
  act_summarize: {
    name: 'Краткое содержание',
    prompt: 'Сожми следующий текст в 3–5 пунктах:\n\n{{selection}}',
  },
  act_code_review: {
    name: 'Код-ревью',
    prompt:
      'Проверь следующий код. Найди баги, проблемы безопасности и предложи улучшения:\n\n```\n{{selection}}\n```',
  },
  act_grammar: {
    name: 'Грамматика',
    prompt:
      'Исправь грамматику и орфографию. Выведи только исправленный текст:\n\n{{selection}}',
  },
  act_tone_formal: {
    name: 'Формальный тон',
    prompt: 'Перепиши следующий текст в формальном деловом тоне:\n\n{{selection}}',
  },
  act_tone_casual: {
    name: 'Непринуждённый тон',
    prompt: 'Перепиши следующий текст в непринуждённом дружеском тоне:\n\n{{selection}}',
  },
  act_expand: {
    name: 'Развернуть',
    prompt: 'Разверни следующий текст с подробностями и примерами:\n\n{{selection}}',
  },
  act_shorten: {
    name: 'Сократить',
    prompt: 'Сделай следующий текст короче, не теряя ключевой информации:\n\n{{selection}}',
  },
  act_detect_lang: {
    name: 'Определить язык',
    prompt: 'Определи язык следующего текста и объясни:\n\n{{selection}}',
  },
  act_ipa: {
    name: 'IPA',
    prompt: 'Дай IPA-произношение для следующего слова или фразы:\n\n{{selection}}',
  },
  act_etymology: {
    name: 'Этимология',
    prompt: 'Объясни этимологию и происхождение:\n\n{{selection}}',
  },
  act_examples: {
    name: 'Примеры использования',
    prompt: 'Приведи 5 примеров использования слова или фразы:\n\n{{selection}}',
  },
  act_explain_code: {
    name: 'Объяснить код',
    prompt: 'Объясни по шагам, что делает этот код:\n\n```\n{{selection}}\n```',
  },
  act_refactor: {
    name: 'Рефакторинг',
    prompt:
      'Отрефактори следующий код для читаемости и лучших практик. Объясни изменения:\n\n```\n{{selection}}\n```',
  },
  act_debug: {
    name: 'Отладка',
    prompt:
      'Найди и объясни баги в следующем коде. Предложи исправления:\n\n```\n{{selection}}\n```',
  },
  act_gen_tests: {
    name: 'Сгенерировать тесты',
    prompt: 'Сгенерируй unit-тесты для следующего кода:\n\n```\n{{selection}}\n```',
  },
  act_optimize: {
    name: 'Оптимизация',
    prompt:
      'Оптимизируй следующий код по производительности. Объясни улучшения:\n\n```\n{{selection}}\n```',
  },
  act_add_docs: {
    name: 'Добавить документацию',
    prompt: 'Добавь комментарии-документацию к следующему коду:\n\n```\n{{selection}}\n```',
  },
  act_simple: {
    name: 'Простыми словами',
    prompt: 'Объясни следующее так, как десятилетнему ребёнку:\n\n{{selection}}',
  },
  act_quiz: {
    name: 'Викторина',
    prompt: 'Составь 5 вопросов викторины по следующему материалу:\n\n{{selection}}',
  },
  act_flashcard: {
    name: 'Карточка',
    prompt: 'Создай карточку (лицевая/обратная сторона) для:\n\n{{selection}}',
  },
  act_key_concepts: {
    name: 'Ключевые идеи',
    prompt: 'Выдели и объясни ключевые концепции из:\n\n{{selection}}',
  },
  act_pros_cons: {
    name: 'За и против',
    prompt: 'Перечисли плюсы и минусы следующей темы:\n\n{{selection}}',
  },
  act_fact_check: {
    name: 'Проверка фактов',
    prompt:
      'Проанализируй следующее утверждение на точность. Укажи, что можно и нельзя проверить:\n\n{{selection}}',
  },
  act_compare: {
    name: 'Сравнение',
    prompt: 'Сравни и противопоставь следующие элементы или концепции:\n\n{{selection}}',
  },
  act_action_items: {
    name: 'Задачи',
    prompt: 'Извлеки actionable-задачи из текста в виде чеклиста:\n\n{{selection}}',
  },
  act_email: {
    name: 'Черновик письма',
    prompt: 'Напиши профессиональное письмо по следующим заметкам:\n\n{{selection}}',
  },
  act_explain_screenshot: {
    name: 'Объяснить скриншот',
    prompt:
      'Пользователь сделал скриншот области страницы «{{page_title}}» ({{url}}). Объясни, что на нём видно: текст, элементы интерфейса, структура и смысл. OCR может быть неполным — дополни визуальным анализом.\n\nТекст OCR:\n{{screenshot_ocr}}',
  },
};
