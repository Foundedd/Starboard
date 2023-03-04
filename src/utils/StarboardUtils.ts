import { APIInteractionGuildMember } from 'discord.js/node_modules/discord-api-types/payloads/v9/_interactions/base';
import {
    GuildMember,
    MessageEmbed,
    MessageReaction,
    NewsChannel,
    Permissions,
    PermissionResolvable,
    Snowflake,
    TextChannel,
    ThreadChannel,
    Guild,
    GuildEmoji,
    MessageActionRow,
    MessageButton,
    Message,
    EmbedAuthorData,
    MessageAttachment,
    ForumChannel
} from 'discord.js';
import Database from '../database/DatabaseObject';
import { GuildConfigInstance } from '../interfaces/GuildConfig';
import { StarredMessageInstance } from '../interfaces/StarredMessages';

const STARBOARD_EMBED_COLOR: readonly [number, number, number] = [255, 172, 51];
const DEFAULT_STARBOARD_EMOJI: string = '⭐';
type StarrableChannel = TextChannel | NewsChannel | ThreadChannel | ForumChannel;

export async function findStarboardChannelForTextChannel(
    config: GuildConfigInstance,
    channel: StarrableChannel,
    database: Database
): Promise<Snowflake | null> {
    const customChannel = await database.getCustomChannel(channel.id);
    if (customChannel) {
        return customChannel.starboardId;
    }
    if (channel instanceof ThreadChannel) {
        if (channel.parent) {
            return findStarboardChannelForTextChannel(
                config,
                channel.parent,  // Uhh idk what this error means
                database
            );
        }
        return config.sfwChannelId;
    }
    return channel.nsfw
        ? config.nsfwChannelId
            ? config.nsfwChannelId
            : config.sfwChannelId
        : config.sfwChannelId;
}

export async function generateStarboardEmbed(
    reaction: MessageReaction
): Promise<MessageEmbed> {
    const message = await reaction.message.fetch();
    let embed = generateBasicStarboardEmbed(message);
    if (!reaction.emoji.id) {
        embed.setFooter(
            ` ${reaction.emoji.name} ${reaction.count} ${
                reaction.emoji.name === DEFAULT_STARBOARD_EMOJI ? 'stars' : ''
            }`
        );
    } else if (reaction.emoji.name && reaction.emoji.url) {
        embed.setFooter(
            `${reaction.count} ${reaction.emoji.name.toLowerCase()}`,
            reaction.emoji.url
        );
    }
    return embed;
}

export function generateBasicStarboardEmbed(message: Message): MessageEmbed {
    const author_data: EmbedAuthorData = {
        name: 'Starred Message', 
        iconURL: message.author.displayAvatarURL({ dynamic: true })
    };  // I'm sure you know a way to generate it in the embed but I'm too dumb

    let embed = new MessageEmbed()
        .setTitle('Content')
        .setDescription(message.content)
        .setColor(STARBOARD_EMBED_COLOR)
        .setTimestamp(message.createdTimestamp)
        .setAuthor(author_data)
        .addFields(
            { name: 'Author', value: message.author.toString(), inline: true },
            {
                name: 'Channel',
                value: message.channel.toString(),
                inline: true,
            },
            {
                name: 'Jump To Message',
                value: `[Click Me!](${message.url})`,
                inline: false,
            }
        );
    const firstAttachment = message.attachments.first();
    if (firstAttachment) {
        message.attachments.forEach(function (attachment: MessageAttachment) {
            embed.setImage(attachment.url)  // Doesn't embed on mobile but will on Desktop I think
        });
    } 
    
    return embed;
}

export function generateLeaderboardEmbed(
    leaderboard: StarredMessageInstance[],
    page: number
): MessageEmbed {
    const pageCount = Math.ceil(leaderboard.length / 10);
    if (page <= 0) {
        throw new Error('Leaderboard page number must be 1 or higher');
    } else if (page > pageCount) {
        throw new Error(
            `Leaderboard page number exceeds amount of pages (${pageCount})`
        );
    }
    const selectedUsers = leaderboard.slice((page - 1) * 10, page * 10);
    const startIndex = (page - 1) * 10 + 1;
    const { 0: userRows, 1: starRows } = selectedUsers.reduce(
        (strings, user, index) => [
            strings[0] + `${index + startIndex}. <@${user.userId}>\n`,
            strings[1] + `${user.starCount}\n`,
        ],
        ['', '']
    );
    return new MessageEmbed()
        .setTitle('Leaderboards')
        .setFooter(`Page ${page} out of ${pageCount}`)
        .setColor(STARBOARD_EMBED_COLOR)
        .addFields(
            {
                name: 'User',
                value: userRows,
                inline: true,
            },
            { name: 'Stars', value: starRows, inline: true }
        );
}

export function generateLeaderboardComponentsRow(
    leaderboard: StarredMessageInstance[],
    page: number
): MessageActionRow {
    const pageCount = Math.ceil(leaderboard.length / 10);
    if (page <= 0) {
        throw new Error('Leaderboard page number must be 1 or higher');
    } else if (page > pageCount) {
        throw new Error(
            `Leaderboard page number exceeds amount of pages (${pageCount})`
        );
    }
    return new MessageActionRow().addComponents(
        new MessageButton()
            .setEmoji('⏮')
            .setStyle('PRIMARY')
            .setCustomId('leaderboard_FIRST')
            .setDisabled(page === 1),
        new MessageButton()
            .setEmoji('◀')
            .setStyle('PRIMARY')
            .setCustomId(`leaderboard_${page - 1}`)
            .setDisabled(page === 1),
        new MessageButton()
            .setEmoji('▶')
            .setStyle('PRIMARY')
            .setCustomId(`leaderboard_${page + 1}`)
            .setDisabled(page === pageCount),
        new MessageButton()
            .setEmoji('⏭')
            .setStyle('PRIMARY')
            .setCustomId('leaderboard_LAST')
            .setDisabled(page === pageCount)
    );
}

export function hasPermissions(
    member: GuildMember | APIInteractionGuildMember,
    permissions: PermissionResolvable,
    checkAdmin?: boolean
): boolean {
    if (member instanceof GuildMember) {
        return member.permissions.has(permissions, checkAdmin);
    }
    const userPermissions = BigInt(member.permissions);
    return new Permissions(userPermissions).has(permissions, checkAdmin);
}

export async function fetchEmoteFromGuild(
    guild: Guild,
    id: Snowflake
): Promise<GuildEmoji | null> {
    try {
        return guild.emojis.fetch(id);
    } catch (error) {
        return null;
    }
}
