import { Command } from "../Command";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { ROLE } from "@growserver/const";
import { Variant } from "growtopia.js";

export default class Kick extends Command {
  constructor(
    public base: Base,
    public peer: Peer,
    public text: string,
    public args: string[],
  ) {
    super(base, peer, text, args);
    this.opt = {
      command:     ["kick"],
      description: "Kick a player from the world (world owner/admin only).",
      cooldown:    3,
      ratelimit:   1,
      category:    "`oWorld",
      usage:       "/kick <player name>",
      example:     ["/kick Seth"],
      permission:  [],
    };
  }

  public async execute(): Promise<void> {
    if (!this.args.length) {
      this.peer.send(
        Variant.from("OnConsoleMessage", "`4Usage: /kick <player name>"),
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
      const worldLockIdx = world.data.worldLockIndex;
      if (worldLockIdx !== undefined) {
        const lockBlock = world.data.blocks[worldLockIdx];
        if (!lockBlock.lock?.adminIDs?.includes(this.peer.data.userID)) {
          this.peer.send(
            Variant.from(
              "OnConsoleMessage",
              "`4You don't have permission to kick players in this world.",
            ),
          );
          return;
        }
      } else {
        this.peer.send(
          Variant.from(
            "OnConsoleMessage",
            "`4You don't have permission to kick players in this world.",
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

    // Can't kick the world owner
    if (targetPeer.data.userID === ownerUID) {
      this.peer.send(
        Variant.from(
          "OnConsoleMessage",
          "`4You can't kick the world owner!",
        ),
      );
      return;
    }

    targetPeer.leaveWorld();
    targetPeer.send(
      Variant.from(
        "OnConsoleMessage",
        `\`4You were kicked from \`w${world.worldName}\`\` by ${this.peer.data.displayName}!`,
      ),
    );

    world.every((p) => {
      p.send(
        Variant.from(
          "OnConsoleMessage",
          `\`5${this.peer.data.displayName}\`\` kicked \`5${targetPeer!.data.displayName}\`\` from the world!`,
        ),
      );
    });
  }
}
