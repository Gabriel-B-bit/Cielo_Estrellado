/* Un cielo lleno de deseos — bucle principal, eventos del ratón y del teclado. */

function cargarImagen(ruta) {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error(`No se pudo cargar ${ruta}`));
    img.src = ruta;
  });
}

class Aplicacion {
  constructor(paisaje, hoja) {
    const { ANCHO, ALTO } = CFG;
    this.lienzo = $("lienzo");
    this.ctx = this.lienzo.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;

    // paisaje a 1280 x 768 (la imagen original mide 1280 x 769)
    const [fondo, g] = crearLienzo(ANCHO, ALTO);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(paisaje, 0, 0, ANCHO, ALTO);
    this.fondo = fondo;

    // datos y sonido
    this.almacen = new AlmacenDeseos(CFG.CLAVE_DESEOS);
    this.musica = new Musica($("musica"), 0.5);

    // mundo
    this.lago = new Lago(this.fondo);
    this.cielo = new Cielo(this.almacen.deseos);
    this.princesa = new Princesa(hoja);

    // interfaz
    this.barra = new BarraControles(this.musica);
    this.mensajes = new GestorMensajes($("mensajes"));
    this.aviso = new Aviso($("aviso"));
    this.dialogo = new DialogoDeseo();
    this.panel = new PanelDeseos();
    this.bolsa = new BolsaMensajes();

    this.fugazCapturada = null;
    this.t = 0;
    this.pos = null;                      // posición del cursor en coordenadas de la escena
    this.barra.contar(this.almacen.deseos.length);

    this._conectar();
    this._preparar();
    this._ajustar();
  }

  _preparar() {
    if (this.almacen.aviso) this.aviso.programar(1.0, this.almacen.aviso, 6.0);
    if (this.musica.error) this.aviso.programar(1.5, this.musica.error, 6.0);
    this.aviso.programar(8.0, "Toca las estrellas  ·  Atrapa una fugaz para pedir un deseo", 9.0);
  }

  /* ------------------------------------------------------------------ eventos */
  _conectar() {
    addEventListener("resize", () => this._ajustar());
    this.lienzo.addEventListener("pointermove", (e) => { this.pos = this._coords(e); });
    this.lienzo.addEventListener("pointerleave", () => { this.pos = null; });
    this.lienzo.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      this.pos = this._coords(e);
      this._clicEnCielo(this.pos);
    });
    document.addEventListener("keydown", (e) => this._tecla(e));

    this.dialogo.alResolver = (r) => this._resolverDialogo(r);
    this.panel.alIr = (d) => this._irADeseo(d);
    this.barra.alDeseos = () => this.panel.abrir(this.almacen.deseos);
    this.musica.alCambiar = () => {
      this.barra.actualizar();
      if (this.musica.error && !this._avisoMusica) {
        this._avisoMusica = true;
        this.aviso.mostrar(this.musica.error, 6.0);
      }
    };
  }

  _coords(e) {
    const r = this.lienzo.getBoundingClientRect();
    return [((e.clientX - r.left) * CFG.ANCHO) / r.width, ((e.clientY - r.top) * CFG.ALTO) / r.height];
  }

  _ajustar() {
    const s = Math.min(innerWidth / CFG.ANCHO, innerHeight / CFG.ALTO);
    $("escena").style.setProperty("--escala", s);
  }

  _tecla(e) {
    if (this.dialogo.activo) { this.dialogo.tecla(e); return; }          // ventana modal
    if (this.panel.activo) { this.panel.tecla(e); return; }              // lista de deseos
    if (e.target && e.target.tagName === "INPUT" && e.target.type === "range") {
      if (e.key === " ") e.preventDefault();
    }
    if (e.key === " ") { e.preventDefault(); this.musica.alternar(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); this.musica.cambiarVolumen(this.musica.volumen + 0.05); }
    else if (e.key === "ArrowDown") { e.preventDefault(); this.musica.cambiarVolumen(this.musica.volumen - 0.05); }
  }

  _clicEnCielo(pos) {
    const objetivo = this.cielo.objetivoEn(pos);
    if (!objetivo) return;
    const [tipo, obj] = objetivo;
    if (tipo === "estrella") {
      const [kind, texto] = this.bolsa.siguiente();
      obj.flash = 1.0;
      this.mensajes.mostrar(texto, [obj.x, obj.y], kind);
    } else if (tipo === "deseo") {
      this.mensajes.mostrar(obj.texto, [obj.x, obj.y], "deseo", "Tu deseo", fechaLegible(obj.fecha));
    } else if (tipo === "fugaz") {
      obj.capturar();
      this.fugazCapturada = obj;
      this.cielo.pausaFugaces = true;
      this.dialogo.abrir();
    }
  }

  _resolverDialogo(resultado) {
    const fugaz = this.fugazCapturada;
    this.dialogo.cerrar();
    this.cielo.pausaFugaces = false;
    this.fugazCapturada = null;
    if (resultado[0] === "guardar" && fugaz) {
      const [x, y] = this.cielo.ajustarPosicion(fugaz.x, fugaz.y);
      const [deseo, guardado] = this.almacen.agregar(resultado[1], x, y);
      this.cielo.agregarDeseo(deseo, true);
      fugaz.viva = false;                          // la estrella fugaz se vuelve estrella fija
      this.barra.contar(this.almacen.deseos.length);
      if (guardado) this.aviso.mostrar("Tu deseo ahora brilla en el cielo", 4.5);
      else this.aviso.mostrar(this.almacen.aviso || "No se pudo guardar el deseo", 7.0);
    } else if (fugaz) {
      fugaz.liberar();
    }
  }

  _irADeseo(deseo) {
    this.panel.cerrar();
    const est = this.cielo.destacar(deseo.id);
    if (est) this.mensajes.mostrar(est.texto, [est.x, est.y], "deseo", "Tu deseo", fechaLegible(est.fecha));
  }

  /* -------------------------------------------------------------- actualización */
  _actualizar(dt) {
    this.t += dt;
    this.lago.actualizar(dt);
    this.cielo.actualizar(dt);
    for (const f of this.cielo.nuevas) this.princesa.mirarEstrella(f.x);   // una fugaz nueva: la princesa la mira
    this.cielo.nuevas.length = 0;
    this.princesa.actualizar(dt);
    this.mensajes.actualizar(dt);
    this.aviso.actualizar(dt);
  }

  /* -------------------------------------------------------------------- dibujo */
  _dibujar() {
    const c = this.ctx, t = this.t;
    const modal = this.dialogo.activo || this.panel.activo;
    c.drawImage(this.fondo, 0, 0);
    this.lago.dibujar(c, t);
    this.princesa.dibujarReflejo(c, t);
    const hover = this.cielo.dibujar(c, t, modal ? null : this.pos);
    this.princesa.dibujar(c);
    this.lienzo.style.cursor = hover ? "pointer" : "default";
  }

  /* -------------------------------------------------------------------- bucle */
  ejecutar() {
    let previo = performance.now();
    const cuadro = (ahora) => {
      const dt = Math.min((ahora - previo) / 1000, 0.05);       // delta time en segundos
      previo = ahora;
      this._actualizar(dt);
      this._dibujar();
      requestAnimationFrame(cuadro);
    };
    requestAnimationFrame(cuadro);
  }
}

async function iniciar() {
  try {
    const [paisaje, hoja] = await Promise.all([
      cargarImagen("assets/paisaje.png"),
      cargarImagen("assets/princesa.png"),
      document.fonts ? document.fonts.load("30px VT323") : null,
      document.fonts ? document.fonts.load("16px 'Press Start 2P'") : null,
    ]);
    window.app = new Aplicacion(paisaje, hoja);
    window.app.ejecutar();
  } catch (e) {
    document.body.insertAdjacentHTML("beforeend",
      `<p style="position:absolute;inset:0;margin:auto;height:max-content;text-align:center;padding:24px">` +
      `${e.message}<br>Si abres index.html directamente y no carga, usa un servidor local (por ejemplo: python -m http.server).</p>`);
    console.error(e);
  }
}

iniciar();
