import { TankPacket } from "growtopia.js";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { World } from "../../core/World";
import { TankTypes } from "@growserver/const";
import logger from "@growserver/logger";

export class AppCheckResponsePack {
  constructor(
    public base: Base,
    public peer: Peer,
    public tank: TankPacket,
    public world: World,
  ) {}

  public async execute() {
    // Client integrity check response handling for latest GT client
    if (this.tank.data?.type === TankTypes.APP_CHECK_RESPONSE) {
      if (this.peer.isValid()) {
        logger.debug(
          `AppCheckResponse: Peer ${this.peer.data.netID} passed client validation`,
        );
      } else {
        logger.warn(
          `AppCheckResponse: Peer ${this.peer.data.netID} failed validation, disconnecting`,
        );
        this.peer.disconnect();
      }
    } else {
      logger.warn(
        `Invalid APP_CHECK_RESPONSE packet type: ${this.tank.data?.type}`,
      );
    }
  }
}
