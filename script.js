
// 1. NOSSA LISTA INICIAL DE RESTAURANTES

let restaurants = [];

let ratings = [];

const API_URL = 'https://script.google.com/macros/s/AKfycbyVIEwxyOiyGOI9z1ygKAmKl8aFby4XegtulavxaLpgq9pSrub3vCnHLFxZb1waiIyt1A/exec';
const SENHA_APP = '@m3lh0rGUI4'; // a mesma do Apps Script

async function carregarDados() {
  const res = await fetch(API_URL);
  const dados = await res.json();
  restaurants = dados.lugares;
  ratings = dados.avaliacoes;
}

async function enviarAoSheets(lugar, avaliacao) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      senha: SENHA_APP,
      acao: 'adicionarLugar',
      lugar,
      avaliacao
    })
  });
  const resultado = await res.json();
  if (resultado.erro) throw new Error(resultado.erro);
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

        card.append(category, name, city, price);

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

        address: form.address.value.trim(),
        neighborhood: form.neighborhood.value.trim(),
        maps: form.maps.value.trim(),
        instagram: form.instagram.value.trim(),

        experience: form.experience.value.trim(),

        mainPhoto: "",

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

    restaurants.push(newRestaurant);

    const hasRating = [
        newRating.food,
        newRating.service,
        newRating.ambience,
        newRating.value,
        newRating.overall
    ].some(score => score !== null);

    if (hasRating || newRating.contributor) {
        ratings.push(newRating);
    }

        try {
        await enviarAoSheets(
            newRestaurant,
            (hasRating || newRating.contributor) ? newRating : null
        );
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

    const mainPhoto = document.getElementById("detail-main-photo");

    mainPhoto.replaceChildren();

    const mainPhotoUrl = validUrl(restaurant.mainPhoto || "");

    if (mainPhotoUrl) {

        const image = document.createElement("img");

        image.src = mainPhotoUrl;
        image.alt = `Foto de ${restaurant.name}`;

        mainPhoto.appendChild(image);

    }

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
        rating => rating.restaurantId === restaurantId
    );

    if (restaurantRatings.length === 0) {

        const message = document.createElement("p");
        message.textContent = "Ainda não há avaliações.";
        container.appendChild(message);

        return;

    }

    const criteria = [
        { key: "food", label: "Comida / produtos" },
        { key: "service", label: "Atendimento" },
        { key: "ambience", label: "Ambiente" },
        { key: "value", label: "Custo-benefício" },
        { key: "overall", label: "Experiência geral" }
    ];

    const allScores = [];

    criteria.forEach(criterion => {

        const scores = restaurantRatings
            .map(rating => rating[criterion.key])
            .filter(score => score !== null && score !== undefined);

        if (scores.length === 0) return;

        const average = scores.reduce((sum, score) => sum + score, 0)
            / scores.length;

        allScores.push(...scores);

        const row = document.createElement("div");
        row.className = "detail-rating-row";

        const label = document.createElement("span");
        label.textContent = criterion.label;

        const score = document.createElement("strong");
        score.textContent = average.toFixed(1).replace(".", ",") + " / 5";

        row.append(label, score);
        container.appendChild(row);

    });

    const count = document.createElement("p");
    count.className = "rating-total";
    count.textContent = restaurantRatings.length +
        (restaurantRatings.length === 1
            ? " avaliação registrada"
            : " avaliações registradas");

    container.prepend(count);

    if (allScores.length > 0) {

        const average = allScores.reduce((sum, score) => sum + score, 0)
            / allScores.length;

        const general = document.createElement("div");
        general.className = "detail-rating-average";

        const number = document.createElement("strong");
        number.textContent = average.toFixed(1).replace(".", ",");

        const description = document.createElement("span");
        description.textContent = "Média geral das notas";

        general.append(number, description);
        container.prepend(general);

    }

// Mostra quem indicou

    restaurantRatings.forEach(rating => {

        if (!rating.contributor) return;

        const item = document.createElement("div");
        item.className = "detail-review";

        const name = document.createElement("strong");
        name.textContent = rating.contributor;

        item.appendChild(name);
        container.appendChild(item);

    });

}

    carregarDados().then(renderRestaurants);