/* Interfaz: almacenamiento, música, mensajes, avisos, controles, ventana de deseos y lista. */

/* ==========================================================================
   Iconos pixel art (SVG con fill=currentColor)
   ========================================================================== */
const BITMAPS = {
  pausa: ["........", ".##..##.", ".##..##.", ".##..##.", ".##..##.", ".##..##.", ".##..##.", "........"],
  play: ["..#.....", "..##....", "..###...", "..####..", "..####..", "..###...", "..##....", "..#....."],
  estrella: ["...#...", "...#...", "#######", ".#####.", "..###..", ".##.##.", ".#...#."],
  cerrar: ["##....##", ".##..##.", "..####..", "...##...", "..####..", ".##..##.", "##....##"],
  nota: ["...####.", "...#..#.", "...#..#.", "...#..#.", ".###.##.", ".###.##.", "........"],
};

function iconoSVG(nombre, escala = 2) {
  const filas = BITMAPS[nombre];
  const w = filas[0].length, h = filas.length;
  let rects = "";
  filas.forEach((fila, y) => {
    for (const m of fila.matchAll(/#+/g)) rects += `<rect x="${m.index}" y="${y}" width="${m[0].length}" height="1"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * escala}" height="${h * escala}" ` +
    `fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fechaLegible(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${parseInt(m[3], 10)} ${MESES[parseInt(m[2], 10) - 1]} ${m[1]}` : "";
}

function fechaAhora() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const $ = (id) => document.getElementById(id);

/* ==========================================================================
   Almacenamiento de los deseos (localStorage del navegador)
   Formato: {"version": 1, "deseos": [{id, texto, x, y, fecha}, ...]}
   ========================================================================== */
class AlmacenDeseos {
  constructor(clave) {
    this.clave = clave;
    this.deseos = [];
    this.aviso = null;
    this.cargar();
  }

  cargar() {
    let crudo = null;
    try { crudo = localStorage.getItem(this.clave); } catch (e) { crudo = null; }
    if (!crudo) return;
    try {
      const datos = JSON.parse(crudo);
      const lista = Array.isArray(datos) ? datos : datos.deseos;
      this.deseos = lista.map((d) => this._validar(d)).filter(Boolean);
    } catch (e) {
      try { localStorage.setItem(`${this.clave}-corrupto-${Date.now()}`, crudo); } catch (e2) { /* nada */ }
      this.aviso = "Los deseos guardados estaban dañados; se conservó una copia y se empieza limpio";
    }
  }

  _validar(d) {
    if (!d || typeof d !== "object") return null;
    const texto = String(d.texto ?? "").trim();
    const x = parseFloat(d.x), y = parseFloat(d.y);
    if (!texto || isNaN(x) || isNaN(y)) return null;
    return { id: String(d.id || Math.random().toString(16).slice(2, 10)), texto, x, y, fecha: String(d.fecha || fechaAhora()) };
  }

  guardar() {
    try {
      localStorage.setItem(this.clave, JSON.stringify({ version: 1, deseos: this.deseos }));
      return true;
    } catch (e) {
      this.aviso = "No se pudo guardar en este navegador";
      return false;
    }
  }

  /** Añade un deseo y lo guarda. Devuelve [deseo, guardadoOk]. */
  agregar(texto, x, y) {
    const deseo = {
      id: Math.random().toString(16).slice(2, 10).padEnd(8, "0"),
      texto: texto.split(/\s+/).filter(Boolean).join(" "),
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      fecha: fechaAhora(),
    };
    this.deseos.push(deseo);
    return [deseo, this.guardar()];
  }
}

/* ==========================================================================
   Música
   ========================================================================== */
class Musica {
  constructor(el, volumen = 0.5) {
    this.el = el;
    this.volumen = volumen;
    this.disponible = true;
    this.pausado = false;
    this.iniciada = false;
    this.error = null;
    this.fundiendo = false;
    this.alCambiar = () => {};
    el.volume = 0;
    el.addEventListener("error", () => {
      this.disponible = false;
      this.error = "No se pudo cargar assets/musica.mp3";
      this.alCambiar();
    });
    this.intentar();
    // los navegadores exigen un gesto del usuario antes de reproducir audio
    const gesto = () => {
      if (this.iniciada) {
        removeEventListener("pointerdown", gesto, true);
        removeEventListener("keydown", gesto, true);
      } else if (!this.pausado && this.disponible) {
        this.intentar();
      }
    };
    addEventListener("pointerdown", gesto, true);
    addEventListener("keydown", gesto, true);
  }

  intentar() {
    const p = this.el.play();
    if (p && p.then) {
      p.then(() => {
        if (this.iniciada) return;
        this.iniciada = true;
        this.fundido();
        this.alCambiar();
      }).catch(() => {});
    }
  }

  fundido() {                                   // fundido suave de entrada
    const ini = performance.now();
    this.fundiendo = true;
    const paso = () => {
      if (!this.fundiendo) return;
      const k = Math.min(1, (performance.now() - ini) / 2500);
      this.el.volume = this.volumen * k;
      if (k < 1) requestAnimationFrame(paso); else this.fundiendo = false;
    };
    paso();
  }

  alternar() {
    if (!this.disponible) return;
    if (!this.iniciada) { this.intentar(); return; }
    if (this.pausado) this.el.play().catch(() => {}); else this.el.pause();
    this.pausado = !this.pausado;
    this.alCambiar();
  }

  cambiarVolumen(v) {
    this.volumen = limitar(v, 0, 1);
    this.fundiendo = false;
    this.el.volume = this.volumen;
    this.alCambiar();
  }
}

/* ==========================================================================
   Mensajes flotantes y avisos
   ========================================================================== */
class BolsaMensajes {                           // reparte las frases sin repetir hasta verlas todas
  constructor() { this.pendientes = []; this.ultimo = null; }

  siguiente() {
    if (!this.pendientes.length) {
      this.pendientes = CFG.MENSAJES.slice();
      for (let i = this.pendientes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.pendientes[i], this.pendientes[j]] = [this.pendientes[j], this.pendientes[i]];
      }
      if (this.ultimo && this.pendientes[this.pendientes.length - 1] === this.ultimo) this.pendientes.reverse();
    }
    this.ultimo = this.pendientes.pop();
    return this.ultimo;
  }
}

class Mensaje {
  static APARECER = 0.55;
  static DESAPARECER = 1.0;

  constructor(contenedor, texto, pos, tipo, titulo, pie) {
    const el = document.createElement("div");
    el.className = `mensaje ${tipo}`;
    el.innerHTML = `<div class="insignia">${iconoSVG("estrella", 3)}</div><div class="px cuerpo"></div>`;
    const cuerpo = el.querySelector(".cuerpo");
    if (titulo) cuerpo.appendChild(Object.assign(document.createElement("div"), { className: "m-titulo", textContent: titulo }));
    cuerpo.appendChild(Object.assign(document.createElement("div"), { className: "m-texto", textContent: texto }));
    if (pie) cuerpo.appendChild(Object.assign(document.createElement("div"), { className: "m-pie", textContent: pie }));
    el.style.opacity = 0;
    contenedor.appendChild(el);

    const w = el.offsetWidth, h = el.offsetHeight - 12;
    const x = limitar(pos[0] - w / 2, 16, CFG.ANCHO - 16 - w);
    let y = pos[1] - h - 36;                   // centrada sobre la estrella (o debajo si no cabe arriba)
    if (y < 70) y = pos[1] + 26;
    this.x = Math.round(x);
    this.y = Math.round(y);
    el.style.left = `${this.x}px`;
    el.style.top = `${this.y}px`;
    this.el = el;
    this.t = 0;
    this.total = Mensaje.APARECER + 3.6 + 0.045 * texto.length + Mensaje.DESAPARECER;
  }

  acortar() { this.t = Math.max(this.t, this.total - 0.35); }
  get viva() { return this.t < this.total; }

  pintar() {
    let a;
    if (this.t < Mensaje.APARECER) a = 1 - Math.pow(1 - this.t / Mensaje.APARECER, 3);
    else if (this.t > this.total - Mensaje.DESAPARECER) a = Math.max(0, (this.total - this.t) / Mensaje.DESAPARECER);
    else a = 1;
    this.el.style.opacity = a;
    this.el.style.transform = `translateY(${Math.floor((1 - a) * 10)}px)`;
  }
}

class GestorMensajes {
  constructor(contenedor) { this.contenedor = contenedor; this.mensajes = []; }

  mostrar(texto, pos, tipo, titulo = null, pie = null) {
    this.mensajes.forEach((m) => m.acortar());
    this.mensajes.push(new Mensaje(this.contenedor, texto, pos, tipo, titulo, pie));
  }

  actualizar(dt) {
    for (const m of this.mensajes) { m.t += dt; m.pintar(); }
    this.mensajes = this.mensajes.filter((m) => {
      if (!m.viva) m.el.remove();
      return m.viva;
    });
  }
}

class Aviso {                                   // texto discreto en la parte baja (pistas y errores)
  constructor(el) {
    this.el = el;
    this.texto = el.querySelector("span");
    this.t = 0;
    this.total = 0;
    this.cola = [];                              // [segundos_de_espera, texto, duración]
  }

  programar(espera, texto, dur = 6.0) { this.cola.push([espera, texto, dur]); }

  mostrar(texto, dur = 4.5) {
    this.texto.textContent = texto;
    this.t = 0;
    this.total = dur;
  }

  actualizar(dt) {
    for (const item of this.cola.slice()) {
      item[0] -= dt;
      if (item[0] <= 0) {
        this.cola.splice(this.cola.indexOf(item), 1);
        this.mostrar(item[1], item[2]);
      }
    }
    this.t += dt;
    const a = this.t >= this.total ? 0 : limitar(Math.min(this.t / 0.6, (this.total - this.t) / 0.8), 0, 1);
    this.el.style.opacity = a;
  }
}

/* ==========================================================================
   Controles (arriba a la derecha)
   ========================================================================== */
class BarraControles {
  constructor(musica) {
    this.musica = musica;
    this.btnMusica = $("btn-musica");
    this.btnDeseos = $("btn-deseos");
    this.rango = $("volumen");
    this.cuenta = $("cuenta-deseos");
    this.alDeseos = () => {};

    $("ico-deseos").innerHTML = iconoSVG("estrella", 3);
    this.rango.value = Math.round(musica.volumen * 100);

    this.btnMusica.addEventListener("click", () => musica.alternar());
    this.btnDeseos.addEventListener("click", () => this.alDeseos());
    this.rango.addEventListener("input", () => musica.cambiarVolumen(this.rango.value / 100));
    musica.alCambiar = () => this.actualizar();
    this.actualizar();
  }

  actualizar() {
    const m = this.musica;
    const ico = !m.disponible ? "nota" : (m.pausado ? "play" : "pausa");
    $("ico-musica").innerHTML = iconoSVG(ico, 2);
    this.btnMusica.classList.toggle("inactivo", !m.disponible);
    this.btnMusica.parentElement.dataset.tip = m.disponible ? (m.pausado ? "Reanudar música" : "Pausar música") : (m.error || "Sin música");
    this.rango.parentElement.dataset.tip = `Volumen ${Math.round(m.volumen * 100)}%`;
    this.rango.value = Math.round(m.volumen * 100);
    this.rango.style.setProperty("--lleno", `${Math.round(m.volumen * 100)}%`);
  }

  contar(n) {
    this.cuenta.textContent = n || "";
  }
}

/* ==========================================================================
   Ventana para escribir un deseo
   ========================================================================== */
class DialogoDeseo {
  constructor() {
    this.velo = $("dialogo");
    this.caja = $("deseo-texto");
    this.cont = $("deseo-cuenta");
    this.btnGuardar = $("deseo-guardar");
    this.btnCancelar = $("deseo-cancelar");
    this.activo = false;
    this.alResolver = () => {};
    this.caja.maxLength = CFG.MAX_CARACTERES_DESEO;

    this.caja.addEventListener("input", () => {
      this.caja.value = this.caja.value.replace(/[\r\n]+/g, " ");
      this._refrescar();
    });
    this.caja.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); this._guardar(); }
    });
    this.btnGuardar.addEventListener("click", () => this._guardar());
    this.btnCancelar.addEventListener("click", () => this.alResolver(["cancelar"]));
  }

  _guardar() {
    const t = this.caja.value.trim();
    if (t) this.alResolver(["guardar", t]);
  }

  _refrescar() {
    this.cont.textContent = `${this.caja.value.length}/${CFG.MAX_CARACTERES_DESEO}`;
    this.btnGuardar.disabled = !this.caja.value.trim();
  }

  abrir() {
    this.activo = true;
    this.caja.value = "";
    this._refrescar();
    this.velo.classList.remove("oculto");
    setTimeout(() => this.caja.focus(), 30);
  }

  cerrar() {
    this.activo = false;
    this.velo.classList.add("oculto");
    this.caja.blur();
  }

  tecla(e) {
    if (e.key === "Escape") this.alResolver(["cancelar"]);
  }
}

/* ==========================================================================
   Lista de deseos guardados
   ========================================================================== */
class PanelDeseos {
  constructor() {
    this.velo = $("lista");
    this.panel = this.velo.querySelector(".ventana");
    this.lista = $("lista-items");
    this.sub = $("lista-sub");
    this.vacio = $("lista-vacio");
    this.activo = false;
    this.alIr = () => {};
    $("ico-cerrar").innerHTML = iconoSVG("cerrar", 2);
    $("lista-cerrar").addEventListener("click", () => this.cerrar());
    this.velo.addEventListener("pointerdown", (e) => { if (!this.panel.contains(e.target)) this.cerrar(); });
  }

  abrir(deseos) {
    this.render(deseos);
    this.activo = true;
    this.velo.classList.remove("oculto");
    this.lista.scrollTop = 0;
  }

  cerrar() {
    this.activo = false;
    this.velo.classList.add("oculto");
  }

  render(deseos) {
    this.lista.innerHTML = "";
    const items = deseos.slice().reverse();                 // los más recientes primero
    this.vacio.hidden = items.length > 0;
    this.lista.hidden = items.length === 0;
    this.sub.hidden = items.length === 0;
    this.sub.textContent = `${items.length} deseo${items.length !== 1 ? "s" : ""} · toca uno para verlo en el cielo`;
    for (const d of items) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "item-deseo";
      b.innerHTML = `<span class="di-cab">${iconoSVG("estrella", 2)}<span class="di-fecha"></span></span><span class="di-texto"></span>`;
      b.querySelector(".di-fecha").textContent = fechaLegible(d.fecha);
      b.querySelector(".di-texto").textContent = d.texto;
      b.addEventListener("click", () => this.alIr(d));
      this.lista.appendChild(b);
    }
  }

  tecla(e) {
    if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); this.cerrar(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); this.lista.scrollBy({ top: 56 }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); this.lista.scrollBy({ top: -56 }); }
  }
}
