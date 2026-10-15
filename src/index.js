const BOT_TOKEN = "8574999116:AAF39jSNBiOx-RqIFF08oLxHXqyxsQ9mYqw";
const VIETSUB_API_URL = "https://car-locking-strategic-rich.trycloudflare.com/process"; 

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
    return new Response("Bot Vietsub đang hoạt động tốt trên Cloudflare!", { status: 200 });
  }
};

async function handleUpdate(update) {
  if (update.message) {
    await handleMessage(update.message);
  } 
  else if (update.channel_post) {
      await handleChannelPost(update.channel_post);
  }
  else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }
}

async function handleMessage(message) {
  const chatId = message.chat.id;

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

  if (message.video) {
      await processVideoRequest(message.video, chatId, message.message_id);
  }
}

async function handleChannelPost(post) {
    const chatId = post.chat.id;
    if (post.video) {
        await processVideoRequest(post.video, chatId, post.message_id);
    }
}

async function processVideoRequest(videoObj, chatId, messageId) {
    const fileId = videoObj.file_id;
    const fileSize = videoObj.file_size;

    // Telegram giới hạn tải file qua API thông thường tối đa là 20MB
    if (fileSize > 20 * 1024 * 1024) {
        await sendTelegramRequest('sendMessage', {
            chat_id: chatId,
            reply_to_message_id: messageId,
            text: "❌ Lỗi: Video quá lớn. Bot hiện tại chỉ hỗ trợ video dưới 20MB."
        });
        return;
    }

    const processingMsg = await sendTelegramRequest('sendMessage', { 
      chat_id: chatId, 
      reply_to_message_id: messageId,
      text: "⏳ Đang kết nối với máy chủ AI Colab..." 
    });
    const processingMsgId = (await processingMsg.json()).result.message_id;

    try {
        const fileData = await sendTelegramRequest('getFile', { file_id: fileId });
        const fileJson = await fileData.json();
        
        if (!fileJson.ok) throw new Error("Không thể lấy file từ Telegram.");

        const filePath = fileJson.result.file_path;
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

        // Gửi URL video sang máy chủ AI Google Colab
        const apiResponse = await fetch(VIETSUB_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                video_url: fileUrl,
                chat_id: chatId,
                reply_to_message_id: messageId
            })
        });

        if (apiResponse.ok) {
            await sendTelegramRequest('editMessageText', {
                chat_id: chatId,
                message_id: processingMsgId,
                text: "✅ Đã truyền dữ liệu thành công! Colab đang tiến hành dịch thuật, video thành phẩm sẽ được gửi lại đây khi hoàn tất."
            });
        } else {
             throw new Error(`Đường truyền tới Colab bị lỗi (Status: ${apiResponse.status}).`);
        }

    } catch (error) {
        console.error(error);
        await sendTelegramRequest('editMessageText', {
            chat_id: chatId,
            message_id: processingMsgId,
            text: "❌ Có lỗi kết nối đến máy chủ AI: " + error.message
        });
    }
}

async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  let text = "";

  if (data === "help") {
    text = "Bạn chỉ cần gửi hoặc forward (chuyển tiếp) 1 video vào khung chat này. Hệ thống sẽ kết nối với Colab để tự động làm phần còn lại.";
  } else if (data === "settings") {
    text = "Tính năng tùy chỉnh đang được phát triển.";
  }

  await sendTelegramRequest('answerCallbackQuery', { 
      callback_query_id: callbackQuery.id 
  });
  
  await sendTelegramRequest('sendMessage', { 
      chat_id: chatId, 
      text: text 
  });
}

async function sendTelegramRequest(method, payload) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
