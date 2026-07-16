// Simplified charge master (CPT code → description + price). Real hospitals have
// thousands of line items; this is a representative slice for the demo.

export const OFFICE_VISIT = { cptCode: "99213", description: "Office/outpatient visit, established patient", amount: 150 };

// Map an order name to a billable CPT line item.
const ORDER_CPT = {
  "Complete Blood Count (CBC)": { cptCode: "85025", description: "Complete blood count (CBC) with differential", amount: 35 },
  "Basic Metabolic Panel (BMP)": { cptCode: "80048", description: "Basic metabolic panel", amount: 40 },
  "Comprehensive Metabolic Panel (CMP)": { cptCode: "80053", description: "Comprehensive metabolic panel", amount: 47 },
  "Lipid Panel": { cptCode: "80061", description: "Lipid panel", amount: 65 },
  "Hemoglobin A1c": { cptCode: "83036", description: "Hemoglobin A1c", amount: 55 },
  "Thyroid Stimulating Hormone (TSH)": { cptCode: "84443", description: "Thyroid stimulating hormone (TSH)", amount: 60 },
  "Urinalysis": { cptCode: "81003", description: "Urinalysis, automated", amount: 20 },
  "COVID-19 PCR": { cptCode: "87635", description: "SARS-CoV-2 (COVID-19) amplified probe", amount: 90 },
  "Chest X-ray": { cptCode: "71046", description: "Radiologic exam, chest, 2 views", amount: 120 },
  "Electrocardiogram (ECG)": { cptCode: "93000", description: "Electrocardiogram, routine ECG", amount: 85 },
  "Echocardiogram": { cptCode: "93306", description: "Echocardiography, transthoracic", amount: 320 },
  "CT Head without contrast": { cptCode: "70450", description: "CT head/brain without contrast", amount: 480 },
  "MRI Lumbar Spine": { cptCode: "72148", description: "MRI lumbar spine without contrast", amount: 720 },
  "Abdominal Ultrasound": { cptCode: "76700", description: "Ultrasound, abdominal, complete", amount: 240 },
};

export function chargeForOrder(order) {
  const known = ORDER_CPT[order.name];
  if (known) return { ...known };
  // Fallback pricing by modality
  return order.type === "Imaging"
    ? { cptCode: "76999", description: order.name + " (imaging)", amount: 150 }
    : { cptCode: "89999", description: order.name + " (lab)", amount: 45 };
}
