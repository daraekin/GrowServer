import { TankPacket, Variant } from "growtopia.js";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { World } from "../../core/World";
import { ActionTypes } from "@growserver/const";

export class ItemActiveReq {
  private pos: number;

  constructor(
    public base: Base,
    public peer: Peer,
    public tank: TankPacket,
    public world: World,
  ) {
    this.pos =
      (this.tank.data?.xPunch as number) +
      (this.tank.data?.yPunch as number) * this.world.data.width;
  }

  public async execute() {
    this.tank.data!.state = this.peer.data.rotatedLeft ? 16 : 0;
    const isItemExist = (id: number) =>
      this.peer.data.inventory.items.find((i) => i.id === id);
    const item = this.base.items.metadata.items.get(
      this.tank.data!.info!.toString(),
    );

    if (!item) return;

    const itemExist = isItemExist(this.tank.data?.info as number);

    if (!itemExist || itemExist.amount <= 0) return;

    // Use the central ItemHandler to process item usage
    await this.base.itemHandler.handleItemUsage(
      this.peer,
      this.world,
      item.id,
      this.tank.data!.xPunch as number,
      this.tank.data!.yPunch as number
    );

    await this.peer.saveToCache();
    await this.peer.saveToDatabase();
    this.peer.inventory(); // Ensure inventory visual update
    this.peer.sendClothes(); // Update clothes visual if changed
  }
}
