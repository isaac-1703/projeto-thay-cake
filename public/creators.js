document.addEventListener("DOMContentLoaded", () => {
    const API_CREATORS_URL = "/api/creators";
    const creatorsContainer = document.getElementById("creators-list-container");

    // Initialize loading
    loadCreators();

    async function loadCreators() {
        try {
            let response = await fetch(API_CREATORS_URL);
            if (!response.ok) {
                console.warn("API de criadores indisponível, tentando carregar JSON estático local.");
                response = await fetch("./creators.json");
                if (!response.ok) throw new Error("Erro ao carregar criadores do servidor ou arquivo local");
            }
            
            const creators = await response.json();
            renderCreators(creators);
        } catch (error) {
            console.error(error);
            creatorsContainer.innerHTML = `
                <div class="no-feedbacks" style="grid-column: 1 / -1; max-width: 600px; margin: 0 auto; width: 100%;">
                    <i class="fa-solid fa-circle-exclamation fa-2x" style="color: #E03E3E; margin-bottom: 1rem;"></i>
                    <p>Oops! Não foi possível carregar as biografias dos criadores no momento. Tente novamente mais tarde.</p>
                </div>
            `;
        }
    }

    function renderCreators(creators) {
        if (!creators || creators.length === 0) {
            creatorsContainer.innerHTML = `
                <div class="no-feedbacks" style="grid-column: 1 / -1; max-width: 600px; margin: 0 auto; width: 100%;">
                    <i class="fa-solid fa-users-slash fa-2x" style="color: var(--brown-medium); margin-bottom: 1rem;"></i>
                    <p>Nenhum criador cadastrado no momento. Volte mais tarde!</p>
                </div>
            `;
            return;
        }

        creatorsContainer.innerHTML = creators.map(creator => {
            const photoUrl = creator.photo ? creator.photo : "https://cdn-icons-png.flaticon.com/512/992/992717.png";
            
            // Build social media links conditionally
            let socialsHtml = "";
            if (creator.instagram && creator.instagram.trim() !== "") {
                const url = creator.instagram.startsWith("http") ? creator.instagram : `https://instagram.com/${creator.instagram.replace('@', '')}`;
                socialsHtml += `<a href="${url}" target="_blank" rel="noopener noreferrer" class="creator-social-link" title="Instagram"><i class="fa-brands fa-instagram"></i></a>`;
            }
            if (creator.github && creator.github.trim() !== "") {
                const url = creator.github.startsWith("http") ? creator.github : `https://github.com/${creator.github}`;
                socialsHtml += `<a href="${url}" target="_blank" rel="noopener noreferrer" class="creator-social-link" title="GitHub"><i class="fa-brands fa-github"></i></a>`;
            }
            if (creator.linkedin && creator.linkedin.trim() !== "") {
                const url = creator.linkedin.startsWith("http") ? creator.linkedin : `https://linkedin.com/in/${creator.linkedin}`;
                socialsHtml += `<a href="${url}" target="_blank" rel="noopener noreferrer" class="creator-social-link" title="LinkedIn"><i class="fa-brands fa-linkedin"></i></a>`;
            }

            return `
                <div class="creator-card">
                    <div class="creator-photo-wrapper">
                        <img src="${photoUrl}" alt="${escapeHTML(creator.name)}" class="creator-photo" onerror="this.src='https://cdn-icons-png.flaticon.com/512/992/992717.png'">
                    </div>
                    <div class="creator-info">
                        <h4 class="creator-name">${escapeHTML(creator.name)}</h4>
                        <span class="creator-role">${escapeHTML(creator.role)}</span>
                    </div>
                    <p class="creator-bio">${escapeHTML(creator.bio)}</p>
                    ${socialsHtml !== "" ? `<div class="creator-socials">${socialsHtml}</div>` : ""}
                </div>
            `;
        }).join("");
    }

    // Security HTML Escaper
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
