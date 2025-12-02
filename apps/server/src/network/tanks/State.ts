import { TankPacket, Variant } from "growtopia.js";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { World } from "../../core/World";
import { TileData } from "@growserver/types";
import { ActionTypes } from "@growserver/const";

export class State {
  private pos: number;
  private block: TileData;

  constructor(
    public base: Base,
    public peer: Peer,
    public tank: TankPacket,
    public world: World,
  ) {
    this.pos =
      (this.tank.data?.xPunch as number) +
      (this.tank.data?.yPunch as number) * this.world.data.width;
    this.block = this.world.data.blocks[this.pos];
  }

  public async execute() {
    if (this.peer.data.world === "EXIT") return;
    this.tank.data!.netID = this.peer.data.netID;

    this.peer.data.x = this.tank.data?.xPos;
    this.peer.data.y = this.tank.data?.yPos;
    this.peer.data.rotatedLeft = Boolean(
      (this.tank.data?.state as number) & 0x10,
    );

    this.peer.saveToCache();

    const world = this.peer.currentWorld();
    if (world) {
      world.every((p) => {
        p.send(this.tank);
      });
    }

    this.onPlayerMove();
  }

  private async onPlayerMove() {
    if (
      (this.tank.data?.xPunch as number) > 0 ||
      (this.tank.data?.yPunch as number) > 0
    )
      return;
    if (this.block === undefined) return;

    // We need to check both FG and BG for effects
    const fgID = this.block.fg;
    const bgID = this.block.bg;

    const fgMeta = this.base.items.metadata.items.get(fgID.toString());
    const bgMeta = this.base.items.metadata.items.get(bgID.toString());

    // Basic death checks (Lava, Deadly Blocks)
    if (fgMeta && (fgMeta.type === ActionTypes.LAVA || fgMeta.type === ActionTypes.DEADLY_BLOCK)) {
      this.peer.respawn();
      return;
    }

    // Checkpoints
    if (fgMeta && fgMeta.type === ActionTypes.CHECKPOINT) {
      this.peer.send(
        Variant.from(
          { netID: this.peer.data.netID, delay: 0 },
          "SetRespawnPos",
          this.pos,
        ),
      );
      this.peer.data.lastCheckpoint = {
        x: Math.round((this.tank.data?.xPos as number) / 32),
        y: Math.round((this.tank.data?.yPos as number) / 32),
      };
    }

    // Trampoline & Bouncy
    if (fgMeta && (fgMeta.type === ActionTypes.TRAMPOLINE || fgMeta.type === ActionTypes.BOUNCY)) {
      // Handle bounce physics if server-side physics is desired,
      // usually client handles bounce but server might enforce state.
    }

    // Portal/Door entry is usually handled by 'Use' packet, but auto-enter portals exist.
    if (fgMeta && fgMeta.type === ActionTypes.PORTAL) {
      // Check if auto-enter
    }
  }
}
