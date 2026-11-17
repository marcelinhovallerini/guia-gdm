// 1. NOSSA LISTA INICIAL DE RESTAURANTES

let restaurants = [];

let ratings = [];

const API_URL = 'https://script.google.com/macros/s/AKfycbyVIEwxyOiyGOI9z1ygKAmKl8aFby4XegtulavxaLpgq9pSrub3vCnHLFxZb1waiIyt1A/exec';
const SENHA_APP = '@m3lh0rGUI4'; // a mesma do Apps Script

async function carregarDados() {
    try {
        console.log("Iniciando carregamento dos restaurantes...");

        const res = await fetch(API_URL);

        console.log("Resposta da API:", res.status);

        if (!res.ok) {
            throw new Error("Erro HTTP: " + res.status);
        }

        const dados = await res.json();

        console.log("Dados recebidos:", dados);

        if (!dados.lugares || !dados.avaliacoes) {
            throw new Error("A API não retornou os dados esperados.");
        }

        restaurants = dados.lugares.map(lugar => {
            let photos = lugar.photos || [];

            // Compatibilidade com registros antigos que ainda não têm galeria.
            if (typeof photos === "string") {
                try {
                    photos = JSON.parse(photos);
                } catch {
                    photos = [];
                }
            }

            if (!Array.isArray(photos)) {
                photos = [];
            }

            // Se o lugar antigo só tiver mainPhoto, ela será a primeira foto.
            if (photos.length === 0 && lugar.mainPhoto) {
                photos = [lugar.mainPhoto];
            }

            return {
                ...lugar,
                photos,
                mainPhoto: lugar.mainPhoto || photos[0] || ""
            };
        });

        ratings = dados.avaliacoes;

        console.log("Restaurantes carregados:", restaurants.length);

    } catch (erro) {
        console.error("Erro ao carregar dados:", erro);

        alert(
            "Não foi possível carregar os restaurantes. " +
            "Verifique sua conexão com o banco de dados."
        );
    }
}


// Converte uma imagem em base64.
function prepararImagem(arquivo) {
    return new Promise((resolve, reject) => {
        const tiposPermitidos = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        const tamanhoMaximo = 4 * 1024 * 1024; // 4 MB por foto

        if (!tiposPermitidos.includes(arquivo.type)) {
            reject(new Error(
                `A imagem "${arquivo.name}" não é JPG, PNG ou WEBP.`
            ));
            return;
        }

        if (arquivo.size > tamanhoMaximo) {
            reject(new Error(
                `A imagem "${arquivo.name}" ultrapassa 4 MB.`
            ));
            return;
        }

        const leitor = new FileReader();

        leitor.onload = () => {
            const base64 = String(leitor.result).split(",")[1];

            resolve({
                nome: arquivo.name,
                mimeType: arquivo.type,
                base64
            });
        };

        leitor.onerror = () => {
            reject(new Error(
                `Não foi possível ler a imagem "${arquivo.name}".`
            ));
        };

        leitor.readAsDataURL(arquivo);
    });
}


// Prepara todas as imagens selecionadas.
async function prepararImagens(arquivos) {
    return Promise.all(
        Array.from(arquivos).map(arquivo => prepararImagem(arquivo))
    );
}


// Envia o estabelecimento, a avaliação e todas as imagens.
async function enviarAoSheets(lugar, avaliacao, imagens = []) {
    const res = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
            senha: SENHA_APP,
            acao: "adicionarLugar",
            lugar,
            avaliacao,
            imagens
        })
    });

    const resultado = await res.json();

    if (!res.ok || resultado.erro || resultado.ok === false) {
        throw new Error(resultado.erro || "Erro ao salvar o estabelecimento.");
    }

    lugar.photos = Array.isArray(resultado.photos)
        ? resultado.photos
        : [];

    lugar.mainPhoto = resultado.mainPhoto || lugar.photos[0] || "";
}

async function enviarAcao(dados) {
    const res = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
            senha: SENHA_APP,
            ...dados
        })
    });

    const resultado = await res.json();

    if (!res.ok || resultado.erro || resultado.ok === false) {
        throw new Error(
            resultado.erro || "Não foi possível executar a operação."
        );
    }

    return resultado;
}

// Envia ações ao Google Apps Script.
async function enviarAcao(dados) {
    const res = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
            senha: SENHA_APP,
            ...dados
        })
    });

    const resultado = await res.json();

    if (!res.ok || resultado.erro || resultado.ok === false) {
        throw new Error(
            resultado.erro || "Não foi possível executar a operação."
        );
    }

    return resultado;
}


// Define uma foto como principal.
async function definirFotoPrincipal(restaurant, photoUrl) {
    const resposta = await enviarAcao({
        acao: "definirFotoPrincipal",
        restaurantId: restaurant.id,
        photoUrl: photoUrl
    });

    restaurant.mainPhoto = resposta.mainPhoto || photoUrl;

    renderRestaurants();
    renderDetailGallery(restaurant);
}


// Adiciona fotos a um estabelecimento existente.
async function adicionarFotosAoSheets(restaurant, imagens) {
    const resposta = await enviarAcao({
        acao: "adicionarFotos",
        restaurantId: restaurant.id,
        imagens: imagens
    });

    restaurant.photos = resposta.photos || restaurant.photos;
    restaurant.mainPhoto = resposta.mainPhoto || restaurant.mainPhoto;

    renderRestaurants();
    renderDetailGallery(restaurant);
}

// Controle da foto selecionada na galeria
let selectedPhotoUrl = "";

function renderDetailGallery(restaurant) {
    const gallery = document.getElementById("detail-gallery");
    const mainPhoto = document.getElementById("detail-main-photo");
    const thumbnails = document.getElementById("detail-photo-thumbnails");

    mainPhoto.replaceChildren();
    thumbnails.replaceChildren();

    gallery.querySelector(".set-main-photo")?.remove();
    gallery.querySelector(".add-photos-control")?.remove();

    selectedPhotoUrl = "";

    let photos = Array.isArray(restaurant.photos)
        ? restaurant.photos
        : [];

    photos = [
        ...new Set(
            photos.map(photo => validUrl(photo)).filter(Boolean)
        )
    ];

    const currentMain =
        validUrl(restaurant.mainPhoto) || photos[0] || "";

    if (currentMain && !photos.includes(currentMain)) {
        photos.unshift(currentMain);
    }

    restaurant.photos = photos;

    if (!currentMain) {
        mainPhoto.textContent = "Foto não disponível";
        mainPhoto.classList.add("no-photo");
    } else {
        mainPhoto.classList.remove("no-photo");

        const mainImage = document.createElement("img");
        mainImage.src = currentMain;
        mainImage.alt = `Foto principal de ${restaurant.name}`;

        mainPhoto.appendChild(mainImage);
    }

    // Exibe as demais fotos.
    const otherPhotos = photos.filter(
        photo => photo !== currentMain
    );

    otherPhotos.forEach((photoUrl, index) => {
        const item = document.createElement("div");
        item.className = "detail-photo-item";

        const image = document.createElement("img");
        image.src = photoUrl;
        image.alt = `Selecionar foto ${index + 1} de ${restaurant.name}`;
        image.loading = "lazy";
        image.tabIndex = 0;
        image.setAttribute("role", "button");

        function selectPhoto() {
            selectedPhotoUrl = photoUrl;

            thumbnails.querySelectorAll(".detail-photo-item")
                .forEach(element => {
                    element.classList.remove("selected");
                });

            item.classList.add("selected");

            confirmButton.disabled = false;
            confirmButton.textContent = "Definir como principal";
        }

        image.addEventListener("click", selectPhoto);

        image.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectPhoto();
            }
        });

        item.appendChild(image);
        thumbnails.appendChild(item);
    });

    // Botão para definir a foto principal.
    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "set-main-photo";
    confirmButton.textContent = "Selecione uma foto";
    confirmButton.disabled = true;

    confirmButton.addEventListener("click", async () => {
        if (!selectedPhotoUrl) return;

        confirmButton.disabled = true;
        confirmButton.textContent = "Salvando...";

        try {
            await definirFotoPrincipal(
                restaurant,
                selectedPhotoUrl
            );
        } catch (erro) {
            alert(erro.message);
            confirmButton.disabled = false;
            confirmButton.textContent = "Definir como principal";
        }
    });

    gallery.appendChild(confirmButton);

    // ÁREA PARA ADICIONAR NOVAS FOTOS.
    const addControl = document.createElement("div");
    addControl.className = "add-photos-control";

    const remaining = Math.max(
        0,
        10 - photos.length
    );

    const description = document.createElement("p");
    description.className = "add-photos-description";

    if (remaining > 0) {
        description.textContent =
            `Você pode adicionar mais ${remaining} ${
                remaining === 1 ? "foto" : "fotos"
            }.`;
    } else {
        description.textContent =
            "Este estabelecimento já atingiu o limite de 10 fotos.";
    }

    addControl.appendChild(description);

    if (remaining > 0) {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/jpeg,image/png,image/webp";
        fileInput.multiple = true;
        fileInput.className = "add-photos-input";
        fileInput.hidden = true;

        const addButton = document.createElement("button");
        addButton.type = "button";
        addButton.className = "add-photos-button";
        addButton.textContent = "+ Adicionar fotos";

        addButton.addEventListener("click", () => {
            fileInput.click();
        });

        fileInput.addEventListener("change", async () => {
            const arquivos = Array.from(fileInput.files || []);

            if (arquivos.length === 0) return;

            if (arquivos.length > remaining) {
                alert(
                    `Você pode adicionar no máximo mais ${remaining} ${
                        remaining === 1 ? "foto" : "fotos"
                    }.`
                );

                fileInput.value = "";
                return;
            }

            addButton.disabled = true;
            addButton.textContent = "Preparando fotos...";

            try {
                const imagens = await prepararImagens(arquivos);

                addButton.textContent = "Enviando fotos...";

                await adicionarFotosAoSheets(
                    restaurant,
                    imagens
                );

            } catch (erro) {
                alert("Não foi possível adicionar as fotos: " + erro.message);

                addButton.disabled = false;
                addButton.textContent = "+ Adicionar fotos";
            }
        });

        addControl.append(fileInput, addButton);
    }

    gallery.appendChild(addControl);
}


// 2. ELEMENTOS DA PÁGINA

const restaurantList = document.getElementById("restaurant-list");
const searchInput = document.getElementById("search");
const filters = document.getElementById("filters");
const totalCount = document.getElementById("total-count");
const emptyState = document.getElementById("empty-state");

const modal = document.getElementById("modal");
const openFormButton = document.getElementById("open-form");
const closeFormButton = document.getElementById("close-form");
const restaurantForm = document.getElementById("restaurant-form");

// 3. FILTRO ATUAL

let selectedCategory = "Todos";

// 4. MOSTRAR RESTAURANTES NA TELA

function renderRestaurants() {

    const searchTerm = searchInput.value.toLowerCase().trim();

    const filteredRestaurants = restaurants.filter(restaurant => {

        const matchesSearch =
            restaurant.name.toLowerCase().includes(searchTerm) ||
            restaurant.city.toLowerCase().includes(searchTerm);

        const matchesCategory =
            selectedCategory === "Todos" ||
            restaurant.category === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    restaurantList.replaceChildren();

    totalCount.textContent =
        `${filteredRestaurants.length} ${filteredRestaurants.length === 1 ? "lugar" : "lugares"}`;

    emptyState.hidden = filteredRestaurants.length !== 0;

    filteredRestaurants.forEach(restaurant => {

        const card = document.createElement("article");
        card.className = "restaurant-card";

        
        // FOTO DO ESTABELECIMENTO
        const photo = document.createElement("div");
        photo.className = "card-photo";

        const photoUrl = validUrl(restaurant.mainPhoto || "");

        if (photoUrl) {
            const image = document.createElement("img");
            image.src = photoUrl;
            image.alt = `Foto de ${restaurant.name}`;
            image.loading = "lazy";
            photo.appendChild(image);
        } else {
            photo.classList.add("no-photo");
            photo.textContent = "Foto não disponível";
        }

        // INFORMAÇÕES
        const info = document.createElement("div");
        info.className = "card-info";

        const category = document.createElement("span");
        category.className = "card-category";
        category.textContent = restaurant.category;

        const name = document.createElement("h3");
        name.textContent = restaurant.name;

        const city = document.createElement("p");
        city.className = "card-city";
        city.textContent = restaurant.city;

        const price = document.createElement("div");
        price.className = "card-price";
        price.textContent = restaurant.price;

        // MÉDIA DAS AVALIAÇÕES
        const averageElement = document.createElement("div");
        averageElement.className = "card-average";

        const restaurantRatings = ratings.filter(
            rating => rating.restaurantId === restaurant.id
        );

        const criteria = ["food", "service", "ambience", "value", "overall"];

        const scores = restaurantRatings.flatMap(rating =>
            criteria
                .map(key => rating[key])
                .filter(score =>
                    score !== null &&
                    score !== undefined &&
                    score !== "" &&
                    Number.isFinite(Number(score))
                )
                .map(Number)
        );

        if (scores.length > 0) {
            const average = scores.reduce((sum, score) => sum + score, 0)
                / scores.length;

            averageElement.innerHTML = `
                <span class="card-star">★</span>
                <strong>${average.toFixed(2).replace(".", ",")}</strong>
                <span>/ 5</span>
            `;
        } else {
            averageElement.textContent = "Sem avaliações";
        }

        info.append(category, name, city, price, averageElement);
        card.append(photo, info);


        restaurantList.appendChild(card);
    });
}

// CONTROLES DE AVALIAÇÃO SOBRE AS ESTRELAS

    document.querySelectorAll("[data-rating-control]").forEach(control => {

        const slider = control.querySelector('input[type="range"]');
        const stars = control.querySelector(".rating-stars");
        const value = control.querySelector(".rating-value");

        stars.replaceChildren();

        // Cria as cinco estrelas
        for (let i = 0; i < 5; i++) {

            const star = document.createElement("span");
            star.className = "rating-star";
            star.textContent = "★";

            const fill = document.createElement("span");
            fill.className = "rating-star-fill";
            fill.textContent = "★";

            star.appendChild(fill);
            stars.appendChild(star);
        }

        function updateRating() {

            const score = Number(slider.value);

            slider.dataset.touched = "true";

            const individualStars =
                stars.querySelectorAll(".rating-star-fill");

            individualStars.forEach((star, index) => {

                const fraction = Math.max(
                    0,
                    Math.min(1, score - index)
                );

                const margem = 7;
                const areaVisivel = 86;

                const recorteDireito =
                    100 - margem - (fraction * areaVisivel);

                star.style.clipPath =
                    `inset(0 ${recorteDireito}% 0 ${margem}%)`;

            });

            value.textContent =
                score.toFixed(1).replace(".", ",") + " / 5";
        }

        slider.addEventListener("input", updateRating);

        updateRating();

    });



// 5. PESQUISA

searchInput.addEventListener("input", renderRestaurants);

// 6. FILTROS DE CATEGORIA

filters.addEventListener("click", event => {

    const button = event.target.closest(".filter");

    if (!button) return;

    selectedCategory = button.dataset.category;

    document.querySelectorAll(".filter").forEach(filter => {
        filter.classList.remove("active");
    });

    button.classList.add("active");

    renderRestaurants();
});

// 7. ABRIR E FECHAR O FORMULÁRIO

openFormButton.addEventListener("click", () => {
    modal.hidden = false;
    document.getElementById("name").focus();
});

closeFormButton.addEventListener("click", closeModal);

function closeModal() {
    modal.hidden = true;
}

modal.addEventListener("click", event => {
    if (event.target === modal) {
        closeModal();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeModal();
    }
});


function gerarLinkMaps(nome, cidade, estado) {
    const pesquisa = `${nome}, ${cidade}, ${estado}`;

    return "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(pesquisa);
}

// 8. CADASTRAR UM NOVO ESTABELECIMENTO E SUA AVALIAÇÃO

restaurantForm.addEventListener("submit", async event => {

    event.preventDefault();

    const form = restaurantForm.elements;

    const restaurantId = crypto.randomUUID();

    const newRestaurant = {

        id: restaurantId,

        name: form.name.value.trim(),
        city: form.city.value.trim(),
        state: form.state.value.trim().toUpperCase(),

        category: form.category.value,
        cuisine: form.cuisine.value.trim(),
        price: form.price.value,

        maps: gerarLinkMaps(form.name.value.trim(), form.city.value.trim(), form.state.value.trim().toUpperCase()),
        instagram: form.instagram.value.trim(),

        experience: form.experience.value.trim(),

        mainPhoto: "",
        photos: [],

        createdAt: new Date().toISOString()

    };

    // Captura as notas preenchidas

    const newRating = {

        id: crypto.randomUUID(),
        restaurantId: restaurantId,

        contributor: form.contributor.value.trim(),

        food: form.ratingFood.dataset.touched
            ? Number(form.ratingFood.value) : null,

        service: form.ratingService.dataset.touched
            ? Number(form.ratingService.value) : null,

        ambience: form.ratingAmbience.dataset.touched
            ? Number(form.ratingAmbience.value) : null,

        value: form.ratingValue.dataset.touched
            ? Number(form.ratingValue.value) : null,

        overall: form.ratingOverall.dataset.touched
            ? Number(form.ratingOverall.value) : null,

        createdAt: new Date().toISOString()

    };

    const hasRating = [
        newRating.food,
        newRating.service,
        newRating.ambience,
        newRating.value,
        newRating.overall
    ].some(score => score !== null);

    const campoFotos = restaurantForm.querySelector("#photos");

    const arquivosSelecionados = campoFotos && campoFotos.files
        ? campoFotos.files
        : [];
    
    if (arquivosSelecionados.length > 10) {
    alert("Você pode selecionar no máximo 10 fotos por estabelecimento.");
    return;
    }

    try {
        const imagens = await prepararImagens(arquivosSelecionados);

        await enviarAoSheets(
            newRestaurant,
            (hasRating || newRating.contributor) ? newRating : null,
            imagens
        );

        // Só adiciona à tela depois de confirmar o salvamento.
        restaurants.push(newRestaurant);

        if (hasRating || newRating.contributor) {
            ratings.push(newRating);
        }

        renderRestaurants();

    } catch (erro) {
        alert("Não foi possível salvar: " + erro.message);
        return;
    }


    restaurantForm.reset();

    // Limpa o estado dos controles deslizantes

    document.querySelectorAll("[data-rating-control]").forEach(control => {

        const slider = control.querySelector('input[type="range"]');
        const stars = control.querySelector(".rating-stars");
        const value = control.querySelector(".rating-value");

        delete slider.dataset.touched;

        stars.style.backgroundImage = "";
        value.textContent = "Não avaliado";

    });

    closeModal();

    selectedCategory = "Todos";
    searchInput.value = "";

    document.querySelectorAll(".filter").forEach(filter => {

        filter.classList.toggle(
            "active",
            filter.dataset.category === "Todos"
        );

    });

});



// 9. ELEMENTOS DA FICHA INDIVIDUAL

const detailModal = document.getElementById("detail-modal");

const closeDetailButton = document.getElementById("close-detail");

const backToListButton = document.getElementById("back-to-list");


// 10. FUNÇÕES AUXILIARES

function validUrl(value) {
    try {
        const url = new URL(value);

        if (url.protocol === "http:" || url.protocol === "https:") {
            return url.href;
        }

        return "";
    } catch {
        return "";
    }
}

function setDetailText(id, value) {
    document.getElementById(id).textContent =
        value || "Não informado";
}

function setDetailLink(id, value, label, hideIfEmpty = true) {

    const element = document.getElementById(id);
    const url = validUrl(value);

    if (!url) {
        element.hidden = true;
        element.removeAttribute("href");
        return;
    }

    element.href = url;
    element.textContent = label;
    element.hidden = false;
}


// 11. ABRIR A FICHA DO ESTABELECIMENTO

restaurantList.addEventListener("click", event => {

    const card = event.target.closest(".restaurant-card");

    if (!card) return;

    const index = Array.from(restaurantList.children).indexOf(card);

    const searchTerm = searchInput.value.toLowerCase().trim();

    const filteredRestaurants = restaurants.filter(restaurant => {

        const matchesSearch =
            restaurant.name.toLowerCase().includes(searchTerm) ||
            restaurant.city.toLowerCase().includes(searchTerm);

        const matchesCategory =
            selectedCategory === "Todos" ||
            restaurant.category === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    const restaurant = filteredRestaurants[index];

    if (!restaurant) return;

    // IDENTIFICAÇÃO

    setDetailText("detail-category", restaurant.category);

    setDetailText("detail-name", restaurant.name);

    setDetailText(
        "detail-city",
        `${restaurant.city}${restaurant.state ? " - " + restaurant.state : ""}`
    );

    setDetailText("detail-cuisine", restaurant.cuisine);

    setDetailText("detail-price", restaurant.price);

    // EXPERIÊNCIA GASTRONÔMICA

    setDetailText(
        "detail-experience",
        restaurant.experience || restaurant.description
    );

    // LOCALIZAÇÃO

    const address = [
        restaurant.address,
        restaurant.neighborhood
    ].filter(Boolean).join(" - ");

    setDetailText("detail-address", address);

    // GOOGLE MAPS

    setDetailLink(
        "detail-maps",
        restaurant.maps,
        "Abrir no Google Maps ↗"
    );

    // INSTAGRAM

    let instagramUrl = restaurant.instagram || "";

    if (instagramUrl && !instagramUrl.startsWith("http")) {
        instagramUrl = "https://www.instagram.com/" +
            instagramUrl.replace(/^@/, "");
    }

    setDetailLink(
        "detail-instagram",
        instagramUrl,
        "Visitar Instagram ↗"
    );

    // FOTO PRINCIPAL

    renderDetailGallery(restaurant);

    // AVALIAÇÕES DOS AMIGOS

    renderRatings(restaurant.id);

    // ABRIR FICHA

    detailModal.hidden = false;

});


// 12. FECHAR A FICHA

function closeDetail() {
    detailModal.hidden = true;
}

closeDetailButton.addEventListener("click", closeDetail);

backToListButton.addEventListener("click", closeDetail);

detailModal.addEventListener("click", event => {

    if (event.target === detailModal) {
        closeDetail();
    }
});


// 9. INICIAR O APLICATIVO

renderRestaurants();


// EXIBIR AS AVALIAÇÕES NA FICHA

function renderRatings(restaurantId) {
    const container = document.getElementById("detail-ratings");
    container.replaceChildren();

    const restaurantRatings = ratings.filter(
        rating => String(rating.restaurantId) === String(restaurantId)
    );

    const criteria = [
        { key: "food", label: "Comida / produtos" },
        { key: "service", label: "Atendimento" },
        { key: "ambience", label: "Ambiente" },
        { key: "value", label: "Custo-benefício" },
        { key: "overall", label: "Experiência geral" }
    ];

    // MÉDIAS GERAIS
    if (restaurantRatings.length > 0) {
        const allScores = [];

        criteria.forEach(criterion => {
            const scores = restaurantRatings
                .map(rating => rating[criterion.key])
                .filter(score =>
                    score !== null &&
                    score !== undefined &&
                    score !== "" &&
                    Number.isFinite(Number(score))
                )
                .map(Number);

            if (scores.length === 0) return;

            allScores.push(...scores);

            const average = scores.reduce((sum, score) => sum + score, 0)
                / scores.length;

            const row = document.createElement("div");
            row.className = "detail-rating-row";

            const label = document.createElement("span");
            label.textContent = criterion.label;

            const score = document.createElement("strong");
            score.textContent = average.toFixed(2).replace(".", ",") + " / 5";

            row.append(label, score);
            container.appendChild(row);
        });

        if (allScores.length > 0) {
            const average = allScores.reduce((sum, score) => sum + score, 0)
                / allScores.length;

            const general = document.createElement("div");
            general.className = "detail-rating-average";

            const number = document.createElement("strong");
            number.textContent = average.toFixed(2).replace(".", ",");

            const description = document.createElement("span");
            description.textContent = "Média geral das notas";

            general.append(number, description);
            container.prepend(general);
        }
    }

    // HISTÓRICO DE AVALIAÇÕES
    const historyTitle = document.createElement("h3");
    historyTitle.className = "reviews-history-title";
    historyTitle.textContent =
        `Avaliações da comunidade (${restaurantRatings.length})`;

    container.appendChild(historyTitle);

    if (restaurantRatings.length === 0) {
        const message = document.createElement("p");
        message.textContent = "Ainda não há avaliações. Seja o primeiro a avaliar!";
        container.appendChild(message);
    }

    const orderedRatings = [...restaurantRatings].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    orderedRatings.forEach(rating => {
        const item = document.createElement("article");
        item.className = "detail-review";

        const header = document.createElement("div");
        header.className = "review-header";

        const name = document.createElement("strong");
        name.textContent = rating.contributor || "Visitante";

        const date = document.createElement("span");

        if (rating.createdAt) {
            const parsedDate = new Date(rating.createdAt);

            date.textContent = Number.isNaN(parsedDate.getTime())
                ? ""
                : parsedDate.toLocaleDateString("pt-BR");
        }

        header.append(name, date);
        item.appendChild(header);

        const notes = document.createElement("div");
        notes.className = "review-individual-notes";

        criteria.forEach(criterion => {
            const value = rating[criterion.key];

            if (
                value === null ||
                value === undefined ||
                value === ""
            ) return;

            const note = document.createElement("span");
            note.textContent =
                `${criterion.label}: ${Number(value).toFixed(1).replace(".", ",")}`;

            notes.appendChild(note);
        });

        item.appendChild(notes);

        if (rating.comment) {
            const comment = document.createElement("p");
            comment.className = "review-comment";
            comment.textContent = rating.comment;
            item.appendChild(comment);
        }

        container.appendChild(item);
    });

    // FORMULÁRIO PARA UMA NOVA AVALIAÇÃO
    const form = document.createElement("form");
    form.className = "new-review-form";

    const formTitle = document.createElement("h3");
    formTitle.textContent = "Compartilhe sua experiência";

    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Seu nome";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.name = "contributor";
    nameInput.placeholder = "Como gostaria de ser identificado?";
    nameInput.maxLength = 80;
    nameInput.required = true;

    nameLabel.appendChild(nameInput);
    form.appendChild(formTitle);
    form.appendChild(nameLabel);

    const ratingInputs = {};

    // Cria as cinco avaliações por estrelas.
    criteria.forEach(criterion => {
        const control = document.createElement("div");
        control.className = "new-review-rating";

        const label = document.createElement("label");
        label.textContent = criterion.label;

        const starsArea = document.createElement("div");
        starsArea.className = "new-review-stars-area";

        const stars = document.createElement("span");
        stars.className = "new-review-stars";
        stars.textContent = "★★★★★";

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "5";
        slider.step = "0.5";
        slider.value = "0";
        slider.setAttribute("aria-label", criterion.label);

        const score = document.createElement("span");
        score.className = "new-review-score";
        score.textContent = "Não avaliado";

        slider.addEventListener("input", () => {
            const value = Number(slider.value);

            slider.dataset.touched = "true";

            stars.style.backgroundImage =
                `linear-gradient(90deg, var(--wine) ${value * 20}%, var(--border) ${value * 20}%)`;

            score.textContent =
                value.toFixed(1).replace(".", ",") + " / 5";
        });

        starsArea.append(stars, slider);
        control.append(label, starsArea, score);
        form.appendChild(control);

        ratingInputs[criterion.key] = slider;
    });

    const commentLabel = document.createElement("label");
    commentLabel.textContent = "Seu comentário";

    const commentInput = document.createElement("textarea");
    commentInput.name = "comment";
    commentInput.placeholder =
        "Conte como foi sua experiência neste lugar...";
    commentInput.maxLength = 2000;
    commentInput.rows = 4;

    commentLabel.appendChild(commentInput);
    form.appendChild(commentLabel);

    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.className = "submit-review-button";
    submitButton.textContent = "Enviar avaliação";

    form.appendChild(submitButton);

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const contributor = nameInput.value.trim();
        const comment = commentInput.value.trim();

        const avaliacao = {
            restaurantId,
            contributor,
            comment
        };

        let temNota = false;

        criteria.forEach(criterion => {
            const slider = ratingInputs[criterion.key];

            if (slider.dataset.touched === "true") {
                avaliacao[criterion.key] = Number(slider.value);
                temNota = true;
            } else {
                avaliacao[criterion.key] = null;
            }
        });

        if (!temNota) {
            alert("Selecione pelo menos uma nota.");
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Enviando...";

        try {
            const resposta = await enviarAcao({
                acao: "adicionarAvaliacao",
                avaliacao
            });

            ratings.push(resposta.avaliacao);

            renderRatings(restaurantId);
        } catch (erro) {
            alert("Não foi possível enviar sua avaliação: " + erro.message);

            submitButton.disabled = false;
            submitButton.textContent = "Enviar avaliação";
        }
    });

    container.appendChild(form);
}

    carregarDados().then(renderRestaurants);
