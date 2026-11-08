(() => {
  "use strict";

  const STORAGE = {
    cart: "lumenCart",
    orders: "lumenOrders",
    lastOrder: "lumenLastOrder",
    inventory: "lumenInventory",
    wishlist: "lumenWishlist"
  };

  const image = (id, width = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
  const products = [
    {
      id: "studio-sound",
      name: "Studio Sound",
      category: "Tech",
      price: 129,
      compareAt: 159,
      badge: "Best seller",
      badgeClass: "",
      rating: 4.9,
      reviews: 1248,
      image: image("photo-1505740420928-5e560c06d30e"),
      description: "Rich, balanced sound in a shape that feels at home on your desk and quiet in your bag.",
      features: ["40-hour battery life", "Memory foam ear cushions", "USB-C fast charging"],
      tags: "headphones audio music tech",
      stock: 18
    },
    {
      id: "orbit-watch",
      name: "Orbit Watch",
      category: "Wear",
      price: 88,
      compareAt: null,
      badge: "New",
      badgeClass: "yellow",
      rating: 4.8,
      reviews: 386,
      image: image("photo-1523275335684-37898b6baf30"),
      description: "A quiet, classic timepiece with a little more intelligence where it counts.",
      features: ["Water resistant to 50m", "Minimal two-hand dial", "Two-year warranty"],
      tags: "watch time wear accessory",
      stock: 7
    },
    {
      id: "everyday-trainer",
      name: "Everyday Trainer",
      category: "Wear",
      price: 112,
      compareAt: 140,
      badge: "20% off",
      badgeClass: "peach",
      rating: 4.7,
      reviews: 729,
      image: image("photo-1542291026-7eec264c27ff"),
      description: "Light on your feet, easy on your eyes. The trainer that makes every plan feel possible.",
      features: ["Breathable knit upper", "Recycled rubber sole", "Cushioned footbed"],
      tags: "shoes sneakers train wear",
      stock: 12
    },
    {
      id: "field-pack",
      name: "Field Pack",
      category: "Carry",
      price: 74,
      compareAt: null,
      badge: null,
      badgeClass: "",
      rating: 4.9,
      reviews: 512,
      image: image("photo-1553062407-98eeb64c6a62"),
      description: "An easy, structured pack for the commute, the weekend, and everything between.",
      features: ["18L everyday capacity", "Recycled ripstop shell", "Padded laptop sleeve"],
      tags: "bag backpack travel carry",
      stock: 21
    },
    {
      id: "halo-lamp",
      name: "Halo Lamp",
      category: "Home",
      price: 96,
      compareAt: null,
      badge: "Studio pick",
      badgeClass: "",
      rating: 4.8,
      reviews: 264,
      image: image("photo-1507473885765-e6ed057f782c"),
      description: "A warm pool of light for reading, working, and winding down without the glare.",
      features: ["Three dimmable settings", "Touch-to-turn control", "Energy-saving LED"],
      tags: "lamp light home desk",
      stock: 4
    },
    {
      id: "daily-ritual",
      name: "Daily Ritual Set",
      category: "Care",
      price: 46,
      compareAt: null,
      badge: null,
      badgeClass: "",
      rating: 4.6,
      reviews: 198,
      image: image("photo-1556228578-8c89e6adf883"),
      description: "Three uncomplicated essentials for a softer, steadier start and end to the day.",
      features: ["Cleanser, mist, and balm", "Plant-based formulas", "Recyclable glassware"],
      tags: "skin care wellness beauty",
      stock: 31
    },
    {
      id: "pocket-camera",
      name: "Pocket Camera",
      category: "Tech",
      price: 164,
      compareAt: null,
      badge: "Limited",
      badgeClass: "peach",
      rating: 4.9,
      reviews: 173,
      image: image("photo-1516035069371-29a1b244cc32"),
      description: "A little reminder to look twice. A compact camera for the details you almost miss.",
      features: ["35mm fixed lens", "Built-in flash", "Simple manual controls"],
      tags: "camera film photo tech",
      stock: 3
    },
    {
      id: "sun-frame",
      name: "Sun Frame",
      category: "Wear",
      price: 58,
      compareAt: 72,
      badge: "20% off",
      badgeClass: "peach",
      rating: 4.7,
      reviews: 344,
      image: image("photo-1511499767150-a48a237f0083"),
      description: "A soft, sturdy frame with just enough tint for bright afternoons and long weekends.",
      features: ["Polarized lenses", "Acetate frame", "Protective hard case"],
      tags: "sunglasses glasses wear sun",
      stock: 16
    }
  ];

  const productMap = new Map(products.map((product) => [product.id, product]));
  const page = document.body?.dataset.page || "home";
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  let cart = normalizeCart(readStorage(STORAGE.cart, []));
  let wishlist = new Set(Array.isArray(readStorage(STORAGE.wishlist, [])) ? readStorage(STORAGE.wishlist, []) : []);
  let activeCategory = "All";
  let searchTerm = "";
  let activeProductId = null;
  let activeModalQuantity = 1;
  let toastTimer;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    if (page === "home") {
      initHome();
    } else if (page === "checkout") {
      initCheckout();
    } else if (page === "success") {
      initSuccess();
    }
  }

  function initHome() {
    renderProducts();
    updateCartUI();
    bindHomeEvents();
  }

  function bindHomeEvents() {
    const categoryFilters = document.querySelector("#category-filters");
    const grid = document.querySelector("#product-grid");
    const searchToggle = document.querySelector("#search-toggle");
    const searchPanel = document.querySelector("#search-panel");
    const searchInput = document.querySelector("#search-input");
    const searchClose = document.querySelector("#search-close");
    const menuToggle = document.querySelector("#menu-toggle");
    const mainNav = document.querySelector("#main-nav");
    const cartToggle = document.querySelector("#cart-toggle");
    const cartClose = document.querySelector("#cart-close");
    const backdrop = document.querySelector("#drawer-backdrop");
    const continueShopping = document.querySelector("#continue-shopping");
    const resetSearch = document.querySelector("#reset-search");
    const newsletterForm = document.querySelector("#newsletter-form");

    categoryFilters?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      activeCategory = button.dataset.filter;
      categoryFilters.querySelectorAll("[data-filter]").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-selected", String(selected));
      });
      renderProducts();
    });

    grid?.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-action]");
      if (!actionButton) return;
      const productId = actionButton.closest("[data-product-id]")?.dataset.productId;
      if (!productId) return;
      if (actionButton.dataset.action === "add") addToCart(productId);
      if (actionButton.dataset.action === "quick-view") openProductModal(productId);
      if (actionButton.dataset.action === "wishlist") toggleWishlist(productId, actionButton);
    });

    searchToggle?.addEventListener("click", () => {
      const open = !searchPanel.classList.contains("is-open");
      searchPanel.classList.toggle("is-open", open);
      searchPanel.setAttribute("aria-hidden", String(!open));
      searchToggle.setAttribute("aria-expanded", String(open));
      if (open) window.setTimeout(() => searchInput?.focus(), 80);
    });

    searchClose?.addEventListener("click", closeSearch);
    searchInput?.addEventListener("input", (event) => {
      searchTerm = event.target.value.trim().toLowerCase();
      const hint = document.querySelector("#search-hint");
      if (hint) hint.textContent = searchTerm ? `Showing results for “${event.target.value.trim()}”` : "Try “headphones”, “home”, or “travel”";
      renderProducts();
    });

    menuToggle?.addEventListener("click", () => {
      const open = !mainNav.classList.contains("is-open");
      mainNav.classList.toggle("is-open", open);
      menuToggle.classList.toggle("open", open);
      menuToggle.setAttribute("aria-expanded", String(open));
    });

    mainNav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      mainNav.classList.remove("is-open");
      menuToggle?.classList.remove("open");
      menuToggle?.setAttribute("aria-expanded", "false");
    }));

    cartToggle?.addEventListener("click", openCart);
    cartClose?.addEventListener("click", closeCart);
    backdrop?.addEventListener("click", closeCart);
    continueShopping?.addEventListener("click", closeCart);
    resetSearch?.addEventListener("click", () => {
      searchTerm = "";
      activeCategory = "All";
      if (searchInput) searchInput.value = "";
      categoryFilters?.querySelectorAll("[data-filter]").forEach((item) => {
        const selected = item.dataset.filter === "All";
        item.classList.toggle("active", selected);
        item.setAttribute("aria-selected", String(selected));
      });
      renderProducts();
    });

    document.querySelector("#cart-items")?.addEventListener("click", handleCartAction);
    document.querySelector("#modal-close")?.addEventListener("click", closeProductModal);
    document.querySelector("#modal-backdrop")?.addEventListener("click", closeProductModal);
    document.querySelector("#modal-minus")?.addEventListener("click", () => changeModalQuantity(-1));
    document.querySelector("#modal-plus")?.addEventListener("click", () => changeModalQuantity(1));
    document.querySelector("#modal-add")?.addEventListener("click", () => {
      if (activeProductId) addToCart(activeProductId, activeModalQuantity);
      closeProductModal();
    });

    newsletterForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = document.querySelector("#newsletter-email");
      if (!email?.value) return;
      showToast("You’re on the list — welcome to Lumen");
      newsletterForm.reset();
    });

    document.addEventListener("keydown", handleGlobalKeydown);
  }

  function renderProducts() {
    const grid = document.querySelector("#product-grid");
    if (!grid) return;
    const visibleProducts = products.filter((product) => {
      const categoryMatch = activeCategory === "All" || product.category === activeCategory;
      const searchMatch = !searchTerm || `${product.name} ${product.category} ${product.description} ${product.tags}`.toLowerCase().includes(searchTerm);
      return categoryMatch && searchMatch;
    });
    grid.innerHTML = visibleProducts.map((product) => productCardTemplate(product)).join("");
    const count = document.querySelector("#product-count");
    if (count) count.textContent = `${visibleProducts.length} ${visibleProducts.length === 1 ? "piece" : "pieces"}`;
    const empty = document.querySelector("#empty-results");
    if (empty) empty.hidden = visibleProducts.length > 0;
  }

  function productCardTemplate(product) {
    const wished = wishlist.has(product.id);
    return `<article class="product-card" data-product-id="${product.id}">
      <div class="product-image">
        <img src="${product.image}" alt="${escapeHTML(product.name)}" loading="lazy">
        ${product.badge ? `<span class="product-badge ${product.badgeClass}">${escapeHTML(product.badge)}</span>` : ""}
        <button class="wishlist-button ${wished ? "is-wished" : ""}" type="button" data-action="wishlist" aria-label="${wished ? "Remove" : "Add"} ${escapeHTML(product.name)} ${wished ? "from" : "to"} wishlist">${wished ? "♥" : "♡"}</button>
        <div class="product-hover-actions"><button class="quick-view-button" type="button" data-action="quick-view">Quick view</button><button class="add-button" type="button" data-action="add">Add to bag</button></div>
      </div>
      <div class="product-info"><p class="product-category">${escapeHTML(product.category)}</p><div class="product-title-row"><h3 class="product-name">${escapeHTML(product.name)}</h3><span class="product-price">${formatPrice(product.price)}</span></div><div class="product-rating"><span class="stars">★★★★★</span><span>${product.rating} · ${product.reviews.toLocaleString()} reviews</span></div></div>
    </article>`;
  }

  function addToCart(productId, quantity = 1) {
    const product = productMap.get(productId);
    if (!product) return;
    const existing = cart.find((item) => item.id === productId);
    const nextQuantity = (existing?.quantity || 0) + Math.max(1, Number(quantity) || 1);
    if (nextQuantity > 99) {
      showToast("You can add up to 99 of a piece to your bag");
      return;
    }
    if (existing) existing.quantity = nextQuantity;
    else cart.push({ id: productId, quantity: nextQuantity });
    saveCart();
    updateCartUI();
    showToast(`${product.name} added to your bag`);
  }

  function handleCartAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    if (!id) return;
    if (button.dataset.action === "increase") changeQuantity(id, 1);
    if (button.dataset.action === "decrease") changeQuantity(id, -1);
    if (button.dataset.action === "remove") removeFromCart(id);
  }

  function changeQuantity(id, amount) {
    const item = cart.find((entry) => entry.id === id);
    if (!item) return;
    item.quantity += amount;
    if (item.quantity <= 0) {
      cart = cart.filter((entry) => entry.id !== id);
    }
    saveCart();
    updateCartUI();
  }

  function removeFromCart(id) {
    const product = productMap.get(id);
    cart = cart.filter((item) => item.id !== id);
    saveCart();
    updateCartUI();
    showToast(`${product?.name || "Piece"} removed from your bag`);
  }

  function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const countElements = document.querySelectorAll("#cart-count, #drawer-count");
    countElements.forEach((element) => {
      if (element.id === "drawer-count") element.textContent = `(${count})`;
      else element.textContent = count;
    });
    const drawer = document.querySelector("#cart-drawer");
    if (drawer) drawer.classList.toggle("is-empty", cart.length === 0);
    renderCartItems();
    if (page === "checkout") renderCheckoutSummary();
  }

  function renderCartItems() {
    const container = document.querySelector("#cart-items");
    if (!container) return;
    const subtotalElement = document.querySelector("#cart-subtotal");
    if (subtotalElement) subtotalElement.textContent = formatPrice(cartSubtotal());
    if (!cart.length) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = cart.map((item) => {
      const product = productMap.get(item.id);
      if (!product) return "";
      return `<article class="cart-item" data-id="${product.id}">
        <div class="cart-item-image"><img src="${product.image}" alt="${escapeHTML(product.name)}"></div>
        <div class="cart-item-info"><h3>${escapeHTML(product.name)}</h3><p>${escapeHTML(product.category)}</p><div class="cart-item-actions"><div class="quantity-control" aria-label="Quantity for ${escapeHTML(product.name)}"><button type="button" data-action="decrease" data-id="${product.id}" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button type="button" data-action="increase" data-id="${product.id}" aria-label="Increase quantity">+</button></div><button class="remove-item" type="button" data-action="remove" data-id="${product.id}">Remove</button></div></div>
        <strong class="cart-item-price">${formatPrice(product.price * item.quantity)}</strong>
      </article>`;
    }).join("");
    const subtotal = document.querySelector("#cart-subtotal");
    if (subtotal) subtotal.textContent = formatPrice(cartSubtotal());
  }

  function openCart() {
    const drawer = document.querySelector("#cart-drawer");
    const backdrop = document.querySelector("#drawer-backdrop");
    if (!drawer) return;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    backdrop?.removeAttribute("hidden");
    window.requestAnimationFrame(() => backdrop?.classList.add("is-visible"));
    document.body.classList.add("no-scroll");
  }

  function closeCart() {
    const drawer = document.querySelector("#cart-drawer");
    const backdrop = document.querySelector("#drawer-backdrop");
    if (!drawer) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop?.classList.remove("is-visible");
    window.setTimeout(() => backdrop?.setAttribute("hidden", ""), 320);
    document.body.classList.remove("no-scroll");
  }

  function openProductModal(productId) {
    const product = productMap.get(productId);
    const modal = document.querySelector("#product-modal");
    if (!product || !modal) return;
    activeProductId = productId;
    activeModalQuantity = 1;
    const modalImage = document.querySelector("#modal-image");
    const category = document.querySelector("#modal-category");
    const name = document.querySelector("#modal-product-name");
    const stars = document.querySelector("#modal-stars");
    const reviews = document.querySelector("#modal-reviews");
    const price = document.querySelector("#modal-price");
    const description = document.querySelector("#modal-description");
    const features = document.querySelector("#modal-features");
    if (modalImage) {
      modalImage.src = product.image;
      modalImage.alt = product.name;
    }
    if (category) category.textContent = product.category;
    if (name) name.textContent = product.name;
    if (stars) stars.textContent = "★★★★★";
    if (reviews) reviews.textContent = `${product.rating} · ${product.reviews.toLocaleString()} reviews`;
    if (price) price.textContent = formatPrice(product.price);
    if (description) description.textContent = product.description;
    if (features) features.innerHTML = product.features.map((feature) => `<li>${escapeHTML(feature)}</li>`).join("");
    updateModalQuantity();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    const backdrop = document.querySelector("#modal-backdrop");
    backdrop?.removeAttribute("hidden");
    window.requestAnimationFrame(() => backdrop?.classList.add("is-visible"));
    document.body.classList.add("no-scroll");
  }

  function closeProductModal() {
    const modal = document.querySelector("#product-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    const backdrop = document.querySelector("#modal-backdrop");
    backdrop?.classList.remove("is-visible");
    window.setTimeout(() => backdrop?.setAttribute("hidden", ""), 320);
    activeProductId = null;
    document.body.classList.remove("no-scroll");
  }

  function changeModalQuantity(amount) {
    activeModalQuantity = Math.max(1, Math.min(99, activeModalQuantity + amount));
    updateModalQuantity();
  }

  function updateModalQuantity() {
    const element = document.querySelector("#modal-quantity");
    if (element) element.textContent = activeModalQuantity;
  }

  function toggleWishlist(productId, button) {
    if (wishlist.has(productId)) {
      wishlist.delete(productId);
      showToast("Removed from your wishlist");
    } else {
      wishlist.add(productId);
      showToast("Saved to your wishlist");
    }
    writeStorage(STORAGE.wishlist, [...wishlist]);
    button.classList.toggle("is-wished", wishlist.has(productId));
    button.textContent = wishlist.has(productId) ? "♥" : "♡";
    button.setAttribute("aria-label", `${wishlist.has(productId) ? "Remove" : "Add"} ${productMap.get(productId)?.name || "piece"} ${wishlist.has(productId) ? "from" : "to"} wishlist`);
  }

  function initCheckout() {
    const form = document.querySelector("#checkout-form");
    if (!form) return;
    updateCartUI();
    form.addEventListener("submit", placeOrder);
    document.querySelector("#card-number")?.addEventListener("input", (event) => {
      const digits = event.target.value.replace(/\D/g, "").slice(0, 19);
      event.target.value = digits.replace(/(.{4})/g, "$1 ").trim();
    });
    document.querySelector("#expiry")?.addEventListener("input", (event) => {
      const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
      event.target.value = digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
    });
    document.querySelector("#zip")?.addEventListener("input", (event) => {
      event.target.value = event.target.value.replace(/[^\d-]/g, "").slice(0, 10);
    });
    form.querySelectorAll("input, select").forEach((field) => {
      field.addEventListener("input", () => field.closest(".field")?.classList.remove("has-error"));
      field.addEventListener("change", () => field.closest(".field")?.classList.remove("has-error"));
    });
  }

  function renderCheckoutSummary() {
    const container = document.querySelector("#checkout-summary");
    if (!container) return;
    const empty = document.querySelector("#summary-empty");
    const count = document.querySelector("#summary-count");
    const subtotal = cartSubtotal();
    const shipping = cart.length === 0 || subtotal >= 75 ? 0 : 7;
    if (empty) empty.hidden = cart.length > 0;
    if (count) count.textContent = `(${cart.reduce((sum, item) => sum + item.quantity, 0)})`;
    if (container) container.innerHTML = cart.map((item) => {
      const product = productMap.get(item.id);
      if (!product) return "";
      return `<article class="summary-item"><div class="summary-item-image"><img src="${product.image}" alt="${escapeHTML(product.name)}"><span class="summary-item-quantity">${item.quantity}</span></div><div class="summary-item-info"><h3>${escapeHTML(product.name)}</h3><span>${escapeHTML(product.category)}</span></div><strong class="summary-item-price">${formatPrice(product.price * item.quantity)}</strong></article>`;
    }).join("");
    const subtotalElement = document.querySelector("#summary-subtotal");
    const shippingElement = document.querySelector("#summary-shipping");
    const totalElement = document.querySelector("#summary-total");
    if (subtotalElement) subtotalElement.textContent = formatPrice(subtotal);
    if (shippingElement) shippingElement.textContent = shipping ? formatPrice(shipping) : "Free";
    if (totalElement) totalElement.textContent = formatPrice(subtotal + shipping);
    const placeOrderButton = document.querySelector("#place-order");
    if (placeOrderButton) placeOrderButton.disabled = cart.length === 0;
  }

  function placeOrder(event) {
    event.preventDefault();
    if (!cart.length) {
      showToast("Your bag is empty — add something first");
      return;
    }
    const form = event.currentTarget;
    if (!validateCheckoutForm(form)) return;
    const formData = new FormData(form);
    const items = cart.map((item) => {
      const product = productMap.get(item.id);
      return { id: product.id, name: product.name, price: product.price, quantity: item.quantity, image: product.image };
    });
    const subtotal = cartSubtotal();
    const shipping = subtotal >= 75 ? 0 : 7;
    const order = {
      id: `LUM-${String(Date.now()).slice(-6)}`,
      email: formData.get("email"),
      name: `${formData.get("firstName")} ${formData.get("lastName")}`,
      address: [formData.get("address"), formData.get("apartment")].filter(Boolean).join(", "),
      city: `${formData.get("city")}, ${formData.get("state")} ${formData.get("zip")}`,
      items,
      subtotal,
      shipping,
      total: subtotal + shipping,
      status: "Processing",
      date: new Date().toISOString()
    };
    const orders = readStorage(STORAGE.orders, []);
    orders.push(order);
    writeStorage(STORAGE.orders, orders);
    writeStorage(STORAGE.lastOrder, order);
    const inventory = readStorage(STORAGE.inventory, {});
    items.forEach((item) => {
      if (Object.prototype.hasOwnProperty.call(inventory, item.id)) inventory[item.id] = Math.max(0, Number(inventory[item.id]) - item.quantity);
    });
    writeStorage(STORAGE.inventory, inventory);
    cart = [];
    saveCart();
    window.location.href = "order-success.html";
  }

  function validateCheckoutForm(form) {
    let valid = true;
    let firstInvalid = null;
    form.querySelectorAll("[required]").forEach((field) => {
      const fieldWrapper = field.closest(".field");
      let fieldValid = field.checkValidity();
      if (field.id === "card-number") fieldValid = field.value.replace(/\D/g, "").length >= 12;
      if (field.id === "expiry") fieldValid = /^\d{2}\s?\/\s?\d{2}$/.test(field.value);
      if (field.id === "cvc") fieldValid = /^\d{3,4}$/.test(field.value);
      fieldWrapper?.classList.toggle("has-error", !fieldValid);
      if (!fieldValid && !firstInvalid) firstInvalid = field;
      valid = fieldValid && valid;
    });
    if (!valid) {
      firstInvalid?.focus();
      showToast("A few details still need your attention");
    }
    return valid;
  }

  function initSuccess() {
    const orders = readStorage(STORAGE.orders, []);
    const order = readStorage(STORAGE.lastOrder, null) || orders[orders.length - 1];
    const number = document.querySelector("#success-order-number");
    const email = document.querySelector("#success-email");
    const details = document.querySelector("#success-details");
    if (number) number.textContent = order?.id || "LUM-000000";
    if (email) email.textContent = order ? `we’ve sent the details to ${order.email}` : "we’ve sent the details to your inbox";
    if (details && order) {
      const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const itemSummary = order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ");
      details.innerHTML = `<div class="success-detail"><span>Pieces</span><strong>${itemCount}</strong></div><div class="success-detail"><span>Total</span><strong>${formatPrice(order.total)}</strong></div><div class="success-detail"><span>Summary</span><strong title="${escapeHTML(itemSummary)}">${escapeHTML(itemSummary)}</strong></div>`;
    }
    document.querySelector("#copy-order")?.addEventListener("click", async () => {
      const text = order?.id || number?.textContent || "";
      try {
        await navigator.clipboard.writeText(text);
        showToast("Order number copied to clipboard");
      } catch {
        showToast(`Your order number is ${text}`);
      }
    });
  }

  function closeSearch() {
    const panel = document.querySelector("#search-panel");
    const toggle = document.querySelector("#search-toggle");
    panel?.classList.remove("is-open");
    panel?.setAttribute("aria-hidden", "true");
    toggle?.setAttribute("aria-expanded", "false");
  }

  function handleGlobalKeydown(event) {
    if (event.key !== "Escape") return;
    if (document.querySelector("#product-modal.is-open")) closeProductModal();
    else if (document.querySelector("#cart-drawer.is-open")) closeCart();
    else closeSearch();
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

  function cartSubtotal() {
    return cart.reduce((sum, item) => {
      const product = productMap.get(item.id);
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);
  }

  function saveCart() {
    writeStorage(STORAGE.cart, cart);
  }

  function normalizeCart(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && productMap.has(item.id)).map((item) => ({ id: item.id, quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)) }));
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
    } catch {
      // The storefront remains usable when storage is unavailable.
    }
  }

  function formatPrice(value) {
    return money.format(Number(value) || 0);
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }
})();
