import { TankPacket } from "growtopia.js";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { World } from "../../core/World";
import { ItemHandler } from "../../core/ItemHandler";
import { ActionTypes } from "@growserver/const";

export class ItemActiveReq {
  private pos: number;
  private itemHandler: ItemHandler;

  constructor(
    public base: Base,
    public peer: Peer,
    public tank: TankPacket,
    public world: World,
  ) {
    this.pos =
      (this.tank.data?.xPunch as number) +
      (this.tank.data?.yPunch as number) * this.world.data.width;
    this.itemHandler = new ItemHandler(base, peer, world);
  }

  public async execute() {
    this.tank.data!.state = this.peer.data.rotatedLeft ? 16 : 0;

    const item = this.base.items.metadata.items.get(
      this.tank.data!.info!.toString(),
    );

    if (!item) return;

    const itemExist = this.peer.searchItem(this.tank.data?.info as number);
    if (!itemExist || itemExist.amount <= 0) return;

    // Delegate lock conversions and consumables to ItemHandler
    if (
      item.type === ActionTypes.LOCK ||
      item.type === ActionTypes.CONSUMABLE
    ) {
      const handled = this.itemHandler.handle(item);
      if (handled) {
        await this.peer.saveToCache();
        await this.peer.saveToDatabase();
        this.peer.inventory();
        return;
      }
    }

    // Clothes equip/unequip
    if (item.type === ActionTypes.CLOTHES) {
      this.peer.equipClothes(item.id as number);
      await this.peer.saveToCache();
      await this.peer.saveToDatabase();
      this.peer.sendClothes();
      return;
    }

    // Fallback: equip as clothes (legacy behavior for items not strictly typed as CLOTHES)
    this.peer.equipClothes(item.id as number);
    await this.peer.saveToCache();
    await this.peer.saveToDatabase();
    this.peer.sendClothes();
  }
}
