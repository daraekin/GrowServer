import { Command } from "../Command";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { ROLE } from "@growserver/const";
import { Variant } from "growtopia.js";

export default class Pull extends Command {
  constructor(
    public base: Base,
    public peer: Peer,
    public text: string,
    public args: string[],
  ) {
    super(base, peer, text, args);
    this.opt = {
      command:     ["pull"],
      description: "Pull a player to your location (world owner/admin only).",
      cooldown:    3,
      ratelimit:   1,
      category:    "`oWorld",
      usage:       "/pull <player name>",
      example:     ["/pull Seth"],
      permission:  [],
    };
  }

  public async execute(): Promise<void> {
    if (!this.args.length) {
      this.peer.send(
        Variant.from("OnConsoleMessage", "`4Usage: /pull <player name>"),
      );
      return;
    }

    const world = this.peer.currentWorld();
    if (!world) return;

    // Check if peer is world owner or admin
    const ownerUID = world.getOwnerUID();
    if (
      ownerUID !== this.peer.data.userID &&
      this.peer.data.role !== ROLE.DEVELOPER
    ) {
      // Check if they have admin access
      const worldLockIdx = world.data.worldLockIndex;
      if (worldLockIdx !== undefined) {
        const lockBlock = world.data.blocks[worldLockIdx];
        if (!lockBlock.lock?.adminIDs?.includes(this.peer.data.userID)) {
          this.peer.send(
            Variant.from(
              "OnConsoleMessage",
              "`4You don't have permission to pull players in this world.",
            ),
          );
          return;
        }
      } else {
        this.peer.send(
          Variant.from(
            "OnConsoleMessage",
            "`4You don't have permission to pull players in this world.",
          ),
        );
        return;
      }
    }

    const targetName = this.args.join(" ").toLowerCase();
    let targetPeer: Peer | undefined;

    this.base.cache.peers.forEach((peerData) => {
      if (
        peerData.name.toLowerCase() === targetName &&
        peerData.world === this.peer.data.world
      ) {
        targetPeer = new Peer(this.base, peerData.netID);
      }
    });

    if (!targetPeer) {
      this.peer.send(
        Variant.from(
          "OnConsoleMessage",
          "`4Can't find that player in this world!",
        ),
      );
      return;
    }

    targetPeer.send(
      Variant.from(
        { netID: targetPeer.data.netID },
        "OnSetPos",
        [(this.peer.data.x as number) || 0, (this.peer.data.y as number) || 0],
      ),
    );

    world.every((p) => {
      p.send(
        Variant.from(
          "OnConsoleMessage",
          `${this.peer.data.displayName} pulled ${targetPeer!.data.displayName}!`,
        ),
      );
    });
  }
}
