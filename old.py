import discord
from discord import app_commands 
from discord.ext import tasks
import aiohttp
import base64

APP_ID = "1062700534294925322"
PUBLIC_KEY = "168fe4bd93b54e630467825c2fbb2cb980a27bea2a82f75979811d0330104286"
BOT_TOKEN = "MTA2MjcwMDUzNDI5NDkyNTMyMg.Ga8MQu.P8XMcoN1c170KyD-QLW24DeDpizuLBl8ky_V7k"
PERMISSION_CODE = 8
SERVER_ID = "1021822728623357972"

class Buttons(discord.ui.View):
    def __init__(self, *, timeout=180):
        super().__init__(timeout=timeout)

intents = discord.Intents.default()
client = discord.Client(intents=intents)
tree = app_commands.CommandTree(client)
list_of_actions = [app_commands.Choice(name="sales", value="sales"), app_commands.Choice(name="listings", value="listings"), app_commands.Choice(name="mints", value="mints")]
list_app_commands = []

list_sales = []
list_listings = []
list_mints = []

lastTxHashSales = ''
lastTxHashListings = ''
lastTxHashMints = ''

@client.event
async def on_ready():
    server = client.get_guild(int(SERVER_ID))
    for channel in server.channels:
        if str(channel.type) == "text":
            list_app_commands.append(app_commands.Choice(name=channel.name, value=str(channel.id)))
    print(list_app_commands)
    await tree.sync(guild=discord.Object(id=SERVER_ID))
    await startOp.start()
    

@tree.command(name = 'stop')
@app_commands.choices(action=list_of_actions, channel=list_app_commands)
async def stop(interaction: discord.Interaction, action: app_commands.Choice[str], channel: app_commands.Choice[str], collection_id: str):
    if any(d['channel'] == channel.value for d in list_sales) or any(d['channel'] == channel.value for d in list_listings) or any(d['channel'] == channel.value for d in list_mints):
        await interaction.response.send_message(f"You've correctly stopped tracking the {action.name} of **{collection_id}** on **{client.get_channel(int(channel.value)).mention}** ✅")
        action_name = action.name
        channel_id = channel.value
        collection = collection_id
        if action_name == "sales":
            sales(channel_id, "remove", collection)
        if action_name == "listings":
            listings(channel_id, "remove", collection)
        if action_name == "mints":
            mints(channel_id, "remove", collection)
    else:
        await interaction.response.send_message(f"You're not tracking the {action.name} of **{collection_id}** on **{client.get_channel(int(channel.value)).mention}**! ❌")

@tree.command( name = 'help')
async def help(interaction: discord.Interaction):
    myid = '<@911217122015842314>'
    await interaction.response.send_message(f"""\nTrackerX is a bot that allows **tracking sales, listings and mints** of NFT collections on the **MultiversX (EGLD)** blockchain, previously called Elrond. 
The bot is **completely free**!
It was created by {myid} (omar_#0087) for **ZKN LBS**. 
Support server: https://discord.gg/5z2np6avum

__Here is the list of available commands__:

**/track**: Start a new tracker.
Required parameters are:
- *Action*: Choose whether to track sales, listings, or mints.
- *Channel*: Choose which channel to track in.
- *Collection*: Enter the ID of the collection you wish to track.

**/stop**: Stop an active tracker.
Required parameters are:
- *Action*: Choose which active tracker to stop between sales, listings and mints.
- *Channel*: Choose in which channel to stop the active tracker.
- *Collection*: Enter the ID of the collection whose tracking you wish to stop.

**/list_track**: Show all active tracking.

**/reset_all**: Reset and remove all active trackers.

__**Note**__: make sure you have set the bot's permissions correctly in the channels in which it is used (see channels, send messages, embed links, attach files).""")

@tree.command( name = 'list_tracks')
async def list_tracks(interaction: discord.Interaction):
    messaggio = ''
    for item in list_sales:
        messaggio = messaggio + "__**SALES**__\n\nChannel: "+client.get_channel(int(item["channel"])).mention+"\nSales tracker: "+", ".join(item["collections"])+"\n\n"

    for item in list_listings:
        messaggio = messaggio + "__**LISTINGS**__\n\nChannel: " +client.get_channel(int(item["channel"])).mention+"\nListings tracker: "+", ".join(item["collections"])+"\n\n"

    for item in list_mints:
        messaggio = messaggio + "__**MINTS**__\n\nChannel: " +client.get_channel(int(item["channel"])).mention+"\nMints tracker: "+", ".join(item["collections"])+"\n\n"
    
    if messaggio != '':
        await interaction.response.send_message(f"List of all tracks!\n\n"+messaggio)
    else:
        await interaction.response.send_message(f"No tracking listed!")

@tree.command( name = 'reset_all')
async def reset_all(interaction: discord.Interaction):
    await interaction.response.send_message(f"You reset all tracks correctly! ✅")
    global list_sales
    global list_listings
    global list_mints
    list_sales = []
    list_listings = []
    list_mints = []


@tree.command( name = 'track')
@app_commands.choices(action=list_of_actions, channel=list_app_commands)
async def track(interaction: discord.Interaction, action: app_commands.Choice[str], channel: app_commands.Choice[str], collection_id: str):
    await interaction.response.send_message(f"You're now tracking the {action.name} of **{collection_id}** on **{client.get_channel(int(channel.value)).mention}** ✅")
    action_name = action.name
    channel_id = channel.value
    collection = collection_id
    if action_name == "sales":
        sales(channel_id, "add", collection)
    if action_name == "listings":
        listings(channel_id, "add", collection)
    if action_name == "mints":
        mints(channel_id, "add", collection)

def sales(channelId, action, collection):
    global list_sales
    if action == "add":
        if channelId not in [l["channel"] for l in list_sales]:
            sales_object = {
                "channel": channelId,
                "collections": [collection]
            }
            list_sales.append(sales_object)
        else:
            list_sales[(getIndex(list_sales, channelId)[0]-1)]["collections"].append(collection)
    else:
        if channelId in [l["channel"] for l in list_sales]:
            list_sales = [i for i in list_sales if collection not in i['collections']]

def listings(channelId, action, collection):
    global list_listings
    if action == "add":
        if channelId not in [l["channel"] for l in list_listings]:
            listings_object = {
                "channel": channelId,
                "collections": [collection]
            }
            list_listings.append(listings_object)
        else:
            list_listings[(getIndex(list_listings, channelId)[0]-1)]["collections"].append(collection)
    else:
        if channelId in [l["channel"] for l in list_listings]:
            list_listings = [i for i in list_listings if collection not in i['collections']]

def mints(channelId, action, collection):
    global list_mints
    if action == "add":
        if channelId not in [l["channel"] for l in list_mints]:
            mints_object = {
                "channel": channelId,
                "collections": [collection]
            }
            list_mints.append(mints_object)
        else:
            list_mints[(getIndex(list_mints, channelId)[0]-1)]["collections"].append(collection)
    else:
        if channelId in [l["channel"] for l in list_mints]:
            list_mints = [i for i in list_mints if collection not in i['collections']]

def getIdentifierFromTransaction(list_operations):
    return next((item for item in list_operations if item['type'] == "nft"), None)

def getListFromDecoded(stringa):
    lista = stringa.split(b";")
    lista.pop(0)
    for index, item in enumerate(lista):
        ind = item.find(b":")
        lista[index] = "**"+item[:ind+1].decode('utf-8')+"**"+item[ind:].decode('utf-8')
    return lista

def getIndex(lista, channelId):
    return [index for index, l in enumerate(lista) if l["channel"] == channelId]

@tasks.loop(seconds = 15)
async def startOp():
    await startSales()
    await startListings()
    await startMints()

async def startSales():
    global lastTxHashSales
    reversed_list = []
    list_attributes = []
    async with aiohttp.ClientSession() as session:
        async with session.get(url="https://api.multiversx.com/transactions?size=5&status=success&function=buy", headers={'accept': 'application/json'}) as resp:
            first5Sales = await resp.json()
            firstTxHash = first5Sales[0]["txHash"]
        if firstTxHash != lastTxHashSales:
            for sale_transaction in first5Sales:
                if sale_transaction["txHash"] != lastTxHashSales:
                    reversed_list.append(sale_transaction)
                else:
                    break
        if reversed_list != []:
            for item in reversed(reversed_list):
                async with session.get(url="https://api.multiversx.com/transactions/"+item["txHash"], headers={'accept': 'application/json'}) as resp:
                    transaction = await resp.json()
                    if "operations" in transaction:
                        transaction_nft_url = getIdentifierFromTransaction(transaction["operations"])
                        if transaction_nft_url != None:
                            if "identifier" in transaction_nft_url:
                                async with session.get(url="https://api.multiversx.com/nfts/"+transaction_nft_url["identifier"], headers={'accept': 'application/json'}) as resp:
                                    transaction_nft = await resp.json()
                                    if "identifier" in transaction_nft:
                                        collection_id = transaction_nft["identifier"]
                                        link = "https://api.multiversx.com/nfts/"+transaction_nft["identifier"]
                                        name = transaction_nft["name"]
                                        collection = transaction_nft["collection"]
                                        if "attributes" in transaction_nft:
                                            decode_string = base64.b64decode(transaction_nft["attributes"])
                                            list_attributes = getListFromDecoded(decode_string)
                                        if "metadata" in transaction_nft:
                                            if "attributes" in transaction_nft["metadata"]:
                                                attributes = transaction_nft["metadata"]["attributes"]
                                                if attributes != []:
                                                    list_attributes = [str("**"+str(d["trait_type"])+":** "+str(d["value"])) for d in attributes]
                                        if "url" in transaction_nft:
                                            image = transaction_nft["url"]
                                        else:
                                            image = transaction_nft["media"][0]["url"]
                                        if "receiverAssets" in item: 
                                            if item["receiverAssets"]["name"] == "XOXNO: Marketplace":
                                                link = "https://xoxno.com/nft/" + collection_id
                                            if item["receiverAssets"]["name"] == "Frame It: Marketplace":
                                                link = "https://www.frameit.gg/marketplace/nft/" + collection_id
                                            if item["receiver"] == "erd1qqqqqqqqqqqqqpgqd9rvv2n378e27jcts8vfwynpx0gfl5ufz6hqhfy0u0":
                                                link = "https://deadrare.io/nft/"+collection_id
                                            # if item["receiver"] == "erd1qqqqqqqqqqqqqpgq8xwzu82v8ex3h4ayl5lsvxqxnhecpwyvwe0sf2qj4e":
                                            #     link = "https://deadrare.io/nft/"+collection_id
                                        receiver = "["+item["receiver"][:3] + "..." + item["receiver"][len(item["receiver"])-3:]+"](https://explorer.multiversx.com/accounts/"+item["receiver"]+")"
                                        sender = "["+item["sender"][:3] + "..." + item["sender"][len(item["sender"])-3:]+"](https://explorer.multiversx.com/accounts/"+item["sender"]+")"
                                        transaction_price = str(float(item["value"])/1000000000000000000)
                                        if list_attributes == []:
                                            messaggio = "**Name:** "+name+"\n**Collection:** "+collection+"\n**Price:** "+transaction_price+" EGLD\n**Sender:** **"+sender+"**\n**Receiver:** **"+receiver+"**\n\n"
                                        else:
                                            messaggio = "**Name:** "+name+"\n**Collection:** "+collection+"\n**Price:** "+transaction_price+" EGLD\n**Sender:** **"+sender+"**\n**Receiver:** **"+receiver+"**\n\n__**Attributes:**__\n"+'\n'.join(list_attributes)
                                        for sale in list_sales:
                                            channel = client.get_channel(int(sale["channel"]))
                                            embedVar = discord.Embed(title="NEW SALE! 🛒", description=messaggio, color=0x00ff00)
                                            embedVar.set_image(url=image)
                                            embedVar.set_footer(text="Developed by Ziken Labs, 2023", icon_url="https://media.discordapp.net/attachments/1067014388403404840/1067014712585363466/Logo_128.png")
                                            view=Buttons()
                                            view.add_item(discord.ui.Button(label="View Tx",style=discord.ButtonStyle.link,url="https://explorer.multiversx.com/transactions/"+item["txHash"]))
                                            view.add_item(discord.ui.Button(label="View NFT",style=discord.ButtonStyle.link,url=link))
                                            if collection in sale["collections"]:
                                                await channel.send(embed=embedVar, view=view)
            lastTxHashSales = firstTxHash

async def startListings():
    global lastTxHashListings
    reversed_list = []
    list_attributes = []
    transaction_price_usd = None
    transaction_price_egld = "0.00"
    async with aiohttp.ClientSession() as session:
        async with session.get(url="https://api.multiversx.com/transactions?size=5&status=success&function=listing", headers={'accept': 'application/json'}) as resp:
            first5Listings = await resp.json()
            firstTxHash = first5Listings[0]["txHash"]
        if firstTxHash != lastTxHashListings:
            for listing_transaction in first5Listings:
                if listing_transaction["txHash"] != lastTxHashListings:
                    reversed_list.append(listing_transaction)
                else:
                    break
        if reversed_list != []:
            for item in reversed(reversed_list):
                if "transfer" in item["action"]["arguments"]:
                    for transfer in item["action"]["arguments"]["transfer"]:
                        if transfer["type"] == "NonFungibleESDT":
                            name = transfer["name"]
                            collection = transfer["collection"]
                            collection_id = transfer["identifier"]
                            link = "https://api.multiversx.com/nfts/"+collection_id
                            async with session.get(url="https://proxy-api.xoxno.com/nfts/"+collection_id) as resp:
                                transaction_price = await resp.json()
                                if "saleInfoNft" in transaction_price and transaction_price["saleInfoNft"] != None :
                                    if "usd" in transaction_price["saleInfoNft"] :
                                        transaction_price_usd = transaction_price["saleInfoNft"]["usd"]
                                if "nftValue" in transaction_price and transaction_price["nftValue"] != None:
                                    if "floorValue" in transaction_price["nftValue"]:
                                        transaction_price_egld = transaction_price["nftValue"]["floorValue"]
                            async with session.get(url="https://api.multiversx.com/nfts/"+collection_id, headers={'accept': 'application/json'}) as resp:
                                price_and_attributes_response = await resp.json()
                                if "attributes" in price_and_attributes_response:
                                    decode_string = base64.b64decode(price_and_attributes_response["attributes"])
                                    list_attributes = getListFromDecoded(decode_string)
                                if "metadata" in price_and_attributes_response:
                                    if "attributes" in price_and_attributes_response["metadata"]:
                                        attributes = price_and_attributes_response["metadata"]["attributes"]
                                        if attributes != []:
                                            list_attributes = [str("**"+str(d["trait_type"])+":** "+str(d["value"])) for d in attributes]
                            async with session.get(url="https://api.multiversx.com/nfts/"+collection_id, headers={'accept': 'application/json'}) as resp:
                                image_response = await resp.json()
                                if "url" in image_response:
                                    image = image_response["url"]
                                else:
                                    image = image_response["media"][0]["url"]
                            if "arguments" in item["action"]:
                                if "receiverAssets" in item["action"]["arguments"]: 
                                    if item["action"]["arguments"]["receiverAssets"]["name"] == "XOXNO: Marketplace":
                                        link = "https://xoxno.com/nft/" + collection_id
                                    if item["action"]["arguments"]["receiverAssets"]["name"] == "Frame It: Marketplace":
                                        link = "https://www.frameit.gg/marketplace/nft/" + collection_id
                                    if item["receiver"] == "erd1qqqqqqqqqqqqqpgqd9rvv2n378e27jcts8vfwynpx0gfl5ufz6hqhfy0u0":
                                        link = "https://deadrare.io/nft/"+collection_id
                                    # if item["receiver"] == "erd1qqqqqqqqqqqqqpgq8xwzu82v8ex3h4ayl5lsvxqxnhecpwyvwe0sf2qj4e":
                                    #     link = "https://deadrare.io/nft/"+collection_id
                            if list_attributes != []:
                                messaggio = "**Name:** "+name+"\n**Collection:** "+collection+"\n**Price:** "+str(transaction_price_egld)+" EGLD\n\n__**Attributes:**__\n"+'\n'.join(list_attributes)
                            else:
                                if transaction_price_usd != None:
                                    messaggio = "**Name:** "+name+"\n**Collection:** "+collection+"\n**Price:** "+str(transaction_price_egld)+" EGLD ($"+transaction_price_usd+")\n\n"
                                else:
                                    messaggio = "**Name:** "+name+"\n**Collection:** "+collection+"\n**Price:** "+str(transaction_price_egld)+" EGLD\n\n"
                            for listing in list_listings:
                                channel = client.get_channel(int(listing["channel"]))
                                embedVar = discord.Embed(title="NEW LISTING! 🛒", description=messaggio, color=0x00ff00)
                                embedVar.set_image(url=image)
                                embedVar.set_footer(text="Developed by ZikenLabs, 2023", icon_url="https://media.discordapp.net/attachments/1067014388403404840/1067014712585363466/Logo_128.png")
                                view=Buttons()
                                view.add_item(discord.ui.Button(label="View Tx",style=discord.ButtonStyle.link,url="https://explorer.multiversx.com/transactions/"+item["txHash"]))
                                view.add_item(discord.ui.Button(label="View NFT",style=discord.ButtonStyle.link,url=link))
                                if collection in listing["collections"]:
                                    await channel.send(embed=embedVar, view=view)
                lastTxHashListings = firstTxHash

async def startMints():
    global lastTxHashMints
    reversed_list = []
    list_attributes = []
    async with aiohttp.ClientSession() as session:
        async with session.get(url="https://api.multiversx.com/transactions?size=5&status=success&function=mint", headers={'accept': 'application/json'}) as resp:
            first5Mints = await resp.json()
            firstTxHash = first5Mints[0]["txHash"]
        if firstTxHash != lastTxHashMints:
            for mint_transaction in first5Mints:
                if mint_transaction["txHash"] != lastTxHashMints:
                    reversed_list.append(mint_transaction)
                else:
                    break
        if reversed_list != []:
            for item in reversed(reversed_list):
                async with session.get(url="https://api.multiversx.com/transactions/"+item["txHash"], headers={'accept': 'application/json'}) as resp:
                    transaction = await resp.json()
                    transaction_nft = getIdentifierFromTransaction(transaction["operations"])
                    if transaction_nft != None:
                        if "identifier" in transaction_nft:
                            async with session.get(url="https://api.multiversx.com/nfts/"+transaction_nft["identifier"], headers={'accept': 'application/json'}) as resp:
                                transaction_nft = await resp.json()
                                collection_id = transaction_nft["identifier"]
                            link = "https://api.multiversx.com/nfts/"+transaction_nft["identifier"]
                            name = transaction_nft["name"]
                            collection = transaction_nft["collection"]
                            if "attributes" in transaction_nft:
                                decode_string = base64.b64decode(transaction_nft["attributes"])
                                list_attributes = getListFromDecoded(decode_string)
                            if "metadata" in transaction_nft:
                                if "attributes" in transaction_nft["metadata"]:
                                    attributes = transaction_nft["metadata"]["attributes"]
                                    if attributes != []:
                                        list_attributes = [str("**"+str(d["trait_type"])+":** "+str(d["value"])) for d in attributes]
                            if "url" in transaction_nft:
                                image = transaction_nft["url"]
                            else:
                                image = transaction_nft["media"][0]["url"]
                            if "receiverAssets" in item: 
                                if item["receiverAssets"]["name"] == "XOXNO: Marketplace":
                                    link = "https://xoxno.com/nft/" + collection_id
                                if item["receiverAssets"]["name"] == "Frame It: Marketplace":
                                    link = "https://www.frameit.gg/marketplace/nft/" + collection_id
                                if item["receiver"] == "erd1qqqqqqqqqqqqqpgqd9rvv2n378e27jcts8vfwynpx0gfl5ufz6hqhfy0u0":
                                    link = "https://deadrare.io/nft/"+collection_id
                                # if item["receiver"] == "erd1qqqqqqqqqqqqqpgq8xwzu82v8ex3h4ayl5lsvxqxnhecpwyvwe0sf2qj4e":
                                #     link = "https://deadrare.io/nft/"+collection_id
                            receiver = "["+item["receiver"][:3] + "..." + item["receiver"][len(item["receiver"])-3:]+"](https://explorer.multiversx.com/accounts/"+item["receiver"]+")"
                            sender = "["+item["sender"][:3] + "..." + item["sender"][len(item["sender"])-3:]+"](https://explorer.multiversx.com/accounts/"+item["sender"]+")"
                            transaction_price = str(float(item["value"])/1000000000000000000)
                            if list_attributes == []:
                                messaggio = "**Name:** "+name+"\n**Collection:** "+collection+"\n**Price:** "+transaction_price+" EGLD\n**Sender:** **"+sender+"**\n**Receiver:** **"+receiver+"**\n\n"
                            else:
                                messaggio = "**Name:** "+name+"\n**Collection:** "+collection+"\n**Price:** "+transaction_price+" EGLD\n**Sender:** **"+sender+"**\n**Receiver:** **"+receiver+"**\n\n__**Attributes:**__\n"+'\n'.join(list_attributes)
                            for mint in list_mints:
                                channel = client.get_channel(int(mint["channel"]))
                                embedVar = discord.Embed(title="NEW MINT! 🛒", description=messaggio, color=0x00ff00)
                                embedVar.set_image(url=image)
                                embedVar.set_footer(text="Developed by ZikenLabs, 2023", icon_url="https://media.discordapp.net/attachments/1067014388403404840/1067014712585363466/Logo_128.png")
                                view=Buttons()
                                view.add_item(discord.ui.Button(label="View Tx",style=discord.ButtonStyle.link,url="https://explorer.multiversx.com/transactions/"+item["txHash"]))
                                view.add_item(discord.ui.Button(label="View NFT",style=discord.ButtonStyle.link,url=link))
                                if collection in mint["collections"]:
                                    await channel.send(embed=embedVar, view=view)
            lastTxHashMints = firstTxHash



client.run(BOT_TOKEN)
