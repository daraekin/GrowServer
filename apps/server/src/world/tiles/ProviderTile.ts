import { TankPacket, Variant } from "growtopia.js";
import {
  LockPermission,
  TankTypes,
  TileExtraTypes,
  TileFlags,
} from "@growserver/const";
import type { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import type { World } from "../../core/World";
import type { TileData } from "@growserver/types";
import { ExtendBuffer, DialogBuilder } from "@growserver/utils";
import { Tile } from "../Tile";
import { ItemDefinition } from "grow-items";

// Provider items and their generation intervals (in seconds)
const PROVIDER_ITEMS: Record<number, { produces: number; interval: number; name: string }> = {
  // Science Station (id: 2000) produces Chemical (id: 1258)
  2000: { produces: 1258, interval: 300, name: "Science Station" },
  // Nurse Station (id: 4300) produces Syringe (id: 1260)
  4300: { produces: 1260, interval: 600, name: "Nurse Station" },
  // Blaster (id: 5708) produces Laser Grid (id: 5710)
  5708: { produces: 5710, interval: 600, name: "Blaster" },
  // Cooking Oven (id: 3396) produces baked goods
  3396: { produces: 3398, interval: 300, name: "Cooking Oven" },
};

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

    this.data.flags |= TileFlags.TILEEXTRA;
    this.data.provider = {
      date: 0,
    };

    return true;
  }

  public async onPunch(peer: Peer): Promise<boolean> {
    const isPermitted = await this.world.hasTilePermission(
      peer.data.userID,
      this.data,
      LockPermission.BREAK,
    );

    if (!isPermitted) {
      if (!(this.data.flags & TileFlags.PUBLIC)) {
        super.onPunchFail(peer);
        return false;
      }
    } else {
      super.applyDamage(peer, 6);

      const itemMeta = this.base.items.metadata.items.get(
        this.data.fg.toString(),
      )!;
      if (this.data.damage && this.data.damage >= itemMeta.breakHits!) {
        this.onDestroy(peer);
      }
    }

    // Check if provider is ready to harvest
    const providerConfig = PROVIDER_ITEMS[this.data.fg];
    if (providerConfig && this.data.provider) {
      const now = Date.now();
      const elapsed = now - this.data.provider.date;
      const intervalMs = providerConfig.interval * 1000;

      if (this.data.provider.date === 0) {
        // First activation: start the timer
        this.data.provider.date = now;
        peer.send(
          Variant.from(
            "OnTalkBubble",
            peer.data.netID,
            `The ${providerConfig.name} is now active! Come back in ${providerConfig.interval} seconds.`,
            0,
            1,
          ),
        );
      } else if (elapsed >= intervalMs) {
        // Ready to harvest
        const producedItem = this.base.items.metadata.items.get(
          providerConfig.produces.toString(),
        );
        if (producedItem && peer.canAddItemToInv(providerConfig.produces)) {
          peer.addItemInven(providerConfig.produces, 1);
          this.data.provider.date = now;
          peer.send(
            Variant.from(
              "OnTalkBubble",
              peer.data.netID,
              `You collected a ${producedItem.name} from the ${providerConfig.name}!`,
              0,
              1,
            ),
          );
          peer.inventory();
        } else {
          peer.send(
            Variant.from(
              "OnTalkBubble",
              peer.data.netID,
              "You don't have room for that!",
              0,
              1,
            ),
          );
        }
      } else {
        const remaining = Math.ceil((intervalMs - elapsed) / 1000);
        peer.send(
          Variant.from(
            "OnTalkBubble",
            peer.data.netID,
            `The ${providerConfig.name} isn't ready yet. ${remaining} seconds remaining.`,
            0,
            1,
          ),
        );
      }
    }

    return true;
  }

  public async onDestroy(peer: Peer): Promise<void> {
    await super.onDestroy(peer);
    this.data.provider = undefined;
  }

  public async serialize(dataBuffer: ExtendBuffer): Promise<void> {
    await super.serialize(dataBuffer);
    dataBuffer.grow(1 + 4);
    dataBuffer.writeU8(this.extraType);
    dataBuffer.writeI32(this.data.provider?.date ?? 0);
  }
}
