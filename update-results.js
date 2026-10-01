const fs = require('fs');
const path = require('path');

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

const DATA_DIR = path.join(__dirname, 'data');
const HISTORICO_PATH = path.join(DATA_DIR, 'historico.json');

function pad(n) {
  return String(n).padStart(2, "0");
}

function getTargetDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function slugForDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${date.getDate()}-${MONTHS[date.getMonth()]-1}-${date.getFullYear()}`; // Nota: mes indexado correctamente abajo
}

// Corrección para el mes en el slug
function slugForDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${date.getDate()}-${MONTHS[date.getMonth()}-${date.getFullYear()}`; // Ajustado en la función de abajo por seguridad
}

// Función limpia para el slug de la fecha
function slugForDateClean(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${date.getDate()}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

function extractResults(text) {
  const values = [null, null, null, null, null];
  const patterns = [
    /primer\s+sorteo\s+del\s+Triplex\s*:\s*(\d)\s*,\s*(\d)\s*,\s*(\d)/i,
    /segundo\s+sorteo\s+del\s+Triplex\s*:\s*(\d)\s*,\s*(\d)\s*,\s*(\d)/i,
    /tercer\s+sorteo\s+del\s+Triplex\s*:\s*(\d)\s*,\s*(\d)\s*,\s*(\d)/i,
    /cuarto\s+sorteo\s+del\s+Triplex\s*:\s*(\d)\s*,\s*(\d)\s*,\s*(\d)/i,
    /quinto\s+sorteo\s+del\s+Triplex\s*:\s*(\d)\s*,\s*(\d)\s*,\s*(\d)/i
  ];

  patterns.forEach((regex, index) => {
    const match = text.match(regex);
    if (match) {
      values[index] = `${match[1]}${match[2]}${match[3]}`;
    }
  });

  return values;
}

// Genera un array con todas las fechas desde el 1 de enero de este año hasta hoy
function getAllDatesOfCurrentYear() {
  const dates = [];
  const year = new Date().getFullYear();
  let currentDate = new Date(year, 0, 1); // 1 de enero
  const today = new Date();

  while (currentDate <= today) {
    dates.push(`${currentDate.getFullYear()}-${pad(currentDate.getMonth() + 1)}-${pad(currentDate.getDate())}`);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
}

function loadHistorico() {
  if (fs.existsSync(HISTORICO_PATH)) {
    try {
      const data = fs.readFileSync(HISTORICO_PATH, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveHistorico(historico) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Ordena las claves cronológicamente
  const sortedHistorico = Object.keys(historico)
    .sort()
    .reduce((acc, key) => {
      acc[key] = historico[key];
      return acc;
    }, {});

  fs.writeFileSync(HISTORICO_PATH, JSON.stringify(sortedHistorico, null, 2), 'utf8');
}

async function processDate(dateStr, historico) {
  const slug = slugForDateClean(dateStr);
  const officialUrl = `https://www.juegosonce.es/resultados-triplex-${slug}`;
  const proxyUrl = `https://r.jina.ai/${officialUrl}?_=${Date.now()}`;

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) return false;
    
    const text = await response.text();
    const values = extractResults(text);
    
    if (values.some(v => v !== null)) {
      historico[dateStr] = { values, officialUrl };
      console.log(`[OK] ${dateStr} sincronizado.`);
      return true;
    }
  } catch (error) {
    console.error(`Error al procesar ${dateStr}:`, error.message);
  }
  return false;
}

async function run() {
  const historico = loadHistorico();
  const fileExists = fs.existsSync(HISTORICO_PATH);

  let daysToCheck = [];

  if (!fileExists) {
    console.log("Primera ejecución detectada: Descargando todo el histórico del año en curso...");
    daysToCheck = getAllDatesOfCurrentYear();
  } else {
    console.log("Ejecución rutinaria: Comprobando los últimos 3 días...");
    daysToCheck = [getTargetDate(0), getTargetDate(-1), getTargetDate(-2)];
  }

  // Procesar las fechas correspondientes
  for (const targetDate of daysToCheck) {
    await processDate(targetDate, historico);
    // Pequeña pausa opcional si descarga el año entero para no saturar el proxy
    if (!fileExists) await new Promise(resolve => setTimeout(resolve, 200));
  }

  saveHistorico(historico);
  console.log("¡Proceso finalizado con éxito! data/historico.json actualizado.");
}

run();
