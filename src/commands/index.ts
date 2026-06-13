import { panelCommand } from "./panel.command.js";

export const commands = [panelCommand];

export const commandMap = new Map(
  commands.map((command) => [command.data.name, command])
);
