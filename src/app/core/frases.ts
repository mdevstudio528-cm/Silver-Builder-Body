export const FRASES: string[] = [
  'Surfea el dolor: cada serie es una onda cósmica.',
  'El poder cósmico vive en la constancia.',
  'Tu límite es solo una estrella lejana: sigue volando.',
  'La disciplina es tu tabla: surfea hacia tu mejor versión.',
  'Una serie más. El universo lo nota.',
  'De hierro y plata se forja tu destino.',
  'No es gym, es tu misión cósmica diaria.',
  'Sé imparable como el surfista plateado.',
  'Muéstrale al universo de qué estás hecho.',
  'Respira. Empuja. Repite. Brilla.',
  'Los lunes construyen leyendas.',
  'El cuerpo se forja en el esfuerzo, la mente en la constancia.',
  'No cuentes las repeticiones: haz que las repeticiones te cuenten.',
  'La fuerza de hoy es la plata de mañana.',
  'Los héroes no dejan de esforzarse, dejan de rendirse.'
];

export function fraseDelDia(): string {
  const dia = Math.floor(Date.now() / 86400000);
  return FRASES[dia % FRASES.length];
}

export function fraseAleatoria(actual: string | null = null): string {
  let f = FRASES[Math.floor(Math.random() * FRASES.length)];
  if (FRASES.length > 1) {
    while (f === actual) {
      f = FRASES[Math.floor(Math.random() * FRASES.length)];
    }
  }
  return f;
}
