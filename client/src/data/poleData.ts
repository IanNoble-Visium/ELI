// client/src/data/poleData.ts
// Realistic Peruvian police investigation dataset for POLE Analytics
// This data is designed to be linked to real camera events from IREX webhooks

// Note: This is a pure data module with no external dependencies
// All data is statically defined to avoid runtime initialization issues

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type POLEEntityType = "person" | "object" | "location" | "event";
export type RiskLevel = "high" | "medium" | "low";
export type PersonRole = "suspect" | "victim" | "witness" | "informant" | "associate" | "officer";
export type ObjectType = "vehicle" | "weapon" | "electronics" | "document" | "currency" | "contraband";
export type LocationType = "crime_scene" | "safehouse" | "residence" | "business" | "transit" | "meeting_point";
export type IncidentStatus = "open" | "investigating" | "resolved" | "closed";
export type IncidentPriority = "critical" | "high" | "medium" | "low";

export interface POLEPerson {
  id: string;
  name: string;
  dni: string; // Peruvian national ID
  age: number;
  role: PersonRole;
  riskLevel: RiskLevel;
  region: string;
  description?: string;
  knownAliases?: string[];
  lastSeenLocation?: string;
  lastSeenTimestamp?: string;
  associatedPlateNumbers?: string[]; // For matching with PlateMatched events
  faceEncodingId?: string; // For matching with FaceMatched events
}

export interface POLEObject {
  id: string;
  name: string;
  type: ObjectType;
  description: string;
  status: "evidence" | "recovered" | "missing" | "tracked" | "flagged";
  plateNumber?: string; // For vehicles - matches PlateMatched events
  serialNumber?: string;
  ownerId?: string; // Reference to POLEPerson
}

export interface POLELocation {
  id: string;
  name: string;
  type: LocationType;
  region: string;
  district: string;
  address?: string;
  latitude: number;
  longitude: number;
}

export interface POLEIncident {
  id: string;
  type: string; // Robo agravado, Tráfico de drogas, etc.
  description: string;
  region: string;
  district: string;
  latitude: number;
  longitude: number;
  status: IncidentStatus;
  priority: IncidentPriority;
  createdAt: string;
  updatedAt?: string;
  relatedPeopleIds: string[];
  relatedObjectIds: string[];
  relatedLocationIds: string[];
  linkedEventIds?: string[]; // Real camera event IDs from database
  assignedOfficer?: string;
  assignedUnit?: string;
  responseTime?: number;
}

export interface POLERelationship {
  source: string;
  target: string;
  type: string; // conoce_a, posee, ocurrió_en, usó_en, testigo_de, etc.
  label: string;
  value: number; // Strength of relationship 1-5
}

export interface POLEGraphNode {
  id: string;
  name: string;
  type: POLEEntityType;
  color: string;
  val: number;
  role?: string;
  riskLevel?: RiskLevel;
  region?: string;
  description?: string;
  status?: string;
  priority?: string;
  timestamp?: string;
  coordinates?: { lat: number; lng: number };
  plateNumber?: string;
  dni?: string;
  // Graph positioning
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface POLEGraphLink {
  source: string;
  target: string;
  type: string;
  label: string;
  value: number;
}

// =============================================================================
// NODE COLORS BY TYPE
// =============================================================================

export const NODE_COLORS = {
  person: "#3B82F6",    // Blue
  object: "#F59E0B",    // Orange
  location: "#8B5CF6",  // Purple
  event: "#EF4444",     // Red
};

// =============================================================================
// RELATIONSHIP TYPES
// =============================================================================

export const RELATIONSHIP_TYPES = {
  // Spanish relationship types for Peruvian context
  CONOCE_A: { label: "Conoce a", color: "#3B82F6", en: "Knows" },
  POSEE: { label: "Posee", color: "#F59E0B", en: "Owns" },
  OCURRIO_EN: { label: "Ocurrió en", color: "#8B5CF6", en: "Occurred at" },
  USO_EN: { label: "Usó en", color: "#EF4444", en: "Used in" },
  TESTIGO_DE: { label: "Testigo de", color: "#10B981", en: "Witness of" },
  VICTIMA_DE: { label: "Víctima de", color: "#EA580C", en: "Victim of" },
  SOSPECHOSO_DE: { label: "Sospechoso de", color: "#DC2626", en: "Suspect of" },
  ASOCIADO_CON: { label: "Asociado con", color: "#6B7280", en: "Associated with" },
  UBICADO_EN: { label: "Ubicado en", color: "#0891B2", en: "Located at" },
  EVIDENCIA_EN: { label: "Evidencia en", color: "#7C3AED", en: "Evidence in" },
  FRECUENTA: { label: "Frecuenta", color: "#14B8A6", en: "Frequents" },
  TRABAJA_PARA: { label: "Trabaja para", color: "#F97316", en: "Works for" },
  VISTO_EN: { label: "Visto en", color: "#06B6D4", en: "Seen at" },
};

// =============================================================================
// PERUVIAN REGIONS DATA
// =============================================================================

export const PERU_REGIONS = [
  { name: "Lima", department: "Lima", lat: -12.0464, lng: -77.0428, cameras: 850 },
  { name: "Cusco", department: "Cusco", lat: -13.5320, lng: -71.9675, cameras: 320 },
  { name: "Arequipa", department: "Arequipa", lat: -16.4090, lng: -71.5375, cameras: 280 },
  { name: "Trujillo", department: "La Libertad", lat: -8.1116, lng: -79.0288, cameras: 240 },
  { name: "Piura", department: "Piura", lat: -5.1945, lng: -80.6328, cameras: 200 },
  { name: "Chiclayo", department: "Lambayeque", lat: -6.7714, lng: -79.8409, cameras: 180 },
  { name: "Huancayo", department: "Junín", lat: -12.0651, lng: -75.2049, cameras: 140 },
  { name: "Iquitos", department: "Loreto", lat: -3.7491, lng: -73.2538, cameras: 120 },
  { name: "Tacna", department: "Tacna", lat: -18.0146, lng: -70.2536, cameras: 100 },
  { name: "Puno", department: "Puno", lat: -15.8402, lng: -70.0219, cameras: 90 },
];

// =============================================================================
// PEOPLE DATA (~25 individuals)
// =============================================================================

export const polePeople: POLEPerson[] = [
  // High-risk suspects
  {
    id: "P-001",
    name: "Carlos Alberto Mendoza Quispe",
    dni: "45678912",
    age: 34,
    role: "suspect",
    riskLevel: "high",
    region: "Lima",
    description: "Líder de organización criminal dedicada al robo agravado",
    knownAliases: ["El Chino", "Carlitos"],
    lastSeenLocation: "San Juan de Lurigancho",
    associatedPlateNumbers: ["ABC-123", "D4E-567"],
  },
  {
    id: "P-002",
    name: "Miguel Ángel Torres Huamán",
    dni: "78912345",
    age: 29,
    role: "suspect",
    riskLevel: "high",
    region: "Lima",
    description: "Asociado principal, especialista en vehículos",
    knownAliases: ["El Flaco"],
    associatedPlateNumbers: ["XYZ-789"],
  },
  {
    id: "P-003",
    name: "Roberto Carlos Silva Paredes",
    dni: "32165498",
    age: 41,
    role: "suspect",
    riskLevel: "medium",
    region: "Cusco",
    description: "Contacto regional para distribución",
    lastSeenLocation: "San Sebastián, Cusco",
    associatedPlateNumbers: ["CUS-456"],
  },
  {
    id: "P-004",
    name: "Eduardo José Vargas Rojas",
    dni: "65432178",
    age: 27,
    role: "associate",
    riskLevel: "medium",
    region: "Lima",
    description: "Cómplice en múltiples robos",
  },
  {
    id: "P-005",
    name: "Luis Fernando Ramírez Castro",
    dni: "98765432",
    age: 38,
    role: "associate",
    riskLevel: "medium",
    region: "Lima",
    description: "Proveedor de información y logística",
  },
  // Victims
  {
    id: "P-006",
    name: "Ana María García Flores",
    dni: "12345678",
    age: 45,
    role: "victim",
    riskLevel: "low",
    region: "Lima",
    description: "Víctima de robo agravado en Miraflores",
  },
  {
    id: "P-007",
    name: "María Elena Rodríguez Soto",
    dni: "87654321",
    age: 52,
    role: "victim",
    riskLevel: "low",
    region: "Arequipa",
    description: "Víctima de fraude financiero",
  },
  {
    id: "P-008",
    name: "José Luis Fernández Díaz",
    dni: "45612378",
    age: 38,
    role: "victim",
    riskLevel: "low",
    region: "Lima",
    description: "Comerciante víctima de extorsión",
  },
  // Witnesses
  {
    id: "P-009",
    name: "Juan Carlos Pérez Mamani",
    dni: "78945612",
    age: 33,
    role: "witness",
    riskLevel: "low",
    region: "Lima",
    description: "Testigo presencial del robo en banco",
  },
  {
    id: "P-010",
    name: "Sofía Valentina Hernández Cruz",
    dni: "32178945",
    age: 28,
    role: "witness",
    riskLevel: "low",
    region: "Cusco",
    description: "Testigo de actividad sospechosa",
  },
  {
    id: "P-011",
    name: "Pedro Antonio Martínez Vega",
    dni: "65498732",
    age: 55,
    role: "witness",
    riskLevel: "low",
    region: "Trujillo",
    description: "Guardia de seguridad, testigo clave",
  },
  // Informants
  {
    id: "P-012",
    name: "Fernando José Castillo Ramos",
    dni: "98732165",
    age: 31,
    role: "informant",
    riskLevel: "low",
    region: "Lima",
    description: "Informante confidencial CI-2024-015",
  },
  {
    id: "P-013",
    name: "Diego Alejandro Flores Inca",
    dni: "45678932",
    age: 26,
    role: "informant",
    riskLevel: "low",
    region: "Piura",
    description: "Fuente de información sobre tráfico",
  },
  // Drug trafficking network
  {
    id: "P-014",
    name: "Javier Enrique Salazar Condori",
    dni: "78932145",
    age: 47,
    role: "suspect",
    riskLevel: "high",
    region: "Puno",
    description: "Presunto líder de red de narcotráfico",
    knownAliases: ["El Patrón"],
    associatedPlateNumbers: ["PUN-321"],
  },
  {
    id: "P-015",
    name: "Rosa María Quispe Mamani",
    dni: "32145698",
    age: 35,
    role: "suspect",
    riskLevel: "medium",
    region: "Puno",
    description: "Coordinadora de transporte de sustancias",
  },
  // Domestic violence cases
  {
    id: "P-016",
    name: "Carmen Lucía Sánchez Huanca",
    dni: "65478932",
    age: 29,
    role: "victim",
    riskLevel: "low",
    region: "Chiclayo",
    description: "Víctima de violencia familiar",
  },
  {
    id: "P-017",
    name: "Raúl Alberto Chávez Torres",
    dni: "98745632",
    age: 34,
    role: "suspect",
    riskLevel: "medium",
    region: "Chiclayo",
    description: "Agresor en caso de violencia familiar",
  },
  // Additional suspects
  {
    id: "P-018",
    name: "Óscar Iván Delgado Puma",
    dni: "45632178",
    age: 25,
    role: "suspect",
    riskLevel: "medium",
    region: "Arequipa",
    description: "Involucrado en robo de vehículos",
    associatedPlateNumbers: ["ARQ-159"],
  },
  {
    id: "P-019",
    name: "Víctor Hugo Medina Ccama",
    dni: "78965412",
    age: 42,
    role: "suspect",
    riskLevel: "high",
    region: "Tacna",
    description: "Contrabandista conocido en frontera sur",
    associatedPlateNumbers: ["TAC-753"],
  },
  {
    id: "P-020",
    name: "Gabriela Paola Núñez Apaza",
    dni: "32198745",
    age: 30,
    role: "associate",
    riskLevel: "low",
    region: "Lima",
    description: "Asociada menor, lavado de activos",
  },
  // Officers (for assignment)
  {
    id: "P-021",
    name: "Cmdte. Ricardo Espinoza Vargas",
    dni: "12378945",
    age: 48,
    role: "officer",
    riskLevel: "low",
    region: "Lima",
    description: "Comandante DIVINCRI Lima",
  },
  {
    id: "P-022",
    name: "Cap. Mónica Arias Huamán",
    dni: "45698712",
    age: 36,
    role: "officer",
    riskLevel: "low",
    region: "Cusco",
    description: "Capitán investigaciones Cusco",
  },
  {
    id: "P-023",
    name: "Tte. Jorge Ramos Quispe",
    dni: "78912365",
    age: 32,
    role: "officer",
    riskLevel: "low",
    region: "Arequipa",
    description: "Teniente antinarcóticos Arequipa",
  },
  {
    id: "P-024",
    name: "Sgto. Luis Ccallo Mamani",
    dni: "32165478",
    age: 29,
    role: "officer",
    riskLevel: "low",
    region: "Puno",
    description: "Sargento patrullaje Puno",
  },
  {
    id: "P-025",
    name: "Alférez Patricia Condori Yupanqui",
    dni: "65432198",
    age: 27,
    role: "officer",
    riskLevel: "low",
    region: "Tacna",
    description: "Alférez control fronterizo Tacna",
  },
];

// =============================================================================
// OBJECTS DATA (~20 items)
// =============================================================================

export const poleObjects: POLEObject[] = [
  // Vehicles
  {
    id: "O-001",
    name: "Honda Civic Blanco 2019",
    type: "vehicle",
    description: "Placa ABC-123, vehículo de fuga principal",
    status: "tracked",
    plateNumber: "ABC-123",
    ownerId: "P-001",
  },
  {
    id: "O-002",
    name: "Toyota Hilux Negra 2020",
    type: "vehicle",
    description: "Placa XYZ-789, visto en múltiples ubicaciones",
    status: "flagged",
    plateNumber: "XYZ-789",
    ownerId: "P-002",
  },
  {
    id: "O-003",
    name: "Yamaha FZ 150cc",
    type: "vehicle",
    description: "Placa MNO-456, motocicleta asociada a P-003",
    status: "tracked",
    plateNumber: "MNO-456",
    ownerId: "P-003",
  },
  {
    id: "O-004",
    name: "Nissan Frontier 2018",
    type: "vehicle",
    description: "Placa D4E-567, usado para transporte de mercancía",
    status: "flagged",
    plateNumber: "D4E-567",
    ownerId: "P-001",
  },
  {
    id: "O-005",
    name: "Hyundai Accent Gris 2021",
    type: "vehicle",
    description: "Placa CUS-456, vehículo de contacto Cusco",
    status: "tracked",
    plateNumber: "CUS-456",
    ownerId: "P-003",
  },
  {
    id: "O-006",
    name: "Suzuki Alto Rojo 2017",
    type: "vehicle",
    description: "Placa PUN-321, transporte de sustancias",
    status: "flagged",
    plateNumber: "PUN-321",
    ownerId: "P-014",
  },
  // Weapons
  {
    id: "O-007",
    name: "Pistola 9mm Glock 17",
    type: "weapon",
    description: "Serial: GN-45892, recuperada en escena",
    status: "evidence",
    serialNumber: "GN-45892",
  },
  {
    id: "O-008",
    name: "Revólver .38 Special",
    type: "weapon",
    description: "Serial: RV-78234, vinculada a P-002",
    status: "evidence",
    serialNumber: "RV-78234",
    ownerId: "P-002",
  },
  {
    id: "O-009",
    name: "Cuchillo táctico",
    type: "weapon",
    description: "Hoja de 15cm, encontrado en vehículo",
    status: "evidence",
  },
  // Electronics
  {
    id: "O-010",
    name: "Laptop Dell XPS 15",
    type: "electronics",
    description: "Contiene registros financieros",
    status: "evidence",
    serialNumber: "DL-2024-78945",
  },
  {
    id: "O-011",
    name: "Teléfono prepago Samsung",
    type: "electronics",
    description: "Celular desechable con historial SMS",
    status: "evidence",
  },
  {
    id: "O-012",
    name: "iPhone 14 Pro",
    type: "electronics",
    description: "Teléfono de P-001, datos encriptados",
    status: "evidence",
    ownerId: "P-001",
  },
  {
    id: "O-013",
    name: "Tablet iPad Air",
    type: "electronics",
    description: "Usada para comunicaciones",
    status: "recovered",
  },
  // Documents
  {
    id: "O-014",
    name: "DNI Falso",
    type: "document",
    description: "Documento de identidad falsificado",
    status: "evidence",
  },
  {
    id: "O-015",
    name: "Licencia de conducir adulterada",
    type: "document",
    description: "Licencia con datos alterados",
    status: "evidence",
  },
  // Currency
  {
    id: "O-016",
    name: "Efectivo S/. 45,000",
    type: "currency",
    description: "Dinero en efectivo incautado",
    status: "recovered",
  },
  {
    id: "O-017",
    name: "Dólares USD $12,500",
    type: "currency",
    description: "Moneda extranjera sin declarar",
    status: "evidence",
  },
  // Contraband
  {
    id: "O-018",
    name: "Cocaína 5kg",
    type: "contraband",
    description: "Sustancia ilícita incautada en Puno",
    status: "evidence",
  },
  {
    id: "O-019",
    name: "Mercadería de contrabando",
    type: "contraband",
    description: "Electrónicos sin declarar, valor $25,000",
    status: "recovered",
  },
  {
    id: "O-020",
    name: "Mochila negra",
    type: "contraband",
    description: "Contenedor encontrado en escena del crimen",
    status: "evidence",
  },
];

// =============================================================================
// LOCATIONS DATA (~15 locations)
// =============================================================================

export const poleLocations: POLELocation[] = [
  // Lima locations
  {
    id: "L-001",
    name: "Banco de la Nación - Miraflores",
    type: "crime_scene",
    region: "Lima",
    district: "Miraflores",
    address: "Av. Larco 1234",
    latitude: -12.1191,
    longitude: -77.0365,
  },
  {
    id: "L-002",
    name: "Almacén San Isidro",
    type: "safehouse",
    region: "Lima",
    district: "San Isidro",
    address: "Jr. Las Begonias 456",
    latitude: -12.0977,
    longitude: -77.0369,
  },
  {
    id: "L-003",
    name: "Departamento Barranco",
    type: "residence",
    region: "Lima",
    district: "Barranco",
    address: "Calle Grau 789",
    latitude: -12.1413,
    longitude: -77.0219,
  },
  {
    id: "L-004",
    name: "Terminal Terrestre Lima Norte",
    type: "transit",
    region: "Lima",
    district: "Independencia",
    latitude: -11.9892,
    longitude: -77.0565,
  },
  {
    id: "L-005",
    name: "Puerto del Callao - Zona de carga",
    type: "meeting_point",
    region: "Lima",
    district: "Callao",
    latitude: -12.0556,
    longitude: -77.1429,
  },
  // Cusco locations
  {
    id: "L-006",
    name: "Mercado Central de Cusco",
    type: "meeting_point",
    region: "Cusco",
    district: "Cusco",
    address: "Plaza San Pedro",
    latitude: -13.5183,
    longitude: -71.9781,
  },
  {
    id: "L-007",
    name: "Hotel Turístico San Blas",
    type: "safehouse",
    region: "Cusco",
    district: "San Blas",
    latitude: -13.5150,
    longitude: -71.9750,
  },
  // Arequipa locations
  {
    id: "L-008",
    name: "Terminal Terrestre Arequipa",
    type: "transit",
    region: "Arequipa",
    district: "Arequipa",
    latitude: -16.4090,
    longitude: -71.5375,
  },
  {
    id: "L-009",
    name: "Centro Comercial Real Plaza",
    type: "business",
    region: "Arequipa",
    district: "Cayma",
    latitude: -16.3890,
    longitude: -71.5475,
  },
  // Puno locations
  {
    id: "L-010",
    name: "Frontera Desaguadero",
    type: "transit",
    region: "Puno",
    district: "Desaguadero",
    latitude: -16.5667,
    longitude: -69.0333,
  },
  {
    id: "L-011",
    name: "Almacén clandestino Juliaca",
    type: "safehouse",
    region: "Puno",
    district: "Juliaca",
    latitude: -15.5000,
    longitude: -70.1333,
  },
  // Chiclayo locations
  {
    id: "L-012",
    name: "Vivienda familiar - Chiclayo",
    type: "residence",
    region: "Chiclayo",
    district: "Chiclayo",
    address: "Urb. Santa Victoria",
    latitude: -6.7714,
    longitude: -79.8409,
  },
  // Tacna locations
  {
    id: "L-013",
    name: "Control Fronterizo Santa Rosa",
    type: "transit",
    region: "Tacna",
    district: "Tacna",
    latitude: -18.0500,
    longitude: -70.2500,
  },
  {
    id: "L-014",
    name: "Zona Franca de Tacna",
    type: "business",
    region: "Tacna",
    district: "Tacna",
    latitude: -18.0146,
    longitude: -70.2536,
  },
  // Trujillo
  {
    id: "L-015",
    name: "Centro Histórico Trujillo",
    type: "crime_scene",
    region: "Trujillo",
    district: "Trujillo",
    address: "Plaza de Armas",
    latitude: -8.1116,
    longitude: -79.0288,
  },
];

// =============================================================================
// INCIDENTS DATA (10 incidents)
// =============================================================================

export const poleIncidents: POLEIncident[] = [
  {
    id: "INC-2024-001",
    type: "Robo agravado",
    description: "Asalto a mano armada en sucursal bancaria de Miraflores. Tres sospechosos armados sustrajeron aproximadamente S/. 150,000. Vehículo de fuga identificado.",
    region: "Lima",
    district: "Miraflores",
    latitude: -12.1191,
    longitude: -77.0365,
    status: "investigating",
    priority: "critical",
    createdAt: "2024-12-08T14:30:00Z",
    relatedPeopleIds: ["P-001", "P-002", "P-004", "P-006", "P-009"],
    relatedObjectIds: ["O-001", "O-007", "O-016", "O-020"],
    relatedLocationIds: ["L-001", "L-002"],
    assignedOfficer: "Cmdte. Ricardo Espinoza Vargas",
    assignedUnit: "DIVINCRI Lima",
    responseTime: 8,
  },
  {
    id: "INC-2024-002",
    type: "Tráfico de drogas",
    description: "Incautación de 5kg de cocaína en operativo fronterizo. Dos detenidos intentando cruzar a Bolivia con sustancias ocultas en vehículo.",
    region: "Puno",
    district: "Desaguadero",
    latitude: -16.5667,
    longitude: -69.0333,
    status: "investigating",
    priority: "critical",
    createdAt: "2024-12-07T22:15:00Z",
    relatedPeopleIds: ["P-014", "P-015"],
    relatedObjectIds: ["O-006", "O-018", "O-017"],
    relatedLocationIds: ["L-010", "L-011"],
    assignedOfficer: "Sgto. Luis Ccallo Mamani",
    assignedUnit: "Antinarcóticos Puno",
    responseTime: 15,
  },
  {
    id: "INC-2024-003",
    type: "Violencia familiar",
    description: "Denuncia por agresión física contra cónyuge. Víctima presenta lesiones leves. Agresor con antecedentes previos.",
    region: "Chiclayo",
    district: "Chiclayo",
    latitude: -6.7714,
    longitude: -79.8409,
    status: "open",
    priority: "high",
    createdAt: "2024-12-08T08:45:00Z",
    relatedPeopleIds: ["P-016", "P-017"],
    relatedObjectIds: [],
    relatedLocationIds: ["L-012"],
    assignedOfficer: "Unidad de Familia",
    assignedUnit: "Comisaría Chiclayo",
    responseTime: 12,
  },
  {
    id: "INC-2024-004",
    type: "Robo de vehículo",
    description: "Sustracción de camioneta Toyota Hilux en estacionamiento de centro comercial. Cámaras captaron a dos individuos.",
    region: "Arequipa",
    district: "Cayma",
    latitude: -16.3890,
    longitude: -71.5475,
    status: "investigating",
    priority: "medium",
    createdAt: "2024-12-06T19:20:00Z",
    relatedPeopleIds: ["P-018"],
    relatedObjectIds: ["O-002"],
    relatedLocationIds: ["L-009"],
    assignedOfficer: "Tte. Jorge Ramos Quispe",
    assignedUnit: "DIVINCRI Arequipa",
    responseTime: 25,
  },
  {
    id: "INC-2024-005",
    type: "Contrabando",
    description: "Decomiso de mercadería electrónica de contrabando valorizada en $25,000 USD en zona franca.",
    region: "Tacna",
    district: "Tacna",
    latitude: -18.0146,
    longitude: -70.2536,
    status: "resolved",
    priority: "medium",
    createdAt: "2024-12-05T11:00:00Z",
    relatedPeopleIds: ["P-019"],
    relatedObjectIds: ["O-019"],
    relatedLocationIds: ["L-013", "L-014"],
    assignedOfficer: "Alférez Patricia Condori Yupanqui",
    assignedUnit: "Control Fronterizo Tacna",
    responseTime: 30,
  },
  {
    id: "INC-2024-006",
    type: "Fraude financiero",
    description: "Estafa mediante suplantación de identidad. Víctima perdió S/. 35,000 en transferencias fraudulentas.",
    region: "Arequipa",
    district: "Arequipa",
    latitude: -16.4090,
    longitude: -71.5375,
    status: "investigating",
    priority: "high",
    createdAt: "2024-12-04T16:30:00Z",
    relatedPeopleIds: ["P-007", "P-020"],
    relatedObjectIds: ["O-010", "O-014"],
    relatedLocationIds: ["L-008"],
    assignedOfficer: "Tte. Jorge Ramos Quispe",
    assignedUnit: "División de Estafas",
    responseTime: 48,
  },
  {
    id: "INC-2024-007",
    type: "Extorsión",
    description: "Comerciante denuncia amenazas y exigencia de cupos semanales por parte de organización criminal.",
    region: "Lima",
    district: "San Juan de Lurigancho",
    latitude: -12.0200,
    longitude: -76.9950,
    status: "investigating",
    priority: "high",
    createdAt: "2024-12-07T10:00:00Z",
    relatedPeopleIds: ["P-008", "P-005"],
    relatedObjectIds: ["O-011"],
    relatedLocationIds: ["L-004"],
    assignedOfficer: "Cmdte. Ricardo Espinoza Vargas",
    assignedUnit: "DIVINCRI Lima",
    responseTime: 6,
  },
  {
    id: "INC-2024-008",
    type: "Robo agravado",
    description: "Asalto a turistas en centro histórico. Sustracción de pertenencias bajo amenaza con arma blanca.",
    region: "Trujillo",
    district: "Trujillo",
    latitude: -8.1116,
    longitude: -79.0288,
    status: "open",
    priority: "medium",
    createdAt: "2024-12-08T20:15:00Z",
    relatedPeopleIds: ["P-011"],
    relatedObjectIds: ["O-009"],
    relatedLocationIds: ["L-015"],
    assignedOfficer: "Patrullaje Trujillo",
    assignedUnit: "Comisaría Central",
    responseTime: 10,
  },
  {
    id: "INC-2024-009",
    type: "Tráfico de drogas",
    description: "Detención de sospechoso con indicios de microcomercialización en zona turística de Cusco.",
    region: "Cusco",
    district: "Cusco",
    latitude: -13.5183,
    longitude: -71.9781,
    status: "resolved",
    priority: "medium",
    createdAt: "2024-12-03T23:45:00Z",
    relatedPeopleIds: ["P-003", "P-010"],
    relatedObjectIds: ["O-003", "O-005"],
    relatedLocationIds: ["L-006", "L-007"],
    assignedOfficer: "Cap. Mónica Arias Huamán",
    assignedUnit: "DIVANDRO Cusco",
    responseTime: 20,
  },
  {
    id: "INC-2024-010",
    type: "Falsificación de documentos",
    description: "Desarticulación de red de falsificación de documentos de identidad y licencias de conducir.",
    region: "Lima",
    district: "Cercado de Lima",
    latitude: -12.0464,
    longitude: -77.0428,
    status: "closed",
    priority: "high",
    createdAt: "2024-11-28T14:00:00Z",
    relatedPeopleIds: ["P-004", "P-012"],
    relatedObjectIds: ["O-014", "O-015", "O-012"],
    relatedLocationIds: ["L-003"],
    assignedOfficer: "Cmdte. Ricardo Espinoza Vargas",
    assignedUnit: "DIVINCRI Lima",
    responseTime: 72,
  },
];

// =============================================================================
// RELATIONSHIPS DATA
// =============================================================================

export const poleRelationships: POLERelationship[] = [
  // People -> People relationships
  { source: "P-001", target: "P-002", type: "CONOCE_A", label: "Cómplices", value: 5 },
  { source: "P-001", target: "P-004", type: "CONOCE_A", label: "Asociado", value: 4 },
  { source: "P-001", target: "P-005", type: "TRABAJA_PARA", label: "Logística", value: 3 },
  { source: "P-002", target: "P-003", type: "CONOCE_A", label: "Contacto regional", value: 3 },
  { source: "P-002", target: "P-004", type: "ASOCIADO_CON", label: "Operaciones", value: 3 },
  { source: "P-014", target: "P-015", type: "TRABAJA_PARA", label: "Coordinadora", value: 4 },
  { source: "P-003", target: "P-014", type: "CONOCE_A", label: "Contacto", value: 2 },
  { source: "P-017", target: "P-016", type: "CONOCE_A", label: "Cónyuge", value: 5 },
  { source: "P-012", target: "P-002", type: "ASOCIADO_CON", label: "Informante sobre", value: 2 },
  { source: "P-005", target: "P-020", type: "CONOCE_A", label: "Contacto financiero", value: 2 },
  
  // People -> Objects relationships
  { source: "P-001", target: "O-001", type: "POSEE", label: "Propietario", value: 4 },
  { source: "P-001", target: "O-004", type: "POSEE", label: "Propietario", value: 3 },
  { source: "P-001", target: "O-012", type: "POSEE", label: "Teléfono personal", value: 3 },
  { source: "P-002", target: "O-002", type: "POSEE", label: "Vehículo asociado", value: 4 },
  { source: "P-002", target: "O-008", type: "POSEE", label: "Arma vinculada", value: 4 },
  { source: "P-003", target: "O-003", type: "POSEE", label: "Motocicleta", value: 3 },
  { source: "P-003", target: "O-005", type: "POSEE", label: "Vehículo", value: 3 },
  { source: "P-014", target: "O-006", type: "POSEE", label: "Vehículo transporte", value: 4 },
  { source: "P-019", target: "O-019", type: "ASOCIADO_CON", label: "Mercadería", value: 3 },
  
  // People -> Incidents relationships
  { source: "P-001", target: "INC-2024-001", type: "SOSPECHOSO_DE", label: "Sospechoso principal", value: 5 },
  { source: "P-002", target: "INC-2024-001", type: "SOSPECHOSO_DE", label: "Cómplice", value: 4 },
  { source: "P-004", target: "INC-2024-001", type: "SOSPECHOSO_DE", label: "Participante", value: 3 },
  { source: "P-006", target: "INC-2024-001", type: "VICTIMA_DE", label: "Víctima", value: 4 },
  { source: "P-009", target: "INC-2024-001", type: "TESTIGO_DE", label: "Testigo presencial", value: 3 },
  { source: "P-014", target: "INC-2024-002", type: "SOSPECHOSO_DE", label: "Líder operación", value: 5 },
  { source: "P-015", target: "INC-2024-002", type: "SOSPECHOSO_DE", label: "Coordinadora", value: 4 },
  { source: "P-017", target: "INC-2024-003", type: "SOSPECHOSO_DE", label: "Agresor", value: 5 },
  { source: "P-016", target: "INC-2024-003", type: "VICTIMA_DE", label: "Víctima", value: 5 },
  { source: "P-018", target: "INC-2024-004", type: "SOSPECHOSO_DE", label: "Sospechoso", value: 4 },
  { source: "P-019", target: "INC-2024-005", type: "SOSPECHOSO_DE", label: "Contrabandista", value: 4 },
  { source: "P-007", target: "INC-2024-006", type: "VICTIMA_DE", label: "Víctima estafa", value: 4 },
  { source: "P-020", target: "INC-2024-006", type: "SOSPECHOSO_DE", label: "Sospechosa", value: 3 },
  { source: "P-008", target: "INC-2024-007", type: "VICTIMA_DE", label: "Víctima extorsión", value: 4 },
  { source: "P-005", target: "INC-2024-007", type: "SOSPECHOSO_DE", label: "Extorsionador", value: 4 },
  { source: "P-011", target: "INC-2024-008", type: "TESTIGO_DE", label: "Testigo", value: 3 },
  { source: "P-003", target: "INC-2024-009", type: "SOSPECHOSO_DE", label: "Detenido", value: 4 },
  { source: "P-010", target: "INC-2024-009", type: "TESTIGO_DE", label: "Testigo", value: 2 },
  { source: "P-004", target: "INC-2024-010", type: "SOSPECHOSO_DE", label: "Falsificador", value: 4 },
  { source: "P-012", target: "INC-2024-010", type: "TESTIGO_DE", label: "Informante", value: 3 },
  
  // Objects -> Incidents relationships
  { source: "O-001", target: "INC-2024-001", type: "USO_EN", label: "Vehículo de fuga", value: 5 },
  { source: "O-007", target: "INC-2024-001", type: "EVIDENCIA_EN", label: "Arma usada", value: 5 },
  { source: "O-016", target: "INC-2024-001", type: "EVIDENCIA_EN", label: "Dinero robado", value: 4 },
  { source: "O-020", target: "INC-2024-001", type: "EVIDENCIA_EN", label: "Encontrado en escena", value: 3 },
  { source: "O-006", target: "INC-2024-002", type: "USO_EN", label: "Transporte droga", value: 5 },
  { source: "O-018", target: "INC-2024-002", type: "EVIDENCIA_EN", label: "Sustancia incautada", value: 5 },
  { source: "O-017", target: "INC-2024-002", type: "EVIDENCIA_EN", label: "Dinero incautado", value: 4 },
  { source: "O-002", target: "INC-2024-004", type: "EVIDENCIA_EN", label: "Vehículo robado", value: 5 },
  { source: "O-019", target: "INC-2024-005", type: "EVIDENCIA_EN", label: "Contrabando", value: 5 },
  { source: "O-010", target: "INC-2024-006", type: "EVIDENCIA_EN", label: "Registros", value: 4 },
  { source: "O-014", target: "INC-2024-006", type: "USO_EN", label: "Documento falso", value: 4 },
  { source: "O-011", target: "INC-2024-007", type: "EVIDENCIA_EN", label: "Comunicaciones", value: 3 },
  { source: "O-009", target: "INC-2024-008", type: "USO_EN", label: "Arma blanca", value: 4 },
  { source: "O-003", target: "INC-2024-009", type: "USO_EN", label: "Transporte", value: 3 },
  { source: "O-005", target: "INC-2024-009", type: "USO_EN", label: "Vehículo", value: 3 },
  { source: "O-014", target: "INC-2024-010", type: "EVIDENCIA_EN", label: "DNI falso", value: 5 },
  { source: "O-015", target: "INC-2024-010", type: "EVIDENCIA_EN", label: "Licencia falsa", value: 5 },
  { source: "O-012", target: "INC-2024-010", type: "EVIDENCIA_EN", label: "Comunicaciones", value: 3 },
  
  // Locations -> Incidents relationships
  { source: "L-001", target: "INC-2024-001", type: "OCURRIO_EN", label: "Escena del crimen", value: 5 },
  { source: "L-002", target: "INC-2024-001", type: "ASOCIADO_CON", label: "Escondite", value: 4 },
  { source: "L-010", target: "INC-2024-002", type: "OCURRIO_EN", label: "Punto de detención", value: 5 },
  { source: "L-011", target: "INC-2024-002", type: "ASOCIADO_CON", label: "Almacén", value: 4 },
  { source: "L-012", target: "INC-2024-003", type: "OCURRIO_EN", label: "Domicilio", value: 5 },
  { source: "L-009", target: "INC-2024-004", type: "OCURRIO_EN", label: "Lugar del robo", value: 5 },
  { source: "L-013", target: "INC-2024-005", type: "OCURRIO_EN", label: "Control fronterizo", value: 5 },
  { source: "L-014", target: "INC-2024-005", type: "ASOCIADO_CON", label: "Destino mercadería", value: 3 },
  { source: "L-008", target: "INC-2024-006", type: "ASOCIADO_CON", label: "Ubicación víctima", value: 3 },
  { source: "L-004", target: "INC-2024-007", type: "ASOCIADO_CON", label: "Zona de operación", value: 3 },
  { source: "L-015", target: "INC-2024-008", type: "OCURRIO_EN", label: "Escena del crimen", value: 5 },
  { source: "L-006", target: "INC-2024-009", type: "OCURRIO_EN", label: "Lugar detención", value: 5 },
  { source: "L-007", target: "INC-2024-009", type: "ASOCIADO_CON", label: "Alojamiento", value: 3 },
  { source: "L-003", target: "INC-2024-010", type: "OCURRIO_EN", label: "Taller falsificación", value: 5 },
  
  // People -> Locations relationships
  { source: "P-001", target: "L-002", type: "FRECUENTA", label: "Escondite habitual", value: 4 },
  { source: "P-001", target: "L-003", type: "UBICADO_EN", label: "Residencia", value: 3 },
  { source: "P-002", target: "L-002", type: "VISTO_EN", label: "Visto frecuentemente", value: 3 },
  { source: "P-003", target: "L-006", type: "FRECUENTA", label: "Punto de encuentro", value: 3 },
  { source: "P-003", target: "L-007", type: "UBICADO_EN", label: "Alojamiento", value: 3 },
  { source: "P-014", target: "L-010", type: "VISTO_EN", label: "Cruce fronterizo", value: 4 },
  { source: "P-014", target: "L-011", type: "FRECUENTA", label: "Almacén", value: 4 },
  { source: "P-019", target: "L-013", type: "VISTO_EN", label: "Control", value: 4 },
  { source: "P-019", target: "L-014", type: "FRECUENTA", label: "Zona franca", value: 3 },
  { source: "P-017", target: "L-012", type: "UBICADO_EN", label: "Domicilio", value: 5 },
  { source: "P-016", target: "L-012", type: "UBICADO_EN", label: "Domicilio", value: 5 },
];

// =============================================================================
// PLATE NUMBER INDEX (for matching PlateMatched events)
// =============================================================================

export const plateNumberIndex: Map<string, { personId: string; objectId: string }> = new Map([
  ["ABC-123", { personId: "P-001", objectId: "O-001" }],
  ["ABC123", { personId: "P-001", objectId: "O-001" }],
  ["XYZ-789", { personId: "P-002", objectId: "O-002" }],
  ["XYZ789", { personId: "P-002", objectId: "O-002" }],
  ["MNO-456", { personId: "P-003", objectId: "O-003" }],
  ["MNO456", { personId: "P-003", objectId: "O-003" }],
  ["D4E-567", { personId: "P-001", objectId: "O-004" }],
  ["D4E567", { personId: "P-001", objectId: "O-004" }],
  ["CUS-456", { personId: "P-003", objectId: "O-005" }],
  ["CUS456", { personId: "P-003", objectId: "O-005" }],
  ["PUN-321", { personId: "P-014", objectId: "O-006" }],
  ["PUN321", { personId: "P-014", objectId: "O-006" }],
  ["ARQ-159", { personId: "P-018", objectId: "O-002" }],
  ["ARQ159", { personId: "P-018", objectId: "O-002" }],
  ["TAC-753", { personId: "P-019", objectId: "O-019" }],
  ["TAC753", { personId: "P-019", objectId: "O-019" }],
]);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get person by plate number (for PlateMatched events)
 */
export function getPersonByPlate(plateNumber: string): POLEPerson | undefined {
  const normalized = plateNumber.replace(/[-\s]/g, "").toUpperCase();
  const match = plateNumberIndex.get(normalized) || plateNumberIndex.get(plateNumber.toUpperCase());
  if (match) {
    return polePeople.find(p => p.id === match.personId);
  }
  return undefined;
}

/**
 * Get object (vehicle) by plate number
 */
export function getObjectByPlate(plateNumber: string): POLEObject | undefined {
  const normalized = plateNumber.replace(/[-\s]/g, "").toUpperCase();
  const match = plateNumberIndex.get(normalized) || plateNumberIndex.get(plateNumber.toUpperCase());
  if (match) {
    return poleObjects.find(o => o.id === match.objectId);
  }
  return undefined;
}

/**
 * Get incidents related to a person
 */
export function getIncidentsByPerson(personId: string): POLEIncident[] {
  return poleIncidents.filter(inc => inc.relatedPeopleIds.includes(personId));
}

/**
 * Get incidents related to an object
 */
export function getIncidentsByObject(objectId: string): POLEIncident[] {
  return poleIncidents.filter(inc => inc.relatedObjectIds.includes(objectId));
}

/**
 * Get incidents related to a location
 */
export function getIncidentsByLocation(locationId: string): POLEIncident[] {
  return poleIncidents.filter(inc => inc.relatedLocationIds.includes(locationId));
}

/**
 * Get all POLE entities related to an incident
 */
export function getIncidentPOLEData(incidentId: string): {
  people: POLEPerson[];
  objects: POLEObject[];
  locations: POLELocation[];
} {
  const incident = poleIncidents.find(inc => inc.id === incidentId);
  if (!incident) {
    return { people: [], objects: [], locations: [] };
  }
  
  return {
    people: polePeople.filter(p => incident.relatedPeopleIds.includes(p.id)),
    objects: poleObjects.filter(o => incident.relatedObjectIds.includes(o.id)),
    locations: poleLocations.filter(l => incident.relatedLocationIds.includes(l.id)),
  };
}

/**
 * Get open incidents that could be linked to a new event
 */
export function getOpenIncidentsForRegion(region: string): POLEIncident[] {
  return poleIncidents.filter(
    inc => inc.region === region && (inc.status === "open" || inc.status === "investigating")
  );
}

/**
 * Find incidents that match a detected plate number
 */
export function findIncidentsByPlate(plateNumber: string): POLEIncident[] {
  const person = getPersonByPlate(plateNumber);
  const object = getObjectByPlate(plateNumber);
  
  const incidents: POLEIncident[] = [];
  
  if (person) {
    incidents.push(...getIncidentsByPerson(person.id));
  }
  if (object) {
    incidents.push(...getIncidentsByObject(object.id));
  }
  
  // Remove duplicates
  return Array.from(new Map(incidents.map(inc => [inc.id, inc])).values());
}

// =============================================================================
// GRAPH DATA GENERATION
// =============================================================================

/**
 * Convert POLE data to graph format for react-force-graph-2d
 */
export function generateGraphData(): { nodes: POLEGraphNode[]; links: POLEGraphLink[] } {
  const nodes: POLEGraphNode[] = [];
  const links: POLEGraphLink[] = [];
  
  // Add people nodes
  polePeople.forEach(person => {
    nodes.push({
      id: person.id,
      name: person.name,
      type: "person",
      color: NODE_COLORS.person,
      val: person.riskLevel === "high" ? 12 : person.riskLevel === "medium" ? 9 : 6,
      role: person.role,
      riskLevel: person.riskLevel,
      region: person.region,
      description: person.description,
      dni: person.dni,
    });
  });
  
  // Add object nodes
  poleObjects.forEach(obj => {
    nodes.push({
      id: obj.id,
      name: obj.name,
      type: "object",
      color: NODE_COLORS.object,
      val: obj.status === "evidence" ? 10 : obj.status === "flagged" ? 8 : 6,
      role: obj.type,
      status: obj.status,
      description: obj.description,
      plateNumber: obj.plateNumber,
    });
  });
  
  // Add location nodes
  poleLocations.forEach(loc => {
    nodes.push({
      id: loc.id,
      name: loc.name,
      type: "location",
      color: NODE_COLORS.location,
      val: loc.type === "crime_scene" ? 12 : loc.type === "safehouse" ? 10 : 7,
      role: loc.type.replace("_", " "),
      region: loc.region,
      coordinates: { lat: loc.latitude, lng: loc.longitude },
    });
  });
  
  // Add incident nodes as events
  poleIncidents.forEach(inc => {
    nodes.push({
      id: inc.id,
      name: inc.type,
      type: "event",
      color: NODE_COLORS.event,
      val: inc.priority === "critical" ? 14 : inc.priority === "high" ? 11 : 8,
      role: inc.type,
      status: inc.status,
      priority: inc.priority,
      region: inc.region,
      description: inc.description,
      timestamp: inc.createdAt,
      coordinates: { lat: inc.latitude, lng: inc.longitude },
    });
  });
  
  // Add relationships as links
  poleRelationships.forEach(rel => {
    links.push({
      source: rel.source,
      target: rel.target,
      type: rel.type,
      label: rel.label,
      value: rel.value,
    });
  });
  
  return { nodes, links };
}

// =============================================================================
// EXPORTS
// =============================================================================

// Pre-generated graph data for immediate use
export const graphData = generateGraphData();

// Export all data for direct access
export const poleData = {
  people: polePeople,
  objects: poleObjects,
  locations: poleLocations,
  incidents: poleIncidents,
  relationships: poleRelationships,
  graphData,
};

export default poleData;
