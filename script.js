// Base de datos con Dexie.js
const db = new Dexie("HorneadasDB");
db.version(1).stores({
  hornadas: "++id, nombre, fecha, horaInicio, tipo, leña, notas, curvaIdeal, datos",
});

let hornadaActualId = null;
let datosBorradosTemporal = null; // para deshacer borrado

// Para comparación de curvas
let curvasComparadas = []; // Array de ids de hornadas a comparar

// --- FUNCIONES DE UI/UX ---

function showToast(msg, tipo = "info", tiempo = 2600) {
  const toast = document.getElementById('toast');
  toast.innerHTML = msg;
  toast.className = `toast show ${tipo}`;
  setTimeout(() => { toast.className = 'toast'; }, tiempo);
}

// Loader para operaciones largas
function showLoader(mostrar = true) {
  document.getElementById('loader').style.display = mostrar ? "block" : "none";
}

// Modal genérico
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.hidden = false;
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.hidden = true;
}

// Ayuda contextual
document.getElementById('ayudaBtn').onclick = () => openModal('modalAyuda');
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal(modal.id);
  });
});

// --- FORMULARIO DE HORNADA ---
const formHornada = document.getElementById("formHornada");
formHornada.onsubmit = async e => {
  e.preventDefault();
  if (!formHornada.checkValidity()) {
    showToast("Completa todos los campos obligatorios.", "error");
    return;
  }
  const data = Object.fromEntries(new FormData(formHornada));
  data.nombre = data.nombreHornada || "";
  data.fecha = data.fechaHornada || ""; // CORREGIDO: guardar fecha
  data.curvaIdeal = !!data.curvaIdeal;
  data.tipo = data.tipoHorneada || "";
  data.leña = data.tipoLenia || "";
  data.notas = data.notas || "";

  // Mantener datos anteriores si es edición
  if (hornadaActualId) {
    const old = await db.hornadas.get(hornadaActualId);
    data.datos = old?.datos || [];
  } else {
    data.datos = [];
  }
  delete data.tipoHorneada;
  delete data.tipoLenia;
  delete data.nombreHornada;
  delete data.fechaHornada; // CORREGIDO: limpiar campo formulario

  hornadaActualId = await db.hornadas.put({ ...data, id: hornadaActualId || undefined });
  localStorage.setItem('ultimaHornada', hornadaActualId);
  showToast("Hornada guardada correctamente.", "success");
  cargarDatosHornada();
};

document.getElementById("nuevaHornadaBtn").onclick = () => {
  hornadaActualId = null;
  formHornada.reset();
  limpiarTabla();
  document.getElementById('vacío').style.display = "block";
  showToast("Formulario listo para nueva hornada.", "info");
};

document.getElementById("gestionarBtn").onclick = async () => {
  // Mostrar el modal de gestión con la lista de hornadas
  const lista = document.getElementById('listaHornadas');
  lista.innerHTML = '';
  let hornadas = await db.hornadas.toArray();
  hornadas.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  if (hornadas.length === 0) {
    lista.innerHTML = '<li>No hay hornadas guardadas.</li>';
  } else {
    hornadas.forEach(h => {
      const li = document.createElement('li');
      li.innerHTML = `<b>${h.nombre || '(sin nombre)'}</b> (${h.fecha || 'sin fecha'})
        <button onclick="cargarHornada(${h.id})">Cargar</button>
        <button onclick="editarHornada(${h.id})">Editar</button>
        <button onclick="eliminarHornada(${h.id})">Eliminar</button>`;
      lista.appendChild(li);
    });
  }
  openModal('modalGestion');
};

window.cargarHornada = async id => {
  hornadaActualId = id;
  closeModal('modalGestion');
  await cargarDatosHornada();
  showToast("Hornada cargada.", "info");
};

window.editarHornada = async id => {
  hornadaActualId = id;
  closeModal('modalGestion');
  await cargarDatosHornada();
  showToast("Puedes editar y guardar la hornada.", "info");
};

window.eliminarHornada = async id => {
  if (!confirm("¿Seguro que quieres eliminar esta hornada?")) return;
  await db.hornadas.delete(id);
  if (hornadaActualId === id) {
    hornadaActualId = null;
    formHornada.reset();
    limpiarTabla();
    document.getElementById('vacío').style.display = "block";
  }
  closeModal('modalGestion');
  showToast("Hornada eliminada.", "success");
  document.getElementById("gestionarBtn").click();
};

async function cargarDatosHornada() {
  if (!hornadaActualId) {
    limpiarTabla();
    document.getElementById('vacío').style.display = "block";
    actualizarGrafico([]);
    return;
  }
  const h = await db.hornadas.get(hornadaActualId);
  if (!h) return;
  formHornada.nombreHornada.value = h.nombre || "";
  formHornada.fechaHornada.value = h.fecha || ""; // CORREGIDO: cargar fecha
  formHornada.horaInicio.value = h.horaInicio || "";
  formHornada.tipoHorneada.value = h.tipo || "";
  formHornada.tipoLenia.value = h.leña || "";
  formHornada.notas.value = h.notas || "";
  formHornada.curvaIdeal.checked = !!h.curvaIdeal;
  cargarTabla(h.datos || []);
  document.getElementById('vacío').style.display = (h.datos && h.datos.length > 0) ? "none" : "block";
  // Si hay comparación activa, refresca
  if (curvasComparadas.length) {
    await actualizarGraficoComparacion();
  } else {
    actualizarGrafico(h.datos || []);
  }
}

// --- FORMULARIO DE REGISTRO DE TEMPERATURAS ---
const formDato = document.getElementById("formDato");
formDato.onsubmit = async e => {
  e.preventDefault();
  if (!hornadaActualId) {
    showToast("Guarda primero la hornada.", "warning");
    return;
  }
  if (!formDato.checkValidity()) {
    showToast("Completa los campos requeridos.", "error");
    return;
  }
  const data = Object.fromEntries(new FormData(formDato));
  data.tempActual = Number(data.tempActual);
  data.nota = data.nota || "";
  data.horaRegistro = data.horaRegistro || "";
  const h = await db.hornadas.get(hornadaActualId);
  h.datos = h.datos || [];
  h.datos.push(data);
  await db.hornadas.put(h);
  formDato.reset();
  cargarTabla(h.datos);
  document.getElementById('vacío').style.display = "none";
  showToast("Registro añadido.", "success");
  // Si hay comparación activa, refresca
  if (curvasComparadas.length) {
    await actualizarGraficoComparacion();
  } else {
    actualizarGrafico(h.datos || []);
  }
};

// --- TABLA Y EDICIÓN INLINE ---
function limpiarTabla() {
  document.querySelector("#tablaDatos tbody").innerHTML = "";
}

function cargarTabla(datos) {
  const tbody = document.querySelector("#tablaDatos tbody");
  tbody.innerHTML = "";
  if (!datos || !datos.length) {
    document.getElementById('vacío').style.display = "block";
    return;
  }
  datos.forEach((d, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td ondblclick="editarCelda(this, 'horaRegistro', ${idx})">${d.horaRegistro || ""}</td>
      <td ondblclick="editarCelda(this, 'tempActual', ${idx})">${d.tempActual || ""}</td>
      <td ondblclick="editarCelda(this, 'nota', ${idx})">${d.nota || ""}</td>
      <td>
        <button onclick="borrarDato(${idx})" title="Eliminar">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.editarCelda = async function(td, campo, idx) {
  if (td.querySelector('input, textarea')) return; // ya está editando
  const valor = td.textContent;
  td.classList.add('inline-edit');
  td.innerHTML = (campo === "nota")
    ? `<textarea>${valor}</textarea> <button class="mini" title="Guardar">✔️</button>`
    : `<input type="${campo === "tempActual" ? "number" : "text"}" value="${valor}"> <button class="mini" title="Guardar">✔️</button>`;
  const input = td.querySelector('input, textarea');
  input.focus();
  td.querySelector('button').onclick = async () => {
    const valorNuevo = input.value;
    const h = await db.hornadas.get(hornadaActualId);
    if (campo === "tempActual") h.datos[idx][campo] = Number(valorNuevo);
    else h.datos[idx][campo] = valorNuevo;
    await db.hornadas.put(h);
    cargarTabla(h.datos);
    showToast("Registro actualizado.", "success");
    // Si hay comparación activa, refresca
    if (curvasComparadas.length) {
      await actualizarGraficoComparacion();
    } else {
      actualizarGrafico(h.datos || []);
    }
  };
  input.onkeydown = e => {
    if (e.key === "Enter" && campo !== "nota") td.querySelector('button').click();
    if (e.key === "Escape") cargarDatosHornada();
  };
};

window.borrarDato = async idx => {
  if (!hornadaActualId) return;
  const h = await db.hornadas.get(hornadaActualId);
  datosBorradosTemporal = { dato: h.datos[idx], idx };
  h.datos.splice(idx, 1);
  await db.hornadas.put(h);
  cargarTabla(h.datos);
  showToast(`Registro eliminado. <button class="mini" onclick="deshacerBorrado()">Deshacer</button>`, "warning", 5000);
  document.getElementById('vacío').style.display = (h.datos.length === 0) ? "block" : "none";
  // Si hay comparación activa, refresca
  if (curvasComparadas.length) {
    await actualizarGraficoComparacion();
  } else {
    actualizarGrafico(h.datos || []);
  }
};

window.deshacerBorrado = async () => {
  if (!hornadaActualId || !datosBorradosTemporal) return;
  const h = await db.hornadas.get(hornadaActualId);
  h.datos.splice(datosBorradosTemporal.idx, 0, datosBorradosTemporal.dato);
  await db.hornadas.put(h);
  cargarTabla(h.datos);
  datosBorradosTemporal = null;
  showToast("Borrado deshecho.", "success");
  // Si hay comparación activa, refresca
  if (curvasComparadas.length) {
    await actualizarGraficoComparacion();
  } else {
    actualizarGrafico(h.datos || []);
  }
};

// --- GRAFICO (multi-curvas soportado) ---
function generarColor(idx) {
  // Colores bonitos predefinidos
  const colores = [
    "#1976d2", "#d32f2f", "#388e3c", "#fbc02d", "#7b1fa2",
    "#00796b", "#f57c00", "#0288d1", "#c2185b", "#afb42b"
  ];
  return colores[idx % colores.length];
}
function generarColorFondo(idx) {
  // Transparente para relleno, si se quiere
  const colores = [
    "rgba(25,118,210,0.10)", "rgba(211,47,47,0.10)", "rgba(56,142,60,0.10)", "rgba(251,192,45,0.10)",
    "rgba(123,31,162,0.10)", "rgba(0,121,107,0.10)", "rgba(245,124,0,0.10)", "rgba(2,136,209,0.10)",
    "rgba(194,24,91,0.10)", "rgba(175,180,43,0.10)"
  ];
  return colores[idx % colores.length];
}
function actualizarGrafico(datos = []) {
  showLoader(true);
  setTimeout(() => {
    showLoader(false);
    if (!window.Chart) return;
    if (window.miGrafico) window.miGrafico.destroy();
    const ctx = document.getElementById('chartCanvas').getContext('2d');
    if (!datos.length) {
      window.miGrafico = new Chart(ctx, {type: "line", data: {labels: [], datasets: []}});
      return;
    }
    const labels = datos.map(d => d.horaRegistro);
    const temps = datos.map(d => d.tempActual);
    window.miGrafico = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: "Hornada actual",
          data: temps,
          fill: false,
          borderColor: generarColor(0),
          backgroundColor: generarColor(0),
          tension: 0.23,
          pointRadius: 3,
          spanGaps: true, // CORREGIDO: une los puntos aunque haya nulls
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true }
        },
        scales: {
          x: { title: { display: true, text: "Hora" } },
          y: { title: { display: true, text: "°C" } }
        }
      }
    });
  }, 400); // simula carga
}

async function actualizarGraficoComparacion() {
  showLoader(true);
  setTimeout(async () => {
    showLoader(false);
    if (!window.Chart) return;
    if (window.miGrafico) window.miGrafico.destroy();
    const ctx = document.getElementById('chartCanvas').getContext('2d');
    // Siempre incluye la hornada actual
    let ids = [hornadaActualId, ...curvasComparadas.filter(id => id !== hornadaActualId)];
    let hornadas = await db.hornadas.bulkGet(ids);
    // Prepara datasets
    let datasets = [];
    let labelSet = new Set();
    hornadas.forEach((h, idx) => {
      if (!h || !h.datos || !h.datos.length) return;
      h.datos.forEach(d => labelSet.add(d.horaRegistro));
    });
    let labels = Array.from(labelSet).sort();
    hornadas.forEach((h, idx) => {
      if (!h || !h.datos || !h.datos.length) return;
      let colorIdx = idx;
      let dataPorHora = {};
      h.datos.forEach(d => dataPorHora[d.horaRegistro] = d.tempActual);
      let dataFinal = labels.map(hr => dataPorHora[hr] !== undefined ? dataPorHora[hr] : null);
      datasets.push({
        label: (h.id === hornadaActualId ? "Hornada actual" : h.nombre || `Hornada ${h.id}`),
        data: dataFinal,
        fill: false,
        borderColor: generarColor(colorIdx),
        backgroundColor: generarColor(colorIdx),
        tension: 0.23,
        pointRadius: 3,
        spanGaps: true, // CORREGIDO: une los puntos aunque haya nulls
      });
    });
    window.miGrafico = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true }
        },
        scales: {
          x: { title: { display: true, text: "Hora" } },
          y: { title: { display: true, text: "°C" } }
        }
      }
    });
  }, 400);
}

// --- MODAL DE COMPARACIÓN DE CURVAS ---
document.getElementById("compararBtn").onclick = async () => {
  // Llena el modal con la lista de hornadas (excepto la actual)
  const lista = document.getElementById("listaHornadasComparar");
  lista.innerHTML = '';
  let hornadas = await db.hornadas.toArray();
  hornadas.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  if (hornadas.length <= 1) {
    lista.innerHTML = '<li>No hay otras hornadas para comparar.</li>';
  } else {
    hornadas.forEach(h => {
      if (!h || h.id === hornadaActualId) return;
      const li = document.createElement('li');
      li.innerHTML = `<label><input type="checkbox" name="curva" value="${h.id}" ${
        curvasComparadas.includes(h.id) ? "checked" : ""
      }> <b>${h.nombre || '(sin nombre)'}</b> (${h.fecha || 'sin fecha'})</label>`;
      lista.appendChild(li);
    });
  }
  openModal('modalComparar');
};

document.getElementById("formComparar").onsubmit = async e => {
  e.preventDefault();
  const checks = [...document.querySelectorAll("#listaHornadasComparar input[type=checkbox]:checked")];
  curvasComparadas = checks.map(c => Number(c.value));
  closeModal('modalComparar');
  if (curvasComparadas.length) {
    document.getElementById("limpiarComparacionBtn").style.display = "";
    await actualizarGraficoComparacion();
    showToast("Comparando curvas seleccionadas.", "info");
  } else {
    document.getElementById("limpiarComparacionBtn").style.display = "none";
    // Solo grafico actual
    const h = await db.hornadas.get(hornadaActualId);
    actualizarGrafico(h?.datos || []);
    showToast("Comparación desactivada.", "info");
  }
};

document.getElementById("limpiarComparacionBtn").onclick = async () => {
  curvasComparadas = [];
  document.getElementById("limpiarComparacionBtn").style.display = "none";
  const h = await db.hornadas.get(hornadaActualId);
  actualizarGrafico(h?.datos || []);
  showToast("Comparación desactivada.", "info");
};

// --- EXPORTAR/IMPORTAR ---
document.getElementById("exportarJSON").onclick = async () => {
  if (!hornadaActualId) { showToast("No hay hornada seleccionada.", "warning"); return; }
  const h = await db.hornadas.get(hornadaActualId);
  const blob = new Blob([JSON.stringify(h)], { type: "application/json" });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${h.nombre || "hornada"}.json`;
  a.click();
  showToast("Exportado como JSON.", "success");
};
document.getElementById("exportarCSV").onclick = async () => {
  if (!hornadaActualId) { showToast("No hay hornada seleccionada.", "warning"); return; }
  const h = await db.hornadas.get(hornadaActualId);
  if (!h?.datos?.length) { showToast("Nada que exportar.", "warning"); return; }
  const filas = [["Hora", "Temp (°C)", "Nota"]];
  h.datos.forEach(d => filas.push([d.horaRegistro, d.tempActual, d.nota]));
  const csv = filas.map(f => f.map(x => `"${(x+"").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${h.nombre || "hornada"}.csv`;
  a.click();
  showToast("Exportado como CSV.", "success");
};
document.getElementById("exportarExcel").onclick = async () => {
  // Simulado básico: genera CSV con extensión xls
  if (!hornadaActualId) { showToast("No hay hornada seleccionada.", "warning"); return; }
  const h = await db.hornadas.get(hornadaActualId);
  if (!h?.datos?.length) { showToast("Nada que exportar.", "warning"); return; }
  const filas = [["Hora", "Temp (°C)", "Nota"]];
  h.datos.forEach(d => filas.push([d.horaRegistro, d.tempActual, d.nota]));
  const csv = filas.map(f => f.map(x => `"${(x+"").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "application/vnd.ms-excel" });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${h.nombre || "hornada"}.xls`;
  a.click();
  showToast("Exportado como Excel.", "success");
};
document.getElementById("importarArchivo").onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const txt = await file.text();
    const data = JSON.parse(txt);
    if (!data.nombre || !data.datos) throw new Error("No es un archivo válido");
    await db.hornadas.put(data);
    showToast("Importado correctamente.", "success");
    hornadaActualId = data.id;
    cargarDatosHornada();
  } catch (err) {
    showToast("Archivo no válido.", "error");
  }
  e.target.value = "";
};

// --- INFORME E IMPRESIÓN ---
document.getElementById("informeBtn").onclick = () => {
  window.print();
  showToast("Abriendo diálogo de impresión.", "info");
};

// --- AJUSTES Y OTROS ---
document.getElementById("ajustesBtn").onclick = () => {
  showToast("Funcionalidad de ajustes próximamente.", "info");
};

// --- RECORDAR PREFERENCIAS ---
window.addEventListener('DOMContentLoaded', async () => {
  const ultima = localStorage.getItem('ultimaHornada');
  if (ultima) {
    hornadaActualId = Number(ultima);
    await cargarDatosHornada();
  }
});