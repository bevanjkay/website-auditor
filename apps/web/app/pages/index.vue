<script setup lang="ts">
interface WebsiteRow {
  id: string;
  name: string;
  baseUrl: string;
  lastAuditStatus: string | null;
  lastAuditFinishedAt: string | null;
  issueCount: number | null;
  brokenLinkCount: number | null;
  typoCount: number | null;
  seoIssueCount: number | null;
}

const { data, refresh } = await useAsyncData<{ websites: WebsiteRow[] }>("websites", () =>
  $fetch("/api/websites"));
</script>

<template>
  <section class="stack">
    <div class="hero-card">
      <h2>Audit dashboard</h2>
      <p class="muted">
        Track every website, its latest audit state, and the highest-signal issue counts from the most recent run.
      </p>
      <div class="hero-grid">
        <MetricCard
          label="Tracked websites"
          :value="data?.websites.length ?? 0"
        />
        <MetricCard
          label="Completed audits"
          :value="data?.websites.filter((website) => website.lastAuditStatus === 'completed' || website.lastAuditStatus === 'completed_with_limits').length ?? 0"
        />
        <MetricCard
          label="Failed audits"
          :value="data?.websites.filter((website) => website.lastAuditStatus === 'failed').length ?? 0"
        />
      </div>
    </div>

    <section class="panel stack">
      <div style="display: flex; justify-content: space-between; gap: 16px; align-items: center;">
        <div>
          <h3>Websites</h3>
          <p class="muted">
            Add a site, review its discovery preview, and run a filtered crawl.
          </p>
        </div>
        <div class="nav-links">
          <NuxtLink
            class="button button-primary"
            to="/websites/new"
          >
            Add website
          </NuxtLink>
          <button @click="refresh()">
            Refresh
          </button>
        </div>
      </div>

      <div
        v-if="!data?.websites.length"
        class="empty"
      >
        No websites yet.
      </div>

      <table
        v-else
        class="table"
      >
        <thead>
          <tr>
            <th>Website</th>
            <th>Status</th>
            <th>Last audit</th>
            <th>Issues</th>
            <th>Broken</th>
            <th>Typos</th>
            <th>SEO</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="website in data.websites"
            :key="website.id"
          >
            <td>
              <NuxtLink :to="`/websites/${website.id}`">
                <strong>{{ website.name }}</strong>
              </NuxtLink>
              <div class="muted">{{ website.baseUrl }}</div>
            </td>
            <td>
              <StatusPill :value="website.lastAuditStatus ?? 'queued'" />
            </td>
            <td>{{ website.lastAuditFinishedAt ? new Date(website.lastAuditFinishedAt).toLocaleString() : 'Not yet run' }}</td>
            <td>{{ website.issueCount ?? 0 }}</td>
            <td>{{ website.brokenLinkCount ?? 0 }}</td>
            <td>{{ website.typoCount ?? 0 }}</td>
            <td>{{ website.seoIssueCount ?? 0 }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
