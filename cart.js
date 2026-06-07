// CART & CATALOG PRESENTATION LOGIC
function renderCart() {
    const cartItemsList = document.getElementById("cartItemsList");
    const cartTotalPrice = document.getElementById("cartTotalPrice");
    const checkoutBtn = document.getElementById("checkoutBtn");
    const selectAllCartCheckbox = document.getElementById("selectAllCartCheckbox");
    const checkedCountText = document.getElementById("checkedCountText");
    const cartChecklistHeader = document.getElementById("cartChecklistHeader");

    if (cart.length === 0) {
        cartItemsList.innerHTML = `
            <div class="cart-empty-state" style="padding: 3rem 1.5rem;">
                <svg fill="none" stroke="currentColor" width="50" height="50" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="color:var(--gray-300); margin-bottom:1rem;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
                </svg>
                <p style="font-weight:700; margin-bottom:0.25rem;">Keranjang Anda Kosong</p>
                <p style="font-size:0.85rem;">Pilih sayuran segar untuk keluarga!</p>
            </div>
        `;
        if (cartChecklistHeader) cartChecklistHeader.style.display = "none";
        cartTotalPrice.innerText = "Rp 0";
        checkoutBtn.disabled = true;
        checkoutBtn.style.opacity = "0.5";
        return;
    }

    if (cartChecklistHeader) cartChecklistHeader.style.display = "flex";
    checkoutBtn.disabled = false;
    checkoutBtn.style.opacity = "1";

    cartItemsList.innerHTML = cart.map(item => `
        <div class="cart-item" style="padding: 0.8rem 1.5rem;">
            <input type="checkbox" class="cart-item-checkbox" ${item.checked ? 'checked' : ''} onchange="toggleItemChecked('${item.cartItemId}')">
            <img src="${item.image}" alt="${item.name}" class="cart-item-img">
            <div class="cart-item-details">
                <h4 class="cart-item-name">${item.name}</h4>
                <span class="cart-item-price">${formatRupiah(item.price)}</span>
                <div class="cart-item-qty">
                    <button class="qty-btn" onclick="updateCartQty('${item.cartItemId}', -1)">-</button>
                    <span class="qty-val">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateCartQty('${item.cartItemId}', 1)">+</button>
                </div>
            </div>
            <button class="remove-item-btn" onclick="removeFromCart('${item.cartItemId}')">
                <svg fill="none" stroke="currentColor" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
            </button>
        </div>
    `).join('');

    const checkedSubtotal = calculateCheckedSubtotal();
    cartTotalPrice.innerText = formatRupiah(checkedSubtotal);

    const allChecked = cart.every(item => item.checked);
    if (selectAllCartCheckbox) selectAllCartCheckbox.checked = allChecked;

    const checkedCount = cart.filter(i => i.checked).length;
    if (checkedCountText) checkedCountText.innerText = `${checkedCount} Terpilih`;

    if (checkedCount === 0) {
        checkoutBtn.disabled = true;
        checkoutBtn.style.opacity = "0.5";
    } else {
        checkoutBtn.disabled = false;
        checkoutBtn.style.opacity = "1";
    }
}

function toggleItemChecked(cartItemId) {
    const item = cart.find(i => i.cartItemId === cartItemId);
    if (item) {
        item.checked = !item.checked;
        updateCartTotals();
        renderCart();
    }
}

function updateCartQty(cartItemId, amount) {
    const item = cart.find(i => i.cartItemId === cartItemId);
    if (!item) return;

    item.quantity += amount;
    if (item.quantity <= 0) {
        removeFromCart(cartItemId);
    } else {
        updateCartTotals();
        renderCart();
    }
}

function removeFromCart(cartItemId) {
    cart = cart.filter(item => item.cartItemId !== cartItemId);
    updateCartTotals();
    renderCart();
}

function calculateCheckedSubtotal() {
    return cart.filter(i => i.checked).reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function updateCartTotals() {
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    const checkedSubtotal = calculateCheckedSubtotal();
    const bottomCartBar = document.getElementById("bottomCartBar");
    const bottomCartPrice = document.getElementById("bottomCartPrice");
    const bottomCartBadge = document.getElementById("bottomCartBadge");

    if (totalQty > 0) {
        if (bottomCartBar) bottomCartBar.classList.add("show");
        if (bottomCartPrice) bottomCartPrice.innerText = formatRupiah(checkedSubtotal);
        if (bottomCartBadge) bottomCartBadge.innerText = `${totalQty} Barang`;
    } else {
        if (bottomCartBar) bottomCartBar.classList.remove("show");
    }
}

function filterProducts(query, category) {
    let filtered = products;
    
    if (category && category !== "semua") {
        filtered = filtered.filter(p => p.category === category);
    }
    
    if (query) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(query) || 
            (p.desc && p.desc.toLowerCase().includes(query))
        );
    }
    
    renderProducts(filtered);
}
