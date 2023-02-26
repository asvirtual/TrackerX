const Discord = require("discord.js");
const axios = require("axios").default;
const fs = require("fs");


const client = new Discord.Client({ intents: [] });

let listSales = {};
let listListings = {};
let listMints = {};

let lastTxHashSales = "";
let lastTxHashListings = "";
let lastTxHashMints = "";

function save() {
    fs.writeFileSync("data.json", JSON.stringify({
        listSales,
        listListings,
        listMints,
        
        lastTxHashSales,
        lastTxHashListings,
        lastTxHashMints,
    }));
}

function load() {
    try {
        const data = JSON.parse(fs.readFileSync("data.json"));

        listSales = data.listSales ?? {};
        listListings = data.listListings ?? {};
        listMints = data.listMints ?? {};

        lastTxHashSales = data.lastTxHashSales ?? "";
        lastTxHashListings = data.lastTxHashListings ?? "";
        lastTxHashMints = data.lastTxHashMints ?? "";
    } catch (e) {
        console.warn(`Error loading data: ${e}`);
    }
}

function getListFromDecoded(stringa) {
    const lista = stringa.split(";");
    lista.shift();
    for (let index = 0; index < lista.length; index++) {
        let ind = lista[index].indexOf(":");
        lista[index] = "**" + lista[index].substring(0, ind + 1) + "**" + lista[index].substring(ind);
    }
    return lista;
}

function getIdentifierFromTransaction(listOperations) {
    return listOperations.find(item => item.type === 'nft') || null;
}

async function trackSales() {
    try {
        let response = await axios.get("https://api.multiversx.com/transactions?size=5&status=success&function=buy");
        const firstSales = response.data;
        const firstTxHash = firstSales[0].txHash;
        let reversedList = [];

        if (firstTxHash !== lastTxHashSales) {
            for (const sale of firstSales) {
                if (sale.txHash !== lastTxHashSales) reversedList.push(sale);
                else break;
            }
        }

        if (reversedList.length === 0) 
            return;

        for (const item of reversedList) {
            response = await axios.get(`https://api.multiversx.com/transactions/${item.txHash}`);
            const transaction = response.data;
            if (!transaction.operations)
                continue;

            const transactionNftURL = getIdentifierFromTransaction(transaction["operations"]);
            if (!transactionNftURL || !transactionNftURL.identifier)
                continue;

            response = await axios.get(`https://api.multiversx.com/nfts/${transactionNftURL.identifier}`);
            const transactionNft = response.data;

            if (!transactionNft.identifier)
                continue;

            let link = "https://api.multiversx.com/nfts/" + transactionNft.identifier;
            const { name, identifier: collectionId, collection, attributes } = transactionNft;
            let listAttributes, image;

            if (transactionNft.attributes)
                listAttributes = getListFromDecoded(attributes);

            if (transactionNft.metadata?.attributes && transactionNft.metadata.attributes.length > 0)
                listAttributes = transactionNft.metadata.attributes.map(d => `**${d["trait_type"]}:** ${d["value"]}`);

            if (transactionNft.url) image = transactionNft.url
            else image = transactionNft.media[0].url;

            if (item.receiverAssets) {
                if (item.receiverAssets.name === "XOXNO: Marketplace") {
                    link = "https://xoxno.com/nft/" + collectionId;
                    marketPlaceName = "XOXNO";
                }
                if (item.receiverAssets.name === "Frame It: Marketplace") {
                    link = "https://www.frameit.gg/marketplace/nft/" + collectionId;
                    marketPlaceName = "Frame It";
                }
            } 
            if (item.receiver === "erd1qqqqqqqqqqqqqpgqd9rvv2n378e27jcts8vfwynpx0gfl5ufz6hqhfy0u0") {
                link = "https://deadrare.io/nft/" + collectionId;
                marketPlaceName = "Deadrare";
            }

            const receiver = "["+item["receiver"].slice(0, 3) + "..." + item["receiver"].slice(-3)+"](https://explorer.multiversx.com/accounts/"+item["receiver"]+")";
            const sender = "["+item["sender"].slice(0, 3) + "..." + item["sender"].slice(-3)+"](https://explorer.multiversx.com/accounts/"+item["sender"]+")";
            const transaction_price = (item["value"] / 1000000000000000000).toFixed(2);

            let message;
            if (listAttributes?.length === 0 || listAttributes == null || listAttributes == undefined)
                message = `**Name:** ${name}\n**Collection:** ${collection}\n**Price:** ${transaction_price} EGLD\n**Sender:** ${sender}\n**Receiver:** ${receiver}\n\n`;
            else if (listAttributes)
                message = `**Name:** ${name}\n**Collection:** ${collection}\n**Price:** ${transaction_price} EGLD\n**Sender:** ${sender}\n**Receiver:** ${receiver}\n\n__**Attributes:**__\n${listAttributes.join('\n')}`;

            Object.entries(listSales).forEach(async ([guildId, listing]) => {
                if (Object.keys(listing).includes(collection)) {
                    const embed = {
                        color: Discord.Colors.Orange,
                        image: { url: image },
                        title: `NEW SALE! 🛒`,
                        description: message,
                        footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                        timestamp: (new Date()).toISOString(),
                    }

                    const row = new Discord.ActionRowBuilder()
                        .addComponents(
                            new Discord.ButtonBuilder()
                                .setLabel('View Tx')
                                .setStyle(Discord.ButtonStyle.Link)
                                .setURL("https://explorer.multiversx.com/transactions/" + item.txHash)
                        )
                        .addComponents(
                            new Discord.ButtonBuilder()
                                .setLabel('View NFT')
                                .setStyle(Discord.ButtonStyle.Link)
                                .setURL(link)
                        );

                    const guild = client.guilds.cache.get(guildId);
                    if (guild) 
                        listing[collection].forEach(async channelId => 
                            await (await guild.channels.fetch(channelId)).send({ embeds: [embed], components: [row] }));
                }
            });
        }

        lastTxHashSales = firstTxHash;
    } catch (e) {
        console.warn(`[${new Date()}] Error while fetching data on sales: ${e}`);
        console.error(e);
    }
}

async function trackListings() {
    try {
        let reversed_list = [];
        let list_attributes = [];
        let transaction_price_usd = null;
        let transaction_price_egld = "0.00";
        const session = axios.create();
        const first5ListingsResp = await session.get("https://api.multiversx.com/transactions?size=5&status=success&function=listing", { headers: { 'accept': 'application/json' } });
        const first5Listings = first5ListingsResp.data;
        const firstTxHash = first5Listings[0]["txHash"];
        if (firstTxHash !== lastTxHashListings) {
            for (let listing_transaction of first5Listings) {
                if (listing_transaction["txHash"] !== lastTxHashListings) {
                    reversed_list.push(listing_transaction);
                } else {
                    break;
                }
            }
        }
        if (reversed_list.length !== 0) {
            for (let item of reversed_list.reverse()) {
                if (item.action?.arguments?.transfers) {
                    for (let transfer of item["action"]["arguments"]["transfers"]) {
                        if (transfer["type"] === "NonFungibleESDT") {
                            const collection = transfer["collection"];
                            const collection_id = transfer["identifier"];
                            let link = "https://api.multiversx.com/nfts/" + collection_id;
                            const transaction_priceResp = await session.get("https://proxy-api.xoxno.com/nfts/" + collection_id);
                            const transaction_price = transaction_priceResp.data;
                            if ("saleInfoNft" in transaction_price && transaction_price["saleInfoNft"] != null) {
                                if ("usd" in transaction_price["saleInfoNft"]) {
                                    transaction_price_usd = transaction_price["saleInfoNft"]["usd"];
                                }
                            }
                            if ("saleInfoNft" in transaction_price && transaction_price["saleInfoNft"] != null) {
                                if ("min_bid" in transaction_price["saleInfoNft"]) {
                                    transaction_price_egld = (parseInt(transaction_price["saleInfoNft"]["min_bid"]) / 1000000000000000000).toString();
                                }
                            }

                            const price_and_attributes_responseResp = await session.get("https://api.multiversx.com/nfts/" + collection_id, { headers: { 'accept': 'application/json' } });
                            const price_and_attributes_response = price_and_attributes_responseResp.data;
                            const name = price_and_attributes_response.name;
                            let attributes;
                            if ("attributes" in price_and_attributes_response) {
                                const decode_string = Buffer.from(price_and_attributes_response["attributes"], 'base64').toString();
                                list_attributes = getListFromDecoded(decode_string);
                            }
                            if ("metadata" in price_and_attributes_response) {
                                if ("attributes" in price_and_attributes_response["metadata"]) {
                                    attributes = price_and_attributes_response["metadata"]["attributes"]
                                    if (attributes.length > 0)
                                        list_attributes = attributes.map(d => `**${d["trait_type"]}:** ${d["value"]}`);
                                }
                            }

                            const receiver = "["+item["receiver"].slice(0, 3) + "..." + item["receiver"].slice(-3)+"](https://explorer.multiversx.com/accounts/"+item["receiver"]+")";
                            
                            response = await axios.get("https://api.multiversx.com/nfts/"+collection_id);
                            image_response = await response.data;
                            if ("url" in image_response)
                                image = image_response["url"];
                            else
                                image = image_response["media"][0]["url"];
                                
                            if ("arguments" in item["action"]) {
                                if ("receiverAssets" in item["action"]["arguments"]) {
                                    if (item["action"]["arguments"]["receiverAssets"]["name"] === "XOXNO: Marketplace")
                                        link = "https://xoxno.com/nft/" + collection_id;
                                    if (item["action"]["arguments"]["receiverAssets"]["name"] === "Frame It: Marketplace")
                                        link = "https://www.frameit.gg/marketplace/nft/" + collection_id;
                                } 
                                if (item["receiver"] == "erd1qqqqqqqqqqqqqpgqd9rvv2n378e27jcts8vfwynpx0gfl5ufz6hqhfy0u0")
                                    link = "https://deadrare.io/nft/"+collection_id;
                            }

                            let message;
                            if (list_attributes.length > 0)
                                message = "**Name:** "+name+"\n**Collection:** "+collection+"\n**Price:** "+transaction_price_egld+" EGLD\n"+"**Owner: **"+receiver+"**"+"\n\n**__**Attributes:**__\n"+ list_attributes.join("\n");
                            else
                                if (transaction_price_usd != undefined && transaction_price_usd != null)
                                    message = "**Name:** "+name+"\n**Collection:** "+collection+"\n**Price:** "+transaction_price_egld+" EGLD ($"+transaction_price_usd+")\n\n"+"**Owner: **"+receiver+"**";
                                else
                                    message = "**Name:** "+name+"\n**Collection:** "+collection+"\n**Price:** "+transaction_price_egld+" EGLD\n\n"+"**Owner: **"+receiver+"**";
                            
                            Object.entries(listListings).forEach(async ([guildId, listing]) => {
                                if (Object.keys(listing).includes(collection)) {
                                    const embed = {
                                        color: Discord.Colors.Orange,
                                        image: { url: image },
                                        title: `NEW LISTING! 🏷️`,
                                        description: message,
                                        footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                                        timestamp: (new Date()).toISOString(),
                                    }
                    
                                    const row = new Discord.ActionRowBuilder()
                                        .addComponents(
                                            new Discord.ButtonBuilder()
                                                .setLabel('View Tx')
                                                .setStyle(Discord.ButtonStyle.Link)
                                                .setURL("https://explorer.multiversx.com/transactions/" + item.txHash)
                                        )
                                        .addComponents(
                                            new Discord.ButtonBuilder()
                                                .setLabel('View NFT')
                                                .setStyle(Discord.ButtonStyle.Link)
                                                .setURL(link)
                                        );

                                    const guild = client.guilds.cache.get(guildId);
                                    if (guild) 
                                        listing[collection].forEach(async channelId => 
                                            await (await guild.channels.fetch(channelId)).send({ embeds: [embed], components: [row] }));
                                }
                            })
                        }
                    }
                }
            }
            lastTxHashListings = firstTxHash;
        }
    } catch (e) {
        console.warn(`[${new Date()}] Error while fetching data on listings: ${e}`);
        console.error(e);
    }
}

async function trackMints() {
    try {
        let reversed_list = [];
        let list_attributes = [];
        const first5MintsResp = await axios.get(
            'https://api.multiversx.com/transactions?size=5&status=success&function=mint',
            { headers: { 'accept': 'application/json' } }
        );
        const first5Mints = first5MintsResp.data;
        const firstTxHash = first5Mints[0]["txHash"];
        if (firstTxHash !== lastTxHashMints) {
            for (let mint_transaction of first5Mints) {
                if (mint_transaction["txHash"] !== lastTxHashMints) {
                    reversed_list.push(mint_transaction);
                } else {
                    break;
                }
            }
        }
        if (reversed_list.length > 0) {
            for (let item of reversed_list.reverse()) {
                const transactionResp = await axios.get(
                    'https://api.multiversx.com/transactions/' + item["txHash"],
                    { headers: { 'accept': 'application/json' } }
                );
                let transaction = transactionResp.data;
                let transaction_nft = getIdentifierFromTransaction(transaction["operations"]);
                if (transaction_nft != null && !transaction.operations) {
                    if ("identifier" in transaction_nft) {
                        const nftResp = await axios.get(
                            'https://api.multiversx.com/nfts/' + transaction_nft["identifier"],
                            { headers: { 'accept': 'application/json' } }
                        );
                        transaction_nft = nftResp.data;
                        const collection_id = transaction_nft["identifier"];
                        let link = "https://api.multiversx.com/nfts/" + transaction_nft["identifier"];
                        let name = transaction_nft["name"];
                        let collection = transaction_nft["collection"];
                        if ("attributes" in transaction_nft) {
                            let decode_string = Buffer.from(transaction_nft.attributes, 'base64').toString();
                            list_attributes = getListFromDecoded(decode_string);
                        }
                        if ("metadata" in transaction_nft) {
                            if ("attributes" in transaction_nft["metadata"]) {
                                let attributes = transaction_nft["metadata"]["attributes"];
                                if (attributes.length > 0) {
                                    list_attributes = attributes.map(d => `**${d["trait_type"]}:** ${d["value"]}`);
                                }
                            }
                        }
                        let image;
                        if ("url" in transaction_nft) {
                            image = transaction_nft["url"];
                        } else {
                            image = transaction_nft["media"][0]["url"];
                        }

                        if ("receiverAssets" in item) {
                            if (item["receiverAssets"]["name"] === "XOXNO: Marketplace")
                                link = "https://xoxno.com/nft/" + collection_id
                            if (item["receiverAssets"]["name"] === "Frame It: Marketplace")
                                link = "https://www.frameit.gg/marketplace/nft/" + collection_id
                        }
                        if (item["receiver"] === "erd1qqqqqqqqqqqqqpgqd9rvv2n378e27jcts8vfwynpx0gfl5ufz6hqhfy0u0")
                            link = "https://deadrare.io/nft/"+collection_id 

                        const receiver = `[${item["receiver"].substring(0, 3)}...${item["receiver"].substring(item["receiver"].length - 3)}](https://explorer.multiversx.com/accounts/${item["receiver"]})`;
                        const sender = `[${item["sender"].substring(0, 3)}...${item["sender"].substring(item["sender"].length - 3)}](https://explorer.multiversx.com/accounts/${item["sender"]})`;
                        const transactionPrice = (item["value"] / 1000000000000000000).toString();
                        let message;
                        if (list_attributes.length === 0) {
                            message = `**Name:** ${name}\n**Collection:** ${collection}\n**Price:** ${transactionPrice} EGLD\n**Minter:** ${receiver}\n\n`;
                        } else {
                            message = `**Name:** ${name}\n**Collection:** ${collection}\n**Price:** ${transactionPrice} EGLD\n**Minter:** ${receiver}\n\n__**Attributes:**__:\n${list_attributes.join("\n")}`;
                        }

                        Object.entries(listMints).forEach(async ([guildId, listing]) => {
                            if (Object.keys(listing).includes(collection)) {
                                const embed = {
                                    color: Discord.Colors.Orange,
                                    image: { url: image },
                                    title: `NEW MINT! 💸`,
                                    description: message,
                                    footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                                    timestamp: (new Date()).toISOString(),
                                }
                
                                const row = new Discord.ActionRowBuilder()
                                    .addComponents(
                                        new Discord.ButtonBuilder()
                                            .setLabel('View Tx')
                                            .setStyle(Discord.ButtonStyle.Link)
                                            .setURL("https://explorer.multiversx.com/transactions/" + item.txHash)
                                    )
                                    .addComponents(
                                        new Discord.ButtonBuilder()
                                            .setLabel('View NFT')
                                            .setStyle(Discord.ButtonStyle.Link)
                                            .setURL(link)
                                    );
                                
                                const guild = client.guilds.cache.get(guildId);
                                if (guild) 
                                    listing[collection].forEach(async channelId => 
                                        await (await guild.channels.fetch(channelId)).send({ embeds: [embed], components: [row] }));
                            }
                        });
                    } 
                } else if (transaction_nft != null && transaction.operations != undefined) {
                    const mintTransactions = transaction.operations.filter(mintTransaction => mintTransaction.receiver === transaction.sender && mintTransaction.sender === transaction.receiver && mintTransaction.action === "transfer" && "identifier" in mintTransaction);
                    for (const mintTransaction of transaction.operations) {
                        if (mintTransaction.receiver === transaction.sender && mintTransaction.sender === transaction.receiver && mintTransaction.action === "transfer" && "identifier" in mintTransaction) {
                            const nftResp = await axios.get(
                                'https://api.multiversx.com/nfts/' + mintTransaction["identifier"],
                                { headers: { 'accept': 'application/json' } }
                            );
                            let transaction_nft = nftResp.data;
                            const collection_id = transaction_nft["identifier"];
                            let link = "https://xoxno.com/nft/" + transaction_nft["identifier"];
                            let name = transaction_nft["name"];
                            let collection = transaction_nft["collection"];
                            if ("attributes" in transaction_nft) {
                                let decode_string = Buffer.from(transaction_nft.attributes, 'base64').toString();
                                list_attributes = getListFromDecoded(decode_string);
                            }

                            if ("metadata" in transaction_nft) {
                                if ("attributes" in transaction_nft["metadata"]) {
                                    let attributes = transaction_nft["metadata"]["attributes"];
                                    if (attributes.length > 0) {
                                        list_attributes = attributes.filter(d => d["trait_type"] !== "None").map(d => `**${d["trait_type"]}:** ${d["value"]}`);
                                    }
                                }
                            }

                            if (list_attributes[0].includes("**metadata:**"))
                                list_attributes = [];

                            let image;
                            if ("url" in transaction_nft) {
                                if (transaction_nft.url.includes(".mp4") && transaction_nft.media)
                                    image = transaction_nft.media[0].thumbnailUrl;
                                else
                                    image = transaction_nft["url"];
                            } else {
                                if (transaction_nft["media"][0]["url"].includes(".mp4"))
                                    image = transaction_nft.media[0].thumbnailUrl;
                                else
                                    image = transaction_nft["media"][0]["url"];
                            }
    
                            if ("receiverAssets" in transaction) {
                                if (transaction["receiverAssets"]["name"] === "XOXNO: Marketplace")
                                    link = "https://xoxno.com/nft/" + collection_id;
                                if (transaction["receiverAssets"]["name"] === "Frame It: Marketplace")
                                    link = "https://www.frameit.gg/marketplace/nft/" + collection_id;
                            } 
                            if (transaction["receiver"] === "erd1qqqqqqqqqqqqqpgqd9rvv2n378e27jcts8vfwynpx0gfl5ufz6hqhfy0u0")
                                link = "https://deadrare.io/nft/" + collection_id;
                                    
                            const receiver = `[${transaction["sender"].substring(0, 3)}...${transaction["sender"].substring(transaction["sender"].length - 3)}](https://explorer.multiversx.com/accounts/${transaction["sender"]})`;
                            const transactionPrice = (transaction["value"] / 1000000000000000000) / Object.keys(mintTransactions).length;
                            let message;
                            if (!list_attributes || list_attributes.length === 0) {
                                message = `**Name:** ${name}\n**Collection:** ${collection}\n${transactionPrice !== 0 ? "**Price:** " + transactionPrice + " EGLD\n" : ""}**Minter:** ${receiver}\n\n`;
                            } else {
                                message = `**Name:** ${name}\n**Collection:** ${collection}\n${transactionPrice !== 0 ? "**Price:** " + transactionPrice + " EGLD\n" : ""}**Minter:** ${receiver}\n\n__**Attributes:**__:\n${list_attributes.join("\n")}`;
                            }
    
                            Object.entries(listMints).forEach(async ([guildId, listing]) => {
                            // Object.entries({ "1052592184345501726": { "ETHOS-205078": "1052592184781717506" } }).forEach(async ([guildId, listing]) => {
                                if (Object.keys(listing).includes(collection)) {
                                // if (true) {
                                    const embed = {
                                        color: Discord.Colors.Orange,
                                        title: `NEW MINT! 💸`,
                                        image: { url: image },
                                        description: message,
                                        footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                                        timestamp: (new Date()).toISOString(),
                                    }
                    
                                    const row = new Discord.ActionRowBuilder()
                                        .addComponents(
                                            new Discord.ButtonBuilder()
                                                .setLabel('View Tx')
                                                .setStyle(Discord.ButtonStyle.Link)
                                                .setURL("https://explorer.multiversx.com/transactions/" + mintTransaction.id)
                                        )
                                        .addComponents(
                                            new Discord.ButtonBuilder()
                                                .setLabel('View NFT')
                                                .setStyle(Discord.ButtonStyle.Link)
                                                .setURL(link)
                                        );
                                        
                                    const guild = client.guilds.cache.get(guildId);
                                    if (guild) 
                                        listing[collection].forEach(async channelId => 
                                            await (await guild.channels.fetch(channelId)).send({ embeds: [embed], components: [row] }));
                                        // await (await guild.channels.fetch("1052592184781717506")).send({ embeds: [embed], components: [row] });
                                }
                            });
                        }
                    }
                }
            }
            lastTxHashMints = firstTxHash
        }
    } catch (e) {
        console.warn(`[${new Date()}] Error while fetching data on mints: ${e}`);
        console.error(e);
    }
}

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        switch (interaction.commandName) {
            case "track":
                switch (interaction.options.getString("action")) {
                    case "sales":
                        if (listSales[interaction.guildId]?.[interaction.options.getString("collection")]?.includes(interaction.options.getChannel("channel").id))
                            break;

                        if (listSales[interaction.guildId]?.[interaction.options.getString("collection")])
                            listSales[interaction.guildId][interaction.options.getString("collection")].push(interaction.options.getChannel("channel").id);
                        else if (listSales[interaction.guildId])
                            listSales[interaction.guildId][interaction.options.getString("collection")] = [ interaction.options.getChannel("channel").id ];
                        else
                            listSales[interaction.guildId] = {
                                [interaction.options.getString("collection")]: [ interaction.options.getChannel("channel").id ]
                            };

                        break;
                    case "listings":
                        if (listListings[interaction.guildId]?.[interaction.options.getString("collection")]?.includes(interaction.options.getChannel("channel").id))
                            break;

                        if (listListings[interaction.guildId]?.[interaction.options.getString("collection")])
                            listListings[interaction.guildId][interaction.options.getString("collection")].push(interaction.options.getChannel("channel").id);
                        else if (listListings[interaction.guildId])
                            listListings[interaction.guildId][interaction.options.getString("collection")] = [ interaction.options.getChannel("channel").id ];
                        else
                            listListings[interaction.guildId] = {
                                [interaction.options.getString("collection")]: [ interaction.options.getChannel("channel").id ]
                            };

                        break;
                    case "mints":
                        if (listMints[interaction.guildId]?.[interaction.options.getString("collection")]?.includes(interaction.options.getChannel("channel").id))
                            break;

                        if (listMints[interaction.guildId]?.[interaction.options.getString("collection")])
                            listMints[interaction.guildId][interaction.options.getString("collection")].push(interaction.options.getChannel("channel").id);
                        else if (listMints[interaction.guildId])
                            listMints[interaction.guildId][interaction.options.getString("collection")] = [ interaction.options.getChannel("channel").id ];
                        else
                            listMints[interaction.guildId] = { 
                                [interaction.options.getString("collection")]: [ interaction.options.getChannel("channel").id ]
                            };

                        break;
                }
                
                await interaction.reply({ embeds: [{
                    color: Discord.Colors.Orange,
                    title: `Now tracking ${interaction.options.getString("action")} for collection ${interaction.options.getString("collection")} :white_check_mark:`,
                    footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                    timestamp: (new Date()).toISOString(),
                }] });

                save();
                return;
            case "stop":
                switch (interaction.options.getString("action")) {
                    case "sales":
                        if (listSales[interaction.guildId]?.[interaction.options.getString("collection")]?.includes(interaction.options.getChannel("channel").id)) {
                            await interaction.reply({ embeds: [{
                                color: Discord.Colors.Orange,
                                title: `Collection ${interaction.options.getString("collection")} is not being tracked on this server`,
                                footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                                timestamp: (new Date()).toISOString(),
                            }] });

                            return;
                        }

                        if (listSales[interaction.guildId]?.[interaction.options.getString("collection")]) 
                            listSales[interaction.guildId][interaction.options.getString("collection")] = 
                                listSales[interaction.guildId][interaction.options.getString("collection")].filter(channel => 
                                    channel !== interaction.options.getChannel("channel").id);

                        break;
                    case "listings":
                        if (listListings[interaction.guildId]?.[interaction.options.getString("collection")]?.includes(interaction.options.getChannel("channel").id)) {
                            await interaction.reply({ embeds: [{
                                color: Discord.Colors.Orange,
                                title: `Collection ${interaction.options.getString("collection")} is not being tracked on this server`,
                                footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                                timestamp: (new Date()).toISOString(),
                            }] });
                            
                            return;
                        }

                        if (listListings[interaction.guildId]?.[interaction.options.getString("collection")]) 
                            listListings[interaction.guildId][interaction.options.getString("collection")] = 
                                listListings[interaction.guildId][interaction.options.getString("collection")].filter(channel => 
                                    channel !== interaction.options.getChannel("channel").id);

                        break;
                    case "mints":
                        if (listMints[interaction.guildId]?.[interaction.options.getString("collection")]?.includes(interaction.options.getChannel("channel").id)) {
                            await interaction.reply({ embeds: [{
                                color: Discord.Colors.Orange,
                                title: `Collection ${interaction.options.getString("collection")} is not being tracked on this server`,
                                footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                                timestamp: (new Date()).toISOString(),
                            }] });
                            
                            return;
                        }
                                                
                        if (listMints[interaction.guildId]?.[interaction.options.getString("collection")]) 
                            listMints[interaction.guildId][interaction.options.getString("collection")] = 
                                listMints[interaction.guildId][interaction.options.getString("collection")].filter(channel => 
                                    channel !== interaction.options.getChannel("channel").id);

                        break;
                }

                await interaction.reply({ embeds: [{
                    color: Discord.Colors.Orange,
                    title: `Stopped tracking ${interaction.options.getString("action")} for collection ${interaction.options.getString("collection")} :octagonal_sign:`,
                    footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                    timestamp: (new Date()).toISOString(),
                }] });
                
                save();
                return;
            case "reset":
                delete listSales[interaction.guildId];
                delete listListings[interaction.guildId];
                delete listMints[interaction.guildId];

                await interaction.reply({ embeds: [{
                    color: Discord.Colors.Orange,
                    title: `Stopped all trackings :octagonal_sign:`,
                    footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                    timestamp: (new Date()).toISOString(),
                }] });

                save();
                return;
            case "list":
                const embeds = [{ 
                    color: Discord.Colors.Orange,
                    title: `Active trackings in this server :mag:`,
                    footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                    timestamp: (new Date()).toISOString(),
                }];

                let idx = 0;
                let embed = {
                    color: Discord.Colors.Orange,
                    title: `LISTINGS 🏷️`,
                    footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                    timestamp: (new Date()).toISOString(),
                    fields: [],
                };

                embeds.push(embed);

                Object.entries(listListings[interaction.guildId] ?? {}).map(([collection, channels]) => ({ collection, channels })).forEach(tracking => {
                    tracking.channels.forEach(channel => {
                        if (idx !== 0 && idx % 25 === 0) {
                            embeds.push(embed);
                            embed = {
                                color: Discord.Colors.Orange,
                                footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                                timestamp: (new Date()).toISOString(),
                                fields: [{
                                    name: `Sale tracker ${idx+1}:`,
                                    value: `${tracking.collection} on <#${channel}>`
                                }]
                            };
                        } else 
                            embed.fields.push({
                                name: `Sale tracker ${idx+1}:`,
                                value: `${tracking.collection} on <#${channel}>`
                            });
                            
                        idx++;
                    });
                });

                embed = {
                    color: Discord.Colors.Orange,
                    title: `SALES 🛒`,
                    footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                    timestamp: (new Date()).toISOString(),
                    fields: [],
                };

                embeds.push(embed);
                idx = 0;

                Object.entries(listSales[interaction.guildId] ?? {}).map(([collection, channels]) => ({ collection, channels })).forEach(tracking => {
                    tracking.channels.forEach(channel => {
                        if (idx !== 0 && idx % 25 === 0) {
                            embeds.push(embed);
                            embed = {
                                color: Discord.Colors.Orange,
                                footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                                timestamp: (new Date()).toISOString(),
                                fields: [{
                                    name: `Sale tracker ${idx+1}:`,
                                    value: `${tracking.collection} on <#${channel}>`
                                }]
                            };
                        } else 
                            embed.fields.push({
                                name: `Sale tracker ${idx+1}:`,
                                value: `${tracking.collection} on <#${channel}>`
                            });
                            
                        idx++;
                    });
                })

                embed = {
                    color: Discord.Colors.Orange,
                    title: `MINTS 💸`,
                    footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                    timestamp: (new Date()).toISOString(),
                    fields: [],
                };

                embeds.push(embed);
                idx = 0;

                Object.entries(listMints[interaction.guildId] ?? {}).map(([collection, channels]) => ({ collection, channels })).forEach(tracking => {
                    tracking.channels.forEach(channel => {
                        if (idx !== 0 && idx % 25 === 0) {
                            embeds.push(embed);
                            embed = {
                                color: Discord.Colors.Orange,
                                footer: { text: `Powered by Ziken Labs, 2023`, iconURL: "https://cdn.discordapp.com/attachments/1052592184781717506/1071074609098657852/logo_1080.gif.png" },
                                timestamp: (new Date()).toISOString(),
                                fields: [{
                                    name: `Sale tracker ${idx+1}:`,
                                    value: `${tracking.collection} on <#${channel}>`
                                }]
                            };
                        } else 
                            embed.fields.push({
                                name: `Sale tracker ${idx+1}:`,
                                value: `${tracking.collection} on <#${channel}>`
                            });
                            
                        idx++;
                    });
                })

                await interaction.reply({ embeds });
                return;
            case "help":
                await interaction.reply({ embeds: [{
                    color: Discord.Colors.Orange,
                    description: `**TrackerX** is a *completely free* bot that allows tracking sales, listings and mints of NFT collections on the **MultiversX (EGLD)** blockchain, previously called Elrond.\mIt was created by *Asvirtual#2503* for **Ziken Labs**.\n\nHere is the list of available commands:`,
                    fields: [
                        {
                            name: "/track",
                            value: `Start a new tracker.\n*Required parameters are:*\n- Action: Choose whether to track sales, listings, or mints.\n- Channel: Choose which channel to track in.\n- Collection: Enter the ID of the collection you wish to track`,
                        },
                        {
                            name: "/stop",
                            value: `Stop an active tracker.\n*Required parameters are:*\n- Action: Choose which active tracker to stop between sales, listings and mints.\n- Channel: Choose in which channel to stop the active tracker.\n- Collection: Enter the ID of the collection whose tracking you wish to stop`,
                        },
                        {
                            name: "/list",
                            value: `Show all active tracking`,
                        },
                        {
                            name: "/reset",
                            value: `Reset and remove all active trackers`,
                        },
                        {
                            name: "Support server",
                            value: "[ZKN LBS](https://discord.gg/5z2np6avum)"
                        }
                    ],
                    timestamp: (new Date()).toISOString(),
                }] });
                return;
        }
    }
});

client.on('ready', async () => {
    console.log("Bot ready");

    load();
    // setTimeout(async () => {
    setInterval(async () => {
        trackSales();
        setTimeout(trackListings, 1000 * 60);
        setTimeout(trackMints, 1000 * 60);
    }, 1000 * 180);
    // }, 1000 * 4);

    return;

    client.application.commands.set([
        {
            name: 'help',
            description: 'How to use TrackerX'
        },
        {
            name: 'track',
            description: 'Starts tracking an action (sales, listings, mints) for a collection',
            options: [
                { 
                    type: 3,
                    name: "action",
                    description: "Action to be tracked",
                    required: true,
                    choices: [
                        { name: "sales", value: "sales" },
                        { name: "listings", value: "listings" },
                        { name: "mints", value: "mints" },
                    ]
                },
                { 
                    type: 7,
                    name: "channel",
                    description: "Output channel",
                    required: true,
                },
                {
                    type: 3,
                    name: "collection",
                    description: "The collection's ID",
                    required: true,
                }
            ]
        },
        {
            name: 'stop',
            description: 'Stops tracking',
            options: [
                { 
                    type: 3,
                    name: "action",
                    description: "Action's tracking to be stopped",
                    required: true,
                    choices: [
                        { name: "sales", value: "sales" },
                        { name: "listings", value: "listings" },
                        { name: "mints", value: "mints" },
                    ]
                },
                { 
                    type: 7,
                    name: "channel",
                    description: "Output channel",
                    required: true,
                },
                {
                    type: 3,
                    name: "collection",
                    description: "The collection's ID",
                    required: true,
                },
            ]
        },
        {
            name: 'reset',
            description: 'Reset all trackings in this server'
        },
        {
            name: 'list',
            description: 'List currently active trackings in this server'
        }
    ])
        .then(() => console.log("[BOT] Updated slash commands"))
        .catch(console.error);
});

client.login("MTA2ODgyNjA5NjQxNTU0MzI5Ng.GilpAH.hxL6U8qYL_ysld0vDHAskkKVryG5sD5oxqfj-k");
// https://discord.com/api/oauth2/authorize?client_id=1068826096415543296&permissions=116736&scope=bot%20applications.commands
