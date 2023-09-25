import { MessageComponentInteraction } from 'discord.js';
import { ComponentHandlerFunction } from '../interfaces/ComponentHandler';
import { StarredMessageInstance } from '../interfaces/StarredMessages';
import {
    generateLeaderboardComponentsRow,
    generateLeaderboardEmbed,
} from '../utils/StarboardUtils';

async function updateMessageLeaderboard(
    userStars: StarredMessageInstance[],
    page: number,
    interaction: MessageComponentInteraction
): Promise<void> {
    const embed = generateLeaderboardEmbed(userStars, page);
    const pageControlRow = generateLeaderboardComponentsRow(userStars, page);
    await interaction.update({ embeds: [embed], components: [pageControlRow] });
}

export const handler: ComponentHandlerFunction = async (
    client,
    interaction
) => {
    const userStars = await client.database.getStarredMessagesInGuildByUsers(
        interaction.guildId!
    );
    const page = interaction.customId.match(pattern)![1];
    switch (page) {
        case 'FIRST':
            await updateMessageLeaderboard(userStars, 1, interaction);
            break;
        case 'LAST':
            await updateMessageLeaderboard(
                userStars,
                Math.ceil(userStars.length / 10),
                interaction
            );
            break;
        default:
            await updateMessageLeaderboard(
                userStars,
                Number.parseInt(page),
                interaction
            );
            break;
    }
};

export const pattern: RegExp = /^leaderboard_((?:FIRST|LAST)|(?:\d+))$/;
