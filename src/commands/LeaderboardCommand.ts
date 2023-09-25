import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { Bot } from '../client/Client';
import { CommandHandler } from '../interfaces/Command';
import {
    generateLeaderboardComponentsRow,
    generateLeaderboardEmbed,
} from '../utils/StarboardUtils';

export const handler: CommandHandler = async (
    client: Bot,
    interaction: CommandInteraction
) => {
    const userStars = await client.database.getStarredMessagesInGuildByUsers(
        interaction.guildId!
    );
    const leaderboardEmbed = generateLeaderboardEmbed(userStars, 1);
    const pageControlRow = generateLeaderboardComponentsRow(userStars, 1);
    await interaction.reply({
        embeds: [leaderboardEmbed],
        components: [pageControlRow],
    });
};
export const builder = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription("View the server's starboard leaderboard");
export const guildOnly: boolean = true;
