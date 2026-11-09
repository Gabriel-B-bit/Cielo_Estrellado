/* Configuración general de «Un cielo lleno de deseos» */
const CFG = {
  TITULO: "Un cielo lleno de deseos",
  ANCHO: 1280,
  ALTO: 768,

  // Escenario (coordenadas sobre la imagen de 1280 x 768)
  Y_ORILLA: 506,            // donde termina la tierra y empieza el lago
  Y_PIES: 510,              // línea por la que camina la princesa
  LUNA_CENTRO: [316, 140],
  LUNA_REFLEJO: [316, 702],

  // Contorno aproximado de árboles y montañas: las estrellas solo nacen por encima.
  HORIZONTE: [
    [0, 168], [372, 168], [384, 258], [450, 234], [530, 250], [700, 338],
    [850, 380], [960, 344], [1050, 318], [1130, 296], [1280, 346],
  ],

  // Paleta
  ORO: [255, 222, 140],

  // Princesa
  ESCALA_PRINCESA: 2,
  VEL_CAMINAR: 5.0,         // píxeles por segundo
  LIMITE_IZQ: 170,
  LIMITE_DER: 1110,

  // Deseos
  MAX_CARACTERES_DESEO: 160,
  CLAVE_DESEOS: "cielo-de-deseos-v1",

  // Mensajes de las estrellas: [tipo, texto]. Tipos: "motivacion" (azul) y "romantico" (rosa).
  MENSAJES: [
    ["motivacion", "Nunca dudes de lo capaz que eres."],
    ["motivacion", "Incluso los días difíciles tienen algo que enseñarnos."],
    ["motivacion", "Sigue adelante, tienes muchas cosas bonitas por descubrir."],
    ["motivacion", "No olvides lo mucho que vales."],
    ["motivacion", "Cada paso, aunque sea pequeño, te acerca a lo que sueñas."],
    ["motivacion", "Respira hondo: lo estás haciendo mejor de lo que crees."],
    ["motivacion", "Eres más fuerte que cualquier día difícil."],
    ["motivacion", "Lo que hoy parece imposible, mañana será tu mejor historia."],
    ["romantico", "Si pudiera pedir un deseo, sería verte sonreír."],
    ["romantico", "Hay personas que hacen especial hasta el momento más sencillo."],
    ["romantico", "Ojalá nunca olvides lo maravillosa que eres."],
    ["romantico", "Algunas personas son como las estrellas: hacen más bonita la oscuridad."],
    ["romantico", "Contigo, hasta el silencio se siente bonito."],
    ["romantico", "Tu sonrisa merece su propia constelación."],
    ["romantico", "Si el cielo guardara recuerdos, estaría lleno de ti."],
    ["romantico", "Esta noche cada estrella brilla un poquito por ti."],
  ],
};

/* ---- utilidades -------------------------------------------------------- */
const TAU = Math.PI * 2;

function crearRng(semilla) {                 // mulberry32: aleatorio repetible
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const uniforme = (rng, a, b) => a + (b - a) * rng();
const entero = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const elegir = (rng, lista) => lista[Math.floor(rng() * lista.length)];
function gauss(rng, media, sigma) {
  const u = 1 - rng(), v = rng();
  return media + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
