import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CheckCircle2, KeyRound, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  type AiConfigUpdate,
  type DetectedAiModel,
  detectAiModels,
  fetchAiConfig,
  updateAiConfig,
} from '@/api/ai.api';
import { queryKeys } from '@/api/queryKeys';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { FieldRow, Fieldset, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { SettingsNav } from '@/routes/settings/components/SettingsNav';
import { useToast } from '@/context/ToastContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { normaliseError } from '@/lib/errors';

type ProviderChoice = 'gemini' | 'openai' | 'none';

const FALLBACK_GEMINI_MODELS: DetectedAiModel[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash (Recommended)',
    description: 'High-speed reasoning, 1M context, best for practice copilot',
    recommended: true,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Fast, multimodal, low latency',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'Fast, cost-efficient, high volume',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'Complex reasoning and 2M token context window',
  },
];

const FALLBACK_OPENAI_MODELS: DetectedAiModel[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini (Recommended)',
    description: 'Fast, lightweight, cost-efficient practice copilot',
    recommended: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'High-intelligence flagship multimodal model',
  },
  {
    id: 'o3-mini',
    name: 'o3-mini',
    description: 'Fast reasoning model for complex tasks',
  },
  {
    id: 'o1',
    name: 'o1',
    description: 'Advanced reasoning and deep planning',
  },
];

export function AiSettings() {
  usePageTitle('AI copilot settings');
  const queryClient = useQueryClient();
  const { success, errorToast } = useToast();

  const query = useQuery({
    queryKey: queryKeys.settings.aiConfig,
    queryFn: fetchAiConfig,
  });
  const config = query.data;

  const [providerDraft, setProviderDraft] = useState<ProviderChoice | null>(null);
  const [geminiModelDraft, setGeminiModelDraft] = useState<string | null>(null);
  const [openaiModelDraft, setOpenaiModelDraft] = useState<string | null>(null);
  const [geminiCustomMode, setGeminiCustomMode] = useState(false);
  const [openaiCustomMode, setOpenaiCustomMode] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');

  // Drafts override server values until the user edits them; server data stays
  // the source of truth otherwise, so no effect-based setState is needed.
  const provider: ProviderChoice = providerDraft ?? config?.provider ?? 'none';
  const geminiModel: string = geminiModelDraft ?? config?.gemini?.model ?? 'gemini-2.5-flash';
  const openaiModel: string = openaiModelDraft ?? config?.openai?.model ?? 'gpt-4o-mini';

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.settings.aiConfig });
  };

  const geminiModelsQuery = useQuery({
    queryKey: ['ai', 'models', 'gemini', config?.gemini?.keySet ? 'saved' : 'none'],
    queryFn: () => detectAiModels({ provider: 'gemini' }),
    enabled: provider === 'gemini',
    staleTime: 5 * 60 * 1000,
  });

  const openaiModelsQuery = useQuery({
    queryKey: ['ai', 'models', 'openai', config?.openai?.keySet ? 'saved' : 'none'],
    queryFn: () => detectAiModels({ provider: 'openai' }),
    enabled: provider === 'openai',
    staleTime: 5 * 60 * 1000,
  });

  const detectMutation = useMutation({
    mutationFn: (args: { provider: 'gemini' | 'openai'; apiKey?: string }) => detectAiModels(args),
    onSuccess: (data) => {
      if (data.detected) {
        success(
          `Detected ${data.models.length} models from ${
            data.provider === 'gemini' ? 'Google Gemini' : 'OpenAI'
          }`,
        );
        const currentModel = data.provider === 'gemini' ? geminiModel : openaiModel;
        const exists = data.models.some((m) => m.id === currentModel);
        if (!exists && data.models.length > 0) {
          const rec = data.models.find((m) => m.recommended) ?? data.models[0];
          if (rec) {
            if (data.provider === 'gemini') {
              setGeminiModelDraft(rec.id);
              setGeminiCustomMode(false);
            } else {
              setOpenaiModelDraft(rec.id);
              setOpenaiCustomMode(false);
            }
          }
        }
      } else if (data.error) {
        errorToast(new Error(data.error), 'Model detection notice');
      }
    },
    onError: (err: unknown) => {
      normaliseError(err);
    },
  });

  const geminiDetection =
    detectMutation.data?.provider === 'gemini' ? detectMutation.data : geminiModelsQuery.data;
  const geminiModelList = geminiDetection?.models ?? FALLBACK_GEMINI_MODELS;

  const openaiDetection =
    detectMutation.data?.provider === 'openai' ? detectMutation.data : openaiModelsQuery.data;
  const openaiModelList = openaiDetection?.models ?? FALLBACK_OPENAI_MODELS;

  const geminiSelectOptions = [
    ...geminiModelList.map((m) => ({
      value: m.id,
      label: m.name,
    })),
    ...(geminiModelList.some((m) => m.id === geminiModel) || geminiCustomMode
      ? []
      : [{ value: geminiModel, label: `${geminiModel} (custom)` }]),
    { value: '__custom__', label: 'Custom model...' },
  ];

  const openaiSelectOptions = [
    ...openaiModelList.map((m) => ({
      value: m.id,
      label: m.name,
    })),
    ...(openaiModelList.some((m) => m.id === openaiModel) || openaiCustomMode
      ? []
      : [{ value: openaiModel, label: `${openaiModel} (custom)` }]),
    { value: '__custom__', label: 'Custom model...' },
  ];

  const saveMutation = useMutation({
    mutationFn: (body: AiConfigUpdate) => updateAiConfig(body),
    onSuccess: () => {
      setProviderDraft(null);
      setGeminiModelDraft(null);
      setOpenaiModelDraft(null);
      invalidate();
      success('AI copilot configuration saved');
    },
    onError: (error: unknown) => {
      normaliseError(error);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => updateAiConfig({ enabled }),
    onSuccess: (updated) => {
      invalidate();
      success(updated.enabled ? 'AI copilot activated' : 'AI copilot deactivated');
    },
    onError: (error: unknown) => {
      normaliseError(error);
    },
  });

  const clearKeyMutation = useMutation({
    mutationFn: (which: 'gemini' | 'openai') =>
      updateAiConfig(which === 'gemini' ? { geminiApiKey: null } : { openaiApiKey: null }),
    onSuccess: () => {
      invalidate();
      success('API key removed');
    },
    onError: (error: unknown) => {
      normaliseError(error);
    },
  });

  const saveProviderAndKeys = () => {
    const body: AiConfigUpdate = {
      provider: provider === 'none' ? null : provider,
    };
    if (provider === 'gemini') {
      if (geminiKey.trim().length > 0) {
        body.geminiApiKey = geminiKey.trim();
      }
      body.geminiModel = geminiModel.trim() || 'gemini-2.5-flash';
    }
    if (provider === 'openai') {
      if (openaiKey.trim().length > 0) {
        body.openaiApiKey = openaiKey.trim();
      }
      body.openaiModel = openaiModel.trim() || 'gpt-4o-mini';
    }
    saveMutation.mutate(body);
    setGeminiKey('');
    setOpenaiKey('');
  };

  const saveModelOnly = () => {
    const body: AiConfigUpdate = {};
    if (geminiModel.trim().length > 0 && geminiModel.trim() !== config?.gemini.model) {
      body.geminiModel = geminiModel.trim();
    }
    if (openaiModel.trim().length > 0 && openaiModel.trim() !== config?.openai.model) {
      body.openaiModel = openaiModel.trim();
    }
    if (Object.keys(body).length > 0) saveMutation.mutate(body);
  };

  const pending =
    saveMutation.isPending ||
    toggleMutation.isPending ||
    clearKeyMutation.isPending ||
    detectMutation.isPending;

  const providerKeySet =
    config === undefined
      ? false
      : provider === 'gemini'
        ? (config.gemini?.keySet ?? false)
        : provider === 'openai'
          ? (config.openai?.keySet ?? false)
          : false;
  const canEnable =
    config !== undefined && provider !== 'none' && (providerKeySet || config.source !== 'none');

  if (query.isError) {
    return (
      <>
        <PageHeader title="Settings" description="Configure the FirmDesk AI copilot." />
        <SettingsNav />
        <ErrorState
          error={query.error}
          title="AI configuration did not load"
          onRetry={() => {
            void query.refetch();
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        featureKey="settings"
        description="Firm details, the compliance catalogue, users and the audit trail."
      />
      <SettingsNav />

      {query.isPending ? (
        <div className="max-w-[880px] space-y-4" aria-busy="true">
          <Skeleton className="h-48 w-full" rounded="lg" />
          <Skeleton className="h-64 w-full" rounded="lg" />
        </div>
      ) : (
        <div className="max-w-[880px] space-y-4">
          {/* Status card */}
          <Card>
            <CardHeader
              title="AI Copilot status"
              description="Connect Gemini or OpenAI to power the FirmDesk assistant with live firm data."
            />
            <div className="flex flex-wrap items-center gap-3 px-4 pb-4">
              <span
                className={`inline-flex h-2.5 w-2.5 items-center justify-center rounded-full ${
                  config?.enabled && config.hasKey ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
              <span className="text-sm text-[var(--fd-text-secondary)]">
                {config?.enabled && config.hasKey
                  ? `Active — ${config.provider === 'gemini' ? 'Gemini' : 'OpenAI'} (${config.activeModel ?? 'default model'})`
                  : 'Inactive — reference mode only'}
              </span>
              <Badge tone={config?.source === 'db' ? 'accent' : 'neutral'}>
                {config?.source === 'db'
                  ? 'Database config'
                  : config?.source === 'env'
                    ? 'Env fallback'
                    : 'No provider'}
              </Badge>
            </div>
            <div className="border-t border-[var(--fd-border-subtle)] px-4 py-3">
              <Switch
                checked={config?.enabled ?? false}
                disabled={!canEnable || toggleMutation.isPending}
                onCheckedChange={(checked: boolean) => toggleMutation.mutate(checked)}
                label="Enable AI Copilot"
                description="Turns on live LLM answers in the Ask AI assistant."
              />
            </div>
            {!canEnable && (
              <p className="px-4 pb-4 text-xs text-[var(--fd-text-tertiary)]">
                Choose a provider and save its API key below before enabling.
              </p>
            )}
          </Card>

          {/* Provider + key card */}
          <Card>
            <Fieldset
              legend="AI provider"
              description="The provider key is encrypted at rest and never shown again after saving."
            >
              <FormField label="Provider">
                {({ inputId, describedBy }) => (
                  <Select
                    id={inputId}
                    ariaDescribedBy={describedBy}
                    value={provider}
                    onValueChange={(value) => {
                      setProviderDraft(value as ProviderChoice);
                    }}
                    options={[
                      { value: 'none', label: 'Not configured' },
                      { value: 'gemini', label: 'Google Gemini (recommended)' },
                      { value: 'openai', label: 'OpenAI' },
                    ]}
                  />
                )}
              </FormField>

              {provider === 'gemini' && (
                <div className="space-y-4 pt-2">
                  <FieldRow>
                    <FormField
                      label="Gemini API key"
                      helper={
                        config?.gemini?.keySet
                          ? 'A key is already saved. Enter a new one to replace it.'
                          : 'Create one at aistudio.google.com/apikey.'
                      }
                    >
                      {({ inputId, describedBy, invalid }) => (
                        <Input
                          id={inputId}
                          type="password"
                          placeholder="AIza…"
                          value={geminiKey}
                          invalid={invalid}
                          aria-describedby={describedBy}
                          onChange={(event) => {
                            setGeminiKey(event.target.value);
                          }}
                        />
                      )}
                    </FormField>

                    <FormField
                      label="Model"
                      helper={
                        geminiDetection?.detected
                          ? `Auto-detected ${geminiModelList.length} models for this Gemini key.`
                          : 'Pick a model or click Auto-detect to fetch available models.'
                      }
                    >
                      {({ inputId, describedBy }) => (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <Select
                                id={inputId}
                                ariaDescribedBy={describedBy}
                                value={geminiCustomMode ? '__custom__' : geminiModel}
                                onValueChange={(val) => {
                                  if (val === '__custom__') {
                                    setGeminiCustomMode(true);
                                  } else {
                                    setGeminiCustomMode(false);
                                    setGeminiModelDraft(val);
                                  }
                                }}
                                options={geminiSelectOptions}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              loading={
                                detectMutation.isPending &&
                                detectMutation.variables?.provider === 'gemini'
                              }
                              onClick={() => {
                                detectMutation.mutate({
                                  provider: 'gemini',
                                  apiKey: geminiKey.trim() || undefined,
                                });
                              }}
                              title="Auto-detect accessible models using the API key"
                            >
                              <Sparkles
                                className="h-3.5 w-3.5 text-indigo-500"
                                aria-hidden="true"
                              />
                              Auto-detect
                            </Button>
                          </div>

                          {geminiCustomMode && (
                            <Input
                              placeholder="Enter custom model (e.g. gemini-2.5-flash)"
                              value={geminiModel}
                              onChange={(e) => setGeminiModelDraft(e.target.value)}
                              aria-label="Custom Gemini model"
                            />
                          )}

                          {geminiDetection?.detected && (
                            <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Live models synced with Google Gemini</span>
                            </p>
                          )}
                        </div>
                      )}
                    </FormField>
                  </FieldRow>

                  {config?.gemini?.keySet && (
                    <Button
                      type="button"
                      variant="secondary"
                      loading={clearKeyMutation.isPending}
                      onClick={() => {
                        clearKeyMutation.mutate('gemini');
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remove saved Gemini key
                    </Button>
                  )}
                </div>
              )}

              {provider === 'openai' && (
                <div className="space-y-4 pt-2">
                  <FieldRow>
                    <FormField
                      label="OpenAI API key"
                      helper={
                        config?.openai?.keySet
                          ? 'A key is already saved. Enter a new one to replace it.'
                          : 'Create one at platform.openai.com/api-keys.'
                      }
                    >
                      {({ inputId, describedBy, invalid }) => (
                        <Input
                          id={inputId}
                          type="password"
                          placeholder="sk-…"
                          value={openaiKey}
                          invalid={invalid}
                          aria-describedby={describedBy}
                          onChange={(event) => {
                            setOpenaiKey(event.target.value);
                          }}
                        />
                      )}
                    </FormField>

                    <FormField
                      label="Model"
                      helper={
                        openaiDetection?.detected
                          ? `Auto-detected ${openaiModelList.length} models for this OpenAI key.`
                          : 'Pick a model or click Auto-detect to fetch available models.'
                      }
                    >
                      {({ inputId, describedBy }) => (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <Select
                                id={inputId}
                                ariaDescribedBy={describedBy}
                                value={openaiCustomMode ? '__custom__' : openaiModel}
                                onValueChange={(val) => {
                                  if (val === '__custom__') {
                                    setOpenaiCustomMode(true);
                                  } else {
                                    setOpenaiCustomMode(false);
                                    setOpenaiModelDraft(val);
                                  }
                                }}
                                options={openaiSelectOptions}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              loading={
                                detectMutation.isPending &&
                                detectMutation.variables?.provider === 'openai'
                              }
                              onClick={() => {
                                detectMutation.mutate({
                                  provider: 'openai',
                                  apiKey: openaiKey.trim() || undefined,
                                });
                              }}
                              title="Auto-detect accessible models using the API key"
                            >
                              <Sparkles
                                className="h-3.5 w-3.5 text-indigo-500"
                                aria-hidden="true"
                              />
                              Auto-detect
                            </Button>
                          </div>

                          {openaiCustomMode && (
                            <Input
                              placeholder="Enter custom model (e.g. gpt-4o-mini)"
                              value={openaiModel}
                              onChange={(e) => setOpenaiModelDraft(e.target.value)}
                              aria-label="Custom OpenAI model"
                            />
                          )}

                          {openaiDetection?.detected && (
                            <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Live models synced with OpenAI</span>
                            </p>
                          )}
                        </div>
                      )}
                    </FormField>
                  </FieldRow>

                  {config?.openai?.keySet && (
                    <Button
                      type="button"
                      variant="secondary"
                      loading={clearKeyMutation.isPending}
                      onClick={() => {
                        clearKeyMutation.mutate('openai');
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remove saved OpenAI key
                    </Button>
                  )}
                </div>
              )}
            </Fieldset>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--fd-border-subtle)] px-4 py-3">
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={saveModelOnly}
              >
                Save models only
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={saveMutation.isPending}
                disabled={provider === 'none' && config?.provider !== null}
                onClick={saveProviderAndKeys}
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Save provider
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="What the copilot can do"
              description="Once enabled, the assistant answers with live tool access to firm data."
            />
            <ul className="space-y-1.5 px-4 pb-4 text-sm text-[var(--fd-text-secondary)]">
              <li className="flex items-start gap-2">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />
                Reads live client, filing, deadline and task data scoped to each user's access.
              </li>
              <li className="flex items-start gap-2">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />
                Creates tasks and raises document requests for admin and staff users.
              </li>
              <li className="flex items-start gap-2">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />
                Falls back to built-in reference answers whenever the provider is unavailable.
              </li>
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
