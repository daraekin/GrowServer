import { Base } from "./Base";
import { Peer } from "./Peer";
import { World } from "./World";
import { ActionTypes, PacketTypes } from "@growserver/const";
import { Variant, TankPacket, TextPacket } from "growtopia.js";
import { ItemDefinition } from "grow-items";
import type { ItemsInfo } from "@growserver/types";
import logger from "@growserver/logger";

export class ItemHandler {
  constructor(public base: Base) {}

  public async handleItemUsage(peer: Peer, world: World, itemID: number, x: number, y: number): Promise<void> {
    const item = this.base.items.metadata.items.get(itemID.toString());
    const itemInfo = this.base.items.wiki.find(i => i.id === itemID);

    if (!item) return;

    // Check if player actually has the item
    const inventoryItem = peer.searchItem(itemID);
    if (!inventoryItem || inventoryItem.amount <= 0) return;

    // Handle generic Action Types
    switch (item.type) {
      case ActionTypes.CONSUMABLE:
        await this.handleConsumable(peer, item, itemInfo);
        break;

      case ActionTypes.CLOTHES:
        // Toggle equip/unequip
        peer.equipClothes(itemID);
        break;

      case ActionTypes.LOCK:
        await this.handleLockConversion(peer, itemID);
        break;

        // Add more ActionTypes here (GEMS, etc)
      default:
        break;
    }

    // Process 'func' strings from wiki/metadata (e.g., set_skin_color)
    if (itemInfo && itemInfo.func) {
      // This is usually handled on equip, but some items might have immediate effects on use
      // Parsing logic can go here if needed for single-use items
    }
  }

  private async handleConsumable(peer: Peer, item: ItemDefinition, itemInfo: ItemsInfo | undefined): Promise<void> {
    // Basic consumable logic: remove 1, apply effect
    // item.id is number, type definition says so. If lint complains, we check.
    peer.removeItemInven(item.id as number, 1);

    // Play eating sound/animation
    peer.send(
      TextPacket.from(PacketTypes.ACTION, "action|play_sfx", "file|audio/eat.wav", "delayMS|0")
    );

    // Apply mods or effects defined in itemInfo
    // Example: parsing description or specific properties if available
    // For now, let's look at `func` if it exists for consumables

    // Send message
    peer.send(
      Variant.from("OnConsoleMessage", `You used ${item.name}!`)
    );

    // TODO: Add specific logic for food (health), potions (mods), etc.
    // This requires parsing the item info more deeply.
  }

  private async handleLockConversion(peer: Peer, itemID: number): Promise<void> {
    // Logic moved from ItemActiveReq.ts
    switch (itemID) {
      case 7188: { // Blue Gem Lock -> 100 DL
        if ((peer.searchItem(1796)?.amount || 0) + 100 > 200) {
          peer.sendTextBubble("Whoops, you're holding too many Diamond Locks!", true);
        } else {
          peer.addItemInven(1796, 100);
          peer.removeItemInven(7188, 1);
          peer.sendTextBubble("You shattered a Blue Gem Lock into 100 Diamond Locks!", true);
        }
        break;
      }
      case 1796: { // DL -> 100 WL
        if ((peer.searchItem(242)?.amount || 0) + 100 > 200) {
          peer.sendTextBubble("Whoops, you're holding too many World Locks!", true);
        } else {
          peer.addItemInven(242, 100);
          peer.removeItemInven(1796, 1);
          peer.sendTextBubble("You shattered a Diamond Lock into 100 World Locks!", true);
        }
        break;
      }
      case 242: { // 100 WL -> DL
        if ((peer.searchItem(242)?.amount || 0) < 100) return;
        if ((peer.searchItem(1796)?.amount || 0) + 1 > 200) {
          peer.sendTextBubble("Whoops, you're holding too many Diamond Locks!", true);
        } else {
          peer.addItemInven(1796, 1);
          peer.removeItemInven(242, 100);
          peer.sendTextBubble("You compressed 100 World Locks into a Diamond Lock!", true);
        }
        break;
      }
    }
  }
}
