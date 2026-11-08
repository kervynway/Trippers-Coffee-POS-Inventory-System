(() => {
  "use strict";

  const STORAGE = {
    cart: "trippersCart",
    orders: "trippersOrders",
    inventory: "trippersAdminInventory",
    loyalty: "trippersLoyaltyCustomers",
    cardInventory: "trippersLoyaltyCardInventory",
    activeCustomer: "trippersActiveLoyaltyCustomer",
    loyaltyEmail: "trippersLoyaltyEmail",
    customerName: "trippersCustomerName",
    cardStyle: "trippersLoyaltyCardStyle"
  };
  const TAX_RATE = 0.12;
  const LOYALTY_THRESHOLD = 5;
  const DEFAULT_CARD_STOCK = 84;
  const DEFAULT_CARD_STYLE = "classic";
  const CARD_STYLE_NAMES = { classic: "Member", gold: "Gold", platinum: "Platinum", midnight: "Midnight" };
  const SIZE_PRICES = { Small: 0, Medium: 20, Large: 40 };
  const ADDON_PRICES = { "Extra shot": 10, Upsize: 20 };

  const image = (id, width = 700) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=84`;
  const CATEGORY_ART = {
    Coffee: [image("photo-1495474472287-4d71bcdd2085"), image("photo-1461023058943-07fcbe16d735"), image("photo-1509042239860-f550ce710b93")],
    "Non-Coffee": [image("photo-1541167760496-1628856ab772"), image("photo-1517701604599-bb29b565090c")],
    "Premium Non-Coffee": [image("photo-1572442388796-11668a67e53d")],
    Frappe: [image("photo-1572442388796-11668a67e53d"), image("photo-1541167760496-1628856ab772")],
    "Ube Series": [image("photo-1517701604599-bb29b565090c")],
    "Matcha Series": [image("photo-1515823064-d6e0c04616a7")]
  };
  const CATEGORY_EMOJI = { Coffee: "☕", "Non-Coffee": "🥤", "Premium Non-Coffee": "🥤", Frappe: "🧊", "Ube Series": "🍠", "Matcha Series": "🍵" };
  const CATEGORY_DESCRIPTION = {
    Coffee: "Fresh espresso with silky steamed milk.",
    "Non-Coffee": "Creamy, chilled, and made without espresso.",
    "Premium Non-Coffee": "A richer pour with premium house syrups.",
    Frappe: "Blended with ice for a smooth, frosty sip.",
    "Ube Series": "Real ube with a mellow, nutty sweetness.",
    "Matcha Series": "Ceremonial matcha whisked to a soft finish."
  };

  const DESCRIPTIONS = {
    "cafe-latte": "Espresso and silky steamed milk, soft and balanced.",
    americano: "Double espresso lengthened with hot water. Clean and bold.",
    vietnamese: "Dark roast with sweetened condensed milk over ice.",
    "spanish-latte": "Espresso, condensed milk, and a rich, sweet finish.",
    "mocha-latte": "Espresso and cocoa with steamed milk.",
    "white-mocha": "White chocolate, espresso, and velvety milk.",
    "caramel-latte": "Buttery caramel swirled through espresso and milk.",
    hazelnut: "Nutty hazelnut syrup with a smooth espresso base.",
    "caramel-hazelnut": "Caramel and hazelnut together in one warm cup.",
    "caramel-macchiato": "Layered espresso, milk, and a caramel drizzle.",
    "caramel-mocha": "Chocolate, caramel, and espresso in a cozy cup.",
    "salted-caramel": "Sweet caramel with a bright pinch of sea salt.",
    "french-vanilla": "Classic vanilla and espresso with steamed milk.",
    "iced-choco": "Rich chocolate milk poured over ice.",
    "strawberry-latte": "Strawberry and milk, chilled and creamy.",
    "strawberry-oreo": "Strawberries, cookie crumble, and cold milk.",
    "cookies-and-cream": "Cookie crumble blended into sweet cold milk.",
    "choco-hazelnut": "Chocolate and hazelnut in a chilled, creamy sip.",
    "fruit-soda": "Sparkling fruit soda over ice, light and bright.",
    "vanilla-strawberry": "Strawberry and vanilla with a soft, sweet finish.",
    "white-cookie": "White chocolate and cookie crumbs, served cold.",
    "biscoff-latte": "Caramelized biscuit spread folded into a creamy latte.",
    "nutella-latte": "Hazelnut cocoa spread melted into espresso and milk.",
    "strawberry-frappe": "Strawberries blended with ice and a creamy base.",
    "oreo-matcha-frappe": "Matcha, cookie crumble, and ice, blended smooth.",
    "cookies-cream-frappe": "Cookies and cream blended into a frosty treat.",
    "ube-frappe": "Ube and ice blended into a sweet purple shake.",
    "caramel-frappe": "Caramel, coffee, and ice blended until frosty.",
    "chocolate-frappe": "Chocolate and ice blended into a rich, cold sip.",
    "ube-latte": "Ube and steamed milk with a mellow sweetness.",
    "ube-oreo": "Ube, cookie crumble, and creamy milk.",
    "cafe-ube": "Espresso meets ube in a smooth, layered cup.",
    "ube-matcha": "Earthy matcha and sweet ube together.",
    "matcha-latte": "Ceremonial matcha whisked with silky milk.",
    "oreo-matcha": "Matcha and cookie crumble over ice.",
    "dirty-matcha": "Matcha latte with a bold shot of espresso.",
    "matcha-strawberry": "Matcha and strawberry layers, sweet and bright."
  };
  const product = (id, name, category, price, featured = false) => ({ id, name, category, price, featured, description: DESCRIPTIONS[id] || CATEGORY_DESCRIPTION[category], emoji: CATEGORY_EMOJI[category] });
  const products = [
    product("cafe-latte", "Cafe Latte", "Coffee", 49, true),
    product("americano", "Americano", "Coffee", 49),
    product("vietnamese", "Vietnamese", "Coffee", 59),
    product("spanish-latte", "Spanish Latte", "Coffee", 59),
    product("mocha-latte", "Mocha Latte", "Coffee", 59),
    product("white-mocha", "White Mocha", "Coffee", 59),
    product("caramel-latte", "Caramel Latte", "Coffee", 59),
    product("hazelnut", "Hazelnut", "Coffee", 59),
    product("caramel-hazelnut", "Caramel Hazelnut", "Coffee", 59),
    product("caramel-macchiato", "Caramel Macchiato", "Coffee", 69, true),
    product("caramel-mocha", "Caramel Mocha", "Coffee", 69),
    product("salted-caramel", "Salted Caramel", "Coffee", 69),
    product("french-vanilla", "French Vanilla", "Coffee", 69),
    product("iced-choco", "Iced Choco", "Non-Coffee", 49),
    product("strawberry-latte", "Strawberry Latte", "Non-Coffee", 49),
    product("strawberry-oreo", "Strawberry Oreo", "Non-Coffee", 59),
    product("cookies-and-cream", "Cookies and Cream", "Non-Coffee", 59),
    product("choco-hazelnut", "Choco Hazelnut", "Non-Coffee", 59),
    product("fruit-soda", "Fruit Soda", "Non-Coffee", 49),
    product("vanilla-strawberry", "Vanilla Strawberry", "Non-Coffee", 59),
    product("white-cookie", "White Cookie", "Non-Coffee", 69),
    product("biscoff-latte", "Biscoff Latte", "Premium Non-Coffee", 79),
    product("nutella-latte", "Nutella Latte", "Premium Non-Coffee", 79),
    product("strawberry-frappe", "Strawberry", "Frappe", 89),
    product("oreo-matcha-frappe", "Oreo Matcha", "Frappe", 89),
    product("cookies-cream-frappe", "Cookies and Cream", "Frappe", 89),
    product("ube-frappe", "Ube", "Frappe", 89),
    product("caramel-frappe", "Caramel", "Frappe", 89),
    product("chocolate-frappe", "Chocolate", "Frappe", 89),
    product("ube-latte", "Ube Latte", "Ube Series", 59),
    product("ube-oreo", "Ube Oreo", "Ube Series", 69),
    product("cafe-ube", "Cafe Ube", "Ube Series", 69),
    product("ube-matcha", "Ube Matcha", "Ube Series", 69),
    product("matcha-latte", "Matcha Latte", "Matcha Series", 59, true),
    product("oreo-matcha", "Oreo Matcha", "Matcha Series", 59),
    product("dirty-matcha", "Dirty Matcha", "Matcha Series", 59),
    product("matcha-strawberry", "Matcha Strawberry", "Matcha Series", 59, true)
  ];
  const productMap = new Map(products.map((item) => [item.id, item]));
  products.forEach((item, index) => {
    const art = CATEGORY_ART[item.category] || CATEGORY_ART.Coffee;
    item.image = art[index % art.length];
    item.badge = item.featured ? "Best Seller" : "";
  });

  const OPTION_GROUPS = [
    { key: "size", label: "Size", required: true, choices: [{ label: "Small", price: 0 }, { label: "Medium", price: 20 }, { label: "Large", price: 40 }] },
    { key: "temperature", label: "Temperature", required: true, choices: [{ label: "Hot", price: 0 }, { label: "Iced", price: 0 }] },
    { key: "sugar", label: "Sugar level", choices: [{ label: "Normal", price: 0 }, { label: "Less sweet", price: 0 }, { label: "No sugar", price: 0 }] },
    { key: "addons", label: "Add-ons", multi: true, choices: [{ label: "Extra shot", price: 10 }, { label: "Upsize", price: 20 }] }
  ];

  let cart = normalizeCart(readStorage(STORAGE.cart, []));
  let activeCategory = "All";
  let searchTerm = "";
  let popularOnly = false;
  let selectedProduct = null;
  let selectedSize = "Medium";
  let selectedTemperature = "Hot";
  let selectedSugar = "Normal";
  let selectedAddons = new Set();
  let customizerQuantity = 1;
  let paymentMethod = "card";
  let orderSequence = nextOrderNumber(readStorage(STORAGE.orders, []));
  let loyaltyCardStock = readCardStock();
  let toastTimer;
  let lastOrder = null;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    renderMenu();
    renderOrder();
    renderRecentOrders();
    updateMetrics();
    setDateAndTime();
    setOrderNumber();
    prefillCustomer();
    bindEvents();
    window.setInterval(setDateAndTime, 30000);
  }

  function bindEvents() {
    document.querySelector("#menu-grid")?.addEventListener("click", (event) => {
      const card = event.target.closest("[data-product-id]");
      if (card) openCustomizer(card.dataset.productId);
    });

    document.querySelector("#category-tabs")?.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-category]");
      if (!tab) return;
      activeCategory = tab.dataset.category;
      document.querySelectorAll("[data-category]").forEach((button) => {
        button.classList.toggle("active", button === tab);
        button.setAttribute("aria-selected", String(button === tab));
      });
      renderMenu();
    });

    const search = document.querySelector("#menu-search");
    search?.addEventListener("input", () => {
      searchTerm = search.value.trim().toLowerCase();
      renderMenu();
    });

    document.querySelector("#popular-filter")?.addEventListener("click", () => {
      popularOnly = !popularOnly;
      document.querySelector("#popular-filter")?.classList.toggle("active", popularOnly);
      renderMenu();
    });

    document.querySelector("#clear-filters")?.addEventListener("click", clearFilters);

    document.querySelector("#order-items")?.addEventListener("click", handleOrderItemClick);
    document.querySelector("#clear-order")?.addEventListener("click", clearOrder);
    document.querySelector("#charge-button")?.addEventListener("click", openPayment);
    document.querySelector("#hold-link")?.addEventListener("click", () => {
      if (!cart.length) {
        showToast("Add a drink or bite before saving your order.");
        return;
      }
      saveCart();
      showToast("Order saved on this device — come back any time.");
    });

    document.querySelector("#customizer-options")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-option]");
      if (!button) return;
      const key = button.dataset.option;
      if (key === "addons") {
        if (selectedAddons.has(button.dataset.value)) selectedAddons.delete(button.dataset.value);
        else selectedAddons.add(button.dataset.value);
        button.classList.toggle("selected", selectedAddons.has(button.dataset.value));
      } else {
        if (key === "size") selectedSize = button.dataset.value;
        if (key === "temperature") selectedTemperature = button.dataset.value;
        if (key === "sugar") selectedSugar = button.dataset.value;
        document.querySelectorAll(`[data-option="${key}"]`).forEach((option) => option.classList.toggle("selected", option === button));
      }
      updateCustomizerPrice();
    });

    document.querySelectorAll("[data-custom-quantity]").forEach((button) => button.addEventListener("click", () => {
      const delta = button.dataset.customQuantity === "increase" ? 1 : -1;
      customizerQuantity = Math.max(1, Math.min(99, customizerQuantity + delta));
      updateCustomizerQuantity();
      updateCustomizerPrice();
    }));

    document.querySelector("#add-custom-item")?.addEventListener("click", addCustomItem);
    document.querySelector("#customizer-close")?.addEventListener("click", closeActiveModal);
    document.querySelector("#payment-close")?.addEventListener("click", closeActiveModal);
    document.querySelector("#orders-close")?.addEventListener("click", closeActiveModal);
    document.querySelector("#loyalty-close")?.addEventListener("click", closeActiveModal);
    document.querySelector("#modal-backdrop")?.addEventListener("click", closeActiveModal);

    document.querySelector("#payment-methods")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-payment-method]");
      if (!button) return;
      paymentMethod = button.dataset.paymentMethod;
      renderPayment();
    });
    document.querySelector("#confirm-payment")?.addEventListener("click", completeOrder);
    document.querySelector("#start-new-order")?.addEventListener("click", startNewOrder);
    document.querySelector("#print-receipt")?.addEventListener("click", () => window.print());

    document.querySelector("#view-orders")?.addEventListener("click", openOrderHistory);
    document.querySelector("#jump-to-ticket")?.addEventListener("click", () => scrollToTicket());
    document.querySelector("#menu-settings")?.addEventListener("click", () => showToast("Tap any menu item to customize your drink."));
    document.querySelector("#notification-button")?.addEventListener("click", () => showToast("You’re all caught up."));
    document.querySelector("#store-switcher")?.addEventListener("click", () => showToast("Trippers #1042 is open until 10:00 PM."));

    document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
      document.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("active", item === button));
      showToast(button.dataset.mode === "pickup" ? "Pickup selected." : "Dine-in selected — tell us your table at pickup.");
    }));

    document.querySelectorAll("[data-quick-action]").forEach((element) => element.addEventListener("click", (event) => {
      const action = element.dataset.quickAction;
      if (element.tagName === "A" && element.getAttribute("href")?.startsWith("#")) event.preventDefault();
      handleQuickAction(action);
    }));

    document.querySelectorAll("[data-scroll-target]").forEach((link) => link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = document.querySelector(link.dataset.scrollTarget);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item === link));
      setSidebar(false);
    }));

    document.querySelector("#mobile-nav-toggle")?.addEventListener("click", () => setSidebar(true));
    document.querySelector("#sidebar-dismiss")?.addEventListener("click", () => setSidebar(false));
    document.querySelector("#sidebar-backdrop")?.addEventListener("click", () => setSidebar(false));

    document.querySelector("#loyalty-start")?.addEventListener("click", () => {
      closeActiveModal();
      const input = document.querySelector("#customer-name");
      input?.focus();
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    document.addEventListener("keydown", handleGlobalKeydown);
  }

  function handleGlobalKeydown(event) {
    if (event.key === "Escape") closeActiveModal();
    if (!(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    if (key === "k") {
      event.preventDefault();
      document.querySelector("#menu-search")?.focus();
    }
    if (key === "b") {
      event.preventDefault();
      handleQuickAction("popular");
    }
    if (key === "t") {
      event.preventDefault();
      scrollToTicket();
    }
    if (key === "l") {
      event.preventDefault();
      handleQuickAction("loyalty");
    }
  }

  /* Menu */
  function renderMenu() {
    const grid = document.querySelector("#menu-grid");
    if (!grid) return;
    const visible = products.filter((item) => {
      const categoryMatch = activeCategory === "All" || item.category === activeCategory || (activeCategory === "Non-Coffee" && item.category === "Premium Non-Coffee");
      const searchMatch = !searchTerm || `${item.name} ${item.category}`.toLowerCase().includes(searchTerm);
      return categoryMatch && searchMatch && (!popularOnly || item.featured);
    });
    grid.innerHTML = visible.map(menuItemTemplate).join("");
    const empty = document.querySelector("#menu-empty");
    if (empty) empty.hidden = visible.length > 0;
    document.querySelector("#menu-panel")?.classList.toggle("is-filtered", activeCategory !== "All" || Boolean(searchTerm) || popularOnly);
  }

  function menuItemTemplate(item) {
    const badge = item.badge ? `<span class="item-badge">${escapeHTML(item.badge)}</span>` : "";
    return `<button class="menu-item" type="button" data-product-id="${item.id}" aria-label="Customize ${escapeHTML(item.name)}">
      <span class="item-art">
        <span class="item-art-fallback" aria-hidden="true">${item.emoji}</span>
        <img src="${item.image}" alt="${escapeHTML(item.name)}" loading="lazy" onerror="this.style.display='none'">
        ${badge}
      </span>
      <span class="item-body"><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.description)}</small><span class="item-footer"><span class="item-price">${formatPrice(item.price)}</span><span class="item-add" aria-hidden="true">+</span></span></span>
    </button>`;
  }

  function clearFilters() {
    activeCategory = "All";
    searchTerm = "";
    popularOnly = false;
    const search = document.querySelector("#menu-search");
    if (search) search.value = "";
    document.querySelectorAll(".category-tab").forEach((tab) => {
      const active = tab.dataset.category === "All";
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    document.querySelector("#popular-filter")?.classList.remove("active");
    renderMenu();
  }

  /* Customizer */
  function openCustomizer(productId) {
    const item = productMap.get(productId);
    if (!item) return;
    selectedProduct = item;
    selectedSize = "Medium";
    selectedTemperature = "Hot";
    selectedSugar = "Normal";
    selectedAddons = new Set();
    customizerQuantity = 1;

    const art = document.querySelector("#customizer-art");
    if (art) art.innerHTML = `<span class="customizer-art-fallback" aria-hidden="true"><span>${item.emoji}</span></span><img src="${item.image}" alt="${escapeHTML(item.name)}" onerror="this.style.display='none'">`;
    setText("#customizer-category", item.category);
    setText("#customizer-title", item.name);
    setText("#customizer-description", item.description);
    renderCustomizerOptions();
    const notes = document.querySelector("#item-notes");
    if (notes) notes.value = "";
    updateCustomizerQuantity();
    updateCustomizerPrice();
    openModal(document.querySelector("#customizer-modal"));
  }

  function renderCustomizerOptions() {
    const container = document.querySelector("#customizer-options");
    if (!container) return;
    container.innerHTML = OPTION_GROUPS.map((group) => `
      <div class="option-group" data-option-group="${group.key}">
        <div class="option-group-heading"><span>${escapeHTML(group.label)}${group.required ? " *" : ""}</span><small>${group.required ? "Required" : "Optional"}</small></div>
        <div class="option-grid">${group.choices.map((choice) => {
          const selected = group.multi ? selectedAddons.has(choice.label) : currentOptionLabel(group.key) === choice.label;
          return `<button class="option-button ${selected ? "selected" : ""}" type="button" data-option="${group.key}" data-value="${escapeHTML(choice.label)}">${escapeHTML(choice.label)}${Number(choice.price) ? ` +${formatPrice(choice.price)}` : ""}</button>`;
        }).join("")}</div>
      </div>`).join("");
  }

  function currentOptionLabel(key) {
    if (key === "size") return selectedSize;
    if (key === "temperature") return selectedTemperature;
    if (key === "sugar") return selectedSugar;
    return "";
  }

  function updateCustomizerQuantity() {
    setText("#customizer-quantity", customizerQuantity);
  }

  function updateCustomizerPrice() {
    if (!selectedProduct) return;
    setText("#customizer-price", formatPrice(customizerUnitPrice() * customizerQuantity));
  }

  function customizerUnitPrice() {
    if (!selectedProduct) return 0;
    return selectedProduct.price + (SIZE_PRICES[selectedSize] || 0) + [...selectedAddons].reduce((sum, addon) => sum + (ADDON_PRICES[addon] || 0), 0);
  }

  function addCustomItem() {
    if (!selectedProduct) return;
    const options = { size: selectedSize, temperature: selectedTemperature, sugar: selectedSugar, addons: [...selectedAddons].sort() };
    const notes = String(document.querySelector("#item-notes")?.value || "").trim();
    const key = makeCartKey(selectedProduct.id, options);
    const existing = cart.find((line) => line.key === key);
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + customizerQuantity);
      if (notes) existing.notes = notes;
    } else {
      cart.push({ key, productId: selectedProduct.id, options, quantity: customizerQuantity, notes });
    }
    saveCart();
    renderOrder();
    closeActiveModal();
    showToast(`${selectedProduct.name} added to your order.`);
  }

  /* Cart */
  function renderOrder() {
    const container = document.querySelector("#order-items");
    if (!container) return;
    const hasItems = cart.length > 0;
    const empty = document.querySelector("#order-empty");
    if (empty) empty.hidden = hasItems;
    container.hidden = !hasItems;
    container.innerHTML = hasItems ? cart.map(orderItemTemplate).join("") : "";
    updateTotals();
    setText("#nav-order-count", countOrdersToday());
  }

  function orderItemTemplate(line) {
    const item = productMap.get(line.productId);
    if (!item) return "";
    const options = line.options || {};
    const modifiers = [options.size, options.temperature, options.sugar, ...(options.addons || [])].filter(Boolean).join(" · ");
    const detail = [modifiers, line.notes ? `Note: ${line.notes}` : ""].filter(Boolean).join(" · ");
    return `<article class="order-item" data-line-key="${escapeHTML(line.key)}">
      <div class="order-item-art"><span aria-hidden="true">${item.emoji}</span><img src="${item.image}" alt="" onerror="this.style.display='none'"></div>
      <div class="order-item-copy"><strong>${escapeHTML(item.name)}</strong><small title="${escapeHTML(detail)}">${escapeHTML(detail || "Standard build")}</small><div class="order-item-bottom"><div class="order-item-quantity"><button type="button" data-quantity-action="decrease" aria-label="Decrease ${escapeHTML(item.name)}">−</button><span>${line.quantity}</span><button type="button" data-quantity-action="increase" aria-label="Increase ${escapeHTML(item.name)}">+</button></div><button class="order-item-remove" type="button" data-quantity-action="remove">Remove</button></div></div>
      <strong class="order-item-price">${formatPrice(unitPrice(line) * line.quantity)}</strong>
    </article>`;
  }

  function handleOrderItemClick(event) {
    const button = event.target.closest("[data-quantity-action]");
    const row = event.target.closest("[data-line-key]");
    if (!button || !row) return;
    const line = cart.find((item) => item.key === row.dataset.lineKey);
    if (!line) return;
    if (button.dataset.quantityAction === "increase") line.quantity = Math.min(99, line.quantity + 1);
    if (button.dataset.quantityAction === "decrease") line.quantity -= 1;
    if (line.quantity <= 0 || button.dataset.quantityAction === "remove") cart = cart.filter((item) => item.key !== line.key);
    saveCart();
    renderOrder();
  }

  function clearOrder() {
    if (!cart.length) {
      showToast("Your ticket is already empty.");
      return;
    }
    cart = [];
    saveCart();
    renderOrder();
    showToast("Ticket cleared — start a fresh order.");
  }

  function unitPrice(line) {
    const item = productMap.get(line.productId);
    if (!item) return 0;
    const options = line.options || {};
    return item.price + (SIZE_PRICES[options.size] || 0) + (options.addons || []).reduce((sum, addon) => sum + (ADDON_PRICES[addon] || 0), 0);
  }

  function cartSubtotal() {
    return cart.reduce((sum, line) => sum + unitPrice(line) * line.quantity, 0);
  }

  function updateTotals() {
    const subtotal = cartSubtotal();
    const tax = Math.round(subtotal * TAX_RATE);
    const total = subtotal + tax;
    setText("#order-subtotal", formatPrice(subtotal));
    setText("#order-tax", formatPrice(tax));
    setText("#order-total", formatPrice(total));
    setText("#charge-amount", formatPrice(total));
    const charge = document.querySelector("#charge-button");
    if (charge) charge.disabled = cart.length === 0;
  }

  function makeCartKey(productId, options) {
    return `${productId}::${options.size}::${options.temperature}::${options.sugar}::${(options.addons || []).join("|")}`;
  }

  function normalizeCart(value) {
    if (!Array.isArray(value)) return [];
    return value
      .filter((line) => line && productMap.has(line.productId))
      .map((line) => ({
        key: String(line.key || makeCartKey(line.productId, line.options || {})),
        productId: line.productId,
        options: { size: "Medium", temperature: "Hot", sugar: "Normal", addons: [], ...(line.options || {}) },
        quantity: Math.max(1, Math.min(99, Number(line.quantity) || 1)),
        notes: String(line.notes || "")
      }));
  }

  function saveCart() { return writeStorage(STORAGE.cart, cart); }

  /* Payment and orders */
  function openPayment() {
    if (!cart.length) {
      showToast("Add a drink or bite before placing your order.");
      return;
    }
    paymentMethod = "card";
    renderPayment();
    const view = document.querySelector("#payment-view");
    const success = document.querySelector("#payment-success");
    if (view) view.hidden = false;
    if (success) success.hidden = true;
    openModal(document.querySelector("#payment-modal"));
  }

  function renderPayment() {
    const subtotal = cartSubtotal();
    const total = subtotal + Math.round(subtotal * TAX_RATE);
    const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
    setText("#payment-total", formatPrice(total));
    setText("#payment-order-number", `#${orderSequence}`);
    setText("#payment-item-count", `${itemCount} ${itemCount === 1 ? "item" : "items"}`);
    setText("#confirm-payment-amount", formatPrice(total));
    document.querySelectorAll("[data-payment-method]").forEach((button) => button.classList.toggle("active", button.dataset.paymentMethod === paymentMethod));
    const detail = document.querySelector("#payment-detail");
    if (!detail) return;
    if (paymentMethod === "cash") {
      detail.innerHTML = `<p>Cash on pickup</p><div class="payment-detail-row"><span>Pay at the counter</span><strong>${formatPrice(total)}</strong></div>`;
    } else if (paymentMethod === "mobile") {
      detail.innerHTML = `<p>Mobile wallet</p><div class="payment-detail-row"><span>Payment request</span><strong>Sent to your phone</strong></div>`;
    } else {
      detail.innerHTML = `<p>Card on pickup</p><div class="payment-detail-row"><span>Terminal</span><strong>Ready at the counter</strong></div>`;
    }
  }

  function completeOrder() {
    if (!cart.length) return;
    const subtotal = cartSubtotal();
    const tax = Math.round(subtotal * TAX_RATE);
    const total = subtotal + tax;
    const typedCustomer = String(document.querySelector("#customer-name")?.value || "").trim();
    const customerMatch = resolveCustomer(typedCustomer);
    const customer = customerMatch?.customer || null;
    const order = {
      id: `#${orderSequence}`,
      customer: customer?.name || typedCustomer || "Walk-in guest",
      customerId: customer?.id || "",
      customerEmail: customer?.email || "",
      loyaltyPending: Boolean(customer),
      items: cart.map((line) => ({
        id: line.productId,
        name: productMap.get(line.productId)?.name || "Menu item",
        quantity: line.quantity,
        price: unitPrice(line),
        options: line.options,
        notes: line.notes
      })),
      subtotal,
      tax,
      total,
      status: "New",
      mode: document.querySelector("[data-mode].active")?.dataset.mode || "pickup",
      createdAt: new Date().toISOString()
    };
    const orders = readStorage(STORAGE.orders, []);
    const nextOrders = [order, ...(Array.isArray(orders) ? orders : [])];
    if (!writeStorage(STORAGE.orders, nextOrders)) {
      showToast("We could not save your order. Please try again.");
      return;
    }
    let loyaltyResult = null;
    if (customer) {
      order.loyaltyPending = false;
      loyaltyResult = recordLoyaltyOrder(order, nextOrders, customerMatch.customers);
      writeStorage(STORAGE.orders, nextOrders);
      if (customer.email) {
        writeStorage(STORAGE.loyaltyEmail, customer.email);
        writeStorage(STORAGE.customerName, customer.name);
        writeStorage(STORAGE.activeCustomer, { id: customer.id, name: customer.name, email: customer.email });
        updateProfile(customer);
      }
    }
    lastOrder = order;
    cart = [];
    saveCart();
    orderSequence = nextOrderNumber(nextOrders);
    renderOrder();
    renderRecentOrders();
    updateMetrics();
    setOrderNumber();
    setText("#receipt-number", order.id);
    setText("#receipt-total", formatPrice(total));
    const view = document.querySelector("#payment-view");
    const success = document.querySelector("#payment-success");
    if (view) view.hidden = true;
    if (success) success.hidden = false;
    const message = loyaltyResult?.issued
      ? `Order ${order.id} placed — your loyalty card is unlocked!`
      : `Order ${order.id} placed — we’ll have it ready soon.`;
    showToast(message);
  }

  function startNewOrder() {
    closeActiveModal();
    setOrderNumber();
    setText("#order-number", `#${orderSequence}`);
    const customer = document.querySelector("#customer-name");
    if (customer) customer.value = readStorage(STORAGE.loyaltyEmail, "");
    window.setTimeout(() => document.querySelector("#menu-search")?.focus(), 120);
  }

  function setOrderNumber() {
    setText("#order-number", `#${orderSequence}`);
  }

  function nextOrderNumber(orders) {
    const numbers = (Array.isArray(orders) ? orders : [])
      .map((order) => String(order?.id || "").match(/^#(\d{3,5})$/))
      .filter(Boolean)
      .map((match) => Number(match[1]));
    return numbers.length ? Math.max(...numbers) + 1 : 1042;
  }

  /* Recent orders and history */
  function renderRecentOrders() {
    const container = document.querySelector("#recent-orders");
    if (!container) return;
    const orders = allOrders().slice(0, 4);
    container.innerHTML = orders.length
      ? orders.map(recentOrderTemplate).join("")
      : `<p class="empty-row">No orders yet — your first trip starts here.</p>`;
    setText("#nav-order-count", countOrdersToday());
  }

  function recentOrderTemplate(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    const count = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const first = items[0]?.name || "Coffee order";
    const extra = count > 1 ? ` + ${count - 1} more` : "";
    const status = String(order.status || "New");
    const statusClass = status === "Cancelled" ? "cancelled" : status === "Completed" ? "ready" : status === "Preparing" ? "progress" : "";
    return `<article class="recent-order"><span class="recent-order-number">${escapeHTML(shortId(order.id))}</span><span class="recent-order-copy"><strong>${escapeHTML(first)}${escapeHTML(extra)}</strong><small>${escapeHTML(order.customer || "Walk-in guest")} · ${count} item${count === 1 ? "" : "s"}</small></span><span class="recent-order-total">${formatPrice(order.total)}</span><span class="recent-order-status ${statusClass}">${escapeHTML(status)}</span></article>`;
  }

  function openOrderHistory() {
    const list = document.querySelector("#history-list");
    if (!list) return;
    const orders = allOrders();
    list.innerHTML = orders.length
      ? orders.map((order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        const count = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        const first = items[0]?.name || "Coffee order";
        const extra = count > 1 ? ` + ${count - 1} more` : "";
        const status = String(order.status || "New");
        const statusClass = status === "Cancelled" ? "cancelled" : status === "Completed" ? "completed" : "";
        return `<article class="history-row"><span>☕</span><span class="history-copy"><strong>${escapeHTML(order.id)} · ${escapeHTML(first)}${escapeHTML(extra)}</strong><small>${escapeHTML(formatOrderDate(order.createdAt))} · ${count} item${count === 1 ? "" : "s"}</small></span><strong class="history-total">${formatPrice(order.total)}</strong><span class="history-status ${statusClass}">${escapeHTML(status)}</span></article>`;
      }).join("")
      : `<p class="empty-row">No orders on this device yet.</p>`;
    openModal(document.querySelector("#orders-modal"));
  }

  function allOrders() {
    const orders = readStorage(STORAGE.orders, []);
    return (Array.isArray(orders) ? orders : []).filter((order) => order && order.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function countOrdersToday() {
    const today = new Date().toDateString();
    return allOrders().filter((order) => new Date(order.createdAt).toDateString() === today).length;
  }

  function shortId(value) {
    const digits = String(value || "").replace(/[^0-9]/g, "");
    return `#${digits.slice(-4) || "----"}`;
  }

  /* Metrics and clock */
  function updateMetrics() {
    setText("#metric-menu-count", products.length);
    setText("#metric-orders-today", countOrdersToday());
    const hour = new Date().getHours();
    setText("#metric-open", hour >= 7 && hour < 22 ? "Open" : "Closed");
  }

  function setDateAndTime() {
    const now = new Date();
    setText("#today-label", new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now).toUpperCase());
    setText("#live-time", new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(now));
    updateMetrics();
  }

  /* Loyalty (kept compatible with the admin dashboard and old storefront) */
  function resolveCustomer(input) {
    const raw = String(input || "").trim();
    if (!raw) return null;
    const customers = readCustomers();
    if (/^TC-/i.test(raw)) {
      const found = customers.find((entry) => normalizeId(entry.id) === normalizeId(raw));
      if (found) return { customer: found, customers };
    }
    if (isValidEmail(raw)) {
      const email = normalizeEmail(raw);
      let found = customers.find((entry) => normalizeEmail(entry.email) === email);
      if (!found) {
        found = createLoyaltyCustomer({ name: email.split("@")[0] || "Trippers member", email, customers });
        customers.push(found);
        writeStorage(STORAGE.loyalty, customers);
      }
      return { customer: found, customers };
    }
    let found = customers.find((entry) => normalizeName(entry.name) === normalizeName(raw));
    if (!found) {
      found = createLoyaltyCustomer({ name: raw, email: "", customers });
      customers.push(found);
      writeStorage(STORAGE.loyalty, customers);
    }
    return { customer: found, customers };
  }

  function readCustomers() {
    const value = readStorage(STORAGE.loyalty, []);
    return Array.isArray(value) ? value.filter((entry) => entry && typeof entry === "object") : [];
  }

  function createLoyaltyCustomer({ name, email, cardStyle = cardStyleFromStorage(), customers = [] }) {
    const usedIds = new Set(customers.map((customer) => String(customer?.id || "")));
    let id;
    do {
      id = `TC-${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    } while (usedIds.has(id));
    const now = new Date().toISOString();
    return { id, name: String(name || "Trippers member").trim(), email: normalizeEmail(email), cardStyle: normalizeCardStyle(cardStyle), points: 0, tier: "Member", orders: 0, qualifyingOrderIds: [], lastVisit: now, joinedAt: now, cardStatus: "Pending", cardIssuedAt: null };
  }

  function recordLoyaltyOrder(order, orders, customers) {
    if (!order?.customerEmail && !order?.customerId) return null;
    const list = Array.isArray(customers) ? customers : [];
    let customer = order.customerId
      ? list.find((entry) => String(entry.id) === String(order.customerId))
      : list.find((entry) => normalizeEmail(entry.email) === normalizeEmail(order.customerEmail));
    if (!customer) {
      customer = createLoyaltyCustomer({ name: order.customer || "Trippers member", email: order.customerEmail, customers: list });
      list.push(customer);
    }
    const qualifyingOrders = syncQualifyingLoyaltyOrders(customer, orders);
    customer.orders = qualifyingOrders;
    customer.lastVisit = order.createdAt || new Date().toISOString();
    const status = String(customer.cardStatus || "").trim().toLowerCase();
    customer.cardStatus = status === "active" ? "Active" : status === "qualified" ? "Qualified" : "Pending";
    if (qualifyingOrders < LOYALTY_THRESHOLD && customer.cardStatus !== "Active") customer.cardStatus = "Pending";
    let issued = false;
    if (qualifyingOrders >= LOYALTY_THRESHOLD && customer.cardStatus !== "Active") {
      const stock = readCardStock();
      if (stock > 0) {
        const nextStock = stock - 1;
        if (writeStorage(STORAGE.cardInventory, nextStock)) {
          loyaltyCardStock = nextStock;
          customer.cardStatus = "Active";
          customer.cardIssuedAt = new Date().toISOString();
          issued = true;
        } else {
          customer.cardStatus = "Qualified";
        }
      } else {
        customer.cardStatus = "Qualified";
      }
    }
    writeStorage(STORAGE.loyalty, list);
    return { customer, issued };
  }

  function syncQualifyingLoyaltyOrders(customer, orders) {
    const previousCount = Math.max(0, Number(customer.orders) || 0);
    const knownIds = new Set(Array.isArray(customer.qualifyingOrderIds) ? customer.qualifyingOrderIds.map(String) : []);
    const seen = new Set();
    let added = 0;
    let removed = 0;
    (Array.isArray(orders) ? orders : []).forEach((order) => {
      if (!order || !Array.isArray(order.items) || order.items.length === 0) return;
      const orderKey = String(order.id || `#legacy-${order.createdAt || ""}-${order.total || 0}`);
      if (seen.has(orderKey)) return;
      seen.add(orderKey);
      const matchesId = order.customerId && String(order.customerId) === String(customer.id);
      const matchesEmail = order.customerEmail && normalizeEmail(order.customerEmail) === normalizeEmail(customer.email);
      if (!matchesId && !matchesEmail) return;
      if (order.status === "Cancelled") {
        if (knownIds.delete(orderKey)) removed += 1;
      } else if (!knownIds.has(orderKey)) {
        knownIds.add(orderKey);
        added += 1;
      }
    });
    customer.qualifyingOrderIds = [...knownIds];
    customer.orders = Math.max(0, previousCount + added - removed);
    return customer.orders;
  }

  function readCardStock() {
    const value = Number(readStorage(STORAGE.cardInventory, DEFAULT_CARD_STOCK));
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_CARD_STOCK;
  }

  function cardStyleFromStorage() {
    return normalizeCardStyle(readStorage(STORAGE.cardStyle, DEFAULT_CARD_STYLE));
  }

  function normalizeEmail(value) { return String(value || "").trim().toLowerCase(); }
  function normalizeName(value) { return String(value || "").trim().toLowerCase().replace(/\s+/g, " "); }
  function normalizeId(value) { return String(value || "").trim().toUpperCase(); }
  function normalizeCardStyle(value) { const style = String(value || "").trim().toLowerCase(); return CARD_STYLE_NAMES[style] ? style : DEFAULT_CARD_STYLE; }
  function isValidEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value)); }

  function prefillCustomer() {
    const activeCustomer = readStorage(STORAGE.activeCustomer, null);
    const email = normalizeEmail(activeCustomer?.email || readStorage(STORAGE.loyaltyEmail, ""));
    const name = String(activeCustomer?.name || readStorage(STORAGE.customerName, "") || "");
    const input = document.querySelector("#customer-name");
    if (input && email) input.value = email;
    if (activeCustomer) updateProfile(activeCustomer);
    else if (name) updateProfile({ name, email });
  }

  function updateProfile(customer) {
    const name = String(customer?.name || "Guest");
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "G";
    setText("#guest-name", name);
    setText("#guest-role", customer?.email ? "Trippers Circle member" : "Ordering ahead");
    setText("#guest-avatar", initials);
    setText("#topbar-user-name", name.split(/\s+/)[0]);
    setText("#topbar-user-avatar", initials);
  }

  /* Quick actions and sidebar */
  function handleQuickAction(action) {
    if (action === "popular") {
      popularOnly = true;
      document.querySelector("#popular-filter")?.classList.add("active");
      renderMenu();
      document.querySelector("#menu-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      showToast("Showing best sellers only.");
      setSidebar(false);
      return;
    }
    if (action === "cart") {
      scrollToTicket();
      setSidebar(false);
      return;
    }
    if (action === "loyalty") {
      openModal(document.querySelector("#loyalty-modal"));
      setSidebar(false);
    }
  }

  function scrollToTicket() {
    document.querySelector(".order-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function setSidebar(open) {
    const sidebar = document.querySelector("#app-sidebar");
    const backdrop = document.querySelector("#sidebar-backdrop");
    const toggle = document.querySelector("#mobile-nav-toggle");
    if (!sidebar) return;
    sidebar.classList.toggle("is-open", open);
    if (backdrop) backdrop.hidden = !open;
    if (toggle) toggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("no-scroll", open);
  }

  /* Modal helpers */
  function openModal(modal) {
    if (!modal) return;
    document.querySelectorAll(".customizer-modal.is-open, .payment-modal.is-open, .info-modal.is-open").forEach((open) => {
      if (open !== modal) closeModal(open);
    });
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    const backdrop = document.querySelector("#modal-backdrop");
    if (backdrop) {
      backdrop.hidden = false;
      window.requestAnimationFrame(() => backdrop.classList.add("is-visible"));
    }
    document.body.classList.add("no-scroll");
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    const backdrop = document.querySelector("#modal-backdrop");
    if (!document.querySelector(".customizer-modal.is-open, .payment-modal.is-open, .info-modal.is-open")) {
      backdrop?.classList.remove("is-visible");
      window.setTimeout(() => backdrop?.setAttribute("hidden", ""), 250);
      document.body.classList.remove("no-scroll");
      setSidebar(false);
    }
  }

  function closeActiveModal() {
    document.querySelectorAll(".customizer-modal.is-open, .payment-modal.is-open, .info-modal.is-open").forEach(closeModal);
  }

  /* Small utilities */
  function readStorage(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function formatPrice(value) { return `₱${Math.round(Number(value) || 0)}`; }

  function formatOrderDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";
    return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  function showToast(message) {
    const toast = document.querySelector("#toast");
    const text = document.querySelector("#toast-message");
    if (!toast || !text) return;
    text.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }
})();
