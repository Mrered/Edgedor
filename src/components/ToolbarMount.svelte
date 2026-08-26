<script lang="ts">
  import { createTranslator } from '../lib/i18n';
  const t = createTranslator();
</script>
<div class="toolbar" aria-label={t('toolbarAria')}><span class="brand">Edgedor</span><span class="hint">⌘S {t('save')} · ⌘W {t('closed')}</span></div>
<style>.toolbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 10px; color: var(--muted); }.brand { color: var(--text); font-weight: 650; }.hint { font-size: 12px; opacity: .75; }</style>
