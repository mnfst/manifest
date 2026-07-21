import type { LocaleMetadata } from '../../runtime.js';

/**
 * Russian UI-only translations for the English metadata currently published by modelparams.
 *
 * The exact source text is the identity. This deliberately leaves new or changed
 * upstream metadata in English instead of guessing from a wire path or mutating the
 * provider spec received from the API.
 */
const RU_MODEL_PARAM_LABELS = {
  'Budget tokens': 'Бюджет токенов',
  'Chunk length': 'Длина фрагмента',
  'Disable search': 'Отключить поиск',
  'Do sample': 'Использовать сэмплирование',
  Effort: 'Уровень усилий',
  'Enable thinking': 'Включить размышления',
  'Expert type': 'Тип эксперта',
  'Flat NER': 'Плоское распознавание именованных сущностей (NER)',
  'Frequency penalty': 'Штраф за частоту',
  'Include thoughts': 'Включать рассуждения',
  'Log probabilities': 'Логарифмические вероятности',
  'Max completion tokens': 'Максимум токенов ответа',
  'Max output tokens': 'Максимум выходных токенов',
  'Max tokens': 'Максимум токенов',
  'Number of completions': 'Количество вариантов ответа',
  Overlap: 'Перекрытие',
  'Presence penalty': 'Штраф за присутствие',
  'Prompt mode': 'Режим промпта',
  'Random seed': 'Начальное значение генератора случайных чисел',
  'Reasoning budget': 'Бюджет рассуждений',
  'Reasoning effort': 'Глубина рассуждений',
  'Reasoning summary': 'Сводка рассуждений',
  'Repetition penalty': 'Штраф за повторы',
  'Response MIME type': 'MIME-тип ответа',
  'Response format': 'Формат ответа',
  'Return images': 'Возвращать изображения',
  'Return related questions': 'Возвращать связанные вопросы',
  'Safe prompt': 'Защитный промпт',
  'Safety mode': 'Режим безопасности',
  'Search after date': 'Искать материалы, опубликованные после даты',
  'Search before date': 'Искать материалы, опубликованные до даты',
  'Search context size': 'Объём контекста поиска',
  'Search domain filter': 'Фильтр доменов поиска',
  'Search mode': 'Режим поиска',
  'Search recency filter': 'Фильтр по давности',
  Seed: 'Начальное значение генератора',
  'Split reasoning': 'Отделять рассуждения',
  Stop: 'Остановка',
  'Stop sequence': 'Стоп-последовательность',
  'Stop sequences': 'Стоп-последовательности',
  Temperature: 'Температура',
  'Text format': 'Формат текста',
  'Thinking budget': 'Бюджет размышлений',
  'Thinking display': 'Отображение размышлений',
  'Thinking level': 'Уровень размышлений',
  'Thinking mode': 'Режим размышлений',
  'Thinking token budget': 'Бюджет токенов размышлений',
  Threshold: 'Порог',
  'Tool choice': 'Выбор инструмента',
  'Top K': 'Top K',
  'Top P': 'Top P',
  Verbosity: 'Подробность',
} as const satisfies Readonly<Record<string, string>>;

const RU_MODEL_PARAM_DESCRIPTIONS = {
  'A string or list of strings where the API will stop generating further tokens. The returned text will not contain the stop sequence.':
    'Строка или список строк, при обнаружении которых API прекращает дальнейшую генерацию токенов. Возвращаемый текст не содержит стоп-последовательность.',
  'Best-effort deterministic sampling seed. Changing the seed produces a different response with similar characteristics. Fix the seed to reproduce results.':
    'Начальное значение для детерминированного сэмплирования без строгой гарантии. Изменение значения даёт другой ответ со схожими характеристиками. Зафиксируйте значение для воспроизведения результатов.',
  'Best-effort deterministic sampling seed. Repeated requests with the same seed and parameters should return the same result.':
    'Начальное значение для детерминированного сэмплирования без строгой гарантии. Повторные запросы с тем же начальным значением и параметрами должны давать одинаковый результат.',
  'Confidence threshold for entity detection. Lower values detect more entities but may include false positives.':
    'Порог уверенности при распознавании сущностей. Низкие значения выявляют больше сущностей, но могут давать ложные срабатывания.',
  'Context window size for processing. Longer texts are automatically split into chunks with overlap for complete coverage. Must be greater than overlap.':
    'Размер контекстного окна для обработки. Более длинные тексты автоматически делятся на перекрывающиеся фрагменты для полного охвата. Значение должно быть больше значения параметра overlap.',
  'Controls Anthropic response thoroughness and token spend.':
    'Управляет полнотой ответов Anthropic и расходом токенов.',
  "Controls Cohere's built-in safety instructions applied to the generation.":
    'Управляет встроенными инструкциями безопасности Cohere, применяемыми при генерации.',
  'Controls DeepSeek thinking effort when thinking mode is enabled.':
    'Управляет глубиной рассуждений DeepSeek при включённом режиме размышлений.',
  'Controls Gemini 3 Flash reasoning effort.': 'Управляет глубиной рассуждений Gemini 3 Flash.',
  'Controls Gemini 3 Pro reasoning effort.': 'Управляет глубиной рассуждений Gemini 3 Pro.',
  'Controls Gemini 3.1 Flash-Lite reasoning effort.':
    'Управляет глубиной рассуждений Gemini 3.1 Flash-Lite.',
  'Controls Gemini 3.5 Flash reasoning effort.': 'Управляет глубиной рассуждений Gemini 3.5 Flash.',
  'Controls Qwen3 thinking mode when using OpenAI-compatible clients that pass provider-specific extra body fields.':
    'Управляет режимом размышлений Qwen3 в OpenAI-совместимых клиентах, которые передают дополнительные поля тела запроса для конкретного провайдера.',
  "Controls how concise or detailed the model's final text response should be.":
    'Определяет, насколько кратким или подробным будет итоговый текстовый ответ модели.',
  'Controls how much reasoning Grok performs before responding. Set to none for non-reasoning requests.':
    'Управляет объёмом рассуждений Grok перед ответом. Для запросов без рассуждений задайте значение none.',
  'Controls how much reasoning and searching the model performs before producing the report.':
    'Определяет объём рассуждений и поиска модели перед подготовкой отчёта.',
  'Controls how much reasoning the model should perform before producing an answer.':
    'Управляет объёмом рассуждений модели перед подготовкой ответа.',
  'Controls how much web search context is retrieved before generating the answer.':
    'Управляет объёмом контекста, извлекаемого веб-поиском перед генерацией ответа.',
  'Controls nucleus sampling by limiting generation to tokens whose cumulative probability reaches this value.':
    'Управляет ядерным сэмплированием, ограничивая генерацию токенами, совокупная вероятность которых достигает этого значения.',
  'Controls nucleus sampling by limiting generation to tokens within the selected cumulative probability.':
    'Управляет ядерным сэмплированием, ограничивая генерацию токенами в пределах заданной совокупной вероятности.',
  'Controls nucleus sampling by limiting generation to tokens within the selected cumulative probability. Not recommended to modify both temperature and top_p in the same call.':
    'Управляет ядерным сэмплированием, ограничивая генерацию токенами в пределах заданной совокупной вероятности. Не рекомендуется одновременно изменять temperature и top_p в одном вызове.',
  'Controls nucleus sampling. In DeepSeek thinking mode this parameter is accepted for compatibility but has no effect.':
    'Управляет ядерным сэмплированием. В режиме размышлений DeepSeek этот параметр принимается для совместимости, но ни на что не влияет.',
  'Controls randomness. In DeepSeek thinking mode this parameter is accepted for compatibility but has no effect.':
    'Управляет случайностью. В режиме размышлений DeepSeek этот параметр принимается для совместимости, но ни на что не влияет.',
  'Controls randomness. Lower values are more focused; higher values are more varied. Ignored while thinking is enabled, where it is forced to 1.0.':
    'Управляет случайностью. Низкие значения делают ответы более сфокусированными, высокие — более разнообразными. При включённых размышлениях параметр игнорируется, а его значение принудительно устанавливается равным 1.0.',
  'Controls randomness. Lower values make outputs more focused; higher values make them more varied.':
    'Управляет случайностью. Низкие значения делают ответы более сфокусированными, высокие — более разнообразными.',
  'Controls randomness. Lower values make outputs more focused; higher values make them more varied. Not recommended to modify both temperature and top_p in the same call.':
    'Управляет случайностью. Низкие значения делают ответы более сфокусированными, высокие — более разнообразными. Не рекомендуется изменять temperature и top_p одновременно в одном вызове.',
  'Controls randomness. Lower values make outputs more focused; higher values make them more varied. Values must be greater than 0 and at most 1.':
    'Управляет случайностью. Низкие значения делают ответы более сфокусированными, высокие — более разнообразными. Значение должно быть больше 0 и не больше 1.',
  'Controls the Anthropic thinking mode values supported by this model.':
    'Определяет значения режима размышлений Anthropic, поддерживаемые этой моделью.',
  'Controls the level of reasoning summary returned with the response.':
    'Управляет подробностью сводки рассуждений, возвращаемой вместе с ответом.',
  "Controls the reasoning mode. 'none' disables reasoning tokens, 'low' enables low-effort reasoning, and 'high' enables full reasoning.":
    'Управляет режимом рассуждений. Значение none отключает токены рассуждений, low включает неглубокие рассуждения, а high — полноценные.',
  "Controls the reasoning mode. 'none' disables reasoning tokens, 'medium' enables efficient reasoning, and 'high' enables full reasoning.":
    'Управляет режимом рассуждений. Значение none отключает токены рассуждений, medium включает эффективные рассуждения, а high — полноценные.',
  'Controls whether Anthropic returns summarized or omitted thinking content.':
    'Управляет тем, возвращает ли Anthropic сводку размышлений или опускает их содержание.',
  'Controls whether DeepSeek uses thinking mode before producing the final answer.':
    'Управляет тем, использует ли DeepSeek режим размышлений перед подготовкой итогового ответа.',
  'Controls whether Gemini returns available thought summaries in the response parts.':
    'Управляет тем, возвращает ли Gemini доступные сводки размышлений в частях ответа.',
  'Controls whether Kimi reasons step by step before answering, or responds directly when set to disabled.':
    'Управляет тем, рассуждает ли Kimi пошагово перед ответом или отвечает сразу при значении disabled.',
  'Controls whether Kimi reasons step by step before answering. Thinking is enabled by default; set disabled to respond directly.':
    'Управляет тем, рассуждает ли Kimi пошагово перед ответом. По умолчанию размышления включены; для прямого ответа задайте disabled.',
  'Controls whether MiMo reasons step by step before answering. Enabled by default; set disabled to respond directly.':
    'Управляет тем, рассуждает ли MiMo пошагово перед ответом. По умолчанию размышления включены; для прямого ответа задайте disabled.',
  'Controls whether Mistral injects its safety prompt before the conversation.':
    'Управляет тем, добавляет ли Mistral свой защитный промпт перед диалогом.',
  'Controls whether the Responses API request uses the 4-agent or 16-agent multi-agent setup.':
    'Управляет тем, использует ли запрос Responses API мультиагентную конфигурацию из 4 или 16 агентов.',
  'Controls whether the Responses API returns free-form text, JSON mode output, or structured JSON schema output.':
    'Управляет тем, возвращает ли Responses API текст в свободной форме, вывод в режиме JSON или структурированный JSON по схеме.',
  'Controls whether the model may call tools, must call one, or skips tool calls.':
    'Управляет тем, может ли модель вызывать инструменты, обязана ли вызвать один или пропускает вызовы инструментов.',
  'Controls whether the model reasons step by step before producing its final answer.':
    'Управляет тем, рассуждает ли модель пошагово перед подготовкой итогового ответа.',
  'Controls whether the model returns normal text or JSON mode output.':
    'Управляет тем, возвращает ли модель обычный текст или вывод в режиме JSON.',
  'Controls whether the model returns normal text or JSON object output.':
    'Управляет тем, возвращает ли модель обычный текст или JSON-объект.',
  'Controls whether the model returns normal text or a schema-constrained JSON object.':
    'Управляет тем, возвращает ли модель обычный текст или JSON-объект, ограниченный схемой.',
  'Controls whether the model returns text, JSON mode output, or structured JSON schema output.':
    'Управляет тем, возвращает ли модель текст, вывод в режиме JSON или структурированный JSON по схеме.',
  'Controls whether the response includes log probabilities for the generated tokens.':
    'Управляет тем, включает ли ответ логарифмические вероятности сгенерированных токенов.',
  'Controls whether the response includes suggested follow-up questions.':
    'Управляет тем, включает ли ответ предлагаемые дополнительные вопросы.',
  'Controls whether the response may include related images from the search.':
    'Управляет тем, может ли ответ включать связанные изображения из поиска.',
  "Enables Mistral's reasoning system prompt; leave unset to disable the default reasoning behavior.":
    'Включает системный промпт Mistral для рассуждений; оставьте параметр незаданным, чтобы отключить стандартное поведение рассуждений.',
  'Forces the model to either call a tool or skip tool calls for this request.':
    'Принуждает модель либо вызвать инструмент, либо пропустить вызовы инструментов для этого запроса.',
  'Forces the response into plain text or a JSON object.':
    'Принудительно задаёт формат ответа: обычный текст или JSON-объект.',
  'Forces the response into plain text, a JSON object, or JSON matching a provided schema.':
    'Принудительно задаёт формат ответа: обычный текст, JSON-объект или JSON, соответствующий заданной схеме.',
  'How many chat completion choices to generate for the request.':
    'Определяет, сколько вариантов ответа Chat Completions будет сгенерировано для запроса.',
  'Limits generation to the selected number of highest-probability tokens.':
    'Ограничивает генерацию заданным числом токенов с наибольшей вероятностью.',
  'Limits sampling to the K most likely tokens; 0 disables top-k sampling.':
    'Ограничивает сэмплирование K наиболее вероятными токенами; 0 отключает top-k-сэмплирование.',
  'Limits search to, or excludes, specific domains.':
    'Ограничивает поиск заданными доменами или исключает их.',
  'Limits token sampling to the top K most likely next tokens.':
    'Ограничивает сэмплирование K наиболее вероятными следующими токенами.',
  'MIME type for generated text candidates.': 'MIME-тип сгенерированных текстовых вариантов.',
  'Maximum number of output tokens the model may generate.':
    'Максимальное число выходных токенов, которые может сгенерировать модель.',
  'Maximum number of thinking tokens Gemini should use before producing the final answer.':
    'Максимальное число токенов размышлений, которые Gemini может использовать перед подготовкой итогового ответа.',
  'Maximum number of tokens the model may spend on reasoning before answering.':
    'Максимальное число токенов, которые модель может потратить на рассуждения перед ответом.',
  'Maximum number of tokens the model may use for internal reasoning before being forced to end the reasoning trace. Use -1 to disable budget enforcement.':
    'Максимальное число токенов для внутренних рассуждений модели, после которого цепочка рассуждений принудительно завершается. Чтобы отключить ограничение бюджета, задайте -1.',
  'Maximum number of tokens to generate in the chat completion, covering both thinking and the final answer.':
    'Максимальное число токенов в ответе Chat Completions, включая токены размышлений и токены итогового ответа.',
  'Maximum number of tokens to generate in the chat completion.':
    'Максимальное число токенов в ответе Chat Completions.',
  'Maximum number of tokens to generate in the completion.':
    'Максимальное число токенов в сгенерированном ответе.',
  'Maximum number of tokens to generate in the response.': 'Максимальное число токенов в ответе.',
  'Maximum number of tokens to generate, covering both the thinking trace and the final answer.':
    'Максимальное число генерируемых токенов, включая цепочку рассуждений и итоговый ответ.',
  'Maximum number of tokens to generate. Generation stops when this limit is reached.':
    'Максимальное число генерируемых токенов. При достижении этого предела генерация останавливается.',
  'Maximum number of tokens to include in a response candidate.':
    'Максимальное число токенов в варианте ответа.',
  'Maximum token budget Anthropic may use for extended thinking before producing the final answer.':
    'Максимальный бюджет токенов, который Anthropic может использовать для расширенных размышлений перед подготовкой итогового ответа.',
  'Nucleus sampling cutoff. Ignored while thinking is enabled, where it is forced to 0.95.':
    'Порог ядерного сэмплирования. При включённых размышлениях игнорируется и принудительно равен 0.95.',
  'Number of thinking tokens Gemini should use; -1 uses dynamic thinking, 0 disables thinking, and fixed budgets start at 512 tokens.':
    'Число токенов размышлений для Gemini: -1 включает динамические размышления, 0 отключает их, а фиксированный бюджет начинается с 512 токенов.',
  'Number of thinking tokens Gemini should use; 0 disables thinking and -1 uses dynamic thinking.':
    'Число токенов размышлений для Gemini: 0 отключает размышления, а -1 включает динамический режим.',
  'Only adaptive thinking is supported; omit the parameter entirely to run without thinking (an explicit disabled value is rejected).':
    'Поддерживается только адаптивный режим размышлений. Чтобы выполнить запрос без размышлений, полностью опустите параметр: явное значение disabled будет отклонено.',
  'Optional seed used for decoding when reproducible sampling is desired.':
    'Необязательное начальное значение для декодирования, когда требуется воспроизводимое сэмплирование.',
  "Penalizes new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.":
    'Штрафует новые токены с учётом их частоты в уже созданном тексте, снижая вероятность дословного повтора той же строки.',
  'Penalizes repeated words or phrases to encourage a wider variety of generated content.':
    'Штрафует повторяющиеся слова или фразы, чтобы повысить разнообразие генерируемого текста.',
  'Penalizes tokens by how often they have appeared, reducing verbatim repetition.':
    'Штрафует токены с учётом того, как часто они встречались, снижая количество дословных повторов.',
  'Penalizes tokens in proportion to how often they have appeared, reducing verbatim repetition.':
    'Штрафует токены пропорционально частоте их появления, снижая количество дословных повторов.',
  'Penalizes tokens proportional to how often they have already appeared to reduce repetition.':
    'Штрафует токены пропорционально частоте их предыдущего появления, снижая количество повторов.',
  'Penalizes tokens that have already appeared to encourage a wider variety of content.':
    'Штрафует токены, которые уже встречались, чтобы повысить разнообразие текста.',
  'Penalizes tokens that have already appeared to reduce repetition in the output.':
    'Штрафует токены, которые уже встречались, чтобы сократить повторы в выводе.',
  'Penalizes tokens that have already appeared, encouraging the model to introduce new topics.':
    'Штрафует токены, которые уже встречались, побуждая модель переходить к новым темам.',
  'Penalizes tokens that have already appeared, encouraging the model to talk about new topics.':
    'Штрафует токены, которые уже встречались, побуждая модель говорить о новых темах.',
  'Penalizes words based on how often they already appear in the generated text.':
    'Штрафует слова с учётом частоты их появления в уже сгенерированном тексте.',
  "Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.":
    'Положительные значения штрафуют новые токены в зависимости от того, встречались ли они ранее в тексте, повышая вероятность перехода модели к новым темам.',
  'Restricts search results to content published after this date (MM/DD/YYYY).':
    'Ограничивает результаты поиска материалами, опубликованными после этой даты (MM/DD/YYYY).',
  'Restricts search results to content published before this date (MM/DD/YYYY).':
    'Ограничивает результаты поиска материалами, опубликованными до этой даты (MM/DD/YYYY).',
  'Restricts web search results to a recent time window.':
    'Ограничивает результаты веб-поиска определённым периодом давности.',
  "Returns the model's reasoning in a separate reasoning_details field instead of inline with the response.":
    'Возвращает рассуждения модели в отдельном поле reasoning_details, а не непосредственно в ответе.',
  'Seed used for best-effort deterministic sampling when reproducible outputs are desired.':
    'Начальное значение для детерминированного сэмплирования без строгой гарантии, когда требуется воспроизводимый вывод.',
  'Seed used for deterministic sampling when reproducible outputs are desired.':
    'Начальное значение для детерминированного сэмплирования, когда требуется воспроизводимый вывод.',
  'Selects the corpus the model searches when grounding its answer.':
    'Выбирает корпус для поиска: модель основывает ответ на найденных в нём данных.',
  'Stops generation when one of these sequences is detected; up to five are allowed.':
    'Останавливает генерацию при обнаружении одной из этих последовательностей; допускается до пяти.',
  'Stops generation when this sequence is produced. xAI accepts up to four stop sequences.':
    'Останавливает генерацию при появлении этой последовательности. xAI принимает до четырёх стоп-последовательностей.',
  'Stops generation when this string is detected.':
    'Останавливает генерацию при обнаружении этой строки.',
  "The type of expert to use. 'knowledge' answers with USD knowledge, 'code' responds with vanilla OpenUSD code, 'helperfunction' uses high-level helper functions, and 'auto' lets the LLM determine which expert to use.":
    'Тип используемого эксперта. knowledge отвечает на основе знаний USD, code возвращает обычный код OpenUSD, helperfunction использует высокоуровневые вспомогательные функции, а auto позволяет LLM выбрать эксперта.',
  "Toggles the model's extended reasoning before it produces the final answer.":
    'Включает или отключает расширенные рассуждения модели перед подготовкой итогового ответа.',
  'Token overlap between chunks to prevent entity clipping. Must be less than chunk_length.':
    'Перекрытие токенов между фрагментами, предотвращающее разрыв сущностей на границах фрагментов. Значение должно быть меньше chunk_length.',
  'Turns off web search so the model answers from its own knowledge only.':
    'Отключает веб-поиск, чтобы модель отвечала только на основе собственных знаний.',
  'Up to a few sequences where generation stops; the stop text is not included in the output.':
    'До нескольких последовательностей, при обнаружении которых генерация останавливается; стоп-текст не включается в вывод.',
  'Upper bound for output tokens generated in the Responses API response.':
    'Верхняя граница числа выходных токенов в ответе Responses API.',
  'Upper bound for visible output tokens generated in the chat completion.':
    'Верхняя граница числа видимых выходных токенов в ответе Chat Completions.',
  'When false, the model uses greedy decoding and ignores temperature and top_p.':
    'При значении false модель использует жадное декодирование и игнорирует temperature и top_p.',
  'When true, prevents overlapping entity spans. When false, may return nested entities such as both a full name and its constituent first name.':
    'При значении true не допускает перекрытия спанов сущностей. При false может возвращать вложенные сущности — например, полное имя и отдельно входящее в него личное имя.',
} as const satisfies Readonly<Record<string, string>>;

export const metadata = {
  modelParamLabels: RU_MODEL_PARAM_LABELS,
  modelParamDescriptions: RU_MODEL_PARAM_DESCRIPTIONS,
} as const satisfies LocaleMetadata;
