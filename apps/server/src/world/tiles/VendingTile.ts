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

export class VendingTile extends Tile {
  public extraType = TileExtraTypes.VENDING_MACHINE;

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

    this.data.vending = {
      price: 0,
      item:  0
    };
    return true;
  }

  public async onPunch(peer: Peer): Promise<boolean> {
    const isPermitted = await this.world.hasTilePermission(
      peer.data.userID,
      this.data,
      LockPermission.BREAK,
    );

    // If owner/admin punches, it breaks or manages.
    if (isPermitted) {
      // Normal break logic for owner
      return await super.onPunch(peer);
    }

    // If visitor punches, show purchase dialog or info
    // But in GT, punching vending usually just shows info or does nothing if not wrenched.
    // Purchasing is usually via wrench or punch? Wrench opens buy menu if public.
    // Actually, punching a vending machine usually tries to buy if set up properly?
    // Wait, standard GT behavior: Punching a vending machine activates it (buy dialog).
    // Let's implement buy dialog on punch if configured.

    if (this.data.vending && this.data.vending.item !== 0) {
      // Open buy confirmation
      const itemInfo = this.base.items.wiki.find(i => i.id === this.data.vending!.item);
      const itemName = itemInfo?.name || "Unknown Item";

      // Check if user has enough gems/locks
      // Vending usually trades World Locks (WL). Price is usually in WLs.
      // For simplicity, let's assume price is in World Locks (ID 242) for now, or just implement basic dialog.

      peer.send(
        Variant.from(
          "OnTalkBubble",
          peer.data.netID,
          `This machine sells ${itemName} for ${this.data.vending.price} WLs.`
        )
      );
    }

    return true;
  }

  public async onWrench(peer: Peer): Promise<boolean> {
    // If owner, open configuration. If public, open buy/stock?
    // Let's assume standard owner config first.

    if (await this.world.hasTilePermission(peer.data.userID, this.data, LockPermission.FULL)) {
      const dialog = new DialogBuilder()
        .defaultColor("`o")
        .addLabelWithIcon("`wEdit Vending Machine", this.data.fg, "big")
        .addInputBox("vending_price", "Price (WL)", this.data.vending?.price?.toString() || "0", 5)
      // In a real implementation, we'd need a way to select the item ID to sell.
      // GT does this by dropping the item on the machine or selecting from inv?
      // "Drop an item here to set it" is common text.
        .addLabel("`wDrop an item on this machine to set what it sells!")
        .embed("tilex", this.data.x)
        .embed("tiley", this.data.y)
        .endDialog("vending_edit", "Cancel", "Update")
        .str();

      peer.send(Variant.from("OnDialogRequest", dialog));
    } else {
      // Visitor viewing
      if (this.data.vending && this.data.vending.item !== 0) {
        // Show buy dialog
      }
    }

    return true;
  }

  // Need to handle dropped items falling onto the machine to set the item being sold.
  // This logic is usually in World.ts handleDrop or similar.
  // But for now, let's ensure the tile structure is correct.

  public async serialize(dataBuffer: ExtendBuffer): Promise<void> {
    await super.serialize(dataBuffer);

    // Vending data serialization
    // This requires specific format matching GT protocol.
    // 4 bytes: Item ID
    // 4 bytes: Price
    // 1 byte: ? (sometimes count)
    // Structure depends on TileExtraTypes.VENDING_MACHINE implementation in client.

    dataBuffer.grow(4 + 4 + 1); // Approximation
    dataBuffer.writeU8(this.extraType);

    // This part is tricky without exact protocol specs for Vending.
    // Usually:
    // int32 itemID
    // int32 price
    // ...

    // Placeholder serialization:
    dataBuffer.writeU32(this.data.vending?.item || 0);
    dataBuffer.writeU32(this.data.vending?.price || 0);
    // dataBuffer.writeU8(0);

    return;
  }
}
