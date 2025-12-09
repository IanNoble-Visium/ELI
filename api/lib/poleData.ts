// api/lib/poleData.ts
// Server-side POLE data module for matching camera events to POLE entities
// This is a simplified version of the client-side poleData.ts for API use

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface POLEPerson {
  id: string;
  name: string;
  dni: string;
  role: string;
  riskLevel: string;
  region: string;
  description?: string;
  associatedPlateNumbers?: string[];
}

export interface POLEObject {
  id: string;
  name: string;
  type: string;
  description: string;
  status: string;
  plateNumber?: string;
  ownerId?: string;
}

export interface POLEIncident {
  id: string;
  type: string;
  description: string;
  region: string;
  status: string;
  priority: string;
  relatedPeopleIds: string[];
  relatedObjectIds: string[];
}

export interface POLEMatch {
  personId?: string;
  personName?: string;
  objectId?: string;
  objectName?: string;
  incidentIds: string[];
  riskLevel?: string;
  matchType: "plate" | "face" | "none";
}

// =============================================================================
// PLATE NUMBER INDEX (for matching PlateMatched events)
// =============================================================================

const plateNumberIndex: Map<string, { personId: string; objectId: string }> = new Map([
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
// PEOPLE DATA (subset for matching)
// =============================================================================

const polePeople: Map<string, POLEPerson> = new Map([
  ["P-001", {
    id: "P-001",
    name: "Carlos Alberto Mendoza Quispe",
    dni: "45678912",
    role: "suspect",
    riskLevel: "high",
    region: "Lima",
    description: "Líder de organización criminal dedicada al robo agravado",
    associatedPlateNumbers: ["ABC-123", "D4E-567"],
  }],
  ["P-002", {
    id: "P-002",
    name: "Miguel Ángel Torres Huamán",
    dni: "78912345",
    role: "suspect",
    riskLevel: "high",
    region: "Lima",
    description: "Asociado principal, especialista en vehículos",
    associatedPlateNumbers: ["XYZ-789"],
  }],
  ["P-003", {
    id: "P-003",
    name: "Roberto Carlos Silva Paredes",
    dni: "32165498",
    role: "suspect",
    riskLevel: "medium",
    region: "Cusco",
    description: "Contacto regional para distribución",
    associatedPlateNumbers: ["CUS-456"],
  }],
  ["P-014", {
    id: "P-014",
    name: "Javier Enrique Salazar Condori",
    dni: "78932145",
    role: "suspect",
    riskLevel: "high",
    region: "Puno",
    description: "Presunto líder de red de narcotráfico",
    associatedPlateNumbers: ["PUN-321"],
  }],
  ["P-018", {
    id: "P-018",
    name: "Óscar Iván Delgado Puma",
    dni: "45632178",
    role: "suspect",
    riskLevel: "medium",
    region: "Arequipa",
    description: "Involucrado en robo de vehículos",
    associatedPlateNumbers: ["ARQ-159"],
  }],
  ["P-019", {
    id: "P-019",
    name: "Víctor Hugo Medina Ccama",
    dni: "78965412",
    role: "suspect",
    riskLevel: "high",
    region: "Tacna",
    description: "Contrabandista conocido en frontera sur",
    associatedPlateNumbers: ["TAC-753"],
  }],
]);

// =============================================================================
// OBJECTS DATA (subset for matching)
// =============================================================================

const poleObjects: Map<string, POLEObject> = new Map([
  ["O-001", {
    id: "O-001",
    name: "Honda Civic Blanco 2019",
    type: "vehicle",
    description: "Placa ABC-123, vehículo de fuga principal",
    status: "tracked",
    plateNumber: "ABC-123",
    ownerId: "P-001",
  }],
  ["O-002", {
    id: "O-002",
    name: "Toyota Hilux Negra 2020",
    type: "vehicle",
    description: "Placa XYZ-789, visto en múltiples ubicaciones",
    status: "flagged",
    plateNumber: "XYZ-789",
    ownerId: "P-002",
  }],
  ["O-003", {
    id: "O-003",
    name: "Yamaha FZ 150cc",
    type: "vehicle",
    description: "Placa MNO-456, motocicleta asociada a P-003",
    status: "tracked",
    plateNumber: "MNO-456",
    ownerId: "P-003",
  }],
  ["O-004", {
    id: "O-004",
    name: "Nissan Frontier 2018",
    type: "vehicle",
    description: "Placa D4E-567, usado para transporte de mercancía",
    status: "flagged",
    plateNumber: "D4E-567",
    ownerId: "P-001",
  }],
  ["O-005", {
    id: "O-005",
    name: "Hyundai Accent Gris 2021",
    type: "vehicle",
    description: "Placa CUS-456, vehículo de contacto Cusco",
    status: "tracked",
    plateNumber: "CUS-456",
    ownerId: "P-003",
  }],
  ["O-006", {
    id: "O-006",
    name: "Suzuki Alto Rojo 2017",
    type: "vehicle",
    description: "Placa PUN-321, transporte de sustancias",
    status: "flagged",
    plateNumber: "PUN-321",
    ownerId: "P-014",
  }],
]);

// =============================================================================
// INCIDENTS DATA (for linking)
// =============================================================================

const poleIncidents: Map<string, POLEIncident> = new Map([
  ["INC-2024-001", {
    id: "INC-2024-001",
    type: "Robo agravado",
    description: "Asalto a mano armada en sucursal bancaria de Miraflores",
    region: "Lima",
    status: "investigating",
    priority: "critical",
    relatedPeopleIds: ["P-001", "P-002", "P-004"],
    relatedObjectIds: ["O-001", "O-007"],
  }],
  ["INC-2024-002", {
    id: "INC-2024-002",
    type: "Tráfico de drogas",
    description: "Incautación de 5kg de cocaína en operativo fronterizo",
    region: "Puno",
    status: "investigating",
    priority: "critical",
    relatedPeopleIds: ["P-014", "P-015"],
    relatedObjectIds: ["O-006", "O-018"],
  }],
  ["INC-2024-004", {
    id: "INC-2024-004",
    type: "Robo de vehículo",
    description: "Sustracción de camioneta Toyota Hilux",
    region: "Arequipa",
    status: "investigating",
    priority: "medium",
    relatedPeopleIds: ["P-018"],
    relatedObjectIds: ["O-002"],
  }],
  ["INC-2024-005", {
    id: "INC-2024-005",
    type: "Contrabando",
    description: "Decomiso de mercadería electrónica de contrabando",
    region: "Tacna",
    status: "resolved",
    priority: "medium",
    relatedPeopleIds: ["P-019"],
    relatedObjectIds: ["O-019"],
  }],
  ["INC-2024-009", {
    id: "INC-2024-009",
    type: "Tráfico de drogas",
    description: "Detención de sospechoso con indicios de microcomercialización",
    region: "Cusco",
    status: "resolved",
    priority: "medium",
    relatedPeopleIds: ["P-003"],
    relatedObjectIds: ["O-003", "O-005"],
  }],
]);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Normalize plate number for matching (remove dashes, spaces, uppercase)
 */
function normalizePlate(plate: string): string {
  return plate.replace(/[-\s]/g, "").toUpperCase();
}

/**
 * Match a plate number to POLE entities
 */
export function matchPlateNumber(plateNumber: string): POLEMatch {
  const normalized = normalizePlate(plateNumber);
  
  // Try exact match first, then normalized
  let match = plateNumberIndex.get(plateNumber.toUpperCase());
  if (!match) {
    match = plateNumberIndex.get(normalized);
  }
  
  if (!match) {
    return { incidentIds: [], matchType: "none" };
  }
  
  const person = polePeople.get(match.personId);
  const object = poleObjects.get(match.objectId);
  
  // Find related incidents
  const incidentIds: string[] = [];
  poleIncidents.forEach((incident, id) => {
    if (incident.relatedPeopleIds.includes(match!.personId) ||
        incident.relatedObjectIds.includes(match!.objectId)) {
      incidentIds.push(id);
    }
  });
  
  return {
    personId: person?.id,
    personName: person?.name,
    objectId: object?.id,
    objectName: object?.name,
    incidentIds,
    riskLevel: person?.riskLevel,
    matchType: "plate",
  };
}

/**
 * Match a face encoding ID to POLE entities (placeholder for future implementation)
 */
export function matchFaceEncoding(faceEncodingId: string): POLEMatch {
  // TODO: Implement face matching when face encoding database is available
  // For now, return no match
  return { incidentIds: [], matchType: "none" };
}

/**
 * Get incidents for a specific region
 */
export function getOpenIncidentsForRegion(region: string): POLEIncident[] {
  const incidents: POLEIncident[] = [];
  poleIncidents.forEach((incident) => {
    if (incident.region === region && 
        (incident.status === "open" || incident.status === "investigating")) {
      incidents.push(incident);
    }
  });
  return incidents;
}

/**
 * Get person by ID
 */
export function getPersonById(personId: string): POLEPerson | undefined {
  return polePeople.get(personId);
}

/**
 * Get object by ID
 */
export function getObjectById(objectId: string): POLEObject | undefined {
  return poleObjects.get(objectId);
}

/**
 * Get incident by ID
 */
export function getIncidentById(incidentId: string): POLEIncident | undefined {
  return poleIncidents.get(incidentId);
}

/**
 * Check if a topic is a plate-related event
 */
export function isPlateMatchedEvent(topic: string): boolean {
  const plateTopics = [
    "PlateMatched",
    "PlateRecognized",
    "LicensePlate",
    "ANPR",
    "VehicleDetected",
  ];
  return plateTopics.some(t => topic.toLowerCase().includes(t.toLowerCase()));
}

/**
 * Check if a topic is a face-related event
 */
export function isFaceMatchedEvent(topic: string): boolean {
  const faceTopics = [
    "FaceMatched",
    "FaceRecognized",
    "FaceDetected",
    "PersonIdentified",
  ];
  return faceTopics.some(t => topic.toLowerCase().includes(t.toLowerCase()));
}

/**
 * Extract plate number from event params
 */
export function extractPlateFromParams(params: any): string | null {
  if (!params) return null;
  
  // Try various common param structures
  const plateFields = [
    "plate",
    "plateNumber",
    "plate_number",
    "licensePlate",
    "license_plate",
    "vehiclePlate",
    "vehicle_plate",
    "text", // Some systems use generic "text" field
  ];
  
  for (const field of plateFields) {
    if (params[field] && typeof params[field] === "string") {
      return params[field];
    }
  }
  
  // Check nested structures
  if (params.vehicle?.plate) return params.vehicle.plate;
  if (params.detection?.plate) return params.detection.plate;
  if (params.result?.plate) return params.result.plate;
  
  return null;
}

/**
 * Extract face encoding from event params
 */
export function extractFaceEncodingFromParams(params: any): string | null {
  if (!params) return null;
  
  const faceFields = [
    "faceId",
    "face_id",
    "faceEncoding",
    "face_encoding",
    "personId",
    "person_id",
    "matchId",
    "match_id",
  ];
  
  for (const field of faceFields) {
    if (params[field] && typeof params[field] === "string") {
      return params[field];
    }
  }
  
  // Check nested structures
  if (params.face?.id) return params.face.id;
  if (params.person?.id) return params.person.id;
  if (params.match?.id) return params.match.id;
  
  return null;
}
