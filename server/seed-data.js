"use strict";

const DEFAULT_SETTINGS = {
  shop_name: "Trippers Coffee",
  shop_tagline: "Good coffee. Good trips. Good memories.",
  address: "24 Katipunan Avenue, Quezon City, Metro Manila",
  contact: "+63 917 555 0142",
  email: "hello@tripperscoffee.com",
  currency: "PHP",
  currency_symbol: "₱",
  tax_rate: "0.12",
  service_charge: "0",
  payment_methods: JSON.stringify(["Cash", "GCash", "Card", "Maya"]),
  receipt_header: "TRIPPERS COFFEE",
  receipt_footer: "Thank you for tripping with us. Good coffee. Good trips. Good memories.",
  receipt_show_logo: "1",
  low_stock_alerts: "1",
  session_timeout_minutes: "720",
  auto_print_receipt: "0",
  senior_discount_percent: "20",
  pwd_discount_percent: "20",
  setup_complete: "0"
};

const ROLES = [
  { name: "admin", label: "Administrator", permissions: ["*"] },
  {
    name: "cashier",
    label: "Cashier",
    permissions: [
      "pos.dashboard", "orders.create", "orders.read.own", "payments.process",
      "receipts.print", "customers.manage", "shift.manage", "account.self"
    ]
  }
];

const CATEGORIES = [
  "Hot Coffee", "Cold Coffee", "Frappuccino", "Tea",
  "Non-Coffee Drinks", "Bakery", "Snacks", "Other Products"
];

const ADDONS = [
  ["Extra Espresso", 20], ["Extra Shot", 20], ["Whipped Cream", 15],
  ["Caramel", 10], ["Vanilla", 10], ["Additional Milk", 15]
];

const SUPPLIERS = [
  ["Batangas Coffee Roasters", "+63 918 220 1180", "orders@batangasroasters.ph", "Single-origin beans, weekly delivery"],
  ["DairyFresh Philippines", "+63 917 884 5521", "trade@dairyfresh.ph", "Milk and cream, delivers Mon/Wed/Fri"],
  ["Sweetline Syrups", "+63 920 665 3320", "sales@sweetlinesyrups.ph", "Syrups, powders, and sugar"],
  ["EcoPack Supplies", "+63 995 441 7782", "support@ecopack.ph", "Cups, lids, and packaging"],
  ["Bakehouse Manila", "+63 927 310 8890", "hello@bakehousemanila.ph", "Fresh pastries every morning"]
];

const INGREDIENTS = [
  ["Espresso Beans", "Coffee Beans", "g", 5000, 1000, 0.9, "Batangas Coffee Roasters"],
  ["Fresh Milk", "Milk", "ml", 18000, 4000, 0.12, "DairyFresh Philippines"],
  ["Condensed Milk", "Milk", "ml", 4500, 1000, 0.15, "DairyFresh Philippines"],
  ["Caramel Syrup", "Syrups", "ml", 2600, 600, 0.35, "Sweetline Syrups"],
  ["Vanilla Syrup", "Syrups", "ml", 2800, 600, 0.35, "Sweetline Syrups"],
  ["Chocolate Syrup", "Syrups", "ml", 2400, 600, 0.35, "Sweetline Syrups"],
  ["Hazelnut Syrup", "Syrups", "ml", 1800, 400, 0.4, "Sweetline Syrups"],
  ["Strawberry Syrup", "Syrups", "ml", 1700, 400, 0.4, "Sweetline Syrups"],
  ["Matcha Powder", "Tea", "g", 140, 250, 1.6, "Kyoto Leaf Trading"],
  ["Ube Powder", "Other Supplies", "g", 900, 200, 1.2, "Sweetline Syrups"],
  ["Tea Leaves", "Tea", "g", 1400, 300, 0.8, "Kyoto Leaf Trading"],
  ["Whipped Cream", "Milk", "ml", 320, 500, 0.25, "DairyFresh Philippines"],
  ["Sugar", "Sugar", "g", 4600, 1000, 0.05, "Sweetline Syrups"],
  ["Cup 16oz", "Cups", "pcs", 780, 150, 4.5, "EcoPack Supplies"],
  ["Cup 22oz", "Cups", "pcs", 420, 120, 5.5, "EcoPack Supplies"],
  ["Lids", "Lids", "pcs", 1150, 250, 1.2, "EcoPack Supplies"],
  ["Butter Croissant", "Packaging", "pcs", 58, 15, 32, "Bakehouse Manila"],
  ["Blueberry Muffin", "Packaging", "pcs", 38, 12, 22, "Bakehouse Manila"],
  ["Granola Bar", "Packaging", "pcs", 46, 10, 18, "Bakehouse Manila"],
  ["Cheese Roll", "Packaging", "pcs", 34, 10, 15, "Bakehouse Manila"]
];

const PRODUCTS = [
  ["Cafe Latte", "Hot Coffee", 49, "☕", 1, "Silky espresso and steamed milk with a delicate crema.", [["Espresso Beans", 18], ["Fresh Milk", 180], ["Cup 16oz", 1], ["Lids", 1]]],
  ["Americano", "Hot Coffee", 49, "☕", 1, "Bold espresso shots mellowed with hot water.", [["Espresso Beans", 20], ["Cup 16oz", 1], ["Lids", 1]]],
  ["Spanish Latte", "Hot Coffee", 59, "☕", 1, "Espresso with sweetened condensed milk and steamed milk.", [["Espresso Beans", 18], ["Fresh Milk", 120], ["Condensed Milk", 40], ["Cup 16oz", 1], ["Lids", 1]]],
  ["Mocha Latte", "Hot Coffee", 59, "☕", 1, "Espresso, chocolate, and velvety steamed milk.", [["Espresso Beans", 18], ["Fresh Milk", 160], ["Chocolate Syrup", 20], ["Cup 16oz", 1], ["Lids", 1]]],
  ["Caramel Macchiato", "Hot Coffee", 69, "☕", 1, "Layered espresso and milk with a caramel finish.", [["Espresso Beans", 18], ["Fresh Milk", 180], ["Caramel Syrup", 20], ["Cup 16oz", 1], ["Lids", 1]]],
  ["Salted Caramel", "Hot Coffee", 69, "☕", 1, "Sweet caramel with a whisper of sea salt.", [["Espresso Beans", 18], ["Fresh Milk", 160], ["Caramel Syrup", 25], ["Cup 16oz", 1], ["Lids", 1]]],
  ["French Vanilla", "Hot Coffee", 69, "☕", 1, "Classic vanilla latte with a smooth, aromatic finish.", [["Espresso Beans", 18], ["Fresh Milk", 160], ["Vanilla Syrup", 25], ["Cup 16oz", 1], ["Lids", 1]]],
  ["Iced Caramel Latte", "Cold Coffee", 79, "🧋", 1, "Espresso over ice with caramel drizzle and cold milk.", [["Espresso Beans", 18], ["Fresh Milk", 160], ["Caramel Syrup", 20], ["Cup 22oz", 1], ["Lids", 1]]],
  ["White Mocha", "Cold Coffee", 69, "🧋", 1, "Chilled espresso with white chocolate and milk.", [["Espresso Beans", 18], ["Fresh Milk", 160], ["Chocolate Syrup", 20], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Hazelnut Cold Brew", "Cold Coffee", 69, "🧋", 1, "Slow-steeped coffee with roasted hazelnut.", [["Espresso Beans", 18], ["Fresh Milk", 160], ["Hazelnut Syrup", 20], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Vietnamese Iced", "Cold Coffee", 69, "🧋", 1, "Strong coffee with a generous pour of condensed milk.", [["Espresso Beans", 22], ["Condensed Milk", 50], ["Fresh Milk", 80], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Strawberry Frappe", "Frappuccino", 89, "🥤", 1, "Blended strawberry and milk topped with whipped cream.", [["Strawberry Syrup", 40], ["Fresh Milk", 120], ["Whipped Cream", 40], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Oreo Matcha Frappe", "Frappuccino", 89, "🥤", 1, "Earthy matcha blended smooth with cookie crumble.", [["Matcha Powder", 8], ["Fresh Milk", 150], ["Whipped Cream", 40], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Cookies & Cream Frappe", "Frappuccino", 89, "🥤", 1, "Chocolate cookie frappe with a creamy finish.", [["Chocolate Syrup", 20], ["Fresh Milk", 150], ["Whipped Cream", 40], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Ube Frappe", "Frappuccino", 89, "🥤", 1, "Purple yam blended with milk and topped with cream.", [["Ube Powder", 15], ["Fresh Milk", 150], ["Whipped Cream", 40], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Caramel Frappe", "Frappuccino", 89, "🥤", 1, "Coffee frappe with caramel and whipped cream.", [["Espresso Beans", 18], ["Fresh Milk", 140], ["Caramel Syrup", 25], ["Whipped Cream", 40], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Matcha Latte", "Tea", 79, "🍵", 1, "Ceremonial matcha whisked with silky steamed milk.", [["Matcha Powder", 6], ["Fresh Milk", 180], ["Cup 16oz", 1], ["Lids", 1]]],
  ["Iced Green Tea", "Tea", 59, "🍵", 1, "Light, citrusy green tea served over ice.", [["Tea Leaves", 8], ["Sugar", 10], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Dirty Matcha", "Tea", 89, "🍵", 1, "Matcha latte with a bold espresso shot.", [["Matcha Powder", 6], ["Espresso Beans", 18], ["Fresh Milk", 160], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Iced Choco", "Non-Coffee Drinks", 59, "🥛", 1, "Rich chocolate milk poured over ice.", [["Chocolate Syrup", 30], ["Fresh Milk", 160], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Strawberry Latte", "Non-Coffee Drinks", 59, "🥛", 1, "Sweet strawberry milk with a creamy texture.", [["Strawberry Syrup", 35], ["Fresh Milk", 160], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Biscoff Latte", "Non-Coffee Drinks", 79, "🥛", 1, "Caramelized biscuit flavour in every sip.", [["Fresh Milk", 170], ["Caramel Syrup", 15], ["Whipped Cream", 20], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Nutella Latte", "Non-Coffee Drinks", 79, "🥛", 1, "Hazelnut chocolate milk, served cold.", [["Chocolate Syrup", 25], ["Fresh Milk", 170], ["Whipped Cream", 20], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Fruit Soda", "Non-Coffee Drinks", 49, "🥤", 1, "Sparkling fruit soda with a strawberry lift.", [["Strawberry Syrup", 30], ["Sugar", 10], ["Cup 22oz", 1], ["Lids", 1]]],
  ["Butter Croissant", "Bakery", 85, "🥐", 0, "Flaky, golden layers made with real butter.", [["Butter Croissant", 1]]],
  ["Chocolate Croissant", "Bakery", 95, "🥐", 0, "Buttery pastry filled with dark chocolate.", [["Butter Croissant", 1], ["Chocolate Syrup", 10]]],
  ["Blueberry Muffin", "Bakery", 70, "🧁", 0, "Tender muffin with bright blueberries.", [["Blueberry Muffin", 1]]],
  ["Honey Granola Bar", "Snacks", 65, "🍫", 0, "Chewy oat bar with honey and seeds.", [["Granola Bar", 1]]],
  ["Cheese Roll", "Snacks", 55, "🥖", 0, "Warm cheese-filled bread roll.", [["Cheese Roll", 1]]],
  ["Bottled Water", "Other Products", 20, "💧", 0, "Chilled 500ml mineral water.", []]
];

const DISCOUNTS = [
  ["Senior Citizen", "percent", 20, 1],
  ["PWD", "percent", 20, 1],
  ["Employee Meal", "percent", 15, 0],
  ["Promo - ₱20 Off", "fixed", 20, 0]
];

module.exports = {
  DEFAULT_SETTINGS,
  ROLES,
  CATEGORIES,
  ADDONS,
  SUPPLIERS,
  INGREDIENTS,
  PRODUCTS,
  DISCOUNTS
};
