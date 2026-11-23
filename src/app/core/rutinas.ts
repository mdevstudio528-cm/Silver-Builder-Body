export type Patron =
  | 'press' | 'presshombro' | 'curl' | 'lateral' | 'fly' | 'remo' | 'pulldown'
  | 'sentadilla' | 'rdl' | 'prensa' | 'hipthrust' | 'gemelos' | 'skull'
  | 'pushdown' | 'kickback' | 'abduccion' | 'zancada' | 'extrodilla' | 'dip' | 'flexion';

export interface Ejercicio {
  id: string;
  nombre: string;
  patron: Patron;
  series: number;
  reps: string;
  consejo?: string;
}

export interface Dia {
  id: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';
  nombre: string;
  corto: string;
  grupos: string[];
  descanso: boolean;
  ejercicios: Ejercicio[];
}

const pechoBiceps: Ejercicio[] = [
  { id: 'press-banca', nombre: 'Press de banca con barra', patron: 'press', series: 4, reps: '10', consejo: 'Baja la barra hasta el pecho sin rebotar.' },
  { id: 'press-inclinado-manc', nombre: 'Press inclinado con mancuernas', patron: 'press', series: 4, reps: '10', consejo: 'Banco a 30°, codos a 45° del torso.' },
  { id: 'aperturas-polea', nombre: 'Aperturas / cruce de cables', patron: 'fly', series: 3, reps: '12', consejo: 'Aprieta el pecho 1 segundo al cruzar.' },
  { id: 'fondos-pecho', nombre: 'Fondos en paralelas', patron: 'dip', series: 3, reps: '10', consejo: 'Inclina el torso al frente para más pecho.' },
  { id: 'flexiones', nombre: 'Flexiones de pecho', patron: 'flexion', series: 3, reps: '15', consejo: 'Cuerpo firme como tabla, hasta el final.' },
  { id: 'curl-barra', nombre: 'Curl de bíceps con barra', patron: 'curl', series: 4, reps: '10', consejo: 'Codos pegados al torso, sin balanceo.' },
  { id: 'curl-martillo', nombre: 'Curl martillo con mancuernas', patron: 'curl', series: 3, reps: '12', consejo: 'Agarre neutro, controla la bajada.' }
];

const hombroEspaldaTriceps: Ejercicio[] = [
  { id: 'press-militar', nombre: 'Press militar con barra', patron: 'presshombro', series: 4, reps: '10', consejo: 'Abdomen apretado, barra al mentón.' },
  { id: 'elev-laterales', nombre: 'Elevaciones laterales', patron: 'lateral', series: 4, reps: '12', consejo: 'Sube hasta la altura del hombro, sin encogerte.' },
  { id: 'remo-barra', nombre: 'Remo con barra', patron: 'remo', series: 4, reps: '10', consejo: 'Espalda recta, lleva el codo hacia atrás.' },
  { id: 'jalon-pecho', nombre: 'Jalón al pecho en polea', patron: 'pulldown', series: 4, reps: '10', consejo: 'Pecho afuera, tira con los codos.' },
  { id: 'face-pull', nombre: 'Face pull en polea', patron: 'remo', series: 3, reps: '12', consejo: 'Codos altos, abre al final.' },
  { id: 'press-frances', nombre: 'Press francés (skull crusher)', patron: 'skull', series: 3, reps: '12', consejo: 'Solo se mueve el antebrazo, codos fijos.' },
  { id: 'pushdown-polea', nombre: 'Extensiones de tríceps en polea', patron: 'pushdown', series: 3, reps: '12', consejo: 'Extiende por completo abajo.' }
];

const piernaCompleta: Ejercicio[] = [
  { id: 'sentadilla-barra', nombre: 'Sentadilla con barra', patron: 'sentadilla', series: 4, reps: '10', consejo: 'Baja hasta que el muslo quede paralelo.' },
  { id: 'prensa', nombre: 'Prensa de piernas', patron: 'prensa', series: 4, reps: '12', consejo: 'No bloquee las rodillas arriba.' },
  { id: 'rdl', nombre: 'Peso muerto rumano', patron: 'rdl', series: 4, reps: '10', consejo: 'Espalda recta, sienta la cadera atrás.' },
  { id: 'zancadas', nombre: 'Zancadas con mancuernas', patron: 'zancada', series: 3, reps: '12 por pierna', consejo: 'Rodilla de atrás casi al suelo.' },
  { id: 'ext-cuad', nombre: 'Extensión de cuádriceps', patron: 'extrodilla', series: 3, reps: '12', consejo: 'Aprieta arriba 1 segundo.' },
  { id: 'curl-fem', nombre: 'Curl femoral', patron: 'extrodilla', series: 3, reps: '12', consejo: 'Bajada lenta y controlada.' },
  { id: 'gemelos-parados', nombre: 'Elevación de gemelos de pie', patron: 'gemelos', series: 4, reps: '15', consejo: 'Pausa arriba, estira abajo.' }
];

const gluteoGemelos: Ejercicio[] = [
  { id: 'hip-thrust', nombre: 'Hip thrust con barra', patron: 'hipthrust', series: 4, reps: '12', consejo: 'Aprieta el glúteo arriba 2 segundos.' },
  { id: 'rdl-mancuernas', nombre: 'Peso muerto rumano con mancuernas', patron: 'rdl', series: 4, reps: '12', consejo: 'Siente el estiramiento del glúteo.' },
  { id: 'patada-polea', nombre: 'Patada de glúteo en polea', patron: 'kickback', series: 3, reps: '12 por pierna', consejo: 'Empuja con el talón hacia arriba.' },
  { id: 'abduccion', nombre: 'Abducción de cadera en máquina', patron: 'abduccion', series: 3, reps: '15', consejo: 'No dejes que el peso toque al abrir.' },
  { id: 'bulgara', nombre: 'Sentadilla búlgara', patron: 'zancada', series: 3, reps: '10 por pierna', consejo: 'Pie de atrás en el banco, torso erguido.' },
  { id: 'gemelos-sentado', nombre: 'Elevación de gemelos sentado', patron: 'gemelos', series: 3, reps: '20', consejo: 'Rango completo, sin rebotes.' }
];

const pechoBicepsVar: Ejercicio[] = [
  { id: 'press-inclinado-barra', nombre: 'Press inclinado con barra', patron: 'press', series: 4, reps: '10', consejo: 'Barra a la clavícula, codos a 45°.' },
  { id: 'press-plano-manc', nombre: 'Press plano con mancuernas', patron: 'press', series: 4, reps: '10', consejo: 'Estira arriba sin chocar las pesas.' },
  { id: 'cruce-cables', nombre: 'Cruce de cables alto-bajo', patron: 'fly', series: 3, reps: '12', consejo: 'Variar el ángulo del cruce por serie.' },
  { id: 'press-maquina', nombre: 'Press en máquina (pec deck)', patron: 'fly', series: 3, reps: '12', consejo: 'Aprieta el pecho en cada cierre.' },
  { id: 'curl-scott', nombre: 'Curl en banco Scott (barra Z)', patron: 'curl', series: 4, reps: '10', consejo: 'Baja lentísimo, la bajada construye.' },
  { id: 'curl-concentrado', nombre: 'Curl concentrado', patron: 'curl', series: 3, reps: '12', consejo: 'Codo apoyado en el muslo, sin impulso.' }
];

const espaldaHombroTriceps: Ejercicio[] = [
  { id: 'dominadas', nombre: 'Dominadas o jalón abierto', patron: 'pulldown', series: 4, reps: '8-10', consejo: 'Escápulas abajo antes de tirar.' },
  { id: 'remo-polea', nombre: 'Remo sentado en polea baja', patron: 'remo', series: 4, reps: '10', consejo: 'Pecho afuera, aprieta la espalda atrás.' },
  { id: 'remo-mancuerna', nombre: 'Remo con mancuerna a una mano', patron: 'remo', series: 3, reps: '12', consejo: 'Sube la mancuerna a la cadera.' },
  { id: 'press-arnold', nombre: 'Press Arnold con mancuernas', patron: 'presshombro', series: 4, reps: '10', consejo: 'Gira las muñecas al subir.' },
  { id: 'elev-frontales', nombre: 'Elevaciones frontales', patron: 'lateral', series: 3, reps: '12', consejo: 'Sube a la altura de los ojos.' },
  { id: 'fondos-banco', nombre: 'Fondos de tríceps en banco', patron: 'dip', series: 3, reps: '15', consejo: 'Codos hacia atrás, no abras.' },
  { id: 'ext-overhead', nombre: 'Extensión sobre la cabeza con mancuerna', patron: 'skull', series: 3, reps: '12', consejo: 'Codos apuntando al techo, fijos.' }
];

export const DIAS: Dia[] = [
  { id: 'lunes', nombre: 'Lunes', corto: 'LUN', grupos: ['Pecho', 'Bíceps'], descanso: false, ejercicios: pechoBiceps },
  { id: 'martes', nombre: 'Martes', corto: 'MAR', grupos: ['Hombro', 'Espalda', 'Tríceps'], descanso: false, ejercicios: hombroEspaldaTriceps },
  { id: 'miercoles', nombre: 'Miércoles', corto: 'MIÉ', grupos: ['Pierna completa'], descanso: false, ejercicios: piernaCompleta },
  { id: 'jueves', nombre: 'Jueves', corto: 'JUE', grupos: ['Pecho', 'Bíceps'], descanso: false, ejercicios: pechoBicepsVar },
  { id: 'viernes', nombre: 'Viernes', corto: 'VIE', grupos: ['Espalda', 'Hombro', 'Tríceps'], descanso: false, ejercicios: espaldaHombroTriceps },
  { id: 'sabado', nombre: 'Sábado', corto: 'SÁB', grupos: ['Glúteo', 'Gemelos'], descanso: false, ejercicios: gluteoGemelos },
  { id: 'domingo', nombre: 'Domingo', corto: 'DOM', grupos: ['Descanso'], descanso: true, ejercicios: [] }
];

export function buscarDia(id: string): Dia | undefined {
  return DIAS.find(d => d.id === id);
}
