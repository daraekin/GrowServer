import { Command } from "../Command";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { ROLE } from "@growserver/const";
import { Variant } from "growtopia.js";

// Weather IDs reference from Growtopia
const WEATHER_NAMES: Record<string, number> = {
  "sunny":      41,
  "clear":      41,
  "night":      28,
  "rainy":      1,
  "rain":       1,
  "snowy":      18,
  "snow":       18,
  "harvest":    29,
  "mars":       27,
  "spooky":     19,
  "halloween":  19,
  "valentine":  20,
  "beach":      23,
  "arid":       10,
  "desert":     10,
  "jungle":     13,
  "arctic":     30,
  "apocalypse": 22,
  "nether":     25,
  "space":      33,
  "comet":      34,
  "pineapple":  35,
  "volcano":    38,
  "background": 0,
  "stuff":      24,
  "heatwave":   36,
  "underwater": 37,
  "digital":    39,
  "party":      40,
};

export default class Weather extends Command {
  constructor(
    public base: Base,
    public peer: Peer,
    public text: string,
    public args: string[],
  ) {
    super(base, peer, text, args);
    this.opt = {
      command:     ["weather"],
      description: "Change the weather in the current world (world owner/developer only).",
      cooldown:    3,
      ratelimit:   1,
      category:    "`oWorld",
      usage:       "/weather <name or id>",
      example:     ["/weather sunny", "/weather rain", "/weather 28"],
      permission:  [],
    };
  }

  public async execute(): Promise<void> {
    if (!this.args.length) {
      const weatherList = Object.keys(WEATHER_NAMES).slice(0, 15).join(", ");
      this.peer.send(
        Variant.from(
          "OnConsoleMessage",
          `\`4Usage: /weather <name or id>\`\`\nAvailable: ${weatherList}, ...`,
        ),
      );
      return;
    }

    const world = this.peer.currentWorld();
    if (!world) return;

    // Check if peer is world owner or developer
    const ownerUID = world.getOwnerUID();
    if (
      ownerUID !== this.peer.data.userID &&
      this.peer.data.role !== ROLE.DEVELOPER
    ) {
      this.peer.send(
        Variant.from(
          "OnConsoleMessage",
          "`4You must be the world owner or a developer to change weather.",
        ),
      );
      return;
    }

    const input = this.args[0].toLowerCase();
    let weatherId: number;

    // Check if it's a number
    const numId = parseInt(input);
    if (!isNaN(numId) && numId >= 0 && numId <= 50) {
      weatherId = numId;
    } else if (WEATHER_NAMES[input] !== undefined) {
      weatherId = WEATHER_NAMES[input];
    } else {
      this.peer.send(
        Variant.from(
          "OnConsoleMessage",
          `\`4Unknown weather: ${input}. Try a number (0-50) or a name like sunny, rain, snow.`,
        ),
      );
      return;
    }

    // Apply weather
    world.data.weather = { id: weatherId };

    world.every((p) => {
      p.send(Variant.from("OnSetCurrentWeather", weatherId));
    });

    world.every((p) => {
      p.send(
        Variant.from(
          "OnConsoleMessage",
          `\`o${this.peer.data.displayName}\`\` changed the weather to \`w${input}\`\` (ID: ${weatherId}).`,
        ),
      );
    });

    await world.saveToCache();
  }
}
