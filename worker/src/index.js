import { Hono } from 'hono'
import { cors } from 'hono/cors'
import puppeteer from '@cloudflare/puppeteer'

const app = new Hono()
app.use('/*', cors())

// ==========================================
// 🗄️ QUẢN LÝ DATABASE (DÙNG CLOUDFLARE KV)
// ==========================================
async function getDB(env) {
    const data = await env.DB.get('database', { type: 'json' })
    return data || { users: {}, orders: {}, adminSession: {} }
}

async function saveDB(env, data) {
    await env.DB.put('database', JSON.stringify(data))
}

// ==========================================
// 🌐 REST API ENDPOINTS
// ==========================================
app.get('/health', (c) => {
    return c.json({ status: 'OK', system: 'Master Control Panel V6100 - Serverless' })
})

// Chạy Puppeteer (Cloudflare Browser Rendering)
app.post('/api/smm/run-puppeteer', async (c) => {
    const secret = c.req.header('X-Internal-Secret')
    if (secret !== c.env.INTERNAL_SECRET) {
        return c.json({ error: 'Unauthorized' }, 403)
    }

    const { targetUrl } = await c.req.json()
    if (!targetUrl) return c.json({ success: false, error: 'Target URL is required' }, 400)

    try {
        const browser = await puppeteer.launch(c.env.MYBROWSER)
        const page = await browser.newPage()
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
        
        const title = await page.title()
        
        await browser.close()
        return c.json({ success: true, data: { title, url: targetUrl } })
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500)
    }
})

// Webhook nhận tiền VietQR
app.post('/api/vietqr-webhook', async (c) => {
    const body = await c.req.json()
    const { content, transferAmount } = body
    
    if (content) {
        const match = content.match(/NAP\s+(\d+)/i)
        if (match) {
            const chatId = match[1]
            const db = await getDB(c.env)
            
            if (db.users[chatId]) {
                db.users[chatId].balance += Number(transferAmount || 0)
                await saveDB(c.env, db)
                
                // Bắn tin nhắn qua Telegram API (Thay vì dùng node-telegram-bot-api)
                await sendTelegramMessage(c.env.BOT_TOKEN, chatId, `🎉 *NẠP TIỀN THÀNH CÔNG!*\n💰 Bạn vừa được cộng +${Number(transferAmount).toLocaleString()} VNĐ.`)
            }
        }
    }
    return c.json({ success: true })
})

// ==========================================
// 🤖 TELEGRAM WEBHOOK (THAY THẾ LONG POLLING)
// ==========================================
// Phải gọi API này 1 lần duy nhất từ trình duyệt để setup:
// https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL_WORKER_CỦA_BẠN>/webhook/telegram

app.post('/webhook/telegram', async (c) => {
    const update = await c.req.json()
    const db = await getDB(c.env)
    const BOT_TOKEN = c.env.BOT_TOKEN

    // XỬ LÝ MESSAGE BÌNH THƯỜNG
    if (update.message && update.message.text) {
        const chatId = update.message.chat.id.toString()
        const text = update.message.text
        
        // Khởi tạo user nếu chưa có
        if (!db.users[chatId]) {
            db.users[chatId] = {
                id: chatId,
                name: update.message.from.first_name || 'Khách',
                balance: 50000,
                orders: []
            }
            await saveDB(c.env, db)
        }

        if (text === '/start') {
            const menu = `🤖 *HỆ THỐNG DỊCH VỤ MXH PRO* 🚀\nChào mừng sếp...`
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🌐 DỊCH VỤ MẠNG XÃ HỘI', callback_data: 'smm_main' }],
                    [{ text: '💳 NẠP TIỀN', callback_data: 'deposit' }]
                ]
            }
            // Gửi tin nhắn bất đồng bộ bằng API của Telegram
            c.executionCtx.waitUntil(sendTelegramMessage(BOT_TOKEN, chatId, menu, keyboard))
        }
        
        // TODO: Chèn logic nhận số lượng/link giống code cũ của bạn vào đây
    }
    
    // XỬ LÝ NÚT BẤM (CALLBACK QUERY)
    if (update.callback_query) {
        const chatId = update.callback_query.from.id.toString()
        const data = update.callback_query.data
        
        if (data === 'smm_main') {
             const text = `🌐 *DANH MỤC DỊCH VỤ MXH*`
             // Gửi tin nhắn
             c.executionCtx.waitUntil(sendTelegramMessage(BOT_TOKEN, chatId, text))
        }
    }

    return c.json({ ok: true })
})

// Hàm Helper để gọi Telegram API
async function sendTelegramMessage(token, chatId, text, replyMarkup = null) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`
    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
    }
    if (replyMarkup) payload.reply_markup = replyMarkup

    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
}

export default app
