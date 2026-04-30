import { Command } from "../Command";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { Variant } from "growtopia.js";

export default class Msg extends Command {
  constructor(
    public base: Base,
    public peer: Peer,
    public text: string,
    public args: string[],
  ) {
    super(base, peer, text, args);
    this.opt = {
      command:     ["msg", "pm"],
      description: "Send a private message to another player.",
      cooldown:    1,
      ratelimit:   3,
      category:    "`oBasic",
      usage:       "/msg <player name> <message>",
      example:     ["/msg Seth hey there!", "/pm Seth hello"],
      permission:  [],
    };
  }

  public async execute(): Promise<void> {
    if (this.args.length < 2) {
      this.peer.send(
        Variant.from(
          "OnConsoleMessage",
          "`4Usage: /msg <player name> <message>",
        ),
      );
      return;
    }

    const targetName = this.args[0].toLowerCase();
    const message = this.args.slice(1).join(" ");
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

    if (targetPeer.data.netID === this.peer.data.netID) {
      this.peer.send(
        Variant.from(
          "OnConsoleMessage",
          "`4You can't send a message to yourself!",
        ),
      );
      return;
    }

    // Send to target
    targetPeer.send(
      Variant.from(
        "OnConsoleMessage",
        `\`6>> from \`w${this.peer.data.displayName}\`\`: ${message}`,
      ),
    );

    // Confirm to sender
    this.peer.send(
      Variant.from(
        "OnConsoleMessage",
        `\`6>> to \`w${targetPeer.data.displayName}\`\`: ${message}`,
      ),
    );
  }
}
