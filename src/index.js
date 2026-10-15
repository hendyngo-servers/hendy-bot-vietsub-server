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
    return new Response("Bot Vietsub Server đang hoạt động tốt trên Cloudflare Workers!", { status: 200 });
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
      await handleCallbackQuery(update.callback_query, env);
  }
}

async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const textMsg = message.text || message.caption || "";

  // 1. Cập nhật link Colab nhanh qua lệnh /seturl <link>
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
        text: `❌ Lỗi: Chưa cấu hình kho lưu trữ KV (CONFIG_KV) trên Cloudflare Workers!`
      });
    }
    return;
  }

  // 2. Lệnh /start hiển thị Menu chính
  if (textMsg === "/start") {
    await sendChatAction(chatId, 'typing');
    await sendMainMenu(chatId);
    return;
  }

  // 3. Xử lý Video (Gửi Link)
  if (textMsg.startsWith("http://") || textMsg.startsWith("https://")) {
      await processLinkRequest(textMsg, chatId, message.message_id, env);
      return;
  }

  // 4. Xử lý Hình ảnh
  if (message.photo) {
      await sendChatAction(chatId, 'typing');
      const caption = message.caption ? `\n📝 Nội dung: "${message.caption}"` : "";
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔍 Phân tích ảnh", callback_data: "img_analyze" },
            { text: "🎨 Tách nền/Sửa ảnh", callback_data: "img_edit" }
          ],
          [{ text: "🔙 Quay lại Menu", callback_data: "back_home" }]
        ]
      };

      await sendTelegramRequest('sendMessage', {
          chat_id: chatId,
          reply_to_message_id: message.message_id,
          text: `🖼️ **Đã nhận hình ảnh của bạn!**${caption}\nVui lòng chọn tác vụ xử lý bên dưới:`,
          parse_mode: "Markdown",
          reply_markup: keyboard
      });
      return;
  }

  // 5. Xử lý Văn bản
  if (textMsg && !textMsg.startsWith("/")) {
      await sendChatAction(chatId, 'typing');
      const keyboard = {
        inline_keyboard: [
          [
            { text: "🌐 Dịch sang Tiếng Việt", callback_data: "txt_translate" },
            { text: "📌 Tóm tắt nội dung", callback_data: "txt_summary" }
          ],
          [{ text: "🔙 Quay lại Menu", callback_data: "back_home" }]
        ]
      };

      await sendTelegramRequest('sendMessage', {
          chat_id: chatId,
          reply_to_message_id: message.message_id,
          text: `📝 **Đã nhận văn bản:**\n> *"${textMsg.substring(0, 100)}..."*\n\nBạn muốn thực hiện thao tác gì với đoạn văn bản này?`,
          parse_mode: "Markdown",
          reply_markup: keyboard
      });
      return;
  }
}

async function handleChannelPost(post, env) {
    const chatId = post.chat.id;
    const textMsg = post.text || post.caption || "";
    if (textMsg.startsWith("http://") || textMsg.startsWith("https://")) {
        await processLinkRequest(textMsg, chatId, post.message_id, env);
    }
}

// Xử lý link video gửi sang Google Colab
async function processLinkRequest(videoUrl, chatId, messageId, env) {
    await sendChatAction(chatId, 'upload_video');

    // Link mặc định hoặc lấy từ Cloudflare KV
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
      text: "⏳ Đã nhận đường link video! Đang chuyển dữ liệu tới máy chủ AI Colab..." 
    });
    const processingMsgId = (await processingMsg.json()).result.message_id;

    try {
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
                text: "✅ Đã gửi link thành công! Colab đang tải và xử lý video dung lượng lớn, hãy đợi kết quả gửi về."
            });
        } else {
             throw new Error(`Đường truyền tới Colab bị lỗi (Status: ${apiResponse.status}).`);
        }

    } catch (error) {
        console.error(error);
        await sendTelegramRequest('editMessageText', {
            chat_id: chatId,
            message_id: processingMsgId,
            text: "❌ Có lỗi kết nối đến máy chủ AI: " + error.message + "\n💡 Gợi ý: Hãy kiểm tra lại lệnh `/seturl` xem link ngrok/cloudflare tunnel đã đúng chưa."
        });
    }
}

// Gửi hiệu ứng bong bóng trạng thái chat
async function sendChatAction(chatId, action) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendChatAction`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: action })
  });
}

// Hiển thị Menu chính
async function sendMainMenu(chatId) {
  const text = "🤖 **TRUNG TÂM ĐIỀU KHIỂN HỆ THỐNG AI**\n\nVui lòng gửi nội dung tương ứng hoặc chọn tính năng qua các nút bấm bên dưới:";
  const keyboard = {
    inline_keyboard: [
      [
        { text: "🎬 Vietsub Video (Link)", callback_data: "menu_video" },
        { text: "🖼️ Xử lý Hình ảnh", callback_data: "menu_image" }
      ],
      [
        { text: "📝 Xử lý Văn bản", callback_data: "menu_text" },
        { text: "⚙️ Cài đặt Colab", callback_data: "settings" }
      ],
      [
        { text: "ℹ️ Hướng dẫn sử dụng", callback_data: "help" }
      ]
    ]
  };
  await sendTelegramRequest('sendMessage', { 
      chat_id: chatId, 
      text: text, 
      parse_mode: "Markdown",
      reply_markup: keyboard 
  });
}

// Xử lý sự kiện bấm nút tương tác (Inline Keyboard)
async function handleCallbackQuery(callbackQuery, env) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  let text = "";
  let keyboard = null;

  await sendChatAction(chatId, 'typing');

  if (data === "menu_video") {
    text = "🎬 **TÍNH NĂNG VIETSUB VIDEO**\n\n- Gửi đường link video bất kỳ (YouTube, TikTok, Facebook,...) vào khung chat.\n- Hệ thống sẽ tự động tải, nhận diện đa ngôn ngữ và ép phụ đề Tiếng Việt sắc nét.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu", callback_data: "back_home" }]] };
  } else if (data === "menu_image") {
    text = "🖼️ **TÍNH NĂNG XỬ LÝ HÌNH ẢNH**\n\n- Hãy **gửi trực tiếp một bức ảnh** vào khung chat này để bắt đầu phân tích hoặc chỉnh sửa.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu", callback_data: "back_home" }]] };
  } else if (data === "menu_text") {
    text = "📝 **TÍNH NĂNG XỬ LÝ VĂN BẢN**\n\n- Hãy **gửi đoạn văn bản** bất kỳ vào khung chat để bot hỗ trợ dịch thuật hoặc tóm tắt nhanh.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu", callback_data: "back_home" }]] };
  } else if (data === "img_analyze") {
    text = "🔍 **Phân tích hình ảnh:**\nTính năng nhận diện chi tiết đối tượng trong ảnh đang được kích hoạt trên máy chủ AI.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu", callback_data: "back_home" }]] };
  } else if (data === "img_edit") {
    text = "🎨 **Chỉnh sửa hình ảnh:**\nCông cụ xử lý đồ họa đang chuẩn bị dữ liệu.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu", callback_data: "back_home" }]] };
  } else if (data === "txt_translate") {
    text = "🌐 **Đã dịch văn bản:**\n(Mô phỏng) Đoạn văn bản của bạn đã được biên dịch sang Tiếng Việt hoàn tất.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu", callback_data: "back_home" }]] };
  } else if (data === "txt_summary") {
    text = "📌 **Tóm tắt nội dung:**\n(Mô phỏng) Nội dung chính của đoạn văn bản đã được cô đọng súc tích.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu", callback_data: "back_home" }]] };
  } else if (data === "settings") {
    text = "⚙️ **CÀI ĐẶT MÁY CHỦ COLAB**\n\nĐể đồng bộ Cloudflare với Google Colab, hãy dùng lệnh:\n`/seturl <đường_link_ngrok>`";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu", callback_data: "back_home" }]] };
  } else if (data === "help") {
    text = "ℹ️ **HƯỚNG DẪN SỬ DỤNG CHI TIẾT**\n\n1. **Video:** Gửi link YouTube/TikTok để Vietsub tự động.\n2. **Hình ảnh:** Gửi ảnh để phân tích.\n3. **Văn bản:** Gửi text để dịch hoặc tóm tắt.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu", callback_data: "back_home" }]] };
  } else if (data === "back_home") {
    await sendTelegramRequest('answerCallbackQuery', { callback_query_id: callbackQuery.id });
    const menuText = "🤖 **TRUNG TÂM ĐIỀU KHIỂN HỆ THỐNG AI**\n\nVui lòng gửi nội dung tương ứng hoặc chọn tính năng qua các nút bấm bên dưới:";
    const menuKeyboard = {
      inline_keyboard: [
        [
          { text: "🎬 Vietsub Video (Link)", callback_data: "menu_video" },
          { text: "🖼️ Xử lý Hình ảnh", callback_data: "menu_image" }
        ],
        [
          { text: "📝 Xử lý Văn bản", callback_data: "menu_text" },
          { text: "⚙️ Cài đặt Colab", callback_data: "settings" }
        ],
        [
          { text: "ℹ️ Hướng dẫn sử dụng", callback_data: "help" }
        ]
      ]
    };
    await sendTelegramRequest('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: menuText,
      parse_mode: "Markdown",
      reply_markup: menuKeyboard
    });
    return;
  }

  await sendTelegramRequest('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  
  if (text) {
    await sendTelegramRequest('editMessageTest', {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
  }
}

async function sendTelegramRequest(method, payload) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
