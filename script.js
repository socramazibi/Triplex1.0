const DRAWS = [
  { number: 1, time: "10:00" },
  { number: 2, time: "12:00" },
  { number: 3, time: "14:00" },
  { number: 4, time: "17:00" },
  { number: 5, time: "21:15" }
];

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

const dateInput = document.getElementById("dateInput");
const resultsEl = document.getElementById("results");
const statusEl = document.getElementById("status");
const refreshBtn = document.getElementById("refreshBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const todayBtn = document.getElementById("todayBtn");

function pad(n) {
  return String(n).padStart(2, "0");
}

function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseInputDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value) {
  return parseInputDate(value).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function drawDateTime(dateValue, time) {
  const date = parseInputDate(dateValue);
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function renderCards(values, selectedDate) {
  const now = new Date();
  const isToday = selectedDate === localDateString();

  resultsEl.innerHTML = DRAWS.map((draw, index) => {
    const value = values[index] || null;
    const drawTime = drawDateTime(selectedDate, draw.time);
    const selected = parseInputDate(selectedDate);
    const todayDate = parseInputDate(localDateString());
    const isFutureDay = selected > todayDate;
    const isPastDay = selected < todayDate;
    const isPast = now >= drawTime;
    const isNext = isToday && !value && now < drawTime;

    let badge = "";
    if (value) {
      badge = `<span class="badge">Resultado publicado</span>`;
    } else if (isFutureDay) {
      badge = `<span class="badge">Día no celebrado</span>`;
    } else if (isNext) {
      badge = `<span class="badge">Sorteo no celebrado</span>`;
    } else if (isPastDay || isPast) {
      badge = `<span class="badge">Pendiente de publicación</span>`;
    } else {
      badge = `<span class="badge">Pendiente</span>`;
    }

    return `
      <article class="card ${value ? "done" : ""} ${isNext ? "next" : ""}">
        <div class="card-info">
          <p class="draw-title">Sorteo ${draw.number}</p>
          <p class="draw-time">${draw.time} h</p>
          ${badge}
        </div>
        <div class="card-number ${value ? "" : "pending"}">
          ${value || "Pendiente"}
        </div>
      </article>
    `;
  }).join("");
}

function showLoading() {
  resultsEl.innerHTML = DRAWS.map(draw => `
    <article class="card">
      <div class="card-info">
        <p class="draw-title">Sorteo ${draw.number}</p>
        <p class="draw-time">${draw.time} h</p>
      </div>
      <div class="card-number pending">...</div>
    </article>
  `).join("");
}

async function fetchResults(dateValue) {
  // Ruta al archivo JSON estático generado por GitHub Actions dentro de la carpeta data/
  const jsonUrl = `data/${dateValue}.json`;

  const response = await fetch(jsonUrl, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("No hay resultados guardados para esta fecha todavía.");
  }

  const data = await response.json();
  return { values: data.values || [null, null, null, null, null], officialUrl: data.officialUrl };
}

async function loadResults() {
  const selectedDate = dateInput.value;
  if (!selectedDate) return;

  refreshBtn.disabled = true;
  showLoading();
  statusEl.textContent = `Consultando resultados del ${formatDate(selectedDate)}...`;

  try {
    const { values, officialUrl } = await fetchResults(selectedDate);

    renderCards(values, selectedDate);

    const published = values.filter(Boolean).length;
    statusEl.innerHTML =
      `${published} de 5 resultados disponibles · ${formatDate(selectedDate)}. ` +
      (officialUrl ? `<a href="${officialUrl}" target="_blank" rel="noopener noreferrer">Fuente oficial</a>` : "");
  } catch (error) {
    renderCards([], selectedDate);

    const isToday = selectedDate === localDateString();
    const selected = parseInputDate(selectedDate);
    const today = parseInputDate(localDateString());
    
    if (selected > today) {
      statusEl.textContent = "Ese día todavía no ha llegado.";
    } else {
      statusEl.textContent = "Todavía no hay resultados generados en JSON para esta fecha.";
    }

    resultsEl.insertAdjacentHTML("beforebegin", `
      <div class="error" id="errorBox">
        <strong>Información no disponible.</strong><br>
        ${error.message}
      </div>
    `);

    setTimeout(() => document.getElementById("errorBox")?.remove(), 5000);
  } finally {
    refreshBtn.disabled = false;
  }
}

function changeDate(days) {
  const date = parseInputDate(dateInput.value);
  date.setDate(date.getDate() + days);
  dateInput.value = localDateString(date);
  loadResults();
}

// Inicializar fecha de hoy en el input
dateInput.value = localDateString();

dateInput.addEventListener("change", loadResults);
refreshBtn.addEventListener("click", loadResults);
prevBtn.addEventListener("click", () => changeDate(-1));
nextBtn.addEventListener("click", () => changeDate(1));

todayBtn.addEventListener("click", () => {
  dateInput.value = localDateString();
  loadResults();
});

loadResults();
