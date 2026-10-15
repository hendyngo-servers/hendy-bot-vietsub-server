// Lắng nghe các sự kiện gửi đến Worker (được gọi là fetch event)
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // 1. Chỉ chấp nhận phương thức POST (vì Webhook của Telegram gửi data qua POST)
  if (request.method !== 'POST') {
    // Nếu ai đó truy cập bằng trình duyệt (GET), trả về một thông báo đơn giản
    return new Response('Hello! This is a Telegram Bot webhook endpoint.', { status: 200 })
  }

  try {
    // 2. Lấy dữ liệu dạng JSON do Telegram gửi tới
    const data = await request.json()
    
    // 3. Gọi hàm xử lý tin nhắn
    await handleMessage(data)

    // 4. Luôn phải trả về status 200 OK để Telegram biết Worker đã nhận được tin nhắn
    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Lỗi khi xử lý request:', error)
    // Trả về 200 ngay cả khi có lỗi để tránh Telegram gửi lại tin nhắn liên tục
    return new Response('OK', { status: 200 }) 
  }
}

async function handleMessage(data) {
  // Kiểm tra xem dữ liệu có chứa tin nhắn văn bản hợp lệ không
  if (!data.message || !data.message.text) {
    return
  }

  const chatId = data.message.chat.id // ID của người dùng hoặc nhóm chat
  const text = data.message.text     // Nội dung tin nhắn người dùng gửi
  
  // Xử lý các lệnh cơ bản
  if (text === '/start') {
    await sendMessage(chatId, 'Xin chào! Tôi là bot Telegram chạy trên Cloudflare Workers. Hãy gửi tin nhắn cho tôi nhé.')
    return
  }

  // Chức năng mặc định: Nhại lại tin nhắn (Echo)
  const replyText = `Bạn vừa nói: "${text}"`
  await sendMessage(chatId, replyText)
}

// Hàm gửi tin nhắn qua Telegram API
async function sendMessage(chatId, text) {
  // ENV_BOT_TOKEN là biến môi trường bạn đã cài đặt trên Cloudflare Dashboard
  // Môi trường Worker tự động cung cấp biến này nếu bạn cấu hình đúng tên
  const token = ENV_BOT_TOKEN 
  const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`

  const payload = {
    chat_id: chatId,
    text: text
  }

  await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
}
