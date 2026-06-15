document.addEventListener("DOMContentLoaded", () => {
    // API base configurations
    const API_LOGIN_URL = "/api/login";
    const API_PRODUCTS_URL = "/api/products";
    const API_FEEDBACKS_URL = "/api/feedbacks";
    const API_CREATORS_URL = "/api/creators";

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

    // Creator Creation Form DOM Bindings
    const addCreatorForm = document.getElementById("add-creator-form");
    const creatorFileInput = document.getElementById("creator-photo");
    const creatorFileDragLabel = document.getElementById("creator-file-drag-label");
    const creatorFileLabelText = document.getElementById("creator-file-label-text");
    const creatorUploadPreview = document.getElementById("creator-upload-preview-img");
    const creatorNameInput = document.getElementById("creator-name");
    const creatorRoleInput = document.getElementById("creator-role");
    const creatorBioInput = document.getElementById("creator-bio");
    const creatorInstagramInput = document.getElementById("creator-instagram");
    const creatorGithubInput = document.getElementById("creator-github");
    const creatorLinkedinInput = document.getElementById("creator-linkedin");

    // Listings DOM Bindings
    const productsTbody = document.getElementById("admin-products-tbody");
    const feedbacksList = document.getElementById("admin-feedbacks-list");
    const creatorsTbody = document.getElementById("admin-creators-tbody");

    // Edit Feedback Modal DOM Bindings
    const editFeedbackOverlay = document.getElementById("edit-feedback-overlay");
    const editFeedbackForm = document.getElementById("edit-feedback-form");
    const editFeedbackIdInput = document.getElementById("edit-feedback-id");
    const editFeedbackNameInput = document.getElementById("edit-feedback-name");
    const editFeedbackCommentInput = document.getElementById("edit-feedback-comment");
    const editStarRatingSelector = document.getElementById("edit-star-rating-selector");
    const closeEditModalBtn = document.getElementById("close-edit-modal-btn");
    const editFeedbackDeleteBtn = document.getElementById("edit-delete-btn");

    // Edit Creator Modal DOM Bindings
    const editCreatorOverlay = document.getElementById("edit-creator-overlay");
    const editCreatorForm = document.getElementById("edit-creator-form");
    const editCreatorIdInput = document.getElementById("edit-creator-id");
    const editCreatorNameInput = document.getElementById("edit-creator-name");
    const editCreatorRoleInput = document.getElementById("edit-creator-role");
    const editCreatorBioInput = document.getElementById("edit-creator-bio");
    const editCreatorFileInput = document.getElementById("edit-creator-photo");
    const editCreatorFileDragLabel = document.getElementById("edit-creator-file-drag-label");
    const editCreatorFileLabelText = document.getElementById("edit-creator-file-label-text");
    const editCreatorUploadPreview = document.getElementById("edit-creator-upload-preview-img");
    const editCreatorInstagramInput = document.getElementById("edit-creator-instagram");
    const editCreatorGithubInput = document.getElementById("edit-creator-github");
    const editCreatorLinkedinInput = document.getElementById("edit-creator-linkedin");
    const closeEditCreatorModalBtn = document.getElementById("close-edit-creator-modal-btn");

    // Local Storage & State
    let selectedImageBase64 = "";
    let selectedCreatorImageBase64 = "";
    let selectedEditCreatorImageBase64 = "";
    let currentFeedbacks = [];
    let currentCreators = [];
    let editSelectedRating = 0;

    // App Initialization
    setupFeedbackEditing();
    setupCreatorEditing();
    setupSocialSelectors();
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
        loadAdminCreators();
        setupProductFileUpload();
        setupProductFormSubmission();
        setupCreatorFileUpload();
        setupCreatorFormSubmission();
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
    // READ CREATORS (ADMIN VIEW)
    // =========================================
    async function loadAdminCreators() {
        try {
            const response = await fetch(API_CREATORS_URL);
            if (!response.ok) throw new Error("Erro ao obter lista de creators.");
            
            currentCreators = await response.json();
            renderAdminCreators(currentCreators);
        } catch (error) {
            console.error(error);
            showToast("Erro ao carregar creators.", "error");
        }
    }

    function renderAdminCreators(creators) {
        if (!creators || creators.length === 0) {
            creatorsTbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        <i class="fa-solid fa-users-slash fa-2x" style="margin-bottom: 0.5rem; display: block;"></i>
                        Nenhum creator cadastrado na equipe ainda.
                    </td>
                </tr>
            `;
            return;
        }

        creatorsTbody.innerHTML = creators.map(creator => {
            const photoUrl = creator.photo ? creator.photo : "https://cdn-icons-png.flaticon.com/512/992/992717.png";
            return `
                <tr data-id="${creator.id}">
                    <td>
                        <img src="${photoUrl}" alt="${creator.name}" class="admin-thumb" onerror="this.src='https://cdn-icons-png.flaticon.com/512/992/992717.png'">
                    </td>
                    <td style="font-weight: 600; color: var(--purple-dark);">${escapeHTML(creator.name)}</td>
                    <td style="font-weight: 500;">${escapeHTML(creator.role)}</td>
                    <td style="text-align: center;">
                        <div style="display: flex; justify-content: center; gap: 0.5rem; align-items: center;">
                            <button class="btn-edit-creator" data-id="${creator.id}" style="background: var(--purple-light); color: var(--purple-medium); border: none; padding: 0.5rem; border-radius: 8px; font-size: 1rem; cursor: pointer; transition: var(--transition-smooth);" title="Editar informações do creator">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="btn-delete-creator" data-id="${creator.id}" style="background: none; border: none; color: #E03E3E; font-size: 1rem; cursor: pointer; transition: var(--transition-smooth); padding: 0.5rem; border-radius: 8px;" title="Remover creator da equipe">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        // Setup click event for edit creators
        creatorsTbody.querySelectorAll(".btn-edit-creator").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const creator = currentCreators.find(cr => cr.id === id);
                if (creator) {
                    editCreatorIdInput.value = creator.id;
                    editCreatorNameInput.value = creator.name;
                    editCreatorRoleInput.value = creator.role;
                    editCreatorBioInput.value = creator.bio;
                    editCreatorInstagramInput.value = creator.instagram || "";
                    editCreatorGithubInput.value = creator.github || "";
                    editCreatorLinkedinInput.value = creator.linkedin || "";

                    // Toggle visibility of the social input groups based on if they have value
                    document.getElementById("edit-creator-instagram-group").style.display = creator.instagram ? "block" : "none";
                    document.getElementById("edit-creator-github-group").style.display = creator.github ? "block" : "none";
                    document.getElementById("edit-creator-linkedin-group").style.display = creator.linkedin ? "block" : "none";
                    
                    // Show current image in preview
                    editCreatorUploadPreview.src = creator.photo;
                    editCreatorUploadPreview.style.display = "block";
                    editCreatorFileLabelText.textContent = "Alterar imagem (opcional)";
                    selectedEditCreatorImageBase64 = "";
                    
                    editCreatorOverlay.style.display = "flex";
                }
            });
        });

        // Setup click event for delete creators
        creatorsTbody.querySelectorAll(".btn-delete-creator").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                deleteCreator(id);
            });
        });
    }

    // =========================================
    // FILE UPLOAD PROCESSORS FOR CREATORS
    // =========================================
    function setupCreatorFileUpload() {
        // Form: Add Creator Upload
        creatorFileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) {
                showToast("A imagem do criador excede o limite de 5MB.", "error");
                creatorFileInput.value = "";
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                selectedCreatorImageBase64 = event.target.result;
                creatorUploadPreview.src = selectedCreatorImageBase64;
                creatorUploadPreview.style.display = "block";
                creatorFileLabelText.textContent = file.name;
            };
            reader.readAsDataURL(file);
        });

        // Drag and drop highlights for Creator Add Upload
        ["dragenter", "dragover"].forEach(eventName => {
            creatorFileDragLabel.addEventListener(eventName, (e) => {
                e.preventDefault();
                creatorFileDragLabel.style.borderColor = "var(--purple-medium)";
                creatorFileDragLabel.style.background = "rgba(75, 36, 99, 0.05)";
            }, false);
        });

        ["dragleave", "drop"].forEach(eventName => {
            creatorFileDragLabel.addEventListener(eventName, (e) => {
                e.preventDefault();
                creatorFileDragLabel.style.borderColor = "rgba(75, 36, 99, 0.3)";
                creatorFileDragLabel.style.background = "rgba(255,255,255,0.4)";
            }, false);
        });

        creatorFileDragLabel.addEventListener("drop", (e) => {
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith("image/")) {
                creatorFileInput.files = e.dataTransfer.files;
                const reader = new FileReader();
                reader.onload = (event) => {
                    selectedCreatorImageBase64 = event.target.result;
                    creatorUploadPreview.src = selectedCreatorImageBase64;
                    creatorUploadPreview.style.display = "block";
                    creatorFileLabelText.textContent = file.name;
                };
                reader.readAsDataURL(file);
            }
        });

        // Form: Edit Creator Upload
        editCreatorFileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) {
                showToast("A imagem do criador excede o limite de 5MB.", "error");
                editCreatorFileInput.value = "";
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                selectedEditCreatorImageBase64 = event.target.result;
                editCreatorUploadPreview.src = selectedEditCreatorImageBase64;
                editCreatorUploadPreview.style.display = "block";
                editCreatorFileLabelText.textContent = file.name;
            };
            reader.readAsDataURL(file);
        });

        // Drag and drop highlights for Creator Edit Upload
        ["dragenter", "dragover"].forEach(eventName => {
            editCreatorFileDragLabel.addEventListener(eventName, (e) => {
                e.preventDefault();
                editCreatorFileDragLabel.style.borderColor = "var(--purple-medium)";
                editCreatorFileDragLabel.style.background = "rgba(75, 36, 99, 0.05)";
            }, false);
        });

        ["dragleave", "drop"].forEach(eventName => {
            editCreatorFileDragLabel.addEventListener(eventName, (e) => {
                e.preventDefault();
                editCreatorFileDragLabel.style.borderColor = "rgba(75, 36, 99, 0.3)";
                editCreatorFileDragLabel.style.background = "rgba(255,255,255,0.4)";
            }, false);
        });

        editCreatorFileDragLabel.addEventListener("drop", (e) => {
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith("image/")) {
                editCreatorFileInput.files = e.dataTransfer.files;
                const reader = new FileReader();
                reader.onload = (event) => {
                    selectedEditCreatorImageBase64 = event.target.result;
                    editCreatorUploadPreview.src = selectedEditCreatorImageBase64;
                    editCreatorUploadPreview.style.display = "block";
                    editCreatorFileLabelText.textContent = file.name;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // =========================================
    // WRITE CREATORS (ADD CREATOR SUBMISSION)
    // =========================================
    function setupCreatorFormSubmission() {
        addCreatorForm.onsubmit = async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById("creator-submit-btn");
            const originalBtnHtml = submitBtn.innerHTML;

            if (!selectedCreatorImageBase64) {
                showToast("Por favor, selecione ou arraste uma foto para o creator!", "error");
                return;
            }

            const payload = {
                name: creatorNameInput.value.trim(),
                role: creatorRoleInput.value.trim(),
                bio: creatorBioInput.value.trim(),
                photo: selectedCreatorImageBase64,
                instagram: creatorInstagramInput.value.trim(),
                github: creatorGithubInput.value.trim(),
                linkedin: creatorLinkedinInput.value.trim()
            };

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Cadastrando...`;

                const response = await authenticatedFetch(API_CREATORS_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!response) return;

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Falha ao cadastrar o creator.");
                }

                showToast("Creator cadastrado com sucesso!", "success");
                
                // Reset form states
                addCreatorForm.reset();
                selectedCreatorImageBase64 = "";
                creatorFileLabelText.textContent = "Selecione ou arraste a imagem";
                creatorUploadPreview.style.display = "none";
                creatorUploadPreview.src = "";

                // Hide social input groups
                document.getElementById("creator-instagram-group").style.display = "none";
                document.getElementById("creator-github-group").style.display = "none";
                document.getElementById("creator-linkedin-group").style.display = "none";

                // Reload creators
                loadAdminCreators();
            } catch (error) {
                console.error(error);
                showToast(error.message || "Erro de rede ao adicionar creator.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        };
    }

    // =========================================
    // EDIT & DELETE CREATORS WORKFLOW
    // =========================================
    function setupCreatorEditing() {
        closeEditCreatorModalBtn.addEventListener("click", () => {
            editCreatorOverlay.style.display = "none";
        });

        editCreatorOverlay.addEventListener("click", (e) => {
            if (e.target === editCreatorOverlay) {
                editCreatorOverlay.style.display = "none";
            }
        });

        editCreatorForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const creatorId = editCreatorIdInput.value;
            const submitBtn = document.getElementById("edit-creator-submit-btn");
            const originalBtnHtml = submitBtn.innerHTML;

            const payload = {
                id: creatorId,
                name: editCreatorNameInput.value.trim(),
                role: editCreatorRoleInput.value.trim(),
                bio: editCreatorBioInput.value.trim(),
                photo: selectedEditCreatorImageBase64 || editCreatorUploadPreview.src,
                instagram: editCreatorInstagramInput.value.trim(),
                github: editCreatorGithubInput.value.trim(),
                linkedin: editCreatorLinkedinInput.value.trim()
            };

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando...`;

                const response = await authenticatedFetch(API_CREATORS_URL, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!response) return;

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Falha ao atualizar creator.");
                }

                showToast("Creator atualizado com sucesso!", "success");
                editCreatorOverlay.style.display = "none";
                loadAdminCreators();
            } catch (error) {
                console.error(error);
                showToast(error.message || "Erro de rede ao salvar creator.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        });
    }

    function setupSocialSelectors() {
        const creatorSocialSelect = document.getElementById("creator-social-select");
        const editCreatorSocialSelect = document.getElementById("edit-creator-social-select");

        // Helper to show group
        function handleSocialSelect(selectEl, prefix) {
            selectEl.addEventListener("change", (e) => {
                const social = e.target.value;
                if (!social) return;

                const groupEl = document.getElementById(`${prefix}-${social}-group`);
                if (groupEl) {
                    groupEl.style.display = "block";
                    // Focus the input
                    const inputEl = document.getElementById(`${prefix}-${social}`);
                    if (inputEl) inputEl.focus();
                }
                // Reset select value
                selectEl.value = "";
            });
        }

        if (creatorSocialSelect) handleSocialSelect(creatorSocialSelect, "creator");
        if (editCreatorSocialSelect) handleSocialSelect(editCreatorSocialSelect, "edit-creator");

        // Handle remove buttons
        document.querySelectorAll(".btn-remove-social").forEach(btn => {
            btn.addEventListener("click", () => {
                const type = btn.getAttribute("data-type"); // "creator" or "edit"
                const social = btn.getAttribute("data-social"); // "instagram", "github", "linkedin"

                let inputId = "";
                let groupId = "";

                if (type === "creator") {
                    inputId = `creator-${social}`;
                    groupId = `creator-${social}-group`;
                } else if (type === "edit") {
                    inputId = `edit-creator-${social}`;
                    groupId = `edit-creator-${social}-group`;
                }

                const inputEl = document.getElementById(inputId);
                const groupEl = document.getElementById(groupId);

                if (inputEl) inputEl.value = "";
                if (groupEl) groupEl.style.display = "none";
            });
        });
    }

    async function deleteCreator(creatorId) {
        if (!confirm("Deseja realmente remover este creator da equipe?")) return;

        try {
            const response = await authenticatedFetch(API_CREATORS_URL, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: creatorId })
            });

            if (!response) return;

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Não foi possível excluir o creator.");
            }

            showToast("Creator removido da equipe com sucesso!", "success");
            loadAdminCreators();
        } catch (error) {
            console.error(error);
            showToast(error.message || "Erro ao tentar excluir o creator.", "error");
        }
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
