async function cargarResultadosHoy() {
  try {
    const response = await fetch('data/historico.json');
    if (!response.ok) throw new Error('No se pudo cargar el archivo histórico');
    
    const historico = await response.json();
    
    // Obtener la fecha de hoy en formato YYYY-MM-DD (ej: "2026-10-02")
    const hoyStr = new Date().toISOString().split('T')[0];
    
    const datosHoy = historico[hoyStr];
    
    if (datosHoy && datosHoy.values) {
      console.log("Sorteos de hoy encontrados:", datosHoy.values);
      // AQUÍ LLAMAS A TU FUNCIÓN QUE PINTA LOS NÚMEROS EN LA PANTALLA PRINCIPAL
      // Ejemplo: pintarEnPantalla(datosHoy.values);
    } else {
      console.log("Aún no hay sorteos registrados para hoy.");
      // Mostrar mensaje de que no hay sorteos o mostrar el día anterior si lo prefieres
    }
  } catch (error) {
    console.error("Error al cargar los resultados de hoy:", error);
  }
}

// Ejecutar al cargar la página
cargarResultadosHoy();
