<template>
  <div class="spinner" />
</template>

<style scoped>
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--sp-text-muted);
  border-top-color: var(--sp-text);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin: 16px auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
