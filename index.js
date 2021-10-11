const {Client, Intents, MessageEmbed, MessageActionRow, MessageButton} = require('discord.js');
const config = require('./config.json');
const intents = new Intents();
intents.add(Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS);
const client = new Client({intents: intents});
const fs = require('fs');
const path = require('path');

function jsonRead(filePath) { // stolen lmao
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf-8', (err, content) => {
      if (err) reject(err);
      else {
        try {
          resolve(JSON.parse(content));
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}
function jsonWrite(filePath, data) { // also stolen
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, JSON.stringify(data), (err) => {
      if (err) reject(err);
      resolve(true);
    });
  });
}

client.once('ready', () => {
	console.log('ready');
});

client.on('messageCreate', async message => {
    if (message.author.id != 896577979319189524 && message.channelId == 896271184902103070) { // this channel ID is currently set to a private PT channel, change to whatever
        const channel = message.channel;
        const receivedEmbed = message.embeds[0];
        message.delete()
          .then(msg => console.log(`Deleted webhook message`)) // debugging
          .catch(console.error);

        const username = receivedEmbed.title;
        const sentEmbed = new MessageEmbed(receivedEmbed).setTitle(username); // embed declarations are weird
        const mainEmbed = new MessageEmbed()
            .setTitle(username + "'s application")
            .setDescription('Upvotes: 0\nDownvotes: 0\nDelete votes: 0 of 4');
        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId('upvote')
                    .setEmoji('👍')
                    .setLabel('Upvote')
                    .setStyle('SUCCESS'),
                new MessageButton()
                    .setCustomId('downvote')
                    .setEmoji('👎')
                    .setLabel('Downvote')
                    .setStyle('SUCCESS'),
                new MessageButton()
                    .setCustomId('delete')
                    .setEmoji('🗑')
                    .setLabel('Delete app')
                    .setStyle('DANGER'),
                new MessageButton()
                    .setCustomId('revoke')
                    .setEmoji('♻')
                    .setLabel('Revoke vote')
                    .setStyle('PRIMARY'), // no idea why i need a comma here, god i hate javascript
            );
        const mainMessage = await channel.send({embeds: [mainEmbed], components: [row]});

        const thread = await channel.threads.create({
            startMessage: mainMessage,
            name: username,
            autoArchiveDuration: 10080,
            reason: 'New ProtoTech Application', // obv change this if you're using it
        });
        const threadId = thread.id;
        const appMessage = await thread.send({embeds: [sentEmbed]});
        appMessage.pin()
          .then(console.log) // debugging
          .catch(console.error);

        var fileName = mainMessage.id;
        let jsonFile = {
            threadId: threadId,
            votes: [{'user': '0', 'vote': 'revoke'}]
        };
        let data = JSON.stringify(jsonFile);
        fs.writeFileSync(`applications/${fileName}.json`, data);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    console.log(interaction); // debugging

    const fileName = interaction.message.id;
    const filePath = path.resolve(__dirname, `applications/${fileName}.json`);
    const fileContents = await jsonRead(filePath);
    const userId = interaction.user.id;
    const threadId = fileContents.threadId;

    let upvotes = 0; // combining these variable declarations breaks things and i don't know why
    let downvotes = 0;
    let deletes = 0;
    let index = 0;

    for (let i = 0; i < fileContents.votes.length; i++) {
        if (fileContents.votes[i].vote == 'upvote') upvotes++;
        else if (fileContents.votes[i].vote == 'downvote') downvotes++;
        else if (fileContents.votes[i].vote == 'delete') deletes++;

        if (fileContents.votes[i].user == userId) index = i;
    }
    if (index == 0) {
        if (interaction.customId == 'upvote') upvotes++;
        else if (interaction.customId == 'downvote') downvotes++;
        else if (interaction.customId == 'delete') deletes++;

        fileContents.votes.push({
            user: userId,
            vote: interaction.customId
        });
        jsonWrite(filePath, fileContents);
    } else if (fileContents.votes[index].vote != interaction.customId) {
        if (fileContents.votes[index].vote == 'upvote') upvotes--; // i tried re-parsing the file and just doing a recount but it broke everything
        else if (fileContents.votes[index].vote == 'downvote') downvotes--;
        else if (fileContents.votes[index].vote == 'delete') deletes--;

        if (interaction.customId == 'upvote') upvotes++;
        else if (interaction.customId == 'downvote') downvotes++;
        else if (interaction.customId == 'delete') deletes++;

        fileContents.votes[index] = {'user': userId, 'vote': interaction.customId};
        jsonWrite(filePath, fileContents);
    } else jsonWrite(filePath, fileContents);

    if (deletes < 4) {
        const embed = interaction.message.embeds[0];
        const title = embed.title;
        const newEmbed = new MessageEmbed()
            .setTitle(title)
            .setDescription('Upvotes: ' + upvotes + '\nDownvotes: ' + downvotes + '\nDelete votes: ' + deletes + ' of 4');
        const row = new MessageActionRow() // necessary to re-define because discord, it's literally the same as above
            .addComponents(
                new MessageButton()
                    .setCustomId('upvote')
                    .setEmoji('👍')
                    .setLabel('Upvote')
                    .setStyle('SUCCESS'),
                new MessageButton()
                    .setCustomId('downvote')
                    .setEmoji('👎')
                    .setLabel('Downvote')
                    .setStyle('SUCCESS'),
                new MessageButton()
                    .setCustomId('delete')
                    .setEmoji('🗑')
                    .setLabel('Delete app')
                    .setStyle('DANGER'),
                new MessageButton()
                    .setCustomId('revoke')
                    .setEmoji('♻')
                    .setLabel('Revoke vote')
                    .setStyle('PRIMARY'),
            );
        interaction.update({
            embeds: [newEmbed],
            components: [row]
        });
    } else {
        const channel = interaction.message.channel;
        const thread = channel.threads.cache.find(x => x.id == threadId);
        await thread.delete('App rejected')
            .then(deletedThread => console.log(deletedThread)) // debugging
            .catch(console.error);
        await interaction.message.delete();
    }
});

client.login(config.token);
