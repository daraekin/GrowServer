import { Command } from "../Command";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { Variant } from "growtopia.js";

export default class Who extends Command {
  constructor(
    public base: Base,
    public peer: Peer,
    public text: string,
    public args: string[],
  ) {
    super(base, peer, text, args);
    this.opt = {
      command:     ["who", "online"],
      description: "Shows who is online in the current world.",
      cooldown:    3,
      ratelimit:   1,
      category:    "`oBasic",
      usage:       "/who",
      example:     ["/who"],
      permission:  [],
    };
  }

  public async execute(): Promise<void> {
    const world = this.peer.currentWorld();
    if (!world || this.peer.data.world === "EXIT") {
      this.peer.send(
        Variant.from(
          "OnConsoleMessage",
          `\`oThere are \`w${this.base.getPlayersOnline()}\`\` players online.`,
        ),
      );
      return;
    }

    const players: string[] = [];
    this.base.cache.peers.forEach((peerData) => {
      if (peerData.world === this.peer.data.world) {
        players.push(peerData.displayName || peerData.name);
      }
    });

    this.peer.send(
      Variant.from(
        "OnConsoleMessage",
        `\`oPlayers in \`w${this.peer.data.world}\`\` (${players.length}):\n${players.map((p) => `  \`w${p}\`\``).join("\n")}`,
      ),
    );
  }
}
