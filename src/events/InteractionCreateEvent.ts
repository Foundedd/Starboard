import {
    ContextMenuCommandBuilder,
    SlashCommandBuilder,
} from '@discordjs/builders';
import {
    CommandInteraction,
    ContextMenuInteraction,
    Interaction,
} from 'discord.js';
import { Bot } from '../client/Client';
import { Command } from '../interfaces/Command';
import { EventHandler } from '../interfaces/Event';
import { hasPermissions } from '../utils/StarboardUtils';

async function canRunCommand(
    client: Bot,
    interaction: CommandInteraction | ContextMenuInteraction,
    command: Command<SlashCommandBuilder | ContextMenuCommandBuilder>
): Promise<boolean> {
    if (command.guildOnly && !interaction.guild) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return false;
    } else if (command.permissions) {
        if (!interaction.member) {
            await interaction.reply({
                content: 'An error has occured during handling of the command',
                ephemeral: true,
            });
            client.logger?.error(
                `member field was null, could not perform required permission check in command ${interaction.commandName}`
            );
            return false;
        } else if (!hasPermissions(interaction.member, command.permissions)) {
            await interaction.reply({
                content: `You must have the following permissions to use this command: ${command.permissions.join(
                    ', '
                )}`,
                ephemeral: true,
            });
            return false;
        }
    }
    return true;
}

function handleCommandCall(
    command: Command<SlashCommandBuilder | ContextMenuCommandBuilder>,
    client: Bot,
    interaction: CommandInteraction | ContextMenuInteraction
): void {
    if (
        interaction.isContextMenu() &&
        command.builder instanceof ContextMenuCommandBuilder
    ) {
        (command as Command<ContextMenuCommandBuilder>).handler(
            client,
            interaction
        );
    } else if (
        interaction.isCommand() &&
        command.builder instanceof SlashCommandBuilder
    ) {
        (command as Command<SlashCommandBuilder>).handler(client, interaction);
    } else {
        throw new Error(
            `Mismatch between interaction type and command type in command ${command.builder.name}`
        );
    }
}

export const name: string = 'interactionCreate';
export const handler: EventHandler = async (
    client: Bot,
    interaction: Interaction
) => {
    if (interaction.isCommand() || interaction.isContextMenu()) {
        const command = client.getCommand(interaction.commandName);
        if (command) {
            if (await canRunCommand(client, interaction, command)) {
                try {
                    handleCommandCall(command, client, interaction);
                } catch (error) {
                    client.logger?.error(
                        `Got the following error while executing ${interaction.commandName} command: ${error}`
                    );
                    const replyFunction = interaction.replied
                        ? interaction.followUp.bind(interaction)
                        : interaction.reply.bind(interaction);
                    replyFunction({
                        content:
                            'An unknown error has occured and has been logged, please contact the developer to report this.',
                        ephemeral: true,
                    });
                }
            }
        } else {
            client.logger?.debug(
                `Ignoring unknown command with name ${interaction.commandName}`
            );
        }
    } else if (interaction.isMessageComponent()) {
        const componentHandler = client.getComponentHandler(
            interaction.customId
        );
        if (componentHandler) {
            componentHandler.handler(client, interaction).catch((error) => {
                client.logger?.error(
                    `Got the following error while handling a component with id ${interaction.customId}: ${error}`
                );
                const replyFunction = interaction.replied
                    ? interaction.followUp.bind(interaction)
                    : interaction.reply.bind(interaction);
                replyFunction({
                    content:
                        'An unknown error has occured and has been logged, please contact the developer to report this.',
                    ephemeral: true,
                });
            });
        } else {
            client.logger?.debug(
                `Ignoring unknown component with ID ${interaction.customId}`
            );
        }
    } else {
        client.logger?.debug(
            `Ignoring unknown interaction of type: ${interaction.type}`
        );
    }
};
