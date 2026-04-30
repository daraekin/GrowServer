import { type NonEmptyObject } from "type-fest";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { DialogBuilder } from "@growserver/utils";
import { Variant } from "growtopia.js";

type StoreItem = {
  name: string;
  title: string;
  description: string;
  image?: string;
  imagePos?: { x: number; y: number };
  cost?: string | number;
};

export class StoreHandler {
  // Main featured items
  private readonly mainItems: StoreItem[] = [
    {
      name:        "world_lock_pack",
      title:       "World Lock Pack",
      description: "Get 10 World Locks to secure your worlds!",
      image:       "interface/large/store_buttons/store_buttons.rttex",
      imagePos:    { x: 0, y: 0 },
      cost:        5000,
    },
    {
      name:        "diamond_lock_pack",
      title:       "Diamond Lock Pack",
      description: "A Diamond Lock to show off your wealth!",
      image:       "interface/large/store_buttons/store_buttons.rttex",
      imagePos:    { x: 1, y: 0 },
      cost:        50000,
    },
    {
      name:        "rare_seed_pack",
      title:       "Rare Seed Pack",
      description: "Contains 5 random rare seeds!",
      image:       "interface/large/store_buttons/store_buttons.rttex",
      imagePos:    { x: 0, y: 1 },
      cost:        10000,
    },
  ];

  // Locks and security items
  private readonly lockItems: StoreItem[] = [
    {
      name:        "small_lock",
      title:       "Small Lock",
      description: "Protects a small area (10 tiles).",
      image:       "interface/large/store_buttons/store_buttons.rttex",
      imagePos:    { x: 0, y: 0 },
      cost:        500,
    },
    {
      name:        "big_lock",
      title:       "Big Lock",
      description: "Protects a bigger area (48 tiles).",
      image:       "interface/large/store_buttons/store_buttons.rttex",
      imagePos:    { x: 0, y: 0 },
      cost:        2000,
    },
    {
      name:        "huge_lock",
      title:       "Huge Lock",
      description: "Protects a huge area (200 tiles).",
      image:       "interface/large/store_buttons/store_buttons.rttex",
      imagePos:    { x: 0, y: 0 },
      cost:        7500,
    },
  ];

  // Player items
  private readonly playerItems: StoreItem[] = [
    {
      name:        "backpack_upgrade",
      title:       "Backpack Upgrade",
      description: "Increase your inventory by 10 slots!",
      image:       "interface/large/store_buttons/store_buttons.rttex",
      imagePos:    { x: 1, y: 0 },
      cost:        2000,
    },
    {
      name:        "name_change",
      title:       "Name Change Token",
      description: "Change your display name!",
      image:       "interface/large/store_buttons/store_buttons.rttex",
      imagePos:    { x: 1, y: 1 },
      cost:        10000,
    },
  ];

  // Growtoken items
  private readonly tokenItems: StoreItem[] = [
    {
      name:        "weather_sun",
      title:       "Weather: Sunny",
      description: "Set sunny weather in your world!",
      image:       "interface/large/store_buttons/store_buttons.rttex",
      imagePos:    { x: 0, y: 1 },
      cost:        "5 Growtokens",
    },
    {
      name:        "weather_rain",
      title:       "Weather: Rainy",
      description: "Set rainy weather in your world!",
      image:       "interface/large/store_buttons/store_buttons.rttex",
      imagePos:    { x: 0, y: 1 },
      cost:        "5 Growtokens",
    },
  ];

  constructor(
    public base: Base,
    public peer: Peer,
  ) {}

  private addItems(dialog: DialogBuilder, items: StoreItem[]): DialogBuilder {
    items.forEach((item) => {
      dialog.addStoreButton(
        item.name,
        item.title,
        item.description,
        item.image || "",
        item.imagePos || { x: 0, y: 0 },
        item.cost || "",
      );
    });
    return dialog;
  }

  public async execute(
    _action: NonEmptyObject<Record<string, string>>,
  ): Promise<void> {
    const dialog = new DialogBuilder()
      .defaultColor()
      .raw("enable_tabs|1")
      .addSpacer("small")
      // Tabs
      .raw(
        "add_tab_button|main_menu|main|interface/large/btn_shop2.rttex||1|0|0|0||||-1|-1|||0|0|",
      )
      .addSpacer("small")
      .raw(
        "add_tab_button|player_menu|player|interface/large/btn_shop2.rttex||0|1|0|0||||-1|-1|||0|0|",
      )
      .addSpacer("small")
      .raw(
        "add_tab_button|locks_menu|packs|interface/large/btn_shop2.rttex||0|3|0|0||||-1|-1|||0|0|",
      )
      .addSpacer("small")
      .raw(
        "add_tab_button|itempacks_menu|bigitems|interface/large/btn_shop2.rttex||0|4|0|0||||-1|-1|||0|0|",
      )
      .addSpacer("small")
      .raw(
        "add_tab_button|creativity_menu|weather|interface/large/btn_shop2.rttex||0|5|0|0||||-1|-1|||0|0|",
      )
      .addSpacer("small")
      .raw(
        "add_tab_button|token_menu|growtoken|interface/large/btn_shop2.rttex||0|2|0|0||||-1|-1|||0|0|",
      )
      .addSpacer("small")
      .raw("add_banner|interface/large/gui_shop_featured_header.rttex|0|1|")
      .addSpacer("small");

    // Add all item categories
    this.addItems(dialog, this.mainItems);
    this.addItems(dialog, this.lockItems);
    this.addItems(dialog, this.playerItems);
    this.addItems(dialog, this.tokenItems);

    const finalDialog = dialog
      .endDialog("store_end", "Cancel", "OK")
      .addQuickExit()
      .str();

    this.peer.send(
      Variant.from("OnSetVouchers", 0),
      Variant.from("OnStoreRequest", finalDialog),
    );
  }
}
