import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  FileCheck2,
  HelpCircle,
  LogOut,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';

import { signOutEverywhere } from '@/api/authClient';
import { submitPortalOnboarding } from '@/api/portal.api';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/error-state';
import { FieldRow, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/context/SessionContext';
import { useToast } from '@/context/ToastContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  CLIENT_TYPE_LABELS,
  ENTITY_TYPE_LABELS,
  INDIAN_STATES,
} from '@/lib/constants';
import { fieldErrorMap, normaliseError } from '@/lib/errors';
import { homePathFor } from '@/lib/permissions';
import { onboardingSchema, toOnboardingPayload } from '@/schemas/client.schema';
import type { OnboardingFormValues } from '@/schemas/client.schema';
import type { EntityType } from '@/types/enums';

const SERVICE_OPTIONS = [
  { id: 'gst', title: 'GST Compliance & Filings', desc: 'Monthly / Quarterly GSTR-1, GSTR-3B & Annual GSTR-9' },
  { id: 'income_tax', title: 'Income Tax & ITR Filing', desc: 'Corporate / Business & Personal ITR, Advance Tax' },
  { id: 'tds', title: 'TDS & TCS Returns', desc: 'Quarterly TDS returns, Form 16/16A generation & challans' },
  { id: 'bookkeeping', title: 'Bookkeeping & Accounts', desc: 'Monthly accounting, P&L, Balance Sheet & ledger reconciliation' },
  { id: 'roc', title: 'ROC & MCA Compliances', desc: 'Annual filings, Director KYC, resolutions & corporate filings' },
  { id: 'audit', title: 'Audit & Assurance', desc: 'Tax audit (44AB), statutory audit assistance & certifications' },
  { id: 'payroll', title: 'Payroll & Labour Laws', desc: 'PF, ESIC, Professional Tax & monthly payslip processing' },
];

const STEPS = [
  { id: 1, title: 'Entity Profile', icon: Building2 },
  { id: 2, title: 'Tax & Registration', icon: ShieldCheck },
  { id: 3, title: 'Registered Address', icon: MapPin },
  { id: 4, title: 'Primary Contact', icon: UserCheck },
  { id: 5, title: 'Services & Submission', icon: Briefcase },
];

export function Unlinked() {
  usePageTitle('Client Onboarding — FirmDesk');
  const { status, user, refresh, clear } = useSession();
  const { success, errorToast } = useToast();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSupport, setShowSupport] = useState(false);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      clientType: 'business',
      displayName: '',
      legalName: '',
      entityType: 'pvt_ltd',
      pan: '',
      gstin: '',
      tan: '',
      cin: '',
      aadhaar: '',
      incorporationDate: '',
      dateOfBirth: '',
      primaryContact: {
        name: user?.name ?? '',
        email: user?.email ?? '',
        phone: '',
        role: 'Director / Owner',
      },
      address: {
        line1: '',
        line2: '',
        city: '',
        state: 'Maharashtra',
        pincode: '',
      },
      requestedServices: ['gst', 'income_tax', 'bookkeeping'],
      notes: '',
    },
  });

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={24} label="Checking your account status" />
      </div>
    );
  }

  if (status === 'anonymous') return <Navigate to="/sign-in" replace />;
  if (status === 'unverified') return <Navigate to="/verify-email" replace />;
  if (user !== null && !user.unlinked) return <Navigate to={homePathFor(user.role)} replace />;

  const clientType = form.watch('clientType');
  const selectedServices = form.watch('requestedServices');

  const toggleService = (serviceId: string) => {
    const current = form.getValues('requestedServices');
    if (current.includes(serviceId)) {
      form.setValue(
        'requestedServices',
        current.filter((id) => id !== serviceId),
        { shouldValidate: true },
      );
    } else {
      form.setValue('requestedServices', [...current, serviceId], { shouldValidate: true });
    }
  };

  const handleNextStep = async () => {
    setFormError(null);
    let valid = true;

    if (currentStep === 1) {
      valid = await form.trigger(['displayName', 'legalName', 'clientType', 'entityType', 'incorporationDate', 'dateOfBirth']);
    } else if (currentStep === 2) {
      valid = await form.trigger(['pan', 'gstin', 'tan', 'cin', 'aadhaar']);
    } else if (currentStep === 3) {
      valid = await form.trigger(['address.line1', 'address.city', 'address.state', 'address.pincode']);
    } else if (currentStep === 4) {
      valid = await form.trigger(['primaryContact.name', 'primaryContact.email', 'primaryContact.phone', 'primaryContact.role']);
    }

    if (valid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    }
  };

  const handlePrevStep = () => {
    setFormError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const payload = toOnboardingPayload(values);
      await submitPortalOnboarding(payload);
      success('Onboarding details submitted', 'Welcome to FirmDesk Accounting!');
      await refresh();
      void navigate('/portal', { replace: true });
    } catch (err: unknown) {
      const normalised = normaliseError(err);
      const fieldErrors = fieldErrorMap(normalised);
      const fieldKeys = Object.keys(fieldErrors);

      if (fieldKeys.length > 0) {
        for (const [key, msg] of Object.entries(fieldErrors)) {
          form.setError(key as Parameters<typeof form.setError>[0], { message: msg });
        }

        const step1Fields = ['displayName', 'legalName', 'clientType', 'entityType', 'incorporationDate', 'dateOfBirth'];
        const step2Fields = ['pan', 'gstin', 'tan', 'cin', 'aadhaar'];
        const step3Prefixes = ['address.', 'address'];
        const step4Prefixes = ['primaryContact.', 'primaryContact'];

        if (fieldKeys.some((k) => step1Fields.includes(k))) {
          setCurrentStep(1);
        } else if (fieldKeys.some((k) => step2Fields.includes(k))) {
          setCurrentStep(2);
        } else if (fieldKeys.some((k) => step3Prefixes.some((p) => k.startsWith(p)))) {
          setCurrentStep(3);
        } else if (fieldKeys.some((k) => step4Prefixes.some((p) => k.startsWith(p)))) {
          setCurrentStep(4);
        }

        const errorSummaries = Object.entries(fieldErrors)
          .map(([f, m]) => `${f}: ${m}`)
          .join(' | ');
        setFormError(errorSummaries);
      } else {
        setFormError(normalised.message);
      }
      errorToast(err, 'Could not complete intake submission');
    }
  });

  const signOut = (): void => {
    void signOutEverywhere()
      .then(() => clear())
      .catch(() => clear());
  };

  return (
    <div className="fd-wide-auth w-full space-y-6">
      <div className="rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fd-accent)]/30 bg-[var(--fd-accent)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--fd-accent)]">
              <Sparkles size={12} />
              <span>Accounting Client Intake</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--fd-text-primary)] sm:text-2xl">
              Welcome to FirmDesk
            </h1>
            <p className="text-sm text-[var(--fd-text-secondary)]">
              Complete your business details below so our Chartered Accountants and team can set up your filings, compliances, and documents.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setShowSupport(!showSupport)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--fd-border)] bg-[var(--fd-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--fd-text-secondary)] transition-colors hover:bg-[var(--fd-surface-3)]"
            >
              <HelpCircle size={14} />
              <span>Assistance</span>
            </button>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--fd-border)] bg-[var(--fd-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--fd-text-tertiary)] transition-colors hover:text-[var(--fd-status-danger)]"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </div>

        {showSupport && (
          <div className="mt-4 rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] p-4 text-xs text-[var(--fd-text-secondary)]">
            <p className="font-semibold text-[var(--fd-text-primary)]">Need assistance filling your details?</p>
            <p className="mt-1">
              You can contact your assigned practice admin directly at <strong className="text-[var(--fd-text-primary)]">support@firmdesk.in</strong>. Once you submit this form, your client dashboard, document upload center, and direct messaging channel with your accountant will activate automatically.
            </p>
          </div>
        )}

        <div className="mt-6 border-t border-[var(--fd-border-subtle)] pt-6">
          <div className="grid grid-cols-5 gap-2">
            {STEPS.map((step) => {
              const isDone = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              return (
                <button
                  type="button"
                  key={step.id}
                  onClick={() => {
                    if (step.id < currentStep) setCurrentStep(step.id);
                  }}
                  disabled={step.id > currentStep}
                  className={`flex flex-col items-center gap-1.5 rounded-lg p-2 text-center transition-all ${
                    isCurrent
                      ? 'bg-[var(--fd-surface-2)] ring-1 ring-[var(--fd-accent)] text-[var(--fd-text-primary)]'
                      : isDone
                      ? 'text-[var(--fd-status-done)] hover:bg-[var(--fd-surface-2)]'
                      : 'text-[var(--fd-text-tertiary)] opacity-60'
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isDone
                        ? 'bg-[var(--fd-status-done-bg)] text-[var(--fd-status-done)]'
                        : isCurrent
                        ? 'bg-[var(--fd-accent)] text-white'
                        : 'bg-[var(--fd-surface-3)] text-[var(--fd-text-tertiary)]'
                    }`}
                  >
                    {isDone ? <Check size={14} /> : step.id}
                  </div>
                  <span className="hidden text-2xs font-medium sm:block">{step.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-6 shadow-sm">
        {formError && (
          <div className="mb-6">
            <InlineError message={formError} />
          </div>
        )}

        <form onSubmit={onSubmit} noValidate>
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="border-b border-[var(--fd-border-subtle)] pb-3">
                <h2 className="text-base font-semibold text-[var(--fd-text-primary)]">
                  Step 1: Entity & Practice Profile
                </h2>
                <p className="text-xs text-[var(--fd-text-secondary)]">
                  Select whether you are onboarding an enterprise/business or as an individual taxpayer.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => form.setValue('clientType', 'business')}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center transition-all ${
                    clientType === 'business'
                      ? 'border-[var(--fd-accent)] bg-[var(--fd-surface-2)] text-[var(--fd-text-primary)] shadow-sm ring-1 ring-[var(--fd-accent)]'
                      : 'border-[var(--fd-border)] bg-[var(--fd-surface-1)] text-[var(--fd-text-secondary)] hover:border-[var(--fd-border-strong)]'
                  }`}
                >
                  <Building2 size={24} className={clientType === 'business' ? 'text-[var(--fd-accent)]' : ''} />
                  <div>
                    <div className="text-sm font-semibold">Business / Company</div>
                    <div className="text-2xs text-[var(--fd-text-tertiary)]">Pvt Ltd, LLP, Partnership, Proprietorship</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => form.setValue('clientType', 'individual')}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center transition-all ${
                    clientType === 'individual'
                      ? 'border-[var(--fd-accent)] bg-[var(--fd-surface-2)] text-[var(--fd-text-primary)] shadow-sm ring-1 ring-[var(--fd-accent)]'
                      : 'border-[var(--fd-border)] bg-[var(--fd-surface-1)] text-[var(--fd-text-secondary)] hover:border-[var(--fd-border-strong)]'
                  }`}
                >
                  <UserCheck size={24} className={clientType === 'individual' ? 'text-[var(--fd-accent)]' : ''} />
                  <div>
                    <div className="text-sm font-semibold">Individual Taxpayer</div>
                    <div className="text-2xs text-[var(--fd-text-tertiary)]">Salaried, Professional, Consultant, HUF</div>
                  </div>
                </button>
              </div>

              <FieldRow>
                <FormField
                  label={clientType === 'business' ? 'Trade / Business Name' : 'Full Name'}
                  required
                  error={form.formState.errors.displayName?.message}
                  helper="The familiar name your firm knows you by."
                >
                  {({ inputId, invalid }) => (
                    <Input
                      id={inputId}
                      placeholder={clientType === 'business' ? 'e.g. Apex Logistics' : 'e.g. Rahul Sharma'}
                      invalid={invalid}
                      {...form.register('displayName')}
                    />
                  )}
                </FormField>

                <FormField
                  label="Legal Registered Name"
                  helper="Exact name registered on Certificate of Incorporation / PAN."
                  error={form.formState.errors.legalName?.message}
                >
                  {({ inputId, invalid }) => (
                    <Input
                      id={inputId}
                      placeholder={clientType === 'business' ? 'e.g. Apex Logistics Private Limited' : 'As on PAN Card'}
                      invalid={invalid}
                      {...form.register('legalName')}
                    />
                  )}
                </FormField>
              </FieldRow>

              {clientType === 'business' && (
                <FieldRow>
                  <FormField
                    label="Entity Structure"
                    required
                    error={form.formState.errors.entityType?.message}
                  >
                    {({ inputId }) => (
                      <Select
                        id={inputId}
                        value={form.watch('entityType') ?? 'pvt_ltd'}
                        onValueChange={(val) => form.setValue('entityType', val as EntityType)}
                        options={Object.entries(ENTITY_TYPE_LABELS).map(([k, label]) => ({
                          value: k,
                          label,
                        }))}
                      />
                    )}
                  </FormField>

                  <FormField
                    label="Incorporation / Start Date"
                    helper="YYYY-MM-DD"
                    error={form.formState.errors.incorporationDate?.message}
                  >
                    {({ inputId, invalid }) => (
                      <Input
                        id={inputId}
                        type="date"
                        invalid={invalid}
                        {...form.register('incorporationDate')}
                      />
                    )}
                  </FormField>
                </FieldRow>
              )}

              {clientType === 'individual' && (
                <FormField
                  label="Date of Birth"
                  helper="Required for Indian Income Tax Return (ITR) verification."
                  error={form.formState.errors.dateOfBirth?.message}
                >
                  {({ inputId, invalid }) => (
                    <Input
                      id={inputId}
                      type="date"
                      invalid={invalid}
                      {...form.register('dateOfBirth')}
                    />
                  )}
                </FormField>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="border-b border-[var(--fd-border-subtle)] pb-3">
                <h2 className="text-base font-semibold text-[var(--fd-text-primary)]">
                  Step 2: Tax & Government Registrations
                </h2>
                <p className="text-xs text-[var(--fd-text-secondary)]">
                  Enter your Indian tax registration numbers. All numbers are validated against official formats.
                </p>
              </div>

              <FieldRow>
                <FormField
                  label="PAN (Permanent Account Number)"
                  helper="10 characters: 5 letters, 4 digits, 1 letter."
                  error={form.formState.errors.pan?.message}
                >
                  {({ inputId, invalid }) => (
                    <Input
                      id={inputId}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      className="uppercase font-mono"
                      invalid={invalid}
                      {...form.register('pan')}
                    />
                  )}
                </FormField>

                {clientType === 'business' && (
                  <FormField
                    label="GSTIN (Goods and Services Tax ID)"
                    helper="15 characters starting with state code, e.g. 27ABCDE1234F1Z5."
                    error={form.formState.errors.gstin?.message}
                  >
                    {({ inputId, invalid }) => (
                      <Input
                        id={inputId}
                        placeholder="27ABCDE1234F1Z5"
                        maxLength={15}
                        className="uppercase font-mono"
                        invalid={invalid}
                        {...form.register('gstin')}
                      />
                    )}
                  </FormField>
                )}
              </FieldRow>

              {clientType === 'business' && (
                <FieldRow>
                  <FormField
                    label="TAN (Tax Deduction Account Number)"
                    helper="4 letters, 5 digits, 1 letter. Required if you deduct TDS."
                    error={form.formState.errors.tan?.message}
                  >
                    {({ inputId, invalid }) => (
                      <Input
                        id={inputId}
                        placeholder="MUMA12345B"
                        maxLength={10}
                        className="uppercase font-mono"
                        invalid={invalid}
                        {...form.register('tan')}
                      />
                    )}
                  </FormField>

                  <FormField
                    label="CIN / LLPIN (Company Registration ID)"
                    helper="21-character Corporate Identification Number."
                    error={form.formState.errors.cin?.message}
                  >
                    {({ inputId, invalid }) => (
                      <Input
                        id={inputId}
                        placeholder="U72200MH2020PTC123456"
                        maxLength={21}
                        className="uppercase font-mono"
                        invalid={invalid}
                        {...form.register('cin')}
                      />
                    )}
                  </FormField>
                </FieldRow>
              )}

              {clientType === 'individual' && (
                <FormField
                  label="Aadhaar Number"
                  helper="12 digits. Encrypted with AES-256-GCM at rest and protected by Indian privacy laws."
                  error={form.formState.errors.aadhaar?.message}
                >
                  {({ inputId, invalid }) => (
                    <Input
                      id={inputId}
                      placeholder="12-digit number"
                      maxLength={14}
                      className="font-mono"
                      invalid={invalid}
                      {...form.register('aadhaar')}
                    />
                  )}
                </FormField>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="border-b border-[var(--fd-border-subtle)] pb-3">
                <h2 className="text-base font-semibold text-[var(--fd-text-primary)]">
                  Step 3: Registered & Operating Address
                </h2>
                <p className="text-xs text-[var(--fd-text-secondary)]">
                  Used for official tax notices, invoice generation, and GST jurisdiction mapping.
                </p>
              </div>

              <FormField
                label="Address Line 1"
                required
                error={form.formState.errors.address?.line1?.message}
              >
                {({ inputId, invalid }) => (
                  <Input
                    id={inputId}
                    placeholder="Office / Flat / Building number, Street"
                    invalid={invalid}
                    {...form.register('address.line1')}
                  />
                )}
              </FormField>

              <FormField
                label="Address Line 2"
                error={form.formState.errors.address?.line2?.message}
              >
                {({ inputId, invalid }) => (
                  <Input
                    id={inputId}
                    placeholder="Area / Landmark / Sector"
                    invalid={invalid}
                    {...form.register('address.line2')}
                  />
                )}
              </FormField>

              <FieldRow className="sm:grid-cols-3">
                <FormField
                  label="City"
                  required
                  error={form.formState.errors.address?.city?.message}
                >
                  {({ inputId, invalid }) => (
                    <Input
                      id={inputId}
                      placeholder="e.g. Mumbai"
                      invalid={invalid}
                      {...form.register('address.city')}
                    />
                  )}
                </FormField>

                <FormField
                  label="State"
                  required
                  error={form.formState.errors.address?.state?.message}
                >
                  {({ inputId }) => (
                    <Select
                      id={inputId}
                      value={form.watch('address.state') ?? 'Maharashtra'}
                      onValueChange={(val) => form.setValue('address.state', val)}
                      options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
                    />
                  )}
                </FormField>

                <FormField
                  label="Pincode"
                  required
                  error={form.formState.errors.address?.pincode?.message}
                >
                  {({ inputId, invalid }) => (
                    <Input
                      id={inputId}
                      placeholder="6 digits"
                      maxLength={6}
                      invalid={invalid}
                      {...form.register('address.pincode')}
                    />
                  )}
                </FormField>
              </FieldRow>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-5">
              <div className="border-b border-[var(--fd-border-subtle)] pb-3">
                <h2 className="text-base font-semibold text-[var(--fd-text-primary)]">
                  Step 4: Primary Contact & Authorized Signatory
                </h2>
                <p className="text-xs text-[var(--fd-text-secondary)]">
                  The person our Chartered Accountants will contact for approvals, documents, and queries.
                </p>
              </div>

              <FieldRow>
                <FormField
                  label="Contact Person Name"
                  required
                  error={form.formState.errors.primaryContact?.name?.message}
                >
                  {({ inputId, invalid }) => (
                    <Input
                      id={inputId}
                      placeholder="Full Name"
                      invalid={invalid}
                      {...form.register('primaryContact.name')}
                    />
                  )}
                </FormField>

                <FormField
                  label="Role / Designation"
                  error={form.formState.errors.primaryContact?.role?.message}
                >
                  {({ inputId, invalid }) => (
                    <Input
                      id={inputId}
                      placeholder="e.g. Director, Managing Partner, Owner"
                      invalid={invalid}
                      {...form.register('primaryContact.role')}
                    />
                  )}
                </FormField>
              </FieldRow>

              <FieldRow>
                <FormField
                  label="Official Email Address"
                  required
                  error={form.formState.errors.primaryContact?.email?.message}
                >
                  {({ inputId, invalid }) => (
                    <Input
                      id={inputId}
                      type="email"
                      placeholder="name@company.com"
                      invalid={invalid}
                      {...form.register('primaryContact.email')}
                    />
                  )}
                </FormField>

                <FormField
                  label="Mobile Number"
                  required
                  helper="10 digits. Used for OTP verification and urgent compliance alerts."
                  error={form.formState.errors.primaryContact?.phone?.message}
                >
                  {({ inputId, invalid }) => (
                    <Input
                      id={inputId}
                      placeholder="9876543210"
                      maxLength={10}
                      invalid={invalid}
                      {...form.register('primaryContact.phone')}
                    />
                  )}
                </FormField>
              </FieldRow>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-5">
              <div className="border-b border-[var(--fd-border-subtle)] pb-3">
                <h2 className="text-base font-semibold text-[var(--fd-text-primary)]">
                  Step 5: Accounting Services Needed & Notes
                </h2>
                <p className="text-xs text-[var(--fd-text-secondary)]">
                  Select which services you require from the firm, and leave any initial questions for your accountant.
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--fd-text-secondary)]">
                  Required Services (Choose all that apply)
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {SERVICE_OPTIONS.map((srv) => {
                    const isChecked = selectedServices.includes(srv.id);
                    return (
                      <button
                        type="button"
                        key={srv.id}
                        onClick={() => toggleService(srv.id)}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                          isChecked
                            ? 'border-[var(--fd-accent)] bg-[var(--fd-surface-2)] ring-1 ring-[var(--fd-accent)]'
                            : 'border-[var(--fd-border)] bg-[var(--fd-surface-1)] hover:border-[var(--fd-border-strong)]'
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            isChecked
                              ? 'border-[var(--fd-accent)] bg-[var(--fd-accent)] text-white'
                              : 'border-[var(--fd-border-strong)] bg-transparent'
                          }`}
                        >
                          {isChecked && <Check size={12} strokeWidth={3} />}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[var(--fd-text-primary)]">{srv.title}</div>
                          <div className="text-2xs text-[var(--fd-text-tertiary)]">{srv.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <FormField
                label="Message or Instructions for the CA Team"
                helper="Share any special instructions, previous years pending work, or questions about onboarding."
                error={form.formState.errors.notes?.message}
              >
                {({ inputId, invalid }) => (
                  <Textarea
                    id={inputId}
                    rows={3}
                    placeholder="e.g. Please help verify our GST ITC reconciliation for Q3 and assist with annual tax return."
                    invalid={invalid}
                    {...form.register('notes')}
                  />
                )}
              </FormField>

              <div className="rounded-lg border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)] p-4 text-xs">
                <div className="font-semibold text-[var(--fd-text-primary)] flex items-center gap-1.5">
                  <FileCheck2 size={16} className="text-[var(--fd-status-done)]" />
                  <span>Onboarding Summary</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[var(--fd-text-secondary)]">
                  <div><strong>Entity:</strong> {form.watch('displayName') || '—'} ({CLIENT_TYPE_LABELS[clientType]})</div>
                  <div><strong>PAN:</strong> {form.watch('pan') || 'Pending'}</div>
                  <div><strong>City/State:</strong> {form.watch('address.city') || '—'}, {form.watch('address.state')}</div>
                  <div><strong>Primary Contact:</strong> {form.watch('primaryContact.name')}</div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-[var(--fd-border-subtle)] pt-5">
            {currentStep > 1 ? (
              <Button
                type="button"
                variant="secondary"
                iconLeft={<ArrowLeft size={16} />}
                onClick={handlePrevStep}
              >
                Previous
              </Button>
            ) : (
              <div />
            )}

            {currentStep < STEPS.length ? (
              <Button
                type="button"
                variant="primary"
                iconRight={<ArrowRight size={16} />}
                onClick={handleNextStep}
              >
                Next Step
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={form.formState.isSubmitting}
                loadingLabel="Submitting Onboarding Details..."
                iconRight={<CheckCircle2 size={16} />}
              >
                Submit & Enter Portal
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

