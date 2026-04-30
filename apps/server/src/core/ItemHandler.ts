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
      // Gems
      case 112: {
        this.peer.data.gems += 1;
        this.peer.setGems(this.peer.data.gems);
        this.peer.removeItemInven(itemId, 1);
        return true;
      }

      // Growtoken
      case 1486: {
        this.peer.send(
          Variant.from(
            "OnTalkBubble",
            this.peer.data.netID,
            "You can't use Growtokens directly. Visit the store!",
            0,
            1,
          ),
        );
        return false;
      }

      // Candy / Food items that give small XP
      case 272:   // Chocolate Block
      case 3398:  // Baked Goods
      case 3778:  // Candy Heart
      case 3776:  // Candy Cane
      case 4738:  // Super Firework
      case 3506:  // Taffy
      {
        this.peer.removeItemInven(itemId, 1);
        this.peer.addXp(5, false);
        this.peer.send(
          Variant.from(
            "OnTalkBubble",
            this.peer.data.netID,
            `Yum! You ate a ${item.name || "treat"}. +5 XP`,
            0,
            1,
          ),
        );
        return true;
      }

      // Rare candy / potions giving more XP
      case 3832:  // Birthday Cake
      case 5078:  // Legendary Orb
      {
        this.peer.removeItemInven(itemId, 1);
        this.peer.addXp(50, false);
        this.peer.send(
          Variant.from(
            "OnTalkBubble",
            this.peer.data.netID,
            `You used a ${item.name || "powerful item"}! +50 XP`,
            0,
            1,
          ),
        );
        return true;
      }

      // Ances (Ancestral) items - not consumed, used from equip
      case 1784: {
        return false;
      }

      // Surgery items (Syringe, etc.)
      case 1260: {
        // Syringe: heal effect
        this.peer.removeItemInven(itemId, 1);
        this.peer.send(
          Variant.from(
            "OnTalkBubble",
            this.peer.data.netID,
            "You feel better after using the syringe!",
            0,
            1,
          ),
        );
        this.peer.sendEffect(46); // heal particle
        return true;
      }

      // Paintable items
      case 5750:  // Paint Bucket - Red
      case 5752:  // Paint Bucket - Green
      case 5754:  // Paint Bucket - Blue
      case 5756:  // Paint Bucket - Yellow
      case 5758:  // Paint Bucket - Charcoal
      {
        this.peer.send(
          Variant.from(
            "OnTalkBubble",
            this.peer.data.netID,
            "Use paint on a paintable block!",
            0,
            1,
          ),
        );
        return false;
      }

      // Megaphone
      case 482: {
        this.peer.send(
          Variant.from(
            "OnTalkBubble",
            this.peer.data.netID,
            "Type /sb <message> to use the Super Broadcast!",
            0,
            1,
          ),
        );
        return false;
      }

      default: {
        // Generic consumable
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
