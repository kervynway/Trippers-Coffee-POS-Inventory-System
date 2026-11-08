(() => {
  "use strict";

  // The dashboard needs its API server; never run it from a local file.
  if (window.location.protocol === "file:") {
    window.location.replace("http://127.0.0.1:4173/admin/dashboard.html");
    return;
  }

  const STORAGE = { orders: "trippersOrders", inventory: "trippersAdminInventory", productStatus: "trippersProductStatus", loyalty: "trippersLoyaltyCustomers", cardInventory: "trippersLoyaltyCardInventory", activeCustomer: "trippersActiveLoyaltyCustomer" };
  const page = document.body?.dataset.page || "";
  const LOYALTY_THRESHOLD = 5;
  const DEFAULT_CARD_STOCK = 84;
  const money = (value) => `₱${Math.round(Number(value) || 0)}`;
  const image = (id, width = 160) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;
  const menuProductData = [
    ["cafe-latte", "Cafe Latte", "Coffee", 49], ["americano", "Americano", "Coffee", 49], ["vietnamese", "Vietnamese", "Coffee", 59], ["spanish-latte", "Spanish Latte", "Coffee", 59], ["mocha-latte", "Mocha Latte", "Coffee", 59], ["white-mocha", "White Mocha", "Coffee", 59], ["caramel-latte", "Caramel Latte", "Coffee", 59], ["hazelnut", "Hazelnut", "Coffee", 59], ["caramel-hazelnut", "Caramel Hazelnut", "Coffee", 59], ["caramel-macchiato", "Caramel Macchiato", "Coffee", 69], ["caramel-mocha", "Caramel Mocha", "Coffee", 69], ["salted-caramel", "Salted Caramel", "Coffee", 69], ["french-vanilla", "French Vanilla", "Coffee", 69],
    ["iced-choco", "Iced Choco", "Non-Coffee", 49], ["strawberry-latte", "Strawberry Latte", "Non-Coffee", 49], ["strawberry-oreo", "Strawberry Oreo", "Non-Coffee", 59], ["cookies-and-cream", "Cookies and Cream", "Non-Coffee", 59], ["choco-hazelnut", "Choco Hazelnut", "Non-Coffee", 59], ["fruit-soda", "Fruit Soda", "Non-Coffee", 49], ["vanilla-strawberry", "Vanilla Strawberry", "Non-Coffee", 59], ["white-cookie", "White Cookie", "Non-Coffee", 69], ["biscoff-latte", "Biscoff Latte", "Premium Non-Coffee", 79], ["nutella-latte", "Nutella Latte", "Premium Non-Coffee", 79],
    ["strawberry-frappe", "Strawberry", "Frappe", 89], ["oreo-matcha-frappe", "Oreo Matcha", "Frappe", 89], ["cookies-cream-frappe", "Cookies and Cream", "Frappe", 89], ["ube-frappe", "Ube", "Frappe", 89], ["caramel-frappe", "Caramel", "Frappe", 89], ["chocolate-frappe", "Chocolate", "Frappe", 89],
    ["ube-latte", "Ube Latte", "Ube Series", 59], ["ube-oreo", "Ube Oreo", "Ube Series", 69], ["cafe-ube", "Cafe Ube", "Ube Series", 69], ["ube-matcha", "Ube Matcha", "Ube Series", 69],
    ["matcha-latte", "Matcha Latte", "Matcha Series", 59], ["oreo-matcha", "Oreo Matcha", "Matcha Series", 59], ["dirty-matcha", "Dirty Matcha", "Matcha Series", 59], ["matcha-strawberry", "Matcha Strawberry", "Matcha Series", 59]
  ];
  const products = menuProductData.map(([id, name, category, price]) => ({ id, name, category, price, emoji: "☕", type: "drink", stock: id === "hazelnut" ? 5 : id === "nutella-latte" ? 4 : 20, image: image(category.includes("Matcha") ? "photo-1515823064-d6e0c04616a7" : "photo-1495474472287-4d71bcdd2085") }));
  const productMap = new Map(products.map((product) => [product.id, product]));
  const nameMap = new Map(products.map((product) => [product.name, product]));
  const defaultInventory = Object.fromEntries(products.map((product) => [product.id, product.stock]));
  const relativeTime = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
  const seedOrders = [
    { id: "#1041", customer: "Maya Reyes", items: [{ name: "Iced Caramel Latte", quantity: 1, price: 145 }], total: 145, status: "New", createdAt: relativeTime(19) },
    { id: "#1040", customer: "Eli Santos", items: [{ name: "Spanish Latte", quantity: 1, price: 150 }], total: 150, status: "Preparing", createdAt: relativeTime(31) },
    { id: "#1039", customer: "Noah Garcia", items: [{ name: "Matcha Latte", quantity: 1, price: 160 }], total: 160, status: "Completed", createdAt: relativeTime(52) },
    { id: "#1038", customer: "Priya Lim", items: [{ name: "Americano", quantity: 1, price: 120 }], total: 120, status: "Completed", createdAt: relativeTime(76) }
  ];
  const seedCustomers = [
    { id: "TC-1042", name: "Maya Reyes", email: "maya.reyes@email.com", points: 2480, tier: "Gold", orders: 31, lastVisit: relativeTime(19), cardStatus: "Active" },
    { id: "TC-1038", name: "Eli Santos", email: "eli.santos@email.com", points: 1840, tier: "Gold", orders: 24, lastVisit: relativeTime(31), cardStatus: "Active" },
    { id: "TC-1027", name: "Noah Garcia", email: "noah.garcia@email.com", points: 3210, tier: "Platinum", orders: 42, lastVisit: relativeTime(52), cardStatus: "Active" },
    { id: "TC-1014", name: "Priya Lim", email: "priya.lim@email.com", points: 960, tier: "Member", orders: 14, lastVisit: relativeTime(76), cardStatus: "Active" },
    { id: "TC-1008", name: "Sam Wilson", email: "sam.wilson@email.com", points: 620, tier: "Member", orders: 9, lastVisit: relativeTime(140), cardStatus: "Active" },
    { id: "TC-0994", name: "Jasmine Cruz", email: "jasmine.cruz@email.com", points: 1280, tier: "Gold", orders: 19, lastVisit: relativeTime(220), cardStatus: "Active" }
  ];
  let sessionOrders = normalizeOrders(readStorage(STORAGE.orders, []));
  let inventory = { ...defaultInventory, ...readStorage(STORAGE.inventory, {}) };
  let productStatus = normalizeStatus(readStorage(STORAGE.productStatus, {}));
  let loyaltyCustomers = normalizeCustomers(readStorage(STORAGE.loyalty, seedCustomers));
  let loyaltyCardStock = readCardStock();
  let productFilter = "all";
  let liveProducts = [];
  let liveCategories = [];
  let liveIngredients = [];
  let liveCashiers = [];
  let toastTimer;
  const terminalOrderStatuses = new Set(["Completed", "Cancelled"]);
  let adminUser = null;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    if (page === "admin-login") initLogin();
    else if (page === "admin-dashboard") initDashboard();
  }

  function initLogin() {
    window.location.replace("/index.html");
  }

  async function initDashboard() {
    try {
      const response = await fetch("/api/auth/session", { credentials: "same-origin" });
      const result = await response.json();
      if (!response.ok || !result.authenticated || result.user?.role !== "admin") {
        window.location.replace("/index.html");
        return;
      }
      adminUser = result.user;
    } catch (error) {
      console.error("Unable to verify administrator session:", error);
      window.location.replace("/index.html");
      return;
    }
    const userName = document.querySelector(".admin-user strong");
    const avatar = document.querySelector(".admin-user-avatar");
    if (userName) userName.textContent = adminUser.fullName;
    if (avatar) avatar.textContent = initials(adminUser.fullName);
    const greeting = document.querySelector(".admin-page-heading h1");
    if (greeting) greeting.innerHTML = `Good morning, <em>${escapeHTML(adminUser.fullName.split(/\s+/)[0])}.</em>`;
    initializeInventory();
    refreshPersistedState();
    setDate();
    bindDashboard();
    renderDashboard();
    loadManagementData().catch((error) => {
      console.error("Unable to load Admin management data:", error);
      showToast(`Products, inventory, and cashier accounts could not be loaded: ${error.message}`);
    });
    loadDashboardSummary().catch((error) => {
      console.error("Unable to load dashboard data:", error);
      showToast(`Dashboard data could not be refreshed: ${error.message}`);
    });
    const hash = window.location.hash.replace("#", "");
    if (["dashboard", "products", "inventory", "staff", "loyalty", "orders", "cancelled", "sales"].includes(hash)) showSection(hash, false);
  }

  async function loadDashboardSummary() {
    const fetchJSON = async (url) => {
      const response = await fetch(url, { credentials: "same-origin" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
      return result;
    };
    const [today, week, orders, stock] = await Promise.all([
      fetchJSON("/api/analytics?range=today"),
      fetchJSON("/api/analytics?range=week"),
      fetchJSON("/api/orders?range=week&limit=8"),
      fetchJSON("/api/ingredients")
    ]);

    setText("#stat-low-stock", String(today.cards.lowStock));
    setText("#stat-today-orders", String(today.cards.rangeOrders));
    setText("#stat-today-sales", money(today.cards.salesToday));
    setText("#stat-order-date", new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date()));
    setText("#weekly-sales-total", money(week.cards.rangeRevenue));
    setText("#sales-total", money(week.cards.rangeRevenue));

    const chart = document.querySelector("#chart-columns");
    if (chart) {
      const values = week.series.map((point) => Number(point.revenue) || 0);
      const maximum = Math.max(1, ...values);
      chart.innerHTML = week.series.map((point, index) => {
        const height = Math.max(3, (Number(point.revenue) / maximum) * 100);
        return `<div class="chart-column"><span data-value="${money(point.revenue)}" style="--bar-index:${index};height:${height}%"></span></div>`;
      }).join("");
      const labels = document.querySelector(".chart-labels");
      if (labels) labels.innerHTML = week.series.map((point) => `<span>${escapeHTML(point.label)}</span>`).join("");
    }

    const recentContainer = document.querySelector("#recent-orders");
    if (recentContainer) {
      recentContainer.innerHTML = orders.orders.length ? orders.orders.slice(0, 4).map((order) => {
        const firstItem = order.items?.[0]?.product_name || "Coffee order";
        const quantity = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        const status = String(order.status || "").replace(/^./, (letter) => letter.toUpperCase());
        return `<article class="admin-recent-order"><span class="admin-order-icon">☕</span><span class="admin-order-copy"><strong>${escapeHTML(firstItem)}</strong><small>${escapeHTML(order.customer_name || "Walk-in guest")} · ${quantity} item(s)</small></span><span class="admin-order-price">${money(order.total)}</span><span class="admin-order-status ${status === "Pending" ? "new" : ""}">${escapeHTML(status)}</span></article>`;
      }).join("") : `<div class="admin-empty-row">No orders recorded this week.</div>`;
    }

    const stockContainer = document.querySelector("#stock-watch");
    if (stockContainer) {
      const ingredients = stock.ingredients.filter((ingredient) => ingredient.isLow);
      const visible = (ingredients.length ? ingredients : stock.ingredients).slice(0, 4);
      stockContainer.innerHTML = visible.length ? visible.map((ingredient) => {
        return `<article class="stock-watch-item"><span class="stock-watch-icon">☕</span><span class="stock-watch-copy"><strong>${escapeHTML(ingredient.name)}</strong><small>${ingredient.isLow ? "Restock soon" : "Healthy stock"}</small></span><span class="stock-level">${Number(ingredient.stock_qty)} ${escapeHTML(ingredient.unit)} left</span></article>`;
      }).join("") : `<div class="admin-empty-row">No inventory items yet.</div>`;
    }
  }

  function initializeInventory() {
    writeStorage(STORAGE.inventory, { ...defaultInventory, ...(readStorage(STORAGE.inventory, {}) || {}) });
    writeStorage(STORAGE.loyalty, loyaltyCustomers);
    writeStorage(STORAGE.cardInventory, loyaltyCardStock);
  }

  function refreshPersistedState() {
    sessionOrders = normalizeOrders(readStorage(STORAGE.orders, []));
    inventory = { ...defaultInventory, ...readStorage(STORAGE.inventory, {}) };
    productStatus = normalizeStatus(readStorage(STORAGE.productStatus, {}));
    loyaltyCustomers = normalizeCustomers(readStorage(STORAGE.loyalty, seedCustomers));
    loyaltyCardStock = readCardStock();
    reconcileLoyalty();
  }

  function bindDashboard() {
    document.querySelectorAll("[data-section]").forEach((button) => button.addEventListener("click", () => showSection(button.dataset.section)));
    document.querySelectorAll("[data-section-link]").forEach((button) => button.addEventListener("click", () => showSection(button.dataset.sectionLink)));
    document.querySelector("#admin-signout")?.addEventListener("click", async () => {
      try {
        const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
        if (!response.ok) throw new Error("Unable to sign out. Please try again.");
        window.location.replace("/index.html");
      } catch (error) {
        showToast(error.message);
      }
    });
    document.querySelector("#admin-mobile-toggle")?.addEventListener("click", () => setSidebar(true));
    document.querySelector("#admin-sidebar-close")?.addEventListener("click", () => setSidebar(false));
    document.querySelector("#admin-sidebar-backdrop")?.addEventListener("click", () => setSidebar(false));
    document.querySelector("#admin-bell")?.addEventListener("click", () => showToast("No new notifications"));
    document.querySelector("#dashboard-refresh")?.addEventListener("click", () => {
      loadDashboardSummary().then(() => showToast("Dashboard refreshed")).catch((error) => {
        console.error("Unable to refresh dashboard:", error);
        showToast(`Dashboard data could not be refreshed: ${error.message}`);
      });
    });
    document.querySelector("#product-search")?.addEventListener("input", renderProducts);
    document.querySelectorAll("[data-product-filter]").forEach((button) => button.addEventListener("click", () => {
      productFilter = button.dataset.productFilter;
      document.querySelectorAll("[data-product-filter]").forEach((item) => item.classList.toggle("active", item === button));
      renderProducts();
    }));
    bindManagementEvents();
    document.querySelector("#customer-search")?.addEventListener("input", renderLoyalty);
    document.querySelector("#loyalty-tier-filter")?.addEventListener("change", renderLoyalty);
    document.querySelector("#loyalty-body")?.addEventListener("click", (event) => {
      const deleteButton = event.target.closest("[data-delete-customer]");
      if (deleteButton) {
        deleteLoyaltyCustomer(deleteButton.dataset.deleteCustomer);
        return;
      }
      const button = event.target.closest("[data-view-customer]");
      if (!button) return;
      openCustomerModal(button.dataset.viewCustomer);
    });
    document.querySelector("#customer-modal-close")?.addEventListener("click", closeCustomerModal);
    document.querySelector("#customer-modal-close-action")?.addEventListener("click", closeCustomerModal);
    document.querySelector("#customer-modal-backdrop")?.addEventListener("click", closeCustomerModal);
    document.querySelector("#issue-loyalty-card")?.addEventListener("click", issueLoyaltyCard);
    document.querySelector("#restock-loyalty-cards")?.addEventListener("click", () => {
      loyaltyCardStock += 25;
      writeStorage(STORAGE.cardInventory, loyaltyCardStock);
      const issuedCustomers = reconcileLoyalty();
      renderLoyalty();
      showToast(issuedCustomers.length ? `SUCCESSFULL YOU COMPLETE — ${issuedCustomers.length} loyalty card${issuedCustomers.length === 1 ? "" : "s"} issued` : "25 loyalty cards added to stock");
    });
    document.querySelector("#export-customers")?.addEventListener("click", exportCustomers);
    document.querySelector("#order-search")?.addEventListener("input", renderOrders);
    document.querySelector("#order-status-filter")?.addEventListener("change", renderOrders);
    document.querySelector("#orders-body")?.addEventListener("change", (event) => {
      const select = event.target.closest("[data-order-status]");
      if (!select) return;
      const order = allOrders().find((item) => item.id === select.dataset.orderStatus);
      if (!order) return;
      const previousStatus = order.status;
      order.status = select.value;
      if (previousStatus !== "Cancelled" && order.status === "Cancelled") {
        restoreInventoryForOrder(order);
        order.inventoryReserved = false;
      } else if (previousStatus === "Cancelled" && order.status !== "Cancelled") {
        reserveInventoryForOrder(order);
        order.inventoryReserved = true;
      }
      const persisted = sessionOrders.find((item) => item.id === order.id);
      if (persisted) { persisted.status = order.status; persisted.inventoryReserved = order.inventoryReserved; writeStorage(STORAGE.orders, sessionOrders); }
      const issuedCustomers = reconcileLoyalty();
      renderDashboard();
      const loyaltyMessage = issuedCustomers.length ? ` · SUCCESSFULL YOU COMPLETE — ${issuedCustomers.length} loyalty card${issuedCustomers.length === 1 ? "" : "s"} issued` : "";
      showToast(order.status === "Cancelled" ? `${order.id} cancelled — inventory restored${loyaltyMessage}` : `${order.id} marked ${order.status.toLowerCase()}${loyaltyMessage}`);
    });
    document.querySelector("#orders-body")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-view-order]");
      if (!button) return;
      const order = allOrders().find((item) => item.id === button.dataset.viewOrder);
      if (order) showToast(`${order.id}: ${orderItems(order).map((item) => `${item.quantity} × ${item.name}`).join(", ")}`);
    });
    document.querySelector("#cancelled-orders-body")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-view-cancelled]");
      if (!button) return;
      const order = allOrders().find((item) => item.id === button.dataset.viewCancelled);
      if (order) showToast(`${order.id}: ${orderItems(order).map((item) => `${item.quantity} × ${item.name}`).join(", ")}`);
    });
    document.querySelector("#clear-cancelled-filter")?.addEventListener("click", () => {
      refreshPersistedState();
      renderDashboard();
      showToast("Cancelled orders refreshed");
    });
    document.querySelector("#export-orders")?.addEventListener("click", exportOrders);
    document.querySelector("#download-sales")?.addEventListener("click", exportOrders);
    window.addEventListener("hashchange", () => { const hash = window.location.hash.replace("#", ""); if (["dashboard", "products", "inventory", "staff", "loyalty", "orders", "cancelled", "sales"].includes(hash)) showSection(hash, false); });
    window.addEventListener("storage", (event) => { if ([STORAGE.orders, STORAGE.loyalty, STORAGE.cardInventory, STORAGE.inventory].includes(event.key)) { refreshPersistedState(); renderDashboard(); showToast(event.key === STORAGE.inventory ? "Product inventory updated" : event.key === STORAGE.cardInventory ? "Loyalty inventory updated" : "Loyalty and orders updated from the customer site"); } });
  }

  function bindManagementEvents() {
    document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));
    document.querySelector("#add-product")?.addEventListener("click", () => openProductDialog());
    document.querySelector("#product-form")?.addEventListener("submit", saveProductForm);
    document.querySelector("#admin-product-grid")?.addEventListener("click", handleProductAction);
    document.querySelector("#add-ingredient")?.addEventListener("click", () => openIngredientDialog());
    document.querySelector("#ingredient-form")?.addEventListener("submit", saveIngredientForm);
    document.querySelector("#inventory-body")?.addEventListener("click", handleInventoryAction);
    document.querySelector("#stock-form")?.addEventListener("submit", saveStockAdjustment);
    document.querySelector("#add-cashier")?.addEventListener("click", () => openCashierDialog());
    document.querySelector("#cashier-form")?.addEventListener("submit", saveCashierForm);
    document.querySelector("#cashier-search")?.addEventListener("input", renderCashiers);
    document.querySelector("#cashiers-body")?.addEventListener("click", handleCashierAction);
    document.querySelector("#copy-temporary-password")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(document.querySelector("#temporary-password-value")?.textContent || "");
        showToast("Temporary password copied");
      } catch (error) {
        showToast(`Could not copy the password: ${error.message}`);
      }
    });
  }

  async function apiRequest(url, options = {}) {
    const request = {
      method: options.method || "GET",
      credentials: "same-origin",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined
    };
    const response = await fetch(url, request);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || result.message || `Request failed (${response.status}).`);
    return result;
  }

  async function loadManagementData() {
    const [catalog, inventoryResult, users] = await Promise.all([
      apiRequest("/api/catalog"),
      apiRequest("/api/ingredients"),
      apiRequest("/api/users")
    ]);
    liveProducts = catalog.products || [];
    liveCategories = catalog.categories || [];
    liveIngredients = inventoryResult.ingredients || [];
    liveCashiers = users.users || [];
    populateProductCategories();
    renderProducts();
    renderInventory();
    renderCashiers();
    renderStockWatch();
    renderStats();
  }

  function populateProductCategories() {
    const select = document.querySelector("#product-category");
    if (!select) return;
    select.innerHTML = liveCategories.map((category) => `<option value="${category.id}">${escapeHTML(category.name)}</option>`).join("");
  }

  function openProductDialog(product = null) {
    const form = document.querySelector("#product-form");
    if (!form) return;
    form.reset();
    form.dataset.productId = product ? String(product.id) : "";
    populateProductCategories();
    form.elements.name.value = product?.name || "";
    form.elements.categoryId.value = product ? String(product.categoryId) : String(liveCategories[0]?.id || "");
    form.elements.price.value = product?.price ?? "";
    form.elements.emoji.value = product?.emoji || "☕";
    form.elements.image.value = product?.image || "";
    form.elements.description.value = product?.description || "";
    form.elements.hasSizes.checked = Boolean(product?.hasSizes);
    form.elements.isFeatured.checked = Boolean(product?.isFeatured);
    form.elements.isAvailable.checked = product ? Boolean(product.isAvailable) : true;
    setText("#product-dialog-title", product ? "Edit product" : "Add product");
    setText("#product-form-error", "");
    document.querySelector("#product-dialog")?.showModal();
  }

  async function saveProductForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const productId = form.dataset.productId;
    const existing = liveProducts.find((product) => String(product.id) === productId);
    const body = {
      name: form.elements.name.value.trim(),
      categoryId: Number(form.elements.categoryId.value),
      price: Number(form.elements.price.value),
      emoji: form.elements.emoji.value.trim(),
      image: form.elements.image.value.trim(),
      description: form.elements.description.value.trim(),
      hasSizes: form.elements.hasSizes.checked,
      isFeatured: form.elements.isFeatured.checked,
      isAvailable: form.elements.isAvailable.checked
    };
    if (existing) {
      body.sizes = existing.sizes.map((size) => ({ name: size.name, priceDelta: Number(size.priceDelta ?? size.price_delta ?? 0) }));
      body.addonIds = existing.addonIds || [];
    }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    setText("#product-form-error", "");
    try {
      await apiRequest(productId ? `/api/products/${encodeURIComponent(productId)}` : "/api/products", {
        method: productId ? "PATCH" : "POST",
        body
      });
      await loadManagementData();
      document.querySelector("#product-dialog")?.close();
      showToast(productId ? "Product updated" : "Product added to the menu");
    } catch (error) {
      setText("#product-form-error", error.message);
    } finally {
      submit.disabled = false;
    }
  }

  async function handleProductAction(event) {
    const button = event.target.closest("[data-product-edit], [data-product-toggle], [data-product-delete]");
    if (!button) return;
    const product = liveProducts.find((item) => String(item.id) === button.dataset.productEdit || String(item.id) === button.dataset.productToggle || String(item.id) === button.dataset.productDelete);
    if (!product) return;
    if (button.hasAttribute("data-product-edit")) {
      openProductDialog(product);
      return;
    }
    if (button.hasAttribute("data-product-delete")) {
      if (!window.confirm(`Delete “${product.name}” from the catalog?`)) return;
      try {
        await apiRequest(`/api/products/${encodeURIComponent(product.id)}`, { method: "DELETE" });
        await loadManagementData();
        showToast("Product deleted");
      } catch (error) {
        showToast(`Product could not be deleted: ${error.message}`);
      }
      return;
    }
    try {
      await apiRequest(`/api/products/${encodeURIComponent(product.id)}`, {
        method: "PATCH",
        body: {
          name: product.name, categoryId: product.categoryId, price: product.price,
          description: product.description || "", emoji: product.emoji || "☕", image: product.image || "",
          hasSizes: Boolean(product.hasSizes),
          sizes: product.sizes.map((size) => ({ name: size.name, priceDelta: Number(size.priceDelta ?? size.price_delta ?? 0) })),
          addonIds: product.addonIds || [],
          isFeatured: Boolean(product.isFeatured), isAvailable: !product.isAvailable
        }
      });
      await loadManagementData();
      showToast(product.isAvailable ? "Product marked unavailable" : "Product is available again");
    } catch (error) {
      showToast(`Product availability could not be changed: ${error.message}`);
    }
  }

  function openIngredientDialog(ingredient = null) {
    const form = document.querySelector("#ingredient-form");
    if (!form) return;
    form.reset();
    form.dataset.ingredientId = ingredient ? String(ingredient.id) : "";
    form.elements.name.value = ingredient?.name || "";
    form.elements.category.value = ingredient?.category || "Other Supplies";
    form.elements.unit.value = ingredient?.unit || "pcs";
    form.elements.stockQty.value = ingredient?.stock_qty ?? 0;
    form.elements.lowStockThreshold.value = ingredient?.low_stock_threshold ?? 0;
    form.elements.costPerUnit.value = ingredient?.cost_per_unit ?? 0;
    form.elements.expiryDate.value = ingredient?.expiry_date || "";
    const openingStock = document.querySelector("#ingredient-initial-stock-field");
    if (openingStock) openingStock.hidden = Boolean(ingredient);
    setText("#ingredient-dialog-title", ingredient ? "Edit ingredient" : "Add ingredient");
    setText("#ingredient-form-error", "");
    document.querySelector("#ingredient-dialog")?.showModal();
  }

  async function saveIngredientForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const ingredientId = form.dataset.ingredientId;
    const body = {
      name: form.elements.name.value.trim(),
      category: form.elements.category.value.trim(),
      unit: form.elements.unit.value.trim(),
      lowStockThreshold: Number(form.elements.lowStockThreshold.value),
      costPerUnit: Number(form.elements.costPerUnit.value),
      expiryDate: form.elements.expiryDate.value || null
    };
    if (!ingredientId) body.stockQty = Number(form.elements.stockQty.value);
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    setText("#ingredient-form-error", "");
    try {
      await apiRequest(ingredientId ? `/api/ingredients/${encodeURIComponent(ingredientId)}` : "/api/ingredients", {
        method: ingredientId ? "PATCH" : "POST", body
      });
      await loadManagementData();
      document.querySelector("#ingredient-dialog")?.close();
      showToast(ingredientId ? "Ingredient updated" : "Ingredient added");
    } catch (error) {
      setText("#ingredient-form-error", error.message);
    } finally {
      submit.disabled = false;
    }
  }

  function handleInventoryAction(event) {
    const button = event.target.closest("[data-stock-adjust], [data-ingredient-edit]");
    if (!button) return;
    const ingredient = liveIngredients.find((item) => String(item.id) === (button.dataset.stockAdjust || button.dataset.ingredientEdit));
    if (!ingredient) return;
    if (button.hasAttribute("data-ingredient-edit")) {
      openIngredientDialog(ingredient);
      return;
    }
    const form = document.querySelector("#stock-form");
    form.dataset.ingredientId = String(ingredient.id);
    form.reset();
    setText("#stock-dialog-title", `Adjust ${ingredient.name}`);
    setText("#stock-current", `Current stock: ${ingredient.stock_qty} ${ingredient.unit}`);
    setText("#stock-form-error", "");
    document.querySelector("#stock-dialog")?.showModal();
  }

  async function saveStockAdjustment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    setText("#stock-form-error", "");
    try {
      await apiRequest("/api/inventory/adjust", {
        method: "POST",
        body: {
          ingredientId: Number(form.dataset.ingredientId),
          type: form.elements.type.value,
          quantity: Number(form.elements.quantity.value),
          note: form.elements.note.value.trim()
        }
      });
      await loadManagementData();
      document.querySelector("#stock-dialog")?.close();
      showToast("Inventory movement recorded");
    } catch (error) {
      setText("#stock-form-error", error.message);
    } finally {
      submit.disabled = false;
    }
  }

  function openCashierDialog(cashier = null) {
    const form = document.querySelector("#cashier-form");
    if (!form) return;
    form.reset();
    form.dataset.cashierId = cashier ? String(cashier.id) : "";
    form.elements.fullName.value = cashier?.fullName || "";
    form.elements.username.value = cashier?.username || "";
    form.elements.email.value = cashier?.email || "";
    form.elements.contact.value = cashier?.contact || "";
    form.elements.isActive.value = cashier?.status === "inactive" ? "0" : "1";
    form.elements.password.required = !cashier;
    form.elements.confirmPassword.required = !cashier;
    form.elements.username.readOnly = false;
    const passwordField = document.querySelector("#cashier-password-field");
    const confirmField = document.querySelector("#cashier-confirm-field");
    const statusField = document.querySelector("#cashier-status-field");
    if (passwordField) passwordField.hidden = Boolean(cashier);
    if (confirmField) confirmField.hidden = Boolean(cashier);
    if (statusField) statusField.hidden = !cashier;
    setText("#cashier-dialog-title", cashier ? "Edit cashier account" : "Add cashier");
    setText("#cashier-form-error", "");
    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.textContent = cashier ? "Save changes" : "Create account";
    document.querySelector("#cashier-dialog")?.showModal();
  }

  async function saveCashierForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const cashierId = form.dataset.cashierId;
    const body = {
      fullName: form.elements.fullName.value.trim(),
      username: form.elements.username.value.trim(),
      email: form.elements.email.value.trim(),
      contact: form.elements.contact.value.trim()
    };
    if (cashierId) {
      body.status = form.elements.isActive.value === "1" ? "active" : "inactive";
    } else {
      body.password = form.elements.password.value;
      body.confirmPassword = form.elements.confirmPassword.value;
    }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    setText("#cashier-form-error", "");
    try {
      await apiRequest(cashierId ? `/api/users/${encodeURIComponent(cashierId)}` : "/api/users", {
        method: cashierId ? "PATCH" : "POST", body
      });
      await loadManagementData();
      document.querySelector("#cashier-dialog")?.close();
      showToast(cashierId ? "Cashier account updated" : "Cashier account created; share the temporary password securely");
    } catch (error) {
      setText("#cashier-form-error", error.message);
    } finally {
      submit.disabled = false;
    }
  }

  async function handleCashierAction(event) {
    const button = event.target.closest("[data-cashier-edit], [data-cashier-status], [data-cashier-reset]");
    if (!button) return;
    const cashier = liveCashiers.find((item) => String(item.id) === (button.dataset.cashierEdit || button.dataset.cashierStatus || button.dataset.cashierReset));
    if (!cashier) return;
    if (button.hasAttribute("data-cashier-edit")) {
      openCashierDialog(cashier);
      return;
    }
    if (button.hasAttribute("data-cashier-status")) {
      const status = cashier.status === "active" ? "inactive" : "active";
      if (!window.confirm(`${status === "inactive" ? "Deactivate" : "Activate"} ${cashier.fullName}'s account?`)) return;
      try {
        await apiRequest(`/api/users/${encodeURIComponent(cashier.id)}`, { method: "PATCH", body: { status } });
        await loadManagementData();
        showToast(`Cashier account ${status === "active" ? "activated" : "deactivated"}`);
      } catch (error) {
        showToast(`Account status could not be changed: ${error.message}`);
      }
      return;
    }
    if (!window.confirm(`Reset the password for ${cashier.fullName}? Their current sessions will be signed out.`)) return;
    try {
      const result = await apiRequest(`/api/users/${encodeURIComponent(cashier.id)}/reset-password`, { method: "POST", body: {} });
      if (!result.temporaryPassword) throw new Error("The server did not return a temporary password.");
      setText("#temporary-password-value", result.temporaryPassword);
      document.querySelector("#temporary-password-dialog")?.showModal();
      await loadManagementData();
    } catch (error) {
      showToast(`Password could not be reset: ${error.message}`);
    }
  }

  function renderDashboard() {
    renderStats();
    renderChart();
    renderRecentOrders();
    renderStockWatch();
    renderProducts();
    renderInventory();
    renderOrders();
    renderCancelledOrders();
    renderLoyalty();
    updateOrderCount();
  }

  function renderStats() {
    const completed = sessionOrders.filter((order) => order.status === "Completed");
    const sales = completed.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const low = liveIngredients.filter((ingredient) => ingredient.isLow).length;
    setText("#stat-low-stock", String(low));
    setText("#stat-today-orders", String(4 + sessionOrders.filter(isActiveOrder).length));
    setText("#stat-today-sales", money(395 + sales));
    setText("#stat-order-date", new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date()));
    setText("#sales-total", money(18420 + sales));
  }

  function renderChart() {
    const container = document.querySelector("#chart-columns");
    if (!container) return;
    const values = [54, 35, 68, 46, 77, 58, 91];
    container.innerHTML = values.map((value, index) => `<div class="chart-column"><span data-value="₱${(value * 20).toLocaleString()}" style="--bar-index:${index};height:${value}%"></span></div>`).join("");
  }

  function renderRecentOrders() {
    const container = document.querySelector("#recent-orders");
    if (!container) return;
    const recent = allOrders().filter(isActiveOrder).slice(0, 4);
    if (!recent.length) { container.innerHTML = `<div class="admin-empty-row">No active orders yet.</div>`; return; }
    container.innerHTML = recent.map((order) => {
      const first = orderItems(order)[0]?.name || "Coffee order";
      return `<article class="admin-recent-order"><span class="admin-order-icon">☕</span><span class="admin-order-copy"><strong>${escapeHTML(first)}</strong><small>${escapeHTML(order.customer || "Walk-in guest")} · ${orderItems(order).reduce((sum, item) => sum + Number(item.quantity || 0), 0)} item(s)</small></span><span class="admin-order-price">${money(order.total)}</span><span class="admin-order-status ${order.status === "New" ? "new" : ""}">${escapeHTML(order.status)}</span></article>`;
    }).join("");
  }

  function renderStockWatch() {
    const container = document.querySelector("#stock-watch");
    if (!container) return;
    const low = liveIngredients.filter((item) => item.isLow);
    const display = (low.length ? low : liveIngredients).slice(0, 4);
    container.innerHTML = display.length ? display.map((ingredient) => {
      const quantity = Number(ingredient.stock_qty || 0);
      return `<article class="stock-watch-item"><span class="stock-watch-icon">📦</span><span class="stock-watch-copy"><strong>${escapeHTML(ingredient.name)}</strong><small>${ingredient.isLow ? "Restock soon" : "Healthy stock"}</small></span><span class="stock-level">${quantity} ${escapeHTML(ingredient.unit)}</span></article>`;
    }).join("") : `<div class="admin-empty-row">No ingredients have been added yet.</div>`;
  }

  function renderProducts() {
    const container = document.querySelector("#admin-product-grid");
    if (!container) return;
    const query = String(document.querySelector("#product-search")?.value || "").trim().toLowerCase();
    const visible = liveProducts.filter((product) => {
      const isFood = /food|snack|pastr|bakery|dessert/i.test(product.category);
      const typeMatch = productFilter === "all" || (productFilter === "food" ? isFood : !isFood);
      const searchMatch = !query || `${product.name} ${product.category}`.toLowerCase().includes(query);
      return typeMatch && searchMatch;
    });
    container.innerHTML = visible.length ? visible.map((product) => {
      const available = Boolean(product.isAvailable);
      const art = product.image
        ? `<img src="${escapeHTML(product.image)}" alt="">`
        : `<span>${escapeHTML(product.emoji || "☕")}</span>`;
      return `<article class="admin-product-card"><span class="admin-product-thumb">${art}</span><span class="admin-product-copy"><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.category)}</small><span class="admin-product-price">${money(product.price)}</span><span class="admin-product-status ${available ? "" : "off"}">${available ? "Available" : "Unavailable"}</span></span><span class="admin-product-actions"><button class="admin-product-action" type="button" data-product-edit="${product.id}">Edit</button><button class="admin-product-action" type="button" data-product-toggle="${product.id}">${available ? "Disable" : "Enable"}</button><button class="admin-product-action danger" type="button" data-product-delete="${product.id}">Delete</button></span></article>`;
    }).join("") : `<div class="admin-empty-row">No products match your search.</div>`;
  }

  function renderInventory() {
    const body = document.querySelector("#inventory-body");
    if (!body) return;
    const lowItems = liveIngredients.filter((ingredient) => ingredient.isLow);
    body.innerHTML = liveIngredients.length ? liveIngredients.map((ingredient) => {
      const quantity = Number(ingredient.stock_qty || 0);
      const low = Boolean(ingredient.isLow);
      return `<tr><td><div class="admin-product-cell"><span class="admin-product-cell-art">📦</span><span><strong>${escapeHTML(ingredient.name)}</strong><small>${escapeHTML(ingredient.supplier_name || "No supplier")}</small></span></div></td><td>${escapeHTML(ingredient.category || "Other Supplies")}</td><td><span class="admin-price-cell">${quantity} ${escapeHTML(ingredient.unit)}</span></td><td>${Number(ingredient.low_stock_threshold || 0)} ${escapeHTML(ingredient.unit)}</td><td><span class="admin-stock-status ${low ? "low" : ""}">${quantity <= 0 ? "Out of stock" : low ? "Restock soon" : "In stock"}</span></td><td><button class="admin-table-action" type="button" data-stock-adjust="${ingredient.id}">Adjust stock</button><button class="admin-table-action" type="button" data-ingredient-edit="${ingredient.id}">Edit</button></td></tr>`;
    }).join("") : `<tr><td class="admin-empty-row" colspan="6">No ingredients in inventory yet. Add one to get started.</td></tr>`;
    const total = liveIngredients.reduce((sum, ingredient) => sum + Number(ingredient.stock_qty || 0), 0);
    setText("#inventory-total", String(total));
    setText("#inventory-low", String(lowItems.length));
    setText("#inventory-healthy", String(liveIngredients.length - lowItems.length));
  }

  function renderCashiers() {
    const body = document.querySelector("#cashiers-body");
    if (!body) return;
    const query = String(document.querySelector("#cashier-search")?.value || "").trim().toLowerCase();
    const visible = liveCashiers.filter((cashier) => `${cashier.fullName} ${cashier.username} ${cashier.email}`.toLowerCase().includes(query));
    body.innerHTML = visible.length ? visible.map((cashier) => {
      const status = cashier.status === "active";
      const updated = cashier.updatedAt ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(cashier.updatedAt)) : "—";
      return `<tr><td><span class="admin-customer"><strong>${escapeHTML(cashier.fullName)}</strong><small>${escapeHTML(cashier.contact || "Cashier")}</small></span></td><td>${escapeHTML(cashier.username)}</td><td>${escapeHTML(cashier.email)}</td><td><span class="admin-stock-status ${status ? "" : "low"}">${status ? "Active" : "Inactive"}</span></td><td>${updated}</td><td><button class="admin-table-action" type="button" data-cashier-edit="${cashier.id}">Edit</button><button class="admin-table-action" type="button" data-cashier-reset="${cashier.id}">Reset password</button><button class="admin-table-action" type="button" data-cashier-status="${cashier.id}">${status ? "Deactivate" : "Activate"}</button></td></tr>`;
    }).join("") : `<tr><td class="admin-empty-row" colspan="6">${query ? "No cashier accounts match your search." : "No cashier accounts yet. Add an account to give your team access."}</td></tr>`;
    setText("#cashiers-footer", `Showing ${visible.length} of ${liveCashiers.length} cashier account${liveCashiers.length === 1 ? "" : "s"}`);
  }

  function renderOrders() {
    const body = document.querySelector("#orders-body");
    if (!body) return;
    const query = String(document.querySelector("#order-search")?.value || "").trim().toLowerCase();
    const status = document.querySelector("#order-status-filter")?.value || "active";
    const filtered = allOrders().filter((order) => {
      const searchMatch = !query || `${order.id} ${order.customer} ${orderItems(order).map((item) => item.name).join(" ")}`.toLowerCase().includes(query);
      const statusMatch = status === "all" || (status === "active" ? isActiveOrder(order) : order.status === status);
      return searchMatch && statusMatch;
    });
    if (!filtered.length) {
      body.innerHTML = `<tr><td class="admin-empty-row" colspan="7">${status === "active" ? "No active orders match those filters." : "No orders match those filters."}</td></tr>`;
    } else {
      body.innerHTML = filtered.map((order) => {
        const count = orderItems(order).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        return `<tr><td><span class="admin-order-id">${escapeHTML(order.id)}</span></td><td><span class="admin-customer"><strong>${escapeHTML(order.customer || "Walk-in guest")}</strong><small>${escapeHTML(order.customer ? "Customer" : "In-store")}</small></span></td><td class="admin-order-items">${count} item${count === 1 ? "" : "s"}</td><td>${formatTime(order.createdAt)}</td><td><span class="admin-price-cell">${money(order.total)}</span></td><td><select class="admin-status-select" data-order-status="${escapeHTML(order.id)}" aria-label="Update ${escapeHTML(order.id)}">${["New", "Preparing", "Completed", "Cancelled"].map((value) => `<option ${value === order.status ? "selected" : ""}>${value}</option>`).join("")}</select></td><td><button class="admin-view-order" type="button" data-view-order="${escapeHTML(order.id)}" aria-label="View ${escapeHTML(order.id)}">↗</button></td></tr>`;
      }).join("");
    }
    const activeCount = allOrders().filter(isActiveOrder).length;
    setText("#orders-footer", status === "active" ? `Showing ${filtered.length} of ${activeCount} active orders` : `Showing ${filtered.length} of ${allOrders().length} orders`);
  }

  function renderCancelledOrders() {
    const body = document.querySelector("#cancelled-orders-body");
    if (!body) return;
    const cancelled = allOrders().filter((order) => order.status === "Cancelled");
    body.innerHTML = cancelled.length ? cancelled.map((order) => {
      const count = orderItems(order).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      return `<tr><td><span class="admin-order-id">${escapeHTML(order.id)}</span></td><td><span class="admin-customer"><strong>${escapeHTML(order.customer || "Walk-in guest")}</strong><small>${escapeHTML(order.customer ? "Customer" : "In-store")}</small></span></td><td class="admin-order-items">${count} item${count === 1 ? "" : "s"}</td><td>${formatTime(order.createdAt)}</td><td><span class="admin-price-cell">+${money(order.total)} returned</span></td><td><button class="admin-view-order" type="button" data-view-cancelled="${escapeHTML(order.id)}" aria-label="View cancelled ${escapeHTML(order.id)}">↗</button></td></tr>`;
    }).join("") : `<tr><td class="admin-empty-row" colspan="6">No cancelled orders yet.</td></tr>`;
    setText("#cancelled-count-large", String(cancelled.length));
    setText("#cancelled-footer", `Showing ${cancelled.length} cancelled order${cancelled.length === 1 ? "" : "s"}`);
  }

  function openCustomerModal(customerId) {
    const customer = loyaltyCustomers.find((entry) => entry.id === customerId);
    const modal = document.querySelector("#customer-modal");
    const backdrop = document.querySelector("#customer-modal-backdrop");
    if (!customer || !modal) return;
    setText("#customer-modal-title", customer.name);
    setText("#customer-modal-email", customer.email);
    setText("#customer-modal-card", customer.id);
    setText("#customer-modal-points", Number(customer.points || 0).toLocaleString());
    setText("#customer-modal-tier", customer.tier);
    setText("#customer-modal-orders", String(customer.orders || 0));
    const activeCard = customer.cardStatus === "Active";
    const cardStatusMessage = activeCard
      ? ""
      : customer.cardStatus === "Qualified"
        ? "Qualified · waiting for card stock"
        : `Card pending · ${Math.min(LOYALTY_THRESHOLD, Number(customer.orders || 0))}/${LOYALTY_THRESHOLD} orders`;
    setText("#customer-modal-card-status", cardStatusMessage);
    const requestedStyle = String(customer.cardStyle || "classic").toLowerCase();
    const cardStyle = ["gold", "platinum", "midnight"].includes(requestedStyle) ? requestedStyle : "classic";
    setText("#customer-modal-card-style", `Card design · ${cardStyle === "classic" ? "Member" : cardStyle.charAt(0).toUpperCase() + cardStyle.slice(1)}`);
    const payload = encodeURIComponent(JSON.stringify({ type: "trippers-circle", cardId: customer.id, email: customer.email }));
    const image = document.querySelector("#customer-qr-image");
    const fallback = document.querySelector("#customer-qr-fallback");
    const scanLabel = document.querySelector(".customer-modal-qr > span");
    if (activeCard) {
      if (scanLabel) scanLabel.hidden = false;
      if (image) {
        image.style.display = "block";
        image.onload = () => fallback?.classList.remove("is-visible");
        image.onerror = () => { image.style.display = "none"; if (fallback) { fallback.innerHTML = '<div class="qr-unavailable"><strong>QR unavailable</strong><small>Use the card ID at the counter.</small></div>'; fallback.classList.add("is-visible"); } };
        image.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${payload}`;
      }
      if (fallback) fallback.classList.remove("is-visible");
    } else {
      if (scanLabel) scanLabel.hidden = true;
      if (image) image.style.display = "none";
      if (fallback) { fallback.innerHTML = ""; fallback.classList.remove("is-visible"); }
    }
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    backdrop?.removeAttribute("hidden");
    window.requestAnimationFrame(() => backdrop?.classList.add("is-visible"));
    document.body.classList.add("no-scroll");
  }

  function closeCustomerModal() {
    const modal = document.querySelector("#customer-modal");
    const backdrop = document.querySelector("#customer-modal-backdrop");
    modal?.classList.remove("is-open");
    modal?.setAttribute("aria-hidden", "true");
    backdrop?.classList.remove("is-visible");
    window.setTimeout(() => backdrop?.setAttribute("hidden", ""), 260);
    document.body.classList.remove("no-scroll");
  }

  function renderQrFallback(seed) {
    const fallback = document.querySelector("#customer-qr-fallback");
    if (!fallback) return;
    let hash = 2166136261;
    for (const character of String(seed)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    const finder = (x, y, originX, originY) => originX <= x && x < originX + 7 && originY <= y && y < originY + 7 && (x === originX || x === originX + 6 || y === originY || y === originY + 6 || (x >= originX + 2 && x <= originX + 4 && y >= originY + 2 && y <= originY + 4));
    fallback.innerHTML = "";
    for (let y = 0; y < 21; y += 1) {
      for (let x = 0; x < 21; x += 1) {
        const cell = document.createElement("i");
        const finderCell = finder(x, y, 0, 0) || finder(x, y, 14, 0) || finder(x, y, 0, 14);
        hash ^= hash << 13; hash ^= hash >>> 17; hash ^= hash << 5;
        if (finderCell || ((hash >>> 0) % 100) > 48) cell.classList.add("on");
        fallback.appendChild(cell);
      }
    }
  }

  function reconcileLoyalty() {
    discoverLoyaltyCustomers();
    const previousCustomers = loyaltyCustomers;
    const previousStock = loyaltyCardStock;
    const before = JSON.stringify({ customers: loyaltyCustomers, stock: loyaltyCardStock });
    const issued = [];
    loyaltyCustomers = loyaltyCustomers.map((customer) => {
      const linkedOrders = ordersForCustomer(customer);
      const qualifying = linkedOrders.filter((order) => order.status !== "Cancelled");
      const next = { ...customer, qualifyingOrderIds: Array.isArray(customer.qualifyingOrderIds) ? [...customer.qualifyingOrderIds] : [] };
      const orderCount = syncCustomerOrderCount(next, linkedOrders);
      const latestVisit = qualifying[0]?.createdAt;
      if (latestVisit) next.lastVisit = latestVisit;
      if (orderCount < LOYALTY_THRESHOLD && next.cardStatus !== "Active") next.cardStatus = "Pending";
      if (orderCount >= LOYALTY_THRESHOLD && next.cardStatus !== "Active") {
        if (loyaltyCardStock > 0) {
          loyaltyCardStock -= 1;
          next.cardStatus = "Active";
          next.cardIssuedAt = new Date().toISOString();
          issued.push(next.id);
        } else {
          next.cardStatus = "Qualified";
        }
      }
      return next;
    });
    const after = JSON.stringify({ customers: loyaltyCustomers, stock: loyaltyCardStock });
    if (before !== after) {
      const loyaltySaved = writeStorage(STORAGE.loyalty, loyaltyCustomers);
      const stockSaved = writeStorage(STORAGE.cardInventory, loyaltyCardStock);
      if (!loyaltySaved || !stockSaved) {
        writeStorage(STORAGE.loyalty, previousCustomers);
        writeStorage(STORAGE.cardInventory, previousStock);
        loyaltyCustomers = previousCustomers;
        loyaltyCardStock = previousStock;
        return [];
      }
    }
    return issued;
  }

  function discoverLoyaltyCustomers() {
    const additions = [];
    sessionOrders.forEach((order) => {
      if (order.status === "Cancelled" || order.loyaltyPending || !orderItems(order).length) return;
      const email = normalizeEmail(order.customerEmail || order.email);
      const customerId = String(order.customerId || "").trim();
      if (!email && !customerId) return;
      const known = [...loyaltyCustomers, ...additions].some((customer) => (customerId && String(customer.id) === customerId) || (email && normalizeEmail(customer.email) === email));
      if (known) return;
      additions.push({ id: customerId || createLoyaltyId([...loyaltyCustomers, ...additions]), name: order.customer || "Trippers member", email, points: 0, tier: "Member", orders: 0, qualifyingOrderIds: [], lastVisit: order.createdAt || new Date().toISOString(), joinedAt: order.createdAt || new Date().toISOString(), cardStatus: "Pending", cardIssuedAt: null });
    });
    if (additions.length) loyaltyCustomers = [...additions, ...loyaltyCustomers];
  }

  function syncCustomerOrderCount(customer, orders) {
    const previousCount = Math.max(0, Number(customer.orders) || 0);
    const knownIds = new Set(Array.isArray(customer.qualifyingOrderIds) ? customer.qualifyingOrderIds.map(String) : []);
    let added = 0;
    let removed = 0;
    (Array.isArray(orders) ? orders : []).forEach((order) => {
      if (!order || !orderItems(order).length) return;
      const orderKey = String(order.id || `#legacy-${order.createdAt || ""}-${order.total || 0}`);
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

  function ordersForCustomer(customer) {
    const seen = new Set();
    return sessionOrders.filter((order) => {
      if (!order || order.loyaltyPending || !orderItems(order).length) return false;
      const orderKey = String(order.id || `#legacy-${order.createdAt || ""}-${order.total || 0}`);
      if (seen.has(orderKey)) return false;
      const matchesId = order.customerId && String(order.customerId) === String(customer.id);
      const orderEmail = order.customerEmail || order.email;
      const matchesEmail = orderEmail && normalizeEmail(orderEmail) === normalizeEmail(customer.email);
      if (!matchesId && !matchesEmail) return false;
      seen.add(orderKey);
      return true;
    });
  }

  function normalizeEmail(value) { return String(value || "").trim().toLowerCase(); }

  function renderLoyalty() {
    const body = document.querySelector("#loyalty-body");
    if (!body) return;
    const query = String(document.querySelector("#customer-search")?.value || "").trim().toLowerCase();
    const tier = document.querySelector("#loyalty-tier-filter")?.value || "all";
    const filtered = loyaltyCustomers.filter((customer) => {
      const searchMatch = !query || `${customer.name} ${customer.email} ${customer.id}`.toLowerCase().includes(query);
      const tierMatch = tier === "all" || customer.tier === tier;
      return searchMatch && tierMatch;
    });
    body.innerHTML = filtered.length ? filtered.map((customer) => {
      const status = ["Active", "Qualified", "Pending"].includes(customer.cardStatus) ? customer.cardStatus : "Pending";
      const progress = Math.min(LOYALTY_THRESHOLD, Number(customer.orders || 0));
      const statusLabel = status === "Active" ? "Active" : status === "Qualified" ? "Ready to issue" : `${progress}/${LOYALTY_THRESHOLD} orders`;
      const qrAction = status === "Active"
        ? `<button class="qr-table-button" type="button" data-view-customer="${escapeHTML(customer.id)}">View QR</button>`
        : `<span class="loyalty-awaiting">${escapeHTML(statusLabel)}</span>`;
      return `<tr><td><div class="loyalty-customer"><span class="loyalty-customer-avatar">${escapeHTML(initials(customer.name))}</span><span><strong>${escapeHTML(customer.name)}</strong><small>${escapeHTML(customer.email || "Name-only member")}</small></span></div></td><td><span class="admin-order-id">${escapeHTML(customer.id)}</span></td><td><span class="loyalty-points">${Number(customer.points || 0).toLocaleString()} pts</span></td><td><span class="loyalty-tier ${escapeHTML(customer.tier.toLowerCase())}">${escapeHTML(customer.tier)}</span></td><td>${Number(customer.orders || 0)}</td><td><span class="loyalty-status ${status.toLowerCase()}">${escapeHTML(statusLabel)}</span></td><td>${formatTime(customer.lastVisit)}</td><td>${qrAction}</td><td><button class="admin-view-order" type="button" data-view-customer="${escapeHTML(customer.id)}" aria-label="View ${escapeHTML(customer.name)}">↗</button><button class="admin-delete-customer" type="button" data-delete-customer="${escapeHTML(customer.id)}" aria-label="Delete ${escapeHTML(customer.name)}">🗑</button></td></tr>`;
    }).join("") : `<tr><td class="admin-empty-row" colspan="9">No loyalty members match those filters.</td></tr>`;
    const points = loyaltyCustomers.reduce((sum, customer) => sum + Number(customer.points || 0), 0);
    const rewards = loyaltyCustomers.filter((customer) => Number(customer.points || 0) >= 1000).length;
    const qualified = loyaltyCustomers.filter((customer) => customer.cardStatus === "Qualified").length;
    setText("#loyalty-members", String(loyaltyCustomers.length));
    setText("#loyalty-cards-available", String(loyaltyCardStock));
    setText("#loyalty-points", points.toLocaleString());
    setText("#loyalty-rewards", String(rewards));
    setText("#loyalty-qualified", String(qualified));
    setText("#card-stock-count", String(loyaltyCardStock));
    setText("#member-count-label", `${loyaltyCustomers.length} member${loyaltyCustomers.length === 1 ? "" : "s"}`);
    setText("#loyalty-footer", `Showing ${filtered.length} of ${loyaltyCustomers.length} members`);
    const stockBar = document.querySelector("#card-stock-bar-fill");
    if (stockBar) stockBar.style.width = `${Math.min(100, loyaltyCardStock)}%`;
    const loyaltyBadge = document.querySelector("#admin-loyalty-count");
    if (loyaltyBadge) { loyaltyBadge.textContent = loyaltyCustomers.length; loyaltyBadge.dataset.count = loyaltyCustomers.length; }
  }

  function deleteLoyaltyCustomer(customerId) {
    const customer = loyaltyCustomers.find((entry) => entry.id === customerId);
    if (!customer) return;
    const cardNote = customer.cardStatus === "Active" ? " Their issued card will not be returned to card stock." : "";
    if (!window.confirm(`Delete ${customer.name} from Trippers Circle?${cardNote}`)) return;
    loyaltyCustomers = loyaltyCustomers.filter((entry) => entry.id !== customer.id);
    writeStorage(STORAGE.loyalty, loyaltyCustomers);
    const activeCustomer = readStorage(STORAGE.activeCustomer, null);
    if (activeCustomer && String(activeCustomer.id) === String(customer.id)) writeStorage(STORAGE.activeCustomer, null);
    renderLoyalty();
    showToast(`${customer.name} was removed from Trippers Circle`);
  }

  function issueLoyaltyCard() {
    if (loyaltyCardStock <= 0) {
      showToast("No loyalty cards left — add card stock first");
      return;
    }
    const name = window.prompt("Customer name for the new Trippers Circle card:", "New Trippers member");
    if (!name?.trim()) return;
    const email = normalizeEmail(window.prompt("Customer email:", `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".")}@email.com`));
    if (!email) return;
    let customer = loyaltyCustomers.find((entry) => normalizeEmail(entry.email) === email);
    const createdCustomer = !customer;
    if (customer?.cardStatus === "Active") {
      showToast(`${customer.name}'s loyalty card is already active`);
      return;
    }
    if (!customer) {
      const matchingOrders = sessionOrders.filter((order) => normalizeEmail(order.customerEmail || order.email) === email && order.status !== "Cancelled" && orderItems(order).length);
      const matchingOrderCount = new Set(matchingOrders.map((order) => String(order.id || `#legacy-${order.createdAt || ""}-${order.total || 0}`))).size;
      customer = { id: createLoyaltyId(loyaltyCustomers), name: name.trim(), email, points: 0, tier: "Member", orders: matchingOrderCount, qualifyingOrderIds: matchingOrders.map((order) => String(order.id || `#legacy-${order.createdAt || ""}-${order.total || 0}`)), lastVisit: matchingOrders[0]?.createdAt || new Date().toISOString(), joinedAt: new Date().toISOString(), cardStatus: matchingOrderCount >= LOYALTY_THRESHOLD ? "Qualified" : "Pending", cardIssuedAt: null };
      loyaltyCustomers = [customer, ...loyaltyCustomers];
    } else {
      customer.name = name.trim() || customer.name;
      const syncedCustomer = { ...customer, qualifyingOrderIds: Array.isArray(customer.qualifyingOrderIds) ? [...customer.qualifyingOrderIds] : [] };
      syncCustomerOrderCount(syncedCustomer, ordersForCustomer(customer));
      customer.orders = syncedCustomer.orders;
      customer.qualifyingOrderIds = syncedCustomer.qualifyingOrderIds;
    }
    if (Number(customer.orders || 0) < LOYALTY_THRESHOLD) {
      writeStorage(STORAGE.loyalty, loyaltyCustomers);
      renderLoyalty();
      showToast(`${customer.name} needs ${LOYALTY_THRESHOLD - Number(customer.orders || 0)} more qualifying orders before a card is issued`);
      return;
    }
    const previousStock = loyaltyCardStock;
    const previousStatus = customer.cardStatus;
    const previousIssuedAt = customer.cardIssuedAt;
    customer.cardStatus = "Active";
    customer.cardIssuedAt = new Date().toISOString();
    loyaltyCardStock -= 1;
    const loyaltySaved = writeStorage(STORAGE.loyalty, loyaltyCustomers);
    const stockSaved = writeStorage(STORAGE.cardInventory, loyaltyCardStock);
    if (!loyaltySaved || !stockSaved) {
      customer.cardStatus = previousStatus;
      customer.cardIssuedAt = previousIssuedAt;
      loyaltyCardStock = previousStock;
      if (createdCustomer) loyaltyCustomers = loyaltyCustomers.filter((entry) => entry.id !== customer.id);
      writeStorage(STORAGE.loyalty, loyaltyCustomers);
      writeStorage(STORAGE.cardInventory, loyaltyCardStock);
      showToast("Could not issue the loyalty card. Please try again.");
      return;
    }
    renderLoyalty();
    showToast(`SUCCESSFULL YOU COMPLETE — ${customer.name}'s loyalty card is ready`);
  }

  function createLoyaltyId(customers) {
    const usedIds = new Set(customers.map((customer) => String(customer?.id || "")));
    let id;
    do { id = `TC-${String(Date.now()).slice(-5)}${Math.floor(Math.random() * 90 + 10)}`; } while (usedIds.has(id));
    return id;
  }

  function exportCustomers() {
    const rows = [["Customer", "Email", "Card ID", "Tier", "Points", "Orders", "Card status", "Last visit"]];
    loyaltyCustomers.forEach((customer) => rows.push([customer.name, customer.email, customer.id, customer.tier, customer.points, customer.orders, customer.cardStatus, customer.lastVisit]));
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "trippers-loyalty-customers.csv"; link.click(); URL.revokeObjectURL(url);
    showToast("Customer report downloaded");
  }

  function updateOrderCount() {
    setText("#sidebar-order-count", String(4 + sessionOrders.filter(isActiveOrder).length));
    const cancelledCount = allOrders().filter((order) => order.status === "Cancelled").length;
    setText("#sidebar-cancelled-count", String(cancelledCount));
    const badge = document.querySelector("#sidebar-cancelled-count");
    if (badge) badge.dataset.count = cancelledCount;
  }

  function showSection(section, updateHash = true) {
    const valid = ["dashboard", "products", "inventory", "staff", "loyalty", "orders", "cancelled", "sales"];
    if (!valid.includes(section)) section = "dashboard";
    document.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === section));
    document.querySelectorAll("[data-section]").forEach((button) => button.classList.toggle("active", button.dataset.section === section));
    if (updateHash) history.replaceState(null, "", `#${section}`);
    setSidebar(false);
  }

  function setSidebar(open) {
    document.querySelector("#admin-sidebar")?.classList.toggle("is-open", open);
    const backdrop = document.querySelector("#admin-sidebar-backdrop");
    if (backdrop) backdrop.hidden = !open;
    document.body.classList.toggle("no-scroll", open);
  }

  function exportOrders() {
    const rows = [["Order", "Customer", "Items", "Status", "Total", "Date"]];
    allOrders().forEach((order) => rows.push([order.id, order.customer, orderItems(order).map((item) => `${item.quantity} × ${item.name}`).join("; "), order.status, order.total, order.createdAt]));
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "trippers-orders-report.csv"; link.click(); URL.revokeObjectURL(url);
    showToast("Report downloaded");
  }

  function isActiveOrder(order) { return !terminalOrderStatuses.has(order?.status); }

  function inventoryIdForItem(item) {
    if (item?.id) return item.id;
    return nameMap.get(item?.name)?.id || null;
  }

  function reserveInventoryForOrder(order) {
    orderItems(order).forEach((item) => {
      const id = inventoryIdForItem(item);
      if (!id) return;
      const quantity = Math.max(0, Number(item.quantity) || 0);
      inventory[id] = Math.max(0, Number(inventory[id] ?? defaultInventory[id] ?? 0) - quantity);
    });
    writeStorage(STORAGE.inventory, inventory);
  }

  function restoreInventoryForOrder(order) {
    orderItems(order).forEach((item) => {
      const id = inventoryIdForItem(item);
      if (!id) return;
      const quantity = Math.max(0, Number(item.quantity) || 0);
      inventory[id] = Number(inventory[id] ?? defaultInventory[id] ?? 0) + quantity;
    });
    writeStorage(STORAGE.inventory, inventory);
  }

  function allOrders() { return [...sessionOrders, ...seedOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); }
  function orderItems(order) { return Array.isArray(order?.items) ? order.items.filter((item) => item && typeof item === "object") : []; }
  function normalizeOrders(value) {
    if (!Array.isArray(value)) return [];
    const usedIds = new Set();
    return value.filter((order) => order && typeof order === "object").map((order, index) => {
      const baseId = String(order.id || "");
      const fallbackId = `#legacy-${order.createdAt || "unknown"}-${order.total || 0}`;
      let id = baseId && baseId !== "#0000" ? baseId : fallbackId;
      let suffix = 1;
      while (usedIds.has(id)) id = `${fallbackId}-${suffix++}`;
      usedIds.add(id);
      return { ...order, id, customer: String(order.customer || "Walk-in guest"), items: Array.isArray(order.items) ? order.items : [], total: Number(order.total) || 0, status: String(order.status || "New"), createdAt: order.createdAt || new Date().toISOString() };
    });
  }
  function normalizeCustomers(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((customer) => customer && typeof customer === "object").map((customer) => {
      const orders = Number(customer.orders) || 0;
      const requestedStatus = String(customer.cardStatus || "").trim().toLowerCase();
      const cardStatus = requestedStatus === "active" ? "Active" : requestedStatus === "qualified" ? "Qualified" : requestedStatus === "pending" ? "Pending" : orders >= LOYALTY_THRESHOLD ? "Qualified" : "Pending";
      return { ...customer, id: String(customer.id || `TC-${String(Date.now()).slice(-5)}`), name: String(customer.name || "Trippers member"), email: normalizeEmail(customer.email), points: Number(customer.points) || 0, tier: String(customer.tier || "Member"), orders, qualifyingOrderIds: Array.isArray(customer.qualifyingOrderIds) ? customer.qualifyingOrderIds.map(String) : [], lastVisit: customer.lastVisit || new Date().toISOString(), cardStatus, cardIssuedAt: customer.cardIssuedAt || (cardStatus === "Active" ? customer.lastVisit || new Date().toISOString() : null), joinedAt: customer.joinedAt || customer.lastVisit || new Date().toISOString() };
    });
  }
  function initials(name) { return String(name || "TM").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
  function normalizeStatus(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
  function setDate() { setText("#admin-date", new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()).toUpperCase()); }
  function formatTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Just now" : new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date); }
  function setText(selector, value) { const element = document.querySelector(selector); if (element) element.textContent = value; }
  function readCardStock() { const value = Number(readStorage(STORAGE.cardInventory, DEFAULT_CARD_STOCK)); return Number.isFinite(value) && value >= 0 ? value : DEFAULT_CARD_STOCK; }
  function readStorage(key, fallback) { try { const value = window.localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } }
  function writeStorage(key, value) { try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
  function escapeHTML(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }
  function showToast(message) { const toast = document.querySelector("#admin-toast"); const text = document.querySelector("#admin-toast-message"); if (!toast || !text) return; text.textContent = message; toast.classList.add("is-visible"); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3000); }
})();
