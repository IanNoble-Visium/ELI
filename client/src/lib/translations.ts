// client/src/lib/translations.ts
// Translation helper functions and dictionaries for POLE Analytics and Incident Management

export type Language = "en" | "es";

// Storage key for language preference
const LANGUAGE_STORAGE_KEY = "eli-language-preference";

/**
 * Get the stored language preference from localStorage
 */
export function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === "es" ? "es" : "en";
}

/**
 * Store the language preference to localStorage
 */
export function setStoredLanguage(lang: Language): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

// =============================================================================
// TRANSLATION DICTIONARIES
// =============================================================================

/**
 * Incident type translations (Spanish -> English)
 */
export const incidentTypeTranslations: Record<string, string> = {
  "Robo agravado": "Armed Robbery",
  "Tráfico de drogas": "Drug Trafficking",
  "Violencia familiar": "Domestic Violence",
  "Robo de vehículo": "Vehicle Theft",
  "Contrabando": "Smuggling",
  "Fraude financiero": "Financial Fraud",
  "Extorsión": "Extortion",
  "Falsificación de documentos": "Document Forgery",
  "Asalto": "Assault",
  "Homicidio": "Homicide",
  "Secuestro": "Kidnapping",
  "Trata de personas": "Human Trafficking",
  "Lavado de activos": "Money Laundering",
  "Posesión de armas": "Weapons Possession",
  "Vandalismo": "Vandalism",
};

/**
 * Incident status translations
 */
export const statusTranslations: Record<string, { es: string; en: string }> = {
  open: { es: "Abierto", en: "Open" },
  investigating: { es: "En investigación", en: "Investigating" },
  resolved: { es: "Resuelto", en: "Resolved" },
  closed: { es: "Cerrado", en: "Closed" },
};

/**
 * Priority translations
 */
export const priorityTranslations: Record<string, { es: string; en: string }> = {
  critical: { es: "Crítico", en: "Critical" },
  high: { es: "Alto", en: "High" },
  medium: { es: "Medio", en: "Medium" },
  low: { es: "Bajo", en: "Low" },
};

/**
 * Role translations
 */
export const roleTranslations: Record<string, { es: string; en: string }> = {
  suspect: { es: "Sospechoso", en: "Suspect" },
  victim: { es: "Víctima", en: "Victim" },
  witness: { es: "Testigo", en: "Witness" },
  informant: { es: "Informante", en: "Informant" },
  associate: { es: "Asociado", en: "Associate" },
  officer: { es: "Oficial", en: "Officer" },
};

/**
 * Risk level translations
 */
export const riskLevelTranslations: Record<string, { es: string; en: string }> = {
  high: { es: "Alto", en: "High" },
  medium: { es: "Medio", en: "Medium" },
  low: { es: "Bajo", en: "Low" },
};

/**
 * Object type translations
 */
export const objectTypeTranslations: Record<string, { es: string; en: string }> = {
  vehicle: { es: "Vehículo", en: "Vehicle" },
  weapon: { es: "Arma", en: "Weapon" },
  electronics: { es: "Electrónicos", en: "Electronics" },
  document: { es: "Documento", en: "Document" },
  currency: { es: "Dinero", en: "Currency" },
  contraband: { es: "Contrabando", en: "Contraband" },
};

/**
 * Object status translations
 */
export const objectStatusTranslations: Record<string, { es: string; en: string }> = {
  evidence: { es: "Evidencia", en: "Evidence" },
  recovered: { es: "Recuperado", en: "Recovered" },
  missing: { es: "Desaparecido", en: "Missing" },
  tracked: { es: "Rastreado", en: "Tracked" },
  flagged: { es: "Marcado", en: "Flagged" },
};

/**
 * Location type translations
 */
export const locationTypeTranslations: Record<string, { es: string; en: string }> = {
  crime_scene: { es: "Escena del crimen", en: "Crime Scene" },
  safehouse: { es: "Escondite", en: "Safehouse" },
  residence: { es: "Residencia", en: "Residence" },
  business: { es: "Negocio", en: "Business" },
  transit: { es: "Tránsito", en: "Transit" },
  meeting_point: { es: "Punto de encuentro", en: "Meeting Point" },
};

/**
 * Entity type translations
 */
export const entityTypeTranslations: Record<string, { es: string; en: string }> = {
  person: { es: "Persona", en: "Person" },
  object: { es: "Objeto", en: "Object" },
  location: { es: "Ubicación", en: "Location" },
  event: { es: "Evento", en: "Event" },
};

/**
 * UI labels translations
 */
export const uiLabels: Record<string, { es: string; en: string }> = {
  // Headers
  poleAnalytics: { es: "Análisis POLE", en: "POLE Analytics" },
  incidentManagement: { es: "Gestión de Incidentes", en: "Incident Management" },
  crimeNetworkAnalysis: { es: "Análisis de Red Criminal", en: "Crime Network Analysis" },

  // Stats
  entities: { es: "Entidades", en: "Entities" },
  highRisk: { es: "Alto Riesgo", en: "High Risk" },
  people: { es: "Personas", en: "People" },
  objects: { es: "Objetos", en: "Objects" },
  locations: { es: "Ubicaciones", en: "Locations" },
  events: { es: "Eventos", en: "Events" },
  links: { es: "Enlaces", en: "Links" },

  // Tabs
  relationshipGraph: { es: "Gráfico de Relaciones", en: "Relationship Graph" },
  timeline: { es: "Línea de Tiempo", en: "Timeline" },
  entityList: { es: "Lista de Entidades", en: "Entity List" },

  // Actions
  back: { es: "Volver", en: "Back" },
  search: { es: "Buscar", en: "Search" },
  viewOnMap: { es: "Ver en Mapa", en: "View on Map" },
  viewRegion: { es: "Ver Región", en: "View Region" },
  viewTopology: { es: "Ver Topología", en: "View Topology" },
  viewIncident: { es: "Ver Incidente", en: "View Incident" },
  viewFullPoleAnalysis: { es: "Ver Análisis POLE Completo", en: "View Full POLE Analysis" },

  // Labels
  connections: { es: "Conexiones", en: "Connections" },
  actions: { es: "Acciones", en: "Actions" },
  details: { es: "Detalles", en: "Details" },
  legend: { es: "Leyenda", en: "Legend" },
  region: { es: "Región", en: "Region" },
  camera: { es: "Cámara", en: "Camera" },
  time: { es: "Hora", en: "Time" },
  description: { es: "Descripción", en: "Description" },

  // Incident specific
  total: { es: "Total", en: "Total" },
  critical: { es: "Crítico", en: "Critical" },
  investigating: { es: "En investigación", en: "Investigating" },
  resolved: { es: "Resuelto", en: "Resolved" },
  incidentDetails: { es: "Detalles del Incidente", en: "Incident Details" },
  assignment: { es: "Asignación", en: "Assignment" },
  location: { es: "Ubicación", en: "Location" },
  created: { es: "Creado", en: "Created" },
  responseTime: { es: "Tiempo de Respuesta", en: "Response Time" },
  minutes: { es: "minutos", en: "minutes" },
  assignedOfficer: { es: "Oficial Asignado", en: "Assigned Officer" },
  assignedUnit: { es: "Unidad Asignada", en: "Assigned Unit" },
  relatedPoleEntities: { es: "Entidades POLE Relacionadas", en: "Related POLE Entities" },
  poleEntitiesDescription: { es: "Personas, Objetos y Ubicaciones asociadas a este incidente", en: "People, Objects, and Locations associated with this incident" },
  noPoleData: { es: "No hay entidades POLE vinculadas a este incidente aún", en: "No POLE entities linked to this incident yet" },
  noPoleDataHint: { es: "Las entidades POLE aparecerán cuando se asocien eventos de cámara (FaceMatched, PlateMatched).", en: "POLE entities will appear when camera events (FaceMatched, PlateMatched) are associated." },
  noPeopleLinked: { es: "No hay personas vinculadas", en: "No people linked" },
  noObjectsLinked: { es: "No hay objetos vinculados", en: "No objects linked" },
  noLocationsLinked: { es: "No hay ubicaciones vinculadas", en: "No locations linked" },
  notes: { es: "Notas", en: "Notes" },
  tags: { es: "Etiquetas", en: "Tags" },
  addNote: { es: "Agregar nota sobre este incidente...", en: "Add a note about this incident..." },
  add: { es: "Agregar", en: "Add" },
  noNotesYet: { es: "Sin notas aún. Agrega una arriba.", en: "No notes yet. Add one above." },
  noTagsYet: { es: "Sin etiquetas aún. Agrega una arriba.", en: "No tags yet. Add one above." },
  tagName: { es: "Nombre de etiqueta...", en: "Tag name..." },
  quickNavigation: { es: "Navegación Rápida", en: "Quick Navigation" },
  drillIntoViews: { es: "Profundizar en vistas y análisis relacionados", en: "Drill into related views and analytics" },
  poleAnalysis: { es: "Análisis POLE", en: "POLE Analysis" },
  selectIncident: { es: "Selecciona un incidente para ver los detalles", en: "Select an incident to view details" },
  buildingGraph: { es: "Construyendo gráfico de red criminal...", en: "Building crime network graph..." },
  searchEntities: { es: "Buscar entidades...", en: "Search entities..." },
  searchIncidents: { es: "Buscar incidentes...", en: "Search incidents..." },
  allStatus: { es: "Todos los Estados", en: "All Status" },
  allPriority: { es: "Todas las Prioridades", en: "All Priority" },
  videoEvidence: { es: "Evidencia en Video", en: "Video Evidence" },
  updateStatus: { es: "Actualizar Estado", en: "Update Status" },
  reassign: { es: "Reasignar", en: "Reassign" },
  exportReport: { es: "Exportar Informe", en: "Export Report" },
  activityTimeline: { es: "Línea de Actividad", en: "Activity Timeline" },
  activityTimelineDesc: { es: "Actividad de entidades POLE en los últimos 7 días", en: "POLE entity activity over the last 7 days" },
  
  // Additional labels for redesigned pages
  type: { es: "Tipo", en: "Type" },
  status: { es: "Estado", en: "Status" },
  role: { es: "Rol", en: "Role" },
};

// =============================================================================
// TRANSLATION HELPER FUNCTIONS
// =============================================================================

/**
 * Get incident type in the specified language
 */
export function getIncidentType(type: string, lang: Language): string {
  if (lang === "en") {
    return incidentTypeTranslations[type] || type;
  }
  return type;
}

/**
 * Get status in the specified language
 */
export function getStatus(status: string, lang: Language): string {
  const translation = statusTranslations[status.toLowerCase()];
  return translation ? translation[lang] : status;
}

/**
 * Get priority in the specified language
 */
export function getPriority(priority: string, lang: Language): string {
  const translation = priorityTranslations[priority.toLowerCase()];
  return translation ? translation[lang] : priority;
}

/**
 * Get role in the specified language
 */
export function getRole(role: string, lang: Language): string {
  const translation = roleTranslations[role.toLowerCase()];
  return translation ? translation[lang] : role;
}

/**
 * Get risk level in the specified language
 */
export function getRiskLevel(level: string, lang: Language): string {
  const translation = riskLevelTranslations[level.toLowerCase()];
  return translation ? translation[lang] : level;
}

/**
 * Get object type in the specified language
 */
export function getObjectType(type: string, lang: Language): string {
  const translation = objectTypeTranslations[type.toLowerCase()];
  return translation ? translation[lang] : type;
}

/**
 * Get object status in the specified language
 */
export function getObjectStatus(status: string, lang: Language): string {
  const translation = objectStatusTranslations[status.toLowerCase()];
  return translation ? translation[lang] : status;
}

/**
 * Get location type in the specified language
 */
export function getLocationType(type: string, lang: Language): string {
  const translation = locationTypeTranslations[type.toLowerCase().replace(" ", "_")];
  return translation ? translation[lang] : type.replace("_", " ");
}

/**
 * Get entity type in the specified language
 */
export function getEntityType(type: string, lang: Language): string {
  const translation = entityTypeTranslations[type.toLowerCase()];
  return translation ? translation[lang] : type;
}

/**
 * Get UI label in the specified language
 */
export function t(key: string, lang: Language): string {
  const translation = uiLabels[key];
  return translation ? translation[lang] : key;
}

/**
 * Get bilingual text (English with Spanish in parentheses or vice versa)
 */
export function getBilingualText(es: string, en: string, lang: Language): string {
  return lang === "en" ? en : es;
}

/**
 * Helper to get description based on language
 * Falls back to Spanish if English not available
 */
export function getDescription(
  description?: string,
  descriptionEn?: string,
  lang: Language = "en"
): string {
  if (lang === "en" && descriptionEn) {
    return descriptionEn;
  }
  return description || descriptionEn || "";
}

/**
 * Helper to get name based on language
 * Falls back to Spanish if English not available
 */
export function getName(
  name: string,
  nameEn?: string,
  lang: Language = "en"
): string {
  if (lang === "en" && nameEn) {
    return nameEn;
  }
  return name;
}

/**
 * Helper to get type based on language
 * Falls back to Spanish if English not available
 */
export function getType(
  type: string,
  typeEn?: string,
  lang: Language = "en"
): string {
  if (lang === "en" && typeEn) {
    return typeEn;
  }
  return type;
}

/**
 * Helper to get relationship label based on language
 */
export function getRelationshipLabel(
  label: string,
  labelEn?: string,
  lang: Language = "en"
): string {
  if (lang === "en" && labelEn) {
    return labelEn;
  }
  return label;
}
