import { type NonEmptyObject } from "type-fest";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { TileData } from "@growserver/types";
import { World } from "../../core/World";
import { tileFrom } from "../../world/tiles";
import { LockPermission } from "@growserver/const";

export class MannequinEdit {
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
      label?: string;
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
      !this.block.mannequin
    ) {
      return;
    }

    // Update label
    const label = (this.action.label || "").substring(0, 100);
    this.block.mannequin.label = label;

    const mannequinTile = tileFrom(this.base, this.world, this.block);
    this.world.every((p) => mannequinTile.tileUpdate(p));

    await this.world.saveToCache();
    await this.world.saveToDatabase();
  }
}
