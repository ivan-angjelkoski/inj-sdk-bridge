<script setup lang="ts">
import type { BridgeStep, StepStatus } from "~/types/bridge";

const props = defineProps<{
  title: string;
  description: string;
  steps: BridgeStep[];
  actionLabel: string;
  actionDisabled?: boolean;
  errorMessage?: string | null;
}>();

const emit = defineEmits<{
  (event: "action"): void;
}>();

const statusLabels: Record<StepStatus, string> = {
  idle: "Idle",
  pending: "Running",
  success: "Complete",
  error: "Error",
};

const statusSummary = computed(() => {
  if (props.steps.some((step) => step.status === "error")) {
    return "Error";
  }
  if (props.steps.every((step) => step.status === "success")) {
    return "Completed";
  }
  if (props.steps.some((step) => step.status === "pending")) {
    return "In progress";
  }
  return "Idle";
});

const statusClass = computed(() => {
  if (props.steps.some((step) => step.status === "error")) {
    return "status-error";
  }
  if (props.steps.every((step) => step.status === "success")) {
    return "status-success";
  }
  if (props.steps.some((step) => step.status === "pending")) {
    return "status-progress";
  }
  return "status-idle";
});
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <div>
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
      </div>
      <span class="status-pill" :class="statusClass">{{ statusSummary }}</span>
    </header>

    <div class="panel-meta">
      <slot name="meta" />
    </div>

    <div class="panel-steps">
      <h3>Steps</h3>
      <ul>
        <li v-for="step in steps" :key="step.id" class="step">
          <span class="step-dot" :data-status="step.status"></span>
          <div class="step-body">
            <span class="step-label">{{ step.label }}</span>
            <span v-if="step.detail" class="step-detail">
              <span class="step-detail-label">{{ step.detail.label }}:</span>
              <a
                v-if="step.detail.href"
                class="step-link"
                :href="step.detail.href"
                target="_blank"
                rel="noreferrer"
              >
                {{ step.detail.value }}
              </a>
              <span v-else>{{ step.detail.value }}</span>
            </span>
          </div>
          <span class="step-status" :data-status="step.status">
            {{ statusLabels[step.status] }}
          </span>
        </li>
      </ul>
    </div>

    <p v-if="errorMessage" class="panel-error" role="status">
      {{ errorMessage }}
    </p>

    <div class="panel-footer">
      <button
        class="btn primary"
        type="button"
        :disabled="actionDisabled"
        @click="emit('action')"
      >
        {{ actionLabel }}
      </button>
      <slot name="footer" />
    </div>
  </section>
</template>

<style scoped>
.panel {
  background: var(--surface);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 18px;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.panel:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.panel-header h2 {
  margin: 0 0 6px;
  font-size: 20px;
}

.panel-header p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
}

.status-pill {
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--muted);
  white-space: nowrap;
}

.status-idle {
  background: var(--surface-muted);
  color: var(--muted);
}

.status-progress {
  background: rgba(26, 162, 164, 0.12);
  color: var(--accent-strong);
}

.status-success {
  background: #ecfdf3;
  color: #027a48;
}

.status-error {
  background: #fef3f2;
  color: #b42318;
}

.panel-meta {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel-steps h3 {
  margin: 0 0 12px;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--muted);
}

.panel-steps ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
}

.step {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
}

.step-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.step-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--surface-muted);
  border: 2px solid transparent;
}

.step-dot[data-status="pending"] {
  background: var(--accent);
  border-color: rgba(26, 162, 164, 0.3);
  animation: pulse 1.4s ease-in-out infinite;
}

.step-dot[data-status="success"] {
  background: #12b76a;
}

.step-dot[data-status="error"] {
  background: #f04438;
}

.step-label {
  font-weight: 500;
}

.step-detail {
  font-size: 12px;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.step-detail-label {
  font-weight: 600;
  color: var(--text);
}

.step-link {
  color: var(--accent-strong);
  text-decoration: none;
}

.step-link:hover {
  text-decoration: underline;
}

.step-status {
  font-size: 12px;
  color: var(--muted);
}

.step-status[data-status="pending"] {
  color: var(--accent-strong);
}

.step-status[data-status="success"] {
  color: #027a48;
}

.step-status[data-status="error"] {
  color: #b42318;
}

.panel-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fef3f2;
  color: #b42318;
  font-size: 13px;
}

.panel-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(26, 162, 164, 0.4);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(26, 162, 164, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(26, 162, 164, 0);
  }
}

@media (max-width: 720px) {
  .panel-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
