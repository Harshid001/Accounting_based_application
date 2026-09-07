import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, KeyRound, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { type AiConfigUpdate, fetchAiConfig, updateAiConfig } from '@/api/ai.api';
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

export function AiSettings() {
  usePageTitle('AI copilot settings');
  const queryClient = useQueryClient();
  const { success } = useToast();

  const query = useQuery({
    queryKey: queryKeys.settings.aiConfig,
    queryFn: fetchAiConfig,
  });
  const config = query.data;

  const [providerDraft, setProviderDraft] = useState<ProviderChoice | null>(null);
  const [geminiModelDraft, setGeminiModelDraft] = useState<string | null>(null);
  const [openaiModelDraft, setOpenaiModelDraft] = useState<string | null>(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');

  // Drafts override server values until the user edits them; server data stays
  // the source of truth otherwise, so no effect-based setState is needed.
  const provider: ProviderChoice = providerDraft ?? config?.provider ?? 'none';
  const geminiModel: string = geminiModelDraft ?? config?.gemini.model ?? 'gemini-2.5-flash';
  const openaiModel: string = openaiModelDraft ?? config?.openai.model ?? 'gpt-4o-mini';

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.settings.aiConfig });
  };

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
    onSuccess: (config) => {
      invalidate();
      success(config.enabled ? 'AI copilot activated' : 'AI copilot deactivated');
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
    if (provider === 'gemini' && geminiKey.trim().length > 0) {
      body.geminiApiKey = geminiKey.trim();
      body.geminiModel = geminiModel.trim() || 'gemini-2.5-flash';
    }
    if (provider === 'openai' && openaiKey.trim().length > 0) {
      body.openaiApiKey = openaiKey.trim();
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

  const pending = saveMutation.isPending || toggleMutation.isPending || clearKeyMutation.isPending;
  const providerKeySet =
    config === undefined
      ? false
      : provider === 'gemini'
        ? config.gemini.keySet
        : provider === 'openai'
          ? config.openai.keySet
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
                        config?.gemini.keySet
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
                    <FormField label="Model" helper="For example gemini-2.5-flash.">
                      {({ inputId, describedBy }) => (
                        <Input
                          id={inputId}
                          value={geminiModel}
                          aria-describedby={describedBy}
                          onChange={(event) => {
                            setGeminiModelDraft(event.target.value);
                          }}
                        />
                      )}
                    </FormField>
                  </FieldRow>
                  {config?.gemini.keySet && (
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
                        config?.openai.keySet
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
                    <FormField label="Model" helper="For example gpt-4o-mini.">
                      {({ inputId, describedBy }) => (
                        <Input
                          id={inputId}
                          value={openaiModel}
                          aria-describedby={describedBy}
                          onChange={(event) => {
                            setOpenaiModelDraft(event.target.value);
                          }}
                        />
                      )}
                    </FormField>
                  </FieldRow>
                  {config?.openai.keySet && (
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
