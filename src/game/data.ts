import cosmeticsData from './data/cosmetics.json';
import dialoguesData from './data/dialogues.json';
import itemsData from './data/items.json';
import questsData from './data/quests.json';
import type { CosmeticItem, DialogueNode, InventoryItem, Quest } from './types';

/** Catálogos data-driven. La UI los consume; nunca define guiones inline. */
export const quests = questsData as Quest[];
export const items = itemsData as InventoryItem[];
export const dialogues = dialoguesData as DialogueNode[];
export const cosmeticos = cosmeticsData as CosmeticItem[];

export const questById = new Map(quests.map((q) => [q.id, q]));
export const itemById = new Map(items.map((i) => [i.id, i]));
export const dialogueById = new Map(dialogues.map((d) => [d.id, d]));
export const cosmeticById = new Map(cosmeticos.map((c) => [c.id, c]));
