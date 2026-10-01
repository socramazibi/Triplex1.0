async function cargarResultados() {
  try {
    const response = await fetch('data/historico.json');
    if (!response.ok) throw new Error('No se pudo cargar el histórico');
    
    const historico = await response.json();
    
    // Obtener la fecha de hoy en formato YYYY-MM-DD (ej: "2026-10-01")
    const hoyStr = new Date().toISOString().split('T')[0];
    
    const datosHoy = historico[hoyStr];
    
    if (datosHoy && datosHoy.values) {
      // Pinta tus resultados en pantalla usando datosHoy.values
      console.log("Sorteos de hoy:", datosHoy.values);
    } else {
      console.log("Aún no hay sorteos para hoy.");
    }
  } catch (error) {
    console.error("Error al cargar los datos:", error);
  }
}

cargarResultados();
