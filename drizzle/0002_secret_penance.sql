CREATE TABLE `adSpendEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` varchar(255) NOT NULL,
	`campaign` varchar(255) NOT NULL,
	`creative` varchar(255) NOT NULL,
	`spendUsd` decimal(10,2) NOT NULL DEFAULT '0.00',
	`notes` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adSpendEntries_id` PRIMARY KEY(`id`)
);
