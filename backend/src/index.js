import { Hono } from 'hono';
import { cors } from 'hono/cors';
import puppeteer from '@cloudflare/puppeteer';

const app = new Hono();
app.use('*', cors());

// ==========================================
// 🗄️ HELPER: QUẢN LÝ DATABASE (CLOUDFLARE KV)
// ==========================================
async function getDB(env) {
    const users = await env.HENDY_DB.get('users', { type: 'json' }) || {};
    const orders = await env.HENDY_DB.get('orders', { type: 'json' }) || {};
    return { users, orders };
}

async function saveDB(env, users, orders) {
    await env.HENDY_DB.put('users', JSON.stringify(users));
    await env.HENDY_DB.put('orders', JSON.stringify(orders));
}

// Hàm gửi tin nhắn Telegram (Thay thế node-telegram-bot-api)
async function sendTelegramMessage(token, chatId, text, keyboard = null) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = { chat_id: chatId, text: text, parse_mode: 'Markdown' };
    if (keyboard) payload.reply_markup = keyboard;
    
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

// ==========================================
// 🌐 REST API ENDPOINTS
// ==========================================
app.get('/health', (c) => c.json({ status: 'OK', system: 'Master Control Panel V6100 - Cloudflare Edge' }));

// API Puppeteer Crawl Data
app.post('/api/smm/run-puppeteer', async (c) => {
    const secret = c.req.header('x-internal-secret');
    if (secret !== c.env.INTERNAL_SECRET) return c.json({ error: 'Unauthorized' }, 403);

    const { targetUrl } = await c.req.json();
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
    try {
        const { content, transferAmount } = await c.req.json();
        if (content) {
            const match = content.match(/NAP\s+(\d+)/i);
            if (match) {
                const chatId = match[1];
                let { users, orders } = await getDB(c.env);
                
                if (users[chatId]) {
                    users[chatId].balance += Number(transferAmount || 0);
                    await saveDB(c.env, users, orders);
                    await sendTelegramMessage(c.env.BOT_TOKEN, chatId, `🎉 *NẠP TIỀN THÀNH CÔNG!*\n💰 Bạn vừa được cộng +${Number(transferAmount).toLocaleString()} VNĐ.`);
                }
            }
        }
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: e.message }, 500);
    }
});

// ==========================================
// 🤖 TELEGRAM BOT (WEBHOOK MODE)
// ==========================================
app.post('/webhook', async (c) => {
    const update = await c.req.json();
    const env = c.env;
    let { users, orders } = await getDB(env);

    // Xử lý Tin nhắn Text
    if (update.message && update.message.text) {
        const msg = update.message;
        const chatId = msg.chat.id.toString();
        const text = msg.text;
        const isAdmin = (chatId === env.ADMIN_ID);

        if (!users[chatId]) {
            users[chatId] = {
                id: chatId,
                name: msg.from.first_name || 'Khách',
                balance: 50000,
                orders: []
            };
            await saveDB(env, users, orders);
        }

        if (text === '/start' || text === '/cancel') {
            if (users[chatId].actionState) delete users[chatId].actionState;
            await saveDB(env, users, orders);

            const welcomeMessage = `🤖 *HỆ THỐNG DỊCH VỤ MXH PRO* 🚀\nChào mừng sếp, *${users[chatId].name}*\n💰 **Ví Chính:** \`${users[chatId].balance.toLocaleString()} VNĐ\``;
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🌐 DỊCH VỤ MẠNG XÃ HỘI', callback_data: 'smm_main' }],
                    [{ text: '💳 NẠP TIỀN', callback_data: 'deposit' }, { text: '📇 ĐƠN HÀNG', callback_data: 'customer_center' }],
                    ...(isAdmin ? [[{ text: '🛡️ ADMIN (QUẢN LÝ)', callback_data: 'admin_center' }]] : [])
                ]
            };
            await sendTelegramMessage(env.BOT_TOKEN, chatId, welcomeMessage, keyboard);
            return c.text('OK');
        }

        // Xử lý luồng đặt hàng (nhập Link -> Số lượng)
        let u = users[chatId];
        if (u.actionState && u.actionState.step === 'WAITING_LINK') {
            u.actionState.link = text;
            u.actionState.step = 'WAITING_QUANTITY';
            await saveDB(env, users, orders);
            await sendTelegramMessage(env.BOT_TOKEN, chatId, `🔗 Đã nhận Link.\n👉 *Nhập số lượng:* (Gõ /cancel để hủy)`);
            return c.text('OK');
        }

        if (u.actionState && u.actionState.step === 'WAITING_QUANTITY') {
            const quantity = parseInt(text);
            if (isNaN(quantity) || quantity <= 0) {
                await sendTelegramMessage(env.BOT_TOKEN, chatId, '❌ Số lượng không hợp lệ.');
                return c.text('OK');
            }

            const totalCost = quantity * u.actionState.price;
            if (u.balance < totalCost) {
                await sendTelegramMessage(env.BOT_TOKEN, chatId, `❌ Không đủ tiền! Yêu cầu: ${totalCost} VNĐ`);
                delete u.actionState;
                await saveDB(env, users, orders);
                return c.text('OK');
            }

            // Trừ tiền và tạo đơn
            u.balance -= totalCost;
            const newOrderId = 'ORD' + Math.floor(Math.random() * 90000 + 10000);
            const newOrder = {
                id: newOrderId,
                service: u.actionState.serviceName,
                link: u.actionState.link,
                quantity: quantity,
                totalCost: totalCost,
                status: 'Đang chờ'
            };
            
            u.orders.push(newOrder);
            orders[newOrderId] = newOrder;
            delete u.actionState;
            await saveDB(env, users, orders);

            await sendTelegramMessage(env.BOT_TOKEN, chatId, `✅ *TẠO ĐƠN THÀNH CÔNG!*\n🏷️ Mã: ${newOrderId}\n💸 Trừ: ${totalCost} VNĐ\n💰 Còn: ${u.balance} VNĐ`);
        }
    }

    // Xử lý Nút bấm (Callback Query)
    if (update.callback_query) {
        const query = update.callback_query;
        const chatId = query.from.id.toString();
        const data = query.data;

        if (data === 'smm_main') {
            // Rút gọn danh sách cho ví dụ, bạn có thể copy toàn bộ mảng SMM_SERVICES vào đây
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📘 FACEBOOK', callback_data: 'smm_cat_facebook' }],
                    [{ text: '🎵 TIKTOK', callback_data: 'smm_cat_tiktok' }],
                    [{ text: '◀ Quay lại', callback_data: 'back_start' }]
                ]
            };
            await sendTelegramMessage(env.BOT_TOKEN, chatId, "🌐 *CHỌN DỊCH VỤ*", keyboard);
        }
        else if (data === 'smm_cat_facebook') {
            users[chatId].actionState = { step: 'WAITING_LINK', serviceName: 'Tăng Like FB', price: 100 };
            await saveDB(env, users, orders);
            await sendTelegramMessage(env.BOT_TOKEN, chatId, "📌 Bạn chọn Tăng Like FB (100đ/lượt)\n👉 *Vui lòng dán Link mục tiêu:*");
        }
        else if (data === 'deposit') {
            const depositMsg = `💳 *NẠP TIỀN TỰ ĐỘNG (VIETQR)*\n🏛 NH: MB\n🔢 STK: 0123456789\n📝 Nội dung CK: \`NAP ${chatId}\``;
            await sendTelegramMessage(env.BOT_TOKEN, chatId, depositMsg);
        }
        else if (data === 'back_start') {
            await sendTelegramMessage(env.BOT_TOKEN, chatId, "Vui lòng gõ /start để quay lại.");
        }
    }

    return c.text('OK');
});

// ==========================================
// 🤖 AI ENGINE THÔNG QUA CRON TRIGGER
// ==========================================
// Thay vì setInterval, hàm này sẽ được gọi mỗi phút bởi Cloudflare Cron
export default {
    fetch: app.fetch,
    async scheduled(event, env, ctx) {
        let { users, orders } = await getDB(env);
        let updated = false;

        Object.values(orders).forEach(order => {
            if (order.status === 'Đang chờ' || order.status === '⏳ Đang xử lý') {
                // Giả lập logic xử lý đơn hàng của AI Engine
                order.status = '✅ Hoàn thành'; 
                updated = true;
                
                // Cập nhật trong user
                if (users[order.chatId]) {
                    const uOrder = users[order.chatId].orders.find(o => o.id === order.id);
                    if (uOrder) uOrder.status = '✅ Hoàn thành';
                }
            }
        });

        if (updated) {
            await saveDB(env, users, orders);
            console.log("Cron Job AI Engine đã chạy và xử lý đơn hàng.");
        }
    }
};
