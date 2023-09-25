import { initialize as initializeStarredMessages } from './models/StarredMessages';
import { initialize as initializeGuildConfig } from './models/GuildConfig';
import { initialize as initializeCustomChannels } from './models/CustomChannels';
import { ModelStatic } from 'sequelize/types';
import { Sequelize } from 'sequelize';
import { Logger } from 'log4js';
import { GuildConfigInstance } from '../interfaces/GuildConfig';
import { StarredMessageInstance } from '../interfaces/StarredMessages';
import { CustomChannelInstance } from '../interfaces/CustomChannels';
import {
    Guild,
    GuildBasedChannel,
    Message,
    MessageReaction,
    Snowflake,
} from 'discord.js';
import { APIInteractionDataResolvedChannel } from 'discord.js/node_modules/discord-api-types/payloads/v9/_interactions/applicationCommands';
class Database {
    private readonly sequelize: Sequelize;
    private starredMessages: ModelStatic<StarredMessageInstance>;
    private guildConfig: ModelStatic<GuildConfigInstance>;
    private customChannels: ModelStatic<CustomChannelInstance>;

    public constructor(database_path: string, logger?: Logger) {
        this.sequelize = new Sequelize({
            dialect: 'sqlite',
            storage: database_path,
            logging: logger?.debug.bind(logger),
        });
        this.starredMessages = initializeStarredMessages(this.sequelize);
        this.guildConfig = initializeGuildConfig(this.sequelize);
        this.customChannels = initializeCustomChannels(this.sequelize);
    }

    public sync(): void {
        void this.sequelize.sync();
    }

    public async getGuildConfig(
        guildId: Snowflake
    ): Promise<GuildConfigInstance> {
        let result = await this.guildConfig.findOne({
            where: { guildId: guildId },
        });
        if (!result) {
            return this.guildConfig.create({ guildId: guildId });
        }
        return result;
    }

    public async getCustomChannel(
        channelId: Snowflake
    ): Promise<CustomChannelInstance | null> {
        return this.customChannels.findOne({
            where: { channelId: channelId },
        });
    }

    public async addCustomChannel(
        channel: GuildBasedChannel | APIInteractionDataResolvedChannel,
        starboard: GuildBasedChannel | APIInteractionDataResolvedChannel,
        guild: Guild
    ): Promise<CustomChannelInstance> {
        return this.customChannels.create({
            channelId: channel.id,
            starboardId: starboard.id,
            guildId: guild.id,
        });
    }

    public async getStarredMessage(
        messageId: Snowflake
    ): Promise<StarredMessageInstance | null> {
        return this.starredMessages.findOne({
            where: { messageId: messageId },
        });
    }

    public async addNewStarredMessage(
        reaction: MessageReaction,
        starboardMessage: Message
    ): Promise<StarredMessageInstance> {
        return this.starredMessages.create({
            messageId: reaction.message.id,
            guildId: reaction.message.guildId,
            userId: reaction.message.author ? reaction.message.author.id : null,
            starboardMessageId: starboardMessage.id,
            starCount: reaction.count,
        });
    }

    public async getStarredMessagesInGuild(
        guildId: Snowflake
    ): Promise<StarredMessageInstance[]> {
        return this.starredMessages.findAll({
            where: { guildId: guildId },
        });
    }

    public async getStarredMessagesInGuildByUsers(guildId: Snowflake) {
        return this.starredMessages.findAll({
            where: { guildId: guildId },
            attributes: [
                'userId',
                [Sequelize.fn('SUM', Sequelize.col('starCount')), 'starCount'],
            ],
            group: ['userId'],
            order: Sequelize.literal('starCount DESC'),
        });
    }
}

export default Database;
