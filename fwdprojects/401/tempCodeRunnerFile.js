const axios = require('axios');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const TelegramBot = require('node-telegram-bot-api');

const botToken = '6382206512:AAFpivi7hMTa9RILzucdXUIChLS5p1LuKCI';
const bot = new TelegramBot(botToken, { polling: true });

var serviceAccount = require("./key.json");

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// Store previous IP addresses
const ipHistory = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Type /ip to get your IP address.');
});

bot.onText(/\/ip/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const response = await axios.get('http://api.ipstack.com/134.201.250.155?access_key=4c9bf5322a5db9f525f279c64f9baffe');
    const ip = response.data.ip;

    // Save the IP address to Firestore
    db.collection('ipAddresses').add({
      chatId: chatId,
      ipAddress: ip,
      timestamp: new Date().toISOString()
    });

    // Update the IP history for the chat ID
    if (!ipHistory[chatId]) {
      ipHistory[chatId] = [];
    }
    ipHistory[chatId].push(ip);

    bot.sendMessage(chatId, `Your IP address is: ${ip}`);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, 'Failed to retrieve IP address.');
  }
});

bot.onText(/\/history/, (msg) => {
  const chatId = msg.chat.id;

  if (ipHistory[chatId] && ipHistory[chatId].length > 0) {
    const historyMessage = 'Previous IP addresses:\n' + ipHistory[chatId].join('\n');
    bot.sendMessage(chatId, historyMessage);
  } else {
    bot.sendMessage(chatId, 'No previous IP addresses found.');
  }
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

