import { type NonEmptyObject } from "type-fest";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { TileData } from "@growserver/types";
import { World } from "../../core/World";
import { tileFrom } from "../../world/tiles";
import { LockPermission } from "@growserver/const";

export class VendingEdit {
  private world: World;
  private pos: number;
  private block: TileData;

  constructor(
    public base: Base,
    public peer: Peer,
    public action: NonEmptyObject<{
      dialog_name: string;
      tilex: string;
      tiley: string;
      itemID?: string;
      price?: string;
      stock?: string;
    }>,
  ) {
    this.world = this.peer.currentWorld()!;
    this.pos =
      parseInt(this.action.tilex) +
      parseInt(this.action.tiley) * (this.world?.data.width as number);
    this.block = this.world?.data.blocks[this.pos] as TileData;
  }

  public async execute(): Promise<void> {
    if (
      !this.action.dialog_name ||
      !this.action.tilex ||
      !this.action.tiley
    )
      return;

    if (
      !(await this.world.hasTilePermission(
        this.peer.data.userID,
        this.block,
        LockPermission.BUILD,
      )) ||
      !this.block.vending
    ) {
      return;
    }

    const itemID = parseInt(this.action.itemID || "0");
    const price = parseInt(this.action.price || "0");
    const stock = parseInt(this.action.stock || "0");

    // Validate item ID
    if (itemID > 0) {
      const itemMeta = this.base.items.metadata.items.get(itemID.toString());
      if (!itemMeta) {
        this.peer.sendTextBubble("Invalid item ID!", true);
        return;
      }
    }

    // Validate price and stock
    if (price < 0 || price > 9999) {
      this.peer.sendTextBubble("Price must be between 0 and 9999!", true);
      return;
    }
    if (stock < 0 || stock > 999) {
      this.peer.sendTextBubble("Stock must be between 0 and 999!", true);
      return;
    }

    this.block.vending.itemID = itemID;
    this.block.vending.price = price;
    this.block.vending.stock = stock;

    const vendingTile = tileFrom(this.base, this.world, this.block);
    this.world.every((p) => vendingTile.tileUpdate(p));

    await this.world.saveToCache();
    await this.world.saveToDatabase();
  }
}
