// Загружаем переменные окружения из .env
require("dotenv").config();

const fs = require("fs");
// Groq совместим с OpenAI SDK, поэтому используем тот же пакет
const Groq = require("openai");

// Проверяем наличие API ключа до любых запросов
if (!process.env.GROQ_API_KEY) {
  console.error("Ошибка: GROQ_API_KEY не найден. Создайте файл .env на основе .env.example.");
  process.exit(1);
}

// Инициализируем клиент Groq
const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// Входной файл — из аргумента CLI или input.txt по умолчанию
const INPUT_FILE = process.argv[2] || "input.txt";

// Выходной файл с временной меткой, чтобы не перезаписывать предыдущие результаты
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUTPUT_FILE = `output_${timestamp}.json`;

async function main() {
  // Читаем входной текст
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Файл "${INPUT_FILE}" не найден.`);
    process.exit(1);
  }
  const inputText = fs.readFileSync(INPUT_FILE, "utf-8").trim();
  console.log(`Входной файл: ${INPUT_FILE}`);
  console.log("Отправляем в Groq...\n");

  // Промпт просит вернуть валидный JSON со списком товаров
  const systemPrompt = `
Ты — парсер списков покупок. Из произвольного текста извлеки список товаров.
Верни ТОЛЬКО JSON-объект вида:
{
  "items": [
    { "name": "...", "quantity": "...", "price": "..." }
  ]
}
Если количество или цена не указаны — используй "unknown".
Количество пиши с единицей измерения (например "2 литра", "1 кг").
Цену пиши с валютой (например "89 рублей").
`.trim();

  let parsed;
  try {
    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      // Гарантируем валидный JSON в ответе
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: inputText },
      ],
    });

    const raw = response.choices[0].message.content;

    // Парсим ответ модели
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error("Ошибка при запросе к Groq или парсинге ответа:", err.message);
    process.exit(1);
  }

  // Сохраняем результат в output_<timestamp>.json
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(parsed, null, 2), "utf-8");

  // Выводим результат таблицей для наглядности
  console.log("Результат:");
  console.table(
    parsed.items.map((item) => ({
      Товар: item.name,
      Количество: item.quantity,
      Цена: item.price,
    }))
  );

  console.log(`\nРезультат сохранён в ${OUTPUT_FILE}`);
}

main();
