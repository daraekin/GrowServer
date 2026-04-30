import { Variant } from "growtopia.js";
import {
  LockPermission,
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

    this.data.flags |= TileFlags.TILEEXTRA;
    this.data.vending = {
      itemID: 0,
      price:  0,
      stock:  0,
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
      // Non-owner punching: attempt to buy
      if (this.data.vending && this.data.vending.itemID > 0 && this.data.vending.stock > 0) {
        return this.handleBuy(peer);
      }
      super.onPunchFail(peer);
      return false;
    }

    super.applyDamage(peer, 6);

    const itemMeta = this.base.items.metadata.items.get(
      this.data.fg.toString(),
    )!;
    if (this.data.damage && this.data.damage >= itemMeta.breakHits!) {
      this.onDestroy(peer);
    }

    return true;
  }

  private handleBuy(peer: Peer): boolean {
    if (!this.data.vending) return false;

    const { itemID, price, stock } = this.data.vending;
    if (itemID <= 0 || stock <= 0 || price <= 0) {
      peer.send(
        Variant.from(
          "OnTalkBubble",
          peer.data.netID,
          "This vending machine is empty or not configured!",
          0,
          1,
        ),
      );
      return false;
    }

    // Check if buyer has enough World Locks (242) for the price
    const buyerWL = peer.searchItem(242)?.amount ?? 0;
    if (buyerWL < price) {
      peer.send(
        Variant.from(
          "OnTalkBubble",
          peer.data.netID,
          `You need ${price} World Lock(s) to buy this! You only have ${buyerWL}.`,
          0,
          1,
        ),
      );
      return false;
    }

    if (!peer.canAddItemToInv(itemID)) {
      peer.send(
        Variant.from(
          "OnTalkBubble",
          peer.data.netID,
          "You don't have room in your inventory!",
          0,
          1,
        ),
      );
      return false;
    }

    // Execute the purchase
    peer.removeItemInven(242, price);
    peer.addItemInven(itemID, 1);
    this.data.vending.stock -= 1;

    const vendedItem = this.base.items.metadata.items.get(itemID.toString());
    peer.send(
      Variant.from(
        "OnTalkBubble",
        peer.data.netID,
        `You bought a ${vendedItem?.name ?? "item"} for ${price} World Lock(s)!`,
        0,
        1,
      ),
    );
    peer.inventory();
    return true;
  }

  public async onWrench(peer: Peer): Promise<boolean> {
    if (!(await super.onWrench(peer))) {
      this.onPlaceFail(peer);
      return false;
    }

    const vending = this.data.vending;
    const currentItem = vending?.itemID
      ? this.base.items.metadata.items.get(vending.itemID.toString())
      : null;

    const dialog = new DialogBuilder()
      .defaultColor("`o")
      .addLabelWithIcon("`wEdit Vending Machine", this.data.fg, "big")
      .addSmallText(
        currentItem
          ? `Currently selling: \`w${currentItem.name}\`\` (${vending!.stock} in stock) for ${vending!.price} WL each`
          : "No item is set for sale.",
      )
      .addInputBox("itemID", "Item ID to sell", vending?.itemID?.toString() || "0", 6)
      .addInputBox("price", "Price (World Locks)", vending?.price?.toString() || "1", 4)
      .addInputBox("stock", "Stock amount", vending?.stock?.toString() || "0", 4)
      .embed("tilex", this.data.x)
      .embed("tiley", this.data.y)
      .endDialog("vending_edit", "Cancel", "OK")
      .str();

    peer.send(Variant.from("OnDialogRequest", dialog));
    return true;
  }

  public async onDestroy(peer: Peer): Promise<void> {
    // Drop any remaining stock back
    if (this.data.vending && this.data.vending.stock > 0 && this.data.vending.itemID > 0) {
      const remaining = Math.min(this.data.vending.stock, 200);
      if (peer.canAddItemToInv(this.data.vending.itemID)) {
        peer.addItemInven(this.data.vending.itemID, remaining);
        peer.send(
          Variant.from(
            "OnConsoleMessage",
            `\`w${remaining}\`\` items returned to your inventory from the vending machine.`,
          ),
        );
      }
    }

    await super.onDestroy(peer);
    this.data.vending = undefined;
  }

  public async serialize(dataBuffer: ExtendBuffer): Promise<void> {
    await super.serialize(dataBuffer);
    dataBuffer.grow(1 + 4 + 4);
    dataBuffer.writeU8(this.extraType);
    dataBuffer.writeI32(this.data.vending?.itemID ?? 0);
    dataBuffer.writeI32(this.data.vending?.price ?? 0);
  }
}
