import {
    SlashCommandBuilder,
    SlashCommandChannelOption,
    SlashCommandNumberOption,
    SlashCommandStringOption,
    SlashCommandSubcommandBuilder,
    SlashCommandSubcommandGroupBuilder,
} from '@discordjs/builders';
import { CommandInteraction, PermissionString } from 'discord.js';
import { Bot } from '../client/Client';
import { CommandHandler } from '../interfaces/Command';
import { GuildConfigInstance } from '../interfaces/GuildConfig';
import { fetchEmoteFromGuild } from '../utils/StarboardUtils';

const EMOJI_REGEX = /\p{Extended_Pictographic}/giu;
const DISCORD_EMOTE_REGEX = /<:.+:(\d+)>/i;
const CONFIG_OPTION_MAP: Map<string, ConfigCommandOptionHandler> = new Map([
    ['emote', modifyStarboardEmote],
    ['minimum', modifyStarboardMinimum],
    ['sfw', modifyStarboardSFW],
    ['nsfw', modifyStarboardNSFW],
]);

interface ConfigCommandOptionHandler {
    (
        interaction: CommandInteraction,
        config: GuildConfigInstance
    ): Promise<string>;
}

async function sendUnknownCommandError(
    interaction: CommandInteraction
): Promise<void> {
    await interaction.reply({
        content: 'Error: Unknown Command',
        ephemeral: true,
    });
}

async function handleCustomStarboardCommandGroup(
    client: Bot,
    interaction: CommandInteraction
): Promise<void> {
    switch (interaction.options.getSubcommand(false)) {
        case 'add':
            const customStarboard = interaction.options.getChannel('starboard');
            const target = interaction.options.getChannel('target');
            if (!customStarboard || !target) {
                await interaction.reply({
                    content: 'Error fetching one or more arguments',
                    ephemeral: true,
                });
                break;
            }
            await client.database.addCustomChannel(
                target,
                customStarboard,
                interaction.guild!
            );
            await interaction.reply({
                content: `Succesfully added override from starred messages in ${target} to ${customStarboard}`,
                ephemeral: true,
            });
            break;
        case 'remove':
            const channel = interaction.options.getChannel('channel');
            if (!channel) {
                await interaction.reply({
                    content: 'Error fetching channel argument',
                    ephemeral: true,
                });
                break;
            }
            (await client.database.getCustomChannel(channel.id))?.destroy();
            await interaction.reply({
                content: `Succesfully removed override from starred messages in ${channel}`,
                ephemeral: true,
            });
            break;
        default:
            await sendUnknownCommandError(interaction);
            break;
    }
}

async function modifyStarboardEmote(
    interaction: CommandInteraction,
    config: GuildConfigInstance
): Promise<string> {
    const emote = interaction.options.getString('emote', false);
    if (!emote) {
        return 'Emote argument is not a string';
    }
    const emojiMatch = emote.match(EMOJI_REGEX);
    if (emojiMatch) {
        if (emojiMatch.length > 1) {
            return `Too many emoji in emote argument`;
        }
        config.emoji = emojiMatch[0];
        config.isUnicode = true;
        return `Starboard emote set to ${config.emoji} succesfully`;
    }
    const emoteMatch = emote.match(DISCORD_EMOTE_REGEX);
    if (!emoteMatch) {
        return 'Emote argument is not a valid emote';
    }
    const guildEmoji = await fetchEmoteFromGuild(
        interaction.guild!,
        emoteMatch[1]
    );
    if (!guildEmoji) {
        return 'Emote argument must be an emote from this server or a default one';
    }
    config.emoji = guildEmoji.id;
    config.isUnicode = false;
    return `Starboard emote set to ${guildEmoji}`;
}

async function modifyStarboardMinimum(
    interaction: CommandInteraction,
    config: GuildConfigInstance
): Promise<string> {
    const minimum = interaction.options.getNumber('minimum', false);
    if (!minimum) {
        return 'Minimum argument is not a number';
    }
    if (minimum < 1) {
        return 'Minimum must be at least 1';
    }
    config.minimumReacts = minimum;
    return `Minimum reactions set to ${config.minimumReacts}`;
}

async function modifyStarboardSFW(
    interaction: CommandInteraction,
    config: GuildConfigInstance
): Promise<string> {
    const sfw = interaction.options.getChannel('sfw', false);
    if (!sfw) {
        return 'SFW argument is not a channel';
    }
    config.sfwChannelId = sfw.id;
    return `SFW Starboard Channel set to ${sfw}`;
}

async function modifyStarboardNSFW(
    interaction: CommandInteraction,
    config: GuildConfigInstance
): Promise<string> {
    const sfw = interaction.options.getChannel('nsfw', false);
    if (!sfw) {
        return 'NSFW argument is not a channel';
    }
    config.nsfwChannelId = sfw.id;
    return `NSFW Starboard Channel set to ${sfw}`;
}

async function handleServerConfigurationSubcommand(
    interaction: CommandInteraction,
    client: Bot
): Promise<void> {
    const subCommand = interaction.options.data.find(
        (argument) => argument.type === 'SUB_COMMAND'
    );
    if (!subCommand) {
        interaction.reply({
            content: 'Invalid command arguments',
            ephemeral: true,
        });
        return;
    }
    const args = subCommand.options;
    if (!args || args.length === 0) {
        interaction.reply({
            content: 'You must provide at least one configuration argument',
            ephemeral: true,
        });
    } else {
        let guildConfig = await client.database.getGuildConfig(
            interaction.guildId!
        );
        const reply = (
            await Promise.all(
                args.map(async (option) => {
                    const optionHandler = CONFIG_OPTION_MAP.get(option.name);
                    if (!optionHandler) {
                        return `Unknown configuration option: ${option.name}`;
                    }
                    return optionHandler(interaction, guildConfig);
                })
            )
        ).join('\n');
        guildConfig.save();
        interaction.reply({ content: reply, ephemeral: true });
    }
}

async function handleDefaultCommandGroup(
    client: Bot,
    interaction: CommandInteraction
): Promise<void> {
    const subCommand = interaction.options.getSubcommand(false);
    switch (subCommand) {
        case 'server':
            handleServerConfigurationSubcommand(interaction, client);
            break;
        default:
            sendUnknownCommandError(interaction);
            break;
    }
}

export const handler: CommandHandler = async (
    client: Bot,
    interaction: CommandInteraction
) => {
    switch (interaction.options.getSubcommandGroup(false)) {
        case 'custom':
            await handleCustomStarboardCommandGroup(client, interaction);
            break;
        default:
            await handleDefaultCommandGroup(client, interaction);
            break;
    }
};
export const builder = new SlashCommandBuilder()
    .setName('config')
    .setDescription('Modify the configuration of Starboard')
    .addSubcommand(
        new SlashCommandSubcommandBuilder()
            .setName('server')
            .setDescription('Modify general server configuration options')
            .addStringOption(
                new SlashCommandStringOption()
                    .setName('emote')
                    .setDescription(
                        'The emote users will use to star messages with Starboard'
                    )
            )
            .addNumberOption(
                new SlashCommandNumberOption()
                    .setName('minimum')
                    .setDescription(
                        'The minimum reactions required to put a message on the Starboard'
                    )
            )
            .addChannelOption(
                new SlashCommandChannelOption()
                    .setName('sfw')
                    .setDescription(
                        'The default channel all starred SFW messages will be posted to'
                    )
            )
            .addChannelOption(
                new SlashCommandChannelOption()
                    .setName('nsfw')
                    .setDescription(
                        'The default channel all starred NSFW messages will be posted to'
                    )
            )
    )
    .addSubcommandGroup(
        new SlashCommandSubcommandGroupBuilder()
            .setName('custom')
            .setDescription(
                'Add/Remove custom Starboard channels, besides the default SFW/NSFW ones'
            )
            .addSubcommand(
                new SlashCommandSubcommandBuilder()
                    .setName('add')
                    .setDescription('Add new custom Starboard channel override')
                    .addChannelOption(
                        new SlashCommandChannelOption()
                            .setName('starboard')
                            .setDescription(
                                'The channel to which to post starred messages'
                            )
                            .setRequired(true)
                    )
                    .addChannelOption(
                        new SlashCommandChannelOption()
                            .setName('target')
                            .setDescription(
                                'The channel whose starred messages will be posted to the custom starboard'
                            )
                            .setRequired(true)
                    )
            )
            .addSubcommand(
                new SlashCommandSubcommandBuilder()
                    .setName('remove')
                    .setDescription(
                        'Remove a custom Starboard channel override'
                    )
                    .addChannelOption(
                        new SlashCommandChannelOption()
                            .setName('channel')
                            .setDescription(
                                'The channel whose custom starboard override to remove'
                            )
                            .setRequired(true)
                    )
            )
    );
export const guildOnly: boolean = true;
export const permissions: PermissionString[] = [
    'MANAGE_GUILD',
    'MANAGE_CHANNELS',
];
