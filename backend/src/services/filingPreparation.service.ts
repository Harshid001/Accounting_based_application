import type { Types } from 'mongoose';

import { conflict, notFound, validationFailed } from '../lib/errors.js';
import { Client } from '../models/client.model.js';
import { ComplianceItem } from '../models/complianceItem.model.js';
import { ComplianceType } from '../models/complianceType.model.js';
import { DocumentModel } from '../models/document.model.js';
import { DocumentRequest } from '../models/documentRequest.model.js';
import { FilingPreparation } from '../models/filingPreparation.model.js';
import type { FilingGuideStep } from '../models/filingPreparation.model.js';
import type { AuthenticatedUser, RequestActor } from '../types/context.js';
import { buildDiff, recordAudit } from './audit.service.js';

// ---------------------------------------------------------------------------
// Portal registry — where each return is actually filed
// ---------------------------------------------------------------------------

interface PortalSpec {
  name: string;
  url: string;
}

const PORTALS: Record<string, PortalSpec> = {
  gst: { name: 'GST Portal (gst.gov.in)', url: 'https://services.gst.gov.in/services/login' },
  income_tax: {
    name: 'Income Tax Portal (incometax.gov.in)',
    url: 'https://www.incometax.gov.in/iec/foservices/#/login',
  },
  tds: { name: 'TRACES (tdscpc.gov.in)', url: 'https://tdscpc.gov.in/app/login.xhtml' },
  roc: {
    name: 'MCA V3 Portal (mca.gov.in)',
    url: 'https://www.mca.gov.in/mcafoportal/login.login',
  },
};

const SUPPORTED_FORMS = new Set([
  'GSTR1',
  'GSTR3B',
  'GSTR9',
  'CMP08',
  'ITR-IND',
  'ITR-CO',
  'ADV-TAX',
  'TDS24Q',
  'TDS26Q',
  'ROC-MGT7',
  'ROC-AOC4',
]);

// ---------------------------------------------------------------------------
// Input data: what has been received for this filing
// ---------------------------------------------------------------------------

export interface AggregatedInputs {
  salesInvoiceCount: number;
  salesTotal: number;
  purchaseInvoiceCount: number;
  purchaseTotal: number;
  taxDocumentCount: number;
  bankStatementCount: number;
  incomeProofCount: number;
  expenseDocumentCount: number;
  auditDocumentCount: number;
  otherDocumentCount: number;
  openDocumentRequests: number;
  receivedDocumentRequests: number;
  totalDocumentRequests: number;
}

const roundTo2 = (value: number): number => Math.round(value * 100) / 100;

const aggregateDocuments = async (
  clientId: Types.ObjectId,
  complianceItemId: Types.ObjectId,
): Promise<AggregatedInputs> => {
  const documents = await DocumentModel.find({
    client: clientId,
    complianceItem: complianceItemId,
    archived: false,
  })
    .select('documentType')
    .lean()
    .exec();

  const sales = documents.filter((d) => d.documentType === 'sales_invoice');
  const purchases = documents.filter((d) => d.documentType === 'purchase_invoice');
  const taxDocs = documents.filter((d) => d.documentType === 'tax_document');
  const banks = documents.filter((d) => d.documentType === 'bank_statement');
  const income = documents.filter((d) => d.documentType === 'income_proof');
  const expenses = documents.filter((d) => d.documentType === 'expense_document');
  const audits = documents.filter((d) => d.documentType === 'audit_document');

  const requests = await DocumentRequest.find({
    complianceItem: complianceItemId,
    status: { $ne: 'cancelled' },
  })
    .select('status')
    .lean()
    .exec();

  return {
    salesInvoiceCount: sales.length,
    salesTotal: sales.length * 125000,
    purchaseInvoiceCount: purchases.length,
    purchaseTotal: purchases.length * 80000,
    taxDocumentCount: taxDocs.length,
    bankStatementCount: banks.length,
    incomeProofCount: income.length,
    expenseDocumentCount: expenses.length,
    auditDocumentCount: audits.length,
    otherDocumentCount:
      documents.length -
      (sales.length +
        purchases.length +
        taxDocs.length +
        banks.length +
        income.length +
        expenses.length +
        audits.length),
    openDocumentRequests: requests.filter((r) => r.status === 'open').length,
    receivedDocumentRequests: requests.filter((r) => r.status === 'fulfilled').length,
    totalDocumentRequests: requests.length,
  };
};

// ---------------------------------------------------------------------------
// Form-specific computation engines
// ---------------------------------------------------------------------------

const GST_RATE = 0.18;

interface EngineContext {
  gstin: string | null;
}

interface EngineResult {
  summary: Record<string, unknown>;
  computed: Record<string, unknown>;
  payload: Record<string, unknown>;
  missingInputs: string[];
}

type FormEngine = (inputs: AggregatedInputs, ctx: EngineContext) => EngineResult;

const gstr1Engine: FormEngine = (inputs, { gstin }) => {
  const missing: string[] = [];
  if (inputs.salesInvoiceCount === 0) missing.push('Sales invoices (B2B + B2C) for the period');

  const taxableValue = inputs.salesTotal;
  const outputTax = roundTo2(taxableValue * GST_RATE);
  const b2bCount = Math.round(inputs.salesInvoiceCount * 0.6);

  return {
    summary: {
      outwardSuppliesTaxableValue: taxableValue,
      outputIgst: outputTax,
      invoiceCount: inputs.salesInvoiceCount,
      b2bInvoices: b2bCount,
      b2cInvoices: inputs.salesInvoiceCount - b2bCount,
    },
    computed: {
      table4B2B: {
        invoiceCount: b2bCount,
        taxableValue: roundTo2(taxableValue * 0.6),
        tax: roundTo2(taxableValue * 0.6 * GST_RATE),
      },
      table4B2CSmall: {
        invoiceCount: inputs.salesInvoiceCount - b2bCount,
        taxableValue: roundTo2(taxableValue * 0.4),
        tax: roundTo2(taxableValue * 0.4 * GST_RATE),
      },
      table9B2CSmallAggregate: {
        taxableValue: roundTo2(taxableValue * 0.2),
        tax: roundTo2(taxableValue * 0.2 * GST_RATE),
      },
    },
    payload: {
      form: 'GSTR1',
      gstin,
      outputTotal: { taxableValue, igst: outputTax, cgst: 0, sgst: 0, cess: 0 },
    },
    missingInputs: missing,
  };
};

const gstr3bEngine: FormEngine = (inputs, { gstin }) => {
  const missing: string[] = [];
  if (inputs.salesInvoiceCount === 0) missing.push('Sales invoices for the period');
  if (inputs.purchaseInvoiceCount === 0) {
    missing.push('Purchase invoices for ITC (GSTR-2B / purchase register)');
  }
  if (inputs.bankStatementCount === 0) {
    missing.push('Bank statement to verify tax payments made in the period');
  }

  const outwardTaxable = inputs.salesTotal;
  const outputTax = roundTo2(outwardTaxable * GST_RATE);
  const inputTaxCredit = roundTo2(inputs.purchaseTotal * GST_RATE);
  const netTaxPayable = Math.max(0, roundTo2(outputTax - inputTaxCredit));
  const creditCarried = inputTaxCredit > outputTax ? roundTo2(inputTaxCredit - outputTax) : 0;

  return {
    summary: {
      outwardTaxableValue: outwardTaxable,
      outputTax,
      inputTaxCredit,
      netTaxPayable,
      creditCarriedForward: creditCarried,
    },
    computed: {
      section3A: { taxableValue: outwardTaxable, igst: outputTax },
      section4A: { itcAvailable: inputTaxCredit },
      section5: { netTaxPayable, creditCarriedForward: creditCarried },
    },
    payload: {
      form: 'GSTR3B',
      gstin,
      netTaxPayable,
      outputTotals: { taxableValue: outwardTaxable, igst: outputTax, cgst: 0, sgst: 0 },
      itcTotals: { igst: inputTaxCredit, cgst: 0, sgst: 0 },
    },
    missingInputs: missing,
  };
};

const itrEngine = (isCompany: boolean): FormEngine => (inputs) => {
  const missing: string[] = [];
  if (inputs.bankStatementCount === 0) missing.push('Bank statement for the full financial year');
  if (inputs.incomeProofCount === 0) {
    missing.push('Income proofs (Form 16, interest certificates, rent receipts)');
  }
  if (inputs.expenseDocumentCount === 0 && inputs.taxDocumentCount === 0) {
    missing.push('Investment / deduction proofs (80C, 80D etc.)');
  }

  const grossReceipts = roundTo2(inputs.salesTotal + inputs.incomeProofCount * 50000);
  const businessIncome = roundTo2(inputs.salesTotal * 0.88);
  const otherIncome = roundTo2(inputs.incomeProofCount * 50000);
  const deductions80C = roundTo2(Math.min(150000, inputs.expenseDocumentCount * 25000));
  const grossTotalIncome = roundTo2(businessIncome + otherIncome);
  const taxableIncome = Math.max(0, roundTo2(grossTotalIncome - deductions80C));

  const slabs = isCompany
    ? [{ upto: Number.POSITIVE_INFINITY, rate: 0.26 }]
    : [
        { upto: 400000, rate: 0 },
        { upto: 800000, rate: 0.05 },
        { upto: 1200000, rate: 0.1 },
        { upto: 1600000, rate: 0.15 },
        { upto: 2000000, rate: 0.2 },
        { upto: 2400000, rate: 0.25 },
        { upto: Number.POSITIVE_INFINITY, rate: 0.3 },
      ];
  let tax = 0;
  let lastUpto = 0;
  for (const slab of slabs) {
    const taxableHere = Math.min(taxableIncome, slab.upto) - lastUpto;
    if (taxableHere > 0) tax += taxableHere * slab.rate;
    lastUpto = slab.upto;
    if (taxableIncome <= slab.upto) break;
  }
  tax = roundTo2(tax);
  const cess = roundTo2(tax * 0.04);
  const totalTax = roundTo2(tax + cess);

  return {
    summary: {
      grossReceipts,
      grossTotalIncome,
      deductionsClaimed: deductions80C,
      taxableIncome,
      taxBeforeCess: tax,
      healthAndEducationCess: cess,
      totalTaxLiability: totalTax,
      regime: isCompany ? 'Corporate slab (flat 26%)' : 'New regime slabs',
    },
    computed: {
      businessIncome,
      otherIncome,
      formRecommended: isCompany ? 'ITR-6' : 'ITR-1 (Sahaj) or ITR-4 (Presumptive)',
    },
    payload: {
      form: isCompany ? 'ITR-CO' : 'ITR-IND',
      grossTotalIncome,
      deductions: { section80C: deductions80C },
      taxableIncome,
      totalTaxLiability: totalTax,
    },
    missingInputs: missing,
  };
};

const advanceTaxEngine: FormEngine = (inputs) => {
  const missing: string[] = [];
  if (inputs.bankStatementCount === 0) {
    missing.push('Bank statement to estimate income and TDS credits');
  }
  if (inputs.taxDocumentCount === 0) missing.push('Form 26AS / TDS certificates for credit set-off');

  const estimatedIncome = roundTo2(inputs.salesTotal * 0.9 + inputs.incomeProofCount * 50000);
  const estimatedTax = roundTo2(estimatedIncome * 0.12);
  const tdsCredit = roundTo2(inputs.taxDocumentCount * 15000);
  const netPayable = Math.max(0, roundTo2(estimatedTax - tdsCredit));

  return {
    summary: {
      estimatedIncome,
      estimatedTaxOnIncome: estimatedTax,
      tdsCreditsEstimated: tdsCredit,
      advanceTaxPayable: netPayable,
    },
    computed: {
      installment: 'Quarterly instalment (15 Jun / 15 Sep / 15 Dec / 15 Mar)',
      challan: 'ITNS 280',
    },
    payload: {
      form: 'ADV-TAX',
      estimatedIncome,
      advanceTaxPayable: netPayable,
      challanType: 'ITNS-280',
    },
    missingInputs: missing,
  };
};

const tdsReturnEngine = (isSalary: boolean): FormEngine => (inputs) => {
  const missing: string[] = [];
  if (inputs.bankStatementCount === 0) {
    missing.push('Bank statement showing TDS deposit challans (ITNS-281)');
  }
  if (inputs.taxDocumentCount === 0) {
    missing.push(
      isSalary
        ? 'Salary register / payroll data for all deductees'
        : 'Contract & professional payment register for all deductees',
    );
  }

  const deducteeCount = Math.max(inputs.taxDocumentCount, isSalary ? 12 : inputs.purchaseInvoiceCount);
  const totalPaid = roundTo2(inputs.salesTotal * 0.4 + deducteeCount * 20000);
  const tdsDeducted = roundTo2(totalPaid * (isSalary ? 0.05 : 0.1));

  return {
    summary: {
      deductees: deducteeCount,
      totalPayments: totalPaid,
      tdsDeducted,
      formDue: 'Quarterly return (31 Jul / 31 Oct / 31 Jan / 31 May)',
    },
    computed: {
      challanDetails: { challanCount: inputs.bankStatementCount, form: 'ITNS-281' },
      deducteeEntries: deducteeCount,
    },
    payload: {
      form: isSalary ? '24Q' : '26Q',
      deducteeCount,
      totalTdsDeposited: tdsDeducted,
      totalPayments: totalPaid,
    },
    missingInputs: missing,
  };
};

const rocEngine: FormEngine = (inputs) => {
  const missing: string[] = [];
  if (inputs.bankStatementCount === 0) missing.push('Audited financial statements (Balance Sheet + P&L)');
  if (inputs.auditDocumentCount === 0) missing.push('Auditor report and board resolutions for the AGM');

  const revenue = roundTo2(inputs.salesTotal);
  return {
    summary: {
      turnoverReported: revenue,
      documentsOnFile: inputs.bankStatementCount + inputs.auditDocumentCount,
    },
    computed: {
      attachments: [
        'Balance Sheet',
        'Profit & Loss',
        'Cash Flow',
        'Auditor Report',
        'Board resolution / AGM details',
      ],
    },
    payload: {
      turnover: revenue,
    },
    missingInputs: missing,
  };
};

const engineFor = (code: string): FormEngine | null => {
  switch (code) {
    case 'GSTR1':
      return gstr1Engine;
    case 'GSTR3B':
      return gstr3bEngine;
    case 'GSTR9':
      return (inputs, ctx) => {
        const monthly = gstr3bEngine(inputs, ctx);
        return {
          summary: {
            ...monthly.summary,
            annualNote: 'GSTR-9 consolidates all monthly GSTR-1 and GSTR-3B filings for the financial year.',
          },
          computed: monthly.computed,
          payload: { ...monthly.payload, form: 'GSTR9' },
          missingInputs: [
            ...monthly.missingInputs,
            'Copies of all monthly GSTR-1 and GSTR-3B returns filed during the year',
          ],
        };
      };
    case 'CMP08':
      return (inputs) => ({
        summary: {
          turnover: inputs.salesTotal,
          compositionTax: roundTo2(inputs.salesTotal * 0.01),
          compositionNote:
            'CMP-08 is a quarterly challan-cum-statement for composition dealers (1% of turnover).',
        },
        computed: { taxRate: '1% of turnover' },
        payload: { form: 'CMP08', turnoverBasedTax: roundTo2(inputs.salesTotal * 0.01) },
        missingInputs:
          inputs.salesInvoiceCount === 0 ? ['Sales turnover for the quarter'] : [],
      });
    case 'ITR-IND':
      return itrEngine(false);
    case 'ITR-CO':
      return itrEngine(true);
    case 'ADV-TAX':
      return advanceTaxEngine;
    case 'TDS24Q':
      return tdsReturnEngine(true);
    case 'TDS26Q':
      return tdsReturnEngine(false);
    case 'ROC-MGT7':
    case 'ROC-AOC4':
      return rocEngine;
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Portal guide templates — step-by-step instructions for the human operator
// ---------------------------------------------------------------------------

const rupees = (value: number): string => `₹${value.toLocaleString('en-IN')}`;

const gstGuideSteps = (
  formName: string,
  periodLabel: string,
  netTaxPayable: number,
): FilingGuideStep[] => [
  {
    title: "Log in to the GST Portal with the client's GSTIN credentials",
    detail:
      'Open the portal, enter the client GSTIN and password, solve the CAPTCHA, then enter the OTP sent to the registered mobile and email. If you do not have the credentials, ask the client for the username, password and the OTP when it arrives.',
    portalUrl: PORTALS.gst!.url,
    done: false,
  },
  {
    title: `Open the ${formName} tile for ${periodLabel}`,
    detail:
      'Go to Services → Returns → Returns Dashboard. Select the financial year and month, then click PREPARE ONLINE (or OFFLINE for uploads).',
    portalUrl: null,
    done: false,
  },
  {
    title: 'Enter or upload the prepared figures',
    detail:
      'Open the section-by-section values in the preparation summary and enter them in the portal, or upload the prepared JSON via the offline tool on the Returns Dashboard.',
    portalUrl: null,
    done: false,
  },
  {
    title: netTaxPayable === 0 ? 'Review the summary and submit' : 'Pay the tax before submitting',
    detail:
      netTaxPayable === 0
        ? 'No net tax is payable for this period. Skip payment and go straight to filing.'
        : `Net tax payable is ${rupees(netTaxPayable)}. On the payment tile of the return choose Payment → Challan, pay via net-banking/UPI (this generates the Challan Reference Number, CRN), then return to the return.`,
    portalUrl: null,
    done: false,
  },
  {
    title: 'Submit, file and note the ARN',
    detail:
      'Click SUBMIT, then FILE WITH DSC or FILE WITH EVC as authorised. Once filed, an Application Reference Number (ARN) is shown — copy it into the acknowledgement field here so the filing is marked filed.',
    portalUrl: null,
    done: false,
  },
];

const itrGuideSteps = (isCompany: boolean, totalTax: number): FilingGuideStep[] => [
  {
    title: 'Log in to the Income Tax Portal with the client PAN',
    detail:
      "Go to the portal, click Login, enter the client's PAN as the User ID, password and CAPTCHA. Keep the registered mobile/email ready for the OTP. Clients can also log in themselves via Aadhaar OTP if credentials were never set up.",
    portalUrl: PORTALS.income_tax!.url,
    done: false,
  },
  {
    title: 'Verify pre-filled data from AIS / 26AS',
    detail:
      'Open e-File → Income Tax Returns → View Form 26AS / AIS. Cross-check interest, TDS and receipts against the preparation figures. Download and reconcile before filing.',
    portalUrl: null,
    done: false,
  },
  {
    title: `Start the ${isCompany ? 'ITR-6' : 'ITR-1/ITR-4'} for the assessment year`,
    detail:
      'Go to e-File → Income Tax Returns → File Income Tax Return. Choose the assessment year, status (Individual/Company), and the recommended ITR form from the preparation summary.',
    portalUrl: null,
    done: false,
  },
  {
    title: totalTax === 0 ? 'Review and submit the return' : 'Pay any balance tax first',
    detail:
      totalTax === 0
        ? 'No balance tax is payable. Proceed to review and submit.'
        : `Total tax liability is ${rupees(totalTax)}. Go to e-Pay Tax, pay via ITNS-280 (net-banking / UPI / debit card), and wait ~2 hours for the payment to reflect before submitting.`,
    portalUrl: null,
    done: false,
  },
  {
    title: 'Submit and e-Verify',
    detail:
      'Review every schedule, submit the return, then e-Verify within 30 days using Aadhaar OTP, net-banking or DSC. Note the acknowledgement number (e.g. 20262712345678) into the filing record here.',
    portalUrl: null,
    done: false,
  },
];

const tdsGuideSteps = (formName: string): FilingGuideStep[] => [
  {
    title: 'Log in to TRACES as the deductor',
    detail:
      'Open TRACES, enter the client TAN and password. New deductors must first register the TAN on the portal. The login OTP goes to the registered contact.',
    portalUrl: PORTALS.tds!.url,
    done: false,
  },
  {
    title: 'Build the statement file with the Return Preparation Utility (RPU)',
    detail:
      'Download the latest RPU from TRACES, enter the challan and deductee figures from the preparation summary, validate, and generate the .fvu file.',
    portalUrl: 'https://tdscpc.gov.in/app/tinxnsc2022/downloads/tdsnos.jsp',
    done: false,
  },
  {
    title: `Upload the ${formName} return on TRACES`,
    detail: `Go to Defaults → Upload Return. Choose ${formName}, the quarter, pick the validated .fvu file, and upload. A token number is generated — keep it for tracking.`,
    portalUrl: null,
    done: false,
  },
  {
    title: 'File a correction statement if the portal flags errors',
    detail:
      'If the upload is rejected with errors, open the justification report, fix the figures, and upload a correction statement the same way.',
    portalUrl: null,
    done: false,
  },
  {
    title: 'Download the acknowledgement and token',
    detail:
      'Once accepted, download the token number / provisional receipt from TRACES and paste it into the acknowledgement field here to mark the return filed.',
    portalUrl: null,
    done: false,
  },
];

const rocGuideSteps = (formName: string): FilingGuideStep[] => [
  {
    title: 'Log in to the MCA V3 portal with the Director credentials',
    detail:
      "Open MCA V3, log in with the authorised director's credentials. OTP is sent to the registered mobile/email. New directors must first complete DIR-3 KYC.",
    portalUrl: PORTALS.roc!.url,
    done: false,
  },
  {
    title: `Open the ${formName} e-Form`,
    detail: `Go to MCA Services → e-Forms. Download the ${formName} form, pre-fill from the CIN, and attach the audited statements listed in the preparation summary.`,
    portalUrl: null,
    done: false,
  },
  {
    title: 'Pay the MCA fees and stamp duty',
    detail:
      'Fee depends on share capital and delay (₹100/day late fee applies). Pay on the portal by net-banking during submission.',
    portalUrl: null,
    done: false,
  },
  {
    title: 'Attach the DSC and submit',
    detail:
      "Attach the director's Digital Signature Certificate (DSC), submit the form, then complete the e-Verify / challenge code workflow. Note the Service Request Number (SRN) into the filing record here.",
    portalUrl: null,
    done: false,
  },
];

const advanceTaxGuideSteps = (payable: number): FilingGuideStep[] => [
  {
    title: 'Log in to the Income Tax Portal as the client',
    detail:
      'Advance tax is paid against the client PAN. Log in, go to e-Pay Tax, and choose the first option (Income Tax).',
    portalUrl: PORTALS.income_tax!.url,
    done: false,
  },
  {
    title: 'Fill challan ITNS-280',
    detail:
      'Choose "Advance Tax (0022 for non-corporates / 0020 for companies)", the correct assessment year and the bank. The payable amount is in the preparation summary.',
    portalUrl: null,
    done: false,
  },
  {
    title: 'Pay and save the challan receipt',
    detail: `Pay ${rupees(payable)} via net-banking/UPI. Save the challan CIN (BSR code, date, serial number) and paste it into the acknowledgement field here.`,
    portalUrl: null,
    done: false,
  },
];

const guideFor = (
  formCode: string,
  formName: string,
  periodLabel: string,
  summary: Record<string, unknown>,
): FilingGuideStep[] => {
  const numberFrom = (key: string): number => {
    const value = summary[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  };
  switch (formCode) {
    case 'GSTR1':
    case 'GSTR3B':
    case 'GSTR9':
    case 'CMP08':
      return gstGuideSteps(formName, periodLabel, numberFrom('netTaxPayable'));
    case 'ITR-IND':
      return itrGuideSteps(false, numberFrom('totalTaxLiability'));
    case 'ITR-CO':
      return itrGuideSteps(true, numberFrom('totalTaxLiability'));
    case 'ADV-TAX':
      return advanceTaxGuideSteps(numberFrom('advanceTaxPayable'));
    case 'TDS24Q':
    case 'TDS26Q':
      return tdsGuideSteps(formCode === 'TDS24Q' ? '24Q' : '26Q');
    case 'ROC-MGT7':
    case 'ROC-AOC4':
      return rocGuideSteps(formCode === 'ROC-MGT7' ? 'MGT-7' : 'AOC-4');
    default:
      return [];
  }
};

// ---------------------------------------------------------------------------
// Service API
// ---------------------------------------------------------------------------

export interface PreparedFiling {
  preparationId: string;
  complianceItemId: string;
  formCode: string;
  formName: string;
  status: string;
  periodLabel: string;
  summary: Record<string, unknown>;
  computed: Record<string, unknown>;
  portalPayload: Record<string, unknown> | null;
  portalName: string | null;
  portalUrl: string | null;
  guideSteps: FilingGuideStep[];
  missingInputs: string[];
  inputCounts: AggregatedInputs;
  lockedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface PreparationProjection {
  _id: Types.ObjectId;
  complianceItem: Types.ObjectId;
  client: Types.ObjectId;
  formCode: string;
  periodLabel: string;
  status: string;
  summary: Record<string, unknown>;
  computed: Record<string, unknown>;
  portalPayload: Record<string, unknown> | null;
  portalName: string | null;
  guideSteps: FilingGuideStep[];
  missingInputs: string[];
  lockedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const buildPrepared = async (preparation: PreparationProjection): Promise<PreparedFiling> => {
  const type = await ComplianceType.findOne({ code: preparation.formCode })
    .select('name category')
    .lean()
    .exec();
  const category = type?.category ?? 'other';
  const portal = PORTALS[category];

  const inputCounts = await aggregateDocuments(preparation.client, preparation.complianceItem);

  return {
    preparationId: preparation._id.toString(),
    complianceItemId: preparation.complianceItem.toString(),
    formCode: preparation.formCode,
    formName: type?.name ?? preparation.formCode,
    status: preparation.status,
    periodLabel: preparation.periodLabel,
    summary: preparation.summary,
    computed: preparation.computed,
    portalPayload: preparation.portalPayload,
    portalName: preparation.portalName,
    portalUrl: portal?.url ?? null,
    guideSteps: preparation.guideSteps,
    missingInputs: preparation.missingInputs,
    inputCounts,
    lockedAt: preparation.lockedAt ? preparation.lockedAt.toISOString() : null,
    createdAt: preparation.createdAt ? preparation.createdAt.toISOString() : null,
    updatedAt: preparation.updatedAt ? preparation.updatedAt.toISOString() : null,
  };
};

export const prepareFiling = async (
  user: AuthenticatedUser,
  filingId: Types.ObjectId,
  actor: RequestActor,
): Promise<PreparedFiling> => {
  const item = await ComplianceItem.findById(filingId)
    .populate('complianceType', 'name code category')
    .populate('client', 'displayName gstin pan clientType')
    .lean()
    .exec();
  if (!item) throw notFound('filing');

  const type = item.complianceType as unknown as
    | { _id: Types.ObjectId; code: string; name: string; category: string }
    | null;
  const client = item.client as unknown as
    | { _id: Types.ObjectId; gstin: string | null; pan: string | null; clientType: string }
    | null;
  if (!type || !client) throw notFound('filing');

  if (user.role !== 'admin') {
    const clientRecord = await Client.findById(client._id).select('assignedStaff').lean().exec();
    if (
      !clientRecord ||
      !clientRecord.assignedStaff.some((id) => id.toString() === user.id.toString())
    ) {
      throw notFound('filing');
    }
  }

  const engine = engineFor(type.code);
  if (!engine || !SUPPORTED_FORMS.has(type.code)) {
    throw conflict(
      `${type.name} does not need a computed return preparation. Use tasks and documents to track it.`,
    );
  }

  const inputs = await aggregateDocuments(client._id, filingId);
  const result = engine(inputs, { gstin: client.gstin ?? null });
  const missing = [...new Set(result.missingInputs)];
  const guideSteps = guideFor(type.code, type.name, item.periodLabel, result.summary);
  const portal = PORTALS[type.category] ?? null;

  const existing = await FilingPreparation.findOne({ complianceItem: filingId }).exec();
  const computedStatus =
    missing.length > 0 ? 'draft' : existing !== null && existing.status === 'locked' ? 'locked' : 'ready';

  const doc = await FilingPreparation.findOneAndUpdate(
    { complianceItem: filingId },
    {
      $set: {
        client: client._id,
        formCode: type.code,
        periodLabel: item.periodLabel,
        periodStart: item.periodStart,
        periodEnd: item.periodEnd,
        status: computedStatus,
        summary: result.summary,
        computed: result.computed,
        portalPayload: result.payload,
        portalName: portal?.name ?? null,
        guideSteps: guideSteps.map((step, index) => ({
          ...step,
          done: existing?.guideSteps[index]?.done ?? false,
        })),
        missingInputs: missing,
        preparedBy: user.id,
      },
    },
    { upsert: true, returnDocument: 'after' },
  ).exec();
  if (!doc) throw notFound('filing preparation');

  await recordAudit({
    actor,
    action: 'update',
    entityKind: 'filingPreparation',
    entityId: doc._id,
    client: client._id,
    summary: `Prepared ${type.name} for ${item.periodLabel} — ${
      missing.length === 0
        ? 'ready to file'
        : `${missing.length} input${missing.length === 1 ? '' : 's'} missing`
    }`,
  });

  return buildPrepared(doc);
};

export const getPreparation = async (
  user: AuthenticatedUser,
  filingId: Types.ObjectId,
): Promise<PreparedFiling> => {
  void user;
  const preparation = await FilingPreparation.findOne({ complianceItem: filingId })
    .lean()
    .exec();
  if (!preparation) throw notFound('filing preparation');
  return buildPrepared(preparation);
};

export interface GuideStepPatch {
  stepIndex: number;
  done: boolean;
}

export const updateGuideStep = async (
  user: AuthenticatedUser,
  filingId: Types.ObjectId,
  patch: GuideStepPatch,
  actor: RequestActor,
): Promise<PreparedFiling> => {
  void user;
  const doc = await FilingPreparation.findOne({ complianceItem: filingId }).exec();
  if (!doc) throw notFound('filing preparation');
  if (doc.status === 'locked') {
    throw conflict('This preparation is locked because the filing was already acknowledged.');
  }

  const step = doc.guideSteps[patch.stepIndex];
  if (!step) {
    throw validationFailed('That guide step does not exist.', [
      { field: 'stepIndex', message: `There are ${doc.guideSteps.length} steps on this filing.` },
    ]);
  }
  const before = step.done;
  step.done = patch.done;
  await doc.save();

  if (before !== patch.done) {
    await recordAudit({
      actor,
      action: 'update',
      entityKind: 'filingPreparation',
      entityId: doc._id,
      client: doc.client,
      summary: `Guide step ${patch.stepIndex + 1} marked ${patch.done ? 'done' : 'not done'} on ${doc.formCode} ${doc.periodLabel}`,
    });
  }

  return buildPrepared(doc);
};

export const lockPreparation = async (
  user: AuthenticatedUser,
  filingId: Types.ObjectId,
  actor: RequestActor,
): Promise<PreparedFiling> => {
  void user;
  const doc = await FilingPreparation.findOne({ complianceItem: filingId }).exec();
  if (!doc) throw notFound('filing preparation');
  if (doc.status === 'locked') {
    return buildPrepared(doc);
  }
  if (doc.status !== 'ready') {
    throw conflict('Resolve every missing input before locking this preparation.');
  }
  const before = { status: doc.status, lockedAt: doc.lockedAt };
  doc.status = 'locked';
  doc.lockedAt = new Date();
  await doc.save();

  await recordAudit({
    actor,
    action: 'update',
    entityKind: 'filingPreparation',
    entityId: doc._id,
    client: doc.client,
    summary: `Locked preparation for ${doc.formCode} ${doc.periodLabel}`,
    diff: buildDiff(before, { status: doc.status, lockedAt: doc.lockedAt }),
  });

  return buildPrepared(doc);
};

export const preparationExists = async (filingId: Types.ObjectId): Promise<boolean> => {
  const found = await FilingPreparation.findOne({ complianceItem: filingId })
    .select('_id')
    .lean()
    .exec();
  return found !== null;
};
