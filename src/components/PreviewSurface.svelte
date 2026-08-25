<script lang="ts">
  export let dataUrl: string;
  export let mime: string;
</script>
<div class="preview">{#if mime === 'application/pdf'}<iframe title="PDF 预览" src={dataUrl}></iframe>{:else}<img alt="文件预览" src={dataUrl} />{/if}</div>
<style>
  .preview { min-height: 0; flex: 1; display: grid; place-items: center; overflow: auto; background: rgba(127,127,127,.08); }
  img { max-width: 100%; max-height: 100%; object-fit: contain; }
  iframe { width: 100%; height: 100%; border: 0; }
</style>
