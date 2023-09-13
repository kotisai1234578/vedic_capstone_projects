const NewsBot = require("node-telegram-bot-api");
const axios = require("axios");
const token ="6209181171:AAFJFw_2czhiMHSp24y7Z1ChfKK6Rr0srZ4";
const bot = new NewsBot(token, {polling: true,});

// /start command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Hi, type /news for latest news');
});
const axios = require('axios');

const options = {
  method: 'GET',
  url: 'https://travel-advisor.p.rapidapi.com/locations/v2/auto-complete',
  params: {
    query: 'eiffel tower',
    lang: 'en_US',
    units: 'km'
  },
  headers: {
    'X-RapidAPI-Key': '8ceab51433msh4b86b83e1683396p1bc247jsnd94d2e2cc507',
    'X-RapidAPI-Host': 'travel-advisor.p.rapidapi.com'
  }
};

try {
	const response = await axios.request(options);
	console.log(response.data);
} catch (error) {
	console.error(error);
}