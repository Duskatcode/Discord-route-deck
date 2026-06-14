import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits
} from "discord.js";

const PANEL_MANAGER_ROLE = "😈 • aÑa";

export function canManagePanels(
  interaction: ChatInputCommandInteraction
): boolean {
  const member = interaction.member;

  if (!(member instanceof GuildMember)) {
    return false;
  }

  if (
    member.permissions.has(
      PermissionFlagsBits.Administrator
    )
  ) {
    return true;
  }

  return member.roles.cache.some(
    (role) => role.name === PANEL_MANAGER_ROLE
  );
}