/* Paisaje animado: cielo (estrellas, fugaces, deseos, luna) y lago. */

function limiteCielo(x) {
  const pts = CFG.HORIZONTE;
  x = limitar(x, pts[0][0], pts[pts.length - 1][0]);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if (x >= x0 && x <= x1) return y0 + (y1 - y0) * (x1 > x0 ? (x - x0) / (x1 - x0) : 0);
  }
  return pts[pts.length - 1][1];
}

/* ---- helpers de dibujo ---------------------------------------------------- */
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${(a / 255).toFixed(3)})`;

function rect(ctx, c, a, x, y, w, h) {
  ctx.fillStyle = rgba(c, a);
  ctx.fillRect(x, y, w, h);
}

function anillo(ctx, c, a, x, y, r, grosor = 1) {
  ctx.strokeStyle = rgba(c, a);
  ctx.lineWidth = grosor;
  ctx.beginPath();
  ctx.arc(x + 0.5, y + 0.5, Math.max(0.5, r - grosor / 2), 0, TAU);
  ctx.stroke();
}

/** Círculo luminoso con degradado suave (halos de luna y estrellas). */
function crearBrillo(radio, color, intensidad = 1, potencia = 2) {
  const c = document.createElement("canvas");
  c.width = c.height = radio * 2;
  const g = c.getContext("2d");
  const im = g.createImageData(radio * 2, radio * 2);
  for (let y = 0; y < radio * 2; y++) {
    for (let x = 0; x < radio * 2; x++) {
      const d = Math.hypot(x + 0.5 - radio, y + 0.5 - radio);
      if (d >= radio) continue;
      const i = (y * radio * 2 + x) * 4;
      im.data[i] = color[0];
      im.data[i + 1] = color[1];
      im.data[i + 2] = color[2];
      im.data[i + 3] = 255 * intensidad * Math.pow(1 - d / radio, potencia);
    }
  }
  g.putImageData(im, 0, 0);
  return c;
}

function dibujarBrillo(ctx, img, alpha, cx, cy) {
  ctx.globalAlpha = limitar(alpha / 255, 0, 1);
  ctx.drawImage(img, Math.round(cx - img.width / 2), Math.round(cy - img.height / 2));
  ctx.globalAlpha = 1;
}

/** Destello de cuatro puntas dibujado píxel a píxel. */
function rotulo(ctx, c, x, y, brazo, alpha) {
  rect(ctx, c, alpha, x - 1, y - 1, 2, 2);
  for (let k = 1; k <= brazo; k++) {
    const a = alpha * (1 - k / (brazo + 1));
    rect(ctx, c, a, x - 1 - k, y, 1, 1);
    rect(ctx, c, a, x + 1 + k - 1, y, 1, 1);
    rect(ctx, c, a, x, y - 1 - k, 1, 1);
    rect(ctx, c, a, x, y + 1 + k - 1, 1, 1);
  }
}

/* ==========================================================================
   Objetos del cielo
   ========================================================================== */
class EstrellaFija {
  static RADIO_CLIC = 16;

  constructor(x, y, tam, rng) {
    this.x = x; this.y = y; this.tam = tam;
    this.fase = uniforme(rng, 0, TAU);
    this.vel = uniforme(rng, 0.8, 2.2);
    this.color = elegir(rng, [[255, 255, 255], [255, 244, 220], [214, 230, 255]]);
    this.flash = 0;                      // destello extra tras un clic
  }

  actualizar(dt) { this.flash = Math.max(0, this.flash - dt * 1.4); }

  dibujar(ctx, t, hover, brillos) {
    let b = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * this.vel + this.fase));
    b = Math.min(1, b + this.flash);
    const a = 255 * b;
    const x = Math.floor(this.x), y = Math.floor(this.y);
    if (this.tam === 1) {
      rect(ctx, this.color, a, x - 1, y - 1, 2, 2);
    } else if (this.tam === 2) {
      rotulo(ctx, this.color, x, y, 2, a);
    } else {
      dibujarBrillo(ctx, brillos.blanco, 90 * b, x, y);
      rotulo(ctx, this.color, x, y, 5, a);
    }
    if (this.flash > 0) anillo(ctx, [255, 255, 255], 160 * this.flash, x, y, Math.floor(6 + 18 * (1 - this.flash)));
    if (hover) anillo(ctx, [255, 255, 255], 120, x, y, 10);
  }
}

class EstrellaFugaz {
  static RADIO_CLIC = 36;

  constructor(rng) {
    const ang = (uniforme(rng, 14, 26) * Math.PI) / 180;
    this.sentido = rng() < 0.7 ? -1 : 1;
    this.dx = this.sentido * Math.cos(ang);
    this.dy = Math.sin(ang);
    const y0 = uniforme(rng, 30, 170);
    this.x0 = this.sentido < 0 ? uniforme(rng, 640, 1230) : uniforme(rng, 60, 600);
    this.y0 = y0;
    const largo = Math.min(uniforme(rng, 480, 640), (395 - y0) / Math.sin(ang));
    this.duracion = largo / uniforme(rng, 175, 235);
    this.largo = largo;
    this.t = 0;
    this.x = this.x0; this.y = this.y0;
    this.capturada = false;
    this.viva = true;
    this.pulso = 0;
  }

  get envolvente() {
    const p = this.t / this.duracion;
    return Math.min(1, p / 0.12, (1 - p) / 0.25);
  }
  get clicable() { return this.viva && (this.capturada || this.envolvente > 0.25); }
  capturar() { this.capturada = true; }
  liberar() { this.capturada = false; }

  actualizar(dt) {
    this.pulso += dt;
    if (this.capturada) return;
    this.t += dt;
    const p = this.t / this.duracion;
    if (p >= 1) { this.viva = false; return; }
    this.x = this.x0 + this.dx * this.largo * p;
    this.y = this.y0 + this.dy * this.largo * p;
  }

  dibujar(ctx, t, hover, brillos) {
    const env = this.capturada ? 1 : Math.max(0, this.envolvente);
    if (env <= 0) return;
    // estela: cuadraditos que se desvanecen y encogen
    const n = 46, paso = 3.2;
    for (let i = 0; i < n; i++) {
      const f = i / n;
      const px = this.x - this.dx * i * paso;
      const py = this.y - this.dy * i * paso;
      const lado = f < 0.25 ? 3 : (f < 0.6 ? 2 : 1);
      const a = 255 * env * Math.pow(1 - f, 1.7);
      if (a > 3) {
        const col = f < 0.3 ? [255, 255, 255] : [255, 200, 235];
        rect(ctx, col, a, Math.floor(px) - Math.floor(lado / 2), Math.floor(py) - Math.floor(lado / 2), lado, lado);
      }
    }
    dibujarBrillo(ctx, brillos.rosa, 200 * env, Math.floor(this.x), Math.floor(this.y));
    rotulo(ctx, [255, 255, 255], Math.floor(this.x), Math.floor(this.y), 4, 255 * env);
    // anillo discreto que invita a hacer clic
    const a = (70 + 40 * Math.sin(this.pulso * 5)) * env;
    anillo(ctx, [255, 220, 240], a, Math.floor(this.x), Math.floor(this.y), 16 + (hover ? 4 : 0));
  }
}

class EstrellaDeseo {
  static RADIO_CLIC = 20;

  constructor(datos, nueva = false) {
    this.id = datos.id;
    this.texto = datos.texto;
    this.fecha = datos.fecha;
    this.x = datos.x; this.y = datos.y;
    this.edad = nueva ? 0 : 99;
    let h = 0;
    for (const ch of String(this.id)) h = (h * 31 + ch.charCodeAt(0)) % 1000;
    this.fase = (h / 1000) * TAU;
    this.resalte = 0;
  }

  actualizar(dt) {
    this.edad += dt;
    this.resalte = Math.max(0, this.resalte - dt);
  }

  dibujar(ctx, t, hover, brillos) {
    const nac = Math.min(1, this.edad / 1.4);
    const esc = 1 - Math.pow(1 - nac, 3) + 0.25 * Math.sin(nac * Math.PI);   // rebote suave
    const pulso = 0.5 + 0.5 * Math.sin(t * 1.6 + this.fase);
    const x = Math.floor(this.x), y = Math.floor(this.y);
    dibujarBrillo(ctx, brillos.oro, (110 + 70 * pulso) * Math.min(1, nac * 1.5), x, y);
    rotulo(ctx, CFG.ORO, x, y, Math.max(1, Math.floor(8 * esc)), 255);
    rect(ctx, [255, 255, 255], 255, x - 1, y - 1, 2, 2);
    if (this.edad < 1.8) {                                   // onda de nacimiento
      const r = Math.floor(6 + 60 * (this.edad / 1.8));
      anillo(ctx, [255, 230, 170], 200 * (1 - this.edad / 1.8), x, y, r, 2);
    }
    if (this.resalte > 0) {
      const r = Math.floor(14 + 10 * Math.sin(t * 8));
      anillo(ctx, [255, 236, 190], 255 * Math.min(1, this.resalte), x, y, r, 2);
    }
    if (hover) anillo(ctx, [255, 255, 255], 140, x, y, 14);
  }
}

/* ==========================================================================
   Cielo
   ========================================================================== */
class Cielo {
  constructor(deseosGuardados) {
    const rng = crearRng(7);              // misma constelación en cada ejecución
    this.rng = Math.random;
    this.brillos = {
      blanco: crearBrillo(14, [255, 255, 255], 0.55),
      rosa: crearBrillo(26, [255, 190, 230], 0.8),
      oro: crearBrillo(30, [255, 214, 120], 0.8),
    };
    this.haloLuna = crearBrillo(96, [225, 205, 255], 0.55);
    this.estrellas = this._crearEstrellas(rng);
    this.fugaces = [];
    this.deseos = deseosGuardados.map((d) => new EstrellaDeseo(d));
    this.particulas = [];
    this.hastaFugaz = 3.5;                // la primera llega pronto
    this.pausaFugaces = false;
    this.nuevas = [];                     // fugaces recién creadas (las lee main)
  }

  _crearEstrellas(rng, n = 62) {
    const lista = [];
    let intentos = 0;
    while (lista.length < n && intentos < 4000) {
      intentos++;
      const x = uniforme(rng, 14, CFG.ANCHO - 14);
      const tope = limiteCielo(x) - 14;
      if (tope < 60) continue;
      const y = 16 + (tope - 16) * Math.pow(rng(), 1.15);
      if (Math.hypot(x - CFG.LUNA_CENTRO[0], y - CFG.LUNA_CENTRO[1]) < 78) continue;
      if (x > 1000 && y < 74) continue;                        // zona de los controles
      if (lista.some((e) => Math.hypot(x - e.x, y - e.y) < 40)) continue;
      const r = rng();
      const tam = r < 0.55 ? 1 : (r < 0.88 ? 2 : 3);
      lista.push(new EstrellaFija(x, y, tam, rng));
    }
    return lista;
  }

  /** Coloca una estrella-deseo dentro del cielo y sin pisar a otra. */
  ajustarPosicion(x, y) {
    const W = CFG.ANCHO;
    x = limitar(x, 40, W - 40);
    y = limitar(y, 40, limiteCielo(x) - 20);
    if (x > 980 && y < 84) y = 84;
    for (let i = 0; i < 40; i++) {
      if (this.deseos.every((d) => Math.hypot(x - d.x, y - d.y) > 34)) break;
      x += uniforme(this.rng, -30, 30);
      y += uniforme(this.rng, -20, 20);
      x = limitar(x, 40, W - 40);
      y = limitar(y, 40, limiteCielo(x) - 20);
    }
    return [x, y];
  }

  agregarDeseo(datos, nueva = true) {
    const d = new EstrellaDeseo(datos, nueva);
    this.deseos.push(d);
    if (nueva) {
      for (let i = 0; i < 22; i++) {
        const ang = uniforme(this.rng, 0, TAU);
        const vel = uniforme(this.rng, 30, 120);
        this.particulas.push([d.x, d.y, Math.cos(ang) * vel, Math.sin(ang) * vel,
          uniforme(this.rng, 0.8, 1.6), 0]);
      }
    }
    return d;
  }

  destacar(id) {
    const d = this.deseos.find((e) => e.id === id);
    if (d) d.resalte = 3;
    return d || null;
  }

  actualizar(dt) {
    this.estrellas.forEach((e) => e.actualizar(dt));
    this.deseos.forEach((d) => d.actualizar(dt));
    this.fugaces.forEach((f) => f.actualizar(dt));
    this.fugaces = this.fugaces.filter((f) => f.viva);
    for (const p of this.particulas) {
      p[0] += p[2] * dt; p[1] += p[3] * dt;
      p[2] *= 0.97; p[3] *= 0.97;
      p[5] += dt;
    }
    this.particulas = this.particulas.filter((p) => p[5] < p[4]);

    if (!this.pausaFugaces) {
      this.hastaFugaz -= dt;
      if (this.hastaFugaz <= 0 && this.fugaces.length < 3) {
        const f = new EstrellaFugaz(this.rng);
        this.fugaces.push(f);
        this.nuevas.push(f);
        this.hastaFugaz = uniforme(this.rng, 4.5, 9.5);
      }
    }
  }

  /** Qué hay bajo el cursor: ["deseo"|"fugaz"|"estrella", objeto] o null. */
  objetivoEn(pos) {
    const [mx, my] = pos;
    for (let i = this.deseos.length - 1; i >= 0; i--) {
      const d = this.deseos[i];
      if (Math.hypot(mx - d.x, my - d.y) <= EstrellaDeseo.RADIO_CLIC) return ["deseo", d];
    }
    for (const f of this.fugaces) {
      if (f.clicable && Math.hypot(mx - f.x, my - f.y) <= EstrellaFugaz.RADIO_CLIC) return ["fugaz", f];
    }
    let mejor = null, dmin = EstrellaFija.RADIO_CLIC;
    for (const e of this.estrellas) {
      const dist = Math.hypot(mx - e.x, my - e.y);
      if (dist <= dmin) { mejor = e; dmin = dist; }
    }
    return mejor ? ["estrella", mejor] : null;
  }

  dibujar(ctx, t, posRaton) {
    // halo de la luna y destellos en sus puntas
    const pulso = 0.5 + 0.5 * Math.sin(t * 0.9);
    ctx.globalAlpha = (95 + 55 * pulso) / 255;
    ctx.drawImage(this.haloLuna, CFG.LUNA_CENTRO[0] - 96 - 6, CFG.LUNA_CENTRO[1] - 96 + 4);
    ctx.globalAlpha = 1;

    const hover = posRaton ? this.objetivoEn(posRaton) : null;
    const sel = hover ? hover[1] : null;
    for (const e of this.estrellas) e.dibujar(ctx, t, e === sel, this.brillos);
    for (const [sx, sy, ph] of [[294, 99, 0.0], [355, 162, 2.1]]) {          // puntas de la luna
      const a = 0.5 + 0.5 * Math.sin(t * 1.7 + ph);
      rotulo(ctx, [255, 245, 255], sx, sy, 4 + Math.floor(3 * a), 120 + 135 * a);
    }
    for (const d of this.deseos) d.dibujar(ctx, t, d === sel, this.brillos);
    for (const f of this.fugaces) f.dibujar(ctx, t, f === sel, this.brillos);
    for (const [x, y, , , vida, edad] of this.particulas) {
      rect(ctx, [255, 226, 160], 255 * (1 - edad / vida), Math.floor(x), Math.floor(y), 2, 2);
    }
    return hover;
  }
}

/* ==========================================================================
   Lago
   ========================================================================== */
class Lago {
  static FRANJA = 2;

  constructor(fondo) {
    this.fondo = fondo;                          // canvas con el paisaje a 1280 x 768
    this.alto = CFG.ALTO - CFG.Y_ORILLA;
    this.rng = Math.random;
    this.ondas = [];
    this.hastaOnda = 0.3;
    this.brilloLuna = crearBrillo(70, [235, 200, 255], 0.5);
    this.destellos = [];
    const { ANCHO, ALTO, Y_ORILLA, LUNA_REFLEJO } = CFG;
    for (let i = 0; i < 46; i++) {
      const cerca = i < 14;                      // algunos junto a la luna
      const x = cerca ? gauss(this.rng, LUNA_REFLEJO[0], 55) : uniforme(this.rng, 20, ANCHO - 20);
      const y = cerca ? gauss(this.rng, LUNA_REFLEJO[1], 22) : uniforme(this.rng, 530, 755);
      this.destellos.push({
        x, y: Math.min(Math.max(y, Y_ORILLA + 14), ALTO - 8),
        largo: entero(this.rng, 5, 16), fase: uniforme(this.rng, 0, TAU),
        vel: uniforme(this.rng, 0.7, 1.9),
      });
    }
  }

  actualizar(dt) {
    for (const o of this.ondas) o.t += dt;
    this.ondas = this.ondas.filter((o) => o.t < o.dur);
    this.hastaOnda -= dt;
    if (this.hastaOnda <= 0) {
      const { ANCHO, ALTO, Y_ORILLA } = CFG;
      const y = uniforme(this.rng, Y_ORILLA + 28, ALTO - 20);
      const prof = (y - Y_ORILLA) / this.alto;                  // más cerca = más grande
      this.ondas.push({
        x: uniforme(this.rng, 50, ANCHO - 50), y,
        rmax: 8 + 44 * prof + uniforme(this.rng, 0, 10),
        dur: uniforme(this.rng, 3.2, 4.6), t: 0,
      });
      this.hastaOnda = uniforme(this.rng, 0.5, 1.5);
    }
  }

  dibujar(ctx, t) {
    const { ANCHO, Y_ORILLA, LUNA_REFLEJO } = CFG;
    // reflejo: cada franja se desplaza lateralmente con ondas lentas
    for (let y = 0; y < this.alto; y += Lago.FRANJA) {
      const prof = y / this.alto;
      const amp = 0.5 + 3.2 * prof;
      const dx = amp * (Math.sin(t * 1.15 + y * 0.085) * 0.65 + Math.sin(t * 0.6 - y * 0.037) * 0.35);
      ctx.drawImage(this.fondo, 0, Y_ORILLA + y, ANCHO, Lago.FRANJA,
        Math.round(dx), Y_ORILLA + y, ANCHO, Lago.FRANJA);
    }
    // brillo de la luna sobre el agua
    ctx.globalAlpha = (80 + 40 * Math.sin(t * 1.1)) / 255;
    ctx.drawImage(this.brilloLuna, LUNA_REFLEJO[0] - 70, LUNA_REFLEJO[1] - 70);
    ctx.globalAlpha = 1;
    // destellos que titilan
    for (const d of this.destellos) {
      const b = 0.5 + 0.5 * Math.sin(t * d.vel + d.fase);
      const a = 170 * b * b;
      if (a > 6) {
        const dx = Math.trunc(2 * Math.sin(t * 0.8 + d.fase));
        rect(ctx, [255, 205, 240], a, Math.floor(d.x) + dx, Math.floor(d.y), d.largo, 1);
      }
    }
    // ondas elípticas que se expanden y se desvanecen
    for (const o of this.ondas) {
      const p = o.t / o.dur;
      for (const retraso of [0, 0.22]) {
        const q = p - retraso;
        if (q <= 0) continue;
        const r = (o.rmax * q) / (1 - retraso);
        const a = 150 * Math.pow(1 - q, 1.6);
        if (a > 4 && r >= 2) {
          ctx.strokeStyle = rgba([255, 200, 240], a);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(Math.floor(o.x) + 0.5, Math.floor(o.y) + 0.5, Math.floor(r), Math.max(1, Math.floor(r * 0.5) / 2 * 1), 0, 0, TAU);
          ctx.stroke();
        }
      }
    }
  }
}
