<script lang="ts">
  import { createTranslator } from '../lib/i18n';
  const t = createTranslator();
  export let dataUrl: string;
  export let mime: string;
  export let onRefresh: () => void = () => {};
</script>
<div class="preview">{#if mime === 'application/pdf'}<iframe title={t('pdfPreview')} src={dataUrl}></iframe>{:else}<img alt={t('filePreviewAlt')} src={dataUrl} />{/if}<button class="refresh" onclick={onRefresh} title={t('refreshPreview')}>↻ {t('refresh')}</button></div>
<style>
  .preview { position: relative; min-height: 0; flex: 1; display: grid; place-items: center; overflow: auto; background: rgba(127,127,127,.08); }
  img { max-width: 100%; max-height: 100%; object-fit: contain; }
  iframe { width: 100%; height: 100%; border: 0; }
  .refresh { position: absolute; right: 12px; top: 12px; border: 0; border-radius: 7px; padding: 5px 8px; color: var(--text); background: color-mix(in srgb, var(--panel) 88%, var(--text)); }
</style>
