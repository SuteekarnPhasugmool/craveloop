import photos from "../../../data/food-photos.json";

const categories: Record<string, keyof typeof photos> = {
  "30969": "coffee",
  "30970": "tea",
  "30971": "cake",
  "30972": "icecream",
  "30964": "rice",
  "30965": "noodles",
  "30966": "pork",
  "30967": "rice",
  "30968": "porridge",
  "30973": "fried",
  "30974": "burger",
  "30975": "pizza",
  "30976": "salad",
  "30977": "seafood",
  "30978": "beef",
  "30979": "sushi",
  "30980": "rice",
  "30981": "pasta",
  "30982": "soup",
  "30983": "dumpling",
  "30984": "fruit",
  "30985": "salad",
};

export default function FoodPhoto({
  menuId,
  menuName,
}: {
  menuId: string;
  menuName: string;
}) {
  const category = menuId.match(/^sf-demo-(\d+)-/)?.[1];
  const name = menuName.toLowerCase();
  let key = categories[category ?? ""];
  if (!key) {
    key = /noodle|broth/.test(name)
      ? "noodles"
      : /salad/.test(name)
        ? "salad"
        : /pork/.test(name)
          ? "pork"
          : /tofu|mushroom/.test(name)
            ? "tofu"
            : /curry|creamy/.test(name)
              ? "rice"
              : "fried";
  }
  const photo = photos[key];
  return (
    <img
      className="dh-food-art"
      src={photo.src}
      alt={`ภาพถ่ายอาหารตัวอย่าง · ${photo.alt}`}
      loading="lazy"
    />
  );
}
