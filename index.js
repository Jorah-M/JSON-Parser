// Загружаем переменные окружения из .env
require("dotenv").config();

const fs = require("fs");

// Groq совместим с OpenAI SDK, поэтому используем один пакет для обоих провайдеров
const OpenAI = require("openai");

// Нужен хотя бы один ключ
if (!process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
  console.error(
    "Ошибка: не найден ни OPENAI_API_KEY, ни GROQ_API_KEY. Добавьте хотя бы один в .env"
  );
  process.exit(1);
}

// Входной файл — из аргумента CLI или input.txt по умолчанию
const INPUT_FILE = process.argv[2] || "input.txt";

// Выходной файл с временной меткой, чтобы не перезаписывать предыдущие результаты
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUTPUT_FILE = `output_${timestamp}.json`;

// Промпт просит вернуть валидный JSON со списком товаров
const SYSTEM_PROMPT = `
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

// Универсальная функция запроса — принимает любой клиент и модель
async function requestAI(client, model, inputText) {
  const response = await client.chat.completions.create({
    model,
    // Гарантируем валидный JSON в ответе
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: inputText },
    ],
  });
  return JSON.parse(response.choices[0].message.content);
}

async function main() {
  // Читаем входной текст
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Файл "${INPUT_FILE}" не найден.`);
    process.exit(1);
  }
  const inputText = fs.readFileSync(INPUT_FILE, "utf-8").trim();
  console.log(`Входной файл: ${INPUT_FILE}\n`);

  let parsed;

  // Шаг 1: пробуем OpenAI (приоритет)
  if (process.env.OPENAI_API_KEY) {
    console.log("Отправляем запрос через OpenAI...");
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      parsed = await requestAI(client, "gpt-4o-mini", inputText);
      console.log("Успешно (OpenAI).");
    } catch (err) {
      console.warn(`OpenAI вернул ошибку: ${err.message}`);
      if (!process.env.GROQ_API_KEY) {
        console.error("GROQ_API_KEY тоже не задан. Нет доступного провайдера.");
        process.exit(1);
      }
      console.log("Переключаемся на Groq...");
    }
  }

  // Шаг 2: если OpenAI не сработал — пробуем Groq
  if (!parsed && process.env.GROQ_API_KEY) {
    try {
      const client = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
      });
      parsed = await requestAI(client, "llama-3.1-8b-instant", inputText);
      console.log("Успешно (Groq).");
    } catch (err) {
      console.error(`Groq вернул ошибку: ${err.message}`);
      process.exit(1);
    }
  }

  // Сохраняем результат
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(parsed, null, 2), "utf-8");

  // Выводим результат таблицей для наглядности
  console.log("\nРезультат:");
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
