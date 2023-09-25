import { MessageComponentInteraction } from "discord.js";
import { Bot } from "../client/Client";

export interface ComponentHandlerFunction {
    (client: Bot, interaction: MessageComponentInteraction): Promise<void>;
}

export interface ComponentHandler {
    handler: ComponentHandlerFunction;
    pattern: RegExp;
}