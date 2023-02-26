const axios = require("axios");

axios.get("https://proxy-api.xoxno.com/nfts/TIREDCLUB-b8cfb8-06e7").then(res => res.data).then(console.log)
