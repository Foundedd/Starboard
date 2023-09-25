import { Sequelize } from 'sequelize';
import Database from '../DatabaseObject';
import { initialize as initializeStarredMessages } from '../models/StarredMessages';
import { initialize as initializeGuildConfig } from '../models/GuildConfig';
import { initialize as initializeCustomChannels } from '../models/CustomChannels';

const params = require('../../../params.json');
const starred = require('../../../starred.json');

if (process.env.DATABASE_PATH) {
    const db = new Database(process.env.DATABASE_PATH);
    let sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: process.env.DATABASE_PATH,
    });
    let starredMessages = initializeStarredMessages(sequelize);
    let guildConfig = initializeGuildConfig(sequelize);
    let customChannels = initializeCustomChannels(sequelize);

    for (const guildId in params) {
        db.getGuildConfig(guildId).then((config) => {
            config.minimumReacts = params[guildId]['min'];
            config.sfwChannelId =
                params[guildId]['sfw'] !== '0'
                    ? params[guildId]['sfw'].toString()
                    : null;
            config.nsfwChannelId =
                params[guildId]['nsfw'] !== '0'
                    ? params[guildId]['nsfw'].toString()
                    : null;
            config.emoji = params[guildId]['emoji'].toString();
            config.isUnicode = !!params[guildId]['is_unicode'];
            void config.save();
        });
        for (const customChannel in params[guildId]['custom']) {
            for (const mappedChannelNumber in params[guildId]['custom'][
                customChannel
            ]) {
                void customChannels.create({
                    channelId:
                        params[guildId]['custom'][customChannel][
                            mappedChannelNumber
                        ],
                    starboardId: customChannel,
                    guildId: guildId,
                });
            }
        }
    }

    for (const guildId in starred) {
        for (const messageId in starred[guildId]) {
            void starredMessages.create({
                messageId: messageId,
                guildId: guildId,
                userId: starred[guildId][messageId]["author"],
                starboardMessageId: starred[guildId][messageId]["id"],
                starCount: starred[guildId][messageId]["stars"]
            })
        }
    }
    db.sync();
} else {
    console.error('DATABASE_PATH env var is not defined');
}
