import { TankPacket, TextPacket, Variant } from "growtopia.js";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { World } from "../../core/World";
import { TileData } from "@growserver/types";
import {
  ActionTypes,
  PacketTypes,
  StateFlags,
  TileFlags,
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

    // Detect state flags from the packet
    const stateFlags = this.tank.data?.state as number;

    // Handle fire damage (walking through lava/fire blocks)
    if (stateFlags & StateFlags.ON_FIRE_DAMAGE) {
      this.peer.respawn();
      return;
    }

    // Handle acid damage
    if (stateFlags & StateFlags.ON_ACID_DAMAGE) {
      this.peer.respawn();
      return;
    }

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

    const blockId = this.block.fg || this.block.bg;
    if (blockId === 0) return;

    const itemMeta = this.base.items.metadata.items.get(
      blockId.toString(),
    )!;
    if (!itemMeta) return;

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

      case ActionTypes.POINTY: {
        // Spikes kill on contact
        this.peer.respawn();
        break;
      }

      case ActionTypes.DEADLY_IF_ON: {
        // Deadly if the block is toggled on
        // Check if the block is in "open" state (toggled)
        if (!(this.block.flags & TileFlags.OPEN)) {
          this.peer.respawn();
        }
        break;
      }

      case ActionTypes.STEAM_LAVA_IF_ON: {
        // Steam lava: kills if block is toggled on
        if (!(this.block.flags & TileFlags.OPEN)) {
          this.peer.respawn();
        }
        break;
      }

      case ActionTypes.LIGHTNING_IF_ON: {
        // Lightning block: kills if active
        if (!(this.block.flags & TileFlags.OPEN)) {
          this.peer.respawn();
        }
        break;
      }

      case ActionTypes.TRAMPOLINE: {
        // Trampoline: bounce player up with sound
        this.peer.send(
          TextPacket.from(
            PacketTypes.ACTION,
            "action|play_sfx",
            "file|audio/boing.wav",
            "delayMS|0",
          ),
        );
        break;
      }

      case ActionTypes.BOUNCY: {
        // Bouncy blocks: similar to trampoline with less bounce
        this.peer.send(
          TextPacket.from(
            PacketTypes.ACTION,
            "action|play_sfx",
            "file|audio/boing.wav",
            "delayMS|0",
          ),
        );
        break;
      }

      case ActionTypes.PORTAL:
      case ActionTypes.DOOR: {
        // Door/portal: handle teleportation
        if (this.block.door?.destination) {
          this.handleDoorTeleport();
        }
        break;
      }

      case ActionTypes.GATEWAY: {
        // Gateways let players pass through if they match the entry criteria
        break;
      }

      case ActionTypes.FOREGROUND: {
        if (itemMeta.id === 3496 || itemMeta.id === 3270) {
          // Steam testing
        }
        break;
      }

      case ActionTypes.GEMS: {
        // Gems block: collect gems
        const gemAmount = Math.floor(Math.random() * 5) + 1;
        this.peer.data.gems += gemAmount;
        this.peer.setGems(this.peer.data.gems);
        break;
      }

      case ActionTypes.TREASURE: {
        // Treasure block: random gem reward
        const treasureAmount = Math.floor(Math.random() * 20) + 5;
        this.peer.data.gems += treasureAmount;
        this.peer.setGems(this.peer.data.gems);
        this.peer.send(
          Variant.from(
            "OnTalkBubble",
            this.peer.data.netID,
            `You found ${treasureAmount} gems!`,
            0,
            1,
          ),
        );
        break;
      }
    }
  }

  private handleDoorTeleport() {
    if (!this.block.door?.destination) return;

    const destination = this.block.door.destination;
    const parts = destination.split(":");

    if (parts.length === 2 && parts[0]) {
      // WORLDNAME:ID format - teleport to another world
      const targetWorld = parts[0].toUpperCase();
      const targetId = parts[1];

      this.peer.leaveWorld();
      this.peer.enterWorld(targetWorld);
    } else if (parts.length === 2 && !parts[0]) {
      // :ID format - teleport within current world
      const targetId = parts[1];
      const targetBlock = this.world.data.blocks.find(
        (b) => b.door?.id === targetId,
      );

      if (targetBlock) {
        this.peer.send(
          Variant.from(
            { netID: this.peer.data.netID, delay: 0 },
            "OnSetPos",
            [targetBlock.x * 32, targetBlock.y * 32],
          ),
        );
        this.peer.send(
          TextPacket.from(
            PacketTypes.ACTION,
            "action|play_sfx",
            "file|audio/door_open.wav",
            "delayMS|0",
          ),
        );
      }
    } else if (parts.length === 1 && parts[0]) {
      // WORLDNAME format only
      const targetWorld = parts[0].toUpperCase();
      this.peer.leaveWorld();
      this.peer.enterWorld(targetWorld);
    }
  }
}
