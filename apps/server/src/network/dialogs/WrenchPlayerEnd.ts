import { type NonEmptyObject } from "type-fest";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { World } from "../../core/World";
import { ROLE } from "@growserver/const";
import { Variant } from "growtopia.js";

export class WrenchPlayerEnd {
  private world: World;

  constructor(
    public base: Base,
    public peer: Peer,
    public action: NonEmptyObject<{
      dialog_name: string;
      targetNetID?: string;
      buttonClicked?: string;
    }>,
  ) {
    this.world = this.peer.currentWorld()!;
  }

  public async execute(): Promise<void> {
    if (!this.action.targetNetID) return;

    const targetNetID = parseInt(this.action.targetNetID);
    const targetData = this.base.cache.peers.get(targetNetID);
    if (!targetData) {
      this.peer.sendTextBubble("That player is no longer available.", true);
      return;
    }

    const targetPeer = new Peer(this.base, targetData.netID);
    const button = this.action.buttonClicked;

    switch (button) {
      case "pull_player": {
        // Check permission
        const ownerUID = this.world?.getOwnerUID();
        if (
          ownerUID !== this.peer.data.userID &&
          this.peer.data.role !== ROLE.DEVELOPER
        ) {
          this.peer.sendTextBubble("You don't have permission to pull!", true);
          return;
        }

        targetPeer.send(
          Variant.from(
            { netID: targetPeer.data.netID },
            "OnSetPos",
            [(this.peer.data.x as number) || 0, (this.peer.data.y as number) || 0],
          ),
        );
        this.peer.sendTextBubble(
          `Pulled ${targetPeer.data.displayName}!`,
          true,
        );
        break;
      }

      case "kick_player": {
        const ownerUID = this.world?.getOwnerUID();
        if (
          ownerUID !== this.peer.data.userID &&
          this.peer.data.role !== ROLE.DEVELOPER
        ) {
          this.peer.sendTextBubble("You don't have permission to kick!", true);
          return;
        }

        targetPeer.leaveWorld();
        targetPeer.send(
          Variant.from(
            "OnConsoleMessage",
            `\`4You were kicked by ${this.peer.data.displayName}!`,
          ),
        );
        this.world?.every((p) => {
          p.send(
            Variant.from(
              "OnConsoleMessage",
              `\`5${targetPeer.data.displayName}\`\` was kicked from the world.`,
            ),
          );
        });
        break;
      }

      case "trade_player": {
        // Send trade request notification
        targetPeer.send(
          Variant.from(
            "OnConsoleMessage",
            `\`o${this.peer.data.displayName}\`\` wants to trade with you! (Trading coming soon)`,
          ),
        );
        this.peer.send(
          Variant.from(
            "OnConsoleMessage",
            `\`oTrade request sent to \`w${targetPeer.data.displayName}\`\`! (Trading coming soon)`,
          ),
        );
        break;
      }

      case "add_friend": {
        this.peer.send(
          Variant.from(
            "OnConsoleMessage",
            `\`2Friend request sent to \`w${targetPeer.data.displayName}\`\`! (Friends system coming soon)`,
          ),
        );
        targetPeer.send(
          Variant.from(
            "OnConsoleMessage",
            `\`2${this.peer.data.displayName}\`\` wants to be your friend! (Friends system coming soon)`,
          ),
        );
        break;
      }

      case "ban_player": {
        if (this.peer.data.role !== ROLE.DEVELOPER) return;
        targetPeer.send(
          Variant.from("OnConsoleMessage", "`4You have been banned!"),
        );
        targetPeer.leaveWorld();
        targetPeer.disconnect();
        this.peer.send(
          Variant.from(
            "OnConsoleMessage",
            `\`2Banned \`w${targetPeer.data.displayName}\`\`.`,
          ),
        );
        break;
      }

      case "give_gems": {
        if (this.peer.data.role !== ROLE.DEVELOPER) return;
        const amount = 10000;
        targetPeer.data.gems += amount;
        targetPeer.setGems(targetPeer.data.gems);
        targetPeer.send(
          Variant.from(
            "OnConsoleMessage",
            `\`2You received \`w${amount}\`\` gems from an admin!`,
          ),
        );
        this.peer.send(
          Variant.from(
            "OnConsoleMessage",
            `\`2Gave \`w${amount}\`\` gems to ${targetPeer.data.displayName}.`,
          ),
        );
        break;
      }
    }
  }
}
