
// ===============================
// VARIABLES Y ESTADO DE LA APP
// ===============================

let deudores = [];
let historial = [];
let penaltyActive = false;
let db;

// ===============================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// ===============================
window.onload = () => {
  initDB();
  setInterval(verificarPenalizaciones, 86400000); // Verifica penalizaciones cada 24h
  document.getElementById("togglePenalty").onclick = togglePenalizacion;
  document.getElementById("filtroHistorial").addEventListener("input", renderHistorial);
};

// ===============================
// CONFIGURACIÓN Y MANEJO DE INDEXEDDB
// ===============================
function initDB() {
  const request = indexedDB.open("DeudaDB", 1);
  request.onerror = () => alert("Error al abrir la base de datos");
  request.onsuccess = (e) => {
    db = e.target.result;
    cargarDeudores();
  };
  request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("deudores")) {
      db.createObjectStore("deudores", { keyPath: "nombre" });
    }
  };
}

function guardarDeudores() {
  const tx = db.transaction("deudores", "readwrite");
  const store = tx.objectStore("deudores");
  deudores.forEach(d => store.put(d));
}

function cargarDeudores() {
  const tx = db.transaction("deudores", "readonly");
  const store = tx.objectStore("deudores");
  const request = store.getAll();
  request.onsuccess = () => {
    deudores = request.result || [];
    renderizarDeudores();
    renderHistorial();
  };
}

// ===============================
// FUNCIONES PARA AGREGAR / SUMAR / RESTAR / ELIMINAR DEUDORES
// ===============================
function agregarDeudor() {
  const nombre = document.getElementById("nombre").value.trim();
  const monto = parseInt(document.getElementById("monto").value);
  if (!nombre || isNaN(monto)) return alert("Datos inválidos");
  if (deudores.find(d => d.nombre === nombre)) return alert("Ya existe");

  const nuevo = {
    nombre,
    monto,
    historico: monto,
    fechaInicio: new Date().toISOString()
  };
  deudores.push(nuevo);
  historial.push(`${nombre} agregó deuda: $${formatear(monto)}`);
  guardarDeudores();
  renderizarDeudores();
  renderHistorial();
}

function renderizarDeudores() {
  const cont = document.getElementById("listaDeudores");
  cont.innerHTML = "";
  let total = 0;
  let historico = 0;

  deudores.forEach(d => {
    total += d.monto;
    historico += d.historico;
    const div = document.createElement("div");
    div.className = "deudor-card";
    div.innerHTML = `
      <strong>${d.nombre}</strong><br>
      Deuda: $${formatear(d.monto)}<br>
      Histórico: $${formatear(d.historico)}
      <div class="deudor-actions">
        <input type="number" id="input-${d.nombre}" placeholder="Monto">
        <button onclick="sumar('${d.nombre}')">➕</button>
        <button onclick="restar('${d.nombre}')">➖</button>
        <button onclick="eliminar('${d.nombre}')">❌</button>
      </div>`;
    cont.appendChild(div);
  });

  document.getElementById("totalDeuda").textContent = formatear(total);
  document.getElementById("totalHistorico").textContent = formatear(historico);
}

function sumar(nombre) {
  const val = parseInt(document.getElementById(`input-${nombre}`).value);
  if (isNaN(val)) return;
  const d = deudores.find(x => x.nombre === nombre);
  d.monto += val;
  d.historico += val;
  historial.push(`${nombre} sumó: $${formatear(val)}`);
  guardarDeudores();
  renderizarDeudores();
  renderHistorial();
}

function restar(nombre) {
  const val = parseInt(document.getElementById(`input-${nombre}`).value);
  if (isNaN(val)) return;
  const d = deudores.find(x => x.nombre === nombre);
  d.monto -= val;
  historial.push(`${nombre} restó: $${formatear(val)}`);
  guardarDeudores();
  renderizarDeudores();
  renderHistorial();
}

function eliminar(nombre) {
  deudores = deudores.filter(d => d.nombre !== nombre);
  historial.push(`${nombre} eliminado`);
  const tx = db.transaction("deudores", "readwrite");
  tx.objectStore("deudores").delete(nombre);
  renderizarDeudores();
  renderHistorial();
}

// ===============================
// ACTIVACIÓN / DESACTIVACIÓN DE PENALIZACIÓN
// ===============================
function togglePenalizacion() {
  penaltyActive = !penaltyActive;
  document.getElementById("penaltyStatus").textContent = penaltyActive ? "ON" : "OFF";
}

// ===============================
// CÁLCULO DE PENALIZACIONES DIARIAS
// ===============================
function verificarPenalizaciones() {
  if (!penaltyActive) return;
  const diasGracia = parseInt(document.getElementById("diasGracia").value);
  const multaDiaria = parseInt(document.getElementById("multaDiaria").value);

  const hoy = new Date();

  deudores.forEach(d => {
    const inicio = new Date(d.fechaInicio);
    let dias = contarDiasHabiles(inicio, hoy);
    if (dias > diasGracia) {
      const diasPenalizados = dias - diasGracia;
      const multa = diasPenalizados * multaDiaria;
      d.monto += multa;
      d.historico += multa;
      historial.push(`${d.nombre} penalizado con $${formatear(multa)} por ${diasPenalizados} días`);
    }
  });

  guardarDeudores();
  renderizarDeudores();
  renderHistorial();
}

// ===============================
// CÁLCULO DE DÍAS HÁBILES (sin contar sábados ni domingos)
// ===============================
function contarDiasHabiles(desde, hasta) {
  let count = 0;
  for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

// ===============================
// RENDERIZADO DEL HISTORIAL CON FILTRO
// ===============================
function renderHistorial() {
  const filtro = document.getElementById("filtroHistorial").value.toLowerCase();
  const ul = document.getElementById("listaHistorial");
  ul.innerHTML = "";
  historial.filter(h => h.toLowerCase().includes(filtro)).forEach(entry => {
    const li = document.createElement("li");
    li.textContent = entry;
    ul.appendChild(li);
  });
}

// ===============================
// FUNCIONES DE EXPORTACIÓN E IMPORTACIÓN
// ===============================
function exportarCompleto() {
  const data = JSON.stringify({ deudores, historial }, null, 2);
  descargar("datos_completos.txt", data);
}

function exportarListaSimple() {
  const simple = deudores.map(d => `${d.nombre}:${d.monto}`).join("\n");
  descargar("lista_simple.txt", simple);
}

function importarDatos(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.deudores && data.historial) {
        deudores = data.deudores;
        historial = data.historial;
        guardarDeudores();
        renderizarDeudores();
        renderHistorial();
      } else {
        alert("Formato inválido");
      }
    } catch (e) {
      alert("Error al importar datos");
    }
  };
  reader.readAsText(file);
}

// ===============================
// FUNCIÓN UTILITARIA PARA DESCARGAR ARCHIVOS
// ===============================
function descargar(nombre, contenido) {
  const blob = new Blob([contenido], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
}

// ===============================
// FORMATEO DE NÚMEROS A FORMATO MONEDA SIN DECIMALES
// ===============================
function formatear(num) {
  return num.toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

// ===============================
// BORRAR TODOS LOS DATOS (base de datos completa)
// ===============================
function eliminarTodosLosDatos() {
  if (!confirm("¿Estás seguro de que quieres eliminar todos los datos? Esta acción no se puede deshacer.")) return;
  const request = indexedDB.deleteDatabase("DeudaDB");
  request.onsuccess = function () {
    alert("Todos los datos han sido eliminados.");
    location.reload();
  };
  request.onerror = function (event) {
    console.error("Error al eliminar la base de datos", event);
    alert("Hubo un error al intentar eliminar los datos.");
  };
}
