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

export class RouletteTile extends Tile {
  public extraType = TileExtraTypes.DICE; // Roulette uses Dice extra structure usually, or its own? GT protocol often reuses types. Let's verify.
  // Actually, standard roulette behaves like a dice but 0-36.
  // It uses the same "dice" property in TileData for storage usually.

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

    // Roulette wheel generally reuses dice structure but range is different.
    this.data.dice = {
      symbol:       0,
      lastRollTime: 0,
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
      super.onPunchFail(peer);
      if (!(this.block.flags & TileFlags.PUBLIC)) {
        return false;
      }
    } else {
      super.applyDamage(
        peer,
        6,
        new TankPacket({ punchRange: this.data.dice?.symbol }),
      );
    }

    const lastRollElapsed = Date.now() - (this.data.dice?.lastRollTime || 0);

    // Roulette needs some time to spin visually
    if (lastRollElapsed > 3000) {
      // 0 to 36
      const result = Math.floor(Math.random() * 37);

      // For roulette, visual state might be determined by result or just a generic spinning state.
      // In GT, the "symbol" often holds the result index.
      this.data.dice!.symbol = result;
      this.data.dice!.lastRollTime = Date.now();

      // Send the spin animation
      const tankPkt = new TankPacket({
        type:       TankTypes.TILE_APPLY_DAMAGE,
        punchRange: this.data.dice!.symbol, // Sending result to client to handle frame
        netID:      peer.data.netID,
        xPunch:     this.data.x,
        yPunch:     this.data.y,
      });

      this.world.every((p) => {
        p.send(tankPkt);

        // Roulette special message format
        let color = "`4"; // Red for odd usually?
        if (result === 0) color = "`2"; // Green for 0
        else if (result % 2 === 0) color = "`b"; // Black (using blue code for now or black code if exists) for even

        // GT uses specific colors for roulette numbers.
        // 0: Green
        // 1-10, 19-28: Odd Red, Even Black
        // 11-18, 29-36: Odd Black, Even Red

        const isRed = (
          (result >= 1 && result <= 10) ||
            (result >= 19 && result <= 28)
        ) ? (result % 2 !== 0) : (
            (result >= 11 && result <= 18) ||
            (result >= 29 && result <= 36)
          ) ? (result % 2 === 0) : false;

        const isBlack = result !== 0 && !isRed;

        if (isRed) color = "`4"; // Red
        if (isBlack) color = "`b"; // Black (using b for black/blue contrast)

        p.send(
          Variant.from(
            "OnTalkBubble",
            peer.data.netID,
            `[${peer.data.displayName} spun the wheel and got ${color}${result}\`o]`,
          ),
          Variant.from(
            "OnConsoleMessage",
            `[${peer.data.displayName} spun the wheel and got ${color}${result}\`o]`,
          ),
        );
      });
    }
    return true;
  }

  public async onDestroy(peer: Peer): Promise<void> {
    await super.onDestroy(peer);
    this.data.dice = undefined;
  }

  public async onWrench(peer: Peer): Promise<boolean> {
    if (!(await super.onWrench(peer))) return false;

    const baseDialog = new DialogBuilder()
      .defaultColor("`o")
      .addLabelWithIcon("`wEdit Roulette Wheel", this.data.fg, "big")
      .addCheckbox(
        "checkbox_public",
        "Usable by public",
        this.data.flags & TileFlags.PUBLIC ? "selected" : "not_selected",
      )
      .addCheckbox(
        "checkbox_silence",
        "Silenced",
        this.data.flags & TileFlags.SILENCED ? "selected" : "not_selected",
      )
      .embed("tilex", this.data.x)
      .embed("tiley", this.data.y)
      .endDialog("dice_edit", "Cancel", "Ok") // Reusing dice edit likely fine
      .str();

    peer.send(Variant.from("OnDialogRequest", baseDialog));
    return true;
  }

  public async serialize(dataBuffer: ExtendBuffer): Promise<void> {
    await super.serialize(dataBuffer);
    dataBuffer.grow(2);
    // Roulette generally uses the DICE extra type struct
    dataBuffer.writeU8(this.extraType);
    dataBuffer.writeU8(this.block.dice!.symbol!);

    return;
  }
}
