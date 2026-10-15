// Gắn sẵn Token Bot của bạn
const BOT_TOKEN = "8574999116:AAF39jSNBiOx-RqIFF08oLxHXqyxsQ9mYqw";

export default {
  async fetch(request) {
    if (request.method === "POST") {
      try {
        const update = await request.json();
        await handleUpdate(update);
      } catch (error) {
        console.error("Error handling update:", error);
      }
      return new Response("OK", { status: 200 });
    }
    // Dòng này hiển thị khi bạn truy cập trực tiếp link Worker trên trình duyệt
    return new Response("Bot Telegram đang hoạt động tốt trên Cloudflare Workers!", { status: 200 });
  }
};

async function handleUpdate(update) {
  if (update.message) {
    await handleMessage(update.message);
  } else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id;

  // 1. Xử lý lệnh /start và hiển thị nút bấm (Inline Keyboard)
  if (message.text === "/start") {
    const text = "👋 Xin chào! Hãy gửi cho tôi một video ngắn, tôi sẽ làm Vietsub cho bạn.";
    const keyboard = {
      inline_keyboard: [
        [
            { text: "ℹ️ Hướng dẫn", callback_data: "help" }, 
            { text: "🌐 Website", url: "https://github.com" }
        ],
        [
            { text: "⚙️ Cài đặt dịch thuật", callback_data: "settings" }
        ]
      ]
    };
    await sendTelegramRequest('sendMessage', { 
        chat_id: chatId, 
        text: text, 
        reply_markup: keyboard 
    });
    return;
  }

  // 2. Xử lý khi người dùng gửi file video
  if (message.video) {
    const fileId = message.video.file_id;
    
    // Phản hồi ngay lập tức để người dùng biết bot đã nhận được video
    await sendTelegramRequest('sendMessage', { 
      chat_id: chatId, 
      text: "⏳ Bot đã nhận được video. Đang tiến hành trích xuất âm thanh và Vietsub. Vui lòng chờ..." 
    });

    /* 
      LƯU Ý: Cloudflare Workers không có FFmpeg để xử lý video trực tiếp.
      Ở hệ thống thực tế, bạn sẽ lấy link file từ fileId, gửi sang một VPS khác để xử lý.
      Dưới đây là mô phỏng quá trình đó mất 3 giây.
    */
    setTimeout(async () => {
        await sendTelegramRequest('sendMessage', { 
            chat_id: chatId, 
            text: "✅ (Mô phỏng) Đã dịch xong! Do đây là môi trường Cloudflare (không có card đồ họa), quá trình render sub cần kết nối với VPS phụ.\n\nFile ID của bạn là: " + fileId
        });
    }, 3000);
  }
}

async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  let text = "";

  // Xử lý logic khi bấm nút
  if (data === "help") {
    text = "Bạn chỉ cần gửi hoặc forward (chuyển tiếp) 1 video vào khung chat này. Hệ thống sẽ tự động làm phần còn lại.";
  } else if (data === "settings") {
    text = "Tính năng tùy chỉnh phông chữ và màu sắc Vietsub đang được phát triển.";
  }

  // Phản hồi cho Telegram biết đã nhận click (nếu không nút bấm sẽ hiện trạng thái loading mờ)
  await sendTelegramRequest('answerCallbackQuery', { 
      callback_query_id: callbackQuery.id 
  });
  
  // Gửi tin nhắn chứa nội dung tương ứng với nút
  await sendTelegramRequest('sendMessage', { 
      chat_id: chatId, 
      text: text 
  });
}

// Hàm gửi request giao tiếp với API của Telegram
async function sendTelegramRequest(method, payload) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
