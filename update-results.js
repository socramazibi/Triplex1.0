const fs = require('fs');
const path = require('path');

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

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

function normalizeText(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function extractPageDate(text) {
  const normalized = normalizeText(text);
  const months = MONTHS.join("|");
  const regex = new RegExp(`(?:resultados[^.]{0,100})?(\\d{1,2})\\s+(?:de\\s+)?(${months})\\s+(?:de\\s+)?(\\d{4})`, "i");
  const match = normalized.match(regex);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS.indexOf(match[2]);
  const year = Number(match[3]);
  if (month < 0) return null;
  return `${year}-${pad(month + 1)}-${pad(day)}`;
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

async function processDate(dateStr) {
  const slug = slugForDate(dateStr);
  const officialUrl = `https://www.juegosonce.es/resultados-triplex-${slug}`;
  const proxyUrl = `https://r.jina.ai/${officialUrl}?_=${Date.now()}`;

  console.log(`Consultando fecha ${dateStr}: ${officialUrl}`);

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) return;
    
    const text = await response.text();
    const pageDate = extractPageDate(text);

    if (pageDate && pageDate !== dateStr) {
      console.log(`La página obtenida no coincide con ${dateStr} (es de ${pageDate}).`);
      return;
    }

    const values = extractResults(text);
    
    if (values.some(v => v !== null)) {
      const dataDir = path.join(__dirname, 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const filePath = path.join(dataDir, `${dateStr}.json`);
      fs.writeFileSync(filePath, JSON.stringify({ values, officialUrl }, null, 2));
      console.log(`¡Resultados de ${dateStr} guardados correctamente!`);
    }
  } catch (error) {
    console.error(`Error al procesar ${dateStr}:`, error.message);
  }
}

async function run() {
  // Comprueba hoy (0) y los dos días anteriores (-1 y -2) para asegurar el histórico reciente
  const daysToCheck = [0, -1, -2];
  
  for (const offset of daysToCheck) {
    const targetDate = getTargetDate(offset);
    await processDate(targetDate);
  }
}

run();
