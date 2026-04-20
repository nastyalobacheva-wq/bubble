import EventSource from "eventsource";
import fetch from "node-fetch";

const TOKEN_URL = "https://hub.lettofy.com/auth/token";
const SSE_URL = "https://hub.lettofy.com/events/pyrus/tasks/stream";
const BUBBLE_WEBHOOK = "https://comfortisland.bubbleapps.io/version-test/api/1.1/wf/sse_event";

const CLIENT_ID = "my-api-client-123";
const CLIENT_SECRET = "secret_abc123def456";

let accessToken = null;
let es = null;

// 🔑 Получение токена
async function getToken() {
  try {
    console.log("🔑 Запрашиваем новый токен...");

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      })
    });

    const data = await res.json();

    if (!data.access_token) {
      console.error("❌ Токен не получен:", data);
      return false;
    }

    accessToken = data.access_token;

    console.log("✅ Новый токен получен");
    return true;

  } catch (err) {
    console.error("❌ Ошибка получения токена:", err);
    return false;
  }
}

// 📡 Подключение к SSE
async function connectSSE() {
  if (!accessToken) {
    console.log("⏳ Нет токена, пробуем получить...");
    const ok = await getToken();
    if (!ok) return;
  }

  // закрываем старое соединение если есть
  if (es) {
    console.log("♻️ Закрываем старое SSE соединение");
    es.close();
    es = null;
  }

  console.log("🔌 Подключаемся к SSE...");

  es = new EventSource(SSE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  es.onopen = () => {
    console.log("🟢 SSE соединение открыто");
  };

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

    if (es) {
      es.close();
      es = null;
    }

    // пробуем обновить токен и переподключиться
    console.log("🔄 Пробуем восстановиться...");

    const ok = await getToken();

    setTimeout(() => {
      if (ok) {
        connectSSE();
      } else {
        console.log("⏳ Повторная попытка через 5 сек...");
        setTimeout(connectSSE, 5000);
      }
    }, 3000);
  };
}

// 🚀 Старт
async function start() {
  const ok = await getToken();

  if (!ok) {
    console.log("⏳ Не удалось получить токен при старте, пробуем ещё раз...");
    setTimeout(start, 5000);
    return;
  }

  await connectSSE();

  // 🔁 Плановое обновление токена (каждые 5 часов)
  setInterval(async () => {
    console.log("🔄 Плановое обновление токена + реконнект SSE");

    const ok = await getToken();

    if (ok) {
      connectSSE();
    }

  }, 5 * 60 * 60 * 1000);
}

start();
