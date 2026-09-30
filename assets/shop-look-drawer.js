/**
 * Web Component: ShopLookDrawer
 * Manages side-drawer hydration, opening/closing, accessibility,
 * and AJAX quick-add for Shop The Look editorial sections.
 */
class ShopLookDrawer extends HTMLElement {
  constructor() {
    super();
    this.backdrop = null;
    this.drawer = null;
    this.titleEl = null;
    this.closeBtn = null;
    this.featureImg = null;
    this.stackCtaBtn = null;
    this.productsList = null;
    this.currentLookData = null;
    this.#onKeyUp = this.#onKeyUp.bind(this);
  }

  connectedCallback() {
    this.ensureBackdrop();
  }

  ensureBackdrop() {
    if (this.backdrop && document.body.contains(this.backdrop)) {
      return;
    }

    let backdrop = this.querySelector('.shop-look-drawer-backdrop') || document.querySelector('.shop-look-drawer-backdrop');

    if (backdrop) {
      if (backdrop.parentElement !== document.body) {
        document.body.appendChild(backdrop);
      }
      this.backdrop = backdrop;
      this.bindBackdropElements();
    }
  }

  bindBackdropElements() {
    if (!this.backdrop) return;

    this.drawer = this.backdrop.querySelector('.shop-look-drawer');
    this.titleEl = this.backdrop.querySelector('.shop-look-drawer__title');
    this.closeBtn = this.backdrop.querySelector('.shop-look-drawer__close-btn');
    this.featureImg = this.backdrop.querySelector('.shop-look-drawer__feature-img');
    this.stackCtaBtn = this.backdrop.querySelector('.shop-look-drawer__stack-cta-btn');
    this.productsList = this.backdrop.querySelector('.shop-look-drawer__products-list');

    // Close button event
    if (this.closeBtn && !this.closeBtn.dataset.bound) {
      this.closeBtn.dataset.bound = 'true';
      this.closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.close();
      });
    }

    // Backdrop overlay click event
    if (this.backdrop && !this.backdrop.dataset.bound) {
      this.backdrop.dataset.bound = 'true';
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) {
          this.close();
        }
      });
    }

    // Batch Add Stack CTA Button
    if (this.stackCtaBtn && !this.stackCtaBtn.dataset.bound) {
      this.stackCtaBtn.dataset.bound = 'true';
      this.stackCtaBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.addWholeStack();
      });
    }

    // Product list quick add click delegation
    if (this.productsList && !this.productsList.dataset.bound) {
      this.productsList.dataset.bound = 'true';
      this.productsList.addEventListener('click', (e) => {
        const quickAddBtn = e.target.closest('[data-action="quick-add"]');
        if (quickAddBtn) {
          e.preventDefault();
          const variantId = quickAddBtn.dataset.variantId;
          if (variantId) {
            this.addSingleItem(variantId, quickAddBtn);
          }
        }
      });
    }
  }

  openWithCard(cardElement) {
    this.ensureBackdrop();

    const jsonScript = cardElement.querySelector('script[type="application/json"]');
    if (!jsonScript) {
      console.warn('No look JSON script payload found inside card element:', cardElement);
      return;
    }

    try {
      const data = JSON.parse(jsonScript.textContent);
      this.renderLook(data);
      this.open();
    } catch (err) {
      console.error('Failed to parse look data JSON:', err, jsonScript.textContent);
    }
  }

  renderLook(data) {
    this.currentLookData = data;

    // Render Title
    if (this.titleEl) {
      this.titleEl.textContent = data.title || 'SHOP THE EDIT';
    }

    // Render Feature Image
    if (this.featureImg) {
      if (data.image) {
        this.featureImg.src = data.image;
        this.featureImg.alt = data.title || 'Look Feature';
        this.featureImg.style.display = 'block';
      } else {
        this.featureImg.style.display = 'none';
      }
    }

    // Reset Stack CTA Button
    if (this.stackCtaBtn) {
      this.stackCtaBtn.textContent = data.subtitle || 'SHOP THE WHOLE STACK.';
      this.stackCtaBtn.disabled = false;
    }

    // Render Products List
    if (this.productsList) {
      this.productsList.innerHTML = '';

      if (data.products && data.products.length > 0) {
        data.products.forEach((product) => {
          const row = document.createElement('div');
          row.className = 'shop-look-drawer__product-row';

          const thumbHtml = `
            <div class="shop-look-drawer__thumb-wrapper">
              <img src="${product.image || ''}" alt="${this.escapeHtml(product.title)}" class="shop-look-drawer__thumb-img" loading="lazy" />
              ${
                product.available && product.variant_id
                  ? `<button type="button" class="shop-look-drawer__quick-add-btn" data-action="quick-add" data-variant-id="${product.variant_id}" aria-label="Add ${this.escapeHtml(product.title)} to bag">+</button>`
                  : ''
              }
            </div>
          `;

          const infoHtml = `
            <div class="shop-look-drawer__product-info">
              <a href="${product.url || '#'}" class="shop-look-drawer__product-title">${this.escapeHtml(product.title)}</a>
              ${product.specs ? `<p class="shop-look-drawer__product-specs">${this.escapeHtml(product.specs)}</p>` : ''}
              ${product.category ? `<span class="shop-look-drawer__product-cat">${this.escapeHtml(product.category)}</span>` : ''}
              <div class="shop-look-drawer__product-price">${product.price || ''}</div>
            </div>
          `;

          row.innerHTML = thumbHtml + infoHtml;
          this.productsList.appendChild(row);
        });
      } else {
        this.productsList.innerHTML = '<p style="padding: 24px; text-align: center; color: #777;">No tagged products in this look yet.</p>';
      }
    }
  }

  open() {
    this.ensureBackdrop();

    if (this.backdrop) {
      this.backdrop.setAttribute('open', '');
    }
    document.body.classList.add('overflow-hidden');
    window.addEventListener('keyup', this.#onKeyUp);
  }

  close() {
    if (this.backdrop) {
      this.backdrop.removeAttribute('open');
    }
    document.body.classList.remove('overflow-hidden');
    window.removeEventListener('keyup', this.#onKeyUp);
  }

  #onKeyUp(event) {
    if (event.key === 'Escape') {
      this.close();
    }
  }

  async addSingleItem(variantId, btnElement) {
    if (!variantId) return;

    btnElement.classList.add('is-loading');
    btnElement.textContent = '...';

    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          items: [{ id: Number(variantId), quantity: 1 }]
        })
      });

      if (!response.ok) throw new Error('Add to cart failed');

      btnElement.classList.remove('is-loading');
      btnElement.textContent = '✓';
      btnElement.style.backgroundColor = '#121212';
      btnElement.style.color = '#ffffff';

      this.dispatchCartEvents();
    } catch (error) {
      console.error('Error adding single item:', error);
      btnElement.classList.remove('is-loading');
      btnElement.textContent = '!';
    }
  }

  async addWholeStack() {
    if (!this.currentLookData || !this.currentLookData.products) return;

    const validItems = this.currentLookData.products
      .filter((p) => p.available && p.variant_id)
      .map((p) => ({ id: Number(p.variant_id), quantity: 1 }));

    if (validItems.length === 0) return;

    if (this.stackCtaBtn) {
      this.stackCtaBtn.disabled = true;
      this.stackCtaBtn.textContent = 'ADDING STACK...';
    }

    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ items: validItems })
      });

      if (!response.ok) throw new Error('Add whole stack failed');

      if (this.stackCtaBtn) {
        this.stackCtaBtn.textContent = 'STACK ADDED TO BAG ✓';
      }

      this.dispatchCartEvents();
    } catch (error) {
      console.error('Error adding whole stack:', error);
      if (this.stackCtaBtn) {
        this.stackCtaBtn.disabled = false;
        this.stackCtaBtn.textContent = 'RETRY ADDING STACK';
      }
    }
  }

  dispatchCartEvents() {
    document.dispatchEvent(new CustomEvent('cart:update', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
    
    const cartDrawer = document.querySelector('cart-drawer, theme-drawer#cart-drawer');
    if (cartDrawer && typeof cartDrawer.open === 'function') {
      setTimeout(() => cartDrawer.open(), 300);
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

if (!customElements.get('shop-look-drawer')) {
  customElements.define('shop-look-drawer', ShopLookDrawer);
}

// Global click event listener for look card triggers (runs independently of component lifecycle)
document.addEventListener('click', (e) => {
  const card = e.target.closest('[data-shop-look-trigger]');
  if (!card) return;

  e.preventDefault();

  let drawerComponent = document.querySelector('shop-look-drawer');
  if (!drawerComponent) {
    drawerComponent = document.createElement('shop-look-drawer');
    document.body.appendChild(drawerComponent);
  }

  if (drawerComponent && typeof drawerComponent.openWithCard === 'function') {
    drawerComponent.openWithCard(card);
  }
});
