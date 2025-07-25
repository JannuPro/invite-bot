import { pgTable, text, integer, timestamp, boolean, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table to track invite counts and member info
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(), // Discord user ID
  username: text('username').notNull(),
  displayName: text('display_name'),
  totalInvites: integer('total_invites').default(0).notNull(),
  regularInvites: integer('regular_invites').default(0).notNull(),
  bonusInvites: integer('bonus_invites').default(0).notNull(),
  leftInvites: integer('left_invites').default(0).notNull(),
  fakeInvites: integer('fake_invites').default(0).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  accountAge: timestamp('account_age'), // When Discord account was created
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Individual invites table to track each invite
export const invites = pgTable('invites', {
  id: serial('id').primaryKey(),
  inviterId: text('inviter_id').notNull(), // Who sent the invite
  invitedUserId: text('invited_user_id').notNull(), // Who was invited
  invitedUsername: text('invited_username').notNull(),
  inviteCode: text('invite_code'), // Discord invite code used
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  leftAt: timestamp('left_at'), // When user left (if they left)
  isValid: boolean('is_valid').default(true).notNull(), // False if account too new or fake
  isLeft: boolean('is_left').default(false).notNull(),
});

// Guild configuration for invite rewards
export const guildConfig = pgTable('guild_config', {
  id: serial('id').primaryKey(),
  guildId: text('guild_id').notNull().unique(),
  welcomeChannelId: text('welcome_channel_id'),
  welcomeMessage: text('welcome_message'),
  minimumAccountAge: integer('minimum_account_age').default(30).notNull(), // Days
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Invite rewards/roles configuration
export const inviteRewards = pgTable('invite_rewards', {
  id: serial('id').primaryKey(),
  guildId: text('guild_id').notNull(),
  roleId: text('role_id').notNull(),
  requiredInvites: integer('required_invites').notNull(),
  roleName: text('role_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sentInvites: many(invites, { relationName: 'inviter' }),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  inviter: one(users, {
    fields: [invites.inviterId],
    references: [users.userId],
    relationName: 'inviter',
  }),
}));

export const guildConfigRelations = relations(guildConfig, ({ many }) => ({
  rewards: many(inviteRewards),
}));

export const inviteRewardsRelations = relations(inviteRewards, ({ one }) => ({
  guild: one(guildConfig, {
    fields: [inviteRewards.guildId],
    references: [guildConfig.guildId],
  }),
}));

// Types for TypeScript
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type InsertInvite = typeof invites.$inferInsert;
export type GuildConfig = typeof guildConfig.$inferSelect;
export type InsertGuildConfig = typeof guildConfig.$inferInsert;
export type InviteReward = typeof inviteRewards.$inferSelect;
export type InsertInviteReward = typeof inviteRewards.$inferInsert;