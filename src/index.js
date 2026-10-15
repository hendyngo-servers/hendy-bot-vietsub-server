const BOT_TOKEN = "8574999116:AAF39jSNBiOx-RqIFF08oLxHXqyxsQ9mYqw";

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
    return new Response("Bot Vietsub Link đang hoạt động tốt trên Cloudflare!", { status: 200 });
  }
};

async function handleUpdate(update, env) {
  if (update.message) {
    await handleMessage(update.message, env);
  } 
  else if (update.channel_post) {
      await handleChannelPost(update.channel_post, env);
  }
  else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }
}

async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const textMsg = message.text || "";

  // Lệnh cập nhật link Colab nhanh
  if (textMsg.startsWith("/seturl ")) {
    const newUrl = textMsg.replace("/seturl ", "").trim();
    if (env && env.CONFIG_KV) {
      await env.CONFIG_KV.put("VIETSUB_API_URL", newUrl);
      await sendTelegramRequest('sendMessage', {
        chat_id: chatId,
        text: `✅ Đã tự động cập nhật link Colab thành công:\n${newUrl}`
      });
    } else {
      await sendTelegramRequest('sendMessage', {
        chat_id: chatId,
        text: `❌ Lỗi: Chưa cấu hình kho lưu trữ KV trên Cloudflare Workers!`
      });
    }
    return;
  }

  if (textMsg === "/start") {
    const text = "👋 Xin chào! Hãy gửi cho tôi **đường link video** (YouTube, TikTok, Facebook,...), tôi sẽ tự động tải, nhận diện ngôn ngữ và Vietsub cho bạn.\n\n*(Cập nhật link Colab mới bằng lệnh: /seturl <link>)*";
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

  // Bắt sự kiện người dùng gửi link (bắt đầu bằng http:// hoặc https://)
  if (textMsg.startsWith("http://") || textMsg.startsWith("https://")) {
      await processLinkRequest(textMsg, chatId, message.message_id, env);
  }
}

async function handleChannelPost(post, env) {
    const chatId = post.chat.id;
    const textMsg = post.text || post.caption || "";
    if (textMsg.startsWith("http://") || textMsg.startsWith("https://")) {
        await processLinkRequest(textMsg, chatId, post.message_id, env);
    }
}

async function processLinkRequest(videoUrl, chatId, messageId, env) {
    let apiUrl = "https://phonebook-ferocious-thesis.ngrok-free.dev/process";
    if (env && env.CONFIG_KV) {
      const savedUrl = await env.CONFIG_KV.get("VIETSUB_API_URL");
      if (savedUrl) {
        apiUrl = savedUrl;
      }
    }

    const processingMsg = await sendTelegramRequest('sendMessage', { 
      chat_id: chatId, 
      reply_to_message_id: messageId,
      text: "⏳ Đã nhận đường link! Đang chuyển dữ liệu tới máy chủ Colab..." 
    });
    const processingMsgId = (await processingMsg.json()).result.message_id;

    try {
        // Gửi đường link trực tiếp sang Google Colab (Bỏ qua giới hạn 20MB của Telegram)
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                video_url: videoUrl,
                chat_id: chatId,
                reply_to_message_id: messageId
            })
        });

        if (apiResponse.ok) {
            await sendTelegramRequest('editMessageText', {
                chat_id: chatId,
                message_id: processingMsgId,
                text: "✅ Đã gửi link thành công! Colab đang tải và xử lý video dung lượng lớn, hãy đợi kết quả."
            });
        } else {
             throw new Error(`Đường truyền tới Colab bị lỗi (Status: ${apiResponse.status}).`);
        }

    } catch (error) {
        console.error(error);
        await sendTelegramRequest('editMessageText', {
            chat_id: chatId,
            message_id: processingMsgId,
            text: "❌ Có lỗi kết nối đến máy chủ AI: " + error.message + "\n💡 Gợi ý: Kiểm tra lại lệnh `/seturl` xem link ngrok đã đúng chưa."
        });
    }
}

async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  let text = "";

  if (data === "help") {
    text = "Chỉ cần gửi link video (YouTube, TikTok,...) vào khung chat. Hệ thống sẽ tự tải và Vietsub cho bạn mà không giới hạn dung lượng file!";
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
