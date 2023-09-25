import { ContextMenuCommandBuilder } from '@discordjs/builders';
import {
    ContextMenuInteraction,
    MessageActionRow,
    MessageButton,
} from 'discord.js';
import { Bot } from '../client/Client';
import { ContextMenuHandler } from '../interfaces/Command';
import { generateBasicStarboardEmbed } from '../utils/StarboardUtils';

export const handler: ContextMenuHandler = async (
    client: Bot,
    interaction: ContextMenuInteraction
) => {
    const message = await interaction.channel?.messages.fetch(
        interaction.targetId!
    );
    if (!message) {
        throw new Error(
            `Could not fetch message with id ${interaction.targetId}`
        );
    }
    const embed = generateBasicStarboardEmbed(message);
    const deleteButtonRow = new MessageActionRow().addComponents(
        new MessageButton()
            .setCustomId('private_starboard_DELETE')
            .setLabel('Delete Message')
            .setStyle('DANGER')
    );
    await interaction.user.send({ embeds: [embed], components: [deleteButtonRow] });
    await interaction.reply({
        content:
            'Message saved to personal starboard succesfully, check your DMs!',
        ephemeral: true,
    });
};
export const builder = new ContextMenuCommandBuilder()
    .setName('Save To Personal Starboard')
    .setType(3);
export const guildOnly: boolean = true;
