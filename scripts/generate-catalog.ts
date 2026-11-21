import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Menu, Restaurant } from "../src/contracts";

type SpecialtyDish = {
  name: string;
  priceBaht: number;
  ingredients: string[];
  flavorTags: string[];
  textureTags: string[];
  noodleStyle?: Menu["noodleStyle"];
};

const specialtyShops: { name: string; dishes: SpecialtyDish[] }[] = [
  {
    "name": "เตาถ่านเนื้อวัว",
    "dishes": [
      {
        "name": "ข้าวหน้าเนื้อวัวย่าง",
        "priceBaht": 115,
        "ingredients": [
          "beef",
          "rice",
          "soy"
        ],
        "flavorTags": [
          "savory"
        ],
        "textureTags": [
          "grilled"
        ]
      },
      {
        "name": "เนื้อวัวผัดพริกไทยดำราดข้าว",
        "priceBaht": 120,
        "ingredients": [
          "beef",
          "black_pepper",
          "rice",
          "soy",
          "oil"
        ],
        "flavorTags": [
          "savory",
          "spicy"
        ],
        "textureTags": []
      }
    ]
  },
  {
    "name": "ครัวผักตามฤดู",
    "dishes": [
      {
        "name": "ข้าวผัดผักรวมเต้าหู้",
        "priceBaht": 75,
        "ingredients": [
          "rice",
          "vegetable",
          "carrot",
          "tofu",
          "soy",
          "oil"
        ],
        "flavorTags": [
          "mild",
          "savory"
        ],
        "textureTags": []
      },
      {
        "name": "สลัดผักสดน้ำมะนาว",
        "priceBaht": 80,
        "ingredients": [
          "lettuce",
          "carrot",
          "tomato",
          "lime"
        ],
        "flavorTags": [
          "sour"
        ],
        "textureTags": [
          "fresh"
        ]
      }
    ]
  },
  {
    "name": "ไก่ย่างลานไผ่",
    "dishes": [
      {
        "name": "ข้าวเหนียวไก่ย่างตะไคร้",
        "priceBaht": 85,
        "ingredients": [
          "chicken",
          "rice",
          "lemongrass",
          "salt"
        ],
        "flavorTags": [
          "savory"
        ],
        "textureTags": [
          "grilled"
        ]
      },
      {
        "name": "ข้าวไก่ทอดกระเทียม",
        "priceBaht": 80,
        "ingredients": [
          "chicken",
          "rice",
          "garlic",
          "soy",
          "oil"
        ],
        "flavorTags": [
          "savory"
        ],
        "textureTags": [
          "crispy"
        ]
      }
    ]
  },
  {
    "name": "ครัวหมูริมคลอง",
    "dishes": [
      {
        "name": "ข้าวคอหมูย่าง",
        "priceBaht": 90,
        "ingredients": [
          "pork",
          "rice",
          "soy"
        ],
        "flavorTags": [
          "savory"
        ],
        "textureTags": [
          "grilled"
        ]
      },
      {
        "name": "ข้าวหมูสับผัดกะเพรา",
        "priceBaht": 75,
        "ingredients": [
          "pork",
          "rice",
          "basil",
          "chili",
          "soy",
          "oil"
        ],
        "flavorTags": [
          "spicy",
          "savory"
        ],
        "textureTags": []
      }
    ]
  },
  {
    "name": "ก๋วยเตี๋ยวบ้านเส้นสด",
    "dishes": [
      {
        "name": "ก๋วยเตี๋ยวเส้นเล็กเนื้อวัวตุ๋น",
        "priceBaht": 95,
        "ingredients": [
          "rice_noodle",
          "beef",
          "water",
          "soy",
          "garlic"
        ],
        "flavorTags": [
          "savory"
        ],
        "textureTags": [
          "brothy",
          "chewy"
        ],
        "noodleStyle": "broth"
      },
      {
        "name": "เส้นใหญ่ผัดซีอิ๊วหมู",
        "priceBaht": 80,
        "ingredients": [
          "rice_noodle",
          "pork",
          "egg",
          "kale",
          "soy",
          "oil"
        ],
        "flavorTags": [
          "savory"
        ],
        "textureTags": [
          "chewy"
        ],
        "noodleStyle": "stir_fried"
      }
    ]
  },
  {
    name: "โรงรมควันขาวัว",
    dishes: [
      {
        name: "เนื้อค้อนธอร์รมควัน (ขาวัวติดกระดูก)",
        priceBaht: 245,
        ingredients: ["beef", "salt", "black_pepper"],
        flavorTags: ["savory"],
        textureTags: [],
      },
      {
        name: "ข้าวหน้าเสือร้องไห้ย่างจิ้มแจ่ว",
        priceBaht: 135,
        ingredients: ["beef", "rice", "fish", "chili", "lime", "shallot"],
        flavorTags: ["savory", "spicy", "sour"],
        textureTags: ["grilled"],
      },
      {
        name: "เกาเหลาเนื้อน่องลายตุ๋น",
        priceBaht: 110,
        ingredients: ["beef", "water", "radish", "soy", "garlic", "star_anise"],
        flavorTags: ["mild", "savory"],
        textureTags: ["brothy"],
      },
      {
        name: "ข้าวกะเพราเนื้อวัวสับ",
        priceBaht: 95,
        ingredients: ["beef", "rice", "basil", "garlic", "chili", "soy", "oil"],
        flavorTags: ["spicy", "savory"],
        textureTags: [],
      },
    ],
  },
];

/** Fictional author-created fixtures. No venue, price, ingredient or certification is live. */
export function generateCatalog(): Restaurant[] {
  const names = [
    "ครัวบ้านสวน",
    "ครัวอิ่มผัก",
    "ข้าวหอมเตาย่าง",
    "ชามพิเศษ",
    "ครัวหมูรสจัด",
    "ครัวหอมเครื่องเทศ",
    "จานย่างริมสวน",
    "หม้อไฟบ้านอุ่น",
    "ครัวตลาดเช้า",
    "กับข้าวบ้านเรา",
    "ร้านเส้นน้ำใส",
    "ครัวแกงหอม",
    ...specialtyShops.map((shop) => shop.name),
  ];
  const baseMenus: Omit<Menu, "id">[] = [
    {
      name: "ข้าวเต้าหู้ทอดกรอบ",
      prices: { dine_in: 8000, delivery: 9000 },
      ingredients: ["tofu", "rice", "soy", "oil"],
      ingredientsComplete: true,
      dietaryEvidence: {},
      crossContactEvidence: {},
      cuisineTags: ["thai"],
      flavorTags: ["savory", "mild"],
      textureTags: ["crispy"],
      available: true,
      priceIncludesFees: true,
    },
    {
      name: "ข้าวไก่ย่างรสอ่อน",
      prices: { dine_in: 8500, delivery: 9500 },
      ingredients: ["chicken", "rice", "soy"],
      ingredientsComplete: true,
      dietaryEvidence: {},
      crossContactEvidence: {},
      cuisineTags: ["thai"],
      flavorTags: ["savory", "mild"],
      textureTags: ["grilled"],
      available: true,
      priceIncludesFees: true,
    },
    {
      name: "ข้าวเต้าหู้ผัดพริก",
      prices: { dine_in: 8500, delivery: 9500 },
      ingredients: ["tofu", "rice", "chili", "soy"],
      ingredientsComplete: true,
      dietaryEvidence: {},
      crossContactEvidence: {},
      cuisineTags: ["thai"],
      flavorTags: ["spicy", "savory"],
      textureTags: ["fresh"],
      available: true,
      priceIncludesFees: true,
    },
    {
      name: "ก๋วยเตี๋ยวน้ำซุปผัก",
      prices: { dine_in: 7500, delivery: 8500 },
      ingredients: ["wheat", "vegetable", "soy"],
      ingredientsComplete: true,
      dietaryEvidence: {},
      crossContactEvidence: {},
      cuisineTags: ["chinese"],
      flavorTags: ["mild", "savory"],
      textureTags: ["brothy", "chewy"],
      available: true,
      priceIncludesFees: true,
    },
    {
      name: "สลัดไก่ย่าง",
      prices: { dine_in: 9000, delivery: 10000 },
      ingredients: ["chicken", "lettuce", "lime"],
      ingredientsComplete: true,
      dietaryEvidence: {},
      crossContactEvidence: {},
      cuisineTags: ["western"],
      flavorTags: ["sour", "mild"],
      textureTags: ["fresh", "grilled"],
      available: true,
      priceIncludesFees: true,
    },
  ];
  return names.map((name, index) => {
    const n = index + 1,
      id = `r${String(n).padStart(2, "0")}`;
    const specialty = specialtyShops.find((shop) => shop.name === name);
    const dishes: Omit<Menu, "id">[] = specialty ? specialty.dishes.map(({ priceBaht, ...dish }) => ({
      ...structuredClone(dish),
      prices: { dine_in: priceBaht * 100, delivery: (priceBaht + 10) * 100 },
      ingredientsComplete: true,
      dietaryEvidence: {},
      crossContactEvidence: {},
      cuisineTags: ["thai"],
      available: true,
      priceIncludesFees: true,
    })) : baseMenus;
    const menus: Menu[] = dishes.map((base, itemIndex) => ({
      ...structuredClone(base),
      id: `${id}-m${String(itemIndex + 1).padStart(2, "0")}`,
    }));
    if (n === 2) {
      menus[1].name = "ข้าวเห็ดรสอ่อน";
      menus[1].ingredients = ["mushroom", "rice", "soy"];
      menus[4].name = "สลัดเห็ดย่าง";
      menus[4].ingredients = ["mushroom", "lettuce", "lime"];
      menus.forEach((m) => {
        m.prices = {
          dine_in: m.prices.dine_in! - 500,
          delivery: m.prices.delivery! - 500,
        };
      });
      menus[3].textureTags = ["chewy"];
    }
    if (n === 3) {
      menus[0].name = "ข้าวเห็ดทอดกรอบ";
      menus[0].ingredients = ["mushroom", "rice", "soy", "oil"];
      menus[2].name = "ข้าวไก่ย่างรสเผ็ด";
      menus[2].ingredients = ["chicken", "rice", "chili", "soy"];
      menus[2].textureTags = ["grilled"];
      menus[4].name = "สลัดเต้าหู้ย่าง";
      menus[4].ingredients = ["tofu", "lettuce", "lime"];
      menus[3].textureTags = ["brothy"];
    }
    if (n === 4) {
      menus.forEach((m) => {
        m.prices = { dine_in: 13000, delivery: 14000 };
      });
      menus[0].flavorTags = ["savory", "mild", "spicy"];
      menus[0].textureTags = ["crispy", "brothy", "chewy"];
      menus[0].name = "ก๋วยเตี๋ยวซุปเผ็ดเต้าหู้กรอบ";
      menus[0].ingredients = ["tofu", "wheat", "vegetable", "chili", "soy"];
    }
    if (n === 5) {
      menus.forEach((m, i) => {
        m.name = [
          "ข้าวหมูผัดเผ็ด",
          "ข้าวหน้าหมูรสอ่อน",
          "ข้าวหมูผัดพริก",
          "ก๋วยเตี๋ยวน้ำหมู",
          "สลัดหมูย่าง",
        ][i];
        m.ingredients = [
          ...m.ingredients.filter((t) => t !== "chicken" && t !== "tofu"),
          "pork",
        ];
        m.flavorTags = ["spicy", "savory"];
      });
    }
    if (n === 6)
      menus.forEach((m) => {
        m.cuisineTags = ["indian"];
        m.flavorTags = ["savory"];
        m.textureTags = ["creamy"];
        m.name = `${m.name}ซอสครีม`;
      });
    if (n === 7)
      menus.forEach((m) => {
        m.cuisineTags = ["western"];
        m.flavorTags = ["savory", "mild"];
        m.textureTags = ["grilled"];
        m.name = `${m.name}สูตรเตาถ่าน`;
      });
    if (n === 9)
      menus.forEach((m) => {
        m.prices = { dine_in: null, delivery: null };
      });
    if (n === 10)
      menus.forEach((m) => {
        m.ingredientsComplete = false;
        m.ingredients = [];
      });
    if (n === 11) {
      menus.forEach((m) => {
        m.flavorTags = ["mild"];
        m.textureTags = ["brothy", "chewy"];
        m.cuisineTags = ["japanese"];
        m.name = ["ราเมนเต้าหู้", "ราเมนไก่", "ราเมนเต้าหู้รสเผ็ด", "ราเมนผัก", "ราเมนไก่ย่าง"][Number(m.id.slice(-2)) - 1];
      });
      menus[2].available = false;
    }
    if (n === 12) {
      menus.forEach((m) => {
        m.name = `${m.name}ซอสแกงเครื่องเทศ`;
        m.cuisineTags = ["indian"];
        m.textureTags = ["creamy"];
        m.flavorTags = ["spicy", "savory"];
        m.prices = {
          dine_in: m.prices.dine_in! + 1500,
          delivery: m.prices.delivery! + 1500,
        };
      });
    }
    if (n === 2) menus[3].name = "ก๋วยเตี๋ยวผัดผัก";
    for (const menu of menus) {
      if (/ก๋วยเตี๋ยว|ราเมน/.test(menu.name)) menu.noodleStyle = n === 2 ? "stir_fried" : "broth";
      const vegetarian =
        menu.ingredientsComplete &&
        !menu.ingredients.some((i) =>
          ["chicken", "pork", "beef", "fish", "shrimp"].includes(i),
        );
      if (vegetarian)
        menu.dietaryEvidence.vegetarian = {
          verified: true,
          evidenceId: `seed:${menu.id}:veg`,
        };
      // A single explicit seed evidence example; other dishes have unknown allergy evidence.
      if (n === 2 && menu.id.endsWith("m01")) {
        menu.dietaryEvidence["absence:peanut"] = {
          verified: true,
          evidenceId: `seed:${menu.id}:peanut-absence`,
        };
        menu.crossContactEvidence.peanut = {
          verified: true,
          evidenceId: `seed:${menu.id}:peanut-cross-contact`,
        };
      }
    }
    return {
      id,
      name: `ร้านจำลอง ${name}`,
      areaId: "bangkok_demo",
      dataOrigin: "synthetic",
      catalogVersion: "seed-v2",
      channels:
        n === 6
          ? ["delivery"]
          : n === 7
            ? ["dine_in"]
            : ["dine_in", "delivery"],
      available: n !== 8,
      distanceM: n === 9 ? null : 300 + n * 100,
      feeQuote:
        n === 10
          ? null
          : {
              currency: "THB",
              deliveryFeeSatang: n <= 4 ? 4000 : 4001,
              serviceFeeSatang: 0,
              source: "synthetic",
            },
      menus,
    };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const catalog = generateCatalog();
  writeFileSync(
    new URL("../data/catalog.seed.json", import.meta.url),
    JSON.stringify(catalog, null, 2) + "\n",
  );
  console.log(
    `Generated ${catalog.length} synthetic restaurants / ${catalog.reduce((n, r) => n + r.menus.length, 0)} menus, seed-v2`,
  );
}
