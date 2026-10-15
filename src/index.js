export default {
  async fetch(request, env) {
    if (request.method === "POST") {
      try {
        const update = await request.json();
        await handleUpdate(update, env);
      } catch (error) {
        console.error("Error handling update:", error);
      }
      return new Response("OK", { status: 200 });
    }
    return new Response("Bot server is running on Cloudflare Workers.", { status: 200 });
  }
};

async function handleUpdate(update, env) {
  if (update.message) {
    await handleMessage(update.message, env);
  } else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, env);
  }
}

async function handleMessage(message, env) {
  const chatId = message.chat.id;

  // Xử lý lệnh /start và tạo nút bấm
  if (message.text === "/start") {
    const text = "Xin chào! Gửi cho tôi một video ngắn và tôi sẽ Vietsub nó cho bạn.";
    const keyboard = {
      inline_keyboard: [
        [{ text: "ℹ️ Hướng dẫn", callback_data: "help" }, { text: "🌐 Website", url: "https://yourwebsite.com" }],
        [{ text: "⚙️ Cài đặt dịch thuật", callback_data: "settings" }]
      ]
    };
    await sendTelegramRequest('sendMessage', { chat_id: chatId, text: text, reply_markup: keyboard }, env);
    return;
  }

  // Xử lý khi người dùng gửi video
  if (message.video) {
    const fileId = message.video.file_id;
    
    // Gửi tin nhắn thông báo đang xử lý
    await sendTelegramRequest('sendMessage', { 
      chat_id: chatId, 
      text: "⏳ Đang nhận video và tiến hành Vietsub. Quá trình này sẽ mất một lúc..." 
    }, env);

    /* 
      TODO: THUẬT TOÁN VIETSUB THỰC TẾ
      1. Gọi getFile của Telegram API để lấy đường dẫn file video.
      2. Gửi URL video đó sang backend VPS của bạn (chạy Python/FFmpeg/Whisper).
      3. Backend xử lý xong sẽ gọi lại Telegram API (sendVideo) để trả cho user.
      Ở đây, bot đang chạy trên Cloudflare nên chỉ điều phối API.
    */
    
    // Giả lập sau khi gọi API phụ thành công (Bạn cần thay thế bằng webhook từ backend xử lý video thực tế)
    setTimeout(async () => {
        await sendTelegramRequest('sendMessage', { 
            chat_id: chatId, 
            text: "✅ (Demo) Đã dịch xong! (Do giới hạn của Cloudflare, bạn cần cấu hình một server phụ chạy FFmpeg để đính kèm sub vào video này. File_ID: " + fileId + ")" 
        }, env);
    }, 3000);
  }
}

async function handleCallbackQuery(callbackQuery, env) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  let text = "";

  if (data === "help") {
    text = "Chỉ cần gửi hoặc forward video vào đây, hệ thống sẽ tự động trích xuất âm thanh, dịch sang Tiếng Việt và ghép sub vào video.";
  } else if (data === "settings") {
    text = "Tính năng cài đặt đang được phát triển.";
  }

  // Gửi thông báo popup ngắn (answerCallbackQuery)
  await sendTelegramRequest('answerCallbackQuery', { callback_query_id: callbackQuery.id }, env);
  
  // Gửi tin nhắn phản hồi
  await sendTelegramRequest('sendMessage', { chat_id: chatId, text: text }, env);
}

async function sendTelegramRequest(method, payload, env) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
