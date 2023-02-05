const axios = require("axios");

axios.get("https://proxy-api.xoxno.com/nfts/WATY-2c4433-66").then(res => res.data).then(console.log)
