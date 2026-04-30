import { type NonEmptyObject } from "type-fest";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { DialogBuilder } from "@growserver/utils";
import { Variant } from "growtopia.js";
import { ROLE } from "@growserver/const";

export class Wrench {
  constructor(
    public base: Base,
    public peer: Peer,
  ) {}

  private selfInfoDialog(): DialogBuilder {
    const level = this.peer.data.level || 1;
    const exp = this.peer.data.exp || 0;
    const requiredXp = this.peer.calculateRequiredLevelXp(level);
    const progressPct = Math.min(100, Math.floor((exp / requiredXp) * 100));

    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon(
        `\`w${this.peer.data.displayName}\`\`'s Profile`,
        32,
        "big",
      )
      .addSpacer("small")
      .addSmallText(`\`wLevel:\`\` ${level}`)
      .addSmallText(
        `\`wExperience:\`\` ${exp}/${requiredXp} (${progressPct}%)`,
      )
      .addSmallText(`\`wGems:\`\` ${this.peer.data.gems || 0}`)
      .addSmallText(
        `\`wWorld:\`\` ${this.peer.data.world === "EXIT" ? "Menu" : this.peer.data.world}`,
      )
      .addSpacer("small");

    // Show role
    let roleStr = "Player";
    if (this.peer.data.role === ROLE.DEVELOPER) roleStr = "`bDeveloper``";
    else if (this.peer.data.role === ROLE.SUPPORTER) roleStr = "`5Supporter``";
    dialog.addSmallText(`\`wRole:\`\` ${roleStr}`);

    // Show clothing summary
    const clothingCount = Object.values(this.peer.data.clothing).filter(
      (v) => v > 0,
    ).length;
    dialog.addSmallText(`\`wItems Worn:\`\` ${clothingCount}/10`);

    // Show inventory size
    dialog.addSmallText(
      `\`wInventory:\`\` ${this.peer.data.inventory.items.length}/${this.peer.data.inventory.max} slots`,
    );

    return dialog;
  }

  private otherPlayerDialog(targetPeer: Peer): DialogBuilder {
    const level = targetPeer.data.level || 1;

    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon(
        `\`w${targetPeer.data.displayName}`,
        32,
        "big",
      )
      .addSpacer("small")
      .addSmallText(`\`wLevel:\`\` ${level}`)
      .addSpacer("small");

    // World owner/admin options
    const world = this.peer.currentWorld();
    if (world) {
      const ownerUID = world.getOwnerUID();
      const isOwner = ownerUID === this.peer.data.userID;
      const isDev = this.peer.data.role === ROLE.DEVELOPER;

      if (isOwner || isDev) {
        dialog
          .addButton("pull_player", "`wPull``")
          .addButton("kick_player", "`4Kick``");
      }
    }

    dialog
      .addButton("trade_player", "`wTrade``")
      .addButton("add_friend", "`2Add as Friend``");

    // Developer options
    if (this.peer.data.role === ROLE.DEVELOPER) {
      dialog
        .addSpacer("small")
        .addSmallText("`4-- Admin Options --``")
        .addSmallText(`NetID: ${targetPeer.data.netID}`)
        .addSmallText(`UserID: ${targetPeer.data.userID}`)
        .addButton("ban_player", "`4Ban Player``")
        .addButton("give_gems", "`wGive Gems``");
    }

    return dialog;
  }

  public async execute(
    action: NonEmptyObject<Record<string, string>>,
  ): Promise<void> {
    // If wrenching a player (netID provided via action)
    const targetNetID = action.netID ? parseInt(action.netID) : undefined;

    if (targetNetID && targetNetID !== this.peer.data.netID) {
      // Wrenching another player
      const targetData = this.base.cache.peers.get(targetNetID);
      if (targetData) {
        const targetPeer = new Peer(this.base, targetData.netID);
        const dialog = this.otherPlayerDialog(targetPeer)
          .embed("targetNetID", targetPeer.data.netID)
          .endDialog("wrench_player_end", "Cancel", "OK")
          .addQuickExit()
          .str();
        this.peer.send(Variant.from("OnDialogRequest", dialog));
      }
    } else {
      // Wrenching self - show profile
      const dialog = this.selfInfoDialog()
        .endDialog("wrench_end", "Cancel", "OK")
        .addQuickExit()
        .str();
      this.peer.send(Variant.from("OnDialogRequest", dialog));
    }
  }
}
