document.addEventListener("DOMContentLoaded", () => {
    // API base configurations
    const API_LOGIN_URL = "/api/login";
    const API_PRODUCTS_URL = "/api/products";
    const API_FEEDBACKS_URL = "/api/feedbacks";

    // Authentication DOM Bindings
    const loginOverlay = document.getElementById("admin-login-overlay");
    const dashboardPanel = document.getElementById("admin-dashboard-panel");
    const loginForm = document.getElementById("admin-login-form");
    const logoutBtn = document.getElementById("admin-logout-btn");
    const toastContainer = document.getElementById("toast-container-root");

    // Product Creation Form DOM Bindings
    const addProductForm = document.getElementById("add-product-form");
    const fileInput = document.getElementById("product-photo");
    const fileDragLabel = document.getElementById("file-drag-label");
    const fileLabelText = document.getElementById("file-label-text");
    const uploadPreview = document.getElementById("upload-preview-img");

    // Listings DOM Bindings
    const productsTbody = document.getElementById("admin-products-tbody");
    const feedbacksList = document.getElementById("admin-feedbacks-list");

    // Edit Feedback Modal DOM Bindings
    const editFeedbackOverlay = document.getElementById("edit-feedback-overlay");
    const editFeedbackForm = document.getElementById("edit-feedback-form");
    const editFeedbackIdInput = document.getElementById("edit-feedback-id");
    const editFeedbackNameInput = document.getElementById("edit-feedback-name");
    const editFeedbackCommentInput = document.getElementById("edit-feedback-comment");
    const editStarRatingSelector = document.getElementById("edit-star-rating-selector");
    const closeEditModalBtn = document.getElementById("close-edit-modal-btn");
    const editFeedbackDeleteBtn = document.getElementById("edit-delete-btn");

    // Local Storage & State
    let selectedImageBase64 = "";
    let currentFeedbacks = [];
    let editSelectedRating = 0;

    // App Initialization
    setupFeedbackEditing();
    checkAuthentication();

    // =========================================
    // JWT SECURITY & AUTHENTICATION WORKFLOW
    // =========================================
    function getAuthToken() {
        return localStorage.getItem("admin_token");
    }

    function setAuthToken(token) {
        localStorage.setItem("admin_token", token);
    }

    function clearAuthToken() {
        localStorage.removeItem("admin_token");
    }

    function checkAuthentication() {
        const token = getAuthToken();
        if (!token) {
            // Show login popup, hide panel
            loginOverlay.style.display = "flex";
            dashboardPanel.style.display = "none";
            setupLoginForm();
        } else {
            // Authorized view
            loginOverlay.style.display = "none";
            dashboardPanel.style.display = "flex";
            loadDashboardData();
        }
    }

    function setupLoginForm() {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            
            const usernameInput = document.getElementById("login-username");
            const passwordInput = document.getElementById("login-password");
            const submitBtn = document.getElementById("login-submit-btn");
            const originalBtnHtml = submitBtn.innerHTML;

            const payload = {
                username: usernameInput.value.trim(),
                password: passwordInput.value.trim()
            };

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Autenticando...`;

                const response = await fetch(API_LOGIN_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Acesso negado. Usuário ou senha incorretos.");
                }

                // Authentication Success
                setAuthToken(data.token);
                showToast("Login efetuado com sucesso! Bem-vindo.", "success");
                
                // Transition to Dashboard
                loginOverlay.style.display = "none";
                dashboardPanel.style.display = "flex";
                
                // Clear login inputs
                loginForm.reset();
                
                // Load admin data
                loadDashboardData();
            } catch (error) {
                console.error(error);
                showToast(error.message || "Erro de conexão ao tentar fazer login.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        };
    }

    // Setup Logout Button
    logoutBtn.addEventListener("click", () => {
        clearAuthToken();
        showToast("Você saiu do painel administrativo.", "info");
        setTimeout(() => {
            window.location.reload();
        }, 800);
    });

    // =========================================
    // DASHBOARD DATA LOADERS & API WRAPPERS
    // =========================================
    function loadDashboardData() {
        loadAdminProducts();
        loadAdminFeedbacks();
        setupProductFileUpload();
        setupProductFormSubmission();
    }

    async function authenticatedFetch(url, options = {}) {
        const token = getAuthToken();
        if (!token) {
            forceLogout();
            return null;
        }

        // Inject Bearer Token
        options.headers = {
            ...options.headers,
            "Authorization": `Bearer ${token}`
        };

        try {
            const response = await fetch(url, options);
            if (response.status === 401) {
                showToast("Sua sessão expirou. Faça login novamente.", "error");
                forceLogout();
                return null;
            }
            return response;
        } catch (error) {
            console.error(error);
            showToast("Erro na requisição. Verifique o servidor.", "error");
            return null;
        }
    }

    function forceLogout() {
        clearAuthToken();
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    }

    // =========================================
    // READ PRODUCTS (ADMIN VIEW)
    // =========================================
    async function loadAdminProducts() {
        try {
            const response = await fetch(API_PRODUCTS_URL);
            if (!response.ok) throw new Error("Erro ao carregar lista de produtos.");
            
            const products = await response.json();
            renderAdminProducts(products);
        } catch (error) {
            console.error(error);
            showToast("Erro ao obter produtos.", "error");
        }
    }

    function renderAdminProducts(products) {
        if (!products || products.length === 0) {
            productsTbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        <i class="fa-solid fa-cookie-bite fa-2x" style="margin-bottom: 0.5rem; display: block;"></i>
                        Nenhum produto cadastrado na vitrine ainda.
                    </td>
                </tr>
            `;
            return;
        }

        productsTbody.innerHTML = products.map(product => {
            const formattedPrice = product.price.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL"
            });

            return `
                <tr data-id="${product.id}">
                    <td>
                        <img src="${product.photo}" alt="${product.name}" class="admin-thumb" onerror="this.src='https://cdn-icons-png.flaticon.com/512/992/992717.png'">
                    </td>
                    <td style="font-weight: 600; color: var(--purple-dark);">${escapeHTML(product.name)}</td>
                    <td style="font-weight: 500;">${formattedPrice}</td>
                    <td style="text-align: center;">
                        <button class="btn-delete" data-id="${product.id}" title="Excluir produto da vitrine">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        // Setup delete events
        productsTbody.querySelectorAll(".btn-delete").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                deleteProduct(id);
            });
        });
    }

    // DELETE PRODUCT
    async function deleteProduct(productId) {
        if (!confirm("Deseja realmente remover este produto da vitrine?")) return;

        try {
            const response = await authenticatedFetch(API_PRODUCTS_URL, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: productId })
            });

            if (!response) return;

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Não foi possível excluir o produto.");
            }

            showToast("Produto removido com sucesso!", "success");
            loadAdminProducts();
        } catch (error) {
            console.error(error);
            showToast(error.message || "Erro ao tentar excluir o produto.", "error");
        }
    }

    // =========================================
    // FILE UPLOAD PROCESSOR & BASE64 DECODER
    // =========================================
    function setupProductFileUpload() {
        // Preview change listener
        fileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) {
                showToast("A imagem excede o limite de 5MB.", "error");
                fileInput.value = "";
                return;
            }

            processFile(file);
        });

        // Drag and drop highlights
        ["dragenter", "dragover"].forEach(eventName => {
            fileDragLabel.addEventListener(eventName, (e) => {
                e.preventDefault();
                fileDragLabel.style.borderColor = "var(--purple-medium)";
                fileDragLabel.style.background = "rgba(75, 36, 99, 0.05)";
            }, false);
        });

        ["dragleave", "drop"].forEach(eventName => {
            fileDragLabel.addEventListener(eventName, (e) => {
                e.preventDefault();
                fileDragLabel.style.borderColor = "rgba(75, 36, 99, 0.3)";
                fileDragLabel.style.background = "rgba(255,255,255,0.4)";
            }, false);
        });

        fileDragLabel.addEventListener("drop", (e) => {
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith("image/")) {
                fileInput.files = e.dataTransfer.files;
                processFile(file);
            }
        });

        function processFile(file) {
            fileLabelText.textContent = file.name;
            
            // Read file into Base64
            const reader = new FileReader();
            reader.onload = (event) => {
                selectedImageBase64 = event.target.result;
                uploadPreview.src = selectedImageBase64;
                uploadPreview.style.display = "block";
            };
            reader.readAsDataURL(file);
        }
    }

    // =========================================
    // WRITE PRODUCTS (PRODUCT SUBMISSION)
    // =========================================
    function setupProductFormSubmission() {
        addProductForm.onsubmit = async (e) => {
            e.preventDefault();

            const nameInput = document.getElementById("product-name");
            const priceInput = document.getElementById("product-price");
            const submitBtn = document.getElementById("product-submit-btn");
            const originalBtnHtml = submitBtn.innerHTML;

            if (!selectedImageBase64) {
                showToast("Escolha ou arraste uma foto para o produto!", "error");
                return;
            }

            const payload = {
                name: nameInput.value.trim(),
                price: parseFloat(priceInput.value),
                photo: selectedImageBase64
            };

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Cadastrando...`;

                const response = await authenticatedFetch(API_PRODUCTS_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!response) return;

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Falha ao cadastrar o bolo.");
                }

                // Successful product creation
                showToast("Bolo cadastrado com sucesso na vitrine!", "success");
                
                // Reset form states
                addProductForm.reset();
                selectedImageBase64 = "";
                fileLabelText.textContent = "Selecione ou arraste a imagem";
                uploadPreview.style.display = "none";
                uploadPreview.src = "";

                // Reload product listings
                loadAdminProducts();
            } catch (error) {
                console.error(error);
                showToast(error.message || "Erro de rede ao adicionar bolo.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        };
    }

    // =========================================
    // READ FEEDBACKS (ADMIN VIEW)
    // =========================================
    async function loadAdminFeedbacks() {
        try {
            const response = await fetch(API_FEEDBACKS_URL);
            if (!response.ok) throw new Error("Erro ao obter feedbacks.");
            
            currentFeedbacks = await response.json();
            renderAdminFeedbacks(currentFeedbacks);
        } catch (error) {
            console.error(error);
        }
    }

    function renderAdminFeedbacks(feedbacks) {
        if (!feedbacks || feedbacks.length === 0) {
            feedbacksList.innerHTML = `
                <div class="no-feedbacks">
                    <p>Nenhum feedback dos clientes cadastrado ainda.</p>
                </div>
            `;
            return;
        }

        feedbacksList.innerHTML = feedbacks.map(feedback => {
            let starsHtml = "";
            for (let i = 1; i <= 5; i++) {
                starsHtml += i <= feedback.rating 
                    ? `<i class="fa-solid fa-star"></i>` 
                    : `<i class="fa-regular fa-star" style="opacity: 0.3;"></i>`;
            }

            const feedbackDate = feedback.created_at 
                ? new Date(feedback.created_at * 1000).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })
                : "Recente";

            return `
                <div class="feedback-item" style="padding: 1.2rem; gap: 0.5rem; background: rgba(255,255,255,0.4);">
                    <div class="feedback-header">
                        <span class="feedback-author" style="font-size: 1rem;">${escapeHTML(feedback.name)}</span>
                        <div class="feedback-stars" style="font-size: 0.9rem;">
                            ${starsHtml}
                        </div>
                    </div>
                    <p class="feedback-comment" style="font-size: 0.9rem; line-height: 1.4;">${escapeHTML(feedback.comment)}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                        <span class="feedback-date" style="font-size: 0.75rem;">${feedbackDate}</span>
                        <button class="btn-edit-feedback" data-id="${feedback.id}" style="background: var(--purple-light); color: var(--purple-medium); border: none; padding: 0.3rem 0.8rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.3rem; transition: var(--transition-smooth);">
                            <i class="fa-solid fa-pen-to-square"></i> Editar
                        </button>
                    </div>
                </div>
            `;
        }).join("");

        // Setup edit events
        feedbacksList.querySelectorAll(".btn-edit-feedback").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const feedback = currentFeedbacks.find(fb => fb.id === id);
                if (feedback) {
                    editFeedbackIdInput.value = feedback.id;
                    editFeedbackNameInput.value = feedback.name;
                    editFeedbackCommentInput.value = feedback.comment;
                    editSelectedRating = feedback.rating;
                    setSelectedEditStars(editSelectedRating);
                    
                    editFeedbackOverlay.style.display = "flex";
                }
            });
        });
    }

    // =========================================
    // EDIT FEEDBACK WORKFLOW (ADMIN PANEL)
    // =========================================
    function setupFeedbackEditing() {
        setupEditStarsRating();

        closeEditModalBtn.addEventListener("click", () => {
            editFeedbackOverlay.style.display = "none";
        });

        editFeedbackOverlay.addEventListener("click", (e) => {
            if (e.target === editFeedbackOverlay) {
                editFeedbackOverlay.style.display = "none";
            }
        });

        editFeedbackForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const feedbackId = editFeedbackIdInput.value;
            const name = editFeedbackNameInput.value.trim();
            const comment = editFeedbackCommentInput.value.trim();

            if (editSelectedRating === 0) {
                showToast("Por favor, selecione uma nota de estrelas para a avaliação!", "error");
                return;
            }

            const payload = {
                id: feedbackId,
                name: name,
                rating: editSelectedRating,
                comment: comment
            };

            const submitBtn = document.getElementById("edit-submit-btn");
            const originalBtnHtml = submitBtn.innerHTML;

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...`;

                const response = await authenticatedFetch(API_FEEDBACKS_URL, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!response) return;

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Falha ao atualizar feedback.");
                }

                showToast("Feedback atualizado com sucesso!", "success");
                editFeedbackOverlay.style.display = "none";
                loadAdminFeedbacks();
            } catch (error) {
                console.error(error);
                showToast(error.message || "Erro de rede ao salvar feedback.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        });

        editFeedbackDeleteBtn.addEventListener("click", async () => {
            const feedbackId = editFeedbackIdInput.value;
            if (!feedbackId) return;

            if (!confirm("Deseja realmente excluir esta avaliação definitivamente?")) return;

            const originalBtnHtml = editFeedbackDeleteBtn.innerHTML;

            try {
                editFeedbackDeleteBtn.disabled = true;
                editFeedbackDeleteBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Excluindo...`;

                const response = await authenticatedFetch(API_FEEDBACKS_URL, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: feedbackId })
                });

                if (!response) return;

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Falha ao excluir feedback.");
                }

                showToast("Avaliação excluída com sucesso!", "success");
                editFeedbackOverlay.style.display = "none";
                loadAdminFeedbacks();
            } catch (error) {
                console.error(error);
                showToast(error.message || "Erro de rede ao excluir avaliação.", "error");
            } finally {
                editFeedbackDeleteBtn.disabled = false;
                editFeedbackDeleteBtn.innerHTML = originalBtnHtml;
            }
        });
    }

    function setupEditStarsRating() {
        const stars = Array.from(editStarRatingSelector.querySelectorAll(".star-option"));

        stars.forEach((star, index) => {
            star.addEventListener("mouseover", () => {
                highlightEditStarsUpTo(index);
            });

            star.addEventListener("mouseleave", () => {
                resetEditStarsHighlight();
            });

            star.addEventListener("click", () => {
                editSelectedRating = index + 1;
                setSelectedEditStars(editSelectedRating);
            });

            star.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    editSelectedRating = index + 1;
                    setSelectedEditStars(editSelectedRating);
                }
            });
        });

        function highlightEditStarsUpTo(index) {
            stars.forEach((s, idx) => {
                if (idx <= index) {
                    s.classList.add("hovered");
                } else {
                    s.classList.remove("hovered");
                }
            });
        }

        function resetEditStarsHighlight() {
            stars.forEach(s => s.classList.remove("hovered"));
        }
    }

    function setSelectedEditStars(rating) {
        const stars = Array.from(editStarRatingSelector.querySelectorAll(".star-option"));
        stars.forEach((s, idx) => {
            if (idx < rating) {
                s.classList.add("active");
                s.setAttribute("aria-checked", "true");
            } else {
                s.classList.remove("active");
                s.setAttribute("aria-checked", "false");
            }
        });
    }

    // =========================================
    // SYSTEM TOAST NOTIFICATIONS
    // =========================================
    function showToast(message, type = "info") {
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        
        let iconHtml = '<i class="fa-solid fa-circle-info"></i>';
        if (type === "success") iconHtml = '<i class="fa-solid fa-circle-check"></i>';
        if (type === "error") iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>';

        toast.innerHTML = `${iconHtml} <span>${message}</span>`;
        toastContainer.appendChild(toast);

        // Slide away and delete element after 4.5 seconds
        setTimeout(() => {
            toast.style.animation = "slideInRight 0.4s reverse cubic-bezier(0.16, 1, 0.3, 1)";
            toast.style.opacity = "0";
            setTimeout(() => {
                toast.remove();
            }, 400);
        }, 4500);
    }

    // =========================================
    // SECURITY ESCAPE HELPER
    // =========================================
    function escapeHTML(str) {
        if (!str) return "";
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
});
