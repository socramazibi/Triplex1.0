const fs = require('fs');
const path = require('path');
const MONTHS = [
"enero", "febrero", "marzo", "abril", "mayo", "junio",
"julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];
function pad(n) {
return String(n).padStart(2, "0");
}
function getMadridDateString() {
const now = new Date();
// Obtener fecha en hora local de España peninsular
const formatter = new Intl.DateTimeFormat('es-ES', {
timeZone: 'Europe/Madrid',
year: 'numeric',
month: '2-digit',
day: '2-digit'
});
const parts = formatter.formatToParts(now);
const year = parts.find(p => p.type === 'year').value;
const month = parts.find(p => p.type === 'month').value;
const day = parts.find(p => p.type === 'day').value;
return ${year}-${month}-${day};
}
function slugForDate(value) {
const [year, month, day] = value.split("-").map(Number);
const monthName = MONTHS[month - 1];
return ${day}-${monthName}-${year};
}
function normalizeText(text) {
return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}
function extractPageDate(text, targetDateValue) {
const normalized = normalizeText(text);
const months = MONTHS.join("|");
const regex = new RegExp((?:resultados[^.]{0,100})?(\\d{1,2})\\s+(?:de\\s+)?(${months})\\s+(?:de\\s+)?(\\d{4}), "i");
const match = normalized.match(regex);
if (!match) return null;
const day = Number(match[1]);
const month = MONTHS.indexOf(match[2]);
const year = Number(match[3]);
if (month < 0) return null;
return ${year}-${pad(month + 1)}-${pad(day)};
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
values[index] = ${match[1]}${match[2]}${match[3]};
}
});
return values;
}
async function main() {
const dateValue = getMadridDateString();
const slug = slugForDate(dateValue);
const officialUrl = https://www.juegosonce.es/resultados-triplex-${slug};
const proxyUrl = https://r.jina.ai/${officialUrl}?_=${Date.now()};
console.log(Buscando resultados para: ${dateValue});
try {
const response = await fetch(proxyUrl);
if (!response.ok) throw new Error("No se pudo conectar con la fuente.");
const text = await response.text();
const pageDate = extractPageDate(text, dateValue);
if (!pageDate || pageDate !== dateValue) {
console.log("La página oficial todavía no corresponde a la fecha de hoy.");
return;
}
const values = extractResults(text);
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
fs.mkdirSync(dataDir);
}
const filePath = path.join(dataDir, ${dateValue}.json);
const fileContent = JSON.stringify({ values, officialUrl, updatedAt: new Date().toISOString() }, null, 2);
fs.writeFileSync(filePath, fileContent);
console.log(Resultados guardados correctamente en ${filePath});
} catch (error) {
console.error("Error al actualizar:", error.message);
}
}
main();