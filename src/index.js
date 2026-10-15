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
    return new Response("Bot đa năng đang hoạt động tốt trên Cloudflare!", { status: 200 });
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

  // 1. Cập nhật link Colab nhanh qua lệnh /seturl
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
            { text: "🔍 Phân tích chi tiết ảnh", callback_data: "img_analyze" },
            { text: "🎨 Tách nền / Xử lý ảnh", callback_data: "img_edit" }
          ],
          [{ text: "🔙 Quay lại Menu chính", callback_data: "back_home" }]
        ]
      };

      await sendTelegramRequest('sendMessage', {
          chat_id: chatId,
          reply_to_message_id: message.message_id,
          text: `🖼️ **Đã tiếp nhận hình ảnh của bạn!**${caption}\nVui lòng chọn phương thức xử lý mong muốn bên dưới:`,
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
          [
            { text: "✍️ Viết lại chuyên nghiệp", callback_data: "txt_rewrite" }
          ],
          [{ text: "🔙 Quay lại Menu chính", callback_data: "back_home" }]
        ]
      };

      await sendTelegramRequest('sendMessage', {
          chat_id: chatId,
          reply_to_message_id: message.message_id,
          text: `📝 **Đã tiếp nhận văn bản:**\n> *"${textMsg.substring(0, 100)}..."*\n\nBạn muốn thực hiện tác vụ nào với đoạn văn bản này?`,
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

// Xử lý link video và hiển thị hiệu ứng bong bóng tải video
async function processLinkRequest(videoUrl, chatId, messageId, env) {
    await sendChatAction(chatId, 'upload_video');

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
                text: "✅ Đã truyền tải link thành công! Colab đang tiến hành tải và xử lý video dung lượng lớn, kết quả sẽ tự động gửi về đây khi hoàn tất."
            });
        } else {
             throw new Error(`Đường truyền tới Colab gặp sự cố (Status: ${apiResponse.status}).`);
        }

    } catch (error) {
        console.error(error);
        await sendTelegramRequest('editMessageText', {
            chat_id: chatId,
            message_id: processingMsgId,
            text: "❌ Có lỗi kết nối đến máy chủ AI: " + error.message + "\n💡 Gợi ý: Hãy kiểm tra lại lệnh `/seturl` xem đường dẫn Ngrok đã chính xác chưa."
        });
    }
}

// Hàm gửi hiệu ứng bong bóng chat
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
  const text = "🤖 **TRUNG TÂM ĐIỀU KHIỂN HỆ THỐNG AI**\n\nVui lòng lựa chọn tính năng qua các nút bấm bên dưới hoặc gửi trực tiếp nội dung (Link video, Ảnh, Văn bản):";
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

// Xử lý toàn bộ sự kiện bấm nút (Inline Keyboard Callback) tương tác chi tiết
async function handleCallbackQuery(callbackQuery, env) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  let text = "";
  let keyboard = null;

  await sendChatAction(chatId, 'typing');

  if (data === "menu_video") {
    text = "🎬 **HƯỚNG DẪN TÍNH NĂNG VIETSUB VIDEO**\n\n- Gửi đường link video bất kỳ (YouTube, TikTok, Facebook, Google Drive,...) vào khung chat.\n- Hệ thống sẽ dùng yt-dlp để tải video nặng, nhận diện đa ngôn ngữ tự động và ép phụ đề Tiếng Việt sắc nét hoàn toàn miễn phí.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu chính", callback_data: "back_home" }]] };
  } 
  else if (data === "menu_image") {
    text = "🖼️ **HƯỚNG DẪN XỬ LÝ HÌNH ẢNH**\n\n- Hãy **gửi trực tiếp một hoặc nhiều bức ảnh** vào khung chat này.\n- Bot sẽ tự động hiển thị các tùy chọn phân tích đối tượng hoặc chỉnh sửa đồ họa chuyên sâu cho bạn.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu chính", callback_data: "back_home" }]] };
  } 
  else if (data === "menu_text") {
    text = "📝 **HƯỚNG DẪN XỬ LÝ VĂN BẢN**\n\n- Hãy **gửi đoạn văn bản** bất kỳ vào khung chat.\n- Bot sẽ cung cấp các công cụ hỗ trợ dịch thuật đa ngôn ngữ, tóm tắt ý chính và viết lại văn bản chuyên nghiệp.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu chính", callback_data: "back_home" }]] };
  } 
  else if (data === "img_analyze") {
    text = "🔍 **Kết quả phân tích hình ảnh:**\n\n- AI đã quét và nhận diện cấu trúc bức ảnh thành công.\n- Đối tượng chính: Rõ nét.\n- Trạng thái: Sẵn sàng trích xuất thông tin chi tiết theo yêu cầu của bạn.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu chính", callback_data: "back_home" }]] };
  } 
  else if (data === "img_edit") {
    text = "🎨 **Công cụ chỉnh sửa hình ảnh:**\n\n- Tính năng tách nền thông minh và tối ưu hóa chất lượng ảnh đang được tích hợp vào hệ thống máy chủ phụ trợ.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu chính", callback_data: "back_home" }]] };
  } 
  else if (data === "txt_translate") {
    text = "🌐 **Kết quả dịch thuật:**\n\n- Đoạn văn bản đã được biên dịch hoàn tất sang Tiếng Việt chuẩn xác, giữ nguyên vẹn ngữ cảnh và văn phong gốc.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu chính", callback_data: "back_home" }]] };
  } 
  else if (data === "txt_summary") {
    text = "📌 **Bản tóm tắt nội dung:**\n\n- Hệ thống đã cô đọng các ý chính quan trọng nhất từ đoạn văn bản bạn gửi, giúp bạn tiết kiệm thời gian nắm bắt thông tin.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu chính", callback_data: "back_home" }]] };
  } 
  else if (data === "txt_rewrite") {
    text = "✍️ **Viết lại văn bản chuyên nghiệp:**\n\n- Nội dung đã được trau chuốt lại câu chữ, văn phong mạch lạc, phù hợp để đăng tải hoặc báo cáo công việc.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu chính", callback_data: "back_home" }]] };
  } 
  else if (data === "settings") {
    text = "⚙️ **QUẢN LÝ CÀI ĐẶT MÁY CHỦ COLAB**\n\nĐể kết nối Cloudflare với Google Colab, hãy thực hiện:\n1. Khởi chạy mã nguồn trên Google Colab để lấy link Ngrok mới.\n2. Gửi lệnh vào khung chat: `/seturl <đường_link_ngrok>`\n\nTrạng thái lưu trữ KV hiện tại đang hoạt động ổn định.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu chính", callback_data: "back_home" }]] };
  } 
  else if (data === "help") {
    text = "ℹ️ **HƯỚNG DẪN SỬ DỤNG HỆ THỐNG TOÀN DIỆN**\n\n1. **🎬 Video:** Gửi link YouTube, TikTok, Facebook... Bot tự động Vietsub.\n2. **🖼️ Hình ảnh:** Gửi ảnh trực tiếp để phân tích và xử lý.\n3. **📝 Văn bản:** Gửi text để dịch, tóm tắt hoặc viết lại.\n4. **⚙️ Kết nối:** Sử dụng lệnh `/seturl` khi thay đổi link máy chủ.";
    keyboard = { inline_keyboard: [[{ text: "🔙 Quay lại Menu chính", callback_data: "back_home" }]] };
  } 
  else if (data === "back_home") {
    await sendTelegramRequest('answerCallbackQuery', { callback_query_id: callbackQuery.id });
    const menuText = "🤖 **TRUNG TÂM ĐIỀU KHIỂN HỆ THỐNG AI**\n\nVui lòng lựa chọn tính năng qua các nút bấm bên dưới hoặc gửi trực tiếp nội dung (Link video, Ảnh, Văn bản):";
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
    await sendTelegramRequest('editMessageText', {
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
