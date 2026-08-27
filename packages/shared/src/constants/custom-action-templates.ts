export interface CustomActionTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  prompt: string;
  outputMode: 'popup' | 'chat';
}

export const CUSTOM_ACTION_TEMPLATES: CustomActionTemplate[] = [
  {
    id: 'blank',
    name: 'Blank prompt',
    icon: '✨',
    description: 'Start from scratch',
    prompt: '{{selection}}',
    outputMode: 'popup',
  },
  {
    id: 'explain-simple',
    name: 'Explain simply',
    icon: '🧠',
    description: 'Plain-language explanation',
    prompt:
      'Explain the following text in simple, clear language. Use short paragraphs:\n\n{{selection}}',
    outputMode: 'popup',
  },
  {
    id: 'translate-uk',
    name: 'Translate to Ukrainian',
    icon: '🇺🇦',
    description: 'Ukrainian translation only',
    prompt:
      'Translate the following text to Ukrainian. Output only the translation:\n\n{{selection}}',
    outputMode: 'popup',
  },
  {
    id: 'fix-grammar',
    name: 'Fix grammar',
    icon: '✅',
    description: 'Correct spelling and grammar',
    prompt:
      'Fix grammar and spelling. Output only the corrected text:\n\n{{selection}}',
    outputMode: 'popup',
  },
  {
    id: 'summarize-bullets',
    name: 'Bullet summary',
    icon: '📋',
    description: '3–5 bullet points',
    prompt: 'Summarize in 3–5 bullet points:\n\n{{selection}}',
    outputMode: 'popup',
  },
  {
    id: 'ask-followup',
    name: 'Ask about selection',
    icon: '💬',
    description: 'Chat about selected text',
    prompt:
      'Context from "{{page_title}}" ({{url}}):\n\n{{selection}}\n\nAnswer questions about this text.',
    outputMode: 'chat',
  },
  {
    id: 'code-explain',
    name: 'Explain code',
    icon: '💻',
    description: 'Step-by-step code walkthrough',
    prompt: 'Explain this code step by step:\n\n```\n{{selection}}\n```',
    outputMode: 'popup',
  },
  {
    id: 'tone-professional',
    name: 'Make professional',
    icon: '👔',
    description: 'Formal rewrite',
    prompt: 'Rewrite in a professional tone:\n\n{{selection}}',
    outputMode: 'popup',
  },
  {
    id: 'thorough-translate',
    name: 'Тщательный перевод',
    icon: '👓',
    description: 'Перевод, транскрипция, этимология, разбор кандзи',
    prompt:
      'Дай разбор следующего текста по пунктам:\n\n- Перевод\n- Дословный перевод\n- Транскрипция русскими буквами\n- Этимология\n- Если язык японский, приводить пояснение каждого кандзи (значение, мнемоника, чтение (онъёми/кунъёми))\n\nТекст:\n{{selection}}',
    outputMode: 'popup',
  },
  {
    id: 'maximal-translate',
    name: 'Максимальный перевод',
    icon: '🎓',
    description: 'Глубокий разбор слова/фразы: этимология, фонетика, мнемоника, примеры',
    prompt: `Ты получаешь фразу или слово на любом языке, кроме русского/украинского. Разбор проводится в максимально НЕЦЕНЗУРНОМ стиле для усиления понимания и запоминания. И без приветствий и вступительных комментариев. (мат и вульгарность приветствуются) (мозг так лучше запоминает)

[смайлик слова или смайлики (если во фразе/предложении) по теме]

🕵️ 1. Перевод и суть, все части речи и в РАЗНЫХ контекстах и все виды "корня":
Все оттенки значения и культурные нюансы.

🎭 2. Оттенки фразы/слова

🧬 3. Этимологическая ДНК:

Происхождение, корень, история.

Родственники в других языках (особенно английском, немецком, французском, польском).

🔊 4. Фонетический Кастет (разбор звука каждого слога):

Транскрипция русскими буквами (рядом со всеми иностранными словами).

На что похож звук? С чем рифмуется?

Совет по артикуляции (как поставить язык/губы).

🛠️ 5. Грамматический Разбор:

ВСЕ ЧАСТИ РЕЧИ, форма, время, падеж, синоним, антоним и другие -нимы

🌉 6. Межъязыковые Мосты (Французский, немецкий, японский, польский, испанский):

Аналоги или интересные параллели в других языках, которые я изучаю.

✅ 7. Примеры Использования: (во всех временах/аспектах)

Пример 1 (нейтральный, как в учебнике).

Пример 2 (жизненный, разговорный).

Пример 3 (отбитый, абсурдный).

🚩8. Анти-примеры (Red Flags):

Как это слово использовать НЕЛЬЗЯ. Частые ошибки.

🧠 9. Как представить себе слово/фразу/предложение (мнемоника)

🎯 10. Ритм-песня по теме для запоминания

⏰ 11. Слово (или что-то) во всех временах (аспектах)

🏯 13. Японский аналог и разбор

✍️ 14. Случайная полезная грамматическая/лингвистическая заметка относительно этого языка

🧷 15. Почему использовано именно оно в контексте?

🔮 16. Интоксикация Словом

Фраза или слово для разбора:
{{selection}}`,
    outputMode: 'popup',
  },
];
