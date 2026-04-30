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

export class MannequinTile extends Tile {
  public extraType = TileExtraTypes.MANNEQUIN;

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
    this.data.mannequin = {
      label:     "",
      hairColor: 0,
      hair:      0,
      shirt:     0,
      pants:     0,
      feet:      0,
      face:      0,
      hand:      0,
      back:      0,
      mask:      0,
      neck:      0,
    };

    return true;
  }

  public async onWrench(peer: Peer): Promise<boolean> {
    if (!(await super.onWrench(peer))) {
      this.onPlaceFail(peer);
      return false;
    }

    const mannequin = this.data.mannequin;
    const dialog = new DialogBuilder()
      .defaultColor("`o")
      .addLabelWithIcon("`wEdit Mannequin", this.data.fg, "big")
      .addInputBox("label", "Label", mannequin?.label || "", 100)
      .addSmallText("To dress the mannequin, place clothing items on it.")
      .addSmallText("To undress it, punch it while wearing the same clothing type.")
      .embed("tilex", this.data.x)
      .embed("tiley", this.data.y)
      .endDialog("mannequin_edit", "Cancel", "OK")
      .str();

    peer.send(Variant.from("OnDialogRequest", dialog));
    return true;
  }

  public async onDestroy(peer: Peer): Promise<void> {
    // Return all clothing items to the player who broke it
    if (this.data.mannequin) {
      const slots = [
        "hair", "shirt", "pants", "feet", "face",
        "hand", "back", "mask", "neck",
      ] as const;

      for (const slot of slots) {
        const itemId = this.data.mannequin[slot];
        if (itemId && itemId > 0) {
          if (peer.canAddItemToInv(itemId)) {
            peer.addItemInven(itemId, 1);
          }
        }
      }
    }

    await super.onDestroy(peer);
    this.data.mannequin = undefined;
  }

  public async serialize(dataBuffer: ExtendBuffer): Promise<void> {
    await super.serialize(dataBuffer);
    const mannequin = this.data.mannequin;
    const label = mannequin?.label || "";

    // Type + label + unknown_u8 + clothing slots (9 x u16) + hairColor (1 byte)
    dataBuffer.grow(1 + 2 + label.length + 1 + 18 + 1);
    dataBuffer.writeU8(this.extraType);
    dataBuffer.writeString(label);
    dataBuffer.writeU8(mannequin?.unknown_u8 ?? 0);
    dataBuffer.writeU16(mannequin?.hair ?? 0);
    dataBuffer.writeU16(mannequin?.shirt ?? 0);
    dataBuffer.writeU16(mannequin?.pants ?? 0);
    dataBuffer.writeU16(mannequin?.feet ?? 0);
    dataBuffer.writeU16(mannequin?.face ?? 0);
    dataBuffer.writeU16(mannequin?.hand ?? 0);
    dataBuffer.writeU16(mannequin?.back ?? 0);
    dataBuffer.writeU16(mannequin?.mask ?? 0);
    dataBuffer.writeU16(mannequin?.neck ?? 0);
  }
}
