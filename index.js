// Загружаем переменные окружения из .env
require("dotenv").config();

const fs = require("fs");
const Groq = require("openai"); // Groq совместим с OpenAI SDK

// Инициализируем клиент Groq
const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const INPUT_FILE = "input.txt";
const OUTPUT_FILE = "output.json";

async function main() {
  // Читаем входной текст
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Файл ${INPUT_FILE} не найден.`);
    process.exit(1);
  }
  const inputText = fs.readFileSync(INPUT_FILE, "utf-8").trim();
  console.log("Входной текст прочитан. Отправляем в Groq...");

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

  // Сохраняем результат в output.json
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(parsed, null, 2), "utf-8");
  console.log(`Готово! Результат сохранён в ${OUTPUT_FILE}`);
}

main();
