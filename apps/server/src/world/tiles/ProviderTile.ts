import { TankPacket, Variant, TextPacket } from "growtopia.js";
import {
  LockPermission,
  TankTypes,
  TileExtraTypes,
  TileFlags,
  PacketTypes
} from "@growserver/const";
import type { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import type { World } from "../../core/World";
import type { TileData } from "@growserver/types";
import { ExtendBuffer } from "@growserver/utils";
import { Tile } from "../Tile";
import { ItemDefinition } from "grow-items";

export class ProviderTile extends Tile {
  public extraType = TileExtraTypes.PROVIDER;

  constructor(
    public base: Base,
    public world: World,
    public block: TileData,
  ) {
    super(base, world, block);
  }

  public async onPlaceForeground(
    peer: Peer,
    itemMeta: ItemDefinition,
  ): Promise<boolean> {
    if (!(await super.onPlaceForeground(peer, itemMeta))) return false;

    // Set initial date to now or future based on provider type?
    // Usually providers are ready immediately or after delay upon placement.
    this.data.provider = {
      date: Date.now() / 1000 // Seconds
    };
    return true;
  }

  public async onPunch(peer: Peer): Promise<boolean> {
    // If owner wrenches, open dialog? No, Providers usually just give items.

    // Check if ready
    const now = Date.now() / 1000;
    const readyAt = this.data.provider?.date || 0;

    // Get item info to know cooldown and reward
    const itemMeta = this.base.items.metadata.items.get(this.data.fg.toString());
    const itemInfo = this.base.items.wiki.find(i => i.id === this.data.fg);

    // Harvest logic
    // We need to know:
    // 1. Reward Item ID (Usually defined in grow-items metadata 'seedDrop' or similar property for providers?)
    //    Actually, for Provider tiles (like Cow, Science Station), the output is specific.
    //    Cow -> Milk, Chicken -> Egg.
    //    If metadata doesn't have it, we might need a lookup table.

    // 2. Cooldown time.

    // Placeholder logic for generic provider
    // Assuming 30 minutes cooldown (1800s)
    const cooldown = 1800;

    if (now >= readyAt) {
      // Harvest!
      // Determine drop
      let dropID = 0;
      const amount = 1;

      // Manual mapping for common providers if metadata is missing
      switch (this.data.fg) {
        case 4562: { // Science Station
          // Random chemical?
          const chems = [920, 922, 924, 926, 928];
          dropID = chems[Math.floor(Math.random() * chems.length)];
          break;
        }
        case 3004: { // ATM
          dropID = 242; // World Lock (just kidding, usually gems or specific item)
          // Actually ATM gives gems directly.
          peer.setGems(peer.data.gems + 50); // Give 50 gems
          peer.sendConsoleMessage("You withdrew 50 gems!");
          dropID = 0; // No item drop
          break;
        }
        case 10: { // Chicken (Example ID)
          dropID = 88; // Egg (Example ID)
          break;
        }
        // Add more providers here
        default: {
          // Try to guess from metadata or default to something
          break;
        }
      }

      if (dropID > 0) {
        if (peer.canAddItemToInv(dropID, amount)) {
          peer.addItemInven(dropID, amount);
          peer.sendTextBubble("Harvested!", false);
          peer.send(TextPacket.from(PacketTypes.ACTION, "action|play_sfx", "file|audio/grab.wav", "delayMS|0"));
        } else {
          peer.sendTextBubble("Inventory full!", false);
          return true; // Don't reset time if full
        }
      }

      // Reset timer
      this.data.provider!.date = now + cooldown;

      // Send tile update to show empty state if applicable
      // Some providers change visual state (animating vs non-animating)
      // This usually handled by the client based on the 'date' sent in serialization.

      // Update client
      const tankPkt = new TankPacket({
        type:   TankTypes.SEND_TILE_UPDATE_DATA,
        xPunch: this.data.x,
        yPunch: this.data.y,
        netID:  peer.data.netID
      });
        // We need to send the extra data payload with the packet
        // But Tile.ts or World.ts usually handles sending the update packet with serialization.
        // Let's trigger a full tile update for this block.
      this.world.every(p => {
        // We can construct a packet that includes the new serialized data
        // Or just let the world logic handle it.
        // For now, let's just save.
      });

      // Actually, to update the visual state of the provider (ready/not ready), we must send the updated tile data.
      const tile = tileFrom(this.base, this.world, this.block);
      const buf = await tile.parse();
      // Send this buffer as SEND_TILE_UPDATE_DATA
      // ... (Reusing existing logic if possible, or manual send)

    } else {
      peer.sendTextBubble("Not ready yet!", false);
    }

    return true;
  }

  public async serialize(dataBuffer: ExtendBuffer): Promise<void> {
    await super.serialize(dataBuffer);

    // Provider serialization
    // int32: time remaining or target time?
    // GT usually sends: (int32) time_since_epoch_seconds

    dataBuffer.grow(4 + 2); // Type + Int32
    dataBuffer.writeU8(this.extraType);
    dataBuffer.writeU32(this.data.provider?.date || 0);
    // Sometimes there's 1-2 bytes padding or state?

    return;
  }
}

// Import helper to avoid circular dependency issues if possible, or rely on index.ts import at runtime
import { tileFrom } from "./index";
