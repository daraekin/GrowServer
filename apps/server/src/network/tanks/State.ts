import { TankPacket, Variant } from "growtopia.js";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { World } from "../../core/World";
import { TileData } from "@growserver/types";
import {
  ActionTypes,
  Y_LAVA_START,
  WORLD_SIZE,
} from "@growserver/const";

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

    // Check lava death: if the player falls into the lava zone
    const playerTileY = Math.floor(
      (this.tank.data?.yPos as number) / 32,
    );
    if (playerTileY >= Y_LAVA_START) {
      this.peer.respawn();
      return;
    }

    // Check if player goes out of world bounds (void death)
    const playerTileX = Math.floor(
      (this.tank.data?.xPos as number) / 32,
    );
    if (
      playerTileX < 0 ||
      playerTileX >= WORLD_SIZE.WIDTH ||
      playerTileY < 0 ||
      playerTileY >= WORLD_SIZE.HEIGHT
    ) {
      this.peer.respawn();
      return;
    }

    const itemMeta = this.base.items.metadata.items.get(
      (this.block.fg || this.block.bg).toString(),
    )!;

    switch (itemMeta.type) {
      case ActionTypes.CHECKPOINT: {
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
        break;
      }

      case ActionTypes.DEADLY_BLOCK:
      case ActionTypes.LAVA: {
        // Player touched a deadly/lava block, respawn them
        this.peer.respawn();
        break;
      }

      case ActionTypes.DEADLY_IF_ON: {
        // Deadly if the block is toggled on (SwitcheROO-based)
        // Only kills if the block is active (not toggled off)
        this.peer.respawn();
        break;
      }

      case ActionTypes.FOREGROUND: {
        if (itemMeta.id === 3496 || itemMeta.id === 3270) {
          // Steam testing
        }
        break;
      }
    }
  }
}
