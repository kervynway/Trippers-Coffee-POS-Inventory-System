(() => {
  "use strict";

  const STORAGE = { cart: "trippersCart", orders: "trippersOrders", inventory: "trippersAdminInventory", loyalty: "trippersLoyaltyCustomers", cardInventory: "trippersLoyaltyCardInventory", activeCustomer: "trippersActiveLoyaltyCustomer", loyaltyEmail: "trippersLoyaltyEmail", customerName: "trippersCustomerName", cardStyle: "trippersLoyaltyCardStyle" };
  const LOYALTY_THRESHOLD = 5;
  const DEFAULT_CARD_STOCK = 84;
  const DEFAULT_CARD_STYLE = "classic";
  const CARD_STYLE_NAMES = { classic: "Member", gold: "Gold", platinum: "Platinum", midnight: "Midnight" };
  const CARD_TIER_LABELS = { classic: "MEMBER CARD", gold: "GOLD MEMBER", platinum: "PLATINUM MEMBER", midnight: "MEMBER CARD" };
  const image = (id, width = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=84`;
  const products = [
    { id: "iced-caramel-latte", name: "Iced Caramel Latte", category: "Iced Coffee", price: 145, description: "Smooth espresso over ice with sweet caramel drizzle and frothy milk.", image: image("photo-1461023058943-07fcbe16d735"), emoji: "🥤", badge: "Best Seller", featured: true },
    { id: "spanish-latte", name: "Spanish Latte", category: "Iced Coffee", price: 150, description: "Rich espresso blended with sweetened condensed milk over ice.", image: image("photo-1509042239860-f550ce710b93"), emoji: "☕", badge: "Best Seller", featured: true },
    { id: "americano", name: "Americano", category: "Hot Coffee", price: 120, description: "Bold espresso shots diluted with hot water for a clean, strong cup.", image: image("photo-1495474472287-4d71bcdd2085"), emoji: "☕", badge: "", featured: true },
    { id: "java-chip-frappe", name: "Java Chip Frappe", category: "Frappe", price: 175, description: "Blended coffee with real chocolate chips, topped with whipped cream.", image: image("photo-1572442388796-11668a67e53d"), emoji: "🥤", badge: "Best Seller", featured: true },
    { id: "matcha-latte", name: "Matcha Latte", category: "Non-Coffee", price: 160, description: "Premium ceremonial-grade matcha whisked with silky steamed oat milk.", image: image("photo-1515823064-d6e0c04616a7"), emoji: "🍵", badge: "Best Seller", featured: true },
    { id: "iced-green-tea", name: "Iced Green Tea", category: "Tea", price: 125, description: "Light, citrusy green tea brewed fresh and served over ice.", image: image("photo-1556679343-c7306c1976bc"), emoji: "🍵", badge: "", featured: false },
    { id: "butter-croissant", name: "Butter Croissant", category: "Pastries", price: 85, description: "Flaky, golden layers made with real butter and baked fresh daily.", image: image("photo-1555507036-ab1f4038808a"), emoji: "🥐", badge: "Baked Today", featured: true },
    { id: "blueberry-muffin", name: "Blueberry Muffin", category: "Pastries", price: 70, description: "A bakery classic with a tender crumb and bright berries.", image: image("photo-1587314168485-3236d6710814"), emoji: "🧁", badge: "", featured: false },
    { id: "chocolate-croissant", name: "Chocolate Croissant", category: "Pastries", price: 95, description: "Buttery pastry filled with dark chocolate and baked until crisp.", image: image("photo-1623334044303-241021148842"), emoji: "🥐", badge: "", featured: false },
    { id: "granola-bar", name: "Honey Granola Bar", category: "Snacks", price: 65, description: "A chewy oat bar with honey, seeds, and just enough crunch.", image: image("photo-1558961363-fa8fdf82db35"), emoji: "🍫", badge: "", featured: false }
  ];
  const productMap = new Map(products.map((product) => [product.id, product]));
  const categoryNames = ["All", "Coffee", "Non-Coffee", "Frappe", "Ube Series", "Matcha Series"];
  const page = document.body?.dataset.page || "storefront";
  const sizePrices = { Small: 0, Medium: 20, Large: 40 };
  const addOnPrices = { "Extra shot": 10, Upsize: 20 };
  const menuImages = {
    Coffee: image("photo-1495474472287-4d71bcdd2085", 700),
    "Non-Coffee": image("photo-1515823064-d6e0c04616a7", 700),
    Frappe: image("photo-1572442388796-11668a67e53d", 700),
    "Ube Series": image("photo-1517701604599-bb29b565090c", 700),
    "Matcha Series": image("photo-1515823064-d6e0c04616a7", 700)
  };
  const menuItem = (id, name, category, price, options = {}) => ({ id, name, category, price, description: options.description || `House-made ${name.toLowerCase()} with a smooth, balanced finish.`, image: options.image || menuImages[category], emoji: options.emoji || "☕", bean: Boolean(options.bean), featured: Boolean(options.featured) });
  const menuCatalog = [
    menuItem("cafe-latte", "Cafe Latte", "Coffee", 49, { featured: true }),
    menuItem("americano", "Americano", "Coffee", 49),
    menuItem("vietnamese", "Vietnamese", "Coffee", 59, { bean: true }),
    menuItem("spanish-latte", "Spanish Latte", "Coffee", 59),
    menuItem("mocha-latte", "Mocha Latte", "Coffee", 59),
    menuItem("white-mocha", "White Mocha", "Coffee", 59, { bean: true }),
    menuItem("caramel-latte", "Caramel Latte", "Coffee", 59),
    menuItem("hazelnut", "Hazelnut", "Coffee", 59),
    menuItem("caramel-hazelnut", "Caramel Hazelnut", "Coffee", 59),
    menuItem("caramel-macchiato", "Caramel Macchiato", "Coffee", 69, { bean: true, featured: true }),
    menuItem("caramel-mocha", "Caramel Mocha", "Coffee", 69),
    menuItem("salted-caramel", "Salted Caramel", "Coffee", 69),
    menuItem("french-vanilla", "French Vanilla", "Coffee", 69),
    menuItem("iced-choco", "Iced Choco", "Non-Coffee", 49, { bean: true }),
    menuItem("strawberry-latte", "Strawberry Latte", "Non-Coffee", 49),
    menuItem("strawberry-oreo", "Strawberry Oreo", "Non-Coffee", 59, { bean: true }),
    menuItem("cookies-and-cream", "Cookies and Cream", "Non-Coffee", 59, { bean: true }),
    menuItem("choco-hazelnut", "Choco Hazelnut", "Non-Coffee", 59),
    menuItem("fruit-soda", "Fruit Soda", "Non-Coffee", 49),
    menuItem("vanilla-strawberry", "Vanilla Strawberry", "Non-Coffee", 59),
    menuItem("white-cookie", "White Cookie", "Non-Coffee", 69),
    menuItem("biscoff-latte", "Biscoff Latte", "Premium Non-Coffee", 79),
    menuItem("nutella-latte", "Nutella Latte", "Premium Non-Coffee", 79),
    menuItem("strawberry-frappe", "Strawberry", "Frappe", 89, { bean: true }),
    menuItem("oreo-matcha-frappe", "Oreo Matcha", "Frappe", 89, { bean: true }),
    menuItem("cookies-cream-frappe", "Cookies and Cream", "Frappe", 89),
    menuItem("ube-frappe", "Ube", "Frappe", 89, { bean: true }),
    menuItem("caramel-frappe", "Caramel", "Frappe", 89),
    menuItem("chocolate-frappe", "Chocolate", "Frappe", 89),
    menuItem("ube-latte", "Ube Latte", "Ube Series", 59),
    menuItem("ube-oreo", "Ube Oreo", "Ube Series", 69),
    menuItem("cafe-ube", "Cafe Ube", "Ube Series", 69),
    menuItem("ube-matcha", "Ube Matcha", "Ube Series", 69),
    menuItem("matcha-latte", "Matcha Latte", "Matcha Series", 59, { featured: true }),
    menuItem("oreo-matcha", "Oreo Matcha", "Matcha Series", 59),
    menuItem("dirty-matcha", "Dirty Matcha", "Matcha Series", 59),
    menuItem("matcha-strawberry", "Matcha Strawberry", "Matcha Series", 59, { bean: true, featured: true })
  ];
  const menuMap = new Map(menuCatalog.map((item) => [item.id, item]));
  menuCatalog.forEach((item) => productMap.set(item.id, { ...item, badge: item.featured ? "Best Seller" : "" }));
  const menuGroups = [
    { category: "Coffee", label: "Coffee", size: "HOT/ICED · 16oz", side: "left" },
    { category: "Non-Coffee", label: "Non-Coffee", size: "ICED · 16oz", side: "right" },
    { category: "Premium Non-Coffee", label: "Premium Non-Coffee", size: "16oz", side: "right" },
    { category: "Frappe", label: "Frappe", size: "22oz", side: "left" },
    { category: "Ube Series", label: "Ube Series", size: "16oz", side: "right" },
    { category: "Matcha Series", label: "Matcha Series", size: "16oz", side: "right" }
  ];
  const baseInventory = { "iced-caramel-latte": 18, "spanish-latte": 14, americano: 22, "java-chip-frappe": 9, "matcha-latte": 7, "iced-green-tea": 20, "butter-croissant": 6, "blueberry-muffin": 4, "chocolate-croissant": 9, "granola-bar": 16 };
  const defaultInventory = { ...baseInventory, ...Object.fromEntries(menuCatalog.map((item) => [item.id, 20])) };

  let cart = normalizeCart(readStorage(STORAGE.cart, []));
  let activeCategory = "All";
  let searchTerm = "";
  let selectedProduct = null;
  let selectedSize = "Medium";
  let selectedTemperature = "Hot";
  let selectedSugar = "Normal";
  let selectedAddons = new Set();
  let modalQuantity = 1;
  let selectedCardStyle = normalizeCardStyle(readStorage(STORAGE.cardStyle, DEFAULT_CARD_STYLE));
  let toastTimer;
  let revealObserver;
  const observedRevealTargets = new WeakSet();

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    if (page !== "storefront") return;
    document.body.classList.add("js-ready");
    initScrollProgress();
    renderMenu();
    renderFavorites();
    initCardStylePicker();
    initLoyaltyCheckout();
    updateCartUI();
    refreshRevealAnimations();
    bindEvents();
  }

  function bindEvents() {
    document.querySelector("#category-pills")?.addEventListener("click", (event) => {
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
    document.querySelector("#menu-search")?.addEventListener("input", (event) => {
      searchTerm = event.target.value.trim().toLowerCase();
      event.target.closest(".menu-search")?.classList.toggle("has-value", Boolean(searchTerm));
      renderMenu();
    });
    document.querySelector("#clear-search")?.addEventListener("click", () => {
      searchTerm = "";
      const input = document.querySelector("#menu-search");
      if (input) input.value = "";
      input?.closest(".menu-search")?.classList.remove("has-value");
      renderMenu();
      input?.focus();
    });
    document.querySelector("#reset-menu")?.addEventListener("click", () => {
      activeCategory = "All";
      searchTerm = "";
      const input = document.querySelector("#menu-search");
      if (input) input.value = "";
      input?.closest(".menu-search")?.classList.remove("has-value");
      document.querySelectorAll("[data-category]").forEach((tab) => {
        const selected = tab.dataset.category === "All";
        tab.classList.toggle("active", selected);
        tab.setAttribute("aria-selected", String(selected));
      });
      renderMenu();
    });
    document.querySelector("#product-grid")?.addEventListener("click", (event) => {
      const card = event.target.closest("[data-product-id]");
      if (card) openProductModal(card.dataset.productId);
    });
    document.querySelector("#menu-board")?.addEventListener("click", (event) => {
      const row = event.target.closest("[data-menu-item]");
      if (row) openProductModal(row.dataset.menuItem);
    });
    document.querySelector("#favorites-grid")?.addEventListener("click", (event) => {
      const card = event.target.closest("[data-product-id]");
      if (card) openProductModal(card.dataset.productId);
    });
    document.querySelector("#cart-button")?.addEventListener("click", openCart);
    document.querySelector("#cart-close")?.addEventListener("click", closeCart);
    document.querySelector("#drawer-backdrop")?.addEventListener("click", closeCart);
    document.querySelector("#continue-shopping")?.addEventListener("click", closeCart);
    document.querySelector("#cart-items")?.addEventListener("click", handleCartAction);
    document.querySelector("#cart-loyalty-email")?.addEventListener("input", (event) => {
      writeStorage(STORAGE.loyaltyEmail, event.target.value);
    });
    document.querySelector("#cart-customer-name")?.addEventListener("input", (event) => {
      writeStorage(STORAGE.customerName, event.target.value);
    });
    document.querySelector("#checkout-button")?.addEventListener("click", checkout);
    document.querySelector("#modal-close")?.addEventListener("click", closeProductModal);
    document.querySelector("#modal-backdrop")?.addEventListener("click", closeProductModal);
    document.querySelector("#modal-minus")?.addEventListener("click", () => changeModalQuantity(-1));
    document.querySelector("#modal-plus")?.addEventListener("click", () => changeModalQuantity(1));
    document.querySelector("#modal-add")?.addEventListener("click", addToCart);
    document.querySelector("#size-options")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-size]");
      if (!button) return;
      selectedSize = button.dataset.size;
      updateOptionState("#size-options", "data-size", selectedSize);
      updateModalTotal();
    });
    document.querySelector("#temperature-options")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-temperature]");
      if (!button) return;
      selectedTemperature = button.dataset.temperature;
      updateOptionState("#temperature-options", "data-temperature", selectedTemperature);
    });
    document.querySelector("#sugar-level")?.addEventListener("change", (event) => {
      selectedSugar = event.target.value;
    });
    document.querySelector("#addon-options")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-addon]");
      if (!button) return;
      const addon = button.dataset.addon;
      if (selectedAddons.has(addon)) selectedAddons.delete(addon);
      else selectedAddons.add(addon);
      button.classList.toggle("selected", selectedAddons.has(addon));
      updateModalTotal();
    });
    document.querySelector("#mobile-menu-toggle")?.addEventListener("click", () => {
      const nav = document.querySelector("#main-nav");
      const toggle = document.querySelector("#mobile-menu-toggle");
      const open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.querySelectorAll("a[href=\"#top\"]").forEach((link) => link.addEventListener("click", goHome));
    document.querySelector("#hero-scroll")?.addEventListener("click", scrollToMenu);
    document.querySelector("#back-to-top")?.addEventListener("click", goHome);
    document.querySelectorAll("#main-nav a").forEach((link) => link.addEventListener("click", () => {
      document.querySelector("#main-nav")?.classList.remove("is-open");
      document.querySelector("#mobile-menu-toggle")?.classList.remove("open");
      document.querySelector("#mobile-menu-toggle")?.setAttribute("aria-expanded", "false");
    }));
    document.querySelectorAll("[data-promo]").forEach((button) => button.addEventListener("click", () => showToast(`${button.dataset.promo} is ready when you are.`)));
    document.querySelectorAll("[data-location]").forEach((button) => button.addEventListener("click", () => showToast(`${button.dataset.location} location selected`)));
    document.querySelector("#contact-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      form.reset();
      showToast("Message sent — we’ll get back to you soon.");
    });
    document.querySelector("#loyalty-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const nameInput = form.querySelector("#loyalty-name");
      const emailInput = form.querySelector("#loyalty-email");
      const name = String(nameInput?.value || "Trippers member").trim();
      const email = normalizeEmail(emailInput?.value);
      const storedCustomers = readStorage(STORAGE.loyalty, []);
      const customers = Array.isArray(storedCustomers) ? storedCustomers.filter((entry) => entry && typeof entry === "object") : [];
      let customer = customers.find((entry) => normalizeEmail(entry.email) === email);
      if (customer) {
        customer.name = name || customer.name;
        customer.email = email;
        const status = String(customer.cardStatus || "").trim().toLowerCase();
        customer.cardStatus = status === "active" ? "Active" : status === "qualified" ? "Qualified" : "Pending";
      } else {
        customer = createLoyaltyCustomer({ name, email, cardStyle: selectedCardStyle, customers });
        customers.push(customer);
      }
      customer.cardStyle = selectedCardStyle;
      writeStorage(STORAGE.loyalty, customers);
      writeStorage(STORAGE.activeCustomer, { id: customer.id, name: customer.name, email: customer.email });
      writeStorage(STORAGE.loyaltyEmail, email);
      const message = customer.cardStatus === "Active"
        ? `Welcome back, ${customer.name.split(" ")[0]} — your loyalty card is active.`
        : `You’re on the list, ${customer.name.split(" ")[0]} — your card unlocks after ${LOYALTY_THRESHOLD} orders.`;
      showToast(message);
      form.reset();
    });
    document.querySelector("#loyalty-card-picker")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-card-choice]");
      if (!button) return;
      setCardStyle(button.dataset.cardChoice);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (document.querySelector("#product-modal.is-open")) closeProductModal();
        else if (document.querySelector("#cart-drawer.is-open")) closeCart();
      }
    });
  }

  function scrollToMenu(event) {
    event.preventDefault();
    const menu = document.querySelector("#menu");
    if (!menu) return;
    window.scrollTo({ top: Math.max(0, menu.offsetTop - 72), behavior: "smooth" });
  }

  function goHome(event) {
    event.preventDefault();
    document.documentElement.classList.add("home-jump");
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.history.replaceState(null, "", "#top");
    document.querySelectorAll("#main-nav a").forEach((link) => link.classList.toggle("active", link.getAttribute("href") === "#top"));
    window.requestAnimationFrame(() => document.documentElement.classList.remove("home-jump"));
  }

  function initScrollProgress() {
    const progress = document.querySelector("#scroll-progress");
    const backToTop = document.querySelector("#back-to-top");
    if (!progress) return;
    const update = () => {
      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      progress.style.width = `${Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100))}%`;
      backToTop?.classList.toggle("is-visible", window.scrollY > 560);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    const sectionLinks = [...document.querySelectorAll("#main-nav a")];
    const sections = sectionLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
    if ("IntersectionObserver" in window) {
      const sectionObserver = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        sectionLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`));
      }, { rootMargin: "-28% 0px -58% 0px", threshold: [0, .2, .5] });
      sections.forEach((section) => sectionObserver.observe(section));
    }
  }

  function refreshRevealAnimations() {
    if (!revealObserver && "IntersectionObserver" in window) {
      revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -42px 0px" });
    }
    const targets = document.querySelectorAll(".section-heading, .menu-tools, .menu-board-group, .product-card, .story-visual, .story-copy, .story-stats > div, .favorite-card, .promotion-card, .location-card, .contact-details > div, .contact-form");
    targets.forEach((target, index) => {
      if (observedRevealTargets.has(target)) return;
      observedRevealTargets.add(target);
      target.classList.add("reveal-on-scroll");
      target.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 65}ms`);
      if (revealObserver) revealObserver.observe(target);
      else target.classList.add("is-visible");
    });
  }

  function animateCartCount() {
    const count = document.querySelector("#cart-count");
    if (!count) return;
    count.classList.remove("is-bumping");
    void count.offsetWidth;
    count.classList.add("is-bumping");
  }

  function renderMenu() {
    const columns = document.querySelector("#menu-board-columns");
    if (!columns) return;
    const visibleItems = menuCatalog.filter((item) => {
      const categoryMatch = activeCategory === "All" || item.category === activeCategory || (activeCategory === "Non-Coffee" && item.category === "Premium Non-Coffee");
      const searchMatch = !searchTerm || `${item.name} ${item.category}`.toLowerCase().includes(searchTerm);
      return categoryMatch && searchMatch;
    });
    const visibleGroups = menuGroups.filter((group) => visibleItems.some((item) => item.category === group.category));
    columns.innerHTML = ["left", "right"].map((side) => {
      const groups = visibleGroups.filter((group) => group.side === side);
      if (!groups.length) return `<div class="menu-board-column"></div>`;
      return `<div class="menu-board-column">${groups.map((group) => menuGroupTemplate(group, visibleItems.filter((item) => item.category === group.category))).join("")}${side === "left" ? addOnsTemplate() : ""}</div>`;
    }).join("");
    const empty = document.querySelector("#empty-menu");
    if (empty) empty.hidden = visibleItems.length > 0;
    document.querySelector("#menu-board")?.classList.toggle("is-filtered", activeCategory !== "All" || Boolean(searchTerm));
    refreshRevealAnimations();
  }

  function menuGroupTemplate(group, items) {
    return `<section class="menu-board-group"><div class="menu-group-heading"><h4>${escapeHTML(group.label)}</h4><span>${escapeHTML(group.size)}</span></div><div class="menu-board-rows">${items.map((item) => menuRowTemplate(item)).join("")}</div></section>`;
  }

  function menuRowTemplate(item) {
    return `<button class="menu-board-row" type="button" data-menu-item="${item.id}"><span class="menu-item-name">${item.bean ? "<i aria-hidden=\"true\">●</i>" : ""}${escapeHTML(item.name)}</span><strong>${formatMenuPrice(item.price)}</strong><b class="menu-row-add" aria-hidden="true">+</b></button>`;
  }

  function addOnsTemplate() {
    return `<section class="menu-board-group menu-addons"><div class="menu-group-heading"><h4>Add-ons</h4><span></span></div><div class="menu-board-rows"><div class="menu-board-row"><span class="menu-item-name">Extra shot</span><strong>10</strong></div><div class="menu-board-row"><span class="menu-item-name">Upsize</span><strong>20</strong></div></div></section>`;
  }

  function productCardTemplate(product) {
    return `<article class="product-card" data-product-id="${product.id}"><div class="product-image"><span class="product-image-fallback" aria-hidden="true">${product.emoji}</span><img src="${product.image}" alt="${escapeHTML(product.name)}" loading="lazy" onerror="this.style.display='none'">${product.badge ? `<span class="product-badge">★ ${escapeHTML(product.badge)}</span>` : ""}</div><div class="product-body"><p class="product-category">${escapeHTML(product.category)}</p><h3>${escapeHTML(product.name)}</h3><p class="product-description">${escapeHTML(product.description)}</p><div class="product-footer"><span class="product-price">${formatPrice(product.price)}</span><button class="add-product" type="button">Add +</button></div></div></article>`;
  }

  function renderFavorites() {
    const grid = document.querySelector("#favorites-grid");
    if (!grid) return;
    const favorites = menuCatalog.filter((item) => item.featured).slice(0, 6);
    grid.innerHTML = favorites.map((item) => {
      ensureMenuProduct(item.id);
      return `<article class="favorite-card" data-product-id="${item.id}"><div class="favorite-image"><span class="product-image-fallback" aria-hidden="true">${item.emoji}</span><img src="${item.image}" alt="${escapeHTML(item.name)}" loading="lazy" onerror="this.style.display='none'">${item.featured ? `<span class="product-badge">★ Best Seller</span>` : ""}</div><div class="favorite-body"><p class="product-category">${escapeHTML(item.category)}</p><h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.description)}</p><div class="favorite-footer"><span class="favorite-price">${formatPrice(item.price)}</span><button class="favorite-add" type="button">Add +</button></div></div></article>`;
    }).join("");
    refreshRevealAnimations();
  }

  function ensureMenuProduct(productId) {
    const menuItem = menuMap.get(productId);
    if (!menuItem) return productMap.get(productId) || null;
    const product = { ...menuItem, badge: menuItem.featured ? "Best Seller" : "" };
    productMap.set(productId, product);
    return product;
  }

  function openProductModal(productId) {
    const product = ensureMenuProduct(productId) || productMap.get(productId);
    if (!product) return;
    selectedProduct = product;
    selectedSize = "Medium";
    selectedTemperature = "Hot";
    selectedSugar = "Normal";
    selectedAddons = new Set();
    modalQuantity = 1;
    const imageElement = document.querySelector("#modal-image");
    const badge = document.querySelector("#modal-badge");
    if (imageElement) {
      imageElement.style.display = "block";
      imageElement.src = product.image;
      imageElement.alt = product.name;
      imageElement.onerror = () => { imageElement.style.display = "none"; };
    }
    if (badge) { badge.textContent = product.badge ? `★ ${product.badge}` : "Freshly made"; badge.hidden = !product.badge; }
    setText("#modal-category", product.category);
    setText("#modal-product-name", product.name);
    setText("#modal-description", product.description);
    const sugar = document.querySelector("#sugar-level");
    if (sugar) sugar.value = "Normal";
    updateOptionState("#size-options", "data-size", selectedSize);
    updateOptionState("#temperature-options", "data-temperature", selectedTemperature);
    document.querySelectorAll("[data-addon]").forEach((button) => button.classList.remove("selected"));
    updateModalQuantity();
    updateModalTotal();
    openModal();
  }

  function updateOptionState(selector, attribute, value) {
    document.querySelectorAll(`${selector} [${attribute}]`).forEach((button) => button.classList.toggle("selected", button.getAttribute(attribute) === value));
  }

  function changeModalQuantity(amount) {
    modalQuantity = Math.max(1, Math.min(99, modalQuantity + amount));
    updateModalQuantity();
    updateModalTotal();
  }

  function updateModalQuantity() {
    setText("#modal-quantity", modalQuantity);
  }

  function updateModalTotal() {
    if (!selectedProduct) return;
    const total = unitPrice(selectedProduct) * modalQuantity;
    setText("#modal-total", formatPrice(total));
  }

  function unitPrice(product, line = null) {
    const size = line?.options?.size || selectedSize;
    const addons = line?.options?.addons || [...selectedAddons];
    return Number(product.price) + Number(sizePrices[size] || 0) + addons.reduce((sum, addon) => sum + Number(addOnPrices[addon] || 0), 0);
  }

  function addToCart() {
    if (!selectedProduct) return;
    const options = { size: selectedSize, temperature: selectedTemperature, sugar: selectedSugar, addons: [...selectedAddons].sort() };
    const key = makeCartKey(selectedProduct.id, options);
    const existing = cart.find((item) => item.key === key);
    if (existing) existing.quantity = Math.min(99, existing.quantity + modalQuantity);
    else cart.push({ key, productId: selectedProduct.id, options, quantity: modalQuantity });
    const productName = selectedProduct.name;
    saveCart();
    updateCartUI();
    animateCartCount();
    closeProductModal();
    showToast(`${productName} added to your cart.`);
  }

  function handleCartAction(event) {
    const button = event.target.closest("[data-cart-action]");
    const row = event.target.closest("[data-line-key]");
    if (!button || !row) return;
    const line = cart.find((item) => item.key === row.dataset.lineKey);
    if (!line) return;
    if (button.dataset.cartAction === "increase") line.quantity = Math.min(99, line.quantity + 1);
    if (button.dataset.cartAction === "decrease") line.quantity -= 1;
    if (button.dataset.cartAction === "remove" || line.quantity <= 0) cart = cart.filter((item) => item.key !== line.key);
    saveCart();
    updateCartUI();
  }

  function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    setText("#cart-count", count);
    setText("#drawer-count", `(${count})`);
    const items = document.querySelector("#cart-items");
    const empty = document.querySelector("#cart-empty");
    const footer = document.querySelector("#cart-footer");
    const drawer = document.querySelector("#cart-drawer");
    if (drawer) drawer.classList.toggle("is-empty", cart.length === 0);
    if (empty) empty.hidden = cart.length > 0;
    if (footer) footer.hidden = cart.length === 0;
    if (items) {
      items.innerHTML = cart.length ? cart.map(cartItemTemplate).join("") : "";
    }
    setText("#cart-subtotal", formatPrice(cartSubtotal()));
  }

  function cartItemTemplate(line) {
    const product = productMap.get(line.productId);
    if (!product) return "";
    const options = line.options || {};
    const description = [options.size, options.temperature, options.sugar, ...(options.addons || [])].filter(Boolean).join(" · ");
    return `<article class="cart-item" data-line-key="${escapeHTML(line.key)}"><div class="cart-item-image"><span class="product-image-fallback">${product.emoji}</span><img src="${product.image}" alt="" onerror="this.style.display='none'"></div><div class="cart-item-copy"><h3>${escapeHTML(product.name)}</h3><p title="${escapeHTML(description)}">${escapeHTML(description)}</p><div class="cart-item-actions"><div class="cart-quantity"><button type="button" data-cart-action="decrease" aria-label="Decrease quantity">−</button><span>${line.quantity}</span><button type="button" data-cart-action="increase" aria-label="Increase quantity">+</button></div><button class="remove-cart-item" type="button" data-cart-action="remove">Remove</button></div></div><strong class="cart-item-price">${formatPrice(unitPrice(product, line) * line.quantity)}</strong></article>`;
  }

  function cartSubtotal() {
    return cart.reduce((sum, line) => {
      const product = productMap.get(line.productId);
      return sum + (product ? unitPrice(product, line) * line.quantity : 0);
    }, 0);
  }

  function openCart() {
    const drawer = document.querySelector("#cart-drawer");
    const backdrop = document.querySelector("#drawer-backdrop");
    if (!drawer) return;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.querySelector("#cart-button")?.setAttribute("aria-expanded", "true");
    backdrop?.removeAttribute("hidden");
    window.requestAnimationFrame(() => backdrop?.classList.add("is-visible"));
    document.body.classList.add("no-scroll");
  }

  function closeCart() {
    const drawer = document.querySelector("#cart-drawer");
    const backdrop = document.querySelector("#drawer-backdrop");
    drawer?.classList.remove("is-open");
    drawer?.setAttribute("aria-hidden", "true");
    document.querySelector("#cart-button")?.setAttribute("aria-expanded", "false");
    backdrop?.classList.remove("is-visible");
    window.setTimeout(() => backdrop?.setAttribute("hidden", ""), 300);
    document.body.classList.remove("no-scroll");
  }

  function openModal() {
    const modal = document.querySelector("#product-modal");
    const backdrop = document.querySelector("#modal-backdrop");
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    backdrop?.removeAttribute("hidden");
    window.requestAnimationFrame(() => backdrop?.classList.add("is-visible"));
    document.body.classList.add("no-scroll");
  }

  function closeProductModal() {
    const modal = document.querySelector("#product-modal");
    const backdrop = document.querySelector("#modal-backdrop");
    modal?.classList.remove("is-open");
    modal?.setAttribute("aria-hidden", "true");
    backdrop?.classList.remove("is-visible");
    window.setTimeout(() => backdrop?.setAttribute("hidden", ""), 300);
    document.body.classList.remove("no-scroll");
    selectedProduct = null;
  }

  function createOrderId() {
    const random = typeof window.crypto?.randomUUID === "function" ? window.crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
    return `#${Date.now()}-${random}`;
  }

  function checkout() {
    if (!cart.length) {
      showToast("Your cart is empty — find a favorite first.");
      return;
    }
    const enteredEmail = String(document.querySelector("#cart-loyalty-email")?.value || "").trim();
    const enteredName = String(document.querySelector("#cart-customer-name")?.value || "").trim();
    const activeCustomer = readStorage(STORAGE.activeCustomer, null);
    const savedEmail = readStorage(STORAGE.loyaltyEmail, "");
    const savedName = readStorage(STORAGE.customerName, "");
    const emailField = document.querySelector("#cart-loyalty-email");
    const emailCandidate = enteredEmail ? [enteredEmail, activeCustomer?.email, savedEmail].find((value) => isValidEmail(value)) || "" : emailField ? "" : activeCustomer?.email || "";
    const customerEmail = normalizeEmail(emailCandidate);
    const customerName = enteredName || String(activeCustomer?.name || "").trim() || (typeof savedName === "string" ? savedName.trim() : "");
    const customersValue = readStorage(STORAGE.loyalty, []);
    const customers = Array.isArray(customersValue) ? customersValue.filter((entry) => entry && typeof entry === "object") : [];
    let loyaltyCustomer = customerEmail ? customers.find((entry) => normalizeEmail(entry.email) === customerEmail) : null;
    const nameMatches = !customerEmail && customerName ? customers.filter((entry) => normalizeName(entry.name) === normalizeName(customerName)) : [];
    if (!loyaltyCustomer && nameMatches.length === 1) loyaltyCustomer = nameMatches[0];
    if (loyaltyCustomer) loyaltyCustomer.cardStyle = selectedCardStyle;
    if (loyaltyCustomer && customerName) {
      loyaltyCustomer.name = customerName;
      writeStorage(STORAGE.loyalty, customers);
    } else if (customerEmail && !loyaltyCustomer) {
      const fallbackName = customerName || (activeCustomer && normalizeEmail(activeCustomer.email) === customerEmail ? activeCustomer.name : "Trippers member");
      loyaltyCustomer = createLoyaltyCustomer({ name: fallbackName, email: customerEmail, cardStyle: selectedCardStyle, customers });
      customers.push(loyaltyCustomer);
      writeStorage(STORAGE.loyalty, customers);
    } else if (!loyaltyCustomer && customerName && nameMatches.length === 0) {
      loyaltyCustomer = createLoyaltyCustomer({ name: customerName, email: "", customers });
      customers.push(loyaltyCustomer);
      writeStorage(STORAGE.loyalty, customers);
    }
    const order = { id: createOrderId(), customer: customerName || loyaltyCustomer?.name || "Walk-in guest", customerId: loyaltyCustomer?.id || "", customerEmail: loyaltyCustomer?.email || customerEmail, loyaltyPending: Boolean(loyaltyCustomer), items: cart.map((line) => ({ id: line.productId, name: productMap.get(line.productId)?.name, quantity: line.quantity, price: unitPrice(productMap.get(line.productId), line), options: line.options })), total: cartSubtotal(), status: "New", inventoryReserved: true, createdAt: new Date().toISOString() };
    if (!reserveInventoryForOrder(order)) {
      showToast("We could not save your order. Please try again.");
      return;
    }
    const storedOrders = readStorage(STORAGE.orders, []);
    const orders = Array.isArray(storedOrders) ? storedOrders : [];
    const nextOrders = [order, ...orders];
    if (!writeStorage(STORAGE.orders, nextOrders)) {
      restoreInventoryForOrder(order);
      showToast("We could not save your order. Please try again.");
      return;
    }
    let loyaltyResult = null;
    if (loyaltyCustomer) {
      // Publish the order first, then clear the pending flag after loyalty state is saved.
      order.loyaltyPending = false;
      loyaltyResult = recordLoyaltyOrder(order, nextOrders, customers);
      writeStorage(STORAGE.orders, nextOrders);
    }
    cart = [];
    saveCart();
    updateCartUI();
    closeCart();
    const message = loyaltyResult?.issued
      ? `SUCCESSFULL YOU COMPLETE — order ${order.id} unlocked your loyalty card!`
      : loyaltyResult?.customer?.cardStatus === "Qualified"
        ? `Order ${order.id} sent to the bar — your card is ready to issue.`
        : `Order ${order.id} sent to the bar — see you soon!`;
    showToast(message);
  }

  function initCardStylePicker() {
    if (!document.querySelector("#loyalty-card-preview")) return;
    setCardStyle(selectedCardStyle, false);
  }

  function setCardStyle(style, persist = true) {
    selectedCardStyle = normalizeCardStyle(style);
    const preview = document.querySelector("#loyalty-card-preview");
    if (preview) preview.dataset.cardStyle = selectedCardStyle;
    const tierLabel = document.querySelector("#loyalty-card-tier-label");
    if (tierLabel) tierLabel.textContent = CARD_TIER_LABELS[selectedCardStyle] || CARD_TIER_LABELS[DEFAULT_CARD_STYLE];
    document.querySelectorAll("[data-card-choice]").forEach((button) => {
      const active = button.dataset.cardChoice === selectedCardStyle;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (persist) writeStorage(STORAGE.cardStyle, selectedCardStyle);
  }

  function initLoyaltyCheckout() {
    const emailInput = document.querySelector("#cart-loyalty-email");
    const nameInput = document.querySelector("#cart-customer-name");
    const activeCustomer = readStorage(STORAGE.activeCustomer, null);
    const savedEmail = readStorage(STORAGE.loyaltyEmail, "");
    const savedName = readStorage(STORAGE.customerName, "");
    if (emailInput) emailInput.value = normalizeEmail(activeCustomer?.email || (typeof savedEmail === "string" ? savedEmail : ""));
    if (nameInput) nameInput.value = String(activeCustomer?.name || (typeof savedName === "string" ? savedName : ""));
  }

  function createLoyaltyCustomer({ name, email, cardStyle = DEFAULT_CARD_STYLE, customers = [] }) {
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
      customer = createLoyaltyCustomer({ name: order.customer || "Trippers member", email: order.customerEmail, cardStyle: selectedCardStyle, customers: list });
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
    const loyaltySaved = writeStorage(STORAGE.loyalty, list);
    if (issued && !loyaltySaved) {
      loyaltyCardStock += 1;
      writeStorage(STORAGE.cardInventory, loyaltyCardStock);
      return { customer: { ...customer, cardStatus: "Qualified" }, issued: false };
    }
    writeStorage(STORAGE.activeCustomer, { id: customer.id, name: customer.name, email: customer.email });
    writeStorage(STORAGE.loyaltyEmail, customer.email);
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

  let loyaltyCardStock = readCardStock();

  function normalizeEmail(value) { return String(value || "").trim().toLowerCase(); }
  function normalizeName(value) { return String(value || "").trim().toLowerCase().replace(/\s+/g, " "); }
  function normalizeCardStyle(value) { const style = String(value || "").trim().toLowerCase(); return CARD_STYLE_NAMES[style] ? style : DEFAULT_CARD_STYLE; }
  function isValidEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value)); }

  function reserveInventoryForOrder(order) {
    const current = { ...defaultInventory, ...(readStorage(STORAGE.inventory, {}) || {}) };
    order.items.forEach((item) => {
      const id = item.id || productMap.get(item.productId)?.id;
      if (!id || !defaultInventory.hasOwnProperty(id)) return;
      current[id] = Math.max(0, Number(current[id] ?? defaultInventory[id]) - Number(item.quantity || 0));
    });
    return writeStorage(STORAGE.inventory, current);
  }

  function restoreInventoryForOrder(order) {
    const current = { ...defaultInventory, ...(readStorage(STORAGE.inventory, {}) || {}) };
    order.items.forEach((item) => {
      const id = item.id || productMap.get(item.productId)?.id;
      if (!id || !defaultInventory.hasOwnProperty(id)) return;
      current[id] = Number(current[id] ?? defaultInventory[id] ?? 0) + Number(item.quantity || 0);
    });
    writeStorage(STORAGE.inventory, current);
  }

  function makeCartKey(productId, options) {
    return `${productId}::${options.size}::${options.temperature}::${options.sugar}::${(options.addons || []).join("|")}`;
  }

  function normalizeCart(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && productMap.has(item.productId)).map((item) => ({ key: String(item.key || makeCartKey(item.productId, item.options || {})), productId: item.productId, options: item.options || { size: "Medium", temperature: "Hot", sugar: "Normal", addons: [] }, quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)) }));
  }

  function saveCart() { return writeStorage(STORAGE.cart, cart); }

  function readStorage(key, fallback) {
    try { const value = window.localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; }
  }

  function writeStorage(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }

  function formatPrice(value) { return `₱${Math.round(Number(value) || 0)}`; }
  function formatMenuPrice(value) { return String(Math.round(Number(value) || 0)); }
  function setText(selector, value) { const element = document.querySelector(selector); if (element) element.textContent = value; }
  function escapeHTML(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }
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
