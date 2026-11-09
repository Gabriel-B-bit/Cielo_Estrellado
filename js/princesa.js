/* La princesa: carga la tira de sprites (assets/princesa.png) y la anima por la orilla.
   La tira tiene 10 fotogramas de 26x38 px: 6 caminando, 2 en reposo, 2 mirando al cielo. */

const FW = 26, FH = 38;
const N_CAMINAR = 6, N_REPOSO = 2, N_MIRAR = 2;
const N_FOTOGRAMAS = N_CAMINAR + N_REPOSO + N_MIRAR;
const IDX_REPOSO = N_CAMINAR;
const IDX_MIRAR = N_CAMINAR + N_REPOSO;

function crearLienzo(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  return [c, g];
}

class Princesa {
  static ACEL = 38.0;                 // px/s² -> arranca y frena con suavidad

  constructor(hoja) {
    const e = CFG.ESCALA_PRINCESA;
    const w = FW * e, h = FH * e;
    this.der = []; this.izq = [];
    for (let i = 0; i < N_FOTOGRAMAS; i++) {
      const [c, g] = crearLienzo(w, h);
      g.drawImage(hoja, i * FW, 0, FW, FH, 0, 0, w, h);
      this.der.push(c);
      const [ci, gi] = crearLienzo(w, h);
      gi.translate(w, 0);
      gi.scale(-1, 1);
      gi.drawImage(c, 0, 0);
      this.izq.push(ci);
    }
    this.base = 36 * e;                                  // fila donde apoyan los pies (los sprites miden 36 px hasta los zapatos)
    this.reflejos = { false: this.der.map((f) => this._crearReflejo(f)),
                      true: this.izq.map((f) => this._crearReflejo(f)) };

    this.x = 300;
    this.dir = 1;                       // sentido de la marcha
    this.cara = 1;                      // hacia dónde mira el sprite
    this.vel = 0;
    this.estado = "caminar";            // "caminar" | "pausa"
    this.tAnim = 0;
    this.hastaPausa = uniforme(Math.random, 5, 9);
    this.tPausa = 0;
    this.tQuieta = 0;
    this.quiereMirar = false;
    this.retardoMirar = 0.5;
    this.girarAlAcabar = false;
    this.mirando = false;
    this.caraHacia = null;
  }

  /** Reflejo en el lago (precalculado): vuelto del revés, teñido y desvanecido hacia abajo.
      Se hace solo con composición de canvas (sin leer píxeles) para que funcione también con file://. */
  _crearReflejo(f) {
    const w = f.width, h = f.height;
    const [c, g] = crearLienzo(w, h);
    const volteado = () => {
      g.save();
      g.translate(0, h);
      g.scale(1, -1);
      g.drawImage(f, 0, 0);
      g.restore();
    };
    volteado();
    g.globalCompositeOperation = "multiply";            // tinte violeta
    g.fillStyle = "rgb(190,150,235)";
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "destination-in";      // recupera la silueta del sprite
    volteado();
    const deg = g.createLinearGradient(0, 0, 0, h);      // se desvanece hacia abajo
    for (let i = 0; i <= 16; i++) deg.addColorStop(i / 16, `rgba(0,0,0,${((120 / 255) * Math.pow(1 - i / 16, 1.4)).toFixed(4)})`);
    g.fillStyle = deg;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "source-over";
    return c;
  }

  /** Se detiene y levanta la mirada hacia una estrella fugaz. */
  mirarEstrella(xEstrella) {
    this.quiereMirar = true;
    this.retardoMirar = 0.3;
    this.hastaPausa = uniforme(Math.random, 9, 15);
    if (this.estado === "caminar") {
      this.estado = "pausa";
      this.tPausa = 3.0;
      this.tQuieta = 0;
      this.girarAlAcabar = false;
    } else {
      this.tPausa = Math.max(this.tPausa, 2.6);
    }
    this.caraHacia = xEstrella > this.x ? 1 : -1;
  }

  _iniciarPausa(mirar, duracion, girar = false) {
    this.estado = "pausa";
    this.tPausa = duracion;
    this.tQuieta = 0;
    this.quiereMirar = mirar;
    this.retardoMirar = 0.5;
    this.girarAlAcabar = girar;
    this.caraHacia = null;
  }

  actualizar(dt) {
    const V = CFG.VEL_CAMINAR;
    const objetivo = this.estado === "caminar" ? V : 0;
    const paso = Princesa.ACEL * dt;
    this.vel += Math.max(-paso, Math.min(paso, objetivo - this.vel));
    this.x += this.dir * this.vel * dt;

    if (this.estado === "caminar") {
      this.cara = this.dir;
      this.tAnim += dt * 4.5 * (this.vel / V);
      this.hastaPausa -= dt;
      if (this.x <= CFG.LIMITE_IZQ || this.x >= CFG.LIMITE_DER) {
        this.x = limitar(this.x, CFG.LIMITE_IZQ, CFG.LIMITE_DER);
        this._iniciarPausa(false, 1.4, true);
      } else if (this.hastaPausa <= 0) {
        this._iniciarPausa(true, uniforme(Math.random, 4.0, 6.5));
      }
      this.mirando = false;
    } else if (this.vel < 1.0) {                    // ya está quieta
      this.vel = 0;
      this.tQuieta += dt;
      this.tAnim += dt;
      if (this.caraHacia) this.cara = this.caraHacia;
      this.mirando = this.quiereMirar && this.tQuieta > this.retardoMirar;
      this.tPausa -= dt;
      if (this.tPausa <= 0) {
        if (this.girarAlAcabar) this.dir = -this.dir;
        this.cara = this.dir;
        this.estado = "caminar";
        this.mirando = false;
        this.quiereMirar = false;
        this.hastaPausa = uniforme(Math.random, 9, 16);
      }
    } else {
      this.tAnim += dt * 6.5 * (this.vel / V);
    }
  }

  _indice() {
    if (this.estado === "caminar" || this.vel > 6) return Math.floor(this.tAnim) % N_CAMINAR;
    if (this.mirando) return IDX_MIRAR + (Math.floor(this.tAnim * 0.9) % N_MIRAR);
    return IDX_REPOSO + (Math.floor(this.tAnim * 1.1) % N_REPOSO);
  }

  _origen(ancho) {
    return [Math.trunc(this.x - ancho / 2), CFG.Y_PIES - this.base];
  }

  dibujar(ctx) {
    const img = (this.cara > 0 ? this.der : this.izq)[this._indice()];
    const [x, y] = this._origen(img.width);
    ctx.fillStyle = "rgba(20,4,30,0.353)";                 // sombra bajo los pies
    ctx.beginPath();
    ctx.ellipse(Math.trunc(this.x), CFG.Y_PIES - 2, 35, 6, 0, 0, TAU);
    ctx.fill();
    ctx.drawImage(img, x, y);
  }

  dibujarReflejo(ctx, t) {
    const img = this.reflejos[this.cara < 0][this._indice()];
    const [x] = this._origen(img.width);
    const h = img.height, w = img.width;
    const arriba = h - this.base;                  // filas vacías sobre los pies reflejados
    const yIni = CFG.Y_PIES + 2;
    for (let y = arriba; y < h; y += 3) {          // cada franja de 3 px ondula un poco
      const dx = Math.round(2.5 * Math.sin(t * 2.0 + y * 0.22));
      ctx.drawImage(img, 0, y, w, Math.min(3, h - y), x + dx, yIni + y - arriba, w, Math.min(3, h - y));
    }
  }
}
