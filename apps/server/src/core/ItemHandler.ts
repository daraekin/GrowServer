import { Variant } from "growtopia.js";
import { ActionTypes } from "@growserver/const";
import type { Base } from "./Base";
import type { Peer } from "./Peer";
import type { World } from "./World";
import type { ItemDefinition } from "grow-items";

/**
 * Centralized handler for item usage logic (consumables, locks, etc.).
 * Keeps ItemActiveReq clean by delegating item-specific behavior here.
 */
export class ItemHandler {
  constructor(
    private base: Base,
    private peer: Peer,
    private world: World,
  ) {}

  /**
   * Handle consumable item usage.
   * Returns true if the item was consumed, false otherwise.
   */
  public handleConsumable(item: ItemDefinition): boolean {
    const itemId = item.id!;
    const existingItem = this.peer.searchItem(itemId);
    if (!existingItem || existingItem.amount <= 0) return false;

    switch (itemId) {
      // Growtopia items: Gems consumables
      case 112: {
        // Gems (small)
        this.peer.data.gems += 1;
        this.peer.setGems(this.peer.data.gems);
        this.peer.removeItemInven(itemId, 1);
        return true;
      }
      case 1784: {
        // World Lock (used as currency display - not consumed)
        return false;
      }

      default: {
        // Generic consumable: show message
        this.peer.send(
          Variant.from(
            "OnTalkBubble",
            this.peer.data.netID,
            `You used a ${item.name || "consumable"}!`,
            0,
            1,
          ),
        );
        this.peer.removeItemInven(itemId, 1);
        return true;
      }
    }
  }

  /**
   * Handle lock conversion logic (World Lock <-> Diamond Lock <-> Blue Gem Lock).
   * Returns true if a conversion happened.
   */
  public handleLockConversion(item: ItemDefinition): boolean {
    const itemId = item.id!;

    switch (itemId) {
      // Blue Gem Lock -> 100 Diamond Locks
      case 7188: {
        const currentDL = this.peer.searchItem(1796)?.amount ?? 0;
        if (currentDL + 100 > 200) {
          this.peer.send(
            Variant.from(
              "OnTalkBubble",
              this.peer.data.netID,
              "Whoops, you're holding too many Diamond Locks!",
              0,
              1,
            ),
          );
        } else {
          this.peer.addItemInven(1796, 100);
          this.peer.removeItemInven(7188, 1);
          this.peer.send(
            Variant.from(
              "OnTalkBubble",
              this.peer.data.netID,
              "You shattered a Blue Gem Lock into 100 Diamond Locks!",
              0,
              1,
            ),
          );
        }
        return true;
      }

      // Diamond Lock -> 100 World Locks
      case 1796: {
        const currentWL = this.peer.searchItem(242)?.amount ?? 0;
        if (currentWL + 100 > 200) {
          this.peer.send(
            Variant.from(
              "OnTalkBubble",
              this.peer.data.netID,
              "Whoops, you're holding too many World Locks!",
              0,
              1,
            ),
          );
        } else {
          this.peer.addItemInven(242, 100);
          this.peer.removeItemInven(1796, 1);
          this.peer.send(
            Variant.from(
              "OnTalkBubble",
              this.peer.data.netID,
              "You shattered a Diamond Lock into 100 World Locks!",
              0,
              1,
            ),
          );
        }
        return true;
      }

      // 100 World Locks -> 1 Diamond Lock
      case 242: {
        const wlAmount = this.peer.searchItem(242)?.amount ?? 0;
        if (wlAmount < 100) return false;

        const currentDL = this.peer.searchItem(1796)?.amount ?? 0;
        if (currentDL + 1 > 200) {
          this.peer.send(
            Variant.from(
              "OnTalkBubble",
              this.peer.data.netID,
              "Whoops, you're holding too many Diamond Locks!",
              0,
              1,
            ),
          );
        } else {
          this.peer.addItemInven(1796, 1);
          this.peer.removeItemInven(242, 100);
          this.peer.send(
            Variant.from(
              "OnTalkBubble",
              this.peer.data.netID,
              "You compressed 100 World Locks into a Diamond Lock!",
              0,
              1,
            ),
          );
        }
        return true;
      }

      // 100 Diamond Locks -> 1 Blue Gem Lock
      case 9999: {
        // Placeholder: DL compression to BGL would use a different trigger
        return false;
      }

      default:
        return false;
    }
  }

  /**
   * Route item usage based on item type.
   * Returns true if the item was handled.
   */
  public handle(item: ItemDefinition): boolean {
    if (!item || !item.type) return false;

    switch (item.type) {
      case ActionTypes.LOCK:
        return this.handleLockConversion(item);
      case ActionTypes.CONSUMABLE:
        return this.handleConsumable(item);
      default:
        return false;
    }
  }
}
