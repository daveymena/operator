const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(
  "C:\\Users\\ADMIN\\Videos\\Agent-Sales-Bot\\artifacts\\api-server\\data",
  "tecnovariedades.db"
);
const db = new Database(dbPath);

const products = db.prepare("SELECT id, name, price, category, description, image_url, isActive FROM products ORDER BY id").all();
console.log("Productos:", products.length);
for (const p of products) {
  console.log("#" + p.id + " | " + p.name + " | $" + p.price + " | " + (p.category || "sin cat") + " | activo: " + p.isActive);
}

const cats = db.prepare("SELECT * FROM product_categories").all();
console.log("\nCategorias:", cats.length);
for (const c of cats) {
  console.log("#" + c.id + " | " + c.name + " | slug: " + c.slug);
}

db.close();
