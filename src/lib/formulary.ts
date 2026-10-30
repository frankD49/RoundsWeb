// WHO EML-derived drug formulary + interaction/critical checkers
// Mirrors Android DrugFormularyRepository, DrugInteractionChecker, CriticalResultChecker

import drugsData from '@/assets/drugs_eml.json'

export interface FormularyDrug {
  inn: string
  category: string
  routes: string[]
  frequencies: string[]
  custom?: boolean
}

const bundled: FormularyDrug[] = drugsData as FormularyDrug[]

const CUSTOM_KEY = 'rounds_formulary_custom'

function loadCustom(): FormularyDrug[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function allDrugs(): FormularyDrug[] {
  return [...bundled, ...loadCustom()]
}

export function searchDrugs(query: string, limit = 8): FormularyDrug[] {
  const drugs = allDrugs()
  const q = query.trim().toLowerCase()
  if (!q) return drugs.slice(0, limit)
  return drugs.filter((d) => d.inn.toLowerCase().includes(q)).slice(0, limit)
}

/** Records a user-entered drug not in the formulary so it autocompletes next time. */
export function learnDrug(name: string, route: string, frequency: string): void {
  const trimmed = name.trim()
  if (!trimmed) return
  if (allDrugs().some((d) => d.inn.toLowerCase() === trimmed.toLowerCase())) return
  const custom = loadCustom()
  custom.push({ inn: trimmed, category: 'Custom', routes: [route], frequencies: [frequency], custom: true })
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom))
}

// --- Drug Interaction Checker (ported from Android) ---

interface Interaction { drugA: string; drugB: string; risk: string }

const interactions: Interaction[] = [
  { drugA: 'warfarin', drugB: 'aspirin', risk: 'Increased bleeding risk' },
  { drugA: 'warfarin', drugB: 'ibuprofen', risk: 'Increased bleeding risk' },
  { drugA: 'warfarin', drugB: 'naproxen', risk: 'Increased bleeding risk' },
  { drugA: 'warfarin', drugB: 'diclofenac', risk: 'Increased bleeding risk' },
  { drugA: 'warfarin', drugB: 'amiodarone', risk: 'Increased INR — warfarin toxicity' },
  { drugA: 'warfarin', drugB: 'ciprofloxacin', risk: 'Increased INR — warfarin toxicity' },
  { drugA: 'warfarin', drugB: 'metronidazole', risk: 'Increased INR — warfarin toxicity' },
  { drugA: 'warfarin', drugB: 'fluconazole', risk: 'Increased INR — warfarin toxicity' },
  { drugA: 'warfarin', drugB: 'sulfamethoxazole', risk: 'Increased INR — warfarin toxicity' },
  { drugA: 'lisinopril', drugB: 'potassium', risk: 'Hyperkalemia risk' },
  { drugA: 'enalapril', drugB: 'potassium', risk: 'Hyperkalemia risk' },
  { drugA: 'ramipril', drugB: 'potassium', risk: 'Hyperkalemia risk' },
  { drugA: 'spironolactone', drugB: 'potassium', risk: 'Hyperkalemia risk' },
  { drugA: 'spironolactone', drugB: 'lisinopril', risk: 'Hyperkalemia risk' },
  { drugA: 'spironolactone', drugB: 'enalapril', risk: 'Hyperkalemia risk' },
  { drugA: 'metformin', drugB: 'contrast', risk: 'Lactic acidosis risk — hold metformin' },
  { drugA: 'metformin', drugB: 'iodinated', risk: 'Lactic acidosis risk — hold metformin' },
  { drugA: 'simvastatin', drugB: 'amiodarone', risk: 'Rhabdomyolysis risk' },
  { drugA: 'simvastatin', drugB: 'clarithromycin', risk: 'Rhabdomyolysis risk' },
  { drugA: 'simvastatin', drugB: 'erythromycin', risk: 'Rhabdomyolysis risk' },
  { drugA: 'simvastatin', drugB: 'itraconazole', risk: 'Rhabdomyolysis risk' },
  { drugA: 'simvastatin', drugB: 'ketoconazole', risk: 'Rhabdomyolysis risk' },
  { drugA: 'atorvastatin', drugB: 'clarithromycin', risk: 'Rhabdomyolysis risk' },
  { drugA: 'atorvastatin', drugB: 'itraconazole', risk: 'Rhabdomyolysis risk' },
  { drugA: 'citalopram', drugB: 'tramadol', risk: 'Serotonin syndrome risk' },
  { drugA: 'sertraline', drugB: 'tramadol', risk: 'Serotonin syndrome risk' },
  { drugA: 'fluoxetine', drugB: 'tramadol', risk: 'Serotonin syndrome risk' },
  { drugA: 'escitalopram', drugB: 'tramadol', risk: 'Serotonin syndrome risk' },
  { drugA: 'citalopram', drugB: 'selegiline', risk: 'Serotonin syndrome risk' },
  { drugA: 'phenytoin', drugB: 'valproate', risk: 'Altered phenytoin levels' },
  { drugA: 'lithium', drugB: 'thiazide', risk: 'Lithium toxicity' },
  { drugA: 'lithium', drugB: 'furosemide', risk: 'Lithium toxicity' },
  { drugA: 'lithium', drugB: 'acebutolol', risk: 'Lithium toxicity' },
  { drugA: 'digoxin', drugB: 'amiodarone', risk: 'Digoxin toxicity' },
  { drugA: 'digoxin', drugB: 'verapamil', risk: 'Digoxin toxicity' },
  { drugA: 'digoxin', drugB: 'diltiazem', risk: 'Digoxin toxicity' },
  { drugA: 'theophylline', drugB: 'ciprofloxacin', risk: 'Theophylline toxicity' },
  { drugA: 'theophylline', drugB: 'erythromycin', risk: 'Theophylline toxicity' },
  { drugA: 'methotrexate', drugB: 'trimethoprim', risk: 'Methotrexate toxicity' },
  { drugA: 'methotrexate', drugB: 'sulfamethoxazole', risk: 'Methotrexate toxicity' },
  { drugA: 'clopidogrel', drugB: 'omeprazole', risk: 'Reduced clopidogrel efficacy' },
  { drugA: 'apixaban', drugB: 'ketoconazole', risk: 'Increased bleeding risk' },
  { drugA: 'rivaroxaban', drugB: 'ketoconazole', risk: 'Increased bleeding risk' },
  { drugA: 'dabigatran', drugB: 'verapamil', risk: 'Increased dabigatran levels' },
  { drugA: 'insulin', drugB: 'metformin', risk: 'Hypoglycemia risk — monitor closely' },
  { drugA: 'glipizide', drugB: 'fluconazole', risk: 'Hypoglycemia risk' },
  { drugA: 'glyburide', drugB: 'fluconazole', risk: 'Hypoglycemia risk' },
]

export function checkDrugInteractions(newDrug: string, activeDrugs: string[]): string[] {
  const newLower = newDrug.toLowerCase().trim()
  if (!newLower) return []
  const warnings = new Set<string>()
  for (const active of activeDrugs) {
    const activeLower = active.toLowerCase().trim()
    if (!activeLower || activeLower === newLower) continue
    for (const i of interactions) {
      if ((newLower.includes(i.drugA) && activeLower.includes(i.drugB)) ||
          (newLower.includes(i.drugB) && activeLower.includes(i.drugA))) {
        warnings.add(`${i.risk}: ${newDrug} + ${active}`)
      }
    }
  }
  return [...warnings]
}

// --- Critical Result Checker (ported from Android) ---

export interface CriticalFlag { metric: string; value: number; message: string }

interface Threshold { min: number; max: number; message: string }

const thresholds: Record<string, Threshold[]> = {
  Hb: [{ min: 0, max: 7, message: 'Critical low Hb' }, { min: 20, max: Infinity, message: 'Critical high Hb' }],
  WBC: [{ min: 0, max: 2, message: 'Critical low WBC' }, { min: 30, max: Infinity, message: 'Critical high WBC' }],
  Platelets: [{ min: 0, max: 50, message: 'Critical low platelets' }],
  Urea: [{ min: 20, max: Infinity, message: 'Critical high urea' }],
  Cr: [{ min: 5, max: Infinity, message: 'Critical high creatinine' }],
  K: [{ min: 0, max: 2.8, message: 'Critical low K' }, { min: 6.5, max: Infinity, message: 'Critical high K' }],
  Na: [{ min: 0, max: 120, message: 'Critical low Na' }, { min: 160, max: Infinity, message: 'Critical high Na' }],
  INR: [{ min: 4, max: Infinity, message: 'Critical high INR' }],
  Lactate: [{ min: 4, max: Infinity, message: 'Critical high lactate' }],
  SpO2: [{ min: 0, max: 88, message: 'Critical low SpO2' }],
  Temp: [{ min: 0, max: 35, message: 'Critical hypothermia' }, { min: 39.5, max: Infinity, message: 'Critical high temp' }],
  Pulse: [{ min: 0, max: 40, message: 'Critical bradycardia' }, { min: 140, max: Infinity, message: 'Critical tachycardia' }],
  RR: [{ min: 0, max: 8, message: 'Critical low RR' }, { min: 30, max: Infinity, message: 'Critical high RR' }],
  pH: [{ min: 0, max: 7.2, message: 'Critical acidosis' }, { min: 7.6, max: Infinity, message: 'Critical alkalosis' }],
  pO2: [{ min: 0, max: 50, message: 'Critical low pO2' }],
  HCO3: [{ min: 0, max: 15, message: 'Critical low HCO3' }, { min: 35, max: Infinity, message: 'Critical high HCO3' }],
  Glucose: [{ min: 0, max: 2.5, message: 'Critical low glucose' }, { min: 25, max: Infinity, message: 'Critical high glucose' }],
}

export function checkCriticalValues(parsedValues: Record<string, string>): CriticalFlag[] {
  const flags: CriticalFlag[] = []
  for (const [metric, raw] of Object.entries(parsedValues)) {
    const value = parseFloat(raw)
    if (Number.isNaN(value)) continue
    const metricThresholds = thresholds[metric]
    if (!metricThresholds) continue
    for (const t of metricThresholds) {
      if (value >= t.min && value <= t.max) {
        flags.push({ metric, value, message: t.message })
        break
      }
    }
  }
  return flags
}

/** Parses a "Metric: value · Metric2: value2" body like Android checkBody. */
export function checkCriticalBody(body: string): CriticalFlag[] {
  const parsed: Record<string, string> = {}
  for (const part of body.split(' · ')) {
    const idx = part.indexOf(': ')
    if (idx > 0) parsed[part.slice(0, idx)] = part.slice(idx + 2)
  }
  return checkCriticalValues(parsed)
}
