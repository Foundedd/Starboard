import { DMChannel } from 'discord.js';
import { ComponentHandlerFunction } from '../interfaces/ComponentHandler';

export const handler: ComponentHandlerFunction = async (
    client,
    interaction
) => {
    const message = await interaction.update({
        content: 'Message about to be deleted...',
        fetchReply: true,
    });
    if ('delete' in message) {
        await message.delete();
    } else {
        if (!interaction.channelId) {
            throw new Error(
                `Interaction with no channel id for message with id ${message.id}`
            );
        }
        const messageChannel = await client.channels.fetch(
            interaction.channelId
        );
        if (messageChannel === null) {
            throw new Error(
                `Failed to fetch message channel for interaction to message id ${message.id}`
            );
        }
        const fetchedMessage = await (
            messageChannel as DMChannel
        ).messages.fetch(message.id);
        if (fetchedMessage) {
            fetchedMessage.delete();
        } else {
            throw new Error(`Failed to fetch message with id ${message.id}`);
        }
    }
};

export const pattern: RegExp = /^private_starboard_DELETE$/;
