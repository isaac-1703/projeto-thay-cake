document.addEventListener("DOMContentLoaded", () => {
    // API base configurations
    const API_PRODUCTS_URL = "/api/products";
    const API_FEEDBACKS_URL = "/api/feedbacks";
    const WHATSAPP_PHONE = "5589988194690";

    // Element bindings
    const vitrineContainer = document.getElementById("vitrine-products-container");
    const feedbacksContainer = document.getElementById("feedbacks-list-container");
    const feedbackForm = document.getElementById("add-feedback-form");
    const starSelector = document.getElementById("star-rating-selector");
    const toastContainer = document.getElementById("toast-container-root");

    // Local states
    let selectedRating = 0;

    // Initialize application
    init();

    function init() {
        loadProducts();
        loadFeedbacks();
        setupStarsRating();
        setupFeedbackSubmission();
    }

    // =========================================
    // DYNAMIC PRODUCTS VITRINE LOADER
    // =========================================
    async function loadProducts() {
        try {
            let response = await fetch(API_PRODUCTS_URL);
            if (!response.ok) {
                console.warn("API de produtos indisponível, tentando carregar JSON estático local.");
                response = await fetch("./products.json");
                if (!response.ok) throw new Error("Erro ao carregar produtos do servidor ou arquivo local");
            }
            
            const products = await response.json();
            renderProducts(products);
            startHeroAnimation(products);
        } catch (error) {
            console.error(error);
            vitrineContainer.innerHTML = `
                <div class="no-feedbacks" style="width: 100%; max-width: 600px; margin: 0 auto;">
                    <i class="fa-solid fa-circle-exclamation fa-2x" style="color: #E03E3E; margin-bottom: 1rem;"></i>
                    <p>Oops! Não foi possível carregar nossos bolos de pote no momento. Tente novamente mais tarde.</p>
                </div>
            `;
            showToast("Erro ao carregar produtos. Recarregue a página.", "error");
        }
    }

    function renderProducts(products) {
        if (!products || products.length === 0) {
            vitrineContainer.innerHTML = `
                <div class="no-feedbacks" style="width: 100%; max-width: 600px; margin: 0 auto;">
                    <i class="fa-solid fa-cookie fa-2x" style="color: var(--brown-medium); margin-bottom: 1rem;"></i>
                    <p>Em breve teremos bolos de pote novinhos na nossa vitrine! Fique ligado.</p>
                </div>
            `;
            return;
        }

        const cardsHtml = products.map(product => createProductCardHtml(product)).join("");
        vitrineContainer.innerHTML = cardsHtml;
    }

    function startHeroAnimation(products) {
        if (!products || products.length === 0) return;

        const row1 = document.getElementById("row-l2r-1");
        const row2 = document.getElementById("row-r2l-2");
        const row3 = document.getElementById("row-l2r-3");

        if (!row1 || !row2 || !row3) return;

        // Setup spawner intervals for a row showcasing products sequentially.
        // A cake only spawns when the previous one has completely left the screen.
        function startSpawner(rowElement, direction, initialDelay = 0) {
            let localIndex = 0;
            
            function spawnNext() {
                const product = products[localIndex];
                localIndex = (localIndex + 1) % products.length;

                // Slow floating durations (15s to 22s)
                const duration = Math.random() * 7 + 15; 
                const verticalOffset = Math.random() * 30 + 5; // vertical placement within bounds

                // Create cake animation item element
                const item = document.createElement("div");
                
                // Styled entirely using Tailwind CSS classes!
                item.className = `absolute w-[75px] h-[75px] rounded-full bg-cover bg-center border-[3.5px] border-white shadow-md pointer-events-none will-change-transform animate-slide-${direction}`;
                item.style.backgroundImage = `url('${product.photo}')`;

                // Inject the dynamic animation duration variable
                item.style.setProperty('--anim-duration', `${duration}s`);
                item.style.top = `${verticalOffset}px`;

                rowElement.appendChild(item);

                // Listen for animationend event to schedule the next cake spawn only after the current one leaves the screen
                item.addEventListener("animationend", () => {
                    item.remove();
                    
                    // Schedule next spawn with a small random gap (2s to 5s)
                    const randomGap = Math.random() * 3000 + 2000;
                    setTimeout(spawnNext, randomGap);
                });
            }

            // Start the first spawn after the initial delay
            setTimeout(spawnNext, initialDelay);
        }

        // Start spawners for all 3 rows with staggered start offsets (slow, gentle flow)
        startSpawner(row1, "l2r", 0);
        startSpawner(row2, "r2l", 4000);
        startSpawner(row3, "l2r", 8000);
    }

    function createProductCardHtml(product) {
        // Format price to Brazilian Real format
        const formattedPrice = product.price.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });

        // Safe check for photo path
        const photoUrl = product.photo.startsWith("http") ? product.photo : product.photo;

        // Message to send to WhatsApp
        const whatsappText = encodeURIComponent(
            `Olá! Gostaria de encomendar o delicioso Bolo de Pote: *${product.name}* (${formattedPrice}).`
        );
        const whatsappUrl = `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${whatsappText}`;

        return `
            <div class="product-card" data-id="${product.id}">
                <div class="product-img-wrapper">
                    <img src="${photoUrl}" alt="${product.name}" class="product-img" loading="lazy">
                    <span class="product-badge">Novidade ✨</span>
                </div>
                <div class="product-details">
                    <h4 class="product-title">${product.name}</h4>
                    <p class="product-price">${formattedPrice}</p>
                </div>
                <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-buy" aria-label="Comprar ${product.name} via WhatsApp">
                    Comprar agora
                </a>
            </div>
        `;
    }

    // =========================================
    // DYNAMIC FEEDBACKS LOADER
    // =========================================
    async function loadFeedbacks() {
        try {
            let response = await fetch(API_FEEDBACKS_URL);
            if (!response.ok) {
                console.warn("API de avaliações indisponível, tentando carregar JSON estático local.");
                response = await fetch("./feedbacks.json");
                if (!response.ok) throw new Error("Erro ao carregar avaliações do servidor ou arquivo local");
            }
            
            const feedbacks = await response.json();
            renderFeedbacks(feedbacks);
        } catch (error) {
            console.error(error);
            feedbacksContainer.innerHTML = `
                <div class="no-feedbacks">
                    <i class="fa-solid fa-circle-exclamation" style="color: #E03E3E; margin-bottom: 0.5rem;"></i>
                    <p>Não foi possível carregar as avaliações no momento.</p>
                </div>
            `;
        }
    }

    function renderFeedbacks(feedbacks) {
        if (!feedbacks || feedbacks.length === 0) {
            feedbacksContainer.innerHTML = `
                <div class="no-feedbacks">
                    <i class="fa-solid fa-comments" style="font-size: 1.5rem; color: var(--purple-medium); margin-bottom: 0.5rem;"></i>
                    <p>Seja o primeiro a avaliar! Deixe sua opinião ao lado.</p>
                </div>
            `;
            return;
        }

        feedbacksContainer.innerHTML = feedbacks.map(feedback => {
            // Render beautiful stars string
            let starsHtml = "";
            for (let i = 1; i <= 5; i++) {
                if (i <= feedback.rating) {
                    starsHtml += `<i class="fa-solid fa-star"></i>`;
                } else {
                    starsHtml += `<i class="fa-regular fa-star" style="opacity: 0.3;"></i>`;
                }
            }

            // Format date beautifully
            const feedbackDate = feedback.created_at 
                ? new Date(feedback.created_at * 1000).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })
                : "Recentemente";

            return `
                <div class="feedback-item">
                    <div class="feedback-header">
                        <span class="feedback-author">${escapeHTML(feedback.name)}</span>
                        <div class="feedback-stars" aria-label="Nota: ${feedback.rating} estrelas">
                            ${starsHtml}
                        </div>
                    </div>
                    <p class="feedback-comment">${escapeHTML(feedback.comment)}</p>
                    <span class="feedback-date">${feedbackDate}</span>
                </div>
            `;
        }).join("");
    }

    // =========================================
    // STAR RATING SELECTOR INTERACTION
    // =========================================
    function setupStarsRating() {
        const stars = Array.from(starSelector.querySelectorAll(".star-option"));

        stars.forEach((star, index) => {
            // Hover effect
            star.addEventListener("mouseover", () => {
                highlightStarsUpTo(index);
            });

            // Mouse leave effect (reset to selected state)
            star.addEventListener("mouseleave", () => {
                resetStarsHighlight();
            });

            // Click selection
            star.addEventListener("click", () => {
                selectedRating = index + 1;
                setSelectedStars(selectedRating);
            });

            // Keyboard accessibility
            star.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectedRating = index + 1;
                    setSelectedStars(selectedRating);
                }
            });
        });

        function highlightStarsUpTo(index) {
            stars.forEach((s, idx) => {
                if (idx <= index) {
                    s.classList.add("hovered");
                } else {
                    s.classList.remove("hovered");
                }
            });
        }

        function resetStarsHighlight() {
            stars.forEach(s => s.classList.remove("hovered"));
        }

        function setSelectedStars(rating) {
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
    }

    // =========================================
    // FEEDBACK SUBMISSION
    // =========================================
    function setupFeedbackSubmission() {
        feedbackForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const nameInput = document.getElementById("feedback-name");
            const commentInput = document.getElementById("feedback-comment");

            if (selectedRating === 0) {
                showToast("Por favor, selecione uma nota de estrelas para a sua avaliação!", "error");
                return;
            }

            const payload = {
                name: nameInput.value.trim(),
                rating: selectedRating,
                comment: commentInput.value.trim()
            };

            const submitBtn = document.getElementById("submit-feedback-btn");
            const originalBtnHtml = submitBtn.innerHTML;

            try {
                // Disable button and show loading state
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...`;

                const response = await fetch(API_FEEDBACKS_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    if (response.status === 404 || response.status === 405) {
                        throw new Error("Gravação indisponível no modo de demonstração estático (GitHub Pages).");
                    }
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.error || "Falha ao enviar feedback.");
                }

                // Success
                showToast("Avaliação enviada com sucesso! Obrigado ❤️", "success");
                
                // Reset form values
                feedbackForm.reset();
                selectedRating = 0;
                // Reset stars state
                Array.from(starSelector.querySelectorAll(".star-option")).forEach(s => {
                    s.classList.remove("active");
                    s.setAttribute("aria-checked", "false");
                });

                // Reload feedbacks list
                loadFeedbacks();
            } catch (error) {
                console.error(error);
                showToast(error.message || "Erro de rede ao enviar avaliação.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        });
    }

    // =========================================
    // PREMIUM SYSTEM TOAST MESSAGES
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
