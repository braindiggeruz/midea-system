CREATE TABLE `automationRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`automationKey` enum('hot_24h_followup','warm_nurture','post_purchase_cross_sell','filter_renewal_reminder','reactivation_inactive') NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`status` enum('draft','active','paused','archived') NOT NULL DEFAULT 'active',
	`triggerStage` enum('ad_click','landing','bot_start','quiz_started','quiz_completed','lead_created','manager_contacted','proposal_sent','sale_closed','lost','reactivated','repeat_sale'),
	`delayMinutes` int NOT NULL DEFAULT 0,
	`targetChannel` enum('telegram','amo_crm','phone','email','internal') NOT NULL DEFAULT 'telegram',
	`templateKey` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automationRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `automationRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`automationRuleId` int NOT NULL,
	`leadId` int NOT NULL,
	`status` enum('queued','sent','skipped','failed') NOT NULL DEFAULT 'queued',
	`scheduledFor` timestamp,
	`executedAt` timestamp,
	`resultSummary` text,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `automationRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `broadcasts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`segment` enum('alba','welkin','combo','consult'),
	`status` enum('draft','scheduled','sending','sent','cancelled') NOT NULL DEFAULT 'draft',
	`body` longtext NOT NULL,
	`imageUrl` varchar(512),
	`ctaLabel` varchar(128),
	`ctaUrl` varchar(512),
	`scheduledAt` timestamp,
	`sentAt` timestamp,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `broadcasts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crmWebhookEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int,
	`amoEventId` varchar(128),
	`eventName` varchar(255) NOT NULL,
	`payloadJson` longtext NOT NULL,
	`processedAt` timestamp,
	`status` varchar(64) NOT NULL DEFAULT 'received',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crmWebhookEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leadCommunications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`channel` enum('telegram','amo_crm','phone','email','internal') NOT NULL DEFAULT 'telegram',
	`direction` enum('inbound','outbound','system') NOT NULL DEFAULT 'outbound',
	`status` enum('draft','scheduled','sent','delivered','failed') NOT NULL DEFAULT 'draft',
	`templateKey` varchar(128),
	`subject` varchar(255),
	`content` longtext NOT NULL,
	`imageUrl` varchar(512),
	`ctaLabel` varchar(128),
	`ctaUrl` varchar(512),
	`externalMessageId` varchar(255),
	`scheduledAt` timestamp,
	`sentAt` timestamp,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadCommunications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leadEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`eventType` enum('ad_click','landing_view','cta_click_to_bot','bot_start','quiz_started','quiz_answered','quiz_completed','result_assigned','lead_created','stage_changed','manager_note','manager_contacted','telegram_message_sent','telegram_message_received','broadcast_sent','automation_fired','crm_status_synced','sale_closed','referral_created','task_created','task_completed','system') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`payloadJson` longtext,
	`actorType` varchar(64) NOT NULL DEFAULT 'system',
	`actorUserId` int,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leadNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`authorUserId` int NOT NULL,
	`note` text NOT NULL,
	`isPrivate` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leadNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leadTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('todo','in_progress','done','blocked') NOT NULL DEFAULT 'todo',
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`assignedToUserId` int,
	`dueAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leadTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalLeadId` varchar(128),
	`crmLeadId` varchar(128),
	`crmContactId` varchar(128),
	`fullName` varchar(255) NOT NULL,
	`phone` varchar(64),
	`telegramUserId` bigint,
	`telegramUsername` varchar(128),
	`language` varchar(16) NOT NULL DEFAULT 'ru',
	`city` varchar(128),
	`roomType` varchar(128),
	`roomAreaSqm` int,
	`householdProfile` varchar(255),
	`painPoint` varchar(255),
	`purchaseTimeline` varchar(128),
	`productInterest` varchar(128),
	`segment` enum('alba','welkin','combo','consult') NOT NULL DEFAULT 'consult',
	`stage` enum('ad_click','landing','bot_start','quiz_started','quiz_completed','lead_created','manager_contacted','proposal_sent','sale_closed','lost','reactivated','repeat_sale') NOT NULL DEFAULT 'lead_created',
	`temperature` enum('cold','warm','hot','won','lost') NOT NULL DEFAULT 'warm',
	`statusReason` varchar(255),
	`score` int NOT NULL DEFAULT 0,
	`expectedRevenueUsd` decimal(10,2),
	`assignedManagerId` int,
	`referralCode` varchar(64),
	`referredByLeadId` int,
	`adSource` varchar(128),
	`adCampaign` varchar(255),
	`adSet` varchar(255),
	`adCreative` varchar(255),
	`landingPath` varchar(255),
	`utmSource` varchar(255),
	`utmMedium` varchar(255),
	`utmCampaign` varchar(255),
	`utmTerm` varchar(255),
	`utmContent` varchar(255),
	`lastInteractionAt` timestamp,
	`nextFollowUpAt` timestamp,
	`firstQualifiedAt` timestamp,
	`closedWonAt` timestamp,
	`lostAt` timestamp,
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizAnswers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quizSessionId` int NOT NULL,
	`leadId` int NOT NULL,
	`questionKey` varchar(128) NOT NULL,
	`questionLabel` varchar(255) NOT NULL,
	`answerValue` text NOT NULL,
	`answerOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizAnswers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`resultSegment` enum('alba','welkin','combo','consult'),
	`resultTitle` varchar(255),
	`completionRate` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quizSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referralInvites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`code` varchar(64) NOT NULL,
	`invitedLeadId` int,
	`status` enum('pending','qualified','rewarded','expired') NOT NULL DEFAULT 'pending',
	`rewardLabel` varchar(255),
	`rewardValueUsd` decimal(10,2),
	`qualifiedAt` timestamp,
	`rewardedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `referralInvites_id` PRIMARY KEY(`id`),
	CONSTRAINT `referralInvites_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','manager','admin') NOT NULL DEFAULT 'user';