import { Command } from "../Command";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { ROLE } from "@growserver/const";
import { Variant } from "growtopia.js";

export default class Ban extends Command {
  constructor(
    public base: Base,
    public peer: Peer,
    public text: string,
    public args: string[],
  ) {
    super(base, peer, text, args);
    this.opt = {
      command:     ["ban"],
      description: "Ban a player from the server (developer only).",
      cooldown:    5,
      ratelimit:   1,
      category:    "`4Admin",
      usage:       "/ban <player name> [reason]",
      example:     ["/ban Seth hacking", "/ban Troll"],
      permission:  [ROLE.DEVELOPER],
    };
  }

  public async execute(): Promise<void> {
    if (!this.args.length) {
      this.peer.send(
        Variant.from(
          "OnConsoleMessage",
          "`4Usage: /ban <player name> [reason]",
        ),
      );
      return;
    }

    const targetName = this.args[0].toLowerCase();
    const reason = this.args.slice(1).join(" ") || "No reason given";
    let targetPeer: Peer | undefined;

    this.base.cache.peers.forEach((peerData) => {
      if (peerData.name.toLowerCase() === targetName) {
        targetPeer = new Peer(this.base, peerData.netID);
      }
    });

    if (!targetPeer) {
      this.peer.send(
        Variant.from(
          "OnConsoleMessage",
          "`4Can't find that player online!",
        ),
      );
      return;
    }

    // Can't ban developers
    if (targetPeer.data.role === ROLE.DEVELOPER) {
      this.peer.send(
        Variant.from(
          "OnConsoleMessage",
          "`4You can't ban a developer!",
        ),
      );
      return;
    }

    targetPeer.send(
      Variant.from(
        "OnConsoleMessage",
        `\`4You have been banned!\`\` Reason: ${reason}`,
      ),
    );
    targetPeer.leaveWorld();
    targetPeer.disconnect();

    this.peer.send(
      Variant.from(
        "OnConsoleMessage",
        `\`2Successfully banned \`w${targetPeer.data.displayName}\`\`! Reason: ${reason}`,
      ),
    );
  }
}
