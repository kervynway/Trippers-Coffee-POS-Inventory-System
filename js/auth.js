(() => {
  "use strict";

  // Opening index.html directly from disk (file://) gives the page no API
  // server, so login requests cannot work. Send the user to the local server.
  if (window.location.protocol === "file:") {
    window.location.replace(`http://127.0.0.1:4173/index.html${window.location.hash || ""}`);
    return;
  }

  const $ = (selector) => document.querySelector(selector);
  const forms = ["login-form", "change-password-form", "setup-form", "forgot-form"].map((id) => document.getElementById(id));
  let selectedRole = "cashier";
  let currentUser = null;

  async function request(url, options = {}) {
    const { headers = {}, ...fetchOptions } = options;
    let response;
    try {
      response = await fetch(url, {
        ...fetchOptions,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...headers }
      });
    } catch {
      throw new Error("Cannot reach the server. Make sure it is running, then reload the page.");
    }
    const raw = await response.text();
    let data = {};
    if (raw) {
      try { data = JSON.parse(raw); } catch { data = {}; }
    }
    if (!response.ok) {
      const fallback = response.status === 403
        ? "The server denied this request (403). Reload the page and try again."
        : `Request failed (${response.status}${response.statusText ? ` ${response.statusText}` : ""}).`;
      throw new Error(data.error || data.message || fallback);
    }
    return data;
  }

  function showForm(form) {
    forms.forEach((item) => { item.hidden = item !== form; });
  }

  function message(element, text, success = false) {
    element.textContent = text;
    element.classList.toggle("success", success);
  }

  function navigateFor(user) {
    window.location.replace(user.role === "admin" ? "/admin/dashboard.html" : "/pos.html");
  }

  async function initialize() {
    $("#year").textContent = String(new Date().getFullYear());
    const splash = $("#splash");
    const shell = $("#auth-shell");
    let setup;
    let session;
    try {
      [setup, session] = await Promise.all([
        request("/api/setup/status"),
        request("/api/auth/session")
      ]);
    } catch (error) {
      showForm($("#login-form"));
      message($("#login-message"), `Unable to connect to the system: ${error.message}`);
      shell.hidden = false;
      splash.classList.add("is-hidden");
      return;
    }

    if (session.authenticated) {
      currentUser = session.user;
      shell.hidden = false;
      splash.classList.add("is-hidden");
      if (currentUser.mustChangePassword) {
        setHeading("PASSWORD UPDATE", "Choose a new password", "Your administrator gave you a temporary password.");
        showForm($("#change-password-form"));
      } else {
        navigateFor(currentUser);
        return;
      }
    } else if (!setup.initialized) {
      setHeading("SYSTEM SETUP", "Create administrator", "Initialize Trippers Coffee before opening the register.");
      showForm($("#setup-form"));
      shell.hidden = false;
      splash.classList.add("is-hidden");
    } else {
      showForm($("#login-form"));
      shell.hidden = false;
      splash.classList.add("is-hidden");
    }
  }

  function setHeading(eyebrow, title, copy) {
    $("#form-eyebrow").textContent = eyebrow;
    $("#form-title").textContent = title;
    $("#form-copy").textContent = copy;
  }

  document.querySelectorAll("[data-role]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedRole = button.dataset.role;
      document.querySelectorAll("[data-role]").forEach((option) => {
        const active = option === button;
        option.classList.toggle("active", active);
        option.setAttribute("aria-pressed", String(active));
      });
    });
  });

  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.togglePassword);
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      button.textContent = visible ? "Hide" : "Show";
      button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    });
  });

  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector("[type=submit]");
    const status = $("#login-message");
    message(status, "");
    submit.disabled = true;
    try {
      const result = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: $("#identifier").value.trim(),
          password: $("#password").value,
          remember: $("#remember").checked
        })
      });
      // The account's real role wins. The toggle is only a convenience and
      // must never turn a successful sign-in into a failed one.
      if (result.user.role !== selectedRole) {
        selectedRole = result.user.role;
        document.querySelectorAll("[data-role]").forEach((option) => {
          const active = option.dataset.role === selectedRole;
          option.classList.toggle("active", active);
          option.setAttribute("aria-pressed", String(active));
        });
      }
      currentUser = result.user;
      if (result.mustChangePassword) {
        setHeading("PASSWORD UPDATE", "Choose a new password", "Your administrator gave you a temporary password.");
        $("#current-password").value = $("#password").value;
        showForm($("#change-password-form"));
      } else {
        navigateFor(result.user);
      }
    } catch (error) {
      message(status, error.message);
    } finally {
      submit.disabled = false;
    }
  });

  $("#change-password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector("[type=submit]");
    const status = $("#change-message");
    message(status, "");
    submit.disabled = true;
    try {
      await request("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: $("#current-password").value,
          newPassword: $("#new-password").value,
          confirmPassword: $("#confirm-password").value
        })
      });
      currentUser.mustChangePassword = false;
      message(status, "Password updated. Opening your workspace…", true);
      window.setTimeout(() => navigateFor(currentUser), 650);
    } catch (error) {
      message(status, error.message);
      submit.disabled = false;
    }
  });

  $("#setup-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector("[type=submit]");
    const status = $("#setup-message");
    message(status, "");
    submit.disabled = true;
    try {
      await request("/api/setup", {
        method: "POST",
        body: JSON.stringify({
          setupToken: $("#setup-token").value.trim(),
          fullName: $("#setup-name").value.trim(),
          username: $("#setup-username").value.trim(),
          email: $("#setup-email").value.trim(),
          shopName: $("#setup-shop").value.trim(),
          password: $("#setup-password").value,
          confirmPassword: $("#setup-confirm").value
        })
      });
      setHeading("SETUP COMPLETE", "Administrator created", "Sign in with the administrator account you just created.");
      showForm($("#login-form"));
      message($("#login-message"), "System initialized. Please sign in.", true);
      $("#identifier").value = $("#setup-username").value.trim();
      $("#setup-form").reset();
    } catch (error) {
      message(status, error.message);
    } finally {
      submit.disabled = false;
    }
  });

  $("#forgot-link").addEventListener("click", () => {
    setHeading("ACCOUNT HELP", "Reset your password", "Send a reset request to the administrator.");
    showForm($("#forgot-form"));
    $("#forgot-identifier").value = $("#identifier").value.trim();
    message($("#forgot-message"), "");
  });

  $("#back-to-login").addEventListener("click", () => {
    setHeading("TEAM ACCESS", "Sign in", "Use the account provided by your administrator.");
    showForm($("#login-form"));
  });

  $("#forgot-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector("[type=submit]");
    submit.disabled = true;
    try {
      const result = await request("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ identifier: $("#forgot-identifier").value.trim() })
      });
      message($("#forgot-message"), result.message, true);
    } catch (error) {
      message($("#forgot-message"), error.message);
    } finally {
      submit.disabled = false;
    }
  });

  $("#signout-change").addEventListener("click", async () => {
    try {
      await request("/api/auth/logout", { method: "POST", body: "{}" });
      window.location.replace("/index.html");
    } catch (error) {
      message($("#change-message"), error.message);
    }
  });

  initialize();
})();
