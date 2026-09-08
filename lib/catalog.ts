export type Category = "All items" | "Everyday wear" | "Sets" | "Outerwear";

export type Variant = {
  id: string;
  label: string;
  color: string;
  stock: number;
};

export type Product = {
  id: string;
  name: string;
  category: Exclude<Category, "All items">;
  price: number;
  description: string;
  image: string;
  imageAlt: string;
  featured?: boolean;
  variants: Variant[];
};

export const products: Product[] = [
  {
    id: "sunny-day-set",
    name: "Sunny day set",
    category: "Sets",
    price: 3900,
    description: "A soft cotton top and short set made for play, naps, and sunny days.",
    image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Child wearing a light blue outfit",
    featured: true,
    variants: [
      { id: "sunny-sand-2-3", label: "2 - 3 yrs", color: "Sand", stock: 5 },
      { id: "sunny-sand-4-6", label: "4 - 6 yrs", color: "Sand", stock: 2 },
      { id: "sunny-sand-7-10", label: "7 - 10 yrs", color: "Sand", stock: 0 },
    ],
  },
  {
    id: "little-explorer-set",
    name: "Little explorer set",
    category: "Sets",
    price: 4500,
    description: "An easy two-piece set with room to move through every little adventure.",
    image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Child wearing a comfortable neutral outfit",
    featured: true,
    variants: [
      { id: "explorer-ink-2-3", label: "2 - 3 yrs", color: "Ink", stock: 4 },
      { id: "explorer-ink-4-6", label: "4 - 6 yrs", color: "Ink", stock: 6 },
      { id: "explorer-ink-7-10", label: "7 - 10 yrs", color: "Ink", stock: 1 },
    ],
  },
  {
    id: "playtime-tee",
    name: "Playtime tee",
    category: "Everyday wear",
    price: 2200,
    description: "A soft, hard-working cotton tee for playtime, story time, and everything between.",
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Child wearing a comfortable cotton tee",
    variants: [
      { id: "tee-white-2-3", label: "2 - 3 yrs", color: "White", stock: 8 },
      { id: "tee-white-4-6", label: "4 - 6 yrs", color: "White", stock: 5 },
      { id: "tee-white-7-10", label: "7 - 10 yrs", color: "White", stock: 0 },
    ],
  },
  {
    id: "cloud-light-jacket",
    name: "Cloud-light jacket",
    category: "Outerwear",
    price: 6800,
    description: "A lightweight layer for cool mornings, evening walks, and changing weather.",
    image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Child wearing a lightweight jacket",
    featured: true,
    variants: [
      { id: "jacket-black-2-3", label: "2 - 3 yrs", color: "Black", stock: 3 },
      { id: "jacket-black-4-6", label: "4 - 6 yrs", color: "Black", stock: 4 },
      { id: "jacket-black-7-10", label: "7 - 10 yrs", color: "Black", stock: 0 },
    ],
  },
];

export const categories: Category[] = ["All items", "Everyday wear", "Sets", "Outerwear"];

export const formatPrice = (price: number) => `KSh ${price.toLocaleString("en-KE")}`;

export const getAvailableStock = (product: Product) => product.variants.reduce((total, variant) => total + variant.stock, 0);
