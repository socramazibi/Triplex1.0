const fs = require('fs');
const path = require('path');

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

const DATA_DIR = path.join(__dirname, 'data');

// Obtenemos el año actual en curso (ej: "2026")
const currentYear = new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid', year: 'numeric' });
const HISTORICO_PATH = path.join(DATA_DIR, `historico${currentYear}.json`);

function pad(n) {
  return String(n).padStart(2, "0");
}

function getSpainDateString(offsetDays = 0) {
  const now = new Date();
  const options = { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  
  if (offsetDays !== 0) {
    const spainTimeStr = formatter.format(now);
    const [y, m, d] = spainTimeStr.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d + offsetDays);
    const year = targetDate.getFullYear();
    const month = pad(targetDate.getMonth() + 1);
    const day = pad(targetDate.getDate());
    return `${year}-${month}-${day}`;
  }
  
  return formatter.format(now);
}

function getTargetDate(offsetDays = 0) {
  return getSpainDateString(offsetDays);
}

function slugForDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const nombreMes = MONTHS[month - 1];
  return `${day}-${nombreMes}-${year}`;
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

function getAllDatesOfCurrentYear() {
  const dates = [];
  let currentDate = new Date(Number(currentYear), 0, 1);
  
  const todayStr = getSpainDateString(0);
  const [todayY, todayM, todayD] = todayStr.split('-').map(Number);
  const todayDate = new Date(todayY, todayM - 1, todayD);

  while (currentDate <= todayDate) {
    const y = currentDate.getFullYear();
    const m = pad(currentDate.getMonth() + 1);
    const d = pad(currentDate.getDate());
    dates.push(`${y}-${m}-${d}`);
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

  const sortedHistorico = Object.keys(historico)
    .sort()
    .reduce((acc, key) => {
      acc[key] = historico[key];
      return acc;
    }, {});

  fs.writeFileSync(HISTORICO_PATH, JSON.stringify(sortedHistorico, null, 2), 'utf8');
}

async function processDate(dateStr, historico) {
  const slug = slugForDate(dateStr);
  const officialUrl = `https://www.juegosonce.es/resultados-triplex-${slug}`;
  const proxyUrl = `https://r.jina.ai/${officialUrl}?_=${Date.now()}`;

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) return false;
    
    const text = await response.text();
    const textLower = text.toLowerCase();
    
    const [year, monthNum, dayNum] = dateStr.split("-").map(Number);
    const monthName = MONTHS[monthNum - 1];
    
    const hasDay = textLower.includes(String(dayNum));
    const hasMonth = textLower.includes(monthName);
    
    const ayerStr = getSpainDateString(-1);
    const [, , ayerDayNum] = ayerStr.split("-").map(Number);
    const isToday = (dateStr === getSpainDateString(0));
    
    if (!hasDay || !hasMonth || (isToday && textLower.includes(`de ${ayerDayNum} de`) && !textLower.includes(`de ${dayNum} de`))) {
      console.log(`[ESPERANDO] Los resultados oficiales para ${dateStr} (${slug}) aún no están publicados.`);
      return false;
    }

    const values = extractResults(text);
    
    if (values.some(v => v !== null)) {
      historico[dateStr] = { values, officialUrl };
      console.log(`[OK] ${dateStr} sincronizado correctamente en ${path.basename(HISTORICO_PATH)}.`);
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
    console.log(`Primera ejecución para el año ${currentYear}: Descargando histórico completo...`);
    daysToCheck = getAllDatesOfCurrentYear();
  } else {
    console.log(`Ejecución rutinaria en ${path.basename(HISTORICO_PATH)}: Comprobando los últimos 3 días...`);
    daysToCheck = [getTargetDate(0), getTargetDate(-1), getTargetDate(-2)];
  }

  for (const targetDate of daysToCheck) {
    await processDate(targetDate, historico);
    if (!fileExists) await new Promise(resolve => setTimeout(resolve, 200));
  }

  saveHistorico(historico);
  console.log(`¡Proceso finalizado! ${path.basename(HISTORICO_PATH)} actualizado correctamente.`);
}

run();
