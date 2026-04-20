import EventSource from "eventsource";
import fetch from "node-fetch";

const TOKEN_URL = "https://hub.lettofy.com/auth/token";
const SSE_URL = "https://hub.lettofy.com/events/pyrus/tasks/stream";
const BUBBLE_WEBHOOK = "https://comfortisland.bubbleapps.io/version-test/api/1.1/wf/sse_event";

const CLIENT_ID = "my-api-client-123";
const CLIENT_SECRET = "secret_abc123def456";

let accessToken = null;

// 🔑 Получение токена
async function getToken() {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    })
  });

  const data = await res.json();
  accessToken = data.access_token;

  console.log("✅ Новый токен получен");
}

// 📡 Подключение к SSE
function connectSSE() {
  if (!accessToken) {
    console.log("⏳ Нет токена, ждём...");
    return;
  }

  console.log("🔌 Подключаемся к SSE...");

  const es = new EventSource(SSE_URL, {
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });

  es.onmessage = async (event) => {
    console.log("📥 SSE событие:", event.data);

    try {
      await fetch(BUBBLE_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          data: event.data
        })
      });

      console.log("📤 Отправлено в Bubble");
    } catch (err) {
      console.error("❌ Ошибка отправки в Bubble:", err);
    }
  };

  es.onerror = async (err) => {
    console.error("❌ SSE ошибка:", err);

    es.close();

    // возможно токен протух → обновляем
    await getToken();

    // переподключаемся
    setTimeout(connectSSE, 3000);
  };
}

// 🔁 Основной запуск
async function start() {
  await getToken();
  connectSSE();

  // обновляем токен каждые 50 минут
  setInterval(async () => {
    await getToken();
  }, 50 * 60 * 1000);
}

start();