import type { ActionLocale } from '@/shared/utils/resolve-action-locale';

export interface LocalizedActionText {
  name: string;
  prompt: string;
}

export const THOROUGH_TRANSLATE: Record<ActionLocale, LocalizedActionText> = {
  en: {
    name: 'Thorough translation',
    prompt:
      'Analyze the following text with these sections:\n\n- Translation\n- Literal translation\n- Phonetic transcription (Latin letters)\n- Etymology\n- If the language is Japanese, explain each kanji (meaning, mnemonic, reading onyomi/kunyomi)\n\nText:\n{{selection}}',
  },
  ru: {
    name: 'Тщательный перевод',
    prompt:
      'Дай разбор следующего текста по пунктам:\n\n- Перевод\n- Дословный перевод\n- Транскрипция русскими буквами\n- Этимология\n- Если язык японский, приводить пояснение каждого кандзи (значение, мнемоника, чтение (онъёми/кунъёми))\n\nТекст:\n{{selection}}',
  },
  uk: {
    name: 'Ретельний переклад',
    prompt:
      'Дай розбір наступного тексту за пунктами:\n\n- Переклад\n- Дослівний переклад\n- Транскрипція українськими літерами\n- Етимологія\n- Якщо мова японська, пояснюй кожен кандзі (значення, мнемоніка, читання (он\'ємі/кун\'ємі))\n\nТекст:\n{{selection}}',
  },
  de: {
    name: 'Gründliche Übersetzung',
    prompt:
      'Analysiere den folgenden Text in diesen Abschnitten:\n\n- Übersetzung\n- Wörtliche Übersetzung\n- Lautschrift (lateinische Buchstaben)\n- Etymologie\n- Bei Japanisch: Erklärung jedes Kanji (Bedeutung, Mnemonik, Lesung Onyomi/Kunyomi)\n\nText:\n{{selection}}',
  },
  fr: {
    name: 'Traduction approfondie',
    prompt:
      'Analyse le texte suivant avec ces sections :\n\n- Traduction\n- Traduction littérale\n- Transcription phonétique (lettres latines)\n- Étymologie\n- Si la langue est le japonais, explique chaque kanji (sens, mnémotechnique, lecture onyomi/kunyomi)\n\nTexte :\n{{selection}}',
  },
  es: {
    name: 'Traducción detallada',
    prompt:
      'Analiza el siguiente texto con estas secciones:\n\n- Traducción\n- Traducción literal\n- Transcripción fonética (letras latinas)\n- Etimología\n- Si el idioma es japonés, explica cada kanji (significado, mnemotecnia, lectura onyomi/kunyomi)\n\nTexto:\n{{selection}}',
  },
  pl: {
    name: 'Dokładne tłumaczenie',
    prompt:
      'Przeanalizuj poniższy tekst w tych sekcjach:\n\n- Tłumaczenie\n- Tłumaczenie dosłowne\n- Transkrypcja fonetyczna (litery łacińskie)\n- Etymologia\n- Jeśli język to japoński, wyjaśnij każde kanji (znaczenie, mnemotechnika, odczyt onyomi/kunyomi)\n\nTekst:\n{{selection}}',
  },
  it: {
    name: 'Traduzione approfondita',
    prompt:
      'Analizza il testo seguente con queste sezioni:\n\n- Traduzione\n- Traduzione letterale\n- Trascrizione fonetica (lettere latine)\n- Etimologia\n- Se la lingua è giapponese, spiega ogni kanji (significato, mnemonica, lettura onyomi/kunyomi)\n\nTesto:\n{{selection}}',
  },
  pt: {
    name: 'Tradução detalhada',
    prompt:
      'Analise o texto a seguir com estas seções:\n\n- Tradução\n- Tradução literal\n- Transcrição fonética (letras latinas)\n- Etimologia\n- Se o idioma for japonês, explique cada kanji (significado, mnemônica, leitura onyomi/kunyomi)\n\nTexto:\n{{selection}}',
  },
  ja: {
    name: '詳細翻訳',
    prompt:
      '次のテキストを以下の項目で分析してください：\n\n- 翻訳\n- 直訳\n- 音声表記（カタカナ）\n- 語源\n- 日本語の場合は各漢字の説明（意味、記憶術、音読み/訓読み）\n\nテキスト：\n{{selection}}',
  },
  zh: {
    name: '深度翻译',
    prompt:
      '按以下部分分析下列文本：\n\n- 翻译\n- 直译\n- 音标/拼音转写\n- 词源\n- 如果是日语，解释每个汉字（含义、记忆法、音读/训读）\n\n文本：\n{{selection}}',
  },
};

function maximalPrompt(locale: ActionLocale): string {
  const blocks: Record<ActionLocale, string> = {
    en: `You receive a word or phrase in any language other than English. Analyze it in a maximally UNCENSORED style to boost understanding and memory. No greetings or intro comments. (Profanity and vulgarity are welcome — the brain remembers better.)

[emoji for the word or phrase theme]

🕵️ 1. Translation and core meaning — all parts of speech, different contexts, all "root" forms:
All shades of meaning and cultural nuances.

🎭 2. Shades of the word/phrase

🧬 3. Etymological DNA:
Origin, root, history.
Relatives in other languages (especially English, German, French, Polish).

🔊 4. Phonetic breakdown (each syllable):
Transcription in Latin letters (next to all foreign words).
What does the sound resemble? What does it rhyme with?
Articulation tip (tongue/lips).

🛠️ 5. Grammar breakdown:
ALL parts of speech, form, tense, case, synonym, antonym, etc.

🌉 6. Cross-language bridges (French, German, Japanese, Polish, Spanish):
Analogues or interesting parallels in languages I study.

✅ 7. Usage examples (all tenses/aspects):
Example 1 (neutral, textbook).
Example 2 (everyday, conversational).
Example 3 (wild, absurd).

🚩 8. Anti-examples (Red Flags):
How NOT to use this word. Common mistakes.

🧠 9. How to visualize the word/phrase (mnemonic)

🎯 10. Rhythm song on the theme for memorization

⏰ 11. The word in all tenses/aspects

🏯 13. Japanese analogue and breakdown

✍️ 14. Random useful grammar/linguistic note about this language

🧷 15. Why was this exact word used in context?

🔮 16. Word intoxication

Word or phrase to analyze:
{{selection}}`,
    ru: `Ты получаешь фразу или слово на любом языке, кроме русского/украинского. Разбор проводится в максимально НЕЦЕНЗУРНОМ стиле для усиления понимания и запоминания. И без приветствий и вступительных комментариев. (мат и вульгарность приветствуются) (мозг так лучше запоминает)

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
    uk: `Ти отримуєш фразу або слово будь-якою мовою, крім української/російської. Розбір у максимально НЕЦЕНЗУРНОМУ стилі для кращого розуміння та запам'ятовування. Без привітань і вступів. (мат і вульгарність вітаються — так мозок краще запам'ятовує)

[емодзі слова або фрази за темою]

🕵️ 1. Переклад і суть, усі частини мови в РІЗНИХ контекстах і всі види "кореня":
Усі відтінки значення та культурні нюанси.

🎭 2. Відтінки фрази/слова

🧬 3. Етимологічна ДНК:
Походження, корінь, історія.
Родичі в інших мовах (особливо англійській, німецькій, французькій, польській).

🔊 4. Фонетичний розбір (кожного складу):
Транскрипція українськими літерами (поруч з усіма іноземними словами).
На що схожий звук? З чим рифмується?
Порада з артикуляції.

🛠️ 5. Граматичний розбір:
УСІ ЧАСТИНИ МОВИ, форма, час, відмінок, синонім, антонім тощо.

🌉 6. Міжмовні мости (французька, німецька, японська, польська, іспанська):
Аналоги або цікаві паралелі в мовах, які я вивчаю.

✅ 7. Приклади використання (усі часи/аспекти):
Приклад 1 (нейтральний).
Приклад 2 (розмовний).
Приклад 3 (абсурдний).

🚩 8. Анти-приклади (Red Flags):
Як НЕ можна вживати. Типові помилки.

🧠 9. Мнемоніка

🎯 10. Ритм-пісня для запам'ятовування

⏰ 11. Слово в усіх часах/аспектах

🏯 13. Японський аналог і розбір

✍️ 14. Корисна граматична/лінгвістична нотатка про цю мову

🧷 15. Чому саме це слово в контексті?

🔮 16. Інтоксикація словом

Фраза або слово для розбору:
{{selection}}`,
    de: maximalPromptShared('Deutsch', 'Transkription mit lateinischen Buchstaben'),
    fr: maximalPromptShared('français', 'Transcription en lettres latines'),
    es: maximalPromptShared('español', 'Transcripción en letras latinas'),
    pl: maximalPromptShared('polskiego', 'Transkrypcja literami łacińskimi'),
    it: maximalPromptShared('italiano', 'Trascrizione in lettere latine'),
    pt: maximalPromptShared('português', 'Transcrição em letras latinas'),
    ja: maximalPromptShared('日本語', 'カタカナによる音声表記'),
    zh: maximalPromptShared('中文', '拼音或汉字注音转写'),
  };

  return blocks[locale];
}

function maximalPromptShared(
  nativeLanguage: string,
  transcriptionLabel: string,
): string {
  return `You receive a word or phrase in any language other than ${nativeLanguage}. Analyze it in a maximally UNCENSORED style to boost understanding and memory. No greetings or intro comments. (Profanity and vulgarity are welcome.)

[emoji for the word/phrase theme]

🕵️ 1. Translation and core meaning — all parts of speech, contexts, roots
🎭 2. Shades of meaning
🧬 3. Etymological DNA — origin, root, history, cognates (English, German, French, Polish)
🔊 4. Phonetic breakdown — ${transcriptionLabel}; sound analogies; articulation tips
🛠️ 5. Grammar — parts of speech, form, tense, case, synonyms, antonyms
🌉 6. Cross-language bridges (French, German, Japanese, Polish, Spanish)
✅ 7. Usage examples — neutral, conversational, absurd (all tenses/aspects)
🚩 8. Anti-examples — common mistakes
🧠 9. Mnemonic
🎯 10. Rhythm song for memorization
⏰ 11. All tenses/aspects
🏯 13. Japanese analogue and breakdown
✍️ 14. Useful grammar/linguistic note
🧷 15. Why this word in context?
🔮 16. Word intoxication

Write the entire response in ${nativeLanguage}.

Word or phrase:
{{selection}}`;
}

export const MAXIMAL_TRANSLATE: Record<ActionLocale, LocalizedActionText> = {
  en: { name: 'Max translation', prompt: maximalPrompt('en') },
  ru: { name: 'Максимальный перевод', prompt: maximalPrompt('ru') },
  uk: { name: 'Максимальний переклад', prompt: maximalPrompt('uk') },
  de: { name: 'Maximale Übersetzung', prompt: maximalPrompt('de') },
  fr: { name: 'Traduction maximale', prompt: maximalPrompt('fr') },
  es: { name: 'Traducción máxima', prompt: maximalPrompt('es') },
  pl: { name: 'Maksymalne tłumaczenie', prompt: maximalPrompt('pl') },
  it: { name: 'Traduzione massima', prompt: maximalPrompt('it') },
  pt: { name: 'Tradução máxima', prompt: maximalPrompt('pt') },
  ja: { name: '最大翻訳', prompt: maximalPrompt('ja') },
  zh: { name: '最大翻译', prompt: maximalPrompt('zh') },
};
