<template>
  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-if="name==='menu'" d="M4 6h16M4 12h16M4 18h16" />
    <path v-else-if="name==='grid'" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    <path v-else-if="name==='car'" d="M4 15h16M6 15l2-6h8l2 6M7 18h.01M17 18h.01M5 15v3h14v-3" />
    <path v-else-if="name==='plus'" d="M12 5v14M5 12h14" />
    <path v-else-if="name==='tag'" d="M20 12l-8 8-8-8V4h8l8 8zM7.5 7.5h.01" />
    <path v-else-if="name==='list'" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    <path v-else-if="name==='sliders'" d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4M14 4v4M8 10v4M14 16v4" />
    <path v-else-if="name==='image'" d="M4 5h16v14H4zM8 10h.01M4 16l4-4 4 4 3-3 5 5" />
    <path v-else-if="name==='cart'" d="M4 5h2l2 10h10l2-7H7M10 19h.01M17 19h.01" />
    <path v-else-if="name==='file'" d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />
    <path v-else-if="name==='card'" d="M3 6h18v12H3zM3 10h18M7 15h4" />
    <path v-else-if="name==='swap'" d="M7 7h13M17 4l3 3-3 3M17 17H4M7 14l-3 3 3 3" />
    <path v-else-if="name==='users'" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    <path v-else-if="name==='userPlus'" d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M18 8v6M15 11h6" />
    <path v-else-if="name==='bookmark'" d="M6 4h12v17l-6-4-6 4z" />
    <path v-else-if="name==='phone'" d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.7a2 2 0 0 1-.6 1.8L7.6 9.5a16 16 0 0 0 6.9 6.9l1.3-1.3a2 2 0 0 1 1.8-.6l2.7.4a2 2 0 0 1 1.7 2z" />
    <path v-else-if="name==='chart'" d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-9" />
    <path v-else-if="name==='pie'" d="M21 12a9 9 0 1 1-9-9v9zM12 3a9 9 0 0 1 9 9h-9z" />
    <path v-else-if="name==='settings'" d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3-.2-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-3.4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.2.1-2-3 .1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3 .2.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h3.4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.2-.1 2 3-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    <path v-else-if="name==='userCog'" d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4M19 13v2M19 19v2M16.5 14.5l1.4 1.4M20.1 18.1l1.4 1.4M16.5 19.5l1.4-1.4M20.1 15.9l1.4-1.4" />
    <path v-else-if="name==='database'" d="M4 6c0-2 16-2 16 0v12c0 2-16 2-16 0zM4 6c0 2 16 2 16 0M4 12c0 2 16 2 16 0" />
    <path v-else-if="name==='search'" d="M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" />
    <path v-else d="M5 12h14" />
  </svg>
</template>
<script setup lang="ts">
defineProps<{ name?: string }>()
</script>
