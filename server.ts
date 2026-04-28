import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Admin Supabase client (using service role key to bypass RLS for admin actions)
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const app = express();
export default app;

async function startServer() {
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/notify-order', async (req, res) => {
    const { order, userInfo, selectedVariant, orderId, telegramId } = req.body;
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const adminId = process.env.TELEGRAM_ADMIN_ID?.trim();

    // Check if keys are missing or using placeholder values from .env.example
    const isConfigured = token && adminId && 
                        token !== 'your-bot-token' && 
                        adminId !== 'your-telegram-user-id';

    if (!isConfigured) {
      console.error('Telegram config missing or using placeholders');
      return res.status(400).json({ 
        error: 'Telegram Bot is not configured. Please set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_ID in the Secrets panel.' 
      });
    }

    const myanmarTime = new Date().toLocaleString('en-US', { 
      timeZone: 'Asia/Yangon',
      dateStyle: 'medium',
      timeStyle: 'medium'
    });

    const escapeHtml = (text: string) => {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

    const displayOrderId = orderId ? (typeof orderId === 'string' ? orderId.split('-')[0].toUpperCase() : orderId) : 'N/A';

    // 1. Message for Admin (HTML Mode)
    const adminMessage = `
🌟 <b>New Order Received!</b>
-----------------
🆔 <b>Order ID:</b> <code>${displayOrderId}</code>
📦 <b>Product:</b> <code>${escapeHtml(order.title)}</code>
💰 <b>Amount:</b> <code>${selectedVariant.price} ${selectedVariant.currency || 'USD'}</code>
⏱️ <b>Plan:</b> <code>${escapeHtml(selectedVariant.label)}</code>
💳 <b>Status:</b> ⏳ <code>Pending</code>

👤 <b>Customer Details:</b>
- Name: <code>${escapeHtml(userInfo.name)}</code>
- Username: ${userInfo.username ? (userInfo.username.startsWith('@') ? escapeHtml(userInfo.username) : '@' + escapeHtml(userInfo.username)) : 'N/A'}
- TG ID: <code>${telegramId || 'N/A'}</code>

📅 <b>Time:</b> ${myanmarTime} MMT
    `;

    // 2. Message for Customer (HTML Mode)
    const customerMessage = `
✅ <b>Order Received!</b>
-----------------
Hello ${escapeHtml(userInfo.name)}, your order has been received and is being processed.

🆔 <b>Order ID:</b> <code>${displayOrderId}</code>
📦 <b>Product:</b> <code>${escapeHtml(order.title)}</code>
⏱️ <b>Plan:</b> <code>${escapeHtml(selectedVariant.label)}</code>
💰 <b>Price:</b> <code>${selectedVariant.price} ${selectedVariant.currency || 'USD'}</code>

📅 <b>Date:</b> ${myanmarTime}
💳 <b>Payment:</b> Please wait for an agent to contact you or use the support button in the app.

Thank you for choosing Us!
    `;

    try {
      console.log('Sending order notification to Telegram admin ID:', adminId, 'for Order ID:', orderId);
      // Notify Admin with Interactive Buttons
      // Ensure orderId is string and not empty
      const safeOrderId = orderId || 'unknown';
      
      if (safeOrderId === 'unknown') {
        console.warn('Warning: Notifying order with unknown ID. Confirm buttons will not work.');
      }

      const adminResponse = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: adminId,
        text: adminMessage,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Confirm Order', callback_data: `conf:${safeOrderId}` },
              { text: '❌ Decline', callback_data: `decl:${safeOrderId}` }
            ]
          ]
        }
      });
      console.log('Telegram Admin Notification Success:', adminResponse.data);

      // Reply to Customer (if telegramId is provided)
      if (telegramId) {
        try {
          const customerResponse = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: telegramId,
            text: customerMessage,
            parse_mode: 'HTML',
          });
          console.log('Telegram Customer Notification Success:', customerResponse.data);
        } catch (custError: any) {
          console.warn('Telegram Customer Notification Failed:', custError.response?.data || custError.message);
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      console.error('Telegram API Error (Admin Notify):', errorData);
      res.status(500).json({ error: 'Failed to send notification', details: errorData });
    }
  });

  // Unified API to update order status and notify customer
  app.post('/api/update-order-status', async (req, res) => {
    const { orderId, status } = req.body;
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    try {
      if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing in Secrets. The server cannot update the database securely.');
      }

      console.log(`Updating order ${orderId} to status: ${status}`);

      // 1. Get original order to get telegram_id and name
      const { data: order, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (fetchError || !order) {
        console.error('Fetch Order Error:', fetchError);
        throw new Error(fetchError?.message || 'Order not found in database.');
      }

      // 2. Update DB
      const { error: dbError } = await supabaseAdmin
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (dbError) throw dbError;

      // 3. Notify Customer if confirmed
      const userInfo = order.user_info || {};
      const telegramId = userInfo.telegram_id;

      if (status === 'completed' && telegramId) {
        const thankYouMessage = `
🎉 <b>Order Confirmed!</b>
-----------------
Hello <b>${userInfo.name || 'Customer'}</b>, your order has been successfully confirmed.

Thank you for buying! Have a great day! ✨
        `;

        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: telegramId,
          text: thankYouMessage,
          parse_mode: 'HTML'
        }).catch(e => console.warn('Could not send thank you to customer ID:', telegramId, e.response?.data || e.message));
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('Update Status Error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Telegram Webhook Handler for Inline Buttons & Messages
  app.post('/api/telegram-webhook', async (req, res) => {
    const { callback_query, message } = req.body;
    
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const adminId = process.env.TELEGRAM_ADMIN_ID?.trim();

    // 1. Handle incoming text messages (e.g. /start or /id)
    if (message && message.text) {
      const chatId = message.chat.id;
      const text = message.text.toLowerCase();

      if (text === '/id' || text === '/start') {
        const responseText = `👋 <b>Hello!</b>\n\nYour Telegram User ID is: <code>${chatId}</code>\n\n` + 
                            (String(chatId) === String(adminId) 
                              ? "✅ You are recognized as the <b>Admin</b>." 
                              : "ℹ️ You are <b>not</b> yet configured as Admin in the app's Secrets.");
        
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: chatId,
          text: responseText,
          parse_mode: 'HTML'
        }).catch(e => console.error('Error sending ID response:', e.message));
      }
      return res.sendStatus(200);
    }

    // 2. Handle callback queries (button clicks)
    if (!callback_query) {
      return res.sendStatus(200);
    }

    const { data, message: cbMessage, from } = callback_query;

    // Security check: Only allow the configured admin to click buttons
    if (!adminId || String(from.id) !== String(adminId)) {
      console.warn(`Unauthorized button click attempt from TG ID: ${from.id}. Admin ID expected: ${adminId}`);
      await axios.post(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        callback_query_id: callback_query.id,
        text: '⚠️ You are not authorized to perform this action. Your ID is: ' + from.id,
        show_alert: true
      });
      return res.sendStatus(200);
    }

    const [action, orderId] = data.split(':');
    if (!orderId || orderId === 'unknown') {
      await axios.post(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        callback_query_id: callback_query.id,
        text: '❌ Invalid Order ID.',
        show_alert: true
      });
      return res.sendStatus(200);
    }

    const newStatus = action === 'conf' ? 'completed' : 'cancelled';
    const statusText = action === 'conf' ? '✅ COMPLETED' : '❌ DECLINED';

    try {
      // 0. Security check for Service Role Key
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
      if (!serviceRoleKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
        await axios.post(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          callback_query_id: callback_query.id,
          text: '❌ Setup Error: SUPABASE_SERVICE_ROLE_KEY is missing in AI Studio Secrets.',
          show_alert: true
        });
        return res.sendStatus(200);
      }

      console.log(`Processing Webhook Action: ${action} for Order: ${orderId}`);

      // 1. Get order for telegram_id
      const { data: order, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (fetchError || !order) {
        console.error('Webhook Fetch Error:', fetchError);
        await axios.post(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          callback_query_id: callback_query.id,
          text: '❌ Database Error: Could not find order (' + orderId + ')',
          show_alert: true
        });
        return res.sendStatus(200);
      }

      // 2. Update Supabase
      const { error: dbError } = await supabaseAdmin
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (dbError) throw dbError;

      // 3. Notify Customer if confirmed
      const userInfo = order.user_info || {};
      const telegramId = userInfo.telegram_id;

      if (newStatus === 'completed' && telegramId) {
        const thankYouMessage = `
🎉 <b>Order Confirmed!</b>
-----------------
Hello <b>${userInfo.name || 'Customer'}</b>, your order has been successfully confirmed.

Thank you for buying! Have a great day! ✨
        `;

        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: telegramId,
          text: thankYouMessage,
          parse_mode: 'HTML'
        }).catch(e => console.warn('Could not send thank you message to customer:', telegramId, e.response?.data || e.message));
      }

      // 4. Answer Callback Query
      await axios.post(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        callback_query_id: callback_query.id,
        text: `Order ${newStatus === 'completed' ? 'confirmed' : 'declined'} successfully!`,
      });

      // 5. Edit original message to remove buttons and show status
      const baseText = cbMessage.text || 'Order Details';
      const updatedText = baseText.replace(/⏳ ?Pending/g, statusText) + 
                          `\n\n🎯 <b>Decision:</b> ${statusText} by Admin at ${new Date().toLocaleTimeString()}`;

      await axios.post(`https://api.telegram.org/bot${token}/editMessageText`, {
        chat_id: adminId,
        message_id: cbMessage.message_id,
        text: updatedText,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] } 
      }).catch(e => console.warn('Failed to edit admin message:', e.response?.data || e.message));

    } catch (err: any) {
      console.error('Webhook Error:', err);
      await axios.post(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        callback_query_id: callback_query.id,
        text: '❌ Error: ' + (err.message || 'Unknown error'),
        show_alert: true
      });
    }

    res.sendStatus(200);
  });

  // Helper route to set the webhook easily
  app.get('/api/setup-telegram', async (req, res) => {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    
    if (!token || token === 'your-bot-token' || !token.includes(':')) {
      return res.status(400).json({ 
        success: false, 
        error: { description: 'Telegram Bot Token is missing or invalid in Settings.' } 
      });
    }

    // Use x-forwarded-host (preferred) or host header
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    
    if (!host) {
      return res.status(400).json({ success: false, error: { description: 'Could not determine host for webhook.' } });
    }

    // Ensure we don't include internal ports like :3000 in the public webhook URL
    const publicHost = host.split(':')[0];
    // In our environment, we use the full shared/dev URL domain
    const webhookUrl = `https://${publicHost}/api/telegram-webhook`;

    try {
      console.log('Setting Telegram Webhook:', webhookUrl);
      const response = await axios.post(`https://api.telegram.org/bot${token}/setWebhook`, {
        url: webhookUrl,
        allowed_updates: ['callback_query', 'message'],
        drop_pending_updates: true
      });
      
      res.json({ 
        success: true, 
        message: 'Bot linked successfully!', 
        webhookUrl,
        telegramResponse: response.data 
      });
    } catch (error: any) {
      const tgError = error.response?.data || { description: error.message };
      console.error('Telegram setWebhook Failed:', tgError);
      res.status(500).json({ 
        success: false, 
        error: tgError,
        webhookUrl 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
