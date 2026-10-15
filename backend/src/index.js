import { Hono } from 'hono';
import { cors } from 'hono/cors';
import puppeteer from '@cloudflare/puppeteer';

const app = new Hono();

app.use('*', cors());

// ==========================================
// 🗄️ HELPER: DATABASE BẰNG CLOUDFLARE KV
// ==========================================
async function getDB(env) {
    const users = await env.DB.get('users', { type: 'json' }) || {};
    const orders = await env.DB.get('orders', { type: 'json' }) || {};
    return { users, orders };
}

async function saveDB(env, users, orders) {
    await env.DB.put('users', JSON.stringify(users));
    await env.DB.put('orders', JSON.stringify(orders));
}

// ==========================================
// 🌐 REST API ENDPOINTS
// ==========================================
app.get('/health', (c) => c.json({ status: 'OK', system: 'Master Control Panel V6100 - Cloudflare Edge' }));

// API Puppeteer Crawl Data
app.post('/api/smm/run-puppeteer', async (c) => {
    const body = await c.req.json();
    const targetUrl = body.targetUrl;
    
    if (!targetUrl) return c.json({ success: false, error: 'Target URL required' }, 400);

    let browser;
    try {
        browser = await puppeteer.launch(c.env.MYBROWSER);
        const page = await browser.newPage();
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        
        const title = await page.title();
        await browser.close();
        
        return c.json({ success: true, data: { title, url: targetUrl, scrapedAt: new Date().toISOString() } });
    } catch (err) {
        if (browser) await browser.close();
        return c.json({ success: false, error: err.message }, 500);
    }
});

// API VietQR Webhook
app.post('/api/vietqr-webhook', async (c) => {
    const { content, transferAmount } = await c.req.json();
    if (content) {
        const match = content.match(/NAP\s+(\d+)/i);
        if (match) {
            const chatId = match[1];
            const { users, orders } = await getDB(c.env);
            
            if (users[chatId]) {
                users[chatId].balance += Number(transferAmount || 0);
                await saveDB(c.env, users, orders);
                
                // Gửi thông báo Telegram
                await sendTelegramMessage(c.env.BOT_TOKEN, chatId, `🎉 *NẠP TIỀN THÀNH CÔNG!*\n💰 Bạn vừa được cộng +${Number(transferAmount).toLocaleString()} VNĐ.`);
            }
        }
    }
    return c.json({ success: true });
});

// ==========================================
// 🤖 TELEGRAM BOT (WEBHOOK MODE)
// ==========================================
async function sendTelegramMessage(token, chatId, text, markup = null) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = { chat_id: chatId, text: text, parse_mode: 'Markdown' };
    if (markup) payload.reply_markup = markup;
    
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

// Endpoint để Telegram gọi vào khi có tin nhắn mới
app.post('/webhook', async (c) => {
    const update = await c.req.json();
    const env = c.env;
    const { users, orders } = await getDB(env);

    // Xử lý Message
    if (update.message) {
        const msg = update.message;
        const chatId = msg.chat.id.toString();
        const text = msg.text;

        // Khởi tạo User nếu chưa có
        if (!users[chatId]) {
            users[chatId] = {
                id: chatId,
                name: msg.from.first_name || 'Khách',
                balance: 50000,
                orders: []
            };
            await saveDB(env, users, orders);
        }

        if (text === '/start') {
            const isAdmin = (chatId === env.ADMIN_ID);
            const welcomeMessage = `🤖 *HỆ THỐNG DỊCH VỤ MXH PRO* 🚀\nChào mừng, *${users[chatId].name}*\n💰 Số dư: \`${users[chatId].balance} VNĐ\``;
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🌐 DỊCH VỤ MẠNG XÃ HỘI', callback_data: 'smm_main' }],
                    [{ text: '💳 NẠP TIỀN', callback_data: 'deposit' }]
                ]
            };
            
            await sendTelegramMessage(env.BOT_TOKEN, chatId, welcomeMessage, keyboard);
        }
        
        // Thêm logic xử lý order như code cũ ở đây...
        // ... (Vì giới hạn độ dài, bạn map logic Express cũ vào đây)
    }

    // Xử lý Callback Query (Nút bấm)
    if (update.callback_query) {
        const query = update.callback_query;
        const chatId = query.from.id.toString();
        const data = query.data;

        if (data === 'deposit') {
            const depositMsg = `💳 *CỔNG NẠP TIỀN TỰ ĐỘNG (VIETQR)*\nNội dung CK: \`NAP ${chatId}\``;
            await sendTelegramMessage(env.BOT_TOKEN, chatId, depositMsg);
        }
    }

    return c.text('OK'); // Phản hồi 200 cho Telegram
});

export default app;
