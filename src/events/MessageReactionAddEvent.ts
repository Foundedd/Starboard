import {
    GuildEmoji,
    MessageReaction,
    PartialMessageReaction,
    ReactionEmoji,
    TextBasedChannel,
    User,
} from 'discord.js';
import { Bot } from '../client/Client';
import { EventHandler } from '../interfaces/Event';
import { GuildConfigInstance } from '../interfaces/GuildConfig';
import { StarredMessageInstance } from '../interfaces/StarredMessages';
import {
    generateStarboardEmbed,
    findStarboardChannelForTextChannel,
} from '../utils/StarboardUtils';

const VALID_STARBOARD_CHANNEL_TYPES = [
    'GUILD_TEXT',
    'GUILD_NEWS',
    'GUILD_NEWS_THREAD',
    'GUILD_PUBLIC_THREAD',
    'GUILD_PRIVATE_THREAD',
];

function isStarEmoji(
    guildConfig: GuildConfigInstance,
    emoji: GuildEmoji | ReactionEmoji
) {
    if (!emoji.id && guildConfig.isUnicode) {
        return guildConfig.emoji === emoji.name;
    }
    return guildConfig.emoji === emoji.id;
}

async function getStarboardChannelFromChannel(
    config: GuildConfigInstance,
    channel: TextBasedChannel,
    client: Bot
): Promise<TextBasedChannel | null> {
    if (channel.type === 'DM' || channel.type == 'GUILD_VOICE') {
        throw new Error('Invalid channel for starred message');
    }
    const channelId = await findStarboardChannelForTextChannel(
        config,
        channel,
        client.database
    );
    const starboardChannel = channelId
        ? await client.channels.fetch(channelId)
        : null;
    if (!starboardChannel) {
        client.logger?.debug(
            `Starboard channel could not be fetched (id is ${channelId}), assuming intentional`
        );
    } else if (!VALID_STARBOARD_CHANNEL_TYPES.includes(starboardChannel.type)) {
        client.logger?.debug(
            `Misconfigured starboard channel (id is ${channelId}) isn't text-based`
        );
        return null;
    }
    return starboardChannel as TextBasedChannel;
}

async function starPublicMessage(
    client: Bot,
    config: GuildConfigInstance,
    reaction: MessageReaction
) {
    const starredMessage = await client.database.getStarredMessage(
        reaction.message.id
    );
    if (starredMessage) {
        await updateExistingStarredMessage(config, reaction, client, starredMessage);
    } else {
        await createNewStarredMessage(reaction, config, client);
    }
}

async function updateExistingStarredMessage(
    config: GuildConfigInstance,
    reaction: MessageReaction,
    client: Bot,
    starredMessage: StarredMessageInstance
) {
    const starboardChannel = await getStarboardChannelFromChannel(
        config,
        reaction.message.channel,
        client
    );
    if (starboardChannel) {
        try {
            let starboardMessage = await starboardChannel.messages.fetch(
                starredMessage.starboardMessageId
            );
            starboardMessage.edit({
                embeds: [await generateStarboardEmbed(reaction)],
            });
        } catch (e) {
            client.logger?.debug(
                `Could not fetch starboard message (id is ${starredMessage.starboardMessageId}), assuming intentional`
            );
        }
    }
    starredMessage.starCount = reaction.count;
    starredMessage.save();
    client.logger?.info(
        `Updated existing starred message for message with id ${starredMessage.messageId}, new star count is ${reaction.count}`
    );
}

async function createNewStarredMessage(
    reaction: MessageReaction,
    config: GuildConfigInstance,
    client: Bot
) {
    const starboardChannel = await getStarboardChannelFromChannel(
        config,
        reaction.message.channel,
        client
    );
    if (starboardChannel) {
        let starboardMessage = await (
            starboardChannel as TextBasedChannel
        ).send({ embeds: [await generateStarboardEmbed(reaction)] });
        client.database
            .addNewStarredMessage(reaction, starboardMessage)
            .then(() => {
                client.logger?.info(
                    `Created new starred message for message with id ${reaction.message.id}, star count is ${reaction.count}`
                );
            })
            .catch((e) => {
                client.logger?.error(
                    `Could not add new starred message for message with id ${reaction.message.id}`,
                    e
                );
                starboardMessage.delete();
            });
    }
}

export const name: string = 'messageReactionAdd';
export const handler: EventHandler = async (
    client: Bot,
    reaction: MessageReaction | PartialMessageReaction,
    user: User
) => {
    if (reaction.partial) {
        try {
            reaction = await reaction.fetch();
        } catch (error) {
            client.logger?.debug(
                `Could not fetch partial reaction (id is ${reaction.message.id}), potential lack of permissions, assuming intentional (error: ${error})`
            );
            return;
        }
    }
    if (reaction.message.guildId) {
        const guildConfig: GuildConfigInstance =
            await client.database.getGuildConfig(reaction.message.guildId);
        if (isStarEmoji(guildConfig, reaction.emoji)) {
            if (reaction.message.author == user) {
                reaction.users
                    .remove(user)
                    .catch((error) =>
                        client.logger?.debug(
                            `Ignoring potential permission error while attempting to remove reaction in guild with ID ${reaction.message.guildId} (error: ${error})`
                        )
                    );
            } else {
                if (reaction.count >= guildConfig.minimumReacts) {
                    starPublicMessage(client, guildConfig, reaction).catch(
                        (error) =>
                            client.logger?.debug(
                                `Ignoring potential error while attempting to star message in guild with ID ${reaction.message.guildId} (error: ${error})`
                            )
                    );
                }
            }
        }
    }
};
