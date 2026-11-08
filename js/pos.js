(() => {
  "use strict";

  // The POS needs its API server; never run it from a local file.
  if (window.location.protocol === "file:") {
    window.location.replace("http://127.0.0.1:4173/pos.html");
    return;
  }

  const STORAGE = {
    cart: "brewlinePosCart",
    orders: "brewlinePosOrders"
  };
  const SHARED_STORAGE = { orders: "trippersOrders", loyalty: "trippersLoyaltyCustomers", cardInventory: "trippersLoyaltyCardInventory" };
  const LOYALTY_THRESHOLD = 5;
  const DEFAULT_CARD_STOCK = 84;
  let TAX_RATE = 0.12;
  let SERVICE_RATE = 0;
  let money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
  const image = (id, width = 600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=84`;
  const productMap = new Map();
  const page = document.body?.dataset.page || "pos";

  let menuItems = [
    {
      id: "caramel-macchiato",
      name: "Caramel Macchiato",
      category: "Espresso",
      price: 5.45,
      description: "Silky milk, espresso and a soft ribbon of caramel.",
      image: image("photo-1461023058943-07fcbe16d735"),
      emoji: "☕",
      badge: "Popular",
      badgeClass: "",
      popular: true,
      drink: true,
      options: [
        { key: "size", label: "Size", required: true, choices: [{ label: "Tall", price: 0 }, { label: "Grande", price: 0.6 }, { label: "Venti", price: 1.1 }] },
        { key: "milk", label: "Milk", required: true, choices: [{ label: "Whole", price: 0 }, { label: "Oat", price: 0.6 }, { label: "Almond", price: 0.6 }, { label: "Nonfat", price: 0 }] },
        { key: "shots", label: "Espresso", choices: [{ label: "Standard", price: 0 }, { label: "Extra shot", price: 0.9 }] },
        { key: "flavor", label: "Flavor", choices: [{ label: "No flavor", price: 0 }, { label: "Vanilla", price: 0.5 }, { label: "Caramel", price: 0.5 }] }
      ]
    },
    {
      id: "signature-latte",
      name: "Café Latte",
      category: "Espresso",
      price: 4.95,
      description: "A balanced, velvety latte made with our house espresso.",
      image: image("photo-1495474472287-4d71bcdd2085"),
      emoji: "☕",
      badge: "House favorite",
      badgeClass: "veg",
      popular: true,
      drink: true,
      options: [
        { key: "size", label: "Size", required: true, choices: [{ label: "Tall", price: 0 }, { label: "Grande", price: 0.6 }, { label: "Venti", price: 1.1 }] },
        { key: "milk", label: "Milk", required: true, choices: [{ label: "Whole", price: 0 }, { label: "Oat", price: 0.6 }, { label: "Almond", price: 0.6 }, { label: "Nonfat", price: 0 }] },
        { key: "shots", label: "Espresso", choices: [{ label: "Standard", price: 0 }, { label: "Extra shot", price: 0.9 }] }
      ]
    },
    {
      id: "mocha",
      name: "Dark Mocha",
      category: "Espresso",
      price: 5.25,
      description: "Rich cocoa and espresso finished with a cloud of cream.",
      image: image("photo-1572442388796-11668a67e53d"),
      emoji: "☕",
      badge: "New",
      badgeClass: "new",
      popular: true,
      drink: true,
      options: [
        { key: "size", label: "Size", required: true, choices: [{ label: "Tall", price: 0 }, { label: "Grande", price: 0.6 }, { label: "Venti", price: 1.1 }] },
        { key: "milk", label: "Milk", required: true, choices: [{ label: "Whole", price: 0 }, { label: "Oat", price: 0.6 }, { label: "Almond", price: 0.6 }, { label: "Nonfat", price: 0 }] },
        { key: "cocoa", label: "Cocoa", choices: [{ label: "Regular", price: 0 }, { label: "Extra cocoa", price: 0.5 }] }
      ]
    },
    {
      id: "matcha-latte",
      name: "Matcha Latte",
      category: "Tea",
      price: 5.75,
      description: "Ceremonial matcha, steamed milk and a light sweet finish.",
      image: image("photo-1515823064-d6e0c04616a7"),
      emoji: "🍵",
      badge: "Popular",
      popular: true,
      drink: true,
      options: [
        { key: "size", label: "Size", required: true, choices: [{ label: "Tall", price: 0 }, { label: "Grande", price: 0.6 }, { label: "Venti", price: 1.1 }] },
        { key: "milk", label: "Milk", required: true, choices: [{ label: "Whole", price: 0 }, { label: "Oat", price: 0.6 }, { label: "Almond", price: 0.6 }, { label: "Nonfat", price: 0 }] },
        { key: "sweetness", label: "Sweetness", choices: [{ label: "50%", price: 0 }, { label: "100%", price: 0 }, { label: "No sweetener", price: 0 }] }
      ]
    },
    {
      id: "cold-brew",
      name: "Cold Brew",
      category: "Cold coffee",
      price: 4.75,
      description: "Slow-steeped for 18 hours. Smooth, bold and refreshing.",
      image: image("photo-1517701604599-bb29b565090c"),
      emoji: "🧊",
      badge: "Popular",
      badgeClass: "veg",
      popular: true,
      drink: true,
      options: [
        { key: "size", label: "Size", required: true, choices: [{ label: "Tall", price: 0 }, { label: "Grande", price: 0.6 }, { label: "Venti", price: 1.1 }] },
        { key: "milk", label: "Milk", choices: [{ label: "No milk", price: 0 }, { label: "Oat", price: 0.6 }, { label: "Almond", price: 0.6 }] },
        { key: "ice", label: "Ice", choices: [{ label: "Regular ice", price: 0 }, { label: "Light ice", price: 0 }, { label: "No ice", price: 0 }] }
      ]
    },
    {
      id: "vanilla-frappuccino",
      name: "Vanilla Bean Frappuccino",
      category: "Cold coffee",
      price: 5.95,
      description: "Blended coffee, milk and vanilla with a smooth finish.",
      image: image("photo-1541167760496-1628856ab772"),
      emoji: "🥤",
      badge: "Popular",
      popular: true,
      drink: true,
      options: [
        { key: "size", label: "Size", required: true, choices: [{ label: "Tall", price: 0 }, { label: "Grande", price: 0.6 }, { label: "Venti", price: 1.1 }] },
        { key: "milk", label: "Milk", required: true, choices: [{ label: "Whole", price: 0 }, { label: "Oat", price: 0.6 }, { label: "Almond", price: 0.6 }, { label: "Nonfat", price: 0 }] },
        { key: "blend", label: "Blend", choices: [{ label: "Regular", price: 0 }, { label: "Less ice", price: 0 }, { label: "More blended", price: 0 }] }
      ]
    },
    {
      id: "iced-shaken-espresso",
      name: "Iced Shaken Espresso",
      category: "Cold coffee",
      price: 4.85,
      description: "A bright, layered iced espresso with a touch of sweetness.",
      image: image("photo-1509042239860-f550ce710b93"),
      emoji: "🧊",
      badge: "",
      popular: true,
      drink: true,
      options: [
        { key: "size", label: "Size", required: true, choices: [{ label: "Tall", price: 0 }, { label: "Grande", price: 0.6 }, { label: "Venti", price: 1.1 }] },
        { key: "milk", label: "Milk", choices: [{ label: "No milk", price: 0 }, { label: "Oat", price: 0.6 }, { label: "Almond", price: 0.6 }] },
        { key: "sweetness", label: "Sweetness", choices: [{ label: "Classic", price: 0 }, { label: "Light", price: 0 }, { label: "Unsweetened", price: 0 }] }
      ]
    },
    {
      id: "green-tea",
      name: "Iced Green Tea",
      category: "Tea",
      price: 4.25,
      description: "Light, citrusy and made with real brewed green tea.",
      image: image("photo-1556679343-c7306c1976bc"),
      emoji: "🍵",
      badge: "",
      badgeClass: "veg",
      popular: true,
      drink: true,
      options: [
        { key: "size", label: "Size", required: true, choices: [{ label: "Tall", price: 0 }, { label: "Grande", price: 0.6 }] },
        { key: "sweetness", label: "Sweetness", choices: [{ label: "Light", price: 0 }, { label: "Unsweetened", price: 0 }] },
        { key: "ice", label: "Ice", choices: [{ label: "Regular ice", price: 0 }, { label: "Light ice", price: 0 }, { label: "No ice", price: 0 }] }
      ]
    },
    {
      id: "blueberry-muffin",
      name: "Blueberry Muffin",
      category: "Bakery",
      price: 3.25,
      description: "A bakery classic with a tender crumb and bright berries.",
      image: image("photo-1587314168485-3236d6710814"),
      emoji: "🧁",
      badge: "Baked today",
      badgeClass: "veg",
      popular: true,
      drink: false,
      options: []
    },
    {
      id: "butter-croissant",
      name: "Butter Croissant",
      category: "Bakery",
      price: 3.75,
      description: "Flaky, golden layers made with real butter.",
      image: image("photo-1555507036-ab1f4038808a"),
      emoji: "🥐",
      badge: "Baked today",
      popular: true,
      drink: false,
      options: []
    },
    {
      id: "breakfast-sandwich",
      name: "Egg & Cheddar",
      category: "Breakfast",
      price: 6.25,
      description: "Soft egg, aged cheddar and a warm toasted ciabatta.",
      image: image("photo-1606756790138-5f6c3e7c2c9a"),
      emoji: "🥪",
      badge: "Popular",
      popular: true,
      drink: false,
      options: []
    },
    {
      id: "oat-biscotti",
      name: "Oat Biscotti",
      category: "Bakery",
      price: 2.95,
      description: "A crisp, oat-packed bite for the perfect mid-morning pause.",
      image: image("photo-1558961363-fa8fdf82db35"),
      emoji: "🍪",
      badge: "",
      popular: false,
      drink: false,
      options: []
    }
  ];
  let seedOrders = [];
  let cart = [];
  let sessionOrders = [];
  let activeCategory = "All";
  let searchTerm = "";
  let popularOnly = false;
  let selectedItem = null;
  let selectedOptions = {};
  let customizerQuantity = 1;
  let paymentMethod = "Cash";
  let paymentAmountReceived = 0;
  let activeView = "order";
  let toastTimer;
  let currentUser = null;
  let paymentMethodsAvailable = ["Cash", "GCash"];
  let pendingServerOrder = null;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    if (page !== "pos") return;
    try {
      const response = await fetch("/api/auth/session", { credentials: "same-origin" });
      const result = await response.json();
      if (!response.ok || !result.authenticated || result.user?.role !== "cashier") {
        window.location.replace("/index.html");
        return;
      }
      currentUser = result.user;
      if (currentUser.mustChangePassword) {
        window.location.replace("/index.html#change-password");
        return;
      }
      await loadPOSData();
    } catch (error) {
      console.error("Unable to initialize the cashier workspace:", error);
      window.location.replace("/index.html");
      return;
    }
    setText("#cashier-name", currentUser.fullName);
    setText("#cashier-short-name", currentUser.fullName.split(/\s+/)[0]);
    setText("#cashier-initials", currentUser.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase());
    bindEvents();
    setDateAndTime();
    window.setInterval(setDateAndTime, 30000);
    renderMenu();
    renderOrder();
    renderRecentOrders();
    updateMetrics();
    updatePopularButton();
    setText("#order-number", "New");
    const hashView = window.location.hash.replace("#", "");
    if (["order", "orders", "menu", "inventory", "customers", "reports"].includes(hashView) && hashView !== "order") showView(hashView, false);
  }

  async function loadPOSData() {
    const fetchJSON = async (url) => {
      const response = await fetch(url, { credentials: "same-origin" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
      return result;
    };
    const [catalog, mine, analytics, publicSettings] = await Promise.all([
      fetchJSON("/api/catalog"),
      fetchJSON("/api/orders/mine?range=month"),
      fetchJSON("/api/analytics/cashier"),
      fetchJSON("/api/settings/public")
    ]);

    TAX_RATE = Number(publicSettings.settings.tax_rate) || 0;
    SERVICE_RATE = Number(publicSettings.settings.service_charge) || 0;
    money = new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: publicSettings.settings.currency || "PHP"
    });
    paymentMethodsAvailable = Array.isArray(publicSettings.settings.payment_methods)
      ? publicSettings.settings.payment_methods.filter((method) => typeof method === "string" && method.trim())
      : ["Cash"];
    if (!paymentMethodsAvailable.length) throw new Error("No payment methods are configured. Ask an administrator to configure checkout.");
    paymentMethod = paymentMethodsAvailable[0];
    menuItems = catalog.products.filter((product) => product.isAvailable).map((product) => ({
      id: String(product.id),
      productId: product.id,
      name: product.name,
      category: product.category,
      price: Number(product.price),
      description: product.description || "",
      image: product.image || image(product.category.includes("Tea") || product.category.includes("Matcha") ? "photo-1515823064-d6e0c04616a7" : "photo-1495474472287-4d71bcdd2085"),
      emoji: product.emoji || "☕",
      badge: product.isFeatured ? "Popular" : "",
      badgeClass: "",
      popular: Boolean(product.isFeatured),
      drink: product.hasSizes,
      options: product.hasSizes ? [{
        key: "size",
        label: "Size",
        required: true,
        choices: product.sizes.map((size) => ({ label: size.name, price: Number(size.price_delta) || 0 }))
      }] : []
    }));
    productMap.clear();
    menuItems.forEach((item) => productMap.set(item.id, item));
    cart = normalizeCart(readStorage(STORAGE.cart, []));
    sessionOrders = normalizeOrders(mine.orders.map((order) => ({
      id: order.order_number,
      customer: order.customer_name,
      items: order.items.map((item) => ({ name: item.product_name, quantity: item.quantity, price: item.unit_price })),
      total: order.total,
      status: order.status.replace(/^./, (letter) => letter.toUpperCase()),
      createdAt: order.created_at,
      paid: order.payment_status === "paid"
    })));
    seedOrders = [];
    renderCategories(catalog.categories);
    renderPaymentMethods(paymentMethodsAvailable);
    setText("#metric-sales", formatPrice(analytics.today.revenue));
    setText("#metric-open-tickets", String(analytics.today.orders));
    setText("#metric-average", formatPrice(analytics.today.orders ? analytics.today.revenue / analytics.today.orders : 0));
    renderMenu();
    renderOrder();
    renderRecentOrders();
    updateMetrics();
  }

  function renderCategories(categories) {
    const container = document.querySelector("#category-tabs");
    if (!container) return;
    const names = ["All", ...categories.map((category) => category.name)];
    container.innerHTML = names.map((name, index) => `<button class="category-tab ${index === 0 ? "active" : ""}" type="button" data-category="${escapeHTML(name)}" role="tab" aria-selected="${index === 0}"><span>${index === 0 ? "▦" : "☕"}</span>${escapeHTML(name)}</button>`).join("");
  }

  function renderPaymentMethods(methods) {
    const container = document.querySelector(".payment-methods");
    if (!container) return;
    container.innerHTML = methods.map((method, index) => {
      const icon = method === "Cash" ? "$" : method === "Card" ? "▱" : "⌁";
      const description = method === "Cash" ? "Record cash received" : "Enter payment reference";
      return `<button class="payment-method ${index === 0 ? "active" : ""}" type="button" data-payment-method="${escapeHTML(method)}"><span class="payment-method-icon">${icon}</span><span><strong>${escapeHTML(method)}</strong><small>${description}</small></span><i>✓</i></button>`;
    }).join("");
  }

  function bindEvents() {
    document.querySelector("#category-tabs")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      activeCategory = button.dataset.category;
      document.querySelectorAll("[data-category]").forEach((tab) => {
        const selected = tab === button;
        tab.classList.toggle("active", selected);
        tab.setAttribute("aria-selected", String(selected));
      });
      renderMenu();
    });

    document.querySelector("#menu-grid")?.addEventListener("click", (event) => {
      const item = event.target.closest("[data-product-id]");
      if (item) openCustomizer(item.dataset.productId);
    });

    document.querySelector("#menu-search")?.addEventListener("input", (event) => {
      searchTerm = event.target.value.trim().toLowerCase();
      renderMenu();
    });

    document.querySelector("#popular-filter")?.addEventListener("click", () => {
      popularOnly = !popularOnly;
      updatePopularButton();
      renderMenu();
    });
    document.querySelector("#clear-filters")?.addEventListener("click", clearFilters);
    document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
      document.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("active", item === button));
      showToast(`${button.dataset.mode === "drive" ? "Drive-thru" : "Counter"} mode selected`);
    }));
    document.querySelectorAll("[data-quick-action]").forEach((button) => button.addEventListener("click", () => handleQuickAction(button.dataset.quickAction)));
    document.querySelectorAll("[data-view]").forEach((link) => link.addEventListener("click", (event) => {
      event.preventDefault();
      showView(link.dataset.view);
    }));

    document.querySelector("#order-items")?.addEventListener("click", handleOrderItemClick);
    document.querySelector("#clear-order")?.addEventListener("click", clearOrder);
    document.querySelector("#charge-button")?.addEventListener("click", openPayment);
    document.querySelector("#hold-order")?.addEventListener("click", () => showToast(cart.length ? "Order saved to the hold queue" : "Add an item before holding an order"));
    document.querySelector("#hold-link")?.addEventListener("click", () => showToast(cart.length ? "Order saved to the hold queue" : "Add an item before holding an order"));

    document.querySelector("#customizer-close")?.addEventListener("click", closeCustomizer);
    document.querySelector("#customizer-options")?.addEventListener("click", (event) => {
      const button = event.target.closest(".option-button");
      if (!button) return;
      const group = button.closest("[data-option-group]");
      if (!group || !selectedItem) return;
      const optionGroup = selectedItem.options.find((entry) => entry.key === group.dataset.optionGroup);
      const choice = optionGroup?.choices.find((entry) => entry.label === button.dataset.choice);
      if (!choice) return;
      selectedOptions[group.dataset.optionGroup] = { label: choice.label, price: Number(choice.price) || 0 };
      group.querySelectorAll(".option-button").forEach((item) => item.classList.toggle("selected", item === button));
      updateCustomizerPrice();
    });
    document.querySelectorAll("[data-custom-quantity]").forEach((button) => button.addEventListener("click", () => {
      customizerQuantity = Math.max(1, Math.min(99, customizerQuantity + (button.dataset.customQuantity === "increase" ? 1 : -1)));
      updateCustomizerQuantity();
    }));
    document.querySelector("#add-custom-item")?.addEventListener("click", addCustomItemToOrder);

    document.querySelector("#payment-close")?.addEventListener("click", closePayment);
    document.querySelector(".payment-methods")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-payment-method]");
      if (!button) return;
      paymentMethod = button.dataset.paymentMethod;
      paymentAmountReceived = 0;
      renderPayment();
    });
    document.querySelector("#payment-detail")?.addEventListener("input", (event) => {
      if (!event.target.matches("#cash-received")) return;
      paymentAmountReceived = Math.max(0, Number.parseFloat(event.target.value) || 0);
      updateCashChange();
    });
    document.querySelector("#confirm-payment")?.addEventListener("click", completePayment);
    document.querySelector("#start-new-order")?.addEventListener("click", startNewOrder);
    document.querySelector("#print-receipt")?.addEventListener("click", () => showToast("Receipt sent to the printer"));

    document.querySelector("#modal-backdrop")?.addEventListener("click", closeActiveModal);
    document.querySelector("#mobile-nav-toggle")?.addEventListener("click", () => setSidebar(true));
    document.querySelector("#sidebar-dismiss")?.addEventListener("click", () => setSidebar(false));
    document.querySelector("#sidebar-backdrop")?.addEventListener("click", () => setSidebar(false));
    document.querySelector("#view-orders")?.addEventListener("click", () => showView("orders"));
    document.querySelector("#back-to-order")?.addEventListener("click", () => showView("order"));
    document.querySelector("#notification-button")?.addEventListener("click", () => showToast("No new notifications"));
    document.querySelector("#store-switcher")?.addEventListener("click", () => showToast("Trippers Coffee is the active register"));
    document.querySelector("#profile-menu")?.addEventListener("click", signOut);
    document.querySelector("#pos-signout")?.addEventListener("click", signOut);
    document.querySelector("#menu-settings")?.addEventListener("click", () => showToast("Menu settings are up to date"));
    document.querySelector("#barista-guide")?.addEventListener("click", () => showToast("Barista guide opened"));
    document.addEventListener("keydown", handleGlobalKeydown);
  }

  async function signOut() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("Sign out failed. Please try again.");
      window.location.replace("/index.html");
    } catch (error) {
      showToast(error.message);
    }
  }

  function renderMenu() {
    const grid = document.querySelector("#menu-grid");
    if (!grid) return;
    const filtered = menuItems.filter((item) => {
      const categoryMatch = activeCategory === "All" || item.category === activeCategory;
      const searchMatch = !searchTerm || `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(searchTerm);
      return categoryMatch && searchMatch && (!popularOnly || item.popular);
    });
    grid.innerHTML = filtered.map(menuItemTemplate).join("");
    const empty = document.querySelector("#menu-empty");
    if (empty) empty.hidden = filtered.length > 0;
  }

  function menuItemTemplate(item) {
    const badge = item.badge ? `<span class="item-badge ${item.badgeClass || ""}">${escapeHTML(item.badge)}</span>` : "";
    return `<button class="menu-item" type="button" data-product-id="${item.id}">
      <span class="item-art" style="--fallback-bg: ${item.badgeClass === "new" ? "#e8c1b4" : item.category === "Tea" ? "#d6e5c8" : "#b7d9bd"}">
        <span class="item-art-fallback" aria-hidden="true">${item.emoji}</span>
        <img src="${item.image}" alt="${escapeHTML(item.name)}" loading="lazy" onerror="this.style.display='none'">
        ${badge}
      </span>
      <span class="item-body"><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.description)}</small><span class="item-footer"><span class="item-price">${formatPrice(item.price)}</span><span class="item-add" aria-hidden="true">+</span></span></span>
    </button>`;
  }

  function openCustomizer(productId) {
    const item = productMap.get(productId);
    if (!item) return;
    selectedItem = item;
    customizerQuantity = 1;
    selectedOptions = {};
    item.options.forEach((group) => {
      const defaultChoice = group.key === "size"
        ? group.choices.find((choice) => choice.label.toLowerCase() === "medium") || group.choices[0]
        : group.choices[0];
      if (group.required && defaultChoice) selectedOptions[group.key] = { label: defaultChoice.label, price: Number(defaultChoice.price) || 0 };
    });
    const category = document.querySelector("#customizer-category");
    const title = document.querySelector("#customizer-title");
    const description = document.querySelector("#customizer-description");
    const art = document.querySelector("#customizer-art");
    const options = document.querySelector("#customizer-options");
    const notes = document.querySelector("#item-notes");
    if (category) category.textContent = item.category;
    if (title) title.textContent = item.name;
    if (description) description.textContent = item.description;
    if (art) art.innerHTML = `<span class="customizer-art-fallback" aria-hidden="true">${item.emoji}</span><img src="${item.image}" alt="${escapeHTML(item.name)}" onerror="this.style.display='none'">`;
    if (options) options.innerHTML = item.options.length ? item.options.map(optionGroupTemplate).join("") : `<div class="non-drink-note"><span>✦</span><p>Made fresh to order. Add a note below if you’d like the barista to customize it.</p></div>`;
    if (notes) notes.value = "";
    updateCustomizerQuantity();
    updateCustomizerPrice();
    openModal(document.querySelector("#customizer-modal"));
  }

  function optionGroupTemplate(group) {
    const selected = selectedOptions[group.key]?.label || group.choices[0]?.label;
    return `<div class="option-group" data-option-group="${group.key}">
      <div class="option-group-heading"><span>${escapeHTML(group.label)}${group.required ? " *" : ""}</span><small>${group.required ? "Required" : "Optional"}</small></div>
      <div class="option-grid">${group.choices.map((choice) => `<button class="option-button ${choice.label === selected ? "selected" : ""}" type="button" data-choice="${escapeHTML(choice.label)}">${escapeHTML(choice.label)}${Number(choice.price) ? ` +${formatPrice(choice.price)}` : ""}</button>`).join("")}</div>
    </div>`;
  }

  function updateCustomizerQuantity() {
    const quantity = document.querySelector("#customizer-quantity");
    if (quantity) quantity.textContent = customizerQuantity;
  }

  function updateCustomizerPrice() {
    const price = document.querySelector("#customizer-price");
    if (price) price.textContent = formatPrice(customizerUnitPrice() * customizerQuantity);
  }

  function customizerUnitPrice() {
    if (!selectedItem) return 0;
    return selectedItem.price + Object.values(selectedOptions).reduce((sum, option) => sum + Number(option.price || 0), 0);
  }

  function addCustomItemToOrder() {
    if (!selectedItem) return;
    const itemName = selectedItem.name;
    const notes = String(document.querySelector("#item-notes")?.value || "").trim();
    const options = { ...selectedOptions };
    const key = makeCartKey(selectedItem.id, options, notes);
    const existing = cart.find((item) => item.key === key);
    if (existing) existing.quantity = Math.min(99, existing.quantity + customizerQuantity);
    else cart.push({ key, id: selectedItem.id, options, notes, quantity: customizerQuantity });
    saveCart();
    renderOrder();
    closeCustomizer();
    showToast(`${itemName} added to the ticket`);
  }

  function renderOrder() {
    const container = document.querySelector("#order-items");
    if (!container) return;
    const hasItems = cart.length > 0;
    const empty = document.querySelector("#order-empty");
    if (empty) empty.hidden = hasItems;
    container.hidden = !hasItems;
    container.innerHTML = hasItems ? cart.map(orderItemTemplate).join("") : "";
    updateTotals();
  }

  function orderItemTemplate(item) {
    const product = productMap.get(item.id);
    if (!product) return "";
    const modifiers = Object.values(item.options || {}).map((option) => option.label).join(" · ");
    const detail = [modifiers, item.notes ? `Note: ${item.notes}` : ""].filter(Boolean).join(" · ");
    return `<article class="order-item" data-line-key="${escapeHTML(item.key)}">
      <div class="order-item-art"><span aria-hidden="true">${product.emoji}</span><img src="${product.image}" alt="" onerror="this.style.display='none'"></div>
      <div class="order-item-copy"><strong>${escapeHTML(product.name)}</strong><small title="${escapeHTML(detail)}">${escapeHTML(detail || "Standard build")}</small><div class="order-item-bottom"><div class="order-item-quantity"><button type="button" data-quantity-action="decrease" aria-label="Decrease ${escapeHTML(product.name)}">−</button><span>${item.quantity}</span><button type="button" data-quantity-action="increase" aria-label="Increase ${escapeHTML(product.name)}">+</button></div><button class="order-item-remove" type="button" data-quantity-action="remove">Remove</button></div></div>
      <strong class="order-item-price">${formatPrice((product.price + optionTotal(item.options)) * item.quantity)}</strong>
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

  function updateTotals() {
    const subtotal = cartSubtotal();
    const tax = subtotal * TAX_RATE;
    const service = subtotal * SERVICE_RATE;
    const total = subtotal + tax + service;
    setText("#order-subtotal", formatPrice(subtotal));
    setText("#order-tax", formatPrice(tax));
    setText("#order-service", formatPrice(service));
    setText("#tax-rate-label", `${(TAX_RATE * 100).toFixed(2).replace(/\.?0+$/, "")}%`);
    setText("#service-rate-label", `${(SERVICE_RATE * 100).toFixed(2).replace(/\.?0+$/, "")}%`);
    const serviceRow = document.querySelector("#service-charge-row");
    if (serviceRow) serviceRow.hidden = SERVICE_RATE <= 0;
    setText("#order-total", formatPrice(total));
    setText("#charge-amount", formatPrice(total));
    const chargeButton = document.querySelector("#charge-button");
    if (chargeButton) chargeButton.disabled = cart.length === 0;
  }

  function cartSubtotal() {
    return cart.reduce((sum, line) => {
      const product = productMap.get(line.id);
      return sum + (product ? (product.price + optionTotal(line.options)) * line.quantity : 0);
    }, 0);
  }

  function openPayment() {
    if (!cart.length) {
      showToast("Add a drink or bite before charging");
      return;
    }
    paymentMethod = paymentMethodsAvailable[0] || "Cash";
    paymentAmountReceived = 0;
    renderPayment();
    document.querySelector("#payment-view").hidden = false;
    document.querySelector("#payment-success").hidden = true;
    openModal(document.querySelector("#payment-modal"));
  }

  function renderPayment() {
    const total = pendingServerOrder?.total || cartSubtotal() * (1 + TAX_RATE + SERVICE_RATE);
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    setText("#payment-total", formatPrice(total));
    setText("#payment-order-number", pendingServerOrder?.order_number || "New");
    setText("#payment-item-count", `${itemCount} ${itemCount === 1 ? "item" : "items"}`);
    setText("#confirm-payment-amount", formatPrice(total));
    document.querySelectorAll("[data-payment-method]").forEach((button) => button.classList.toggle("active", button.dataset.paymentMethod === paymentMethod));
    const detail = document.querySelector("#payment-detail");
    if (!detail) return;
    if (paymentMethod === "Cash") {
      detail.innerHTML = `<p>Cash received</p><div class="payment-detail-row"><span>Change due</span><strong id="cash-change">${formatPrice(0)}</strong></div><label class="sr-only" for="cash-received">Cash received</label><input id="cash-received" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" value="${paymentAmountReceived || ""}">`;
      window.setTimeout(() => document.querySelector("#cash-received")?.focus(), 40);
    } else {
      detail.innerHTML = `<p>Confirm the payment was received through ${escapeHTML(paymentMethod)}.</p><label class="sr-only" for="payment-reference">Payment reference</label><input id="payment-reference" type="text" maxlength="80" placeholder="Enter payment reference">`;
    }
  }

  function updateCashChange() {
    const change = document.querySelector("#cash-change");
    if (!change) return;
    const total = pendingServerOrder?.total || cartSubtotal() * (1 + TAX_RATE + SERVICE_RATE);
    change.textContent = formatPrice(Math.max(0, paymentAmountReceived - total));
  }

  async function completePayment() {
    if (!cart.length) return;
    const total = pendingServerOrder?.total || cartSubtotal() * (1 + TAX_RATE + SERVICE_RATE);
    if (paymentMethod === "Cash" && paymentAmountReceived < total) {
      showToast("Enter the cash received before completing the sale");
      document.querySelector("#cash-received")?.focus();
      return;
    }
    const reference = String(document.querySelector("#payment-reference")?.value || "").trim();
    if (paymentMethod !== "Cash" && !reference) {
      showToast("Enter the payment reference before completing the sale");
      document.querySelector("#payment-reference")?.focus();
      return;
    }
    const confirmButton = document.querySelector("#confirm-payment");
    if (confirmButton) confirmButton.disabled = true;
    const customerInput = String(document.querySelector("#customer-name")?.value || "").trim();
    try {
      const requestJSON = async (url, body) => {
        const response = await fetch(url, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
        return result;
      };
      if (!pendingServerOrder) {
        const created = await requestJSON("/api/orders", {
          customerName: customerInput || "Walk-in guest",
          items: cart.map((line) => ({
            productId: Number(line.id),
            quantity: line.quantity,
            size: line.options?.size?.label || "",
            notes: line.notes
          }))
        });
        pendingServerOrder = created.order;
        if (paymentMethod === "Cash" && paymentAmountReceived < pendingServerOrder.total) {
          renderPayment();
          showToast(`Enter at least ${formatPrice(pendingServerOrder.total)} cash received.`);
          document.querySelector("#cash-received")?.focus();
          return;
        }
      }
      const paid = await requestJSON(`/api/orders/${pendingServerOrder.id}/pay`, {
        method: paymentMethod,
        tendered: paymentAmountReceived,
        amount: pendingServerOrder.total,
        reference,
        confirmed: true
      });
      const order = {
        id: paid.order.order_number,
        customer: paid.order.customer_name,
        items: paid.order.items.map((item) => ({ name: item.product_name, quantity: item.quantity, price: item.unit_price })),
        total: paid.order.total,
        status: paid.order.status.replace(/^./, (letter) => letter.toUpperCase()),
        createdAt: paid.order.created_at,
        paid: true
      };
      sessionOrders = [order, ...sessionOrders.filter((existing) => existing.id !== order.id)];
      pendingServerOrder = null;
      cart = [];
      saveCart();
      renderOrder();
      renderRecentOrders();
      updateMetrics();
      document.querySelector("#payment-view").hidden = true;
      document.querySelector("#payment-success").hidden = false;
      setText("#receipt-number", order.id);
      setText("#receipt-total", formatPrice(order.total));
      showToast(`Payment approved · ${order.id}`);
    } catch (error) {
      showToast(`Payment was not completed: ${error.message}`);
    } finally {
      if (confirmButton) confirmButton.disabled = false;
    }
  }

  async function startNewOrder() {
    if (!await closePayment()) return;
    paymentAmountReceived = 0;
    setText("#order-number", "New");
    const customer = document.querySelector("#customer-name");
    if (customer) customer.value = "";
    window.setTimeout(() => customer?.focus(), 120);
  }

  function renderRecentOrders() {
    const container = document.querySelector("#recent-orders");
    if (!container) return;
    const allOrders = [...sessionOrders, ...seedOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);
    container.innerHTML = allOrders.length ? allOrders.map((order) => {
      const count = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const firstItem = order.items?.[0]?.name || "Coffee order";
      const extra = count > 1 ? ` + ${count - 1} more` : "";
      const statusClass = order.status === "Ready" ? "ready" : order.status === "Preparing" ? "progress" : "";
      return `<article class="recent-order"><span class="recent-order-number">${escapeHTML(order.id.replace("#", ""))}</span><span class="recent-order-copy"><strong>${escapeHTML(firstItem)}${escapeHTML(extra)}</strong><small>${escapeHTML(order.customer)} · ${formatTime(order.createdAt)}</small></span><span class="recent-order-total">${formatPrice(order.total)}</span><span class="recent-order-status ${statusClass}">${escapeHTML(order.status)}</span></article>`;
    }).join("") : `<div class="empty-row">No orders yet today.</div>`;
    const orderCount = document.querySelector("#nav-order-count");
    if (orderCount) orderCount.textContent = String(sessionOrders.length);
  }

  function updateMetrics() {
    const todayOrders = sessionOrders.filter((order) => order.paid && new Date(order.createdAt).toDateString() === new Date().toDateString());
    const sales = todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const open = sessionOrders.filter((order) => ["Pending", "Preparing", "Ready"].includes(order.status));
    setText("#metric-sales", formatPrice(sales));
    setText("#metric-average", formatPrice(todayOrders.length ? sales / todayOrders.length : 0));
    setText("#metric-open-tickets", String(open.length));
    setText("#metric-ready", String(open.filter((order) => order.status === "Ready").length));
  }

  function handleQuickAction(action) {
    if (action === "new") {
      cart = [];
      saveCart();
      renderOrder();
      const customer = document.querySelector("#customer-name");
      if (customer) customer.value = "";
      setText("#order-number", "New");
      showToast("Started a new order");
      return;
    }
    if (action === "drawer") {
      showToast("Cash drawer tracking is not available in this register view.");
      return;
    }
    if (action === "handoff") {
      showView("orders");
      return;
    }
    if (action === "pause") showToast("Register is ready to pause");
  }

  function clearOrder() {
    if (!cart.length) {
      showToast("This ticket is already empty");
      return;
    }
    cart = [];
    saveCart();
    renderOrder();
    showToast("Ticket cleared");
  }

  function clearFilters() {
    activeCategory = "All";
    searchTerm = "";
    popularOnly = false;
    const search = document.querySelector("#menu-search");
    if (search) search.value = "";
    document.querySelectorAll("[data-category]").forEach((tab) => {
      const selected = tab.dataset.category === "All";
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    updatePopularButton();
    renderMenu();
  }

  function updatePopularButton() {
    document.querySelector("#popular-filter")?.classList.toggle("active", popularOnly);
  }

  function showView(view, updateHash = true) {
    const knownViews = ["order", "orders", "menu", "inventory", "customers", "reports"];
    if (!knownViews.includes(view)) view = "order";
    activeView = view;
    const primary = document.querySelector("#order-view");
    const secondary = document.querySelector("#secondary-view");
    const isOrder = view === "order";
    if (primary) primary.hidden = !isOrder;
    if (secondary) secondary.hidden = isOrder;
    if (!isOrder) {
      const copy = {
        orders: ["◷", "Order history", "Review the tickets from your current shift and keep an eye on the queue."],
        menu: ["☷", "Menu items", "Keep your drinks, food and modifiers current for every shift."],
        inventory: ["▤", "Inventory", "Track the ingredients and retail items that keep the bar moving."],
        customers: ["◎", "Customers", "Your regulars and their preferences, all in one calm workspace."],
        reports: ["↗", "Reports", "A simple view of sales, tender mix and the shift ahead."]
      }[view];
      setText("#secondary-icon", copy[0]);
      setText("#secondary-title", copy[1]);
      setText("#secondary-copy", copy[2]);
      setText("#secondary-kicker", "Trippers workspace");
    }
    document.querySelectorAll("[data-view]").forEach((link) => link.classList.toggle("active", link.dataset.view === view));
    if (updateHash) history.replaceState(null, "", `#${view}`);
    setSidebar(false);
  }

  function setSidebar(open) {
    const sidebar = document.querySelector("#app-sidebar");
    const backdrop = document.querySelector("#sidebar-backdrop");
    const toggle = document.querySelector("#mobile-nav-toggle");
    sidebar?.classList.toggle("is-open", open);
    if (backdrop) backdrop.hidden = !open;
    toggle?.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("no-scroll", open);
  }

  function openModal(modal) {
    if (!modal) return;
    const backdrop = document.querySelector("#modal-backdrop");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    backdrop?.removeAttribute("hidden");
    window.requestAnimationFrame(() => backdrop?.classList.add("is-visible"));
    document.body.classList.add("no-scroll");
  }

  function closeActiveModal() {
    const customizer = document.querySelector("#customizer-modal");
    const payment = document.querySelector("#payment-modal");
    const backdrop = document.querySelector("#modal-backdrop");
    customizer?.classList.remove("is-open");
    payment?.classList.remove("is-open");
    customizer?.setAttribute("aria-hidden", "true");
    payment?.setAttribute("aria-hidden", "true");
    backdrop?.classList.remove("is-visible");
    window.setTimeout(() => backdrop?.setAttribute("hidden", ""), 260);
    document.body.classList.remove("no-scroll");
  }

  function closeCustomizer() {
    closeActiveModal();
    selectedItem = null;
  }

  async function closePayment() {
    if (pendingServerOrder) {
      try {
        const response = await fetch(`/api/orders/${pendingServerOrder.id}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled", reason: "Cashier cancelled the unpaid checkout." })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
        pendingServerOrder = null;
      } catch (error) {
        showToast(`Unable to cancel the unpaid order: ${error.message}`);
        return false;
      }
    }
    closeActiveModal();
    const paymentView = document.querySelector("#payment-view");
    const success = document.querySelector("#payment-success");
    if (paymentView) paymentView.hidden = false;
    if (success) success.hidden = true;
    return true;
  }

  function handleGlobalKeydown(event) {
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
    if (event.key === "Escape") {
      if (document.querySelector("#customizer-modal.is-open")) closeCustomizer();
      else if (document.querySelector("#payment-modal.is-open")) closePayment();
      else if (document.querySelector("#app-sidebar.is-open")) setSidebar(false);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.querySelector("#menu-search")?.focus();
      return;
    }
    if (isTyping) return;
    if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      cart = [];
      saveCart();
      renderOrder();
      showToast("Started a new order");
    }
  }

  function setDateAndTime() {
    const now = new Date();
    const date = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now);
    setText("#today-label", date.toUpperCase());
    setText("#live-time", new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now));
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function makeCartKey(id, options, notes) {
    return `${id}::${Object.entries(options || {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, option]) => `${key}=${option.label}`).join("|")}::${notes || ""}`;
  }

  function optionTotal(options) {
    return Object.values(options || {}).reduce((sum, option) => sum + Number(option.price || 0), 0);
  }

  function resolveLoyaltyCustomer(value) {
    const input = String(value || "").trim();
    if (!input) return null;
    const storedCustomers = readStorage(SHARED_STORAGE.loyalty, []);
    const customers = Array.isArray(storedCustomers) ? storedCustomers.filter((customer) => customer && typeof customer === "object") : [];
    const email = normalizeEmail(input);
    let customer = customers.find((entry) => String(entry.id || "").toLowerCase() === input.toLowerCase() || (email && normalizeEmail(entry.email) === email));
    if (!customer) {
      const nameMatches = customers.filter((entry) => normalizeName(entry.name) === normalizeName(input));
      if (nameMatches.length === 1) customer = nameMatches[0];
    }
    if (!customer && isValidEmail(email)) {
      customer = { id: createLoyaltyId(customers), name: email.split("@")[0] || "Trippers member", email, points: 0, tier: "Member", orders: 0, qualifyingOrderIds: [], lastVisit: new Date().toISOString(), joinedAt: new Date().toISOString(), cardStatus: "Pending", cardIssuedAt: null };
      customers.unshift(customer);
      writeStorage(SHARED_STORAGE.loyalty, customers);
    }
    return customer ? { customer, customers } : null;
  }

  function recordLoyaltyOrder(order, customer, customers) {
    const list = Array.isArray(customers) ? customers : [customer];
    const orderKey = String(order.id || `#legacy-${order.createdAt || ""}-${order.total || 0}`);
    const knownIds = new Set(Array.isArray(customer.qualifyingOrderIds) ? customer.qualifyingOrderIds.map(String) : []);
    if (!knownIds.has(orderKey)) {
      knownIds.add(orderKey);
      customer.orders = Math.max(0, Number(customer.orders) || 0) + 1;
    }
    customer.qualifyingOrderIds = [...knownIds];
    customer.lastVisit = order.createdAt || new Date().toISOString();
    const status = String(customer.cardStatus || "").trim().toLowerCase();
    customer.cardStatus = status === "active" ? "Active" : status === "qualified" ? "Qualified" : "Pending";
    let issued = false;
    if (customer.orders < LOYALTY_THRESHOLD && customer.cardStatus !== "Active") customer.cardStatus = "Pending";
    if (customer.orders >= LOYALTY_THRESHOLD && customer.cardStatus !== "Active") {
      const stock = readCardStock();
      if (stock > 0 && writeStorage(SHARED_STORAGE.cardInventory, stock - 1)) {
        customer.cardStatus = "Active";
        customer.cardIssuedAt = new Date().toISOString();
        issued = true;
      } else {
        customer.cardStatus = "Qualified";
      }
    }
    writeStorage(SHARED_STORAGE.loyalty, list);
    return { customer, issued };
  }

  function createLoyaltyId(customers) {
    const usedIds = new Set(customers.map((customer) => String(customer?.id || "")));
    let id;
    do { id = `TC-${String(Date.now()).slice(-5)}${Math.floor(Math.random() * 90 + 10)}`; } while (usedIds.has(id));
    return id;
  }

  function readCardStock() {
    const value = Number(readStorage(SHARED_STORAGE.cardInventory, DEFAULT_CARD_STOCK));
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_CARD_STOCK;
  }

  function normalizeEmail(value) { return String(value || "").trim().toLowerCase(); }
  function normalizeName(value) { return String(value || "").trim().toLowerCase().replace(/\s+/g, " "); }
  function isValidEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value)); }

  function normalizeOrders(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((order) => order && typeof order === "object").map((order, index) => ({
      ...order,
      id: String(order.id || `#legacy-${order.createdAt || "unknown"}-${index}`),
      customer: String(order.customer || "Walk-in guest"),
      items: Array.isArray(order.items) ? order.items : [],
      total: Number(order.total) || 0,
      status: String(order.status || "Preparing"),
      createdAt: order.createdAt || new Date().toISOString()
    }));
  }

  function normalizeCart(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && productMap.has(item.id)).map((item) => ({
      key: String(item.key || makeCartKey(item.id, item.options || {}, item.notes || "")),
      id: item.id,
      options: item.options && typeof item.options === "object" ? item.options : {},
      notes: String(item.notes || "").slice(0, 120),
      quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1))
    }));
  }

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

  function saveCart() {
    writeStorage(STORAGE.cart, cart);
  }

  function formatPrice(value) {
    return money.format(Number(value) || 0);
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
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
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3000);
  }
})();
