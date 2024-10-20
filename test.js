const Discord = require("discord.js");
const fs = require("fs");

const data = JSON.parse(fs.readFileSync("data.json"));

listSales = data.listSales ?? {};
const client = new Discord.Client({ intents: [] });

client.on('ready', () => {
    Object.entries(listSales).forEach(async ([guildId, listing]) => {
        if (guildId === "1204754416226271293") {
            console.log(guildId)
            const guild = client.guilds.cache.get(guildId);
            console.log(guild);
            if (guild) {
                for (const collection of Object.keys(listing)) {
                    for (const channelId of listing[collection]) {
                        try {
                            console.log(await guild.channels.fetch(channelId));
                        } catch (err) {
                            console.warn(`Error sending mint message to ${channelId}, guild ${guildId}: ${err}`)
                        }
                    }
                }
            }
        }
    });
    

})

client.login("MTA2ODgyNjA5NjQxNTU0MzI5Ng.GilpAH.hxL6U8qYL_ysld0vDHAskkKVryG5sD5oxqfj-k");