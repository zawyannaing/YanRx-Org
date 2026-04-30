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

// Standard Supabase client (using anon key)
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

const app = express();
export default app;

async function startServer() {
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.post('/api/notify-order', (req, res) => {
    // 1. Respond immediately to the client to avoid timeout or delay
    res.json({ status: 'queued' });

    // 2. Process Telegram notification in the background
    const executeNotification = async () => {
      const { order, userInfo, selectedVariant, orderId, telegramId, paymentMethod, transactionId } = req.body;
      const tId = transactionId || req.body.transaction_id || req.body.transId || 'N/A';
      const pMethod = paymentMethod || req.body.payment_method || 'N/A';
      
      const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
      const adminId = process.env.TELEGRAM_ADMIN_ID?.trim();

      // Check if keys are missing
      const isConfigured = token && adminId && 
                          token !== 'your-bot-token' && 
                          adminId !== 'your-telegram-user-id';

      if (!isConfigured) {
        console.error('Telegram background config missing');
        return;
      }

      const myanmarTime = new Date().toLocaleString('en-US', { 
        timeZone: 'Asia/Yangon',
        dateStyle: 'medium',
        timeStyle: 'medium'
      });

      const escapeHtml = (text: string = '') => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const displayOrderId = orderId ? (typeof orderId === 'string' ? orderId.split('-')[0].toUpperCase() : orderId) : 'N/A';

      const adminMessage = `
🌟 <b>New Order Received!</b>
-----------------
🆔 <b>Order ID:</b> <code>${displayOrderId}</code>
📦 <b>Product:</b> <code>${escapeHtml(order.title)}</code>
💰 <b>Amount:</b> <code>${selectedVariant.price} ${selectedVariant.currency || 'USD'}</code>
⏱️ <b>Plan:</b> <code>${escapeHtml(selectedVariant.label)}</code>
⚡️ <b>Payment Details:</b>
💳 <b>Method:</b> <code>${escapeHtml(pMethod)}</code>
🔑 <b>Last 6 Digits:</b> <code>${escapeHtml(tId)}</code>
💳 <b>Status:</b> ⏳ <code>Pending</code>

👤 <b>Customer Details:</b>
- Name: <code>${escapeHtml(userInfo.name)}</code>
- Username: ${userInfo.username ? (userInfo.username.startsWith('@') ? escapeHtml(userInfo.username) : '@' + escapeHtml(userInfo.username)) : 'N/A'}
- TG ID: <code>${telegramId || 'N/A'}</code>

📅 <b>Time:</b> ${myanmarTime} MMT
      `;

      const customerMessage = `
✅ <b>Order Received!</b>
-----------------
Hello ${escapeHtml(userInfo.name)}, your order has been received and is being processed.

🆔 <b>Order ID:</b> <code>${displayOrderId}</code>
📦 <b>Product:</b> <code>${escapeHtml(order.title)}</code>
⏱️ <b>Plan:</b> <code>${escapeHtml(selectedVariant.label)}</code>
💰 <b>Price:</b> <code>${selectedVariant.price} ${selectedVariant.currency || 'USD'}</code>
💳 <b>Payment:</b> <code>${escapeHtml(pMethod)}</code>
🔑 <b>Trans ID:</b> <code>***${escapeHtml(tId)}</code>

📅 <b>Date:</b> ${myanmarTime}

🚀 We will notify you here once your order is confirmed. Thank you!
      `;

      try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: adminId,
          text: adminMessage,
          parse_mode: 'HTML'
        });

        if (telegramId) {
          await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: telegramId,
            text: customerMessage,
            parse_mode: 'HTML',
          }).catch(() => {});
        }
      } catch (error: any) {
        console.error('Background Telegram API Error:', error.response?.data || error.message);
      }
    };

    executeNotification();
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
    // 1. Respond immediately to Telegram to avoid retries
    res.sendStatus(200);

    // 2. Process logic in background-like manner (be careful in serverless)
    const processUpdate = async () => {
      try {
        const { callback_query, message } = req.body;
        const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
        const adminId = process.env.TELEGRAM_ADMIN_ID?.trim();

        if (!token) return;

        // Handle incoming text messages
        if (message && message.text) {
          const chatId = message.chat.id;
          const text = message.text.toLowerCase();

          if (text === '/id') {
            const responseText = `👋 <b>Hello!</b>\n\nYour Telegram User ID is: <code>${chatId}</code>\n\n` + 
                                (String(chatId) === String(adminId) 
                                  ? "✅ You are recognized as the <b>Admin</b>." 
                                  : "ℹ️ You are <b>not</b> yet configured as Admin in the app's Secrets.");
            
            await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
              chat_id: chatId,
              text: responseText,
              parse_mode: 'HTML'
            }).catch(e => console.error('Error sending ID response:', e.message));
          } else if (text === '/start') {
            try {
              const telegramId = message.from.id;
              const firstName = message.from.first_name;
              const username = message.from.username;

              // Check if user exists
              const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('*')
                .eq('telegram_id', telegramId)
                .single();

              if (checkError && checkError.code !== 'PGRST116') throw checkError;

              const welcomeMessage = `🌟 <b>Welcome to Premium Store, ${firstName}!</b>\n\n` +
                                    (existingUser 
                                      ? `Welcome back! Your current balance is <b>$${existingUser.balance || 0}</b>.` 
                                      : `Your account has been registered successfully.\n\nType <b>/id</b> to see your Telegram ID.`);

              if (!existingUser) {
                // Register new user
                const { error: insertError } = await supabase
                  .from('users')
                  .insert({
                    telegram_id: telegramId,
                    first_name: firstName,
                    username: username
                  });

                if (insertError) throw insertError;
              }

              await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
                chat_id: chatId,
                text: welcomeMessage,
                parse_mode: 'HTML'
              });
            } catch (error: any) {
              console.error('Start command error:', error.message);
              await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
                chat_id: chatId,
                text: '❌ <b>An error occurred during registration.</b>',
                parse_mode: 'HTML'
              }).catch(() => {});
            }
          }
          return;
        }

        // Handle callback queries
        if (callback_query) {
          const { data, message: cbMessage, from } = callback_query;

          if (!adminId || String(from.id) !== String(adminId)) {
            await axios.post(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
              callback_query_id: callback_query.id,
              text: '⚠️ Unauthorized.',
              show_alert: true
            });
            return;
          }

          const [action, orderId] = data.split(':');
          if (!orderId || orderId === 'unknown') return;

          const newStatus = action === 'conf' ? 'completed' : 'cancelled';
          const statusText = action === 'conf' ? '✅ COMPLETED' : '❌ DECLINED';

          const { data: order, error: fetchError } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

          if (fetchError || !order) return;

          await supabaseAdmin.from('orders').update({ status: newStatus }).eq('id', orderId);

          const userInfo = order.user_info || {};
          const telegramId = userInfo.telegram_id;

          if (newStatus === 'completed' && telegramId) {
            const thankYouMessage = `\n🎉 <b>Order Confirmed!</b>\n-----------------\nHello <b>${userInfo.name || 'Customer'}</b>, your order has been successfully confirmed.\n\nThank you! ✨`;
            await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
              chat_id: telegramId,
              text: thankYouMessage,
              parse_mode: 'HTML'
            }).catch(() => {});
          }

          await axios.post(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            callback_query_id: callback_query.id,
            text: `Order ${newStatus === 'completed' ? 'confirmed' : 'declined'} successfully!`,
          });

          const baseText = cbMessage.text || 'Order Details';
          const updatedText = baseText.replace(/⏳ ?Pending/g, statusText) + 
                              `\n\n🎯 <b>Decision:</b> ${statusText} by Admin`;

          await axios.post(`https://api.telegram.org/bot${token}/editMessageText`, {
            chat_id: adminId,
            message_id: cbMessage.message_id,
            text: updatedText,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [] } 
          }).catch(() => {});
        }
      } catch (err) {
        console.error('Webhook processing error:', err);
      }
    };

    processUpdate();
  });

  // API to update user balance
  app.post('/api/update-balance', async (req, res) => {
    const { telegramId, amount } = req.body;
    
    if (!telegramId) return res.status(400).json({ error: 'Missing telegramId' });

    try {
      // Get current balance
      const { data: user, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('balance')
        .eq('telegram_id', telegramId)
        .single();

      if (fetchError) throw fetchError;

      const newBalance = (user.balance || 0) + Number(amount);

      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('users')
        .update({ balance: newBalance })
        .eq('telegram_id', telegramId)
        .select()
        .single();

      if (updateError) throw updateError;

      res.json({ success: true, balance: updatedUser.balance });
    } catch (err: any) {
      console.error('Balance update error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // API to get user info
  app.get('/api/user/:id', async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('telegram_id', req.params.id)
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
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
    // Production: Serve static files from 'dist'
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Important: Let the API routes handle things first, then fall back to SPA for UI routes
    app.get('*', (req, res) => {
      // If the request is for an API that doesn't exist, this will serve index.html
      // Vercel routes will catch /api/* first usually, but this is a safety fallback
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only listen on port if not running as a Vercel/Serverless function
  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

// Ensure the server starts, but exports the app
startServer().catch(err => {
  console.error('Failed to start server:', err);
});

app.get('/api/hello', (req, res) => {
  res.json({ 
    message: "Hello! Your API is working on Vercel.",
    time: new Date().toISOString()
  });
});
