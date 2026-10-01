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

// Carga el archivo histórico existente o devuelve un objeto vacío
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

// Guarda el histórico completo en el archivo JSON
function saveHistorico(historico) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  // Ordena las claves por fecha para que el JSON quede cronológico
  const sortedHistorico = Object.keys(historico)
    .sort()
    .reduce((acc, key) => {
      acc[key] = historico[key];
      return acc;
    }, {});

  fs.writeFileSync(HISTORICO_PATH, JSON.stringify(sortedHistorico, null, 2), 'utf8');
}

// Muestra estadísticas básicas por consola de los números que más salen
function calcularEstadisticas(historico) {
  const frecuencias = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0 };
  let totalSorteos = 0;

  for (const fecha in historico) {
    const item = historico[fecha];
    if (item && item.values) {
      item.values.forEach(sorteo => {
        if (sorteo) {
          totalSorteos++;
          // Recorre cada dígito del número premiado (ej: "482" -> '4', '8', '2')
          for (const digito of sorteo) {
            if (frecuencias[digito] !== undefined) {
              frecuencias[digito]++;
            }
          }
        }
      });
    }
  }

  console.log(`\n--- ESTADÍSTICAS GLOBALES (${totalSorteos} sorteos analizados) ---`);
  const ranking = Object.entries(frecuencias).sort((a, b) => b[1] - a[1]);
  ranking.forEach(([digito, count]) => {
    console.log(`Número ${digito}: ${count} apariciones`);
  });
  console.log('------------------------------------------------------------\n');
}

async function processDate(dateStr, historico) {
  const slug = slugForDate(dateStr);
  const officialUrl = `https://www.juegosonce.es/resultados-triplex-${slug}`;
  const proxyUrl = `https://r.jina.ai/${officialUrl}?_=${Date.now()}`;

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) return false;
    
    const text = await response.text();
    const values = extractResults(text);
    
    // Si encuentra al menos un resultado, lo actualiza en el objeto histórico
    if (values.some(v => v !== null)) {
      historico[dateStr] = { values, officialUrl };
      console.log(`[OK] Resultados de ${dateStr} sincronizados.`);
      return true;
    }
  } catch (error) {
    console.error(`Error al procesar ${dateStr}:`, error.message);
  }
  return false;
}

async function run() {
  const historico = loadHistorico();

  // Comprueba hoy (0) y los dos días anteriores (-1 y -2)
  const daysToCheck = [0, -1, -2];
  
  for (const offset of daysToCheck) {
    const targetDate = getTargetDate(offset);
    await processDate(targetDate, historico);
  }

  // Guarda los cambios actualizados
  saveHistorico(historico);

  // Calcula y muestra estadísticas en la consola
  calcularEstadisticas(historico);
}

run();
