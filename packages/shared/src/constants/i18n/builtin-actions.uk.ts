export const BUILTIN_ACTIONS_UK: Record<string, { name: string; prompt: string }> = {
  act_explain: {
    name: 'Пояснити',
    prompt: 'Поясни наступний текст ясно й стисло:\n\n{{selection}}',
  },
  act_translate: {
    name: 'Переклад',
    prompt:
      'Переклади наступний текст на {{language}}. Виведи лише переклад:\n\n{{selection}}',
  },
  act_ask: {
    name: 'Запитати',
    prompt:
      'Контекст зі сторінки «{{page_title}}» ({{url}}):\n\n{{selection}}\n\nВідповідай на питання користувача про цей контекст.',
  },
  act_rewrite: {
    name: 'Переписати',
    prompt:
      'Перепиши наступний текст, покращивши ясність і зв\'язність, зберігши зміст:\n\n{{selection}}',
  },
  act_summarize: {
    name: 'Короткий зміст',
    prompt: 'Стисни наступний текст у 3–5 пунктах:\n\n{{selection}}',
  },
  act_code_review: {
    name: 'Огляд коду',
    prompt:
      'Перевір наступний код. Знайди баги, проблеми безпеки та запропонуй покращення:\n\n```\n{{selection}}\n```',
  },
  act_grammar: {
    name: 'Граматика',
    prompt:
      'Виправ граматику й орфографію. Виведи лише виправлений текст:\n\n{{selection}}',
  },
  act_tone_formal: {
    name: 'Формальний тон',
    prompt: 'Перепиши наступний текст у формальному діловому тоні:\n\n{{selection}}',
  },
  act_tone_casual: {
    name: 'Невимушений тон',
    prompt: 'Перепиши наступний текст у невимушеному дружньому тоні:\n\n{{selection}}',
  },
  act_expand: {
    name: 'Розгорнути',
    prompt: 'Розгорни наступний текст із деталями та прикладами:\n\n{{selection}}',
  },
  act_shorten: {
    name: 'Скоротити',
    prompt: 'Зроби наступний текст коротшим, не втрачаючи ключової інформації:\n\n{{selection}}',
  },
  act_detect_lang: {
    name: 'Визначити мову',
    prompt: 'Визнач мову наступного тексту й поясни:\n\n{{selection}}',
  },
  act_ipa: {
    name: 'IPA',
    prompt: 'Надай IPA-вимову для наступного слова чи фрази:\n\n{{selection}}',
  },
  act_etymology: {
    name: 'Етимологія',
    prompt: 'Поясни етимологію та походження:\n\n{{selection}}',
  },
  act_examples: {
    name: 'Приклади вживання',
    prompt: 'Наведи 5 прикладів вживання слова чи фрази:\n\n{{selection}}',
  },
  act_explain_code: {
    name: 'Пояснити код',
    prompt: 'Поясни крок за кроком, що робить цей код:\n\n```\n{{selection}}\n```',
  },
  act_refactor: {
    name: 'Рефакторинг',
    prompt:
      'Відрефактори наступний код для читабельності та кращих практик. Поясни зміни:\n\n```\n{{selection}}\n```',
  },
  act_debug: {
    name: 'Налагодження',
    prompt:
      'Знайди й поясни баги в наступному коді. Запропонуй виправлення:\n\n```\n{{selection}}\n```',
  },
  act_gen_tests: {
    name: 'Згенерувати тести',
    prompt: 'Згенеруй unit-тести для наступного коду:\n\n```\n{{selection}}\n```',
  },
  act_optimize: {
    name: 'Оптимізація',
    prompt:
      'Оптимізуй наступний код за продуктивністю. Поясни покращення:\n\n```\n{{selection}}\n```',
  },
  act_add_docs: {
    name: 'Додати документацію',
    prompt: 'Додай коментарі-документацію до наступного коду:\n\n```\n{{selection}}\n```',
  },
  act_simple: {
    name: 'Простими словами',
    prompt: 'Поясни наступне так, ніби десятирічній дитині:\n\n{{selection}}',
  },
  act_quiz: {
    name: 'Вікторина',
    prompt: 'Склади 5 питань вікторини за наступним матеріалом:\n\n{{selection}}',
  },
  act_flashcard: {
    name: 'Картка',
    prompt: 'Створи картку (лицева/зворотна сторона) для:\n\n{{selection}}',
  },
  act_key_concepts: {
    name: 'Ключові ідеї',
    prompt: 'Виділи й поясни ключові концепції з:\n\n{{selection}}',
  },
  act_pros_cons: {
    name: 'За і проти',
    prompt: 'Переліч плюси й мінуси наступної теми:\n\n{{selection}}',
  },
  act_fact_check: {
    name: 'Перевірка фактів',
    prompt:
      'Проаналізуй наступне твердження на точність. Вкажи, що можна й не можна перевірити:\n\n{{selection}}',
  },
  act_compare: {
    name: 'Порівняння',
    prompt: 'Порівняй і протистав наступні елементи чи концепції:\n\n{{selection}}',
  },
  act_action_items: {
    name: 'Завдання',
    prompt: 'Виділи actionable-завдання з тексту у вигляді чеклиста:\n\n{{selection}}',
  },
  act_email: {
    name: 'Чернетка листа',
    prompt: 'Напиши професійний лист за наступними нотатками:\n\n{{selection}}',
  },
  act_explain_screenshot: {
    name: 'Пояснити скриншот',
    prompt:
      'Користувач зробив скриншот області сторінки «{{page_title}}» ({{url}}). Поясни, що на ньому видно: текст, елементи інтерфейсу, структура та зміст. OCR може бути неповним — доповни візуальним аналізом.\n\nТекст OCR:\n{{screenshot_ocr}}',
  },
};
